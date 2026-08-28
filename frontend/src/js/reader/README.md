# `src/js/reader` — Legacy Reader Engine + Shared Ports

Imperative pdf.js pipeline (`pdf-controller` / `pdf-renderer` / mode / favorites / regions…).

The default product path is now **react-pdf** (`pages/reader/ReaderAppReactPdf`). This directory primarily serves **`?engine=legacy`**.

## Layering (Aligned with `pages/reader/README`)

| Purpose | Module | Who Imports |
|------|------|-----------|
| **Shared ports** | `data-port`, `config-port`, `resource-resolver`, `pdf-document` (URL), `page-state` (progress text) | New engine via `pages/reader/external.ts`; legacy may also use directly |
| **Legacy engine** | `pdf-controller`, `pdf-renderer`, `viewer-mount-flow`, `selection-favorites`, `favorites/**`, `region-*`, chrome/mode… | Only `pages/reader/legacy/**` |
| **Legacy AI** | `ai/ask-answerer`, `ai/chat-history-store`, `markdown-render`… | `legacy/ai`, `use-reader-boot` |

## 已删除

| File | Description |
|------|------|
| `ai/remote-answerer.ts` | Old `/reader/ai/chat` payload responder; current network uses `ask-answerer` |

## Do Not

- Do not add new UI here (annotations / zoom / comparison → `pages/reader` non-legacy)
- Do not mass-delete favorites / pdf-* (legacy still depends on internal diagrams)
- Do not assume `pages/reader/components/*` still exists flat (moved to `legacy/components/`)

## Main Paths

```text
Default: pages/reader/ReaderAppReactPdf + hooks/ + pdf/ + annotations/ + components/react-pdf/
      js dependencies → pages/reader/external.ts → shared ports in this directory
Fallback: pages/reader/legacy/*  +  imperative engine in this directory
Map: src/FEATURES.md
```
