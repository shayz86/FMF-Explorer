export const FMF_MAGIC = [0x02, 0x01, 0x66, 0x6d, 0x66, 0x2e];
export const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];
const ASCII_FMF = [0x66, 0x6d, 0x66, 0x2e];

export function findAll(bytes, signature) {
  const hits = [];
  if (!signature.length || bytes.length < signature.length) return hits;
  // Boyer-free scan; signatures here are only 4–6 bytes and files are bounded.
  outer: for (let i = 0; i <= bytes.length - signature.length; i++) {
    for (let j = 0; j < signature.length; j++) if (bytes[i + j] !== signature[j]) continue outer;
    hits.push(i);
  }
  return hits;
}

export function hasSignature(bytes, signature, offset = 0) {
  return offset >= 0 && offset + signature.length <= bytes.length && signature.every((v, i) => bytes[offset + i] === v);
}

// FMF's first two bytes can vary by generation/build. The stable printable marker
// observed in FMF containers is "fmf." at offset +2; structural validation follows.
export function isFMFHeader(bytes, offset = 0) {
  return hasSignature(bytes, ASCII_FMF, offset + 2);
}

class Reader {
  constructor(bytes) { this.bytes = bytes; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); this.pos = 0; }
  need(n) { if (!Number.isSafeInteger(n) || n < 0 || this.pos + n > this.bytes.length) throw new Error(`Indeks terpotong pada offset 0x${this.pos.toString(16)}`); }
  u32() { this.need(4); const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  u64() { this.need(8); const v = this.view.getBigUint64(this.pos, true); this.pos += 8; if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Offset/ukuran melampaui batas angka aman JavaScript'); return Number(v); }
  str() { const n = this.u32(); if (n > 1024 * 1024) throw new Error(`Panjang nama tidak masuk akal (${n} byte)`); this.need(n); const v = new TextDecoder('utf-8', { fatal: false }).decode(this.bytes.subarray(this.pos, this.pos + n)); this.pos += n; return v; }
}

function safeComponent(name) {
  const original = String(name);
  const s = original.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
  if (!s || s === '.' || s === '..') throw new Error(`Nama file/folder tidak aman: ${JSON.stringify(original)}`);
  return s;
}

export function parseIndex(indexBytes, payloadLength) {
  const r = new Reader(indexBytes);
  const files = [];
  const directories = [];
  let visitedNodes = 0;
  const MAX_NODES = 150000;

  function readDirectory(parentPath = '', depth = 0) {
    if (depth > 100) throw new Error('Kedalaman folder melewati batas keamanan');
    if (++visitedNodes > MAX_NODES) throw new Error('Jumlah entri indeks melewati batas keamanan');
    const rawName = r.str();
    const name = safeComponent(rawName);
    const path = parentPath ? `${parentPath}/${name}` : name;
    const dir = { name, path, files: [], directories: [] };
    directories.push(dir);

    const fileCount = r.u32();
    if (fileCount > MAX_NODES) throw new Error(`Jumlah file tidak masuk akal pada ${path}`);
    for (let i = 0; i < fileCount; i++) {
      if (++visitedNodes > MAX_NODES) throw new Error('Jumlah entri indeks melewati batas keamanan');
      const base = safeComponent(r.str());
      const extension = r.str().replace(/[\\/:*?"<>|\x00-\x1f]/g, '_');
      const offset = r.u64();
      const storedSize = r.u64();
      const unpackedSize = r.u64();
      const timestamp = r.u64();
      const hash = r.u64();
      const filename = `${base}${extension}`;
      const filePath = `${path}/${filename}`;
      const boundsOK = Number.isSafeInteger(offset) && Number.isSafeInteger(storedSize) && offset <= payloadLength && storedSize <= payloadLength - offset;
      const entry = { name: filename, path: filePath, directory: path, offset, storedSize, unpackedSize, timestamp, hash, boundsOK, kind: classifyName(filename) };
      dir.files.push(entry);
      files.push(entry);
    }

    const dirCount = r.u32();
    if (dirCount > MAX_NODES) throw new Error(`Jumlah subfolder tidak masuk akal pada ${path}`);
    for (let i = 0; i < dirCount; i++) dir.directories.push(readDirectory(path, depth + 1));
    return dir;
  }

  const root = readDirectory();
  if (r.pos !== indexBytes.length) throw new Error(`Indeks belum terbaca penuh (${r.pos}/${indexBytes.length} byte)`);
  const invalid = files.filter(f => !f.boundsOK);
  if (invalid.length) throw new Error(`${invalid.length} entri menunjuk ke luar area data`);
  const paths = new Set();
  for (const f of files) {
    if (paths.has(f.path.toLowerCase())) throw new Error(`Path resource duplikat: ${f.path}`);
    paths.add(f.path.toLowerCase());
  }
  return { root, files, directories, indexLength: indexBytes.length, parsedBytes: r.pos };
}

export function classifyName(name) {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (['xml', 'fontxml', 'txt', 'json', 'cfg', 'ini', 'html', 'css', 'js', 'lua', 'xmlc', 'yaml', 'yml', 'csv', 'md', 'svg'].includes(ext)) return 'text';
  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'dds', 'tga', 'tif', 'tiff', 'ico'].includes(ext)) return 'image';
  if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) return 'font';
  return 'binary';
}

function payloadStartCandidates(bytes) {
  // Try the layout already verified on Tato.fmf first, then common header lengths.
  // A candidate is accepted only if the decompressed index parses fully and every
  // resource range stays within the candidate payload.
  const candidates = [26, 24, 28, 32, 22, 20, 18, 16, 14, 12, 10, 8, 6, 40, 48, 64];
  const found = new Set(candidates.filter(n => n < bytes.length));
  // Also probe short aligned offsets for newer/older header variants.
  for (let n = 6; n <= 96; n += 2) if (n < bytes.length) found.add(n);
  return [...found].sort((a, b) => {
    const rank = n => candidates.indexOf(n) < 0 ? 100 + n : candidates.indexOf(n);
    return rank(a) - rank(b);
  });
}

async function loadZstd() {
  const urls = [
    'https://cdn.jsdelivr.net/npm/fzstd@0.1.1/esm/index.mjs',
    'https://unpkg.com/fzstd@0.1.1/esm/index.mjs'
  ];
  let lastError;
  for (const url of urls) {
    try {
      const mod = await import(url);
      if (typeof mod.decompress === 'function') return mod;
      lastError = new Error('Modul decoder tidak menyediakan fungsi decompress');
    } catch (e) { lastError = e; }
  }
  throw new Error(`Decoder Zstandard tidak dapat dimuat. Periksa koneksi internet atau pemblokir CDN. Detail: ${lastError?.message || 'tidak diketahui'}`);
}

function headerOffsets(bytes) {
  // Include the first header plus any nested header; candidate parse validation
  // rejects accidental "fmf." sequences inside resource bytes.
  return findAll(bytes, ASCII_FMF).map(p => p - 2).filter(p => p >= 0 && isFMFHeader(bytes, p));
}

export async function inspectFMF(file, onProgress = () => {}) {
  if (!file) throw new Error('Pilih file FMF terlebih dahulu');
  if (file.size < 32) throw new Error('File terlalu kecil untuk menjadi arsip FMF');
  // Prevent accidental browser OOM on mobile. This is a protective ceiling, not a format limit.
  const MAX_FILE_SIZE = 512 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) throw new Error(`File berukuran ${Math.round(file.size / 1024 / 1024)} MB. Batas aman browser versi ini 512 MB; coba file yang lebih kecil agar browser Android tidak kehabisan memori.`);

  onProgress('Membaca file…');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isFMFHeader(bytes, 0)) throw new Error('Header FMF tidak dikenali. File harus memiliki penanda "fmf." pada header; mungkin file rusak, bukan FMF, atau memakai format yang belum didukung.');

  onProgress('Mencari header indeks dan frame Zstandard…');
  const headers = headerOffsets(bytes).filter(p => p > 0).sort((a, b) => b - a);
  const allZstd = findAll(bytes, ZSTD_MAGIC);
  const zstd = await loadZstd();
  const failures = [];
  const payloadStarts = payloadStartCandidates(bytes);
  const attempts = [];

  // Strategy A: known container family with a nested FMF marker followed by a
  // compressed directory index. Try each marker rather than blindly choosing last.
  for (const nestedHeader of headers) {
    const frames = allZstd.filter(p => p > nestedHeader).sort((a, b) => a - b);
    for (const zstdStart of frames) {
      attempts.push({ nestedHeader, zstdStart, mode: 'nested-index' });
    }
  }
  // Strategy B: variants where the trailing Zstandard frame directly starts the
  // index and there is no second visible FMF marker.
  if (!attempts.length) {
    for (const zstdStart of allZstd.filter(p => p > 0)) attempts.push({ nestedHeader: zstdStart, zstdStart, mode: 'direct-index' });
  }

  for (const attempt of attempts) {
    onProgress(`Menguji struktur arsip (${attempt.mode})…`);
    let indexBytes;
    try { indexBytes = zstd.decompress(bytes.subarray(attempt.zstdStart)); }
    catch (e) { failures.push(`Frame ${attempt.zstdStart}: dekompresi gagal`); continue; }
    const payloadEnd = attempt.nestedHeader;
    for (const payloadStart of payloadStarts) {
      if (payloadStart >= payloadEnd) continue;
      const payloadLength = payloadEnd - payloadStart;
      try {
        const parsed = parseIndex(indexBytes, payloadLength);
        if (!parsed.files.length && parsed.directories.length <= 1) throw new Error('Indeks kosong atau tidak meyakinkan');
        // Extra sanity: each entry should have a plausible name and at least one
        // of the file ranges should be non-empty for a resource archive.
        const nonEmpty = parsed.files.filter(f => f.storedSize > 0).length;
        if (parsed.files.length > 0 && nonEmpty === 0) throw new Error('Semua resource berukuran nol');
        const payload = bytes.slice(payloadStart, payloadEnd);
        const report = {
          fileName: file.name, fileSize: bytes.length, payloadSize: payload.length,
          indexSize: indexBytes.length, directoryCount: parsed.directories.length,
          fileCount: parsed.files.length,
          textCount: parsed.files.filter(f => f.kind === 'text').length,
          imageCount: parsed.files.filter(f => f.kind === 'image').length,
          fontCount: parsed.files.filter(f => f.kind === 'font').length,
          binaryCount: parsed.files.filter(f => f.kind === 'binary').length,
          topHeaderVersion: `${bytes[0]}.${bytes[1]}`,
          topHeaderOffset: 0, nestedHeaderOffset: attempt.nestedHeader,
          zstdIndexOffset: attempt.zstdStart, payloadStartOffset: payloadStart,
          indexMode: attempt.mode, parser: 'FMF adaptive index parser v0.4',
          parsedIndexBytes: parsed.parsedBytes, boundsValid: parsed.files.every(f => f.boundsOK),
          note: 'Format diterima karena indeks terbaca penuh dan seluruh rentang resource berada dalam batas payload. Ini tidak membuktikan semua resource memiliki codec internal yang sama atau FMF dapat dibangun ulang.'
        };
        return { bytes, payload, indexBytes, ...parsed, report };
      } catch (e) {
        if (failures.length < 30) failures.push(`Header ${attempt.nestedHeader}, payload ${payloadStart}: ${e.message}`);
      }
    }
  }

  const seen = [...new Set(failures)].slice(0, 5).join(' | ');
  throw new Error(`Format FMF ini belum didukung oleh parser v0.4. Header awal dikenali, tetapi tidak ditemukan indeks yang dapat divalidasi. Kemungkinan: struktur indeks berbeda, indeks tidak berada pada frame Zstandard yang terdeteksi, atau file memakai format FMF dari generasi lain. ${seen ? 'Diagnostik: ' + seen : 'Tidak ada kandidat indeks yang cocok.'}`);
}

export function extractEntry(state, entry, edits = new Map()) {
  if (edits.has(entry.path)) return edits.get(entry.path);
  return state.payload.slice(entry.offset, entry.offset + entry.storedSize);
}
