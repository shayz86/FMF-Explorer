# FMF21 format notes from Tato.fmf

The supplied sample begins with `02 01 66 6d 66 2e` (`02 01 fmf.`). A second such header appears near the end, followed by a Zstandard frame. The main resource payload lies between byte 26 and that nested header. Decompressing the trailing Zstandard frame yields a directory index.

The index parser used by this prototype is recursive. Each directory record starts with a length-prefixed UTF-8 directory name, followed by a 32-bit file count. File records contain length-prefixed basename and extension strings, then five little-endian 64-bit fields. A 32-bit child-directory count follows, and child directory records recurse. In the sample, the parsed index is consumed exactly and all file offset/length ranges fit the payload.

This is empirical reverse engineering for the sample, not a guarantee for every FMF generation. A future writer must preserve field widths, timestamps/hash semantics, index compression, archive headers, and any alignment rules. Repacking must not be added until tested with independent known-good archives.
