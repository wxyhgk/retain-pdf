import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_DIALOG_BACKDROP_IDS,
  APP_DIALOG_IDS,
  APP_EVENTS,
  APP_SHELL_IDS,
} from "../src/js/contracts/app-contract.js";
import {
  createHomeStatePort,
  createHomeStore,
} from "../src/js/features/home/state.js";
import {
  createRecentJobsStatePort,
  createRecentJobsStore,
} from "../src/js/features/recent-jobs/state.js";
import { createRecentJobsLibraryRefreshPort } from "../src/js/features/recent-jobs/library-refresh-port.js";
import {
  createRecentJobsCommandPort,
  RECENT_JOBS_COMMANDS,
} from "../src/js/features/recent-jobs/commands.js";
import { bindRecentJobsFeatureEvents } from "../src/js/features/recent-jobs/bindings.js";
import { bindRecentJobsCommandHandlers } from "../src/js/features/recent-jobs/command-handlers.js";
import { hydrateCreatedRecentJob } from "../src/js/features/recent-jobs/created-job-hydration.js";
import {
  createLibraryBooksResource,
  invalidateLibraryBooksResource,
} from "../src/js/features/recent-jobs/library-books-resource.js";
import {
  collectRecentJobsPage,
} from "../src/js/features/recent-jobs/pagination.js";
import { createRecentJobsLoader } from "../src/js/features/recent-jobs/loader.js";
import {
  commitRecentJobsEmpty,
  commitRecentJobsError,
  commitRecentJobsNoMore,
  commitRecentJobsPage,
} from "../src/js/features/recent-jobs/commit.js";
import {
  createLibraryEventPort,
  requestThrottledLibraryRefresh,
} from "../src/js/contracts/library-event-contract.js";
import { createRecentJobsRefreshScheduler } from "../src/js/features/recent-jobs/refresh-scheduler.js";
import {
  createActiveLibraryRefreshLoop,
  recentJobsEligibleForActiveRefresh,
} from "../src/js/features/recent-jobs/active-refresh.js";
import {
  createRecentJobsRefreshEnvironment,
} from "../src/js/features/recent-jobs/refresh-environment.js";
import {
  isTranslationWorkflowDialogOpen,
} from "../src/js/features/recent-jobs/workflow-open-port.js";
import { createRecentJobActions } from "../src/js/features/recent-jobs/actions.js";
import { createRecentJobsRuntimePort } from "../src/js/features/recent-jobs/job-runtime-port.js";
import { createRecentJobsReaderPort } from "../src/js/features/recent-jobs/reader-port.js";
import { createRecentJobsNavigationPort } from "../src/js/features/recent-jobs/navigation-port.js";
import {
  recentJobRawImageUrls,
  recentJobProgressPercent,
  isRecentJobActive,
  stageKeyForRecentJobLabel,
  recentJobStageLabel,
  recentJobStatusLabel,
} from "../src/js/features/recent-jobs/card-presenter.js";
import {
  clearRecentJobImageCache,
  loadRecentJobImage,
} from "../src/js/features/recent-jobs/image-loader.js";
import { recentJobImageRefreshUrls } from "../src/js/features/recent-jobs/image-refresh.js";
import {
  buildRecentJobRuntimeSnapshot,
  mergeLibraryJobItem,
} from "../src/js/features/recent-jobs/runtime-item.js";
import { createRecentJobsRuntime } from "../src/js/features/recent-jobs/runtime.js";
import { createRecentJobsRuntimePatches } from "../src/js/features/recent-jobs/runtime-patches.js";
import { createRecentJobsStoreRenderer } from "../src/js/features/recent-jobs/store-renderer.js";
import {
  buildJobImageCandidateUrls,
  normalizeJobImageUrl,
} from "../src/js/api/job-images.js";
import { adaptJobStageSnapshot } from "../src/js/job-status/job-stage-contract-adapter.js";
import {
  RECENT_JOBS_IDS,
  RECENT_JOBS_PRIVATE_KEYS,
  RECENT_JOBS_SELECTORS,
  RECENT_JOBS_TAGS,
} from "../src/js/components/dialogs/recent-jobs-dialog-dom-contract.js";
const recentJobsStageAdapterPort = { adaptJobStageSnapshot };
import {
  buildRecentJobsSummaryViewModel,
  summarizeRecentJobsInvocationCounts,
} from "../src/js/features/recent-jobs/summary-view-model.js";
import {
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
} from "../src/js/features/translation-workflow-dialog/contract.js";
import {
  createTranslationWorkflowDialogStatePort,
  homeViewModeForTranslationWorkflow,
} from "../src/js/features/translation-workflow-dialog/state.js";
import { createInitialState } from "../src/js/state/slices.js";

test("app contract centralizes global retainpdf events and dialog roots", () => {
  assert.deepEqual(
    Object.values(APP_EVENTS).filter((value) => value.startsWith("retainpdf:")).sort(),
    [
      "retainpdf:close-translation-workflow",
      "retainpdf:home-recent-jobs-state-changed",
      "retainpdf:home-view-mode-changed",
      "retainpdf:library-job-created",
      "retainpdf:library-job-updated",
      "retainpdf:library-refresh-requested",
      "retainpdf:open-browser-credentials",
      "retainpdf:open-reader-requested",
      "retainpdf:open-translation-workflow",
      "retainpdf:refresh-glossaries",
      "retainpdf:retry-stage",
      "retainpdf:return-home",
      "retainpdf:status-area-visibility-changed",
      "retainpdf:submit-busy-changed",
      "retainpdf:translation-workflow-sync",
    ],
  );
  assert.deepEqual(APP_DIALOG_BACKDROP_IDS, [
    APP_DIALOG_IDS.recentJobs,
    APP_DIALOG_IDS.developerAuth,
    APP_DIALOG_IDS.developerSettings,
    APP_DIALOG_IDS.glossaryManager,
    APP_DIALOG_IDS.browserCredentials,
    APP_DIALOG_IDS.professionalTranslation,
    APP_DIALOG_IDS.aiAssistant,
    APP_DIALOG_IDS.appSettings,
    APP_DIALOG_IDS.statusDetail,
    APP_DIALOG_IDS.reader,
  ]);
  assert.equal(APP_DIALOG_IDS.aiAssistant, "ai-assistant-dialog");
  assert.equal(APP_DIALOG_IDS.appSettings, "app-settings-dialog");
  assert.equal(APP_DIALOG_IDS.translationWorkflow, "translation-workflow-dialog");
  assert.equal(APP_SHELL_IDS.aiAssistantButton, "ai-assistant-btn");
  assert.equal(APP_SHELL_IDS.appSettingsButton, "app-settings-btn");
  assert.equal(APP_SHELL_IDS.libraryAddPdfButton, "library-add-pdf-btn");
});

test("recent jobs contract centralizes host ids and private callback keys", () => {
  assert.equal(RECENT_JOBS_IDS.libraryView, "library-view");
  assert.equal(RECENT_JOBS_IDS.list, "recent-jobs-list");
  assert.equal(RECENT_JOBS_IDS.openButton, "open-query-btn");
  assert.equal(RECENT_JOBS_IDS.searchInput, "library-search-input");
  assert.equal(RECENT_JOBS_TAGS.dialog, "recent-jobs-dialog");
  assert.equal(RECENT_JOBS_TAGS.card, "recent-job-card");
  assert.equal(RECENT_JOBS_SELECTORS.libraryList, "#library-view #recent-jobs-list");
  assert.equal(RECENT_JOBS_PRIVATE_KEYS.select, "__retainPdfRecentJobSelect");
  assert.equal(RECENT_JOBS_PRIVATE_KEYS.cardBound, "__retainPdfRecentJobCardBound");
});

test("recent jobs summary view model owns invocation counts and display text", () => {
  const items = [
    { invocation: { input_protocol: "stage_spec" } },
    { invocation: { input_protocol: "unknown" } },
    { invocation: { input_protocol: "" } },
    {},
  ];

  assert.deepEqual(summarizeRecentJobsInvocationCounts(items), {
    stageSpecCount: 1,
    unknownCount: 3,
  });
  assert.deepEqual(
    buildRecentJobsSummaryViewModel({ stage_spec_count: 7, unknown_count: 2 }, items),
    {
      stageSpecCount: 7,
      unknownCount: 2,
      text: "Stage Spec 7 · Unknown 2",
    },
  );
  assert.deepEqual(
    buildRecentJobsSummaryViewModel({ stage_spec_count: 7, unknown_count: "bad" }, items),
    {
      stageSpecCount: 1,
      unknownCount: 3,
      text: "Stage Spec 1 · Unknown 3",
    },
  );
});

test("home state port updates state and dispatches app events", () => {
  const previousDocument = global.document;
  const previousCustomEvent = global.CustomEvent;
  const events = [];
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  global.document = {
    dispatchEvent(event) {
      events.push(event);
    },
  };

  try {
    const localState = createInitialState();
    const port = createHomeStatePort(localState);
    port.setViewMode("bad-mode");
    assert.equal(port.getSnapshot().viewMode, "library");
    // Di chuyển hoàn tất: store là nguồn chân lý duy nhất, state object cũ không còn được ghi ngược
    assert.equal(localState.homeViewMode, "library");
    assert.equal(events.at(-1).type, APP_EVENTS.homeViewModeChanged);
    assert.deepEqual(events.at(-1).detail, { mode: "library" });

    port.setRecentJobsLoadingState("error", "boom");
    assert.equal(port.getSnapshot().recentJobsLoadingState, "error");
    assert.equal(port.getSnapshot().recentJobsError, "boom");
    assert.equal(events.at(-1).type, APP_EVENTS.homeRecentJobsStateChanged);
    assert.deepEqual(events.at(-1).detail, {
      loadingState: "error",
      error: "boom",
    });
    assert.deepEqual(port.getSnapshot(), {
      viewMode: "library",
      recentJobsLoadingState: "error",
      recentJobsError: "boom",
    });
  } finally {
    global.document = previousDocument;
    global.CustomEvent = previousCustomEvent;
  }
});

test("home state port normalizes initial state and tolerates missing event APIs", () => {
  const localState = {
    homeViewMode: "bad-mode",
    homeRecentJobsLoadingState: "bad-loading",
    homeRecentJobsError: 123,
  };
  const port = createHomeStatePort(localState, {
    eventTarget: {},
  });

  assert.deepEqual(port.getSnapshot(), {
    viewMode: "library",
    recentJobsLoadingState: "idle",
    recentJobsError: "123",
  });
  // 不再回写旧对象:初始值保持调用方传入的原样
  assert.equal(localState.homeViewMode, "bad-mode");
  assert.equal(localState.homeRecentJobsLoadingState, "bad-loading");
  assert.equal(localState.homeRecentJobsError, 123);

  port.setViewMode("workflow_status");
  port.setRecentJobsLoadingState("bad-loading", "boom");

  assert.deepEqual(port.getSnapshot(), {
    viewMode: "workflow_status",
    recentJobsLoadingState: "idle",
    recentJobsError: "boom",
  });
});

test("home state port can dispatch through an injected event target", () => {
  const previousCustomEvent = global.CustomEvent;
  const events = [];
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };

  try {
    const port = createHomeStatePort({}, {
      eventTarget: {
        dispatchEvent(event) {
          events.push(event);
        },
      },
    });

    port.setViewMode("workflow_upload");
    port.setRecentJobsLoadingState("ready");

    assert.deepEqual(events.map((event) => [event.type, event.detail]), [
      [APP_EVENTS.homeViewModeChanged, { mode: "workflow_upload" }],
      [APP_EVENTS.homeRecentJobsStateChanged, {
        loadingState: "ready",
        error: "",
      }],
    ]);
  } finally {
    global.CustomEvent = previousCustomEvent;
  }
});

test("home store owns home state without the legacy global state object", () => {
  const store = createHomeStore({
    homeViewMode: "workflow_upload",
    homeRecentJobsLoadingState: "loading",
  });
  assert.deepEqual(store.getSnapshot(), {
    viewMode: "workflow_upload",
    recentJobsLoadingState: "loading",
    recentJobsError: "",
  });

  store.actions.setViewMode("bad-mode");
  store.actions.setRecentJobsLoadingState("error", "boom");

  assert.deepEqual(store.getSnapshot(), {
    viewMode: "library",
    recentJobsLoadingState: "error",
    recentJobsError: "boom",
  });
});

test("translation workflow dialog state port owns open mode and home view sync", () => {
  const modes = [];
  const port = createTranslationWorkflowDialogStatePort({
    homeStatePort: {
      setViewMode(mode) {
        modes.push(mode);
      },
    },
  });

  assert.deepEqual(port.getSnapshot(), {
    open: false,
    mode: TRANSLATION_WORKFLOW_MODES.UPLOAD,
  });
  assert.equal(
    homeViewModeForTranslationWorkflow(TRANSLATION_WORKFLOW_MODES.STATUS, false),
    "library",
  );

  port.open(TRANSLATION_WORKFLOW_MODES.STATUS);
  assert.deepEqual(port.getSnapshot(), {
    open: true,
    mode: TRANSLATION_WORKFLOW_MODES.STATUS,
  });
  port.setMode(TRANSLATION_WORKFLOW_MODES.UPLOAD);
  port.close();

  assert.deepEqual(modes, ["workflow_status", "workflow_upload", "library"]);
});

test("recent jobs state port normalizes pagination state", () => {
  const localState = createInitialState();
  const port = createRecentJobsStatePort(localState);

  port.setOffset("12");
  port.setHasMore("");
  port.setItems([{ job_id: "job-1" }]);
  assert.deepEqual(port.getSnapshot(), {
    offset: 12,
    hasMore: false,
    invocationSummary: null,
    items: [{ job_id: "job-1" }],
  });

  port.setItems("not-array");
  assert.deepEqual(port.getSnapshot().items, []);

  port.prependItem({ job_id: "job-new" });
  port.prependItem({ job_id: "job-new", title: "duplicate ignored" });
  port.replaceItem({ job_id: "job-new", title: "updated" });
  port.prependItem({ job_id: "job-other-ocr" });
  assert.deepEqual(port.getSnapshot().items, [
    { job_id: "job-other-ocr" },
    { job_id: "job-new", title: "updated" },
  ]);
  port.removeJobFamily("job-other");
  assert.deepEqual(port.getSnapshot().items, [
    { job_id: "job-new", title: "updated" },
  ]);

  port.setItems([{ job_id: "job-keep" }]);
  port.setInvocationSummary({ stage_spec_count: 2 });
  port.setOffset(5);
  port.resetPagination();
  // soft reset：保留 items / summary，只清分页游标
  assert.deepEqual(port.getSnapshot(), {
    offset: 0,
    hasMore: true,
    invocationSummary: { stage_spec_count: 2 },
    items: [{ job_id: "job-keep" }],
  });
});

test("recent jobs state port exposes store subscriptions for card refresh", () => {
  const localState = createInitialState();
  const port = createRecentJobsStatePort(localState);
  const notifications = [];
  const unsubscribe = port.subscribe((snapshot, meta) => {
    notifications.push([meta.action, snapshot.items.map((item) => item.job_id)]);
  });

  port.prependItem({ job_id: "job-live" });
  port.replaceItem({ job_id: "job-live", status: "running" });
  unsubscribe();
  port.replaceItem({ job_id: "job-live", status: "succeeded" });

  assert.deepEqual(notifications, [
    ["prependItem", ["job-live"]],
    ["replaceItem", ["job-live"]],
  ]);
});

test("recent jobs store renderer refreshes visible cards from store mutations", () => {
  const port = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const renders = [];
  const renderer = createRecentJobsStoreRenderer({
    recentJobsStatePort: port,
    renderRecentJobsList: (payload) => {
      renders.push({
        items: payload.items.map((item) => item.job_id),
        invocationSummary: payload.invocationSummary,
        hasMore: payload.hasMore,
        reset: payload.reset,
      });
    },
    actions: {
      selectJob() {},
      deleteJob() {},
      openJobReader() {},
    },
  });

  port.prependItem({ job_id: "job-created" });
  port.replaceItem({ job_id: "job-created", status: "running" });
  port.setHasMore(false);
  renderer.unmount();
  port.replaceItem({ job_id: "job-created", status: "succeeded" });

  assert.deepEqual(renders, [
    { items: ["job-created"], invocationSummary: null, hasMore: true, reset: true },
    { items: ["job-created"], invocationSummary: null, hasMore: true, reset: true },
  ]);
});

test("recent jobs store renderer can opt into page-level store rendering", () => {
  const port = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const renders = [];
  const renderer = createRecentJobsStoreRenderer({
    recentJobsStatePort: port,
    renderActions: ["setItems", "setHasMore"],
    renderRecentJobsList: (payload) => {
      renders.push({
        items: payload.items.map((item) => item.job_id),
        invocationSummary: payload.invocationSummary,
        hasMore: payload.hasMore,
        reset: payload.reset,
      });
    },
  });

  port.setItems([{ job_id: "job-page" }]);
  port.setHasMore(false);
  port.replaceItem({ job_id: "job-page", status: "running" });
  renderer.unmount();

  assert.deepEqual(renders, [
    { items: ["job-page"], invocationSummary: null, hasMore: true, reset: true },
    { items: ["job-page"], invocationSummary: null, hasMore: false, reset: true },
  ]);
});

test("recent jobs state port is backed by the app-framework store without legacy mirror", () => {
  const localState = createInitialState();
  const port = createRecentJobsStatePort(localState);

  assert.equal(port.store.name, "recentJobs");

  port.setItems([{ job_id: "job-store" }]);
  port.setInvocationSummary({ stage_spec_count: 7, unknown_count: 2 });
  port.setOffset(20);
  port.setHasMore(true);

  assert.deepEqual(port.store.getSnapshot(), {
    offset: 20,
    hasMore: true,
    invocationSummary: { stage_spec_count: 7, unknown_count: 2 },
    items: [{ job_id: "job-store" }],
  });
  // 迁移完成:store 是唯一真值,旧 state 对象不再被回写
  assert.equal(localState.recentJobsOffset, 0);
  assert.equal(localState.recentJobsHasMore, true);
  assert.deepEqual(localState.recentJobsItems, []);
});

test("recent jobs state port batches pagination updates into one notification", () => {
  const localState = createInitialState();
  const port = createRecentJobsStatePort(localState);
  const events = [];
  port.store.subscribe((snapshot, meta) => {
    events.push({ snapshot, meta });
  });

  port.batch(({ setOffset, setHasMore, setInvocationSummary, setItems }) => {
    setOffset(10);
    setHasMore(false);
    setInvocationSummary({ stage_spec_count: 1 });
    setItems([{ job_id: "job-batch" }]);
  });

  assert.deepEqual(port.getSnapshot(), {
    offset: 10,
    hasMore: false,
    invocationSummary: { stage_spec_count: 1 },
    items: [{ job_id: "job-batch" }],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].meta.action, "setOffset");
});

test("recent jobs store can be used without the legacy global state object", () => {
  const store = createRecentJobsStore({
    offset: 3,
    hasMore: false,
    items: [{ job_id: "job-initial" }],
  });
  const actions = [];
  store.subscribe((snapshot, meta) => actions.push([meta.action, snapshot.offset]));

  store.actions.setOffset("7");
  store.actions.resetPagination();

  assert.deepEqual(store.getSnapshot(), {
    offset: 0,
    hasMore: true,
    invocationSummary: null,
    items: [{ job_id: "job-initial" }],
  });
  assert.deepEqual(actions, [
    ["setOffset", 7],
    ["resetPagination", 0],
  ]);
});

test("recent jobs library refresh port normalizes app events", () => {
  const listeners = new Map();
  const calls = [];
  const target = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) {
        listeners.delete(type);
      }
    },
  };
  const port = createRecentJobsLibraryRefreshPort({ target });
  const subscription = port.subscribe({
    onRefreshRequested: (detail) => calls.push(["refresh", detail]),
    onJobUpdated: (detail) => calls.push(["updated", detail]),
    onJobCreated: (detail) => calls.push(["created", detail]),
  });

  listeners.get(APP_EVENTS.libraryRefreshRequested)?.({ detail: { delay: "250", force: true } });
  listeners.get(APP_EVENTS.libraryJobUpdated)?.({ detail: { job: { job_id: "job-updated" } } });
  listeners.get(APP_EVENTS.libraryJobCreated)?.({ detail: { job: { job_id: "job-created" } } });

  assert.deepEqual(calls, [
    ["refresh", { delay: 250, force: true }],
    ["updated", { job: { job_id: "job-updated" } }],
    ["created", { job: { job_id: "job-created" } }],
  ]);

  subscription.destroy();
  assert.equal(listeners.size, 0);
});

test("recent jobs command port translates library mutations into app commands", async () => {
  const calls = [];
  const commandHandlers = new Map();
  const commands = {
    on(command, handler) {
      commandHandlers.set(command, handler);
      return () => commandHandlers.delete(command);
    },
    async dispatch(command, payload) {
      calls.push([command, payload]);
      return [await commandHandlers.get(command)?.(payload)];
    },
  };
  const port = createRecentJobsCommandPort({ commands });
  const received = [];
  const subscription = port.subscribe({
    onRefreshRequested: (payload) => received.push(["refresh", payload]),
    onJobUpdated: (payload) => received.push(["updated", payload]),
    onJobCreated: (payload) => received.push(["created", payload]),
  });

  await port.requestRefresh({ delay: "120", force: true });
  await port.publishJobUpdated({ job_id: "job-updated" });
  await port.publishJobCreated({ job_id: "job-created" });

  assert.deepEqual(calls, [
    [RECENT_JOBS_COMMANDS.refreshRequested, { delay: 120, force: true }],
    [RECENT_JOBS_COMMANDS.jobUpdated, { job: { job_id: "job-updated" } }],
    [RECENT_JOBS_COMMANDS.jobCreated, { job: { job_id: "job-created" } }],
  ]);
  assert.deepEqual(received, [
    ["refresh", { delay: 120, force: true }],
    ["updated", { job: { job_id: "job-updated" } }],
    ["created", { job: { job_id: "job-created" } }],
  ]);

  subscription.destroy();
  assert.equal(commandHandlers.size, 0);
});

test("library books resource owns recent jobs page loading and cache keys", async () => {
  const calls = [];
  const resource = createLibraryBooksResource({
    apiPrefix: "/api/v1",
    fetchLibraryBookList: async (apiPrefix, params) => {
      calls.push([apiPrefix, params]);
      return {
        invocation_summary: { total: 3 },
        items: [
          { job_id: "job-existing" },
          { job_id: "job-2" },
          { job_id: "job-3" },
        ],
      };
    },
  });

  const first = await resource.load({
    startOffset: 4,
    pageSize: 2,
    query: "density",
    existingJobIds: new Set(["job-existing"]),
  });
  const second = await resource.load({
    startOffset: 4,
    pageSize: 2,
    query: "density",
    existingJobIds: ["job-existing"],
  });

  assert.equal(first.status, "success");
  assert.deepEqual(first.data.collected.map((item) => item.job_id), ["job-2", "job-3"]);
  assert.deepEqual(first.data.latestInvocationSummary, { total: 3 });
  assert.equal(first.data.nextOffset, 24);
  assert.equal(calls.length, 1);
  assert.equal(second.status, "success");
  assert.deepEqual(second.data.collected.map((item) => item.job_id), ["job-2", "job-3"]);
});

test("recent jobs pagination renders short first library page without waiting for a full page", async () => {
  const calls = [];
  const result = await collectRecentJobsPage({
    apiPrefix: "/api/v1",
    startOffset: 0,
    pageSize: 24,
    fetchLibraryBookList: async (apiPrefix, params) => {
      calls.push([apiPrefix, params]);
      return {
        items: [
          { job_id: "job-short-1", workflow: "book" },
          { job_id: "job-short-2", workflow: "book" },
          { job_id: "job-short-3", workflow: "book" },
        ],
      };
    },
  });

  assert.deepEqual(result.collected.map((item) => item.job_id), [
    "job-short-1",
    "job-short-2",
    "job-short-3",
  ]);
  assert.equal(result.hasMore, false);
  assert.equal(result.nextOffset, 24);
  assert.equal(calls.length, 1);
});

test("recent jobs pagination prefers the documented jobs list over legacy library books", async () => {
  const calls = [];
  const result = await collectRecentJobsPage({
    apiPrefix: "/api/v1",
    startOffset: 0,
    pageSize: 24,
    fetchJobList: async (apiPrefix, params) => {
      calls.push(["jobs", apiPrefix, params]);
      return {
        items: [
          { job_id: "job-list-1", workflow: "book" },
          { job_id: "job-list-1-ocr", workflow: "ocr" },
          { job_id: "job-list-2", workflow: "book" },
        ],
        has_more: false,
      };
    },
    fetchLibraryBookList: async () => {
      calls.push(["library"]);
      return { items: [{ job_id: "legacy-library-book" }] };
    },
  });

  assert.deepEqual(result.collected.map((item) => item.job_id), ["job-list-1", "job-list-2"]);
  assert.equal(result.hasMore, false);
  assert.deepEqual(calls, [
    ["jobs", "/api/v1", { limit: 24, offset: 0, q: "" }],
  ]);
});

test("library books resource falls back to jobs list when library API is unavailable", async () => {
  const calls = [];
  const resource = createLibraryBooksResource({
    apiPrefix: "/api/v1",
    fetchJobList: async (apiPrefix, params) => {
      calls.push([apiPrefix, params]);
      return {
        items: [{ job_id: "job-fallback", workflow: "book" }],
      };
    },
  });

  const snapshot = await resource.load({
    startOffset: 0,
    pageSize: 1,
    query: "",
  });

  assert.equal(snapshot.status, "success");
  assert.deepEqual(snapshot.data.collected.map((item) => item.job_id), ["job-fallback"]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["/api/v1", { limit: 20, offset: 0, q: "" }]);
});

test("library books resource invalidation clears cached list pages", async () => {
  let version = 0;
  const resource = createLibraryBooksResource({
    apiPrefix: "/api/v1",
    fetchLibraryBookList: async () => {
      version += 1;
      return {
        items: [{ job_id: `job-${version}` }],
      };
    },
  });

  const first = await resource.load({ startOffset: 0, pageSize: 1 });
  const cached = await resource.load({ startOffset: 0, pageSize: 1 });
  invalidateLibraryBooksResource(resource);
  const refreshed = await resource.load({ startOffset: 0, pageSize: 1 });

  assert.deepEqual(first.data.collected.map((item) => item.job_id), ["job-1"]);
  assert.deepEqual(cached.data.collected.map((item) => item.job_id), ["job-1"]);
  assert.deepEqual(refreshed.data.collected.map((item) => item.job_id), ["job-2"]);
});

test("library books resource invalidation helper tolerates missing resources", () => {
  assert.doesNotThrow(() => invalidateLibraryBooksResource(null));
  assert.doesNotThrow(() => invalidateLibraryBooksResource({}));
});

test("recent jobs page commit refreshes active cards without auto-opening jobs", () => {
// viewPort ghi trực tiếp DOM cũ (giá trị mặc định createRecentJobsViewPort()) đã bị xóa trong cutover
// (5 tham số mặc định trong controller/runtime/loader/commit/bindings được chuyển thành bắt buộc; các lớp view như view.js
// cũng bị xóa về mặt vật lý). Ở đây dùng stub tối thiểu để trực tiếp bắt items của renderList,
// không mô phỏng document/fragment — ý định xác nhận không đổi (những job id nào được render).
  const rendered = [];
  const recovered = [];
  const refreshCalls = [];
  const autoLoads = [];
  const viewPort = {
    renderList: ({ items }) => {
      rendered.push(...items.map((item) => item.job_id));
    },
  };

  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  });
  const runtimePatches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => false,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
  });

  const result = commitRecentJobsPage({
    reset: true,
    collected: [{ job_id: "job-running", status: "running" }],
    hasMore: true,
    nextOffset: 24,
    recentJobActions: {
      recoverActiveJob: (items) => recovered.push(items.map((item) => item.job_id)),
      selectJob() {},
      deleteJob() {},
      openJobReader() {},
    },
    runtimePatches,
    activeRefreshLoop: () => ({
      schedule: () => refreshCalls.push("schedule"),
      stop: () => refreshCalls.push("stop"),
    }),
    scheduleAutoLoadIfNeeded: () => autoLoads.push("auto"),
    recentJobsStatePort: statePort,
    setTimeoutFn(callback) {
      callback();
      return 1;
    },
    viewPort,
  });

  assert.deepEqual(result.nextItems.map((item) => item.job_id), ["job-running"]);
  assert.deepEqual(rendered, ["job-running"]);
  assert.deepEqual(recovered, []);
  assert.deepEqual(refreshCalls, ["schedule"]);
  assert.deepEqual(autoLoads, ["auto"]);
  assert.equal(statePort.getSnapshot().offset, 24);
});

test("recent jobs page commit can delegate page rendering to the store renderer", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  });
  const storeRenders = [];
  const renderer = createRecentJobsStoreRenderer({
    recentJobsStatePort: statePort,
    renderActions: ["setOffset"],
    renderRecentJobsList: (payload) => {
      storeRenders.push({
        items: payload.items.map((item) => item.job_id),
        invocationSummary: payload.invocationSummary,
        hasMore: payload.hasMore,
      });
    },
  });
  const runtimePatches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => false,
    renderCurrentRecentJobs() {
      throw new Error("commit should not use runtime rerender in store-driven mode");
    },
    scheduleActiveRefresh() {},
    storeDrivenRendering: true,
  });
  const recentJobActions = {
    recoverActiveJob() {},
    selectJob() {},
    deleteJob() {},
    openJobReader() {},
  };

  try {
    const result = commitRecentJobsPage({
      reset: true,
      collected: [{ job_id: "job-store-rendered", status: "succeeded" }],
      hasMore: false,
      invocationSummary: { stage_spec_count: 7, unknown_count: 2 },
      nextOffset: 10,
      recentJobActions,
      runtimePatches,
      activeRefreshLoop: () => ({
        schedule() {},
        stop() {},
      }),
      scheduleAutoLoadIfNeeded() {},
      recentJobsStatePort: statePort,
      storeDrivenRendering: true,
    });

    assert.deepEqual(result.nextItems.map((item) => item.job_id), ["job-store-rendered"]);
    assert.deepEqual(storeRenders, [
      {
        items: ["job-store-rendered"],
        invocationSummary: { stage_spec_count: 7, unknown_count: 2 },
        hasMore: false,
      },
    ]);
  } finally {
    renderer.unmount();
  }
});

test("recent jobs page commit can route rendering through the view port", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  });
  const rendered = [];
  const result = commitRecentJobsPage({
    reset: true,
    collected: [{ job_id: "job-view-port-commit", status: "succeeded" }],
    hasMore: false,
    nextOffset: 10,
    recentJobActions: {
      recoverActiveJob() {},
      selectJob() {},
      deleteJob() {},
      openJobReader() {},
    },
    runtimePatches: createRecentJobsRuntimePatches({
      statePort,
      replaceRecentJobCard: () => false,
      renderCurrentRecentJobs() {},
      scheduleActiveRefresh() {},
    }),
    activeRefreshLoop: () => ({
      schedule() {},
      stop() {},
    }),
    scheduleAutoLoadIfNeeded() {},
    recentJobsStatePort: statePort,
    viewPort: {
      renderList(payload) {
        rendered.push(payload.items.map((item) => item.job_id));
      },
    },
  });

  assert.deepEqual(result.nextItems.map((item) => item.job_id), ["job-view-port-commit"]);
  assert.deepEqual(rendered, [["job-view-port-commit"]]);
});

test("recent jobs page commit appends only collected items while preserving state patches", () => {
  // viewPort ghi trực tiếp DOM cũ đã bị xóa trong cutover, dùng stub tối thiểu để bắt items render.
  const rendered = [];
  const viewPort = {
    renderList: ({ items }) => {
      rendered.push(...items.map((item) => item.job_id));
    },
  };

  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 24,
    recentJobsHasMore: true,
    recentJobsItems: [
      { job_id: "job-created-active", status: "running" },
      { job_id: "job-existing", status: "succeeded" },
    ],
  });
  const runtimePatches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => false,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
  });
  runtimePatches.insert({
    job_id: "job-created-active",
    status: "running",
    display_stage: "ocr",
    progress: { current: 1, total: 10, unit: "page" },
  });

  const result = commitRecentJobsPage({
    reset: false,
    collected: [{ job_id: "job-page-2", status: "succeeded" }],
    hasMore: false,
    nextOffset: 48,
    recentJobActions: {
      recoverActiveJob() {},
      selectJob() {},
      deleteJob() {},
      openJobReader() {},
    },
    runtimePatches,
    activeRefreshLoop: () => ({
      schedule() {},
      stop() {},
    }),
    scheduleAutoLoadIfNeeded() {},
    recentJobsStatePort: statePort,
    viewPort,
  });

  assert.deepEqual(rendered, ["job-page-2"]);
  assert.deepEqual(result.nextItems.map((item) => item.job_id), [
    "job-created-active",
    "job-existing",
    "job-page-2",
  ]);
  assert.deepEqual(result.renderItems.map((item) => item.job_id), ["job-page-2"]);
});

test("recent jobs empty commit owns empty state and search copy", () => {
  // 旧 DOM 直写 viewPort 已随 cutover 删除,改用最小 stub 直接捕获 renderEmpty。
  const loadingStates = [];
  let emptyText = "";
  const viewPort = {
    renderEmpty: (message) => {
      emptyText = message;
    },
  };
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [{ job_id: "old" }],
    recentJobsHasMore: true,
  });

  const result = commitRecentJobsEmpty({
    query: "quantum",
    invocationSummary: null,
    homeStatePort: {
      setRecentJobsLoadingState: (...args) => loadingStates.push(args),
    },
    recentJobsStatePort: statePort,
    viewPort,
  });

  assert.equal(result.message, "Không có sách phù hợp");
  assert.deepEqual(statePort.getSnapshot().items, []);
  assert.equal(statePort.getSnapshot().hasMore, false);
  assert.equal(emptyText, "Không có sách phù hợp");
  assert.deepEqual(loadingStates, [["ready"]]);
});

test("recent jobs empty commit can delegate rendering to view-state owner", () => {
  const loadingStates = [];
  const renders = [];
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [{ job_id: "old" }],
    recentJobsHasMore: true,
  });

  const result = commitRecentJobsEmpty({
    query: "",
    invocationSummary: null,
    homeStatePort: {
      setRecentJobsLoadingState: (...args) => loadingStates.push(args),
    },
    recentJobsStatePort: statePort,
    storeDrivenRendering: true,
    renderEmpty: (...args) => renders.push(args),
  });

  assert.equal(result.message, "暂无最近任务");
  assert.deepEqual(statePort.getSnapshot().items, []);
  assert.equal(statePort.getSnapshot().hasMore, false);
  assert.deepEqual(loadingStates, [["ready"]]);
  assert.deepEqual(renders, []);
});

test("recent jobs no-more and error commits own terminal loading state", () => {
  // 旧 DOM 直写 viewPort 已随 cutover 删除,改用最小 stub 直接捕获 renderError。
  const loadingStates = [];
  const renderErrorCalls = [];
  const viewPort = {
    renderError: (...args) => renderErrorCalls.push(args),
  };
  const statePort = createRecentJobsStatePort({
    recentJobsHasMore: true,
    recentJobsItems: [{ job_id: "job-existing" }],
  });
  const homeStatePort = {
    setRecentJobsLoadingState: (...args) => loadingStates.push(args),
  };

  commitRecentJobsNoMore({
    homeStatePort,
    recentJobsStatePort: statePort,
    viewPort,
  });
  assert.equal(statePort.getSnapshot().hasMore, false);
  assert.deepEqual(loadingStates, [["ready"]]);
  assert.deepEqual(renderErrorCalls, [["", { reset: false }]]);

  commitRecentJobsError({
    error: new Error("network down"),
    reset: false,
    homeStatePort,
    recentJobsStatePort: statePort,
    viewPort,
  });
  assert.deepEqual(loadingStates.at(-1), ["error", "network down"]);
});

test("recent jobs no-more and error commits can delegate rendering", () => {
  const loadingStates = [];
  const renders = [];
  const statePort = createRecentJobsStatePort({
    recentJobsHasMore: true,
    recentJobsItems: [{ job_id: "job-existing" }],
  });
  const homeStatePort = {
    setRecentJobsLoadingState: (...args) => loadingStates.push(args),
  };

  commitRecentJobsNoMore({
    homeStatePort,
    recentJobsStatePort: statePort,
    storeDrivenRendering: true,
    renderError: (...args) => renders.push(args),
  });

  commitRecentJobsError({
    error: new Error("network down"),
    reset: false,
    homeStatePort,
    recentJobsStatePort: statePort,
    storeDrivenRendering: true,
    renderError: (...args) => renders.push(args),
  });

  assert.equal(statePort.getSnapshot().hasMore, false);
  assert.deepEqual(loadingStates, [
    ["ready"],
    ["error", "network down"],
  ]);
  assert.deepEqual(renders, []);
});

test("recent jobs loader preserves runtime patches that arrive during load-more", async () => {
  // 旧 DOM 直写 viewPort 已随 cutover 删除,改用最小 stub(loader.js 只依赖
  // hasView/renderLoading/setLoadMoreLoading,渲染结果走下方 items 断言)。
  const viewPort = {
    hasView: () => true,
    renderLoading() {},
    setLoadMoreLoading() {},
    renderList() {},
    renderEmpty() {},
    renderError() {},
  };

  let resolveLoad;
  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 24,
    recentJobsHasMore: true,
    recentJobsItems: [{ job_id: "job-existing", status: "succeeded" }],
  });
  const runtimePatches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => false,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
  });
  const loader = createRecentJobsLoader({
    apiPrefix: "/api/v1",
    fetchJobList: async () => ({ items: [] }),
    getQuery: () => "",
    recentJobActions: {
      recoverActiveJob() {},
      selectJob() {},
      deleteJob() {},
      openJobReader() {},
    },
    runtimePatches,
    activeRefreshLoop: () => ({ schedule() {}, stop() {} }),
    scheduleAutoLoadIfNeeded() {},
    homeStatePort: {
      setRecentJobsLoadingState() {},
    },
    recentJobsStatePort: statePort,
    libraryBooksResource: {
      async load() {
        await new Promise((resolve) => {
          resolveLoad = resolve;
        });
        return {
          status: "success",
          data: {
            collected: [{ job_id: "job-page-2", status: "succeeded" }],
            hasMore: false,
            latestInvocationSummary: null,
            nextOffset: 48,
          },
        };
      },
    },
    viewPort,
  });

  const loadPromise = loader.load({ reset: false });
  await new Promise((resolve) => setImmediate(resolve));
  runtimePatches.insert({
    job_id: "job-created-during-load",
    status: "running",
    display_stage: "ocr",
    progress: { current: 1, total: 10, unit: "page" },
  });
  resolveLoad();
  await loadPromise;

  assert.deepEqual(statePort.getSnapshot().items.map((item) => item.job_id), [
    "job-created-during-load",
    "job-existing",
    "job-page-2",
  ]);
});

test("recent jobs loader does not append runtime-created cards during load-more rendering", async () => {
  // viewPort ghi trực tiếp DOM cũ đã bị xóa trong cutover, dùng stub tối thiểu để bắt renderList.
  const rendered = [];
  const viewPort = {
    hasView: () => true,
    renderLoading() {},
    setLoadMoreLoading() {},
    renderList: ({ items }) => {
      rendered.push(...items.map((item) => item.job_id));
    },
    renderEmpty() {},
    renderError() {},
  };

  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 24,
    recentJobsHasMore: true,
    recentJobsItems: [
      { job_id: "job-created-active", status: "running" },
      { job_id: "job-existing", status: "succeeded" },
    ],
  });
  const runtimePatches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => false,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
  });
  runtimePatches.insert({
    job_id: "job-created-active",
    status: "running",
    display_stage: "ocr",
    progress: { current: 1, total: 10, unit: "page" },
  });
  rendered.length = 0;

  const loader = createRecentJobsLoader({
    apiPrefix: "/api/v1",
    fetchJobList: async () => ({ items: [] }),
    getQuery: () => "",
    recentJobActions: {
      recoverActiveJob() {},
      selectJob() {},
      deleteJob() {},
      openJobReader() {},
    },
    runtimePatches,
    activeRefreshLoop: () => ({ schedule() {}, stop() {} }),
    scheduleAutoLoadIfNeeded() {},
    homeStatePort: {
      setRecentJobsLoadingState() {},
    },
    recentJobsStatePort: statePort,
    libraryBooksResource: {
      async load() {
        return {
          status: "success",
          data: {
            collected: [{ job_id: "job-page-2", status: "succeeded" }],
            hasMore: false,
            latestInvocationSummary: null,
            nextOffset: 48,
          },
        };
      },
    },
    viewPort,
  });

  await loader.load({ reset: false });

  assert.deepEqual(rendered, ["job-page-2"]);
  assert.deepEqual(statePort.getSnapshot().items.map((item) => item.job_id), [
    "job-created-active",
    "job-existing",
    "job-page-2",
  ]);
});

test("recent jobs command handlers invalidate list resource before patching and refreshing", async () => {
  const handlers = {};
  const invalidations = [];
  const updates = [];
  const inserts = [];
  const refreshes = [];
  const fetches = [];
  const subscription = bindRecentJobsCommandHandlers({
    apiPrefix: "/api",
    commandPort: {
      subscribe(nextHandlers) {
        Object.assign(handlers, nextHandlers);
        return { destroy() {} };
      },
    },
    fetchJobPayload: async (jobId, apiPrefix) => {
      fetches.push([jobId, apiPrefix]);
      return { job_id: jobId, status: "running", hydrated: true };
    },
    libraryBooksResource: {
      invalidate: () => invalidations.push("invalidate"),
    },
    runtimePatches: {
      update: (job) => updates.push(job.job_id),
      insert: (job) => inserts.push(job.job_id),
    },
    refreshScheduler: {
      scheduleRefresh: (options) => refreshes.push(options),
    },
  });

  handlers.onRefreshRequested({ delay: 50, force: true });
  // 运行中补丁：只 update 单卡，不整页 refresh（避免轮询期间主页闪烁）
  handlers.onJobUpdated({ job: { job_id: "job-updated", status: "running" } });
  handlers.onJobCreated({ job: { job_id: "job-created" } });
  // 终态才触发整页 scheduleRefresh
  handlers.onJobUpdated({ job: { job_id: "job-done", status: "succeeded" } });
  await Promise.resolve();
  subscription.destroy();

  // running update 不 invalidate；refresh / create / 终态 update 各一次
  assert.deepEqual(invalidations, ["invalidate", "invalidate", "invalidate"]);
  assert.deepEqual(fetches, [["job-created", "/api"]]);
  // hydrateCreatedRecentJob 异步补丁 job-created，可能排在终态 update 之后
  assert.deepEqual(updates, ["job-updated", "job-done", "job-created"]);
  assert.deepEqual(inserts, ["job-created"]);
  // onJobCreated 不再 force 整页 refresh；仅 onRefreshRequested + 终态 update
  assert.deepEqual(refreshes, [
    { delay: 50, force: true },
    { delay: 400, bypassThrottle: true },
  ]);
});

test("recent jobs command update refreshes the current card without opening detail", async () => {
  const handlers = {};
  const renders = [];
  const opened = [];
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "job-current",
        status: "running",
        display_stage: "translation",
        progress: { unit: "batch", current: 1, total: 10 },
      },
    ],
    recentJobsHasMore: true,
  });
  const renderer = createRecentJobsStoreRenderer({
    recentJobsStatePort: statePort,
    renderRecentJobsList: (payload) => renders.push(payload.items.map((item) => ({
      job_id: item.job_id,
      status: item.status,
      progress: item.progress,
    }))),
    actions: {
      selectJob: (jobId) => opened.push(["select", jobId]),
      deleteJob() {},
      openJobReader: (jobId) => opened.push(["reader", jobId]),
    },
  });
  const runtimePatches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => false,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
    storeDrivenRendering: true,
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  try {
    bindRecentJobsCommandHandlers({
      apiPrefix: "/api",
      commandPort: {
        subscribe(nextHandlers) {
          Object.assign(handlers, nextHandlers);
          return { destroy() {} };
        },
      },
      fetchJobPayload: async () => {
        throw new Error("updated jobs should not need hydration");
      },
      libraryBooksResource: {
        invalidate() {},
      },
      runtimePatches,
      refreshScheduler: {
        scheduleRefresh() {},
      },
    });

    handlers.onJobUpdated({
      job: {
        job_id: "job-current",
        status: "running",
        display_stage: "translation",
        substage: "translation_batches",
        progress: { unit: "batch", current: 5, total: 10, percent: 50 },
      },
    });

    const updated = statePort.getSnapshot().items[0];
    assert.equal(updated.job_id, "job-current");
    assert.equal(updated.status, "running");
    assert.equal(updated.progress.current, 5);
    assert.equal(updated.progress.total, 10);
    assert.equal(updated.progress.unit, "batch");
    assert.deepEqual(opened, []);
    assert.equal(renders.length, 1);
    assert.equal(renders[0][0].progress.current, 5);
  } finally {
    renderer.unmount();
  }
});

test("recent jobs runtime patches keep newer event progress over older poll snapshots", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "job-monotonic-card",
        status: "running",
        display_stage: "translation",
        substage: "translation_batches",
        progress: { unit: "batch", current: 1, total: 10, percent: 10 },
      },
    ],
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => true,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
    storeDrivenRendering: true,
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.update({
    job_id: "job-monotonic-card",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: { unit: "batch", current: 8, total: 10, percent: 80 },
    stage_snapshot: {
      stageKey: "translate",
      publicStage: "translation",
      source: "display-state",
      lane: "main",
      substage: "translation_batches",
      detail: "正在翻译正文内容",
      progress: { unit: "batch", current: 8, total: 10, percent: 80 },
    },
  });
  patches.update({
    job_id: "job-monotonic-card",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: { unit: "batch", current: 5, total: 10, percent: 50 },
  });

  const item = statePort.getSnapshot().items[0];
  assert.equal(item.progress.current, 8);
  assert.equal(item.progress.percent, 80);
  assert.equal(item.runtime_status.progress.current, 8);
  assert.equal(item.runtime_status.progress.percent, 80);
});

test("recent jobs runtime patches keep newer progress while accepting newer substage text", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "job-monotonic-text",
        status: "running",
        display_stage: "translation",
        substage: "translation_batches",
        progress: { unit: "batch", current: 8, total: 10, percent: 80 },
      },
    ],
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => true,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
    storeDrivenRendering: true,
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.update({
    job_id: "job-monotonic-text",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: { unit: "batch", current: 8, total: 10, percent: 80 },
    stage_snapshot: {
      stageKey: "translate",
      publicStage: "translation",
      source: "display-state",
      lane: "main",
      substage: "translation_batches",
      detail: "正在翻译正文内容",
      progress: { unit: "batch", current: 8, total: 10, percent: 80 },
    },
  });
  patches.update({
    job_id: "job-monotonic-text",
    status: "running",
    display_stage: "translation",
    substage: "garbled_repair",
    stage_detail: "正在修复翻译结果",
    progress: { unit: "batch", current: 5, total: 10, percent: 50 },
    stage_snapshot: {
      stageKey: "translate",
      publicStage: "translation",
      source: "display-state",
      lane: "main",
      substage: "garbled_repair",
      detail: "正在修复翻译结果",
      progress: { unit: "batch", current: 5, total: 10, percent: 50 },
    },
  });

  const item = statePort.getSnapshot().items[0];
  assert.equal(item.progress.current, 8);
  assert.equal(item.progress.percent, 80);
  assert.equal(item.runtime_status.substage, "garbled_repair");
  assert.equal(item.runtime_status.detail, "正在修复乱码候选段");
  assert.equal(item.runtime_status.progress.current, 8);
  assert.equal(item.runtime_status.progress.percent, 80);
});

test("recent jobs runtime patches keep terminal state over stale running snapshots", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "job-terminal-card",
        status: "running",
        display_stage: "translation",
        progress: { unit: "batch", current: 9, total: 10, percent: 90 },
      },
    ],
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => true,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
    storeDrivenRendering: true,
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.update({
    job_id: "job-terminal-card",
    status: "succeeded",
    display_stage: "done",
    progress: { unit: "batch", current: 10, total: 10, percent: 100 },
  });
  patches.update({
    job_id: "job-terminal-card",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: { unit: "batch", current: 9, total: 10, percent: 90 },
  });

  const item = statePort.getSnapshot().items[0];
  assert.equal(item.status, "succeeded");
  assert.equal(item.display_stage, "done");
  assert.equal(item.progress.percent, 100);
  assert.equal(item.runtime_status.stageKey, "done");
});

test("recent jobs runtime patches accept new job_id retry after terminal (home card leaves 已翻译)", () => {
  // 回归：完成后再「重新 OCR」换了 job_id 时，旧终态补丁不得盖住新 running，
  // 否则主页卡一直显示「已翻译」、封面不转圈。
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "job-done",
        document_id: "doc-attention",
        title: "Attention Is All You Need",
        cover_url: "mock://document-cover.png",
        status: "succeeded",
        display_stage: "done",
      },
    ],
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => true,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
    storeDrivenRendering: true,
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.update({
    job_id: "job-done",
    document_id: "doc-attention",
    title: "Attention Is All You Need",
    cover_url: "mock://document-cover.png",
    status: "succeeded",
    display_stage: "done",
  });
  patches.update({
    job_id: "job-retry-ocr",
    source_job_id: "job-done",
    document_id: "doc-attention",
    title: "Attention Is All You Need",
    cover_url: "mock://document-cover.png",
    status: "running",
    display_stage: "ocr",
    stage: "ocr_processing",
  });

  const items = statePort.getSnapshot().items;
  assert.equal(items.length, 1, "must update in place, not insert a second card");
  const item = items[0];
  assert.equal(item.job_id, "job-retry-ocr");
  assert.equal(item.document_id, "doc-attention");
  assert.equal(item.status, "running");
  assert.equal(item.display_stage, "ocr");
  assert.equal(item.title, "Attention Is All You Need");
  assert.equal(item.cover_url, "mock://document-cover.png");
});

test("recent jobs runtime patches do not prepend retry job_id shell after soft refresh", () => {
  // 回归（真实后端）：「重新渲染」换新 job_id，payload 常只有 job_id 当标题；
  // soft refresh 不得再 prepend 一张「job_id + PDF 占位」空壳（原书还在）。
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "20260717220928-50d025",
        document_id: "doc-multipole",
        title: "multipole-expansion-of-atomic.pdf",
        cover_url: "http://example/cover.jpg",
        page_count: 14,
        status: "succeeded",
        display_stage: "done",
      },
    ],
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => true,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
    storeDrivenRendering: true,
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.update({
    job_id: "20260717220928-50d025",
    status: "succeeded",
    display_stage: "done",
  });
  // 真实重试首帧：无 document_id、title=新 job_id
  patches.update({
    job_id: "20260717235341-af4675",
    source_job_id: "20260717220928-50d025",
    title: "20260717235341-af4675",
    status: "running",
    display_stage: "render",
  });

  assert.equal(statePort.getSnapshot().items.length, 1);
  assert.equal(statePort.getSnapshot().items[0].job_id, "20260717235341-af4675");
  assert.equal(statePort.getSnapshot().items[0].title, "multipole-expansion-of-atomic.pdf");
  assert.equal(statePort.getSnapshot().items[0].status, "running");

  const afterRefresh = patches.apply([
    {
      job_id: "20260717220928-50d025",
      document_id: "doc-multipole",
      title: "multipole-expansion-of-atomic.pdf",
      cover_url: "http://example/cover.jpg",
      page_count: 14,
      status: "succeeded",
      display_stage: "done",
    },
  ]);
  assert.equal(afterRefresh.length, 1, "must not prepend orphan shell");
  assert.equal(afterRefresh[0].title, "multipole-expansion-of-atomic.pdf");
  assert.notEqual(afterRefresh[0].title, afterRefresh[0].job_id);
});

test("created recent job hydration fetches full payload and patches the card", async () => {
  const updates = [];
  const payload = await hydrateCreatedRecentJob({
    job: { job_id: "job-created" },
    apiPrefix: "/api",
    fetchJobPayload: async (jobId, apiPrefix) => ({
      job_id: jobId,
      apiPrefix,
      cover_url: `/api/v1/jobs/${jobId}/cover`,
      progress: { current: 1, total: 9 },
    }),
    runtimePatches: {
      update: (job) => updates.push(job),
    },
  });

  assert.equal(payload.job_id, "job-created");
  assert.equal(payload.apiPrefix, "/api");
  assert.deepEqual(updates, [payload]);
});

test("created recent job hydration is best effort", async () => {
  const updates = [];
  const payload = await hydrateCreatedRecentJob({
    job: { job_id: "job-created" },
    fetchJobPayload: async () => {
      throw new Error("not ready");
    },
    runtimePatches: {
      update: (job) => updates.push(job),
    },
  });

  assert.equal(payload, null);
  assert.deepEqual(updates, []);
});

test("recent jobs feature bindings route ui library and workflow events", () => {
  // 旧 DOM 直写 viewPort 已随 cutover 删除,bindEvents 的 handlers 直接从
  // viewPort stub 捕获调用,不再模拟 #load-more-jobs-btn 的 click 事件。
  const listeners = new Map();
  const loadCalls = [];
  const commandCalls = [];
  const schedulerCalls = [];
  let viewPortHandlers = null;
  const viewPort = {
    bindEvents(handlers) {
      viewPortHandlers = handlers;
    },
  };
  const doc = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };
  const commandPort = {
    subscribe(handlers) {
      this.handlers = handlers;
      return { destroy() {} };
    },
    requestRefresh: (detail) => commandCalls.push(["refresh", detail]),
    publishJobUpdated: (job) => commandCalls.push(["updated", job]),
    publishJobCreated: (job) => commandCalls.push(["created", job]),
  };
  const libraryRefreshPort = {
    subscribe(handlers) {
      this.handlers = handlers;
      return { destroy() {} };
    },
  };
  const refreshScheduler = {
    openDialog() {},
    scheduleRefresh: (options) => schedulerCalls.push(["schedule", options]),
    setSuspended: (value) => schedulerCalls.push(["suspended", value]),
    isSuspended: () => false,
    updateSearch() {},
  };

  bindRecentJobsFeatureEvents({
    commandPort,
    doc,
    libraryBooksResource: {},
    libraryRefreshPort,
    refreshScheduler,
    runtime: {
      loadRecentJobs: (options) => loadCalls.push(options),
      runtimePatches: {
        insert() {},
        update() {},
      },
    },
    viewPort,
  });

  viewPortHandlers.onLoadMore();
  libraryRefreshPort.handlers.onRefreshRequested({ delay: 80, force: true });
  libraryRefreshPort.handlers.onJobUpdated({ job: { job_id: "job-updated" } });
  libraryRefreshPort.handlers.onJobCreated({ job: { job_id: "job-created" } });
  listeners.get(APP_EVENTS.statusAreaVisibilityChanged)();
  listeners.get(APP_EVENTS.openTranslationWorkflow)();
  listeners.get(APP_EVENTS.closeTranslationWorkflow)();

  assert.deepEqual(loadCalls, [{ reset: false }]);
  assert.deepEqual(commandCalls, [
    ["refresh", { delay: 80, force: true }],
    ["updated", { job_id: "job-updated" }],
    ["created", { job_id: "job-created" }],
  ]);
  assert.deepEqual(schedulerCalls, [
    ["suspended", false],
    ["suspended", true],
    ["suspended", false],
    ["schedule", { delay: 300, bypassThrottle: true }],
  ]);
});

test("shared library event port publishes and normalizes app events", () => {
  const previousCustomEvent = global.CustomEvent;
  const listeners = new Map();
  const dispatched = [];
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  const target = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) {
        listeners.delete(type);
      }
    },
    dispatchEvent(event) {
      dispatched.push(event);
      listeners.get(event.type)?.(event);
    },
  };

  try {
    const calls = [];
    const port = createLibraryEventPort({ target });
    const subscription = port.subscribe({
      onRefreshRequested: (detail) => calls.push(["refresh", detail]),
      onJobUpdated: (detail) => calls.push(["updated", detail]),
      onJobCreated: (detail) => calls.push(["created", detail]),
    });

    port.requestRefresh({ delay: "350", force: true });
    port.publishJobUpdated({ job_id: "job-updated" });
    port.publishJobCreated({ job_id: "job-created" });
    port.publishJobUpdated(null);

    assert.deepEqual(dispatched.map((event) => event.type), [
      APP_EVENTS.libraryRefreshRequested,
      APP_EVENTS.libraryJobUpdated,
      APP_EVENTS.libraryJobCreated,
    ]);
    assert.deepEqual(calls, [
      ["refresh", { delay: 350, force: true }],
      ["updated", { job: { job_id: "job-updated" } }],
      ["created", { job: { job_id: "job-created" } }],
    ]);

    subscription.destroy();
    assert.equal(listeners.size, 0);
  } finally {
    global.CustomEvent = previousCustomEvent;
  }
});

test("shared library refresh helper throttles non-terminal refreshes", () => {
  const previousCustomEvent = global.CustomEvent;
  const previousDateNow = Date.now;
  const dispatched = [];
  let now = 1000;
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  Date.now = () => now;
  const port = createLibraryEventPort({
    target: {
      dispatchEvent(event) {
        dispatched.push(event);
      },
      addEventListener() {},
      removeEventListener() {},
    },
  });
  const state = { lastLibraryRefreshRequestedAt: 0 };

  try {
    assert.equal(requestThrottledLibraryRefresh(state, { port }), true);
    assert.equal(requestThrottledLibraryRefresh(state, { port }), false);
    now += 4000;
    assert.equal(requestThrottledLibraryRefresh(state, { port }), true);
    assert.equal(requestThrottledLibraryRefresh(state, { port, terminal: true }), true);
    assert.deepEqual(dispatched.map((event) => event.detail), [
      { delay: 800, force: false },
      { delay: 800, force: false },
      { delay: 200, force: false },
    ]);
  } finally {
    Date.now = previousDateNow;
    global.CustomEvent = previousCustomEvent;
  }
});

test("recent jobs runtime port normalizes active job commands", () => {
  const opened = [];
  let current = " job-current ";
  const port = createRecentJobsRuntimePort({
    openJob: (jobId) => opened.push(jobId),
    currentJobId: () => current,
  });

  assert.equal(port.currentJobId(), "job-current");
  assert.equal(port.openJob(" job-1 "), true);
  assert.equal(port.openJob(""), false);
  assert.deepEqual(opened, ["job-1"]);

  current = "";
  assert.equal(port.currentJobId(), "");
});

test("recent jobs reader port normalizes reader commands", () => {
  const opened = [];
  const port = createRecentJobsReaderPort({
    openReader: (jobId) => opened.push(jobId),
  });

  assert.equal(port.openReader(" job-reader "), true);
  assert.equal(port.openReader(""), false);
  assert.deepEqual(opened, ["job-reader"]);
});

test("recent jobs navigation port owns workflow reader and recovery side effects", () => {
  const previousCustomEvent = global.CustomEvent;
  const dispatched = [];
  const closed = [];
  const opened = [];
  const read = [];
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  const doc = {
    dispatchEvent(event) {
      dispatched.push(event.type);
    },
  };
  try {
    const port = createRecentJobsNavigationPort({
      closeDialog: () => closed.push("close"),
      doc,
      jobRuntimePort: {
        currentJobId: () => "job-current",
        openJob: (jobId) => {
          opened.push(jobId);
          return true;
        },
      },
      readerPort: {
        openReader: (jobId) => {
          read.push(jobId);
          return true;
        },
      },
    });

    assert.equal(port.currentJobId(), "job-current");
    assert.equal(port.openJob(" job-open "), true);
    assert.equal(port.openReader(" job-reader "), true);
    assert.equal(port.recoverJob(" job-recover "), true);
    assert.equal(port.openJob(""), false);
    assert.deepEqual(closed, ["close", "close"]);
    // 默认 openWorkflowOnSelect=false：网格选任务不弹旧工作流窗
    assert.deepEqual(dispatched, []);
    assert.deepEqual(opened, ["job-open", "job-recover"]);
    assert.deepEqual(read, ["job-reader"]);

    const legacy = createRecentJobsNavigationPort({
      doc,
      openWorkflowOnSelect: true,
      jobRuntimePort: { openJob: () => true, currentJobId: () => "" },
    });
    legacy.openJob("job-legacy");
    assert.deepEqual(dispatched, [APP_EVENTS.openTranslationWorkflow]);
  } finally {
    global.CustomEvent = previousCustomEvent;
  }
});

test("recent jobs runtime wires loader actions and scheduler callbacks", async () => {
  const previousDocument = global.document;
  const previousCustomEvent = global.CustomEvent;
  const dispatched = [];
  // 旧 DOM 直写 viewPort 已随 cutover 删除,改用最小 stub(满足 10 方法契约,
  // 见 src/pages/home/features/library/recent-jobs-react-port.js 的 React 实现)。
  const viewPort = {
    bindEvents() {},
    hasView: () => true,
    renderEmpty() {},
    renderError() {},
    renderList() {},
    renderLoading() {},
    replaceCard: () => true,
    scheduleAutoLoadCheck() {},
    setDialogOpen() {},
    setLoadMoreLoading() {},
  };
  global.document = {
    dispatchEvent(event) {
      dispatched.push(event);
    },
  };
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };

  const loadParams = [];
  const closed = [];
  const opened = [];
  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  });
  let scheduler = null;
  const runtime = createRecentJobsRuntime({
    fetchJobList: async () => ({ items: [] }),
    fetchJobPayload: async () => ({}),
    fetchLibraryBookList: async () => ({ items: [] }),
    deleteLibraryBook: async () => ({}),
    apiPrefix: "/api/v1",
    currentJobId: () => "",
    jobRuntimePort: {
      openJob: (jobId) => opened.push(jobId),
    },
    readerPort: {
      openReader() {},
    },
    homeStatePort: {
      setRecentJobsLoadingState() {},
    },
    recentJobsStatePort: statePort,
    libraryBooksResource: {
      async load(params) {
        loadParams.push(params);
        return {
          status: "success",
          data: {
            collected: [{ job_id: "job-runtime", status: "succeeded" }],
            hasMore: false,
            latestInvocationSummary: null,
            nextOffset: 24,
          },
        };
      },
    },
    refreshSchedulerRef: () => scheduler,
    viewPort,
  });
  scheduler = {
    closeDialog: () => closed.push("close"),
    getQuery: () => "search-term",
    scheduleAutoLoadIfNeeded() {},
  };

  try {
    await runtime.loadRecentJobs({ reset: true });
    runtime.recentJobActions.selectJob("job-runtime");

    assert.equal(loadParams[0].query, "search-term");
    assert.deepEqual(statePort.getSnapshot().items.map((item) => item.job_id), ["job-runtime"]);
    assert.deepEqual(closed, ["close"]);
    assert.deepEqual(opened, ["job-runtime"]);
    // 进度改在书籍详情 Tab：selectJob 默认不弹 translation-workflow-dialog
    assert.deepEqual(dispatched.map((event) => event.type), []);
  } finally {
    global.document = previousDocument;
    global.CustomEvent = previousCustomEvent;
  }
});

test("recent jobs runtime routes list rendering through the view port", async () => {
  const rendered = [];
  const replaced = [];
  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  });
  let scheduler = null;
  const runtime = createRecentJobsRuntime({
    fetchJobList: async () => ({ items: [] }),
    fetchJobPayload: async () => ({}),
    fetchLibraryBookList: async () => ({ items: [] }),
    deleteLibraryBook: async () => ({}),
    apiPrefix: "/api/v1",
    currentJobId: () => "",
    jobRuntimePort: {
      openJob() {},
    },
    readerPort: {
      openReader() {},
    },
    homeStatePort: {
      setRecentJobsLoadingState() {},
    },
    recentJobsStatePort: statePort,
    libraryBooksResource: {
      async load() {
        return {
          status: "success",
          data: {
            collected: [{ job_id: "job-view-port", status: "running" }],
            hasMore: false,
            latestInvocationSummary: null,
            nextOffset: 10,
          },
        };
      },
    },
    refreshSchedulerRef: () => scheduler,
    viewPort: {
      hasView: () => true,
      renderEmpty() {},
      renderError(message) {
        throw new Error(`unexpected recent jobs error render: ${message}`);
      },
      renderList(payload) {
        rendered.push(payload.items.map((item) => item.job_id));
      },
      renderLoading() {},
      replaceCard(item) {
        replaced.push(item.job_id);
        return true;
      },
      setLoadMoreLoading() {},
    },
  });
  scheduler = {
    closeDialog() {},
    getQuery: () => "",
    scheduleAutoLoadIfNeeded() {},
  };

  await runtime.loadRecentJobs({ reset: true });
  runtime.runtimePatches.update({ job_id: "job-view-port", status: "succeeded" });

  assert.deepEqual(rendered.at(-1), ["job-view-port"]);
  assert.deepEqual(replaced, []);
});

test("recent job actions use navigation port instead of direct polling", () => {
  const opened = [];

  const actions = createRecentJobActions({
    apiPrefix: "/api/v1",
    deleteLibraryBook: async () => {},
    startPolling: () => {
      throw new Error("recent-jobs actions should use navigationPort.openJob");
    },
    currentJobId: () => "legacy-current",
    navigationPort: {
      currentJobId: () => "",
      openJob: (jobId) => {
        opened.push(["open", jobId]);
        return true;
      },
      recoverJob: (jobId) => {
        opened.push(["recover", jobId]);
        return true;
      },
    },
    closeRecentJobsDialog: () => {},
    renderCurrentRecentJobs: () => {},
    renderRecentJobsEmpty: () => {},
    renderRecentJobsError: () => {},
    statePort: {
      getSnapshot: () => ({ items: [] }),
      removeJobFamily() {},
      setItems() {},
    },
  });

  actions.selectJob(" job-selected ");
  actions.recoverActiveJob([{ job_id: "job-recover", status: "running" }]);
  actions.recoverActiveJob([{ job_id: "job-ignored", status: "running" }]);

  assert.deepEqual(opened, [["open", "job-selected"], ["recover", "job-recover"]]);
});

test("recent job actions use navigation port instead of direct reader callback", () => {
  const opened = [];
  const errors = [];
  const actions = createRecentJobActions({
    apiPrefix: "/api/v1",
    deleteLibraryBook: async () => {},
    startPolling: () => {},
    openReader: () => {
      throw new Error("recent-jobs actions should use readerPort.openReader");
    },
    jobRuntimePort: {
      currentJobId: () => "",
      openJob: () => true,
    },
    navigationPort: {
      currentJobId: () => "",
      openReader: (jobId) => {
        opened.push(jobId);
        return true;
      },
    },
    closeRecentJobsDialog: () => {},
    renderCurrentRecentJobs: () => {},
    renderRecentJobsEmpty: () => {},
    renderRecentJobsError: (message) => errors.push(message),
    statePort: {
      getSnapshot: () => ({ items: [] }),
      removeJobFamily() {},
      setItems() {},
    },
  });

  actions.openJobReader(" job-reader ");
  actions.openJobReader("");

  assert.deepEqual(opened, ["job-reader"]);
  assert.deepEqual(errors, ["该任务缺少 job_id，无法打开对照阅读。"]);
});

test("recent jobs active refresh skips the current runtime job", async () => {
  const items = [
    { job_id: "job-current", status: "running" },
    { job_id: "job-other", status: "running" },
    { job_id: "job-done", status: "succeeded" },
  ];

  assert.deepEqual(
    recentJobsEligibleForActiveRefresh(items, "job-current").map((item) => item.job_id),
    ["job-other"],
  );

  const timers = [];
  const fetched = [];
  const updates = [];
  const loads = [];
  const environment = createRecentJobsRefreshEnvironment({
    clearTimeoutFn() {},
    setTimeoutFn(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    isWorkflowOpen: () => false,
  });

  const loop = createActiveLibraryRefreshLoop({
    getItems: () => items,
    currentJobId: () => "job-current",
    fetchJobPayload: async (jobId) => {
      fetched.push(jobId);
      return { job_id: jobId, status: "running" };
    },
    apiPrefix: "/api/v1",
    updateFromRuntime: (job) => updates.push(job.job_id),
    loadRecentJobs: (options) => loads.push(options),
    isRecentJobsLoading: () => false,
    environment,
  });

  loop.schedule();
  assert.equal(timers.length, 1);
  timers[0].callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetched, ["job-other"]);
  assert.deepEqual(updates, ["job-other"]);
  // 周期 active-refresh 只单卡 patch，不再全量 loadRecentJobs（避免网格闪）
  assert.deepEqual(loads, []);
  loop.stop();

  timers.length = 0;
  const currentOnlyLoop = createActiveLibraryRefreshLoop({
    getItems: () => [{ job_id: "job-current", status: "running" }],
    currentJobId: () => "job-current",
    fetchJobPayload: async () => {
      throw new Error("current job should not be fetched by active recent jobs refresh");
    },
    updateFromRuntime() {},
    loadRecentJobs() {},
    isRecentJobsLoading: () => false,
    environment,
  });
  currentOnlyLoop.schedule();
  assert.equal(timers.length, 0);
  currentOnlyLoop.stop();
});

test("recent jobs runtime patch rerenders the list when card replacement misses", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 10,
    recentJobsHasMore: true,
    recentJobsItems: [
      {
        job_id: "job-rerender-miss",
        status: "running",
        stage: "ocr",
        stage_detail: "OCR 中",
        progress: { current: 1, total: 10, percent: 10, unit: "page" },
      },
    ],
  });
  const renders = [];
  const patches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => false,
    renderCurrentRecentJobs: (options) => renders.push(options),
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.update({
    job_id: "job-rerender-miss",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: { current: 4, total: 20, unit: "batch" },
  });

  const item = statePort.getSnapshot().items[0];
  assert.equal(item.stage, "translate");
  assert.deepEqual(item.progress, {
    current: 4,
    total: 20,
    percent: 20,
    unit: "batch",
  });
  assert.deepEqual(renders, [{ reset: true }]);
});

test("recent jobs runtime patches keep active created jobs across reset refreshes", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => false,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.insert({
    job_id: "job-created-active",
    status: "running",
    display_stage: "ocr",
    progress: { current: 1, total: 10, unit: "page" },
  });

  const refreshedItems = patches.apply([
    { job_id: "job-existing", status: "succeeded", display_stage: "done" },
  ]);

  assert.deepEqual(refreshedItems.map((item) => item.job_id), [
    "job-created-active",
    "job-existing",
  ]);
  assert.equal(refreshedItems[0].stage, "ocr");
  assert.equal(refreshedItems[0].status, "running");
});

test("recent jobs runtime patches keep translation card state over background render prewarm", () => {
  const previous = mergeLibraryJobItem({
    job_id: "job-parallel-recent",
    title: "parallel.pdf",
    display_name: "parallel.pdf",
    status: "running",
    stage: "translate",
    display_stage: "translation",
    lane: "main",
    substage: "translation_batches",
    progress: {
      unit: "batch",
      current: 120,
      total: 900,
      percent: 13.3333333333,
    },
  }, {
    job_id: "job-parallel-recent",
    status: "running",
    display_stage: "translation",
    lane: "main",
    substage: "translation_batches",
    progress: {
      unit: "batch",
      current: 120,
      total: 900,
      percent: 13.3333333333,
    },
  }, { stageAdapterPort: { adaptJobStageSnapshot } });

  const merged = mergeLibraryJobItem(previous, {
    job_id: "job-parallel-recent",
    status: "running",
    lane: "background",
    display_stage: "render",
    stage: "render_preprocess",
    substage: "render_prewarm",
    progress: {
      unit: "step",
      current: 2,
      total: 3,
      percent: 66.6666666667,
    },
  }, { stageAdapterPort: { adaptJobStageSnapshot } });

  assert.equal(stageKeyForRecentJobLabel(merged), "translate");
  assert.equal(recentJobStageLabel(merged), "翻译中");
  assert.equal(merged.display_stage, "translation");
  assert.equal(merged.lane, "main");
  assert.equal(merged.substage, "translation_batches");
  assert.equal(merged.runtime_status.stageKey, "translate");
  assert.equal(merged.runtime_status.lane, "main");
  assert.equal(merged.progress.unit, "batch");
  assert.equal(merged.progress.current, 120);
  assert.equal(merged.progress.total, 900);
  assert.equal(merged.background_stages.length, 1);
  assert.equal(merged.background_stages[0].display_stage, "render");
  assert.equal(merged.background_stages[0].substage, "render_prewarm");
  assert.equal(merged.background_stages[0].progress.current, 2);
});

test("recent jobs runtime patches keep completed created jobs until backend list catches up", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => false,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.insert({
    job_id: "job-created-fast-complete",
    status: "running",
    display_stage: "translation",
    progress: { current: 9, total: 10, unit: "batch" },
  });
  patches.update({
    job_id: "job-created-fast-complete",
    status: "succeeded",
    display_stage: "done",
    progress: { current: 10, total: 10, unit: "batch", percent: 100 },
  });

  const refreshedItems = patches.apply([
    { job_id: "job-existing", status: "succeeded", display_stage: "done" },
  ]);

  assert.deepEqual(refreshedItems.map((item) => item.job_id), [
    "job-created-fast-complete",
    "job-existing",
  ]);
  assert.equal(refreshedItems[0].status, "succeeded");
  assert.equal(refreshedItems[0].display_stage, "done");
  assert.equal(refreshedItems[0].progress.percent, 100);
});

test("recent jobs runtime patches drive active cover overlay from created job to completion", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const mutations = [];
  const unsubscribe = statePort.subscribe((snapshot, meta = {}) => {
    mutations.push({
      action: meta.action,
      items: snapshot.items.map((item) => ({
        job_id: item.job_id,
        active: isRecentJobActive(item),
        label: recentJobStageLabel(item),
        percent: recentJobProgressPercent(item),
      })),
    });
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => true,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
    storeDrivenRendering: true,
  });

  patches.insert({
    job_id: "job-created-overlay",
    status: "running",
    display_stage: "ocr",
    progress: { current: 1, total: 10, percent: 10, unit: "page" },
  });
  let item = statePort.getSnapshot().items[0];
  assert.equal(item.job_id, "job-created-overlay");
  assert.equal(isRecentJobActive(item), true);
  assert.equal(recentJobStageLabel(item), "OCR 中");
  assert.equal(recentJobProgressPercent(item), 10);

  patches.update({
    job_id: "job-created-overlay",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: { current: 4, total: 20, percent: 20, unit: "batch" },
  });
  item = statePort.getSnapshot().items[0];
  assert.equal(isRecentJobActive(item), true);
  assert.equal(recentJobStageLabel(item), "翻译中");
  assert.equal(recentJobProgressPercent(item), 20);

  patches.update({
    job_id: "job-created-overlay",
    status: "succeeded",
    display_stage: "done",
    progress: { current: 20, total: 20, percent: 100, unit: "batch" },
  });
  item = statePort.getSnapshot().items[0];
  assert.equal(item.status, "succeeded");
  assert.equal(item.display_stage, "done");
  assert.equal(isRecentJobActive(item), false);
  assert.equal(recentJobStageLabel(item), "已完成");
  assert.equal(recentJobProgressPercent(item), 100);
  unsubscribe();
  const cardMutations = mutations.filter((entry) => entry.action === "prependItem" || entry.action === "replaceItem");
  assert.deepEqual(cardMutations.map((entry) => [entry.action, entry.items[0]?.active, entry.items[0]?.label, entry.items[0]?.percent]), [
    ["prependItem", true, "OCR 中", 10],
    ["replaceItem", true, "翻译中", 20],
    ["replaceItem", false, "已完成", 100],
  ]);
});

test("recent jobs runtime patches ignore ocr child jobs when inserting created cards", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => true,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
    storeDrivenRendering: true,
  });

  patches.insert({
    job_id: "job-parent-ocr",
    workflow: "ocr",
    status: "running",
    display_stage: "ocr",
    progress: { current: 1, total: 10, percent: 10, unit: "page" },
  });

  assert.deepEqual(statePort.getSnapshot().items, []);
  assert.deepEqual(patches.apply([{ job_id: "job-parent", status: "running" }]).map((item) => item.job_id), [
    "job-parent",
  ]);
});

test("recent jobs runtime patches do not let queued placeholders downgrade created running cards", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => true,
    renderCurrentRecentJobs() {},
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
    storeDrivenRendering: true,
  });

  patches.insert({
    job_id: "job-created-placeholder",
    status: "running",
    display_stage: "translation",
    source_file_name: "real-book.pdf",
    progress: { current: 4, total: 20, percent: 20, unit: "batch" },
  });
  patches.update({
    job_id: "job-created-placeholder",
    status: "queued",
    display_stage: "ocr",
    stage_detail: "正在读取任务状态...",
  });

  const item = statePort.getSnapshot().items[0];
  assert.equal(item.status, "running");
  assert.equal(item.display_stage, "translation");
  assert.equal(item.source_file_name, "real-book.pdf");
  assert.equal(item.progress.current, 4);
  assert.equal(item.progress.percent, 20);
  assert.equal(isRecentJobActive(item), true);
  assert.equal(recentJobStageLabel(item), "翻译中");
});

test("recent jobs refresh scheduler can bypass throttle without forcing suspended state", () => {
  const loads = [];
  const timers = [];
  let now = 10000;

  const environment = createRecentJobsRefreshEnvironment({
    now: () => now,
    clearTimeoutFn() {},
    setTimeoutFn(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    isWorkflowOpen: () => false,
  });

  const scheduler = createRecentJobsRefreshScheduler({
    loadRecentJobs: (options) => loads.push(options),
    scheduleAutoLoadCheck() {},
    setDialogOpen() {},
    environment,
  });

  scheduler.scheduleRefresh({ delay: 10 });
  scheduler.scheduleRefresh({ delay: 20 });
  scheduler.scheduleRefresh({ delay: 30, bypassThrottle: true });
  assert.deepEqual(timers.map((timer) => timer.delay), [10, 30]);
  timers.forEach((timer) => timer.callback());
  assert.deepEqual(loads, [
    { reset: true, silent: true },
    { reset: true, silent: true },
  ]);

  const suspendedScheduler = createRecentJobsRefreshScheduler({
    loadRecentJobs: (options) => loads.push(options),
    scheduleAutoLoadCheck() {},
    setDialogOpen() {},
    environment,
  });
  suspendedScheduler.setSuspended(true);
  now += 10000;
  suspendedScheduler.scheduleRefresh({ delay: 40, bypassThrottle: true });
  assert.deepEqual(timers.map((timer) => timer.delay), [10, 30]);
});

test("recent jobs refresh scheduler pauses through injected workflow state", () => {
  const timers = [];
  const scheduler = createRecentJobsRefreshScheduler({
    loadRecentJobs() {},
    scheduleAutoLoadCheck() {},
    setDialogOpen() {},
    environment: createRecentJobsRefreshEnvironment({
      now: () => 10000,
      clearTimeoutFn() {},
      setTimeoutFn(callback, delay) {
        timers.push({ callback, delay });
        return timers.length;
      },
      isWorkflowOpen: () => true,
    }),
  });

  scheduler.scheduleRefresh({ delay: 10 });
  scheduler.scheduleRefresh({ delay: 20, force: true });

  assert.equal(scheduler.isSuspended(), true);
  assert.deepEqual(timers.map((timer) => timer.delay), [20]);
});

test("recent jobs workflow open port owns translation dialog DOM state", () => {
  const dialog = { dataset: { open: "1" } };
  const doc = {
    getElementById(id) {
      assert.equal(id, APP_DIALOG_IDS.translationWorkflow);
      return dialog;
    },
  };

  assert.equal(isTranslationWorkflowDialogOpen(doc), true);
  dialog.dataset.open = "0";
  assert.equal(isTranslationWorkflowDialogOpen(doc), false);
});

test("recent job stage labels use the shared public stage resolver", () => {
  const mergedItem = {
    status: "running",
    stage: "translate",
    display_stage: "render",
    substage: "render_prewarm",
    stage_detail: "render payload prewarm: ready",
  };
  assert.equal(stageKeyForRecentJobLabel(mergedItem), "render");
  assert.equal(recentJobStageLabel(mergedItem), "渲染中");
	  assert.equal(
	    recentJobStageLabel({
	      status: "running",
	      display_stage: "render",
	      stage: "render",
	      current_stage: "rendering",
	      stage_detail: "render payload prewarm: ready",
	      runtime_status: {
	        stageKey: "translate",
	        detail: "正在翻译正文内容",
	      },
	    }),
	    "渲染中",
	  );
  assert.equal(
    recentJobStageLabel({
      status: "running",
      display_stage: "translation",
      stage: "render",
      stage_detail: "",
    }),
    "翻译中",
  );
	  assert.equal(
	    recentJobStageLabel({
	      status: "running",
	      display_stage: "translation",
	      stage_snapshot: {
	        stageKey: "render",
	        publicStage: "render",
	      },
	    }),
	    "翻译中",
	  );
	  assert.equal(
	    recentJobStageLabel({
	      status: "running",
	      display_stage: "translation",
	      runtime_status: {
	        stageKey: "done",
	        publicStage: "done",
	        detail: "翻译 PDF 已生成",
	      },
	      stage_snapshot: {
	        stageKey: "render",
	        publicStage: "render",
	        source: "legacy-stage",
	      },
	    }),
	    "翻译中",
	  );
  assert.equal(
    recentJobStageLabel({
      status: "running",
      display_stage: "render",
      stage: "rendering",
    }),
    "渲染中",
  );
  assert.equal(
    recentJobStageLabel({
      status: "succeeded",
      display_stage: "done",
      stage: "rendering",
    }),
    "已完成",
  );
  assert.equal(
    stageKeyForRecentJobLabel({
      job_id: "job-new-contract-terminal-card",
      status: "succeeded",
      stage_snapshot: null,
      background_snapshots: [
        {
          display_stage: "render",
          lane: "background",
          progress: { current: 2, total: 3, percent: 66.66666666666666, unit: "step" },
        },
      ],
      output_pdf_ready: true,
    }),
    "done",
  );
  assert.equal(
    recentJobStageLabel({
      job_id: "job-new-contract-terminal-card",
      status: "succeeded",
      stage_snapshot: null,
      background_snapshots: [
        {
          display_stage: "render",
          lane: "background",
          progress: { current: 2, total: 3, percent: 66.66666666666666, unit: "step" },
        },
      ],
      output_pdf_ready: true,
    }),
    "已完成",
  );
  assert.equal(
    recentJobStatusLabel("cancelled"),
    "已取消",
  );
});

test("recent job card progress prefers runtime status view model", () => {
  assert.equal(
    recentJobProgressPercent({
      status: "running",
      progress: { current: 100, total: 100, percent: 100, unit: "page" },
      runtime_status: {
        progress: { current: 25, total: 100, percent: 25, unit: "batch" },
      },
    }),
    25,
  );
});

test("recent job covers avoid probing missing image endpoints without readiness", () => {
  assert.deepEqual(
    recentJobRawImageUrls({
      job_id: "job-cover",
      thumbnail_url: "",
      cover_url: "",
    }),
    [],
  );
});

test("recent job covers include stable fallback image endpoints when ready", () => {
  assert.deepEqual(
    recentJobRawImageUrls({
      job_id: "job-cover",
      thumbnail_ready: true,
      artifacts: {
        cover: { ready: true },
      },
    }),
    [
      "/api/v1/jobs/job-cover/thumbnail",
      "/api/v1/library/books/job-cover/thumbnail",
      "/api/v1/jobs/job-cover/cover",
      "/api/v1/library/books/job-cover/cover",
    ],
  );

  assert.deepEqual(
    recentJobRawImageUrls({
      job_id: "job-cover",
      thumbnail_url: "https://example.test/api/v1/library/books/job-cover/thumbnail",
      cover_url: "https://example.test/api/v1/library/books/job-cover/cover",
    }).slice(0, 2),
    [
      "https://example.test/api/v1/library/books/job-cover/thumbnail",
      "https://example.test/api/v1/library/books/job-cover/cover",
    ],
  );
});

test("job image API boundary builds and normalizes recent job cover candidates", () => {
  assert.deepEqual(
    buildJobImageCandidateUrls({
      job_id: "job api",
      thumbnail_url: "/custom/thumb.jpg",
      cover_url: "/custom/cover.jpg",
    }),
    [
      "/custom/thumb.jpg",
      "/custom/cover.jpg",
    ],
  );
  assert.deepEqual(
    buildJobImageCandidateUrls({
      job_id: "job api",
      thumbnail_ready: true,
      cover_ready: true,
    }),
    [
      "/api/v1/jobs/job%20api/thumbnail",
      "/api/v1/library/books/job%20api/thumbnail",
      "/api/v1/jobs/job%20api/cover",
      "/api/v1/library/books/job%20api/cover",
    ],
  );
  assert.equal(normalizeJobImageUrl("/api/v1/jobs/job-cover/cover"), "/api/v1/jobs/job-cover/cover");
});

test("recent job image cache can be invalidated for runtime card updates", async () => {
  const previousFetch = global.fetch;
  const previousUrl = global.URL;
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      async blob() {
        return { fetchCount };
      },
    };
  };
  global.URL = {
    createObjectURL(blob) {
      return `blob:${blob.fetchCount}`;
    },
  };

  try {
    assert.equal(await loadRecentJobImage("/api/v1/jobs/job-cache/cover"), "blob:1");
    assert.equal(await loadRecentJobImage("/api/v1/jobs/job-cache/cover"), "blob:1");
    assert.equal(fetchCount, 1);

    clearRecentJobImageCache("/api/v1/jobs/job-cache/cover");
    assert.equal(await loadRecentJobImage("/api/v1/jobs/job-cache/cover"), "blob:2");
    assert.equal(fetchCount, 2);
  } finally {
    clearRecentJobImageCache("/api/v1/jobs/job-cache/cover");
    global.fetch = previousFetch;
    global.URL = previousUrl;
  }
});

test("recent job image cache keys include optional item version", async () => {
  const previousFetch = global.fetch;
  const previousUrl = global.URL;
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      async blob() {
        return { fetchCount };
      },
    };
  };
  global.URL = {
    createObjectURL(blob) {
      return `blob:${blob.fetchCount}`;
    },
  };

  try {
    const rawUrl = "/api/v1/jobs/job-cache-version/cover";
    assert.equal(await loadRecentJobImage(rawUrl, { cacheVersion: "running|10" }), "blob:1");
    assert.equal(await loadRecentJobImage(rawUrl, { cacheVersion: "running|10" }), "blob:1");
    assert.equal(await loadRecentJobImage(rawUrl, { cacheVersion: "succeeded|100" }), "blob:2");
    assert.equal(fetchCount, 2);
  } finally {
    clearRecentJobImageCache("/api/v1/jobs/job-cache-version/cover");
    global.fetch = previousFetch;
    global.URL = previousUrl;
  }
});

test("recent job image refresh collects previous and next cover candidates", () => {
  const urls = recentJobImageRefreshUrls(
    {
      job_id: "job-image-refresh",
      cover_url: "/api/v1/jobs/job-image-refresh/old-cover",
      thumbnail_url: "/api/v1/jobs/job-image-refresh/old-thumbnail",
    },
    {
      job_id: "job-image-refresh",
      cover_url: "/api/v1/jobs/job-image-refresh/new-cover",
      thumbnail_url: "/api/v1/jobs/job-image-refresh/new-thumbnail",
    },
  );

  assert.ok(urls.includes("/api/v1/jobs/job-image-refresh/old-cover"));
  assert.ok(urls.includes("/api/v1/jobs/job-image-refresh/old-thumbnail"));
  assert.ok(urls.includes("/api/v1/jobs/job-image-refresh/new-cover"));
  assert.ok(urls.includes("/api/v1/jobs/job-image-refresh/new-thumbnail"));
});

test("recent jobs runtime merge consumes canonical stage snapshot", () => {
  const merged = mergeLibraryJobItem({
    job_id: "job-recent-stage",
    stage: "ocr",
    stage_detail: "旧状态",
    progress: { current: 2, total: 10, percent: 20, unit: "page" },
  }, {
    job_id: "job-recent-stage",
    status: "running",
    display_stage: "translation",
    stage: "render_preprocess",
    substage: "translation_batches",
    progress: { current: 28, total: 5216, unit: "batch" },
  }, { stageAdapterPort: recentJobsStageAdapterPort });

  assert.equal(merged.stage, "translate");
  assert.equal(merged.stage_detail, "正在翻译正文内容");
  assert.deepEqual(merged.runtime_status, {
    stageKey: "translate",
    publicStage: "translation",
    source: "display-stage",
    lane: "main",
    substage: "translation_batches",
    detail: "正在翻译正文内容",
    progress: {
      current: 28,
      total: 5216,
      percent: 28 / 5216 * 100,
      unit: "batch",
    },
  });
  assert.deepEqual(merged.progress, {
    current: 28,
    total: 5216,
    percent: 28 / 5216 * 100,
    unit: "batch",
  });

  const completed = mergeLibraryJobItem(merged, {
    job_id: "job-recent-stage",
    status: "succeeded",
    display_stage: "done",
    progress: { current: 89, total: 89, unit: "page" },
  }, { stageAdapterPort: recentJobsStageAdapterPort });
  assert.equal(completed.stage, "done");
  assert.equal(completed.progress.percent, 100);
  assert.equal(completed.progress.current, 89);
});

test("recent jobs runtime merge does not complete succeeded active stages", () => {
  const cases = [
    ["ocr", { display_stage: "ocr", stage: "ocr_processing", expectedStage: "ocr", unit: "page" }],
    ["translation", { display_stage: "translation", stage: "translating", expectedStage: "translate", unit: "batch" }],
    ["render", { display_stage: "render", stage: "rendering", expectedStage: "render", unit: "page" }],
  ];

  for (const [name, payload] of cases) {
    const merged = mergeLibraryJobItem({
      job_id: `job-${name}-subtask-card`,
      status: "queued",
      stage: payload.expectedStage,
      display_stage: payload.expectedStage === "translate" ? "translation" : payload.expectedStage,
      progress: { current: 0, total: 8, percent: 0, unit: payload.unit },
    }, {
      job_id: `job-${name}-subtask-card`,
      status: "succeeded",
      ...payload,
      substage: payload.stage,
      progress: { current: 2, total: 8, percent: 25, unit: payload.unit },
    }, { stageAdapterPort: recentJobsStageAdapterPort });

    assert.equal(merged.status, "succeeded", name);
    assert.equal(merged.stage, payload.expectedStage, name);
    assert.notEqual(merged.display_stage, "done", name);
    assert.equal(merged.progress.current, 2, name);
    assert.equal(merged.progress.total, 8, name);
    assert.equal(merged.progress.percent, 25, name);
    assert.equal(merged.runtime_status.stageKey, payload.expectedStage, name);
  }
});

test("recent jobs runtime merge does not promote canonical lane-only internal stage", () => {
  const merged = mergeLibraryJobItem({
    job_id: "job-recent-lane-only",
    stage: "translate",
    stage_detail: "正在翻译正文内容",
    progress: { current: 20, total: 100, percent: 20, unit: "batch" },
  }, {
    job_id: "job-recent-lane-only",
    status: "running",
    lane: "background",
    stage: "render_preprocess",
    substage: "render_prewarm",
    stage_detail: "render payload prewarm: ready",
    progress: { current: 1, total: 3, unit: "step" },
  }, { stageAdapterPort: recentJobsStageAdapterPort });

  assert.equal(merged.stage, "translate");
  assert.equal(merged.lane, undefined);
  assert.equal(merged.substage, undefined);
  assert.equal(merged.stage_detail, "正在翻译正文内容");
  assert.equal(merged.progress.current, 20);
  assert.equal(merged.progress.total, 100);
  assert.equal(merged.progress.unit, "batch");
  assert.deepEqual(merged.runtime_status, {});
  assert.equal(merged.background_stages, undefined);
});

test("recent jobs runtime snapshot mirrors the canonical adapter", () => {
  const job = {
    job_id: "job-recent-adapter",
    status: "running",
    display_stage: "translation",
    stage: "render_preprocess",
    substage: "translation_batches",
    progress: { current: 28, total: 5216, unit: "batch" },
  };
  const stageSnapshot = adaptJobStageSnapshot(job);
  const recentSnapshot = buildRecentJobRuntimeSnapshot(job, {
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  assert.equal(recentSnapshot.stageKey, stageSnapshot.stageKey);
  assert.equal(recentSnapshot.detail, stageSnapshot.detail);
  assert.deepEqual(recentSnapshot.progress, stageSnapshot.progress);
});

test("recent jobs runtime snapshot prefers normalized stage snapshot", () => {
  const recentSnapshot = buildRecentJobRuntimeSnapshot({
    job_id: "job-recent-normalized-snapshot",
    status: "running",
    stage: "render_preprocess",
    stage_detail: "render payload prewarm: ready",
    stage_snapshot: {
      stageKey: "translate",
      publicStage: "translation",
      source: "public-stage",
      lane: "main",
      substage: "translation_batches",
      detail: "正在翻译正文内容",
      progress: {
        current: 30,
        total: 100,
        percent: 30,
        unit: "batch",
      },
    },
  });

  assert.equal(recentSnapshot.stageKey, "translate");
  assert.equal(recentSnapshot.detail, "正在翻译正文内容");
  assert.equal(recentSnapshot.progress.current, 30);
});

test("recent jobs runtime merge does not write raw internal stage over normalized snapshot", () => {
  const merged = mergeLibraryJobItem({
    job_id: "job-recent-normalized-merge",
    stage: "ocr",
    display_stage: "ocr",
    lane: "main",
    substage: "provider_processing",
    stage_detail: "OCR 处理中",
    progress: { current: 5, total: 100, percent: 5, unit: "page" },
  }, {
    job_id: "job-recent-normalized-merge",
    status: "running",
    stage: "render_preprocess",
    current_stage: "render_preprocess",
    stage_detail: "render payload prewarm: ready",
    progress: { current: 30, total: 100, percent: 30, unit: "batch" },
    stage_snapshot: {
      stageKey: "translate",
      publicStage: "translation",
      source: "public-stage",
      lane: "main",
      substage: "translation_batches",
      detail: "正在翻译正文内容",
      progress: {
        current: 30,
        total: 100,
        percent: 30,
        unit: "batch",
      },
    },
  });

  assert.equal(merged.stage, "translate");
  assert.equal(merged.display_stage, "translation");
  assert.equal(merged.lane, "main");
  assert.equal(merged.substage, "translation_batches");
  assert.equal(merged.stage_detail, "正在翻译正文内容");
  assert.equal(merged.runtime_status.stageKey, "translate");
  assert.equal(merged.runtime_status.substage, "translation_batches");
});

test("recent jobs runtime merge lets display stage override stale snapshot", () => {
  const merged = mergeLibraryJobItem({
    job_id: "job-recent-display-stage-wins",
    status: "running",
    display_stage: "ocr",
    stage: "ocr",
    progress: { current: 5, total: 100, percent: 5, unit: "page" },
  }, {
    job_id: "job-recent-display-stage-wins",
    status: "running",
    display_stage: "translation",
    stage: "render_preprocess",
    substage: "translation_batches",
    stage_detail: "正在翻译正文内容",
    progress: { current: 30, total: 100, percent: 30, unit: "batch" },
    runtime_status: {
      stageKey: "done",
      publicStage: "done",
    },
    stage_snapshot: {
      stageKey: "render",
      publicStage: "render",
      source: "legacy-stage",
      lane: "main",
      substage: "render_prewarm",
      detail: "render payload prewarm: ready",
      progress: {
        current: 1,
        total: 3,
        percent: 33,
        unit: "step",
      },
    },
  }, { stageAdapterPort: recentJobsStageAdapterPort });

  assert.equal(merged.stage, "translate");
  assert.equal(merged.display_stage, "translation");
  assert.equal(merged.substage, "translation_batches");
  assert.equal(merged.runtime_status.stageKey, "translate");
  assert.equal(merged.runtime_status.publicStage, "translation");
  assert.equal(recentJobStageLabel(merged), "翻译中");
});
