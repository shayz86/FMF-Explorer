# Builder status v0.5

## Implemented
- Select original FMF and parse its resource index.
- Export resources as ZIP.
- Load an edited ZIP with JSZip.
- Require an exact set of paths, rejecting missing/extra entries.
- Require each entry's byte length to equal the original stored size.
- Patch modified bytes into a copy of the original FMF at the parsed payload offset.
- Preserve original header/index/compressed index and total file length.

## Not implemented
- Rebuild index records for changed file sizes or path changes.
- Create new folder/file entries.
- Recompress a new index into the FMF container.
- Recompute/verify resource hash semantics.
- Decode every resource's internal compression.
- Compatibility guarantee across FMF formats or FM21 game validation.

This is intentionally conservative: invalid edits are rejected rather than emitting a likely corrupt archive.
