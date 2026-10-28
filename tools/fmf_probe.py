#!/usr/bin/env python3
"""Read-only probe for FMF sample files. Requires Python 3.10+ and the `zstd` CLI."""
import argparse, json, shutil, subprocess
from pathlib import Path
MAGIC = bytes.fromhex('02 01 66 6d 66 2e')
ZSTD = bytes.fromhex('28 b5 2f fd')

def offsets(data, sig):
    out=[]; start=0
    while True:
        pos=data.find(sig,start)
        if pos<0: return out
        out.append(pos); start=pos+1

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('fmf', type=Path)
    ap.add_argument('--out', type=Path, default=Path('fmf-probe-output'))
    args=ap.parse_args()
    if not args.fmf.is_file(): ap.error('File tidak ditemukan')
    if not shutil.which('zstd'): ap.error('Perintah zstd tidak ditemukan; pasang Zstandard CLI terlebih dahulu')
    data=args.fmf.read_bytes(); heads=offsets(data,MAGIC); zst=offsets(data,ZSTD)
    args.out.mkdir(parents=True,exist_ok=True)
    segments=[]
    for n,start in enumerate(heads):
        end=heads[n+1] if n+1<len(heads) else len(data)
        segments.append({'index':n+1,'start':start,'end':end,'length':end-start})
    report={'file':args.fmf.name,'size':len(data),'header_offsets':heads,'zstd_offsets':zst,'segments':segments}
    if len(heads)>1:
        payload=data[heads[0]+26:heads[1]]
        (args.out/'segment-001-payload.bin').write_bytes(payload)
    for n,pos in enumerate(zst,1):
        # Each frame starts at a signature. zstd CLI is used on a suffix; this sample has one frame to EOF.
        src=args.out/f'frame-{n}.zst'; dst=args.out/f'frame-{n}.decompressed.bin'
        src.write_bytes(data[pos:])
        proc=subprocess.run(['zstd','-d','-f',str(src),'-o',str(dst)],capture_output=True,text=True)
        if proc.returncode==0:
            report.setdefault('decompressed_frames',[]).append({'frame':n,'offset':pos,'output':dst.name,'size':dst.stat().st_size})
        else:
            report.setdefault('decompression_errors',[]).append({'frame':n,'offset':pos,'error':proc.stderr.strip()})
    (args.out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
if __name__=='__main__': main()
