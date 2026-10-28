# Test results — v0.4

## Static checks

- JavaScript syntax checks are run before packaging.
- The index reader smoke test constructs a minimal synthetic directory index and checks that one file record is decoded.
- Safety validation rejects invalid path components, duplicate file paths, excessive nesting/node counts, and file ranges outside the payload.

## Compatibility status

- `Tato.fmf` from the conversation is the known sample used to derive the parser schema in v0.3.
- v0.4 adds adaptive candidate search around that schema. This environment did not run the browser CDN Zstandard module against a new set of independent FMF samples; support for other FMF files is therefore **not guaranteed** until users test them and share the diagnostic report for unsupported files.
- Rebuilding FMF is not implemented.
