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

`frontend/desktop/scripts/prepare-app.mjs` reads platform runtimes from this tree.

Exception:

- `frontend/desktop/src/runtime/mac/python/bin/python3` must exist before packaging.
- mac bundles also carry `frontend/desktop/src/runtime/mac/python/Frameworks/Python.framework`
  so packaged `python3` does not depend on a system-level Python.framework.
- The GitHub mac release workflow assembles this runtime on the mac runner.
