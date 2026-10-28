/* FMF Studio parser. Conservative scanner: does not assume all FMF variants share one layout. */
(function(global){'use strict';
const MAGIC=[0x28,0xb5,0x2f,0xfd];
function printable(b){return (b>=32&&b<=126)||b===9||b===10||b===13||b>=0xC2;}
function utf8(bytes){try{return new TextDecoder('utf-8',{fatal:false}).decode(bytes)}catch(e){return Array.from(bytes,x=>String.fromCharCode(x)).join('')}}
function findAll(buf,needle,start=0){let out=[];outer:for(let i=start;i<=buf.length-needle.length;i++){for(let j=0;j<needle.length;j++)if(buf[i+j]!==needle[j])continue outer;out.push(i)}return out}
function imageScan(buf){const specs=[{name:'PNG',sig:[137,80,78,71,13,10,26,10],ext:'png'},{name:'JPEG',sig:[255,216,255],ext:'jpg'},{name:'GIF',sig:[71,73,70,56,55,97],ext:'gif'},{name:'GIF',sig:[71,73,70,56,57,97],ext:'gif'},{name:'WEBP',sig:[82,73,70,70],ext:'webp'},{name:'BMP',sig:[66,77],ext:'bmp'}];let found=[];for(const s of specs){for(const off of findAll(buf,s.sig)){let end=-1;if(s.ext==='png'){for(let i=off+8;i+8<buf.length;i++){if(buf[i]===0&&buf[i+1]===0&&buf[i+2]===0&&buf[i+3]===0&&buf[i+4]===73&&buf[i+5]===69&&buf[i+6]===78&&buf[i+7]===68){end=i+8;break}}}else if(s.ext==='jpg'){for(let i=off+3;i+1<buf.length;i++)if(buf[i]===255&&buf[i+1]===217){end=i+2;break}}else if(s.ext==='gif'){for(let i=off+6;i<buf.length;i++)if(buf[i]===59){end=i+1;break}}else if(s.ext==='webp'&&off+8<=buf.length){let size=buf[off+4]|buf[off+5]<<8|buf[off+6]<<16|buf[off+7]<<24;end=Math.min(buf.length,off+8+size)}else if(s.ext==='bmp'&&off+6<=buf.length){let size=buf[off+2]|buf[off+3]<<8|buf[off+4]<<16|buf[off+5]<<24;if(size>16&&size<buf.length-off)end=off+size}if(end>off+8)found.push({start:off,end,type:'image',format:s.name,ext:s.ext,name:`Gambar ${s.name} @ 0x${off.toString(16).toUpperCase()}`})}}
found.sort((a,b)=>a.start-b.start);let out=[];for(const im of found){if(out.length&&im.start<out[out.length-1].end){if(im.end>out[out.length-1].end&&im.start===out[out.length-1].start)out[out.length-1]=im;continue}out.push(im)}return out}
function scan(buf){const size=buf.length,header=size>=26&&buf[0]===2&&buf[1]===1&&utf8(buf.slice(2,6))==='fmf.'?26:0;const resources=[];const images=imageScan(buf);let protectedRanges=images.map(x=>[x.start,x.end]);
// Extract long printable runs while keeping every byte's original offset.
let i=header,id=0;while(i<size){let isText=printable(buf[i]);if(!isText){i++;continue}let st=i;while(i<size&&printable(buf[i]))i++;let en=i;if(en-st>=18){let raw=buf.slice(st,en),txt=utf8(raw);if(/[A-Za-z<>="'{}\/]/.test(txt)&&/[A-Za-z]{3}/.test(txt)){const isXml=/^\s*(?:<\?xml|<!--|<record\b|<class\b|<list\b|<string\b|<boolean\b|<integer\b|<flags\b|<colour\b|<real\b|<unsigned\b)/i.test(txt);resources.push({id:'text-'+(++id),start:st,end:en,type:isXml?'xml':'text',name:isXml?`XML/Teks @ 0x${st.toString(16).toUpperCase()}`:`Teks @ 0x${st.toString(16).toUpperCase()}`,text:txt,original:txt,byteLength:en-st})}}}
// Image resources are first-class rows.
images.forEach((x,n)=>resources.push({...x,id:'image-'+(n+1),byteLength:x.end-x.start}));
// Identify probable compressed data markers and unknown binary gaps.
const zstd=findAll(buf,MAGIC);zstd.forEach((off,n)=>resources.push({id:'zstd-'+(n+1),start:off,end:Math.min(size,off+4),type:'marker',name:`Penanda Zstandard @ 0x${off.toString(16).toUpperCase()}`,format:'Zstandard',byteLength:4}));
resources.sort((a,b)=>a.start-b.start||a.end-b.end);resources.forEach((r,n)=>r.order=n+1);
return {size,header,magic:header?'FMF signature 02 01 fmf.':'Tidak dikenali sebagai header FMF standar',resources,images,zstdCount:zstd.length,headerBytes:Array.from(buf.slice(0,Math.min(header||32,size)))};
}
function encodeSameLength(text,originalBytes){const encoded=new TextEncoder().encode(text);if(encoded.length!==originalBytes.length)throw new Error(`Panjang data berubah (${originalBytes.length} → ${encoded.length} byte). Versi ini hanya menerapkan edit dengan panjang byte yang sama agar offset resource lain tidak bergeser.`);return encoded}
global.FMFParser={scan,utf8,encodeSameLength,imageScan};
})(window);
