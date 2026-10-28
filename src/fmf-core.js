export const FMF_MAGIC = new Uint8Array([0x02,0x01,0x66,0x6d,0x66,0x2e]);
export const ZSTD_MAGIC = new Uint8Array([0x28,0xb5,0x2f,0xfd]);
export function findAll(bytes, needle){const out=[];outer:for(let i=0;i<=bytes.length-needle.length;i++){for(let j=0;j<needle.length;j++)if(bytes[i+j]!==needle[j])continue outer;out.push(i)}return out}
export function readUtf8(bytes){return new TextDecoder('utf-8',{fatal:false}).decode(bytes)}
export function isFMF(bytes){return bytes.length>=6&&FMF_MAGIC.every((v,i)=>bytes[i]===v)}
function printable(b){return b===9||b===10||b===13||(b>=32&&b<=126)||b>=0xc2}
export function scanTextRuns(bytes,minLen=36,maxRuns=800){const out=[];let i=0;while(i<bytes.length&&out.length<maxRuns){if(!printable(bytes[i])){i++;continue}const start=i;while(i<bytes.length&&printable(bytes[i]))i++;if(i-start>=minLen){const text=readUtf8(bytes.subarray(start,i));if(/[A-Za-z]{3}/.test(text))out.push({start,end:i,length:i-start,preview:text.slice(0,1000)})}}return out}
function safeName(s){return s.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').trim()}
export function candidateNames(indexBytes){const out=[];const seen=new Set();for(let i=0;i+4<indexBytes.length;){const n=new DataView(indexBytes.buffer,indexBytes.byteOffset+i,4).getUint32(0,true);if(n>0&&n<=180&&i+4+n<=indexBytes.length){const val=readUtf8(indexBytes.subarray(i+4,i+4+n));if(/^[\w .@()+\-]+$/.test(val)&&/[A-Za-z]/.test(val)){const prev=indexBytes[i-1];if(!seen.has(val)){seen.add(val);out.push({name:safeName(val),offset:i,length:n})}i+=4+n;continue}}i++}return out}
export async function inspectFMF(file, onProgress=()=>{}){
 const bytes=new Uint8Array(await file.arrayBuffer());onProgress('Membaca header…');
 const headerOffsets=findAll(bytes,FMF_MAGIC);const zstdOffsets=findAll(bytes,ZSTD_MAGIC);
 const valid=headerOffsets.length>0&&headerOffsets[0]===0;
 const segments=[];
 for(let i=0;i<headerOffsets.length;i++){const start=headerOffsets[i],end=i+1<headerOffsets.length?headerOffsets[i+1]:bytes.length;segments.push({index:i+1,start,end,length:end-start,header:i===0?'Header utama':'Header FMF bersarang',payloadStart:start+26,payloadEnd:end})}
 let rawPayload=null,indexBytes=null,decompressError=null;
 if(segments.length>1){rawPayload=bytes.slice(segments[0].payloadStart,segments[0].end);const last=segments[segments.length-1];let zstart=zstdOffsets.find(x=>x>=last.start+6&&x<last.end);if(zstart!==undefined){try{onProgress('Mendekompresi indeks Zstandard…');const mod=await import('https://cdn.jsdelivr.net/npm/fzstd@0.1.1/esm/index.mjs');indexBytes=mod.decompress(bytes.subarray(zstart,last.end));}catch(e){decompressError=String(e?.message||e)}}}
 else if(zstdOffsets.length){try{onProgress('Mendekompresi frame Zstandard…');const mod=await import('https://cdn.jsdelivr.net/npm/fzstd@0.1.1/esm/index.mjs');indexBytes=mod.decompress(bytes.subarray(zstdOffsets[0]));}catch(e){decompressError=String(e?.message||e)}}
 const names=indexBytes?candidateNames(indexBytes):[];const textRuns=rawPayload?scanTextRuns(rawPayload):scanTextRuns(bytes.subarray(26));
 const report={fileName:file.name,fileSize:bytes.length,signature:valid?'02 01 fmf.':'Header FMF tidak cocok di offset 0',headerOffsets,zstdOffsets,segments:segments.map(s=>({...s})),rawPayloadBytes:rawPayload?.length??0,indexBytes:indexBytes?.length??0,candidateNameCount:names.length,textRunCount:textRuns.length,decompressError,notes:['Pendeteksian segmen dilakukan berdasarkan signature byte; belum memvalidasi seluruh struktur kontainer.','Nama yang ditemukan dari indeks adalah kandidat string, bukan daftar path yang sudah direkonstruksi.','Jangan gunakan hasil ini sebagai arsip FMF hasil build.']};
 return {bytes,valid,segments,rawPayload,indexBytes,names,textRuns,report};
}
