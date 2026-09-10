# Frontend CSS architecture

## Goal

Keep three independent page bundles with explicit ownership and no cross-page domain leakage.

| HTML | Web entry | Source of truth | Output |
|------|-----------|-----------------|--------|
| `index.html` | `entries/home.css` | `frontend/web/src/styles` | `dist/css/home.css` |
| `detail.html` | `entries/detail.css` | `frontend/web/src/styles` | `dist/css/detail.css` |
| `reader.html` | `entries/reader.css` | `frontend/packages/reader/styles/entry.css` | `dist/css/reader.css` |

The Reader entry in `frontend/web` is a thin proxy. Reader components and styles are owned by `@retainpdf/reader`; edit `frontend/packages/reader/styles`, not the retained files under `frontend/web/src/styles/reader`.

The current build has no legacy Reader entry. `dist/css/reader-legacy.css`, if present in a checkout, is a historical artifact and is not generated or loaded by the current application.

## Rules

- Home and detail page-specific styles must stay in their page-owned entry graph.
- Shared Web styles are limited to tokens, base, generic components, dialog shell, ambient surface, and download feedback where the consuming entries explicitly import them.
- App dialogs use `src/ui/components/dialog.tsx` plus the `app-dialog-*` contract in `dialog-shell.css`. Feature CSS may own inner layouts but not modal overlays, positioning, radii, close controls, or z-index levels.
- Reader styles are assembled by `frontend/packages/reader/styles/entry.css` and consumed through `entries/reader.css`.
- Do not add new imports to the retained `frontend/web/src/styles/reader` mirror.
- JavaScript builds must preserve `dist/css`; CSS builds own the three CSS outputs.
- Run architecture tests after changing entry ownership or selector namespaces.

## Verification

```bash
npm --prefix frontend/web run build:css
npm --prefix frontend/web test -- 'tests/architecture/*.test.mjs'
npm --prefix frontend/web run visual:check
```

Only update visual baselines after confirming the rendered change is intentional.
