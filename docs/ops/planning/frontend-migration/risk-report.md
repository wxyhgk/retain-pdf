# React Big Rewrite: Risk Estimate & Migration Strategy

> Workspace: `retain-pdf-monorepo` | Date: 2026-08-20 | Scope: `frontend/web` (MPA) → `frontend/web-react` (SPA)
> Baseline: `frontend/web` 721 tests green (see §1), `frontend/web-react` isolated prototype, `packages/{ui,api,reader}` shared.

---

## 0. Executive Summary — Recommendation

**Do NOT do Big Bang. Do Incremental Strangler-Fig (slice-by-slice) behind a flag.**

| Question | Answer |
|---|---|
| **Safest path to fully React** | **Incremental + Strangler Fig**: keep `frontend/web` as production MPA; build `frontend/web-react` as single Vite SPA (`vite.config.ts`) that progressively *strangles* routes `/` → `/jobs/$jobId` → `/reader/$jobId` via TanStack Router. Each slice ships behind `USE_SPA=1` / nginx `try_files $uri /index.html` fallback, with dual CI (both builds green). |
| **Timeline** | **7–10 weeks** (1 dev) / **5–7 weeks** (2 devs parallel on independent slices). See §5. |
| **Big Bang risk** | **P1 — unacceptable**: 8–12 weeks dark, unmergeable branch, 721 tests red for weeks, no rollback without revert. |
| **Keep tests green** | Dual-build CI + contract tests as gates + `frontend/packages/domain` pure-logic extraction (no test rewrites). See §2. |

**Why not pure incremental without strangler?** Incremental rewrites inside `frontend/web/src/pages/*` keep the MPA (3 HTMLs, 3 bundles `frontend/web/scripts/build-js-bundle.mjs:46`, no router). You still pay `composition/types.ts:483` god-object cost and duplicate shell. Strangler gives you SPA routing, Query cache, and delete of `composition/*` (13 factories, 1996 LOC) as the payoff — same incremental risk, higher value.

---

## 1. Current State — What You Are Leaving (Quantified)

### 1.1 Architecture

| Layer | Location | Fact | Risk if rewritten naively |
|---|---|---|---|
| **Build** | `frontend/web/scripts/build-js-bundle.mjs:1` | esbuild + custom `jsToTsResolvePlugin:15`, 3 MPA bundles `PAGE_BUNDLES=[home→app.bundle.js, detail→detail.bundle.js, reader→reader.bundle.js]`, CSS via `scripts/build-css.mjs`, no HMR, imperative `define.PACKAGE_VERSION` | Dual toolchain (`frontend/web` esbuild vs `frontend/packages/reader` Vite vs `frontend/web-react` Vite) — Vite unification is prerequisite Phase 0, otherwise alias drift |
| **Entry** | `frontend/web/src/pages/home/entry.tsx:1`, `detail/entry.tsx:1`, `reader/entry.tsx:4` | `createHomeComposition → services.initialize() → createRoot(HomeApp)` — 3 HTMLs (`frontend/web/index.html:17`, `detail.html`, `reader.html`), no SPA router, full reload between pages | MPA loses polling state across navigations; `SoftReaderHost` (`HomeApp.tsx:133`) stays as island, not route |
| **Composition** | `frontend/web/src/pages/home/create-home-composition.ts:60` + 13 factories | Mutable `features: HomeFeatures` bag (`composition/types.ts:136`, 595 LOC), `HomeServices` god object (`types.ts:483`), `build-home-services.ts:17` with `as any` casts, order-sensitive `workflowDialog.bindEvents` before `mountRecentJobsFeature` (`composition/README.md:25`) | God object is #1 merge-conflict hotspot; order bugs are silent (recent-jobs refresh hangs) |
| **State** | `frontend/web/src/js/app-framework/store.ts:126` | Custom `createStore<State,Actions>` (clone+freeze), 20+ stores + `src/shared/react/use-store.ts:1` bridge (`useStoreSnapshot`, `cachedSnapshot` WeakMap) | Every `getSnapshot()` returns new frozen clone — per-card subscriptions break if `shallowEqual` misused (see docs `react-migration-recent-jobs-blueprint.md` §3) |
| **Pure domain** | `frontend/web/src/js/job/` (14 files, ~1.5k LOC), `frontend/web/src/js/job-status/` (46 files, ~6.5k LOC) | `normalize.ts:29` `normalizeJobPayload`, `types.ts:14`, stage adapters, progress view-models — **zero DOM**, heavily tested | **Keep, don't rewrite** — move to `frontend/packages/domain` verbatim (see `docs/ops/planning/frontend-migration/legacy-audit.md`: 64 live VMs, 0 view) |
| **Imperative** | `frontend/web/src/js/features/*` (15 domains, e.g. `recent-jobs` 45 files, `job-runtime` 17) | `refresh-scheduler.ts`, `active-refresh.ts`, `store-renderer.ts`, `runtime.ts` — polling + DOM ports | Rewrite as hooks (`useJobPolling` via TanStack Query `refetchInterval`) |
| **Shared** | `frontend/packages/ui`, `frontend/packages/api/src/{jobs,library-books}.ts`, `frontend/packages/reader` | Aliased in `build-js-bundle.mjs:94` → `../../packages/*`; pilot already via `@retainpdf/api` (`composition/external/api.ts:14`, `create-library-domain.ts:13`) | `@retainpdf/api` incomplete — `src/js/api/*` (12 files) still in `frontend/web` |
| **Prototype SPA** | `frontend/web-react/` | Vite + React 19 (`frontend/web-react/package.json:6`), single route `LibraryRoute` (`src/App.tsx:6`), not production | Isolated — can be strangled without touching `frontend/web` |

### 1.2 Test Coverage — 721 Tests Today (not 714)

```bash
# frontend/web — verified 2026-08-20
npm test  →  721 pass / 0 fail / ~11.8s (node:test + jsdom)
```

| Category | Files | Example suites | What they lock |
|---|---|---|---|
| **Pure domain** | `job-normalize.test.mjs`, `job-status-contract.test.mjs`, `job-stage-contract.test.mjs`, `job-progress-*.test.mjs` | `normalizeJobPayload`, `adaptJobStageSnapshot`, stage progress | Rust `contracts/job-status.v1.schema.json` ↔ TS `src/js/job/types.ts` ↔ `src/js/job-status/types.ts` — contract tests fail on schema drift |
| **Architecture / lint** | `architecture-boundaries.test.mjs` (Phase 0 gate), `css-page-namespace.test.mjs`, `tsx-color-literals.test.mjs`, `studio-token-registry.test.mjs` | 13+ boundary rules (e.g. `pages/home/features/**` forbids `src/js/**` direct import — must via `composition/external.ts:1`) | **Prerequisite for strangler**: proves `external.ts` barrel is sole entry; deleting it is the cutover signal |
| **Feature / wiring** | `job-runtime.test.mjs`, `recent-jobs.test.mjs`, `upload.test.mjs`, `workflow-payload.test.mjs`, `conversation-store.test.mjs` | polling, refresh-scheduler, upload controller, workflow budget | Imperative wiring that will be *deleted* during migration — tests for engines (state/pagination/loader) **must stay**, view/DOM tests die |
| **Component / island** | `home-app-component.test.mjs`, `detail-app-component.test.mjs`, `reader-react-pdf.test.mjs`, `library-search-island.test.mjs` | React shell rendering, `useStoreSnapshot`, `useRecentJobCover` | Hooks + view-ports: keep but port to Vitest |
| **Contract / schema** | `library-books-contract.test.mjs`, `ai-ask-contract.test.mjs`, `event-name-contracts.test.mjs` | API prefix, `APP_EVENTS` names | SPA needs same contracts via `contracts/*.json` → `frontend/packages/api/src/types.ts` generation |
| **Visual regression** | `tests/visual/baseline/{home,detail,reader-*.png}` (12 baselines), `scripts/visual-check.mjs:1` (Playwright+pixelmatch, 0.1% threshold) | `home.png`, `detail.png`, `reader-compare.png` | **Only real rendering gate** — jsdom tests miss `<library-search-island>` lazy-element failure (`HomeApp.tsx:53` comment) |

**Gaps (not covered by 721):**
- `backend/api` Rust workspace (`cargo test --workspace --manifest-path backend/api/Cargo.toml` — separate CI job, not in 721)
- Python pipeline (`backend/scripts/`, `pyproject.toml`) — covered by `translation-replay.yml` sampling, not unit CI
- `frontend/desktop` Electron (`frontend/desktop/scripts/prepare-app.mjs`) — smoke `scripts/check-frontend-bundle.mjs`
- `frontend/web-react` prototype — zero tests

**Interpretation:** 721 is strong for *unit + contract + boundary* but weak for *integration / visual*. Big Bang would lose the only rendering gate for weeks.

---

## 2. How to Keep 721 Tests Green During Migration

### 2.1 Principle: Never Turn Tests Red — Extend, Don't Replace

| Rule | Implementation |
|---|---|
| **Dual-build CI** | Keep `frontend/web` esbuild + `frontend/web-react` Vite both building. `.github/workflows/tests.yml:frontend` currently runs only `npm --prefix frontend/web test`; add parallel job `frontend-react: vitest run` (or keep zero-test allow). Gate PR on *both* green. |
| **Contract tests as ratchet** | `job-status-contract.test.mjs`, `library-books-contract.test.mjs`, `architecture-boundaries.test.mjs` are **merge-blocking**. Any schema/alias change that breaks them blocks cutover. During Phase 0, copy `src/js/job/*` → `frontend/packages/domain/src/` and run *same* tests with `import from "@retainpdf/domain"` alias — both imports green before deleting old. |
| **Pure logic never rewritten** | `docs/ops/planning/frontend-migration/legacy-audit.md`: 64 live VMs in `job/` + `job-status/` + `status-detail/` are **copy, not rewrite** into `frontend/packages/domain`. Their tests (`job-normalize.test.mjs` etc.) move verbatim. Risk = 0. |
| **Imperative tests are deleted, not migrated** | `react-migration-recent-jobs-blueprint.md §6`: `recent-jobs.test.mjs` *view/list-rendering/list-events/host* half dies at cutover; engine half (`state/pagination/loader/refresh-scheduler`) stays. Delete by section, not file — mark with `// TODO(strangler): delete view segment after cutover`. |
| **Visual baselines frozen** | Before Phase 2, run `npm run visual:update` on `main` to freeze 12 baselines. During slices, run `visual:check` in CI (or nightly) — diff >0.1% fails PR. Home/detail/reader baselines are the only guard for `DecorStage`, `AppTopBar` floating, `RecentJobCard` grid regressions that jsdom misses. |
| **Zustand adapter for `useStoreSnapshot`** | Keep `src/shared/react/use-store.ts:1` → `useStoreSnapshot` as thin adapter over Zustand during transition. Legacy stores that still use `createStore` expose `useLegacyStore(store)` wrapping `useSyncExternalStore`. Tests import adapter, not real store — no test rewrites. |
| **Mock branching removed once** | Today `composition/external/api.ts:14` + `create-library-domain.ts:13` branch on `isMockMode()` (`src/js/config/runtime.ts`). Move branching to `frontend/packages/api/src/mock.ts` adapter, inject via `fetch` param. Tests that assert mock behavior (`mock-live-jobs.test.mjs`) keep passing because adapter is pure. |

### 2.2 CI Gates per Phase

```
Phase 0:  cargo test --workspace           ✅
          npm --prefix frontend/web test       ✅ 721
          npm --prefix frontend/web-react build✅ (no tests yet)
          tsc --noEmit (both)              ✅
Phase 1:  + frontend/packages/domain tests          ✅ (same 64 VMs)
Phase 2:  per-slice: old slice tests frozen, new slice vitest added
Phase 3:  visual:check                     ✅ (12 baselines)
Phase 4:  delete frontend/web                  ✅ (single Vite build)
```

### 2.3 Anti-Patterns to Forbid

- ❌ Branch `feat/react-big-bang` that is red for >2 days — forces `git merge main` hell.
- ❌ Rewriting `normalizeJobPayload` (`src/js/job/normalize.ts:29`) — pure, already correct; any rewrite risks `progressTotal`/`progressPercent` terminal logic (`detail/DetailApp.tsx:341` relies on it).
- ❌ Moving `frontend/packages/reader` PDF engine into SPA bundle without `resolve.dedupe: ["pdfjs-dist"]` — duplicates 2MB wasm.

---

## 3. Risk Matrix

### 3.1 Severity Scale: Likelihood (1 rare → 5 almost certain) × Impact (1 cosmetic → 5 data loss / prod down)

| # | Risk | Big Bang (L×I) | Strangler Incremental (L×I) | Mitigation (incremental) |
|---|---|---:|---:|---|
| **R1** | **Regression in PDF rendering / OCR layout** — `frontend/packages/reader` + `job-status` stage logic (`status-card-stage-presentation.ts`) mis-ported, silent wrong PDF | 4×5=**20** | 2×3=**6** | Pure `frontend/packages/domain` is copied, not rewritten; reader stays as `@retainpdf/reader` lib (Vite `resolve.dedupe`); visual baselines gate |
| **R2** | **721 tests red for weeks** — no green main, no deploy, contract tests ignored | 5×5=**25** | 1×2=**2** | Dual CI, phase gates §2.2; contracts are merge-blocking |
| **R3** | **Merge hell / parallel dev blocked** — big branch diverges from `main` (47 commits ahead already, `git log origin/main..HEAD`) | 5×5=**25** | 2×3=**6** | Trunk-based: each slice is ≤1 week, ≤300 LOC, merges to `main` behind flag; `composition/*` deletes happen slice-by-slice |
| **R4** | **Rollback impossible** — prod bug after cutover requires week to revert | 5×5=**25** | 1×2=**2** | Nginx flag `USE_SPA=1`; keep `frontend/web/dist/*.html` for one release; `frontend/web-legacy` branch tag |
| **R5** | **Polling / refresh dead-lock** — `job-runtime` 1s + `recent-jobs` 2.5s + `refreshScheduler` 4s节流 mis-wired; library never refreshes after upload | 4×4=**16** | 2×3=**6** | Keep engines (`features/recent-jobs/*` engines, `job-runtime/*` all 17 files) intact per `react-migration-recent-jobs-blueprint.md §1` — React only swaps `viewPort`; TanStack Query `refetchInterval: q=>isJobTerminal?false:2000` replaces manual `startPolling/stopPolling` 1:1 |
| **R6** | **Mock mode divergence** — `isMockMode()` branching left in two places (`external/api.ts` + `create-library-domain.ts`) causes "settings has token, upload reads empty" (`evaluation:architect` Credentials P1) | 3×4=**12** | 2×2=**4** | Single `frontend/packages/api/src/mock.ts` adapter; `HiddenCredentialInputs` (`HomeApp.tsx:53`) stays mounted (dialog `open` via Zustand, not unmount — preserves `showModal` contract) |
| **R7** | **Visual / CSS regression** — Tailwind `@apply` vs `@retainpdf/ui` build-css divergence, `--status-ring-percent` vars, `data-stage-key` missing | 4×3=**12** | 2×2=**4** | Unified Vite PostCSS pipeline (`vite.config.ts` single Tailwind), `css-page-namespace.test.mjs` + `tsx-color-literals.test.mjs` ratchet, `visual:check` 12 baselines |
| **R8** | **Bundle bloat / double React** — esbuild 3 bundles vs Vite SPA chunks, duplicate `react@19`, `pdfjs-dist` 5.7 vs 4.8 | 3×3=**9** | 1×2=**2** | `vite.config.resolve.dedupe: ["react","react-dom","pdfjs-dist"]`, route-level code-splitting replaces 3 bundles with async chunks (~30% smaller) |
| **R9** | **Team velocity zero during rewrite** — no features ship for 2 months, product pressure forces half-baked cutover | 5×4=**20** | 1×3=**3** | Incremental: every slice is shippable behind flag; product can prioritize slices (library first, credentials later); `frontend/web` remains feature-able |
| **R10** | **Composition order bug** — `workflowDialog.bindEvents` before `mountRecentJobsFeature` missed, `closeTranslationWorkflow` doesn't `scheduleRefresh` | 4×4=**16** | 1×3=**3** | Providers nest order replaces imperative sequence (`AppProviders` declarative); add integration test `open→close workflow dispatches library refresh` |

**Aggregate risk score:** Big Bang **180** vs Incremental **44** (4× lower). Top 3 big-bang risks (R2,R3,R4) are **P0 — occur with certainty** on any >4-week branch.

### 3.2 Strategy Comparison Table

| Dimension | **Big Bang** (all at once) | **Strangler Fig** (SPA strangling MPA routes) | **Incremental without Strangler** (in-place React) |
|---|---|---|---|
| **Branch** | 1 long-lived branch, 8–12 weeks | Trunk-based, slices merge to `main` daily | Trunk-based, but still MPA |
| **Test signal** | Red for weeks; 721 → 0 trusted | Always green; contracts block merge | Green, but no routing payoff |
| **Rollback** | `git revert` of giant commit — high risk | Flip nginx flag / `USE_SPA=0` + keep `frontend/web` one release | No rollback needed (no cutover), but no SPA benefits |
| **Parallel dev** | Blocks all `frontend/web` features | Slices are feature-isolated (library ≠ credentials); others can ship to `frontend/web` while SPA builds | Same isolation, but shared `composition/types.ts` still conflict |
| **Payoff** | All or nothing at end | Each slice pays: router, Query cache, delete factories | Payoff only at end (still delete factories) |
| **Recommended?** | **No** — use only if `frontend/web` is frozen (it's not: 47 commits ahead) | **Yes** — best risk/value | Viable fallback if Vite unification blocked |

*Strangler Fig vs Incremental:* In this repo, strangler **is** incremental — the fig *is* the increment. Pure incremental without strangler keeps `build-js-bundle.mjs` + 3 HTMLs, losing the architecture win (`docs/core/frontend/spa-architecture.md §2.5` Vite unification). Do strangler.

---

## 4. Parallel Development While Migrating — Governance

### 4.1 Branch & Flag Model

```
main ──●──●──●──●──●──●──●──●──►  always green (dual CI)
        │  │  │  │  │  │  │  │
        ├──┴──┴──┴──┴──┴──┴──┴──  slice branches (1 week, rebase daily)
        │
nginx:  /            → frontend/web/dist/index.html  (default, MPA)
        /?spa=1      → frontend/web-react/dist/index.html (flag, SPA)
        X-SPA: 1     → same (desktop/Electron sets header)
```

- **Flag:** `USE_SPA` env / `?spa=1` query / `localStorage["spa"]` — checked in `frontend/web` entry *and* nginx `try_files`. No code fork: `frontend/web-react` builds to `dist-spa/`, nginx serves either. One-release overlap.
- **Trunk:** Every slice branch rebases on `main` daily (pre-commit hook `rg` checks `architecture-boundaries.test.mjs`). Merge via squash, ≤300 LOC, must pass both `frontend/web` and `frontend/web-react` builds.

### 4.2 Code Ownership During Migration

| Area | Owner | Rule |
|---|---|---|
| `frontend/web/src/js/job*` + `job-status/*` | **Frozen** — no new logic, only bugfixes cherry-picked to `frontend/packages/domain` | Prevents drift between copy and source |
| `frontend/web/src/pages/home/composition/*` | **Append-only** — new features go to `frontend/web-react/src/features/*`; `composition/external.ts:1` gets no new exports | Forces strangler |
| `frontend/packages/api`, `frontend/packages/ui`, `frontend/packages/reader` | Shared — both apps consume via workspace alias | Single source of truth |
| `frontend/web-react/src/features/*` | Slice owner — owns `api.ts`+`queries.ts`+`store.ts`+`components/` slice | Delete corresponding `create-*` factory when slice lands |

### 4.3 Review Gates

1. **Architecture boundary test** (`architecture-boundaries.test.mjs`) runs on every PR — blocks `pages/home/features/** → src/js/**` direct imports.
2. **Contract test** (`job-status-contract.test.mjs` etc.) blocks schema drift.
3. **Visual diff** — PR with `*.tsx` in `pages/home` or `frontend/web-react` must attach `visual:check` output (or `visual:update` with before/after PNGs).
4. **Bundle size** — `vite build --report` comment (e.g. `dist/assets/*.js` < 250kb gz).

---

## 5. Recommended Strategy & Timeline (Incremental Strangler Fig)

### 5.1 Timeline — 7–10 weeks (solo), 5–7 weeks (2 devs)

```
Phase 0  Foundations          ████░░░░░░░░  Weeks 1–2   (no UI change)
Phase 1  API surface          ░░░██░░░░░░░  Week  3     (frontend/packages/api)
Phase 2  Slices (parallelizable) ░░░░██████░░  Weeks 4–8   (feature slices)
Phase 3  Shell cutover        ░░░░░░░░██░░  Week  9     (router flip)
Phase 4  Deletion & polish    ░░░░░░░░░░██  Week 10     (delete frontend/web)
```

**Parallelization:** Phase 2 slices 2.2 and 2.3 can be built by second dev in parallel (no deps), saving ~1.5 weeks.

### 5.2 Phases — Concrete Checklists (from `docs/core/frontend/spa-architecture.md §3` — refined with risk mitigations)

#### Phase 0 — Foundations (Weeks 1–2, low risk, no UI change)

- [ ] **0.1 `frontend/packages/domain`** — copy `src/js/job/**` (14), `src/js/job-status/**` (46), `src/js/job/types.ts` → `frontend/packages/domain/src/` verbatim; wire `package.json` workspace alias `@retainpdf/domain`; run `job-normalize.test.mjs` + `job-status-contract.test.mjs` via alias — both green.
- [ ] **0.2 Unified Vite** — `frontend/web-react/vite.config.ts`: port `alias` from `build-js-bundle.mjs:94` + `define.PACKAGE_VERSION` (`build-js-bundle.mjs:72` `resolveMathJaxPackageVersion()`); verify `vite build` produces SPA `dist/` with async route chunks; keep `frontend/web` esbuild untouched.
- [ ] **0.3 Router + Query scaffold** — `npm i @tanstack/react-router @tanstack/react-query @tanstack/react-router-vite-plugin zustand zod` to `frontend/web-react`; scaffold `routes/__root.tsx`, `lib/queryClient.ts`, `lib/router.ts` (no pages yet); CI adds `vite build` check.
- [ ] **Gate:** `cargo test --workspace` ✅, `npm test` (frontend/web) 721 ✅, `vite build` (frontend/web-react) ✅, `tsc --noEmit` ✅.

#### Phase 1 — API Surface (Week 3)

- [ ] **1.1** Move `src/js/api/*` (12 files: `http.ts`, `collections.ts`, `favorites.ts`, `glossaries.ts`, `jobs-*.ts`, …) → `frontend/packages/api/src/*` one file at a time, each with thin `composition/external/api.ts`-compatible re-export so `frontend/web` still builds. Extract `buildApiHeaders()` from `api/internal/runtime.ts:1` unchanged.
- [ ] **1.2** Create `frontend/web-react/src/lib/api/queryOptions.ts` — `libraryKeys`, `jobKeys`, `collectionKeys` with `queryOptions` factories (replaces `refresh-scheduler.ts`/`active-refresh.ts` imperative refresh).
- [ ] **1.3** Generate types from `contracts/*.json` (`job-status.v1`, `library-books.v1`, `ai-ask.v1`, …) via `json-schema-to-typescript` → `frontend/packages/api/src/generated/`, re-export in `frontend/packages/api/src/types.ts`.
- [ ] **Gate:** `frontend/packages/api` tests (if any) ✅, contracts still green, `frontend/web` build still passes via re-exports.

#### Phase 2 — Slice-by-Slice (Weeks 4–8, parallelizable, each ≤1 week)

Order is dependency-aware; numbers match `frontend-spa-architecture.md §3`:

| Slice | What it replaces | Files deleted after | Risk & mitigation |
|---|---|---|---|
| **2.1 Status / Job polling** (leaf, no deps) | `create-status-domain.ts` + `job-status` imperative wiring | `create-status-domain.ts` | Low — `useJobPolling(jobId)` with `refetchInterval: isTerminal?false:2000` replaces `startPolling/stopPolling`; verify via `job-runtime.test.mjs` engine half |
| **2.2 Library / Collections** | `create-library-domain.ts:78`, `features/recent-jobs/*` view half, `features/documents-library/*` | `view.js`, `view-port.js`, `host.js`, `store-renderer.js` (Phase 4) | **Highest visual risk** — card grid, `useRecentJobCover` token race, objectURL revoke (`artifacts: never revoke on unmount`); add slice-specific visual baseline + card memo regression test (`areCardPropsEqual` via signature) |
| **2.3 Workflow + Upload** | `create-workflow-upload.ts`, `create-app-actions.ts`, `features/upload/*`, `features/workflow/*` | `controller.ts`, `form-data.ts` | Medium — `useMutation(submitJobRequest)` with `onSuccess: qc.invalidateQueries(libraryKeys.all)`; keep `PageRangeDialog` structure; test `open→closeTranslationWorkflow` refresh |
| **2.4 Credentials + Settings + Glossaries + AppUpdate** | `create-credentials.ts`, `create-glossaries-app-update.ts` | `browser-view-port.js`, `dialog-view-port.js` | **Highest correctness risk** — `default-state-port.js` singleton `mirrorToDom` must stay (upload reads hidden inputs); dialogs stay mounted (`showModal` contract, `app-shell/view.js:bindDialogBackdropClose`); test hidden input sync every PR |
| **2.5 Reader** | `frontend/web/src/pages/reader/entry.tsx:4` proxy | `reader.bundle.js` entry | Low — `routes/reader.$jobId.tsx` wraps `import { Reader } from "@retainpdf/reader"`; dedupe `pdfjs-dist`; verify `postMessage` contract `retainpdf-reader-progress` |
| **2.6 Detail** | `DetailApp.tsx:57` (341 LOC) | `job-detail/*` imperative renderers | Medium — `DetailApp` already React but uses `useState` text maps; replace with `useSuspenseQuery(jobQuery)` + `ArtifactsSection` as Query; wrap `loadAndRenderMarkdownFlow` in `useEffect` + `useQuery` |

Per-slice ritual: (a) create `src/features/<slice>/{api.ts,queries.ts,store.ts,hooks.ts,components/}` (b) route it (c) delete its `create-*` factory + `external/*` import (d) run full CI + visual:check (e) merge to `main` behind flag.

#### Phase 3 — Shell Cutover (Week 9)

- [ ] Replace `HomeApp.tsx:51` `HomeShell` + `HomeServicesProvider` with `RootLayout` + `AppProviders` (`QueryClientProvider` → `BrowserCredentialsProvider` → `WorkflowProvider` → `LibraryProvider`); home tabs become `validateSearch: z.object({tab: enum, q: string})` not `useState(readInitialLibraryTabFromReturn)` + `useHomeReturnRestore`.
- [ ] Router cutover: `frontend/web-react/index.html` becomes canonical; nginx `try_files $uri /index.html`; `frontend/web/dist/*.html` kept one release behind flag `USE_SPA=1` for rollback.
- [ ] Delete `frontend/web/scripts/build-js-bundle.mjs`, `prepare-runtime-deps.mjs`, `stamp-cache-version.mjs`; root `package.json:11` scripts become `"dev": "vite --config frontend/web-react/vite.config.ts"`.
- [ ] **Gate:** Full `visual:check` 12 baselines pass, `architecture-boundaries.test.mjs` passes with `composition/*` deleted, smoke `scripts/frontend-*` pass.

#### Phase 4 — Deletion & Polish (Week 10+, ongoing)

- [ ] Delete `frontend/web/src/pages/home/composition/*` (13 files), `frontend/web/src/js/*` imperative leftovers, `js/app-framework/store.ts:126` after last `useStoreSnapshot` removed (codemod `createStore → create` Zustand).
- [ ] `frontend/packages/domain` is sole owner of pure logic; port remaining `*.test.mjs` to Vitest (or keep dual runner).
- [ ] Remove `frontend/web` entirely or keep as `frontend/web-legacy` for one quarter; remove flag.

### 5.3 Resourcing

- **Solo:** 7–10 weeks (Phase 2 is bottleneck — 6 slices × ~1 week, no parallel).
- **2 devs:** Dev A: slices 2.1→2.2→2.6 (critical path), Dev B: slices 2.3→2.4→2.5 (parallel) — **5–7 weeks**.
- **Do NOT add 3rd dev** — `composition/types.ts:483` god object creates merge conflicts if >2 writers touch `external/*` simultaneously.

---

## 6. Rollback Plan

| Trigger | Action | Time to restore |
|---|---|---|
| Visual diff >0.1% after slice merge | Revert slice commit (squash, single commit) | <5 min |
| Library not refreshing after upload | Flip `USE_SPA=0` in nginx, keep `frontend/web` serving | <1 min (no deploy) |
| Polling dead-lock in prod | Same flag flip + `frontend/web` hotfix | <10 min |
| Full SPA regression | `git tag spa-cutover` → `git revert` or redeploy `frontend/web` artifact from previous Docker image (`wxyhgk/retainpdf-web:<prev>` via `docker/delivery/docker-compose.yml:129`) | <15 min |

---

## 7. Appendix — Evidence & References

- `frontend/web` test run: `node --import ./tests/helpers/register-jsx.mjs --test --test-force-exit tests/*.test.mjs` → **721 pass** (11.8s) — `frontend/web/package.json:20`.
- `frontend/web/src/FEATURES.md:1` + `pages/home/composition/README.md:1` — composition rules, `external.ts` gate.
- `docs/core/frontend/spa-architecture.md` — target architecture, decision matrix (TanStack Router vs React Router, Zustand vs Jotai, Vite vs esbuild).
- `docs/ops/planning/frontend-migration/legacy-audit.md` — 64 live VMs, 9 deletable files (6 isolated + 3 test-only).
- `docs/ops/planning/frontend-migration/recent-jobs-blueprint.md` — engine vs view split, store subscription design, 10 new tests.
- `docs/ops/planning/frontend-migration/dialogs-blueprint.md` — 7 dialog domains, hidden-input singleton risk, `showModal` mounting contract.
- Rust workspace gate: `.github/workflows/tests.yml:frontend` — `cargo test --workspace --manifest-path backend/api/Cargo.toml`.

---

*Report generated for `retain-pdf-monorepo` — file references pinned to `frontend/web/src/pages/home/create-home-composition.ts:60`, `composition/types.ts:483`, `js/app-framework/store.ts:126`, `scripts/build-js-bundle.mjs:1`, `frontend/packages/api/src/index.ts:1`.*
