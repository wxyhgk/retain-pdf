# Translation Worklists

Purpose: Trang nay mo ta workflow quet chu Trung con sot lai trong source va tao worklist dich.

## Chinese Residue Scanner

Run the source-scope scanner from the repository root:

```bash
python backend/scripts/devtools/scan_chinese_residue.py --repo-root . --output docs/wiki/translation/chinese-residue-report.md
```

If the devtools package is installed, the equivalent command is:

```bash
retainpdf-scan-chinese-residue --repo-root . --output docs/wiki/translation/chinese-residue-report.md
```

The scanner walks source files one by one, skips vendor/cache/build/runtime/generated outputs, detects CJK residue, classifies each line, and writes a Markdown worklist.

## Translation Policy

- Prompt entries are translated to English.
- UI, comment and docs entries are translated to Vietnamese.
- Machine-readable tokens (identifiers, import paths, env vars, API paths, JSON keys, schema keys, placeholders, code examples, font names, third-party names) are preserved.
- The goal is zero Chinese residue in source-scoped files except for unavoidable external data that cannot be translated without breaking contracts; such exceptions must be documented.

## Cleanup Status

The repository is undergoing a full cleanup to Vietnamese. The latest tracked-source
audit (2026-08-27) reports 2,587 scanned files, 396 files with matches and 4,229
residue lines: `prompt=0`, `ui=3`, `comment=968`, `docs=92`, and
`manual=3,166`. The current wave translated frontend CSS comments, frontend
TS/TSX comments and safe UI/test messages without changing identifiers or runtime contracts. The
remaining `manual` matches are not blanket translation targets: they include
fixture source text, provider payloads, serialized values and test data that
require consumer-by-consumer review. `chinese-residue-report.md` is regenerated
only for a final audit and must not be treated as a zero-residue claim while
manual matches remain.

Temporary worklists for content and path names are generated in `.tmp/` and cleaned after each batch.

### Queue 5: CSS comments — completed

On 2026-08-27, Queue 5 translated all 80 Chinese natural-language comment lines
across 12 remaining tracked frontend CSS files. The targeted CJK audit over
`frontend/src/styles/**/*.css` and `frontend/styles.css` returned 0 matches.
`git diff --check` passed, and `npm.cmd --prefix frontend run build:css` passed.
The CSS behavior check found no non-comment changes; generated CSS outputs were
restored/left without a diff. The repository-wide tracked-source snapshot is
now 2,587 scanned files, 396 files with matches, and 4,229 residue lines
(`prompt=0`, `ui=3`, `comment=968`, `docs=92`, `manual=3,166`).
The remaining residue is unrelated to Queue 5, primarily manual fixture,
provider-payload, serialized-value, and test-data content requiring
consumer-by-consumer review.

### Queue 6: TypeScript/TSX/MJS/JS comments — in progress

The current uncommitted wave translated safe comments and docstrings in frontend
status, library, reader and shared modules. The tracked-source audit now reports
968 comment lines overall, with 362 remaining in `frontend/src` across 62 files.
Identifiers, contracts and behavior were preserved; the remaining comments require
the same file-by-file review.

### Queue 7: UI runtime strings — in progress

Safe labels, aria text, progress/status copy, reader controls and decor diagnostics
were translated, with dependent UI expectations updated in the same patch. Three
`ui`-classified lines remain; these are protected condition/contract literals.

### Queue 8: Manual test titles and assertion messages — in progress

Clearly non-contract test titles and assertion messages were translated in the
reader, book-detail and AI test areas. The remaining 3,166 `manual` lines include
fixtures, provider payloads, serialized values and test data reserved for
consumer-by-consumer Queue 9 review.

Final audit commands:
```powershell
# Content audit (tracked source; do not count untracked reports or user artifacts)
git grep -n -P "[\x{3400}-\x{4dbf}\x{4e00}-\x{9fff}\x{f900}-\x{faff}]" -- . `
  ':(exclude).kilo/**' ':(exclude).tmp/**' `
  ':(exclude)**/node_modules/**' ':(exclude)**/target/**' `
  ':(exclude)**/dist/**' ':(exclude)**/build/**' `
  ':(exclude)**/.next/**' ':(exclude)**/coverage/**'

# Path audit (tracked paths only)
git ls-files | Where-Object { $_ -match '[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]' }
```

Temporary worklist cleanup:
```powershell
Remove-Item -Recurse -Force .tmp -ErrorAction SilentlyContinue
```

## Related Pages

- [Wiki home](../README.md)
- [Extension guide](../07-development/extension-guide.md)
- [Frontend library and reader](../04-components/frontend-library-and-reader.md)
- [Translation and LLM orchestration](../04-components/translation-and-llm-orchestration.md)
- [Electron desktop runtime](../04-components/electron-desktop-runtime.md)

## Reusable Agent Skills

- [`project-translator`](../../../skills/project-translator/SKILL.md) provides a repository-neutral translation workflow. Its UI target is selected per task as English or Vietnamese; prompts default to English, and machine-readable contracts remain protected.
- [`kilo-plan-writer`](../../../skills/kilo-plan-writer/SKILL.md) turns repository findings into implementation-ready plans under `.kilo/plans/`, including verification and Wiki update requirements.
- [`project-wiki-writer`](../../../skills/project-wiki-writer/SKILL.md) creates, updates, or audits technical Wikis from repository evidence while preserving local documentation structure and language.
