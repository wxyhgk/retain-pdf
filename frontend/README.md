# RetainPDF Frontend (Main Site)

**Production entry: this `frontend/` directory** (static SPA with three pages: `index` / `detail` / `reader`).

| Directory | Description |
|------|------|
| `src/pages/home` | Homepage (bookshelf, upload, tasks) |
| `src/pages/reader` | Reader (default react-pdf; see its README) |
| `src/pages/detail` | Task details |
| `src/js` | Shared API / imperative domain / legacy reader engine / mock |
| `src/styles` | Global and per-page CSS |

**Folder logic and dual features tree**: see [`src/FEATURES.md`](src/FEATURES.md)
(`js/features` = domain; `pages/home/features` = React UI; reader also see `pages/reader` + `js/reader`).

## About `frontend-react/`

The repository root also has `frontend-react/`: **independent Vite experiment/migration area**, port 40002, **does not replace** this directory. Daily development and releases use `frontend/` as the standard.

## 常用命令

```bash
npm run build        # css + js + stamp
npm run build:js
npm run build:css
npm test
python3 scripts/serve_static.py --host 127.0.0.1 --port 40001 --root .
```

| Document | Content |
|------|------|
| `src/FEATURES.md` | Site-wide directory / dual features / reader three layers / detail external |
| `src/pages/reader/README.md` | Reader react-pdf vs shared ports vs legacy |
| `src/js/reader/README.md` | Legacy pdf.js engine boundaries |
| `src/pages/detail/README.md` | Detail page external rules |
| `src/pages/home/composition/README.md` | Homepage composition rules |
| `src/pages/home/features/README.md` | Homepage React domain index |
| `src/styles/README.md` | CSS per-page splitting (home/detail/reader) |
