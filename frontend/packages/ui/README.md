# @retainpdf/ui

Shared UI primitives for `frontend/web`, `frontend/web-react`, and `frontend/packages/reader`.

## Usage

Import the package's declared entry points. Do not alias or import
`frontend/packages/ui/src` from an application.

```tsx
import { Button, Dialog, cn } from "@retainpdf/ui";
import "@retainpdf/ui/styles.css";
```

The stylesheet contains the Tailwind utilities used by the primitives. The host
application remains responsible for defining its design-token CSS variables,
including `--background`, `--foreground`, `--primary`, `--border`, and `--ring`.

Explicit component subpaths are also public, for example:

```ts
import { buttonVariants } from "@retainpdf/ui/components/ui/button";
```

## Development

```sh
npm --prefix frontend/packages/ui run typecheck
npm --prefix frontend/packages/ui run build
npm pack ./frontend/packages/ui --dry-run
```

`npm pack` rebuilds the package first. Only `dist` is published; source paths
are intentionally not exported.
