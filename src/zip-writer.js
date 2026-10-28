const enc = new TextEncoder();
const u16 = v => new Uint8Array([v & 255, (v >>> 8) & 255]);
const u32 = v => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
function concat(parts) { const size = parts.reduce((n, p) => n + p.length, 0); const out = new Uint8Array(size); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out; }
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xffffffff; for (const v of bytes) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function createZip(files) {
  if (files.length > 65535) throw new Error('ZIP klasik mendukung maksimal 65.535 entri');
  const local = [], central = []; let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name.replace(/^\/+/, ''));
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    if (name.length > 65535 || data.length > 0xffffffff) throw new Error(`Entri ZIP terlalu besar: ${file.name}`);
    const crc = crc32(data), time = 0, date = 0x5821;
    const header = concat([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name]);
    local.push(header, data);
    central.push(concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += header.length + data.length;
  }
  const directory = concat(central);
  const end = concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(directory.length), u32(offset), u16(0)]);
  return new Blob([concat([...local, directory, end])], { type: 'application/zip' });
}
