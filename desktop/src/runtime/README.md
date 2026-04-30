Desktop platform runtimes live here.

Layout:

- `shared/fonts/`
- `shared/typst-packages/`
- `windows/python/`
- `windows/typst/`
- `linux/python/`
- `linux/typst/`
- `mac/python/`
- `mac/typst/`

`desktop/scripts/prepare-app.mjs` prefers this tree and falls back to the
legacy `backend/` runtime layout while the migration is in progress.

Exception:

- mac desktop packaging with `RETAIN_PDF_BUNDLE_MAC_PYTHON=1` does not fall back
  to `backend/python`.
- `desktop/src/runtime/mac/python/bin/python3` must exist before packaging.
- mac bundles also carry `desktop/src/runtime/mac/python/Frameworks/Python.framework`
  so packaged `python3` does not depend on a system-level Python.framework.
- The GitHub mac release workflow assembles this runtime on the mac runner.
