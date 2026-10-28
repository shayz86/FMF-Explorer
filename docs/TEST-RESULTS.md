# Test results for the supplied sample

Read-only probe run on `Tato.fmf`:

- File size: 6,706,636 bytes.
- FMF signatures: offsets `0` and `6,694,155`.
- Zstandard frame signature: offset `6,694,168`.
- Decompressed output from the final frame using Zstandard CLI: 48,805 bytes.
- Raw first segment extracted to a separate `.bin` file: 6,694,129 bytes.

These results confirm the segment detection and Zstandard frame extraction path for this sample. They do **not** confirm full folder reconstruction or successful FMF rebuilding.
