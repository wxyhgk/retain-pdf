# Editor nodes

One module per block type. Each module owns its slice of behavior so block
types stop riding on library defaults implicitly:

- `*Spec`: the ProseMirror `NodeSpec`, copied from the default on day one.
- fence/token parse spec + serializer: byte-identical to the default on day one.
- helpers/registries the rest of Studio may import (see `SCIENCE_LANGUAGES`).
- optional view: a `NodeView` for editing state, where needed.

## Adding a type

1. Copy the default spec/parse/serialize into `nodes/<type>.ts`.
2. Re-export from `nodes/index.ts`.
3. Add `tests/studio-document-<type>.test.ts` with round-trip fixtures.
4. Wire in: legacy visual schema via `../prosemirror-markdown.ts`,
   Crepe main editor via Milkdown plugins in `../../main.ts`.

`code-block.ts` is the exemplar.
