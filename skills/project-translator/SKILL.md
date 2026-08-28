---
name: project-translator
description: Scan and translate natural-language residue across a software repository, with a user-selected English or Vietnamese UI target and context-aware handling of prompts, docs, comments, contracts, and protected code tokens.
---

# Project Translator

Translate repository text without changing behavior or machine-readable contracts.

## Choose Targets

Use the user's explicit UI target: `English` or `Vietnamese`. If none is given and translation is requested, ask once before editing UI.

| Content | Default target |
| --- | --- |
| UI, errors, notifications, accessibility text | Selected UI language |
| Comments, docstrings, project docs | Selected UI language, unless project convention uses English |
| LLM prompt templates | English |
| API and cross-runtime contract prose | English |
| Intentional multilingual fixtures/tests | Preserve and document |

## Workflow

1. Read `AGENTS.md`, `CONTRIBUTING.md`, Wiki indexes, and relevant architecture/component docs before working.
2. Scan source files one by one. For Chinese, detect `\u3400-\u4DBF`, `\u4E00-\u9FFF`, and `\uF900-\uFAFF`. Exclude dependencies, caches, builds, runtime data, generated output, binaries, lock files, and vendor code unless requested.
3. Write a Markdown worklist with path, line, snippet, classification, and target. Group UI, prompt, comment/docstring, docs/contracts, and manual review. Report matching lines and unique files.
4. Translate coherent component batches, normally 200-500 matches. Read surrounding code and owning docs before classifying each string. Recheck each file after editing.
5. Rerun targeted scans after batches and the full source scan at completion. Refresh the report, run proportionate tests, and update the Wiki when project rules require it.

Prefer an existing scanner. If none exists and scanning will recur, add a reusable scanner and focused tests when authorized.

## Preserve Contracts

Preserve placeholders, printf tokens, template tags, Markdown, escaping, whitespace-sensitive prompt formatting, identifiers, imports, paths, JSON/schema keys, env vars, CLI flags, CSS classes, DOM IDs, storage keys, test IDs, and provider/product/font names.

Do not rename paths merely to remove detected characters unless explicitly authorized. Preserve ambiguous text that could affect parsing, matching, routing, snapshots, tests, or protocols and document why it needs manual review.

Completion means every remaining match is translated or explicitly documented as intentional.