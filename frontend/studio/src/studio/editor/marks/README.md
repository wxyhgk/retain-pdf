# Editor marks

One module per mark type, same contract as `../nodes/README.md`:

- owned `MarkSpec` copy, token parse spec, mark serializer;
- internal helpers (`isPlainUrl`, `backticksFor`) copied from the
  prosemirror-markdown 1.13.5 default and documented as such;
- tests in `tests/studio-document-mark-<type>.test.ts`;
- no wiring changes here; `../prosemirror-markdown.ts` and Crepe
  integration stay for a later batch.
