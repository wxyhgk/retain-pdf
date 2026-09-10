# @retainpdf/api

Typed API clients using generated wire DTOs from `@retainpdf/contracts`.

- `library-books.ts` → `fetchLibraryBookList` etc. (from `frontend/web/src/js/api/library-books.ts`)
- `jobs.ts` → `fetchJobPayload` etc.
- `types.ts` → generated Job/library DTO re-exports plus the generic `ApiResponse` envelope

Build: `npm --prefix frontend/packages/api run build` → `dist/`
Usage: `import { fetchLibraryBookList } from "@retainpdf/api/library-books"`

Browser-aware runtime configuration helpers are public at `@retainpdf/api/runtime`.
The old `@retainpdf/api/internal/runtime` entry remains available only as a
compatibility path for existing consumers.
