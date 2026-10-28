export const FMF_MAGIC = [0x02, 0x01, 0x66, 0x6d, 0x66, 0x2e];
export const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

export function findAll(bytes, signature) {
  const hits = [];
  for (let i = 0; i <= bytes.length - signature.length; i++) {
    let ok = true;
    for (let j = 0; j < signature.length; j++) if (bytes[i + j] !== signature[j]) { ok = false; break; }
    if (ok) hits.push(i);
  }
  return hits;
}

export function hasSignature(bytes, signature, offset = 0) {
  return signature.every((v, i) => bytes[offset + i] === v);
}

class Reader {
  constructor(bytes) { this.bytes = bytes; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); this.pos = 0; }
  need(n) { if (!Number.isSafeInteger(n) || n < 0 || this.pos + n > this.bytes.length) throw new Error(`Indeks FMF terpotong pada offset 0x${this.pos.toString(16)}`); }
  u32() { this.need(4); const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  u64() { this.need(8); const v = this.view.getBigUint64(this.pos, true); this.pos += 8; if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Offset/ukuran melampaui batas angka aman JavaScript'); return Number(v); }
  str() { const n = this.u32(); if (n > 1024 * 1024) throw new Error(`Panjang nama tidak masuk akal (${n} byte)`); this.need(n); const v = new TextDecoder('utf-8', { fatal: false }).decode(this.bytes.subarray(this.pos, this.pos + n)); this.pos += n; return v; }
}

function safeComponent(name) {
  const s = String(name).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
  if (!s || s === '.' || s === '..') throw new Error(`Nama file/folder tidak aman: ${JSON.stringify(name)}`);
  return s;
}

export function parseIndex(indexBytes, payloadLength) {
  const r = new Reader(indexBytes);
  const files = [];
  const directories = [];
  let visitedNodes = 0;
  const MAX_NODES = 100000;

  function readDirectory(parentPath = '', depth = 0) {
    if (depth > 80) throw new Error('Kedalaman folder melewati batas keamanan');
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
      const boundsOK = offset <= payloadLength && storedSize <= payloadLength - offset;
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
  if (r.pos !== indexBytes.length) throw new Error(`Parser berhenti pada ${r.pos} dari ${indexBytes.length} byte; format belum dikenali sepenuhnya`);
  const invalid = files.filter(f => !f.boundsOK);
  if (invalid.length) throw new Error(`${invalid.length} entri menunjuk ke luar area data; ekstraksi dibatalkan demi keamanan`);
  return { root, files, directories, indexLength: indexBytes.length, parsedBytes: r.pos };
}

export function classifyName(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (['xml', 'fontxml', 'txt', 'json', 'cfg', 'ini', 'html', 'css', 'js', 'lua', 'xmlc'].includes(ext)) return 'text';
  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'dds', 'tga'].includes(ext)) return 'image';
  if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) return 'font';
  return 'binary';
}

export async function inspectFMF(file, onProgress = () => {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 32 || !hasSignature(bytes, FMF_MAGIC, 0)) throw new Error('Header FMF 02 01 fmf. tidak ditemukan di awal file');
  onProgress('Mencari segmen indeks…');
  const headers = findAll(bytes, FMF_MAGIC);
  const nestedHeader = headers.filter(x => x > 0).at(-1);
  if (nestedHeader == null) throw new Error('Header indeks bersarang tidak ditemukan. Format file ini belum didukung.');
  const zstdPositions = findAll(bytes, ZSTD_MAGIC).filter(x => x > nestedHeader);
  if (!zstdPositions.length) throw new Error('Frame Zstandard untuk indeks tidak ditemukan');
  const zstdStart = zstdPositions[0];
  const payloadStart = 26;
  const payloadEnd = nestedHeader;
  if (payloadEnd < payloadStart) throw new Error('Batas payload tidak valid');
  const payload = bytes.subarray(payloadStart, payloadEnd);

  onProgress('Memuat decoder Zstandard…');
  const zstd = await import('https://cdn.jsdelivr.net/npm/fzstd@0.1.1/esm/index.mjs');
  onProgress('Mendekompresi indeks…');
  const indexBytes = zstd.decompress(bytes.subarray(zstdStart));
  onProgress('Membaca pohon direktori…');
  const parsed = parseIndex(indexBytes, payload.length);

  const report = {
    fileName: file.name,
    fileSize: bytes.length,
    payloadSize: payload.length,
    indexSize: indexBytes.length,
    directoryCount: parsed.directories.length,
    fileCount: parsed.files.length,
    textCount: parsed.files.filter(f => f.kind === 'text').length,
    imageCount: parsed.files.filter(f => f.kind === 'image').length,
    fontCount: parsed.files.filter(f => f.kind === 'font').length,
    binaryCount: parsed.files.filter(f => f.kind === 'binary').length,
    nestedHeaderOffset: nestedHeader,
    zstdIndexOffset: zstdStart,
    parsedIndexBytes: parsed.parsedBytes,
    boundsValid: parsed.files.every(f => f.boundsOK),
    note: 'Ekstraksi membaca rentang offset dan ukuran dari indeks. Pembuatan ulang FMF belum tersedia pada versi ini.'
  };
  return { bytes, payload, indexBytes, ...parsed, report };
}

export function extractEntry(state, entry, edits = new Map()) {
  if (edits.has(entry.path)) return edits.get(entry.path);
  return state.payload.slice(entry.offset, entry.offset + entry.storedSize);
}
