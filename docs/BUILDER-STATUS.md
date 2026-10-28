# Builder status v0.6

- Initial screen exposes both workflows: open FMF and build FMF from ZIP.
- Newly exported ZIP bundles the original FMF at `__FMF_STUDIO__/original.fmf` so the builder can start from ZIP alone.
- Legacy ZIPs can prompt for original FMF as fallback.
- Patcher supports same-length edits only and does not reserialize FMF indexes.
- Full compatibility and in-game testing remain outstanding.
