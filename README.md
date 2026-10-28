# FMF Studio — Multi-FMF Explorer v0.4

Browser-only Football Manager `.fmf` inspector and extractor, designed to run on Android through GitHub Pages.

## What changed in v0.4

- The parser no longer requires the exact first two version bytes `02 01`; it checks the printable `fmf.` marker and validates the index structure before accepting a file.
- Tries multiple nested-header candidates rather than blindly using the last marker.
- Tries Zstandard frames after each candidate index header and several likely payload-header lengths.
- Has a fallback attempt for layouts where the compressed index follows the payload without a second visible FMF marker.
- Reports the detected header version, index mode, payload start offset, and index location.
- Gives a more useful unsupported-format diagnostic instead of silently treating an unknown archive as valid.
- Keeps safety checks for path traversal, duplicate resource paths, excessive nesting/node counts, offset overflow, and out-of-bounds data.
- Tries jsDelivr and unpkg for the Zstandard decoder.

## Use on Android

1. Upload the *contents* of this folder to the root of a GitHub repository (include `index.html`, `src/`, `assets/`, `docs/`, and `tests/`).
2. Enable **Settings → Pages → Deploy from a branch → `main` → `/(root)`**.
3. Open the Pages URL in Chrome, select an `.fmf` file, and wait for index validation.
4. Use search/filter, select a resource, then choose **Ekspor folder ke ZIP** to export the parsed resource tree.

The file is processed locally in the browser and is not uploaded by this application. Internet is needed to load the Zstandard decoder. The current safety ceiling is 512 MB because the app reads the selected file into browser memory.

## Compatibility notes — read before use

This is a best-effort adaptive parser, not a guarantee for every Football Manager generation or every `.fmf` file. It supports FMF files whose directory index matches the record schema reverse-engineered from the provided FM21 `Tato.fmf` sample. Some archives can use a different index layout, extra compression layers, or other record schemas; those will be rejected with a diagnostic rather than extracted using guessed offsets.

A successful parse means the index was consumed completely and every resource range fits within the detected payload. It does **not** prove every resource has been decompressed internally or that the file can be rebuilt into a valid `.fmf`.

## Current limits

- Exports the extracted directory tree as ZIP.
- Text edits are held in browser memory and included in the exported ZIP.
- Image preview is supported for common image formats.
- Does not rebuild `.fmf` yet. Do not rename a ZIP to `.fmf`.
- Some resource types may themselves be compressed or use proprietary encoding; these are currently exposed as stored bytes.
- No claim of compatibility for every FMF file has been made; use the report and keep an untouched original backup.

## Parser schema currently supported

The observed index schema is recursive: length-prefixed UTF-8 directory name; 32-bit file count; for each file, length-prefixed basename and extension followed by five little-endian 64-bit values (data offset, stored size, unpacked size, timestamp, hash); 32-bit child-directory count; then recursive child directory records.

## Test

Open `tests/parser-smoke.html` from the deployed site to run the small index-parser smoke test. This tests the index-record reader only; it is not a compatibility test for arbitrary real-world FMF archives.
