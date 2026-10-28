# FMF Studio FM21 v0.6 — two entry workflows

Browser-based Football Manager FMF inspector and conservative same-length patch builder, designed for Android and GitHub Pages.

## Start screen
The start screen offers two independent choices:
1. **Pilih file FMF** — inspect/extract an FMF archive.
2. **Build FMF dari ZIP** — choose an edited ZIP immediately, without opening an FMF first.

New extraction ZIPs include `__FMF_STUDIO__/original.fmf` and a manifest. This lets the builder recover the original FMF source from the ZIP alone. Older ZIPs without this metadata will prompt for the original FMF as a fallback. Keep the metadata entry intact when extracting and recompressing the ZIP.

## Build limits
This is still a conservative same-length patcher, not a full general FMF packer. Every resource path must match the original and every replacement must have exactly the same byte length. Adding/removing/renaming files, changing folder structure, or changing byte lengths is rejected. The builder preserves the original header, offsets and index. Compatibility with Football Manager 2021 has not yet been independently verified in-game.

## Exporting an editable ZIP
Open an FMF and use **Ekspor folder ke ZIP**. The ZIP contains all resource files plus `__FMF_STUDIO__/original.fmf` metadata. Edit resources, keep all paths and metadata intact, then return to the start page and choose **Build FMF dari ZIP**.

## Deploy
Upload the contents of this directory to the root of a GitHub repository, then enable GitHub Pages from `main` and `/(root)`. The app loads Zstandard and JSZip from public CDNs, so an internet connection is required. File processing is local in the browser.
