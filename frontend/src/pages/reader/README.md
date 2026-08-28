# Reader Directory (`pages/reader`)

Default engine: **react-pdf** (`ReaderAppReactPdf`).
Fallback: `?engine=legacy` (`ReaderApp` branch + `legacy/**` + `src/js/reader` imperative engine).

## Three-Layer Boundaries

```text
┌─────────────────────────────────────────────────────────────┐
│  A. New Engine UI/Logic (Default)                            │
│     hooks/  pdf/  annotations/  components/react-pdf/       │
│     ReaderAppReactPdf.tsx                                   │
│     js dependencies → only via ./external.ts                │
└──────────────────────────┬──────────────────────────────────┘
                           │ Shared ports only
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  B. Shared Ports (js/reader subset + some config/api)        │
│     data-port / config-port / resource-resolver /           │
│     pdf-document(resolve URL) / page-state(text constants)   │
│     Exported via pages/reader/external.ts                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ Legacy may use more
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  C. Legacy Imperative Engine (?engine=legacy)                │
│     pages/reader/legacy/**  +  js/reader/**                  │
│     pdf-controller / pdf-renderer / favorites / regions…    │
│     Direct import of js/reader allowed (do not stuff into   │
│     external pretending to be shared)                       │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Path | Where to Add New Features |
|----|------|------------|
| **A New Engine** | `hooks/`, `pdf/`, `annotations/`, `components/react-pdf/` | Annotations, zoom, comparison, scroll anchors |
| **B Shared** | `external.ts` → `js/reader/{data,config,resource,…}` | Session/resource/URL only, no UI |
| **C Legacy** | `legacy/**` + `js/reader/**` main | **Do not** add new features |

## Layout

```text
pages/reader/
  entry.tsx / ReaderApp.tsx / ReaderAppReactPdf.tsx
  external.ts                # New engine's only export to js/*
  hooks/                     # Session, zoom, anchors, annotations, controller
  pdf/                       # Document/Page, scroll, line height
  annotations/               # New annotations + localStorage
  components/react-pdf/      # New engine UI
  legacy/                    # Legacy shell UI + boot + AI drawer
    components/
    hooks/use-reader-boot.ts
    state/
    ai/
```

## Lối vào

| File | Purpose |
|------|------|
| `entry.tsx` | Mounts `ReaderApp` |
| `ReaderApp.tsx` | `engine=legacy` → legacy shell, otherwise `ReaderAppReactPdf` |
| `hooks/use-reader-react-controller.ts` | New engine logic assembly |
| `external.ts` | New engine's shared js dependencies |

## Do Not

- Add new features to `js/reader/selection-favorites` / `favorites/*`
- Import `pdf-controller` into `external.ts` for new engine use
- Assume components are still in flat `components/*` (legacy UI is in `legacy/components/`)

Site map: `src/FEATURES.md` · Legacy engine details: `src/js/reader/README.md`
