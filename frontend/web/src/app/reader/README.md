# Reader host boundary

`frontend/web` no longer owns Reader UI, hooks, PDF helpers, or annotations. Their
implementation lives in `@retainpdf/reader`; this directory only contains the
RetainPDF host integration needed by the MPA.

## Startup order

`entry.tsx` deliberately performs these steps in order:

1. import `./adapters/retainpdf.js`, which registers the app-specific ports via
   `@retainpdf/reader/adapters`;
2. call `bootReader()` from `@retainpdf/reader/boot`.

Importing `@retainpdf/reader` itself is side-effect free. It exposes components
for React hosts, while browser mounting remains an explicit host decision.

## Files kept here

- `external.ts` adapts existing `frontend/web` APIs and shared Reader ports.
- `adapters/retainpdf.ts` assembles and registers that adapter object.
- `entry.tsx` is the MPA entry point and explicitly boots the package.

Do not add package implementation proxies back under this directory. Production
code must use the public package specifiers `@retainpdf/reader`,
`@retainpdf/reader/adapters`, `@retainpdf/reader/boot`, and
`@retainpdf/reader/styles.css`. Shared AI-answer consumers use the dedicated
`@retainpdf/reader/ai` and `@retainpdf/reader/ai.css` exports.
Host adapter shims may consume the domain-scoped `@retainpdf/reader/runtime/*`
exports; they must never resolve files below `frontend/packages/reader/src` directly.
The web host owns exactly five adapter entries under `features/reader/domain/host`:
`ai.ts`, `config.ts`, `content.ts`, `data.ts`, and `state.ts`.
