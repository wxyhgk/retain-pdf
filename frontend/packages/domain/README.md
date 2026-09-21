# @retainpdf/domain

Framework-agnostic RetainPDF job, job-status, AI and session domain logic. (书架 / library 的提交载荷组装不在本包内：它归 `frontend/web/src/features/library/domain/documents/`。) The package has no React or transport dependency and publishes standard ESM JavaScript plus TypeScript declarations from `dist`.

## Public entry points

Only the explicit package entry points below are public:

```ts
import { buildElapsedViewModel } from '@retainpdf/domain'
import { normalizeJobPayload } from '@retainpdf/domain/job'
import { buildJobStatusViewModel } from '@retainpdf/domain/job-status'
import { describeToolEvent } from '@retainpdf/domain/ai'
```

Source paths and individual implementation files are intentionally not exported. Add a deliberate barrel entry when a new public boundary is needed instead of importing `src` or relying on wildcard subpaths.

## Consumer setup

Declare `@retainpdf/domain` as a workspace dependency and let the package manager resolve it. Consumers should not alias `@retainpdf/domain` to `frontend/packages/domain/src` in Vite or TypeScript configuration. Build this package before a consumer build so its `dist` artifacts exist.

## Development

```bash
npm run typecheck --prefix frontend/packages/domain
npm run build --prefix frontend/packages/domain
npm run test:types --prefix frontend/packages/domain
npm run test:imports --prefix frontend/packages/domain
npm run test:pack --prefix frontend/packages/domain
```

`npm test --prefix frontend/packages/domain` runs the complete sequence. `build` removes the previous `dist` first so renamed or deleted modules cannot survive as stale package artifacts. `prepack` rebuilds the package, and the pack verification confirms that every exported type and JavaScript target is present while `src` remains unpublished.
