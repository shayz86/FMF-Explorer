# FMF Studio — Football Manager (Prototype 0.2)

A static browser application for inspecting Football Manager `.fmf` files. It is intended as the first reverse-engineering milestone for FM21 skin/resource archives, using `Tato.fmf` as the sample fixture.

## Current functions

- Detects the `02 01 fmf.` signature and nested FMF headers.
- Finds Zstandard frame signatures and attempts to decompress the index with `fzstd` loaded from jsDelivr.
- Lists candidate length-prefixed strings from the decompressed index.
- Scans raw payload for readable text runs and displays offsets.
- Exports an analysis ZIP containing raw payload, decompressed index, candidate names, and a JSON report.
- All file processing happens in the browser; no file upload endpoint is used.

## Important limitation

**This is not yet a complete FMF extractor or repacker.** Candidate names are not full verified paths. The app does not yet parse every node record or map each file's data offset and size correctly, so it intentionally does not write guessed files into a fake folder tree. It also cannot rebuild a game-compatible FMF. The analysis ZIP is for reverse engineering only.

For FM21 graphics/skin archives, the official Football Manager Resource Archiver remains the compatibility reference for extraction and repacking. The goal of future versions is to validate the index parser against official-tool output and then implement safe extraction and repacking.

## Run locally

Because this project uses JavaScript modules, serve the folder over HTTP rather than opening `index.html` as `file://`:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy to GitHub Pages

1. Create a repository, for example `fmf-studio`.
2. Upload the **contents** of this folder to the repository root.
3. Open Settings → Pages.
4. Select Deploy from a branch → `main` → `/(root)`.
5. Open the published Pages URL. Internet access is required for the Zstandard decoder CDN.

## Privacy

The selected file stays in browser memory. No upload API is called. If you are working with important files, keep an untouched backup.
