import { inspectFMF } from './fmf-parser.js';

async function loadZipModule() {
  const urls = [
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm',
    'https://esm.sh/jszip@3.10.1'
  ];
  let last;
  for (const url of urls) {
    try {
      const mod = await import(url);
      const JSZip = mod.default || mod;
      if (typeof JSZip.loadAsync === 'function') return JSZip;
      last = new Error('Modul ZIP tidak menyediakan loadAsync');
    } catch (e) { last = e; }
  }
  throw new Error(`Pembaca ZIP tidak dapat dimuat. Periksa koneksi internet/CDN. ${last?.message || ''}`);
}
function cleanZipPath(path) { return String(path).replace(/^\.\//, '').replace(/^\/+/, '').replace(/\\/g, '/'); }
function isMetadataPath(path) { return /(^|\/)__FMF_STUDIO__\/(original\.fmf|manifest\.json)$/i.test(path); }
function findMetadataEntry(zip, suffix) {
  const found = Object.entries(zip.files).filter(([name, entry]) => !entry.dir && cleanZipPath(name).toLowerCase().endsWith(suffix.toLowerCase()));
  if (found.length > 1) throw new Error(`ZIP memiliki lebih dari satu metadata ${suffix}. Hapus duplikat lalu coba lagi.`);
  return found[0]?.[1] || null;
}

/**
 * Conservative same-length FMF patcher. New FMF Studio extraction ZIPs contain
 * __FMF_STUDIO__/original.fmf, so building can start from the ZIP alone.
 * Older ZIPs can still be built by supplying the original FMF as fallback.
 */
export async function patchFMFFromEditedZip(originalFile, editedZipFile, onProgress = () => {}) {
  if (!editedZipFile) throw new Error('Pilih ZIP hasil ekstraksi yang sudah diedit.');
  if (!/\.zip$/i.test(editedZipFile.name)) throw new Error('File input harus berupa ZIP.');
  const JSZip = await loadZipModule();
  onProgress('Membaca ZIP hasil edit…');
  const zip = await JSZip.loadAsync(editedZipFile, { checkCRC32: true, createFolders: false });

  let sourceFile = originalFile || null;
  if (!sourceFile) {
    const embedded = findMetadataEntry(zip, '/__FMF_STUDIO__/original.fmf') || findMetadataEntry(zip, '__FMF_STUDIO__/original.fmf');
    if (!embedded) throw new Error('ZIP ini tidak menyertakan metadata FMF sumber. Pilih FMF asli untuk melanjutkan build ZIP lama. Untuk alur tanpa memilih FMF lagi, gunakan ZIP yang diekspor oleh FMF Studio v0.6 atau lebih baru.');
    const bytes = await embedded.async('uint8array');
    const manifestEntry = findMetadataEntry(zip, '__FMF_STUDIO__/manifest.json');
    let sourceName = editedZipFile.name.replace(/\.zip$/i, '.fmf');
    if (manifestEntry) {
      try { const m = JSON.parse(await manifestEntry.async('string')); if (m.sourceFile && /\.fmf$/i.test(m.sourceFile)) sourceName = m.sourceFile; } catch {}
    }
    sourceFile = new File([bytes], sourceName, { type: 'application/octet-stream' });
  }
  if (!/\.fmf$/i.test(sourceFile.name)) throw new Error('File sumber harus berekstensi .fmf.');

  onProgress('Memvalidasi indeks FMF sumber…');
  const state = await inspectFMF(sourceFile, onProgress);
  const rawZipFiles = new Map();
  for (const [rawName, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const path = cleanZipPath(rawName);
    if (isMetadataPath(path)) continue;
    if (rawZipFiles.has(path)) throw new Error(`Path duplikat di ZIP: ${path}`);
    rawZipFiles.set(path, entry);
  }

  const expected = new Map(state.files.map(f => [f.path, f]));
  const zipFiles = new Map();
  // Accept a single wrapper folder created by some Android ZIP managers.
  const directMatch = [...expected.keys()].some(path => rawZipFiles.has(path));
  let commonRoot = '';
  if (!directMatch && rawZipFiles.size) {
    const firstParts = [...rawZipFiles.keys()].map(p => p.split('/')[0]);
    if (firstParts.every(p => p === firstParts[0]) && [...rawZipFiles.keys()].every(p => p.includes('/'))) commonRoot = firstParts[0] + '/';
  }
  for (const [path, entry] of rawZipFiles) {
    const normalized = commonRoot && path.startsWith(commonRoot) ? path.slice(commonRoot.length) : path;
    if (zipFiles.has(normalized)) throw new Error(`Path duplikat setelah normalisasi folder: ${normalized}`);
    zipFiles.set(normalized, entry);
  }

  const missing = [], extra = [];
  for (const path of expected.keys()) if (!zipFiles.has(path)) missing.push(path);
  for (const path of zipFiles.keys()) if (!expected.has(path)) extra.push(path);
  if (missing.length || extra.length) {
    const details = [];
    if (missing.length) details.push(`${missing.length} file resource hilang (contoh: ${missing.slice(0,3).join(', ')})`);
    if (extra.length) details.push(`${extra.length} file tambahan/tidak dikenal (contoh: ${extra.slice(0,3).join(', ')})`);
    throw new Error(`Struktur ZIP tidak cocok dengan FMF sumber: ${details.join('; ')}. Jangan mengganti nama, menambah, atau menghapus resource untuk mode patch aman.`);
  }

  const output = state.bytes.slice();
  let changed = 0, unchanged = 0, totalBytes = 0;
  for (let i = 0; i < state.files.length; i++) {
    const resource = state.files[i];
    onProgress(`Memeriksa resource ${i + 1}/${state.files.length}: ${resource.path}`);
    const data = await zipFiles.get(resource.path).async('uint8array');
    if (data.length !== resource.storedSize) throw new Error(`Tidak bisa build: ${resource.path} sekarang ${data.length} byte, sedangkan slot aslinya ${resource.storedSize} byte. Mode ini hanya mendukung penggantian dengan ukuran byte yang sama.`);
    const start = state.report.payloadStartOffset + resource.offset;
    const end = start + resource.storedSize;
    if (!Number.isSafeInteger(start) || start < 0 || end > state.report.nestedHeaderOffset || end > output.length) throw new Error(`Rentang resource tidak aman untuk ditulis: ${resource.path}`);
    let differs = false;
    for (let j = 0; j < data.length; j++) if (output[start + j] !== data[j]) { differs = true; break; }
    if (differs) { output.set(data, start); changed++; totalBytes += data.length; } else unchanged++;
  }
  if (output.length !== state.bytes.length) throw new Error('Pemeriksaan internal gagal: ukuran kontainer berubah.');
  return { blob: new Blob([output], { type: 'application/octet-stream' }), fileName: sourceFile.name.replace(/\.fmf$/i, '') + '-edited.fmf', changed, unchanged, totalBytes, originalSize: state.bytes.length, note: 'Same-length patch; original FMF header, offsets, index and trailing compressed index frame preserved.' };
}
