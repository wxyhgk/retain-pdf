# RetainPDF Frontend: MPA → Unified React SPA — Target Architecture

> Status: **未实施的历史设计稿（2026-09 归档）**。它设想迁往一个新的
> `frontend/web-react` SPA，那件事没有发生。实际走的是原地重组：
> `frontend/web/src` 在 2026-09 的批次 1–5 被重组为 app / features / platform / ui
> 四层，仍是 3 页 MPA。**现状以 `frontend/web/src/FEATURES.md` 为准**，
> 本文中的 `src/js/*`、`src/pages/*` 等路径均已不存在。
>
> 原始状态行：Design → for big migration `frontend/web` (MPA + vanilla JS) → `frontend/web-react` (SPA)
> Scope: routing · state · composition · shared packages · build · legacy `js/*`

---

## 0. Current State Diagnosis (what we are leaving)

**Build:** `frontend/web/scripts/build-js-bundle.mjs:1` — raw `esbuild` with custom `jsToTsResolvePlugin`, 3 separate MPA bundles (`home`/`detail`/`reader`) emitted to `dist/*.bundle.js`. CSS built separately via `scripts/build-css.mjs`. Two toolchains: `frontend/packages/reader` already Vite (`frontend/packages/reader/package.json:19`), `frontend/web` esbuild, `frontend/web-react` Vite — not unified.

**Entry:** `frontend/web/src/pages/home/entry.tsx:1` — `createHomeComposition → services.initialize() → createRoot(HomeApp)` ; same pattern for `detail/entry.tsx`, `reader/entry.tsx`. 3 HTMLs, 3 roots, no SPA router.

**Composition god object:** `frontend/web/src/pages/home/create-home-composition.ts:60` + 13 factories (`create-library-domain.ts`, `create-status-domain.ts`, `create-bridge.ts`, `create-workflow-upload.ts`, `create-credentials.ts`, `create-glossaries-app-update.ts`, `create-app-actions.ts`, `create-runtime-features.ts`, `create-lifecycle.ts`, `build-home-services.ts:17`, `external/*.ts`). Factories share mutable `features: HomeFeatures` bag (`composition/types.ts:136`) and write into a late-bound `HomeServices` god object (`composition/types.ts:483`, ~595 LOC). `build-home-services.ts:42` hides only reads behind `ReadOnlyStore` but still casts with `as any`.

**State:** Custom `js/app-framework/store.ts:126` `createStore<State,Actions>` (clone+freeze, batch, subscribe). 20+ stores (`text-store.ts`, `upload-store.ts`, `status-detail-store.ts`, `dialog-store.ts`, …) + `useStoreSnapshot` bridge. Server state (jobs, library) is imperative `fetch*` + manual `scheduleRefresh` + `APP_EVENTS`.

**Domain pure logic:** `src/js/job-status/*` (46 files), `src/js/job/*` (`normalize.ts:29`, `core.ts`, `formatters.ts`, …) — mostly pure, heavily tested, but coupled to imperative `recent-jobs/runtime.ts`, `job-runtime`.

**Shared packages:** `@retainpdf/ui`, `@retainpdf/api`, `@retainpdf/reader` aliased in `build-js-bundle.mjs:94` via `alias: { "@retainpdf/*": "../../packages/*" }`. Pilot migration already routes `fetchJobPayload/fetchLibraryBookList` through `@retainpdf/api` (`composition/external/api.ts:14`, `create-library-domain.ts:13`).

---

## 1. Target Architecture

### 1.1 Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        frontend/web-react (Vite SPA)                    │
│  index.html (single) → src/main.tsx → App Router                    │
├─────────────────────────────────────────────────────────────────────┤
│  ROUTING (TanStack Router)                                          │
│   /                → _layout → home tabs (library/collections/     │
│   /jobs/$jobId     →            favorites/ask)  [search: ?q, tab]  │
│   /reader/$jobId   → reader (page/blockId via search)               │
│   /jobs/$jobId not found → 404  ·  loaders handle fetch             │
├─────────────────────────────────────────────────────────────────────┤
│  APP SHELL (React tree)                                             │
│  <QueryClientProvider>                                              │
│   <RouterProvider>                                                  │
│    <ThemeProvider><DecorStage>                                      │
│     <AppLayout>  ← AppTopBar / MockModeBanner / AppBottomBar        │
│      <Outlet />  (home/detail/reader routes)                        │
├─────────────────────────────────────────────────────────────────────┤
│  FEATURE SLICES (per domain, no factories)                          │
│  features/library/   → hooks: useLibraryQuery, useLibraryMutations  │
│  features/status/    → useJobPolling(jobId), useStatusCardModel     │
│  features/workflow/  → useWorkflowForm, useUpload                   │
│  features/credentials/ → useCredentials, useOcrReadiness             │
│  features/reader/    → re-export @retainpdf/reader <Reader />       │
│  features/collections/, home-ask/, app-update/, status-detail/      │
│   each:  api.ts (query fns) + queries.ts (tanstack) + store.ts     │
│         (zustand, UI only) + hooks.ts + components/                 │
├─────────────────────────────────────────────────────────────────────┤
│  SHARED                                                             │
│  frontend/packages/ui        → design system (Radix + tailwind)              │
│  frontend/packages/api       → pure fetch fns (no React)                     │
│  packages/api-query → (or frontend/web-react/src/lib/api) tanstack     │
│                       wrappers generated from schemas                │
│  frontend/packages/reader    → <Reader> component, consumed as route         │
│  frontend/packages/domain    → NEW: pure js/job + js/job-status extracted    │
│                       (no DOM, no store, unit-tested)               │
│  frontend/web-react/src/lib/{queryClient, router, theme, utils}        │
└─────────────────────────────────────────────────────────────────────┘
           ▲                     │                     ▲
           │ npm workspace alias │                     │ fetch()
           │                     ▼                     │
     packages/*  ──────────►  backend /api/*  ◄───────┘
```

**Data flow (replaces HomeServices bag):**

```
UI Component  →  hook (useLibrary / useJob)  →  TanStack Query (server)
     │                      │                           │
     └─ Zustand (client) ◄──┘                           │
              (dialog open, selectedIds, pageRange)      │
                                                        ▼
                                              @retainpdf/api fetch fns
                                                        │
                                              frontend/packages/domain pure fns
                                              (normalizeJobPayload, stage models)
```

### 1.2 Concrete file tree (target)

```
frontend/web-react/
  vite.config.ts          # single Vite config, aliases @, @retainpdf/*
  index.html
  src/
    main.tsx              # createQueryClient + createRouter → <App />
    routes/
      __root.tsx          # Root layout (theme, decorators, toasts)
      index.tsx           # / → HomeLayout (tabs as nested routes or search)
      jobs.$jobId.tsx     # /jobs/$jobId → DetailPage (loader: fetchJobPayload)
      reader.$jobId.tsx   # /reader/$jobId → ReaderPage (?page=&blockId)
      collections.tsx     # or /?tab=collections as nested route
    features/
      library/
        api.ts            # wraps @retainpdf/api/library-books
        queries.ts        # queryOptions, invalidation keys
        store.ts          # zustand: selection, pagination UI
        hooks.ts          # useLibrary()
        components/
      status/
        queries.ts        # useJobQuery, polling via query refetchInterval
        store.ts          # zustand or null (polling state via query)
      workflow/
      credentials/
      status-detail/
      home-ask/
      collections/
    lib/
      queryClient.ts
      router.ts
      api/                # re-export @retainpdf/api with Query wrappers
    components/ui/        # re-export @retainpdf/ui or local shadcn
packages/
  ui/         # unchanged, Vite build → CSS+JS, peer react
  api/        # fetch fns, keep runtime header logic (internal/runtime.ts:1)
  api-query/  # OPTIONAL: generated queryOptions from api (or colocated)
  domain/     # NEW: extract js/job, js/job-status, js/job/types.ts:14
  reader/     # consumed as `import { Reader } from "@retainpdf/reader"`
```

---

## 2. Decision Matrix

### 2.1 Routing: TanStack Router **(recommend)** vs React Router

| Criterion | TanStack Router | React Router v7 | Verdict |
|-----------|----------------|-----------------|---------|
| Type safety | File-based + codegen, typed `params`/`search` with zod schema | Manual `useParams<string>`, `useSearchParams` untyped | **TanStack wins** — detail/reader need `?pageIdx=&blockId` validation |
| Loaders / code splitting | `loader` per route, `pendingComponent`, `errorComponent`, automatic code-splitting | `loader` via `createBrowserRouter`, similar | Tie |
| Search param as state | `validateSearch: z.object({tab, q, page})` eliminates `readInitialLibraryTabFromReturn` hack (`HomeApp.tsx:53`) | Manual sync effect | **TanStack wins** — home tabs (`library|collections|favorites|ask`) become URL state |
| Migration from MPA | Need SPA fallback; Vite plugin `@tanstack/router-vite-plugin` generates `routeTree.gen.ts` | Drop-in `<BrowserRouter>` | React Router slightly easier to adopt |
| Ecosystem | Newer, smaller | Larger, more SO answers | Tie |
| Bundle | ~12kb | ~10kb | Tie |

**Recommendation: TanStack Router.** The home page already hacks URL restore (`HomeApp.tsx:53` `readInitialLibraryTabFromReturn`, `useHomeReturnRestore`) and reader needs `?pageIdx=&blockId` deep linking (`create-library-domain.ts:68` `APP_EVENTS.openReaderRequested`). Typed search solves this natively. If team strongly prefers familiarity, React Router v7 + `nuqs` is acceptable fallback — but document `search` typing debt.

**SPA route design:**

```ts
// routes/__root.tsx
export const Route = createRootRoute({ component: RootLayout })
// routes/index.tsx  → /
export const Route = createFileRoute("/")({
  validateSearch: z.object({
    tab: z.enum(["library","collections","favorites","ask"]).default("library"),
    q: z.string().optional(),
  }),
  component: HomePage, // renders <AppTopBar> + tab outlet
})
// routes/jobs.$jobId.tsx → /jobs/$jobId
export const Route = createFileRoute("/jobs/$jobId")({
  loader: ({ params }) => queryClient.ensureQueryData(jobQuery(params.jobId)),
  component: DetailPage, // replaces DetailApp.tsx:57
})
// routes/reader.$jobId.tsx → /reader/$jobId?page=2&blockId=abc
export const Route = createFileRoute("/reader/$jobId")({
  validateSearch: z.object({ page: z.coerce.number().optional(), blockId: z.string().optional() }),
  component: ReaderPage, // wraps @retainpdf/reader
})
```

*Why not keep MPA?* MPA forces full reload between `home → detail → reader`, loses polling state, duplicates shell. SPA keeps `jobRuntime` polling across navigations and enables `SoftReaderHost` (`HomeApp.tsx:133`) as a true overlay route instead of an island.

*Fallback:* During migration, keep `frontend/web/dist/*.html` served; SPA dev server proxies `/api`. Cutover flips `index.html` to Vite's `index.html` and nginx fallback `try_files $uri /index.html`.

### 2.2 State Management

| Need | Current | Target | Why |
|------|---------|--------|-----|
| **Server state** (jobs, library, collections, glossaries, diagnostics) | Manual `fetch*` + `createStore` holding `items`, manual `scheduleRefresh` (`features/recent-jobs/refresh-scheduler.ts`) | **TanStack Query** | Cache, dedup, polling (`refetchInterval`), invalidation (`invalidateQueries({queryKey: ["library"]})`), optimistic updates for `deleteLibraryBook`. Eliminates 70% of `createStore` usage. |
| **Client UI state** (dialog open, selectedIds, batchMode, workflow form, pageRange) | `createStore` + `DialogStore`, `useStoreSnapshot` | **Zustand** (or Jotai) | Recommendation: **Zustand** — closest to `createStore` mental model (single store, `set`, `getSnapshot`), ~1kb, no Provider needed. Jotai is valid if atoms preferred, but Zustand requires fewer providers and maps 1:1 from `createStore<TState,TActions>` (`store.ts:126`). |
| `createStore` port | `js/app-framework/store.ts:126` | **Deprecate** — keep only as adapter (`lib/legacy-store-adapter.ts`) during migration, delete after. Provide `useLegacyStore(store)` → `useSyncExternalStore` bridging so old tests still pass. |
| **HomeServices god object** (`composition/types.ts:483`) | `bridge + features + stores + domains + narrow ports` (~30 fields) | **Delete.** Replace with: `lib/queryClient.ts` (single QueryClient) + per-feature Zustand stores + React contexts only where prop drilling hurts (e.g., `CredentialsContext`). `HomeApp.tsx:74` `useHomeServices()` → `useLibrary()`, `useStatusCard()`, `useWorkflow()` imported directly. Build-time `external.ts:1` barrel disappears — each feature imports from `@retainpdf/api` or `@/lib` directly. |

**Concrete:**

```ts
// features/library/queries.ts
export const libraryKeys = { all: ["library"] as const, list: (q: string) => ["library", q] as const }
export const libraryQuery = (q: string) => queryOptions({
  queryKey: libraryKeys.list(q),
  queryFn: () => fetchLibraryBookList(API_PREFIX, { q }),
  select: (data) => normalizeLibraryData(data), // uses frontend/packages/domain
})
// features/library/store.ts  (Zustand, UI only)
export const useLibrarySelection = create<{ ids: Set<string>, toggle: (id: string)=>void }>()(...)
// component
function RecentJobsLibrary() {
  const { data } = useSuspenseQuery(libraryQuery(search.q))
  const { ids, toggle } = useLibrarySelection()
}
```

Polling replaces `job-runtime` imperative `startPolling/stopPolling` (`types.ts:109`):

```ts
// features/status/queries.ts
export function useJobPolling(jobId: string) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => fetchJobPayload(jobId, { apiPrefix: API_PREFIX }),
    refetchInterval: (q) => isJobTerminal(q.state.data) ? false : 2000,
    select: normalizeJobPayload, // js/job/normalize.ts:29 pure
  })
}
```

### 2.3 Composition: 13-file factory maze → idiomatic React

**Before** (`create-home-composition.ts:81`):
```
features = {}
features.workflow = createWorkflowAndUpload({ features, ... })
features.browserCredentials = createCredentials({ features, ... })
...
return buildHomeServices({ bridge, features, ports, views, domains })
```

Problems: order-sensitive (`workflowDialog.bindEvents` must precede `mountRecentJobsFeature` — `composition/README.md:25`), mutable bag, `any` casts, untestable wiring.

**After:**

```ts
// src/app/providers.tsx
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }))
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserCredentialsProvider>  {/* was create-credentials.ts */}
        <WorkflowProvider>          {/* was create-workflow-upload.ts */}
          <LibraryProvider>         {/* was create-library-domain.ts */}
            {children}
          </LibraryProvider>
        </WorkflowProvider>
      </BrowserCredentialsProvider>
    </QueryClientProvider>
  )
}
// Each Provider is tiny: creates Zustand store, exposes hook, binds events via useEffect
```

**Rules:**
1. No `features` mutable bag. Each `features/*` becomes `src/features/<domain>/` with `api.ts | queries.ts | store.ts | hooks.ts | components/`. Imports are direct, not via `external/*.ts`.
2. `external.ts:1` deleted. `external/api.ts:14` → `@retainpdf/api`; `external/state.ts:1` → `zustand`/`jotai`; `external/job.ts` → `frontend/packages/domain`.
3. Factory return bags → hooks. E.g., `createStatusDomain` (`create-status-domain.ts:36`) → `features/status/StatusProvider.tsx` + `useStatusDetail()` hook. `createBridge` (`create-bridge.ts`) deleted — bridge was DOM→store glue, now React state is source of truth.
4. Effects that were `initialize/dispose` (`create-lifecycle.ts`) become `useEffect` in providers + `queryClient` lifecycle. Ordering becomes declarative (Provider nesting) not imperative sequence.

### 2.4 Shared Packages

| Package | Today | Target |
|---------|-------|--------|
| `@retainpdf/ui` (`frontend/packages/ui/package.json:1`) | Radix + `cn` + `build-css.mjs` separate toolchain | **Keep.** Build with Vite lib mode or keep `tsc + build-css.mjs`. Consume as `import { Button } from "@retainpdf/ui"`. Add Vite alias `@retainpdf/ui/*` → `frontend/packages/ui/src/*` (already in `build-js-bundle.mjs:98`, port to `vite.config.ts: resolve.alias`). |
| `@retainpdf/api` (`frontend/packages/api/src/index.ts:1`) | Pilot: `jobs.ts`, `library-books.ts` + mock adapters in `external/api.ts` | **Expand to source of truth.** Move all `src/js/api/*` (`http.ts`, `collections.ts`, `favorites.ts`, `glossaries.ts`, …) into `frontend/packages/api/src/*`. Remove mock branching from `external/api.ts:14` — add `frontend/packages/api/src/mock.ts` or keep mock at app layer (`src/mocks/`). `buildApiHeaders()` stays in `api/internal/runtime.ts`. Generate types from `contracts/*.json` (json-schema-to-typescript) and re-export via `frontend/packages/api/src/types.ts`. |
| `@retainpdf/reader` (`frontend/packages/reader/package.json:1`) | Standalone Vite lib, consumed via `frontend/web/src/pages/reader/entry.tsx:4` proxy entry | **Keep isolated, consume as route component.** `routes/reader.$jobId.tsx` → `import { Reader } from "@retainpdf/reader"` (no separate `reader.bundle.js`). Reader keeps its own Vite build for independent dev (`vite --port 40003`), but SPA build bundles it via alias. Shared `pdfjs-dist`, `react-pdf` deduped via `vite.config.resolve.dedupe`. |
| **`frontend/packages/domain` (NEW)** | Scattered `src/js/job/*`, `src/js/job-status/*` (46 files), `src/js/job/types.ts:14` | **Extract pure domain** → `frontend/packages/domain/src/{job, job-status}/`. No `window`, no `fetch`, no `store`. Move `normalize.ts:29`, `core.ts`, `job-stage-contract-adapter.ts`, `public-stage-engine.ts`, etc. Keep all unit tests. `frontend/web-react` imports `import { normalizeJobPayload } from "@retainpdf/domain"`. This is the “keep as pure” answer for bullet 6. |

**Workspace + aliases (unified Vite):**

```ts
// vite.config.ts (frontend/web-react)
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from "@tanstack/router-vite-plugin"
import path from "path"
export default defineConfig({
  plugins: [tanstackRouter(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@retainpdf/ui": path.resolve(__dirname, "../../frontend/packages/ui/src"),
      "@retainpdf/api": path.resolve(__dirname, "../../frontend/packages/api/src"),
      "@retainpdf/reader": path.resolve(__dirname, "../../frontend/packages/reader/src"),
      "@retainpdf/domain": path.resolve(__dirname, "../../frontend/packages/domain/src"),
    },
    dedupe: ["react", "react-dom", "pdfjs-dist"],
  },
  server: { proxy: { "/api": "http://localhost:8080" } },
})
```

### 2.5 Build Tool: Vite (unified) vs esbuild (current)

| Aspect | esbuild direct (`build-js-bundle.mjs:1`) | Vite | Recommendation |
|--------|------------------------------------------|------|----------------|
| Dev | `--watch` context, no HMR, inline sourcemap | HMR, overlay, typed errors | **Vite** |
| Prod | `bundle:true, minify:true, format:esm` | Rollup + esbuild minify, code-splitting per route | **Vite** — routes become `async` chunks automatically |
| Plugins | Hand-rolled `jsToTsResolvePlugin` (`build-js-bundle.mjs:15`) | Built-in TS, `@vitejs/plugin-react`, `tanstackRouter()` | **Vite** |
| CSS | Separate `build-css.mjs` (tailwind CLI) | `tailwindcss` via PostCSS, single pipeline | **Vite** — delete `scripts/build-css.mjs`/`stamp-cache-version.mjs` divergence |
| Config | 141 LOC imperative script | `vite.config.ts` declarative | **Vite** |
| Migration cost | Zero | Need to port `alias` + `define.PACKAGE_VERSION` (`build-js-bundle.mjs:106`) | Low — `define: { PACKAGE_VERSION: JSON.stringify(...) }` moves to `vite.config.ts: define` |

**Action:** Delete `frontend/web/scripts/build-js-bundle.mjs`, `prepare-runtime-deps.mjs`, etc. Keep `frontend/packages/reader/vite.config` and `frontend/packages/ui/build-css.mjs` (or unify UI css via Vite lib). Root `package.json:11` scripts become `"dev": "vite --config frontend/web-react/vite.config.ts"` etc.

### 2.6 Legacy `js/*` Domain Logic — Keep as Pure or Rewrite?

**Decision: Split into Pure vs Imperative, keep pure as-is (moved), rewrite imperative as hooks.**

*Keep (pure, no rewrite):*
- `src/js/job/*` — `normalize.ts:29`, `core.ts`, `formatters.ts`, `durations.ts`, `artifacts.ts`, `stage-snapshot-flatten.ts`, `elapsed-view-model.ts`, `workflow-visibility-view-model.ts`
- `src/js/job-status/*` — all 46 files (presentation, stage adapters, progress records, summary view-models)
- `src/js/job/types.ts:14` — canonical types
- `src/js/job-status/types.ts` — stage types
- Move to `frontend/packages/domain/src/` verbatim (TS, no logic change), add `index.ts` barrel. Tests remain `*.test.mjs` or port to Vitest.

*Rewrite (imperative, DOM/store/fetch coupled):*
- `src/js/features/recent-jobs/*` (`runtime.ts`, `controller.ts`, `refresh-scheduler.ts`, `store-renderer.ts`, `loader.ts`, …) → `features/library/queries.ts + store.ts`
- `src/js/features/credentials/*` (`browser.ts`, `validation-view.ts`, `dialog-view.ts`) → `features/credentials/hooks.ts` + Zustand + `useMutation(validateDeepSeekToken)`
- `src/js/features/upload/*` (`controller.ts`, `form-data.ts`) → `features/workflow/useUpload.ts`
- `src/js/features/job-runtime` (if exists) → `features/status/useJobPolling.ts`
- `src/js/api/*` → `frontend/packages/api/src/*` (thin wrappers, keep `http.ts` but replace `fetchProtected` call sites with Query)
- `src/js/app-framework/*` (`store.ts:126`, `component.ts`, `resource.ts`) → delete after migration; only `selector.ts` pattern may survive as `useMemo`

**Litmus test:** If file imports `document`, `window`, `createStore`, or `fetch`, it is rewritten. If it is `(job: JobLike) => string|boolean|JobPayload`, it is kept.

---

## 3. Migration Steps (phased, low risk)

### Phase 0 — Foundations (1–2 weeks, no UI change)

1. **Create `frontend/packages/domain`** — copy `src/js/job/**/*`, `src/js/job-status/**/*`, `src/js/job/types.ts` → `frontend/packages/domain/src/`, wire `pnpm -w` alias `@retainpdf/domain`, run existing tests green.
2. **Unify build** — in `frontend/web-react/vite.config.ts` port aliases from `build-js-bundle.mjs:94` and `define.PACKAGE_VERSION` (`build-js-bundle.mjs:72`). Verify `vite build` produces single SPA `dist/`. Keep old `frontend/web` build untouched.
3. **Add TanStack Router + Query** to `frontend/web-react/package.json` — `npm i @tanstack/react-router @tanstack/react-query @tanstack/react-router-vite-plugin zustand zod`. Scaffold `routes/__root.tsx`, `lib/queryClient.ts`, `lib/router.ts`. No pages yet.

### Phase 1 — API surface migration (1 week)

4. Move remaining `src/js/api/*` into `frontend/packages/api/src/*` (one file at a time, each with a thin `external/api.ts`-compatible re-export so `frontend/web` still builds). Delete `external/api.ts` mock branches after `frontend/packages/api` owns `isMockMode` via injected `fetch` adapter.
5. Create `packages/api-query` or `frontend/web-react/src/lib/api/queryOptions.ts` — `libraryKeys`, `jobKeys`, `collectionKeys` with `queryOptions` factories. This replaces `refresh-scheduler.ts` / `active-refresh.ts`.

### Phase 2 — Slice-by-slice feature migration (3–5 weeks, parallelizable)

Each slice: **(a)** create `src/features/<slice>/{api.ts,queries.ts,store.ts,hooks.ts,components/}` **(b)** route it **(c)** delete its `create-*` factory and `external/*` import.

Order (dependency-aware):

6. **Status/Job polling** (leaf, no deps) — `features/status` (`useJobPolling`, `StatusCard` already exists at `frontend/web-react/src/features/status/status-card.tsx`). Replace `create-status-domain.ts` + `job-status` imperative wiring. Verify polling via Query `refetchInterval`.
7. **Library/Collections** — `features/library` + `features/collections`. Replace `create-library-domain.ts:78`. Migrate `RecentJobsLibrary` to `useSuspenseQuery(libraryQuery)`. Delete `recent-jobs/runtime.ts`, `store-renderer.ts`.
8. **Workflow + Upload** — `features/workflow`. Replace `create-workflow-upload.ts`, `create-app-actions.ts`. Upload becomes `useMutation(submitJobRequest)` with `onSuccess: qc.invalidateQueries(libraryKeys.all)`.
9. **Credentials + Settings + Glossaries + AppUpdate** — `features/credentials`, `features/glossaries`, `features/app-update`. Replace `create-credentials.ts`, `create-glossaries-app-update.ts`. Each dialog becomes controlled Radix Dialog (`open` via Zustand, not `dialog-store.ts`).
10. **Reader** — `routes/reader.$jobId.tsx` wraps `@retainpdf/reader`. Delete `frontend/web/src/pages/reader/entry.tsx` proxy, delete `create-runtime-features.ts` reader port.
11. **Detail** — `routes/jobs.$jobId.tsx` port `DetailApp.tsx:57` (already React, but remove `useState` text maps in favor of `useSuspenseQuery(jobQuery)` + `ArtifactsSection` as Query). Delete `job-detail/*` imperative renderers after.

### Phase 3 — Shell cutover (1 week)

12. Replace `HomeApp.tsx:51` `HomeShell` + `HomeServicesProvider` with `RootLayout` + `AppProviders`. Home tabs become `validateSearch` (`?tab=`) not `useState`. Remove `composition/*` directory (13 files) and `external/*.ts` barrel. Delete `js/app-framework/store.ts` after last `useStoreSnapshot` removed (provide codemod `createStore → create` Zustand).
13. **Router cutover:** `frontend/web-react/index.html` becomes canonical. Nginx `try_files $uri /index.html`. Keep `frontend/web` MPA build for one release behind feature flag (`USE_SPA=1`) for rollback.
14. Delete `frontend/web/scripts/*`, `frontend/web/src/pages/home/composition/*`, `frontend/web/src/js/*` imperative leftovers. `frontend/packages/domain` is now sole owner of pure logic.

### Phase 4 — Polish & Deletion (ongoing)

15. Vitest + Playwright for slices, Storybook for `frontend/packages/ui`.
16. Generate API types from `contracts/*.json` → `frontend/packages/api/src/generated/`.
17. Remove `frontend/web` entirely (or keep as `frontend/web-legacy` for one quarter).

**Risk mitigations:**

- Keep `jsToTsResolvePlugin` behavior via Vite `resolve.alias` — no `.js` import rewrites needed.
- Preserve `APP_EVENTS` as `queryClient` invalidation during transition — grep `APP_EVENTS` and replace with `qc.invalidateQueries`.
- `MathJax` `PACKAGE_VERSION` define moves to `vite.config.define` (copy `resolveMathJaxPackageVersion()`).
- `detail` markdown flow (`loadAndRenderMarkdownFlow` in `DetailApp.tsx:133`) stays imperative until Phase 2.11 — wrap in `useEffect` + `useQuery` for images.

---

## 4. Alternatives Considered (and rejected)

- **React Router + nuqs** — viable if team rejects TanStack Router codegen; adds `nuqs` dep for typed search. Documented as fallback.
- **Keep `createStore` + add `tanstack-query`** — still leaves god object and factory maze; Zustand is 0.5kb smaller than keeping custom store and gives devtools.
- **Jotai over Zustand** — better for derived atoms (e.g., `selectedCount`), but most UI state is object-shaped (`{open, selectedIds, pageRange}`) where Zustand is simpler. Either works; pick one.
- **esbuild keep + Vite for SPA only** — dual toolchain cost outweighs migration; Vite *is* esbuild under the hood.

---

## 5. Checklist

- [ ] `frontend/packages/domain` extracted, tests green
- [ ] `vite.config.ts` unified (aliases, define, proxy)
- [ ] TanStack Router routes (`/`, `/jobs/$jobId`, `/reader/$jobId`) live behind flag
- [ ] `@retainpdf/api` owns all `src/js/api/*`
- [ ] `features/*` slices replace `create-*` factories (delete `composition/*`)
- [ ] `HomeServices` deleted, `createStore` deleted
- [ ] `DetailApp` + `HomeApp` ported to Query + Zustand
- [ ] `build-js-bundle.mjs` deleted, single `vite build` in CI
- [ ] Nginx SPA fallback, rollback flag removed

---

*Authored for `retain-pdf-monorepo` — references: `frontend/web/src/pages/home/create-home-composition.ts:60`, `composition/build-home-services.ts:17`, `composition/types.ts:483`, `js/app-framework/store.ts:126`, `js/job/normalize.ts:29`, `pages/detail/DetailApp.tsx:57`, `pages/home/HomeApp.tsx:51`, `scripts/build-js-bundle.mjs:1`, `frontend/packages/api/src/jobs.ts:1`, `frontend/packages/reader/package.json:1`.*
