# FMF Studio — FM21 Extractor Prototype 0.3

A browser-only Football Manager `.fmf` inspector/extractor. The current parser targets the FMF container structure observed in the supplied FM21 `Tato.fmf` sample.

## Implemented

- Detects the top-level FMF header and trailing nested index header.
- Decompresses the trailing Zstandard index with `fzstd` (CDN; internet required).
- Parses the directory tree recursively: directory name, file records, and child directories.
- Validates every file offset and stored length against the payload before extraction.
- Displays every resource in a searchable list, with type filters.
- Previews text/XML/fontxml, PNG and common image types; shows a hex preview for other binary resources.
- Allows text edits in memory and exports the full extracted tree to a ZIP, including edited text.
- Exports a JSON inventory report.
- Runs entirely in the browser; the selected FMF is not uploaded to a server by this code.

## Not implemented yet

- Rebuilding a game-compatible `.fmf` archive.
- Replacing binary/image resources from imported files.
- Validating against the official Resource Archiver output.
- Handling every FMF variation from every Football Manager release. This prototype is aimed at the tested FM21 `Tato.fmf` layout.

Do not rename the extracted ZIP to `.fmf`. A ZIP is not a valid Football Manager archive.

## Deploy to GitHub Pages

1. Create a repository (for example `fmf-studio`).
2. Upload the *contents* of this folder to the repository root, including `index.html`, `src/`, `assets/`, and `docs/`.
3. Go to **Settings → Pages**.
4. Choose **Deploy from a branch**, branch `main`, folder `/(root)`.
5. Open the published Pages URL. Internet access is needed to load the Zstandard decoder from jsDelivr.

## Use on Android

Open the GitHub Pages URL in Chrome, select the `.fmf` file, wait for the index to parse, then select **Ekspor folder ke ZIP**. Extract the ZIP with your Android file manager or archive app. You can edit XML/fontxml directly in the app and export another ZIP. At this stage you cannot rebuild the ZIP into a valid `.fmf` from the app.

## Parser assumptions

Index records in the supplied sample are decoded as: length-prefixed directory name; 32-bit file count; for each file, length-prefixed basename and extension followed by five little-endian 64-bit fields (data offset, stored size, unpacked size, timestamp, hash); 32-bit child-directory count; recursive child directory records. The index must be fully consumed and all file ranges must fit the data payload or extraction is refused.
