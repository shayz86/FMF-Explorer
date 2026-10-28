# FMF Studio FM21 v0.5 — same-length FMF patch builder

Browser-only FMF inspector/extractor for Android and GitHub Pages. This version adds a conservative **Build FMF from edited ZIP** workflow.

## What the builder actually does

1. Open and validate the original `.fmf` in FMF Studio.
2. Export the resource tree to ZIP, or edit the exported ZIP externally while preserving every path.
3. In the same session, click **Build FMF dari ZIP edit** and select the edited ZIP.
4. The builder checks that the ZIP contains exactly the same resource paths and that each resource byte length equals the original stored size.
5. It patches resource bytes into a copy of the original FMF at validated offsets and downloads `*-edited.fmf`.

This preserves the original container header, offsets, index, and trailing compressed index frame. It does **not** reserialize the index and does not support adding/removing/renaming files, changing folder structure, or changing any resource's byte length. Such cases are rejected. Never rename a ZIP to `.fmf`.

## Important limits

- Parser support is based on the observed recursive index schema from the supplied FM21 `Tato.fmf`; other FMF layouts may be rejected.
- Some resources may have their own internal compression or encoding. The extractor currently returns stored resource bytes, not necessarily decoded content for every resource type.
- Same-length patching is only a first, conservative build mode. It is not a general FMF packer and is not guaranteed to make arbitrary resource edits valid in game.
- Before using in-game, keep the original backup and validate the output in Football Manager 2021. A proper general builder still needs a verified FMF writer, index reserialization, compression and hash semantics.
- The app processes files locally in the browser. It loads the Zstandard decoder and JSZip from public CDNs, so internet is required. Files are not uploaded by the app.

## Deploy to GitHub Pages

Upload the contents of this directory to the repository root, then enable Settings → Pages → Deploy from a branch → `main` → `/(root)`.

## Tests

Open `tests/parser-smoke.html` for the index parser smoke test. Browser-level end-to-end tests against multiple official FMF generations are not yet available.
