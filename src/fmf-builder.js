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

function cleanZipPath(path) {
  return String(path).replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * Applies same-length resource patches to the original FMF container.
 * This intentionally preserves all headers, resource offsets, index bytes,
 * compression frame and unknown metadata. It is not a general FMF packer.
 */
export async function patchFMFFromEditedZip(originalFile, editedZipFile, onProgress = () => {}) {
  if (!originalFile || !editedZipFile) throw new Error('Pilih FMF asli dan ZIP hasil edit.');
  if (!/\.fmf$/i.test(originalFile.name)) throw new Error('File sumber harus berekstensi .fmf.');
  if (!/\.zip$/i.test(editedZipFile.name)) throw new Error('File hasil edit harus berupa .zip.');

  onProgress('Memvalidasi indeks FMF asli…');
  const state = await inspectFMF(originalFile, onProgress);
  const JSZip = await loadZipModule();
  onProgress('Membaca ZIP hasil edit…');
  const zip = await JSZip.loadAsync(editedZipFile, { checkCRC32: true, createFolders: false });
  const zipFiles = new Map();
  for (const [rawName, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const path = cleanZipPath(rawName);
    if (zipFiles.has(path)) throw new Error(`Path duplikat di ZIP: ${path}`);
    zipFiles.set(path, entry);
  }

  const expected = new Map(state.files.map(f => [f.path, f]));
  const missing = [];
  const extra = [];
  for (const path of expected.keys()) if (!zipFiles.has(path)) missing.push(path);
  for (const path of zipFiles.keys()) if (!expected.has(path)) extra.push(path);
  if (missing.length || extra.length) {
    const details = [];
    if (missing.length) details.push(`${missing.length} file resource hilang (contoh: ${missing.slice(0,3).join(', ')})`);
    if (extra.length) details.push(`${extra.length} file tambahan/tidak dikenal (contoh: ${extra.slice(0,3).join(', ')})`);
    throw new Error(`Struktur ZIP tidak cocok dengan FMF asli: ${details.join('; ')}. Gunakan ZIP hasil ekspor FMF Studio tanpa mengganti nama atau struktur path.`);
  }

  const output = state.bytes.slice();
  let changed = 0;
  let unchanged = 0;
  let totalBytes = 0;
  for (let i = 0; i < state.files.length; i++) {
    const resource = state.files[i];
    onProgress(`Memeriksa resource ${i + 1}/${state.files.length}: ${resource.path}`);
    const data = await zipFiles.get(resource.path).async('uint8array');
    if (data.length !== resource.storedSize) {
      throw new Error(`Tidak bisa build: ${resource.path} sekarang ${data.length} byte, sedangkan slot aslinya ${resource.storedSize} byte. Versi ini hanya mendukung penggantian dengan ukuran byte yang sama.`);
    }
    const start = state.report.payloadStartOffset + resource.offset;
    const end = start + resource.storedSize;
    if (!Number.isSafeInteger(start) || start < 0 || end > state.report.nestedHeaderOffset || end > output.length) {
      throw new Error(`Rentang resource tidak aman untuk ditulis: ${resource.path}`);
    }
    let differs = false;
    for (let j = 0; j < data.length; j++) {
      if (output[start + j] !== data[j]) { differs = true; break; }
    }
    if (differs) {
      output.set(data, start);
      changed++;
      totalBytes += data.length;
    } else unchanged++;
  }

  if (output.length !== state.bytes.length) throw new Error('Pemeriksaan internal gagal: ukuran kontainer berubah.');
  return {
    blob: new Blob([output], { type: 'application/octet-stream' }),
    fileName: originalFile.name.replace(/\.fmf$/i, '') + '-edited.fmf',
    changed, unchanged, totalBytes, originalSize: state.bytes.length,
    note: 'Build mode: same-length patch. Original FMF header, offsets, index and trailing compressed index frame were preserved.'
  };
}
