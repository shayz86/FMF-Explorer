# Format research notes — sample Tato.fmf

The supplied sample is 6,706,636 bytes and begins with `02 01 66 6d 66 2e` (`02 01 fmf.`). A second `02 01 fmf.` signature occurs at byte offset 6,694,155. A Zstandard frame signature (`28 b5 2f fd`) occurs at 6,694,168. Decompressing the frame at that offset with the system `zstd` CLI produced 48,805 bytes.

The decompressed metadata begins with a length-prefixed UTF-8 root name `Tato`, and includes names such as `skin_config`, `.xml`, `classes`, `config`, `.xml`, `drop`, and many graphics/panel names. This is evidence that the second frame contains an archive index/tree rather than an ordinary XML document.

The parser in this prototype deliberately stops before assigning every index record to a file. Some entries have fields that are not yet confidently interpreted, and a guessed offset/size can corrupt extraction. The next reverse-engineering step is to formalize the node record layout, validate every file offset/size against the payload, then compare extracted files against official Resource Archiver output.

## Safety requirements for the future parser

- Reject any path containing `..`, absolute paths, drive prefixes, or invalid separators.
- Validate every offset and length before slicing.
- Detect duplicate paths and out-of-range entries.
- Preserve original bytes and export to a new directory only.
- Do not rebuild FMF until header, compression, metadata and checksums (if any) are understood.
