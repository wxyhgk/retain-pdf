# recent-jobs + job-runtime React migration blueprint (Phase 3 core)

> Direct input for Phase 3 implementation agent. Produced from source‑level survey, used alongside master plan
> ~/.claude/plans/wondrous-baking-donut.md.

## 0. Current data flow (must read before work)

Three chains, two timers, three stores:

- **Chain A (current job polling 1s)**: jobRuntimeFeature.startPolling → setInterval 1000ms → fetchJob/fetchJobPayload → render‑context writes currentJobStore → ui/presentation.js renderJob → job-status-card.renderSnapshot; also notifyLibraryJobUpdated(document CustomEvent) + requestLibraryRefresh(4s throttle) + secondaryResourceScheduler(three resources events/manifest/stageActions rate‑limited → secondaryResourceStore → renderJobSecondaryPatch).
- **Chain B (library list)**: refreshScheduler.initialize → loader.load → pagination aggregate → commit → recentJobsStatePort.batch → store-renderer → viewPort.renderList → view.js → <recent-job-card> grid.
- **Chain C (active card patch 2.5s)**: active‑refresh pulls up to 6 non‑current active jobs → runtimePatches.update → statePort.replaceItem(card‑level patch) → then full silent refetch.
- **Event bridge (bindings.js)**: library* three document CustomEvents → command bus → command‑handlers(cache invalidation + patch + 300/600/1200ms staggered refresh); openTranslationWorkflow suspends refresh / close resumes.

**Key facts**:
- recentJobsStatePort / currentJobStore / secondaryResourceStore are already the single source of truth (storeDrivenRendering: true) – **polling/patch/throttle engines remain untouched**, React only replaces viewPort and custom elements.
- Status card VM is entirely in src/js/job-status/ (pure logic, gate allowed).
- card-presenter.js / image-loader.js are re‑export facades under features/recent-jobs/ (import from facade is legal).
- store getSnapshot() deep‑freezes a new clone each time → after notify all item references change, **card subscriptions cannot rely on reference equality** (see §3).
- Smoke DOM contracts must be mirrored one‑by‑one: .recent-job-item[data-job-id], #job-status-card, #status-ring-label/-value, #status-progress-ring, #job-progress-text, .status-stage-step[data-stage-key][aria-selected], #status-section.hidden, #recent-jobs-list, #recent-jobs-empty.
- recoverActiveJob(actions.js:84) has no production caller; keep it disconnected.

## 1. Per‑file verdict

### features/recent-jobs/(45 files)
- **Keep as‑is (engine)**: state, pagination, runtime-item, runtime-patches, runtime-value-helpers, loader, commit, runtime, controller, actions, active-refresh, refresh-scheduler, refresh-environment, commands, command-handlers, bindings, library-books-resource, library-refresh-port, navigation-port, job-runtime-port, reader-port, active-job-recovery, created-job-hydration, summary-view-model, loading-state-contract, image-refresh, event-target – composition.js imports and mounts them directly.
- **Keep (facade)**: card-presenter.js, image-loader.js.
- **Keep but disable**: store-renderer.js (harmless under React viewPort, delete in Phase 4).
- **Keep**: workflow-open-port.js (composition injects isWorkflowOpen from workflow store).
- **Dead (cutover delete)**: view.js, view-port.js, host.js, host-actions.js, render-target.js, view-state-target.js, view-state.js, list-rendering.js, list-events.js, image-hydration.js, card-markup.js, card-template.js, formatting.js, dom-contract.js. ⚠️ controller/runtime/loader/commit/bindings 5 default parameters `viewPort = createRecentJobsViewPort()` will be changed to required at cutover (tests already inject, zero impact).

### features/job-runtime/(17 files)
**Keep all**. Only the callback implementations in mountJobRuntimeFeature payload change (renderJob/renderJobSecondaryPatch/setText/setWorkflowSections… provided by composition React implementations). runtime-reset consumes injected callbacks from app‑shell subdomain already migrated.

### components/status/(17 files)+ job-status/(VM)
job-status/ entire directory is pure VM and kept; React imports directly. components/status verdict:
- job-status-card.js / -template.js / connected-.js / -rendering.js / -progress-renderer.js / -selection.js / -stage-flow.js / -substages.js / -retry.js / -snapshot.js / -presets.js / -visuals.js / -dom-contract.js / task-toolbar.js → **dead**, replaced by StatusCard.jsx family; among them:
  - rendering.js buildProgressRenderModel(lines 45-164 pure function) **copied** to src/pages/home/features/status/progress-model.js (cannot import due to barrier).
  - -progress-animation.js → hook useStagedProgressAnimation(imports from job-status/status-card-progress-view-model.js; timers/displayedProgressByStage use useRef).
  - -animation.js(lottie 194 lines) → imperative island hook useLottieStageAnimation(desiredKey race guard + speedForProgressDelta curve copied wholesale; resolveLottieVendorUrl legal import).
  - -presets.js STAGE_ANIMATIONS table copied into hook; -visuals.js resolveVisualStageKeyForSnapshot(8 lines) copied.
  - Hidden areas #job-id/#job-status/#job-stage-detail/#query-job-duration/#job-finished-at and legacy links **still rendered** (job‑summary text and parallel smoke depend on them).

### components/recent-jobs/(3 files)
recent-job-card.js dead → RecentJobCard.jsx; presenter and image-loader **kept** (via facade; module‑level objectURL cache must be shared, React must not recreate it).

### ui/ presentation chain
presentation.js, status-surfaces-presenter.js, job-status-card-renderer.js, status-card-view-port.js, job-status-summary-presenter.js, elapsed-presenter.js, presentation-view.js, status-ring-fallback-presenter.js → dead at cutover. Pure logic already lives in job-status/ and job/. ⚠️ Do not import ui/status-surfaces-presenter.js from pages (would drag in old DOM write chain).

## 2. React component table (src/pages/home/)

### features/library/
- **RecentJobsLibrary.jsx**: useStoreSnapshot(recentJobsStore) full snapshot + useStoreSnapshot(libraryViewStore); loadMore → runtime.loadRecentJobs({reset:false}); summary uses buildRecentJobsSummaryViewModel.
- **RecentJobCard.jsx**: memo(Card, areCardPropsEqual), props = item + onSelect/onDelete/onReader(stable refs); delete confirmation popover elevated to Library‑level confirmingDeleteJobId useState.
- **useRecentJobCover.js**: loadFirstRecentJobImage + recentJobRawImageUrls(facade); imageCacheVersionOf copied (recent-job-card.js:12-29); token race guard; **do not revoke on unmount**.
- **useLibraryAutoLoad.js**: scroll passive listener + rAF, 260px/0.35 threshold geometry rewritten (~10 lines).
- **library-view-store.js**(new): {mode: loading|list|empty|error, message, hasMore, loadMoreLoading}; copy RECENT_JOBS_VIEW_TEXT main view variants.
- **react-view-port.js**(new): implements old viewPort 10 methods → writes libraryViewStore; renderList ignores items (React reads recentJobsStore directly); replaceCard always true; bindEvents captures handlers to handlersRef; hasView always true.
- recent-jobs-dialog element shape disabled in main view, dead.

### features/status/
- **StatusCard.jsx**(id="job-status-card", rendered into #status-section): useStoreSnapshot(statusCardStore) full snapshot; cancel → services.jobRuntime.cancelCurrentJob().
- **StageFlow.jsx / SubstageFlow.jsx / ProgressBlock.jsx / ResultActions.jsx / StageRetry.jsx**: all driven by job-status/ pure VM; StageRetry dispatches APP_EVENTS.retryStage.
- **useElapsedTicker.js**: 1s tick + buildElapsedViewModel(job/elapsed-view-model.js), stops at terminal; elapsed not stored in store (would cause constant snapshot change).
- **useStageSelection.js**: selectedStageKey/manual useState; reset on job change, clear manual on stage advance (selection.js:45-64 semantics).
- **status-card-store.js**(new)+ statusCardPresenter(~80 lines): renderMain = buildRuntimeStatusCardViewModel + buildJobStatusSummaryViewModel → setSnapshot; renderPatch merges three sources as "recompute VM write store" (semantic convergence point, S9 cross‑check); finishedAtFallback uses currentJobStore.

## 3. Subscription design (1s polling does not re‑render the whole grid)

1. Grid single subscription: Library component uses full snapshot without selector (re‑rendering grid function itself is cheap).
2. **Card memo + signature comparison**: cardSignatureOf(item) produces primitive string (imageCacheVersionOf field set ∪ title/display_name/page_count/cover_url/thumbnail_url/stage_detail/runtime_status.detail); only active card signature changes trigger re‑render. **Do not use per‑card store subscription** (zero gain).
3. Callback stability: onSelect etc. directly reference composition singleton actions, not inline arrow functions.
4. Selectors must be defined at module top (use‑store getSnapshot useCallback depends on it).
5. StatusCard takes full snapshot; elapsed driven locally by ticker.

Store frequencies: recentJobsStore ~1-3/s, currentJobStore 1/s, secondaryResourceStore ~3-5s, statusCardStore 1/s, libraryViewStore sparse.

## 4. Lifecycle (bootstrap → composition)

**All timers stay outside React** (already live in kept engines); composition module‑level singleton, entry.jsx creates it before render, decoupled from StrictMode.

createHomeComposition() points:
- statusCardStore + statusCardPresenter;
- mountJobRuntimeFeature({state, api ports as‑is, renderJob→presenter.renderMain, renderJobSecondaryPatch→presenter.renderPatch, setText/setWorkflowSections/… provided by already migrated app‑shell/upload/workflow/status-detail React features, shellViewPort, libraryEventPort, resetStatePort});
- createRecentJobsReactViewPort + mountRecentJobsFeature(fetch* as‑is, startPolling/currentJobId from jobRuntimeFeature, readerPort/stageAdapterPort lifted from bootstrap corresponding files, statePort);
- document listeners: openReaderRequested (lift payloads.js:55-68), retryStage → jobRuntimeFeature.retryStage;
- startup route: URL ?job_id= starts polling (lift startup-route.js:49-59).

Dissolved bootstrap files ~20 (startup-route*, job-*-port, half of mount-job-features, main-shell-event-bindings two lines, etc.), cutover delete.

Order guarantee: composition mounts first (initial load synchronously sent) → React render; useSyncExternalStore first read gets current value.

## 5. Event contract

- library* three document CustomEvents, command bus, open/close-translation-workflow, status-area-visibility-changed: **all kept as‑is**, React components do not consume directly (all via store), composition bindings.js continues to run.
- **Pre‑condition**: workflow React features must continue dispatching open/close events, otherwise library refresh hangs permanently (risk 5).
- StageRetry continues dispatching retryStage; event-name-contracts already scanned .jsx.
- This step lands src/shared/react/use-app-event.js (for status-detail/workflow consumption) + unit tests.

## 6. Test mapping

- **Zero‑change keep‑alive**: state/pagination/commit/loader/refresh-scheduler/active-refresh/actions/runtime-patches/commands/command-handlers sections in recent-jobs.test.mjs; controller/polling/secondary/render-context in job-runtime.test.mjs; VM sections imported from job-status/ in status-card.test.mjs (~70%); library-* and use-store-hook.
- **Dead with view**: view/list-rendering/list-events/host/render-target/view-state/store-renderer sections in recent-jobs.test.mjs; components/status shell sections in status-card.test.mjs (buildProgressRenderModel, progress-animation test **migrated** to new pages files, assertions unchanged); ui/ dependent sections in job-runtime.test.mjs.
- **New Top10**: ① library grid render + smoke contract; ② card interactions (select/delete popover/reader/keyboard); ③ **card render isolation** (replaceItem single card, remaining 23 card render counts unchanged — memo regression anchor); ④ viewPort×store state machine; ⑤ StatusCard contract (stage flow/substage/retry/result actions/data‑status/ring ids); ⑥ stage selection semantics; ⑦ staged animation (fake timer 120ms); ⑧ statusCardPresenter three sources; ⑨ composition integration (initial load, job‑updated patch, workflow suspend); ⑩ useRecentJobCover (cache/race/no revoke).

## 7. Build order (npm test green after each step; 12 baselines naturally untouched before cutover)

S1 store+viewPort+composition skeleton → S2 RecentJobCard+cover hook → S3 Library+autoload+search → S4 statusCardStore+presenter+connect to jobRuntime → S5 StatusCard static structure → S6 animation islands (lottie+staged) → S7 interaction loops (select/elapsed/cancel/retry) → S8 full event bridge → S9 dual‑track manual check (watch:js + real backend + mock=parallel) → cutover (switch entry, delete dead files + 5 default params, delete test sections, 4 baselines + full smoke).

## 8. Risks and mitigations

1. **staged animation timing (highest)**: displayedProgressByStage must be useRef; new snapshot decides continue/jump based on shouldAnimateRenderPageProgress; job change resets. Using useState would re‑render on every tick and capture stale closure.
2. **lottie race**: desiredKey triple‑check kept as‑is; status‑section uses CSS hidden, not unmount (animation instance lives).
3. **objectURL**: module‑level cache never revoked; React unmount **must not** revoke; invalidation only via invalidateRecentJobImages.
4. **refresh throttle semantics**: lastRefreshAt write timing is intentional; do not reorder; test keep‑alive is the anchor.
5. **workflow suspend deadlock**: isWorkflowOpen injected from composition reading workflow store; integration test covers open→close→300ms refresh.
6. **first‑frame placeholder**: presenter must write store synchronously inside startPolling chain (otherwise empty flash, status‑dialog baseline catches).
7. **DOM contract**: includes --status-ring-percent, --status-substage-count CSS variables, aria‑selected, data‑stage‑key; dom‑ids constants + contract test asserts each id.
8. **deep clone floor**: existing cost already borne; do not use items.find inside per‑card selector.
9. **default param break**: cutover changes 5 spots to required.
10. **renderPatch convergence**: React whole‑card diff is theoretically equivalent; S9 cross‑check against mock=parallel + failure task dual paths.

## Key files
- features/recent-jobs/controller.js(viewPort injection point)
- features/job-runtime/controller.js(polling engine payload contract)
- job-status/status-card-runtime-source.js(sole status card VM source)
- components/status/job-status-card.js(StatusCard.jsx behaviour mirror baseline)
- src/shared/react/use-store.js(subscription base)