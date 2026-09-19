# Editor nodes: extraction rules

One module per node type. `code-block.ts` is the exemplar. Follow these
rules exactly so parallel extractions stay conflict-free and behavior-safe.

## 1. Scope and ownership

- Each worker owns its files exclusively: `nodes/<type>.ts` (kebab-case)
  plus `tests/studio-document-<type>.test.ts`. Never touch another
  worker's files, `nodes/index.ts`, `../prosemirror-markdown.ts`,
  `../../main.ts`, or anything else. The barrel is updated centrally
  after all workers land.
- This batch covers blocks and small inline nodes only; marks
  (`em`, `strong`, `link`, `code`) are a later batch.
- Batch assignment:
  - `paragraph.ts`: paragraph only.
  - `heading.ts`: heading only.
  - `list.ts`: `bullet_list`, `ordered_list`, `list_item` together
    (they share list machinery; export three specs).
  - `blockquote.ts`, `horizontal-rule.ts`, `hard-break.ts`, `image.ts`:
    one worker owns all four tiny modules plus one combined test file
    `tests/studio-document-small-nodes.test.ts`.

## 2. Behavior parity (most important)

- Day one must be byte-identical to the installed default:
  `node_modules/prosemirror-markdown/dist/index.js` (version 1.13.5).
  Copy spec/parse/serialize from there; do not fix or improve anything.
- Module must have zero runtime imports: `import type` only, plus plain
  data and functions, so the Crepe bundle is unaffected.
- Comments in Chinese, no license headers, no one-letter variable names.

## 3. Tests

- Style: `node:test` + `node:assert/strict`, imports with `.ts`
  extensions, mirroring `tests/studio-document-code-block.test.ts`.
- File name must match the existing `test:document` glob
  (`tests/studio-document*.test.ts`): zero config change.
- Required coverage per type: round-trip fixtures, at least one
  explicit-normalization case, and one attribute-landing case
  (parse then inspect node attrs).
- Known default behaviors to encode, not fight: no trailing newline at
  document end; indented code serializes as fenced.
- Run your own test file before finishing:
  `node --experimental-strip-types --test <your file>`.

## 4. Done criteria and report

- New files pass their tests; `git status` shows only your owned files.
- Do not commit. Report: files created, test command, pass/fail counts.
