# FMF format research notes

## Observed from `Tato.fmf`

- Starts with `02 01 fmf.`.
- A second `02 01 fmf.` marker appears near the end.
- A Zstandard frame follows that nested marker.
- The payload in this sample begins at byte offset 26 and ends at the nested marker.
- Decompressing the trailing Zstandard frame yields a recursive directory index.
- The index record schema used by this parser: length-prefixed UTF-8 directory name; 32-bit file count; each file has length-prefixed basename and extension, then five little-endian 64-bit fields; 32-bit child-directory count; recursive child directory records.

## Adaptive detection in v0.4

The parser checks for the printable `fmf.` marker at offset +2 instead of requiring the exact version bytes `02 01`. It tries all nested FMF marker candidates, Zstandard frames following those candidates, and a list of candidate payload starts. It accepts only a fully consumed index whose resource ranges are inside the candidate payload. If no candidate passes, it reports the file as unsupported instead of exporting guessed data.

## Important limitations

This is reverse engineering from one known-good sample, not an official specification. The adaptive search may support other archives that share the same record schema, but it cannot guarantee support for every Football Manager version or every `.fmf` file. It currently does not infer alternate record schemas or nested per-resource compression. The parser's successful validation checks structural consistency, not semantic correctness of each extracted resource. No FMF writer is included.
