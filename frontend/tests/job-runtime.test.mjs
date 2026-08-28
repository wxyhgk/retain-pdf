import test from "node:test";
import assert from "node:assert/strict";

import { createInitialState } from "../src/js/state/slices.js";
import * as jobEventsResourceModule from "../src/js/features/job-runtime/job-events-resource.js";
import * as secondaryResourceCacheModule from "../src/js/features/job-runtime/secondary-resource-cache.js";
import * as currentJobSecondarySelectorsModule from "../src/js/features/job-runtime/current-job-secondary-selectors.js";
import * as stagePinStateModule from "../src/js/features/job-runtime/stage-pin-state.js";
import * as currentJobStateModule from "../src/js/features/job-runtime/current-job-state.js";
import { syncCurrentJobSnapshot } from "../src/js/features/job-runtime/current-job-state.js";
import * as runtimePollingStateModule from "../src/js/features/job-runtime/runtime-polling-state.js";
import * as secondaryResourcePolicyModule from "../src/js/features/job-runtime/secondary-resource-policy.js";
import * as renderContextModule from "../src/js/features/job-runtime/render-context.js";
import { buildElapsedViewModel } from "../src/js/job/elapsed-view-model.js";
import { returnJobRuntimeToHome } from "../src/js/features/job-runtime/runtime-reset.js";
import {
  createUploadStatePort,
  getUploadState,
  setAppliedPageRange,
  setUploadState,
} from "../src/js/features/upload/state.js";
import { state } from "../src/js/state/store.js";
import {
  createJobEventsResource,
  fetchRecentJobEvents,
  JOB_EVENTS_PAGE_SIZE,
  JOB_EVENTS_PREVIEW_PAGE_SIZE,
  mergeJobEventsPayload,
} from "../src/js/features/job-runtime/job-events-resource.js";
import { mountJobRuntimeFeature } from "../src/js/features/job-runtime/controller.js";
import {
  createSecondaryResourceSchedulerPort,
  scheduleSecondaryResourceFetches,
} from "../src/js/features/job-runtime/secondary-resources.js";
import {
  isJobTerminal,
  isTerminalStatus,
} from "../src/js/job/core.js";
import { normalizeJobPayload } from "../src/js/job/normalize.js";
import { buildJobPatchWithDisplayState } from "../src/js/job-status/job-display-state.js";

test("returnJobRuntimeToHome clears page range through upload state port", () => {
  const previousDocument = global.document;
  const previousCustomEvent = global.CustomEvent;
  const runtimeState = createInitialState();
  const uploadStatePort = createUploadStatePort(runtimeState);
  uploadStatePort.setAppliedPageRange("3-9");
  const calls = [];
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  global.document = {
    dispatchEvent(event) {
      calls.push(["dispatch", event.type]);
    },
    getElementById() {
      return null;
    },
  };

  try {
    returnJobRuntimeToHome({
      state: runtimeState,
      uploadStatePort,
      resetStatePort: {
        resetJob: () => {
          calls.push("reset-job");
          runtimeState.currentJobId = "";
        },
      },
      onReaderDialogClose: () => calls.push("reader"),
      setWorkflowSections: (value) => calls.push(["workflow", value]),
      resetUploadProgress: () => calls.push("upload-progress"),
      resetUploadedFile: () => calls.push("uploaded-file"),
      applyWorkflowMode: () => calls.push("workflow-mode"),
      clearPageRanges: () => calls.push("page-ranges"),
      setText: (...args) => calls.push(["text", ...args]),
      updateJobWarning: (value) => calls.push(["warning", value]),
      activateDetailTab: (value) => calls.push(["tab", value]),
      jobPresentationPort: {
        summarizeStatus: (status) => `summary:${status}`,
      },
      shellViewPort: {
        closeDialogs: () => calls.push("close-dialogs"),
        resetEvents: () => calls.push("reset-events"),
      },
    });
  } finally {
    global.document = previousDocument;
    global.CustomEvent = previousCustomEvent;
  }

  assert.equal(uploadStatePort.getSnapshot().appliedPageRange, "");
  assert.equal(runtimeState.appliedPageRange, "");
  assert.ok(calls.includes("reset-job"));
  assert.ok(calls.includes("close-dialogs"));
  assert.ok(calls.includes("reset-events"));
  assert.ok(calls.includes("page-ranges"));
  assert.ok(calls.some((call) => (
    call[0] === "text"
    && call[1] === "job-summary"
    && call[2] === "summary:idle"
  )));
});

test("elapsed view model owns runtime duration text", () => {
  assert.deepEqual(buildElapsedViewModel(null), {
    hasSnapshot: false,
    stageElapsedText: "-",
    totalElapsedText: "-",
  });

  const viewModel = buildElapsedViewModel({
    active_stage_elapsed_ms: 60_000,
    total_elapsed_ms: 120_000,
    updated_at: "2026-06-16T00:02:00Z",
    status: "running",
  }, {
    now: "2026-06-16T00:02:00Z",
  });
  assert.equal(viewModel.hasSnapshot, true);
  assert.equal(viewModel.stageElapsedText, "1分 0秒");
  assert.equal(viewModel.totalElapsedText, "2分 0秒");
});

test("fetchRecentJobEvents returns the latest event page for long jobs", async () => {
  const calls = [];
  const payload = await fetchRecentJobEvents({
    apiPrefix: "/api/v1",
    jobId: "job-long-events",
    fetchJobEvents: async (_jobId, _apiPrefix, limit, offset) => {
      calls.push({ limit, offset });
      const count = offset >= 1000 ? 20 : limit;
      return {
        items: Array.from({ length: count }, (_, index) => ({ seq: offset + index + 1 })),
        limit,
        offset,
      };
    },
  });

  assert.deepEqual(calls, [
    { limit: 500, offset: 0 },
    { limit: 500, offset: 500 },
    { limit: 500, offset: 1000 },
  ]);
  assert.equal(payload.offset, 1000);
  assert.equal(payload.items[0].seq, 1001);
});

test("mergeJobEventsPayload keeps newer translation progress events", () => {
  const merged = mergeJobEventsPayload(
    {
      items: [
        {
          seq: 10,
          display_stage: "translation",
          substage: "translation_batches",
          progress: { unit: "batch", current: 28, total: 5216 },
        },
        {
          seq: 11,
          display_stage: "translation",
          substage: "translation_batches",
          progress: { unit: "batch", current: 29, total: 5216 },
        },
      ],
    },
    {
      items: [
        {
          seq: 11,
          display_stage: "translation",
          substage: "translation_batches",
          progress: { unit: "batch", current: 29, total: 5216 },
        },
        {
          seq: 12,
          display_stage: "translation",
          substage: "translation_batches",
          progress: { unit: "batch", current: 4000, total: 5216 },
        },
      ],
    },
  );

  assert.deepEqual(merged.items.map((item) => item.seq), [10, 11, 12]);
  assert.equal(merged.items.at(-1).progress.current, 4000);
});

test("mergeJobEventsPayload keeps same-seq events from different lanes and substages", () => {
  const merged = mergeJobEventsPayload(
    {
      items: [
        {
          seq: 20,
          lane: "main",
          display_stage: "translation",
          substage: "translation_batches",
          event_type: "progress",
          progress: { unit: "batch", current: 28, total: 5216 },
        },
      ],
    },
    {
      items: [
        {
          seq: 20,
          lane: "background",
          display_stage: "render",
          substage: "render_prewarm",
          event_type: "progress",
          progress: { unit: "step", current: 1, total: 3 },
        },
        {
          seq: 20,
          lane: "main",
          display_stage: "translation",
          substage: "agent_repair",
          event_type: "progress",
          progress: { unit: "percent", current: 65, total: 100 },
        },
      ],
    },
  );

  assert.deepEqual(
    merged.items.map((item) => [item.seq, item.lane, item.display_stage, item.substage]),
    [
      [20, "main", "translation", "translation_batches"],
      [20, "background", "render", "render_prewarm"],
      [20, "main", "translation", "agent_repair"],
    ],
  );
});

test("secondary resource cache isolates resources by job and type", () => {
  const state = createInitialState();
  const eventsPayload = { items: [{ seq: 1 }] };
  const manifestPayload = { artifacts: [{ key: "pdf" }] };

  secondaryResourceCacheModule.cacheSecondaryResource(state, "events", "job-a", eventsPayload);
  secondaryResourceCacheModule.cacheSecondaryResource(state, "manifest", "job-b", manifestPayload);

  assert.deepEqual(secondaryResourceCacheModule.cachedEventsFor(state, "job-a"), eventsPayload);
  assert.equal(secondaryResourceCacheModule.cachedEventsFor(state, "job-b"), null);
  assert.deepEqual(secondaryResourceCacheModule.cachedManifestFor(state, "job-b"), manifestPayload);
  assert.deepEqual(secondaryResourceCacheModule.cachedSecondaryResourceFor(state, "events", "job-a"), eventsPayload);
  assert.equal(secondaryResourceCacheModule.secondaryResourceFetchedAt(state, "events") > 0, true);

  secondaryResourceCacheModule.syncSecondaryResource(state, "events", "job-c", null);
  assert.equal(secondaryResourceCacheModule.cachedEventsFor(state, "job-a"), null);
  assert.equal(state.currentJobEventsJobId, "");
});

test("secondary resource state port owns cache in-flight and reset without legacy mirror", () => {
  let nowValue = 1000;
  const state = createInitialState();
  state.currentJobId = "job-secondary";
  const port = secondaryResourceCacheModule.createSecondaryResourceStatePort(state, {
    now: () => nowValue,
  });

  port.setInFlight("events", true);
  assert.equal(port.isInFlight("events"), true);

  const eventsPayload = { items: [{ seq: 10 }] };
  nowValue = 1200;
  port.cache("events", "job-secondary", eventsPayload);
  assert.deepEqual(port.cachedFor("events", "job-secondary"), eventsPayload);
  assert.equal(port.fetchedAt("events"), 1200);

  port.clearInFlightForCurrentJob("events", "job-other");
  assert.equal(port.isInFlight("events"), true);
  port.clearInFlightForCurrentJob("events", "job-secondary");
  assert.equal(port.isInFlight("events"), false);

  port.cache("manifest", "job-old", { artifacts: [{ key: "pdf" }] });
  port.clearForOtherJob("manifest", "job-secondary");
  assert.equal(port.cachedFor("manifest", "job-old"), null);

  port.setInFlight("stageActions", true);
  port.reset({ preserveInFlight: true });
  assert.equal(port.cachedFor("events", "job-secondary"), null);
  assert.equal(port.isInFlight("stageActions"), true);

  secondaryResourceCacheModule.resetSecondaryResourceState(state, { preserveInFlight: false });
  assert.equal(port.isInFlight("stageActions"), false);
});

test("secondary resource state port batches resource updates into one notification", () => {
  let nowValue = 2000;
  const state = createInitialState();
  const port = secondaryResourceCacheModule.createSecondaryResourceStatePort(state, {
    now: () => nowValue,
  });
  const events = [];
  port.store.subscribe((snapshot, meta) => {
    events.push({ snapshot, meta });
  });

  port.batch(({ setInFlight, cache }) => {
    setInFlight("events", true);
    nowValue = 2100;
    cache("events", "job-batch", { items: [{ seq: 1 }] });
    setInFlight("events", false);
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].meta.action, "setInFlight");
  assert.equal(port.isInFlight("events"), false);
  assert.deepEqual(port.cachedFor("events", "job-batch"), { items: [{ seq: 1 }] });
  assert.equal(port.fetchedAt("events"), 2100);
});

test("stage pin state normalizes job and stage keys", () => {
  const state = createInitialState();
  stagePinStateModule.resetDisplayedStagePin(state, " job-a ");
  stagePinStateModule.setDisplayedStagePin(state, " render ");
  assert.deepEqual(stagePinStateModule.currentDisplayedStagePin(state), {
    jobId: "job-a",
    stageKey: "render",
  });
});

test("stage pin state ignores untrusted stage changes from old compatibility paths", () => {
  const state = createInitialState();
  stagePinStateModule.resetDisplayedStagePin(state, "job-stage-current");
  stagePinStateModule.setDisplayedStagePin(state, "render");

  const displayStage = stagePinStateModule.keepDisplayedStageForward({
    state,
    jobId: "job-stage-current",
    stageKey: "translate",
  });

	assert.deepEqual(displayStage, {
	  stageKey: "render",
	  keptPrevious: true,
	});
	assert.deepEqual(stagePinStateModule.currentDisplayedStagePin(state), {
	  jobId: "job-stage-current",
	  stageKey: "render",
	});
});

test("current job state owns snapshot timing and detail caches", () => {
  const state = createInitialState();
  const job = { job_id: "job-current", status: "running" };
  currentJobStateModule.syncCurrentJobSnapshot(state, job, "job-current", {
    startedAt: "2026-01-01T00:00:00Z",
    finishedAt: "2026-01-01T00:01:00Z",
  });

  assert.equal(currentJobStateModule.currentJobId(state), "job-current");
  assert.deepEqual(currentJobStateModule.currentJobSnapshot(state), job);
  assert.deepEqual(currentJobStateModule.currentJobSnapshotFor(state, "job-current"), job);
  assert.equal(currentJobStateModule.currentJobSnapshotFor(state, "job-other"), null);
  assert.equal(currentJobStateModule.currentJobFinishedAt(state), "2026-01-01T00:01:00Z");

  currentJobStateModule.clearCurrentJobTiming(state);
  const clearedSnapshot = currentJobStateModule.createCurrentJobStatePort(state).getSnapshot();
  assert.equal(clearedSnapshot.startedAt, "");
  assert.equal(clearedSnapshot.finishedAt, "");

  const diagnostics = { summary: "failed" };
  const resumePlan = { resumable: true };
  currentJobStateModule.cacheJobDiagnostics(state, "job-current", diagnostics);
  currentJobStateModule.cacheJobResumePlan(state, "job-current", resumePlan);
  const cachedSnapshot = currentJobStateModule.createCurrentJobStatePort(state).getSnapshot();
  assert.deepEqual(cachedSnapshot.diagnostics, diagnostics);
  assert.equal(cachedSnapshot.diagnosticsJobId, "job-current");
  assert.deepEqual(cachedSnapshot.resumePlan, resumePlan);
  assert.equal(cachedSnapshot.resumePlanJobId, "job-current");
});

test("current job state port is backed by framework store without legacy mirror", () => {
  const state = createInitialState();
  const port = currentJobStateModule.createCurrentJobStatePort(state);
  const job = { job_id: "job-store", status: "running" };

  port.syncSnapshot(job, "job-store", {
    startedAt: "2026-01-02T00:00:00Z",
    finishedAt: "2026-01-02T00:01:00Z",
  });
  port.cacheDiagnostics("job-store", { summary: "ok" });
  port.cacheResumePlan("job-store", { can_resume: true });

  const snapshot = port.getSnapshot();
  assert.equal(snapshot.jobId, "job-store");
  assert.deepEqual(snapshot.snapshot, job);
  assert.equal(snapshot.startedAt, "2026-01-02T00:00:00Z");
  assert.equal(snapshot.finishedAt, "2026-01-02T00:01:00Z");
  assert.equal(snapshot.diagnostics.summary, "ok");
  assert.equal(snapshot.resumePlan.can_resume, true);
  // Hoàn migration: store là nguồn duy nhất, đối tượng state cũ không còn được ghi lại
  assert.equal(state.currentJobId, "");
  assert.equal(state.currentJobSnapshot, null);
});



test("current job state port batches snapshot diagnostics and resume plan", () => {
  const state = createInitialState();
  const port = currentJobStateModule.createCurrentJobStatePort(state);
  const events = [];
  const job = { job_id: "job-current-batch", status: "running" };
  port.store.subscribe((snapshot, meta) => {
    events.push({ snapshot, meta });
  });

  port.batch(({ syncSnapshot, cacheDiagnostics, cacheResumePlan }) => {
    syncSnapshot(job, job.job_id, {
      startedAt: "2026-06-16T00:00:00Z",
      finishedAt: "",
    });
    cacheDiagnostics(job.job_id, { summary: "ok" });
    cacheResumePlan(job.job_id, { resumable: true });
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].meta.action, "syncSnapshot");
  assert.equal(port.jobId(), job.job_id);
  assert.deepEqual(port.snapshot(), job);
  assert.deepEqual(port.resumePlan(), { resumable: true });
});

test("current job state port exposes narrow readers", () => {
  const state = createInitialState();
  const port = currentJobStateModule.createCurrentJobStatePort(state);
  const job = { job_id: "job-reader-port", status: "running" };

  port.syncSnapshot(job, job.job_id, {
    startedAt: "2026-06-16T00:00:00Z",
    finishedAt: "2026-06-16T00:01:00Z",
  });

  assert.equal(port.jobId(), job.job_id);
  assert.deepEqual(port.snapshot(), job);
  assert.deepEqual(port.snapshotFor(job.job_id), job);
  assert.equal(port.snapshotFor("job-other"), null);
  assert.equal(port.finishedAt(), "2026-06-16T00:01:00Z");
});

test("current job secondary selectors forward to secondary resource store", () => {
  const state = createInitialState();
  const job = { job_id: "job-secondary-selector", status: "running" };
  currentJobStateModule.syncCurrentJobSnapshot(state, job, job.job_id);
  const secondaryPort = secondaryResourceCacheModule.createSecondaryResourceStatePort(state, {
    now: () => 3000,
  });
  const manifest = { artifacts: [{ artifact_key: "pdf" }] };
  const stageActions = { actions: [{ stage: "render" }] };
  const events = { items: [{ seq: 1 }] };

  secondaryPort.cache("manifest", job.job_id, manifest);
  secondaryPort.cache("stageActions", job.job_id, stageActions);
  secondaryPort.cache("events", job.job_id, events);
  state.currentJobManifest = { stale: true };
  state.currentJobStageActions = { stale: true };
  state.currentJobEvents = { stale: true };

  assert.deepEqual(currentJobStateModule.currentJobManifest(state), manifest);
  assert.deepEqual(currentJobStateModule.currentJobStageActions(state), stageActions);
  assert.deepEqual(currentJobStateModule.currentJobEventsFor(state, job.job_id), events);
  assert.equal(currentJobStateModule.currentJobEventsFor(state, "job-other"), null);
});

test("job render context port applies primary and secondary runtime contexts", () => {
  const state = createInitialState();
  const port = renderContextModule.createJobRenderContextPort(state, {
    jobPresentationPort: {
      normalizeJobPayload: (payload) => ({ ...payload, normalized_by_port: true }),
    },
  });
  const job = {
    job_id: "job-render-context-port",
    status: "running",
    display_stage: "translation",
  };
  const events = { items: [{ seq: 1 }] };
  const manifest = { artifacts: [{ artifact_key: "pdf" }] };
  const stageActions = { actions: [{ stage: "render" }] };

  const context = port.applySnapshot({
    payload: job,
    eventsPayload: events,
    manifestPayload: manifest,
    stageActionsPayload: stageActions,
  });

  assert.equal(context.jobId, job.job_id);
  assert.equal(context.job.job_id, job.job_id);
  assert.equal(context.job.status, "running");
  assert.equal(context.job.display_stage, "translation");
  assert.equal(context.job.normalized_by_port, true);
  assert.deepEqual(context.events, events);
  assert.deepEqual(context.manifest, manifest);
  assert.deepEqual(context.stageActions, stageActions);
  assert.equal(currentJobStateModule.currentJobId(state), job.job_id);

  const currentContext = port.currentFor(job.job_id);
  assert.equal(currentContext.job.job_id, job.job_id);
  assert.deepEqual(currentContext.events, events);

  const nextEvents = { items: [{ seq: 2 }] };
  const secondaryContext = port.applySecondary({
    jobId: job.job_id,
    eventsPayload: nextEvents,
  });
  assert.equal(secondaryContext.job.job_id, job.job_id);
  assert.deepEqual(secondaryContext.events, nextEvents);
  assert.deepEqual(port.currentFor(job.job_id).events, nextEvents);
});

test("job events resource caches by job and switches terminal jobs to full history", async () => {
  const calls = [];
  const resource = createJobEventsResource({
    apiPrefix: "/api/v1",
    fetchJobEvents: async (jobId, _apiPrefix, limit, offset) => {
      calls.push({ jobId, limit, offset });
      if (jobId === "terminal" && offset === 0) {
        return {
          items: Array.from({ length: limit }, (_, index) => ({ seq: index + 1 })),
          limit,
          offset,
        };
      }
      if (jobId === "terminal" && offset === JOB_EVENTS_PAGE_SIZE) {
        return {
          items: [{ seq: JOB_EVENTS_PAGE_SIZE + 1 }],
          limit,
          offset,
        };
      }
      return {
        items: [{ seq: offset + 1 }],
        limit,
        offset,
      };
    },
  });

  const first = await resource.load({ jobId: "active" });
  const cached = await resource.load({ jobId: "active" });
  const terminal = await resource.load({ jobId: "terminal", terminal: true });

  assert.equal(first.status, "success");
  assert.equal(cached.status, "success");
  assert.equal(terminal.status, "success");
  assert.deepEqual(calls, [
    { jobId: "active", limit: JOB_EVENTS_PREVIEW_PAGE_SIZE, offset: 0 },
    { jobId: "terminal", limit: JOB_EVENTS_PAGE_SIZE, offset: 0 },
    { jobId: "terminal", limit: JOB_EVENTS_PAGE_SIZE, offset: JOB_EVENTS_PAGE_SIZE },
  ]);
  assert.equal(terminal.data.items.length, JOB_EVENTS_PAGE_SIZE + 1);
});

test("secondary event refresh consumes the injected job events resource", async () => {
  const runtimeState = createInitialState();
  const jobId = "job-secondary-resource";
  const job = {
    job_id: jobId,
    status: "running",
    display_stage: "translation",
  };
  runtimeState.currentJobId = jobId;
  runtimeState.currentJobPollGeneration = 1;
  syncCurrentJobSnapshot(runtimeState, job, jobId);

  const resourceLoads = [];
  const patches = [];
  scheduleSecondaryResourceFetches({
    state: runtimeState,
    apiPrefix: "/api/v1",
    jobId,
    payload: job,
    generation: 1,
    terminal: false,
    fetchJobEvents: async () => {
      throw new Error("fetchJobEvents should be hidden behind the resource");
    },
    jobEventsResource: {
      load: async (params, options) => {
        resourceLoads.push({ params, options });
        return {
          status: "success",
          data: {
            items: [
              {
                seq: 2,
                lane: "main",
                display_stage: "translation",
                substage: "translation_batches",
                progress: { unit: "batch", current: 5, total: 10 },
              },
            ],
          },
        };
      },
    },
    fetchJobArtifactsManifest: async () => ({ artifacts: [] }),
    fetchJobStageActions: async () => ({ actions: [] }),
    renderJobSecondaryPatch: (patch) => patches.push(patch),
    notifyLibraryJobUpdated() {},
    jobPresentationPort: {
      buildJobPatchWithDisplayState,
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(resourceLoads, [
    {
      params: { jobId, terminal: false },
      options: { cache: false },
    },
  ]);
  const eventPatch = patches.find((patch) => patch.source === "events");
  assert.equal(eventPatch.context.events.items.at(-1).progress.current, 5);
});

test("secondary resource scheduler port owns controller scheduling dependencies", async () => {
  const jobId = "job-secondary-scheduler-port";
  const job = {
    job_id: jobId,
    status: "running",
    display_stage: "translation",
  };

  const loads = [];
  const patches = [];
  const libraryUpdates = [];
  const portCalls = [];
  const cachedByType = new Map([
    ["events", { items: [{ seq: 9 }] }],
  ]);
  const pollingPort = {
    isCurrentGeneration(requestedJobId, generation) {
      portCalls.push(["generation", requestedJobId, generation]);
      return requestedJobId === jobId && generation === 3;
    },
  };
  const currentJobPort = {
    snapshotFor(requestedJobId) {
      portCalls.push(["snapshotFor", requestedJobId]);
      return requestedJobId === jobId ? job : null;
    },
  };
  const secondaryResourcePort = {
    cachedFor(type, requestedJobId) {
      portCalls.push(["cachedFor", type, requestedJobId]);
      return requestedJobId === jobId ? cachedByType.get(type) || null : null;
    },
    isInFlight(type) {
      portCalls.push(["isInFlight", type]);
      return false;
    },
    shouldRefresh(type, intervalMs, force) {
      portCalls.push(["shouldRefresh", type, intervalMs, force]);
      return true;
    },
    setInFlight(type, value) {
      portCalls.push(["setInFlight", type, value]);
    },
    cache(type, requestedJobId, payload) {
      portCalls.push(["cache", type, requestedJobId]);
      cachedByType.set(type, payload);
    },
    clearInFlightForCurrentJob(type, requestedJobId) {
      portCalls.push(["clearInFlight", type, requestedJobId]);
    },
  };
  const renderContextPort = {
    currentFor(requestedJobId) {
      portCalls.push(["currentFor", requestedJobId]);
      return {
        job,
        jobId: requestedJobId,
        events: cachedByType.get("events") || null,
        manifest: cachedByType.get("manifest") || null,
        stageActions: cachedByType.get("stageActions") || null,
      };
    },
  };
  const port = createSecondaryResourceSchedulerPort({
    state: {},
    apiPrefix: "/api/v1",
    fetchJobEvents: async () => {
      throw new Error("events must go through injected resource");
    },
    jobEventsResource: {
      load: async (params, options) => {
        loads.push({ params, options });
        return {
          status: "success",
          data: {
            items: [
              {
                seq: 10,
                lane: "main",
                display_stage: "translation",
                substage: "translation_batches",
                progress: { unit: "batch", current: 4, total: 8 },
              },
            ],
          },
        };
      },
    },
    fetchJobArtifactsManifest: async (requestedJobId, apiPrefix) => ({
      requestedJobId,
      apiPrefix,
      artifacts: [{ artifact_key: "pdf" }],
    }),
    fetchJobStageActions: async () => ({ actions: [{ stage: "render" }] }),
    renderJobSecondaryPatch: (patch) => patches.push(patch),
    notifyLibraryJobUpdated: (item) => libraryUpdates.push(item),
    pollingPort,
    currentJobPort,
    secondaryResourcePort,
    renderContextPort,
    jobPresentationPort: {
      buildJobPatchWithDisplayState,
    },
  });

  port.schedule({
    jobId,
    payload: job,
    generation: 3,
    terminal: false,
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(loads, [
    {
      params: { jobId, terminal: false },
      options: { cache: false },
    },
  ]);
  assert.equal(patches.some((patch) => patch.source === "events"), true);
  assert.equal(patches.some((patch) => patch.source === "manifest"), true);
  assert.equal(patches.some((patch) => patch.source === "stageActions"), true);
  assert.equal(patches.find((patch) => patch.source === "events").context.events.items.at(-1).progress.current, 4);
  assert.equal(patches.find((patch) => patch.source === "manifest").context.manifest.requestedJobId, jobId);
  // Resource phụ events không còn đẩy library (do poll chính phụ trách), tránh publish kép gây rung grid
  assert.deepEqual(libraryUpdates, []);
  assert.equal(portCalls.some((call) => call[0] === "cache" && call[1] === "events"), true);
  assert.equal(portCalls.some((call) => call[0] === "currentFor" && call[1] === jobId), true);
});

test("secondary resource scheduler ignores stale generations through polling port", async () => {
  const jobId = "job-secondary-stale-generation";
  const calls = [];
  const secondaryResourcePort = {
    cachedFor() {
      return null;
    },
    isInFlight() {
      return false;
    },
    shouldRefresh() {
      return true;
    },
    setInFlight(type, value) {
      calls.push(["setInFlight", type, value]);
    },
    cache(type) {
      calls.push(["cache", type]);
    },
    clearInFlightForCurrentJob(type, requestedJobId) {
      calls.push(["clearInFlight", type, requestedJobId]);
    },
  };
  const port = createSecondaryResourceSchedulerPort({
    state: {},
    apiPrefix: "/api/v1",
    fetchJobEvents: async () => {
      throw new Error("events must use resource");
    },
    jobEventsResource: {
      load: async () => ({ status: "success", data: { items: [{ seq: 1 }] } }),
    },
    fetchJobArtifactsManifest: async () => ({ artifacts: [] }),
    fetchJobStageActions: async () => ({ actions: [] }),
    renderJobSecondaryPatch: () => calls.push(["patch"]),
    notifyLibraryJobUpdated: () => calls.push(["notify"]),
    pollingPort: {
      isCurrentGeneration() {
        return false;
      },
    },
    currentJobPort: {
      snapshotFor: () => ({ job_id: jobId }),
    },
    secondaryResourcePort,
    renderContextPort: {
      currentFor: () => ({ jobId }),
    },
  });

  port.schedule({
    jobId,
    payload: { job_id: jobId, status: "running" },
    generation: 1,
    terminal: false,
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(calls.filter((call) => call[0] === "cache"), []);
  assert.deepEqual(calls.filter((call) => call[0] === "patch"), []);
  assert.deepEqual(calls.filter((call) => call[0] === "notify"), []);
  assert.deepEqual(calls.filter((call) => call[0] === "clearInFlight").map((call) => call[1]).sort(), [
    "events",
    "manifest",
    "stageActions",
  ]);
});

test("runtime polling state gates concurrent polls and generations", () => {
  const state = createInitialState();
  const start = runtimePollingStateModule.startRuntimeJob(state, "job-poll");
  assert.equal(start.generation, 1);
  assert.equal(runtimePollingStateModule.runtimePollingStoreFor(state).getSnapshot().jobId, "job-poll");
  assert.equal(runtimePollingStateModule.isCurrentJobGeneration(state, "job-poll", 1), true);
  assert.equal(runtimePollingStateModule.isCurrentJobGeneration(state, "job-other", 1), false);

  assert.equal(runtimePollingStateModule.beginJobPoll(state), 1);
  assert.equal(runtimePollingStateModule.beginJobPoll(state), null);
  runtimePollingStateModule.finishJobPoll(state);
  assert.equal(runtimePollingStateModule.runtimePollingStoreFor(state).getSnapshot().pollInFlight, false);

  runtimePollingStateModule.stopPolling(state);
  assert.equal(state.timer, null);
  assert.equal(runtimePollingStateModule.runtimePollingStoreFor(state).getSnapshot().pollInFlight, false);
  assert.equal(state.currentJobEventsFetchInFlight, false);
  assert.equal(state.currentJobManifestFetchInFlight, false);
  assert.equal(state.currentJobStageActionsFetchInFlight, false);
});

test("runtime polling state port is backed by framework store without legacy mirror", () => {
  const cleared = [];
  const intervals = [];
  let nextTimer = 100;
  const state = createInitialState();
  const port = runtimePollingStateModule.createRuntimePollingStatePort(state, {
    clearIntervalFn: (timer) => cleared.push(timer),
    setIntervalFn: (callback, intervalMs) => {
      intervals.push({ callback, intervalMs });
      nextTimer += 1;
      return nextTimer;
    },
    now: () => "2026-06-16T00:00:00Z",
  });

  const started = port.startJob(" job-port ");
  assert.deepEqual(started, {
    generation: 1,
    startedAt: "2026-06-16T00:00:00Z",
  });
  assert.equal(port.getSnapshot().jobId, "job-port");
  // Hoàn migration: store là nguồn duy nhất, đối tượng state cũ không còn được ghi lại
  assert.equal(state.currentJobId, "");

  assert.equal(port.beginPoll(), 1);
  assert.equal(port.beginPoll(), null);
  assert.equal(port.getSnapshot().pollInFlight, true);
  port.finishPoll();
  assert.equal(port.getSnapshot().pollInFlight, false);
  assert.equal(port.isCurrentGeneration("job-port", 1), true);
  assert.equal(port.isCurrentGeneration("job-port", 0), false);

  assert.equal(port.startTimer(() => {}, 250), 101);
  assert.equal(state.timer, 101);
  assert.equal(port.startTimer(() => {}, 500), 102);
  assert.deepEqual(cleared, [101]);
  assert.deepEqual(intervals.map((item) => item.intervalMs), [250, 500]);

  port.stop();
  assert.deepEqual(cleared, [101, 102]);
  assert.equal(state.timer, null);
  assert.equal(port.getSnapshot().pollInFlight, false);
});

test("job runtime controller consumes injected polling port", async () => {
  const previousDocument = global.document;
  global.document = {
    getElementById() {
      return null;
    },
  };
  const state = createInitialState();
  const calls = [];
  const payloads = new Map([
    ["job-port", {
      job_id: "job-port",
      status: "running",
      display_stage: "translation",
      progress: { unit: "batch", current: 1, total: 10 },
    }],
  ]);
  const pollingPort = {
    beginPoll() {
      calls.push(["begin"]);
      return 7;
    },
    finishPoll() {
      calls.push(["finish"]);
    },
    isCurrentGeneration(jobId, generation) {
      calls.push(["generation", jobId, generation]);
      return true;
    },
    startJob(jobId) {
      calls.push(["startJob", jobId]);
      state.currentJobId = jobId;
      return { generation: 7, startedAt: "2026-06-16T00:00:00Z" };
    },
    startTimer(callback, intervalMs) {
      calls.push(["timer", intervalMs, typeof callback]);
      return "timer-1";
    },
    stop() {
      calls.push(["stop"]);
    },
  };
  const cachedEvents = { items: [{ seq: 1 }] };
  const currentJobPort = {
    jobId: () => state.currentJobId || "job-port",
    snapshot: () => ({
      job_id: "job-port",
      status: "queued",
      display_stage: "ocr",
      progress: { unit: "page", current: 0, total: 10 },
    }),
  };
  const secondaryResourcePort = {
    cachedFor(type, jobId) {
      calls.push(["cached", type, jobId]);
      return type === "events" ? cachedEvents : null;
    },
  };
  const renderContextPort = {
    applySnapshot(input) {
      calls.push([
        "renderContext",
        input.payload.job_id,
        input.eventsPayload?.items?.length || 0,
        input.manifestPayload,
        input.stageActionsPayload,
      ]);
      return {
        job: input.payload,
        jobId: input.payload.job_id,
        events: input.eventsPayload || null,
        manifest: input.manifestPayload || null,
        stageActions: input.stageActionsPayload || null,
      };
    },
  };
  const schedulerCalls = [];
  const libraryUpdates = [];
  const shellCalls = [];
  const resetCalls = [];
  const secondaryResourceSchedulerPort = {
    schedule(input) {
      schedulerCalls.push(input);
    },
  };
  const rendered = [];
  const feature = mountJobRuntimeFeature({
    state,
    apiPrefix: "/api/v1",
    buildJobDetailEndpoint: (jobId, apiPrefix) => `${apiPrefix}/jobs/${jobId}`,
    fetchJobPayload: async (jobId) => {
      calls.push(["fetch", jobId]);
      return payloads.get(jobId);
    },
    fetchJobEvents: async () => ({ items: [] }),
    fetchJobArtifactsManifest: async () => ({ artifacts: [] }),
    fetchJobStageActions: async () => ({ actions: [] }),
    retryJobStage: async () => ({}),
    submitJson: async () => ({}),
    renderJob: (context) => rendered.push(context),
    renderJobSecondaryPatch: () => {},
    setText: (id, text) => calls.push(["setText", id, text]),
    setWorkflowSections: (job) => calls.push(["sections", job.job_id]),
    resetUploadProgress: () => {},
    resetUploadedFile: () => {},
    applyWorkflowMode: () => {},
    clearPageRanges: () => {},
    updateJobWarning: () => {},
    activateDetailTab: () => {},
    libraryEventPort: {
      publishJobUpdated(job) {
        libraryUpdates.push(job);
      },
      requestRefresh() {},
    },
    jobEventsResource: {
      load: async () => ({ status: "success", data: { items: [] } }),
    },
    pollingPort,
    currentJobPort,
    secondaryResourcePort,
    renderContextPort,
    resetStatePort: {
      resetSecondary: () => resetCalls.push(["secondary"]),
    },
    secondaryResourceSchedulerPort,
    jobPresentationPort: {
      isTerminalStatus,
      normalizeJobPayload,
    },
    shellViewPort: {
      closeDialogs() {},
      isReaderOpen: () => true,
      resetEvents() {},
      setCancelDisabled: (disabled) => shellCalls.push(["cancel", disabled]),
    },
    onReaderDialogSync: () => shellCalls.push(["reader-sync"]),
  });

  try {
    feature.startPolling("job-port");
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(calls.slice(0, 9), [
      ["stop"],
      ["startJob", "job-port"],
      ["sections", "job-port"],
      ["renderContext", "job-port", 0, undefined, undefined],
      ["begin"],
      ["fetch", "job-port"],
      ["timer", 1000, "function"],
      ["finish"],
      ["generation", "job-port", 7],
    ]);
    assert.deepEqual(resetCalls, [["secondary"]]);
    assert.equal(rendered[0].job.status, "queued");
    assert.equal(rendered.at(-1).job.status, "running");
    assert.equal(libraryUpdates.length, 2);
    assert.equal(libraryUpdates[0].job_id, "job-port");
    assert.equal(libraryUpdates[0].status, "queued");
    assert.equal(libraryUpdates[0].display_stage, "ocr");
    assert.equal(libraryUpdates[1].job_id, "job-port");
    assert.equal(libraryUpdates[1].status, "running");
    assert.equal(libraryUpdates[1].display_stage, "translation");
    assert.equal(libraryUpdates[1].progress_current, 1);
    assert.equal(libraryUpdates[1].progress_total, 10);
    assert.equal(libraryUpdates[1].progress_unit, "batch");
    assert.deepEqual(rendered.at(-1).events, cachedEvents);
    assert.equal(feature.currentJobId(), "job-port");
    assert.deepEqual(calls.filter((call) => call[0] === "cached"), [
      ["cached", "events", "job-port"],
      ["cached", "manifest", "job-port"],
      ["cached", "stageActions", "job-port"],
    ]);
    assert.deepEqual(calls.filter((call) => call[0] === "renderContext"), [
      ["renderContext", "job-port", 0, undefined, undefined],
      ["renderContext", "job-port", 1, null, null],
    ]);
    assert.deepEqual(schedulerCalls, [
      {
        jobId: "job-port",
        payload: payloads.get("job-port"),
        generation: 7,
        terminal: false,
      },
    ]);
    assert.deepEqual(shellCalls, [["reader-sync"]]);
  } finally {
    global.document = previousDocument;
  }
});

test("job runtime keeps polling when succeeded payload is still in an active stage", async () => {
  const cases = [
    ["ocr", { display_stage: "ocr", stage: "ocr_processing", progress: { unit: "page", current: 2, total: 8, percent: 25 } }],
    ["translation", { display_stage: "translation", stage: "translating", progress: { unit: "batch", current: 2, total: 8, percent: 25 } }],
    ["render", { display_stage: "render", stage: "rendering", progress: { unit: "page", current: 2, total: 8, percent: 25 } }],
    ["legacy-translation", { stage: "translating", progress: { unit: "batch", current: 2, total: 8, percent: 25 } }],
    ["legacy-render", { stage: "rendering", progress: { unit: "page", current: 2, total: 8, percent: 25 } }],
  ];

  for (const [name, payload] of cases) {
    const state = createInitialState();
    const calls = [];
    const schedulerCalls = [];
    const feature = mountJobRuntimeFeature({
      state,
      apiPrefix: "/api/v1",
      buildJobDetailEndpoint: (jobId, apiPrefix) => `${apiPrefix}/jobs/${jobId}`,
      fetchJobPayload: async (jobId) => ({
        job_id: jobId,
        status: "succeeded",
        ...payload,
      }),
      fetchJobEvents: async () => ({ items: [] }),
      fetchJobArtifactsManifest: async () => ({ artifacts: [] }),
      fetchJobStageActions: async () => ({ actions: [] }),
      retryJobStage: async () => ({}),
      submitJson: async () => ({}),
      renderJob: () => {},
      renderJobSecondaryPatch: () => {},
      setText: () => {},
      setWorkflowSections: () => {},
      resetUploadProgress: () => {},
      resetUploadedFile: () => {},
      applyWorkflowMode: () => {},
      clearPageRanges: () => {},
      updateJobWarning: () => {},
      activateDetailTab: () => {},
      libraryEventPort: {
        publishJobCreated() {},
        publishJobUpdated() {},
        requestRefresh(input) {
          calls.push(["refresh", input]);
        },
      },
      pollingPort: {
        beginPoll: () => 3,
        finishPoll() {},
        isCurrentGeneration: () => true,
        startJob(jobId) {
          state.currentJobId = jobId;
          return { generation: 3, startedAt: "2026-06-17T00:00:00Z" };
        },
        startTimer(callback, intervalMs) {
          calls.push(["timer", intervalMs]);
          return "timer";
        },
        stop() {
          calls.push(["stop"]);
        },
      },
      currentJobPort: {
        jobId: () => state.currentJobId,
      },
      secondaryResourcePort: {
        cachedFor: () => null,
      },
      renderContextPort: {
        applySnapshot: (input) => ({ job: input.payload, jobId: input.payload.job_id }),
      },
      secondaryResourceSchedulerPort: {
        schedule(input) {
          schedulerCalls.push(input);
        },
      },
      jobEventsResource: {
        load: async () => ({ status: "success", data: { items: [] } }),
      },
      jobPresentationPort: {
        isJobTerminal,
        isTerminalStatus,
        normalizeJobPayload,
      },
      shellViewPort: {
        closeDialogs() {},
        isReaderOpen: () => false,
        resetEvents() {},
        setCancelDisabled() {},
      },
    });

    feature.startPolling(`job-${name}-subtask-succeeded`);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(calls.filter((call) => call[0] === "stop").length, 1, name);
    assert.equal(schedulerCalls.at(-1)?.terminal, false, name);
  }
});

test("job runtime startPolling immediately publishes placeholder to the library", async () => {
  const state = createInitialState();
  const libraryCreated = [];
  const libraryUpdated = [];
  const feature = mountJobRuntimeFeature({
    state,
    apiPrefix: "/api/v1",
    buildJobDetailEndpoint: (jobId, apiPrefix) => `${apiPrefix}/jobs/${jobId}`,
    fetchJobPayload: async (jobId) => ({ job_id: jobId, status: "running", display_stage: "ocr" }),
    fetchJobEvents: async () => ({ items: [] }),
    fetchJobArtifactsManifest: async () => ({ artifacts: [] }),
    fetchJobStageActions: async () => ({ actions: [] }),
    retryJobStage: async () => ({}),
    submitJson: async () => ({}),
    renderJob: () => {},
    renderJobSecondaryPatch: () => {},
    setText: () => {},
    setWorkflowSections: () => {},
    resetUploadProgress: () => {},
    resetUploadedFile: () => {},
    applyWorkflowMode: () => {},
    clearPageRanges: () => {},
    updateJobWarning: () => {},
    activateDetailTab: () => {},
    libraryEventPort: {
      publishJobCreated(job) {
        libraryCreated.push(job);
      },
      publishJobUpdated(job) {
        libraryUpdated.push(job);
      },
      requestRefresh() {},
    },
    pollingPort: {
      beginPoll: () => 1,
      finishPoll() {},
      isCurrentGeneration: () => true,
      startJob(jobId) {
        state.currentJobId = jobId;
        return { generation: 1, startedAt: "2026-06-17T00:00:00Z" };
      },
      startTimer() {},
      stop() {},
    },
    currentJobPort: {
      jobId: () => state.currentJobId,
    },
    secondaryResourcePort: {
      cachedFor: () => null,
    },
    renderContextPort: {
      applySnapshot: (input) => ({ job: input.payload, jobId: input.payload.job_id }),
    },
    secondaryResourceSchedulerPort: {
      schedule() {},
    },
    jobEventsResource: {
      load: async () => ({ status: "success", data: { items: [] } }),
    },
    jobPresentationPort: {
      isTerminalStatus,
      normalizeJobPayload,
    },
    shellViewPort: {
      closeDialogs() {},
      isReaderOpen: () => false,
      resetEvents() {},
      setCancelDisabled() {},
    },
  });

  feature.startPolling("job-library-placeholder");

  assert.equal(libraryCreated[0].job_id, "job-library-placeholder");
  assert.equal(libraryCreated[0].status, "queued");
  assert.equal(libraryCreated[0].display_stage, "ocr");
  assert.equal(libraryUpdated[0].job_id, "job-library-placeholder");
  assert.equal(libraryUpdated[0].status, "queued");
  assert.equal(libraryUpdated[0].display_stage, "ocr");

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(libraryUpdated.at(-1).status, "running");
});

test("job runtime startPolling({ silent: true }) skips library create and workflow sections", async () => {
  const state = createInitialState();
  const libraryCreated = [];
  const libraryUpdated = [];
  const workflowCalls = [];
  const feature = mountJobRuntimeFeature({
    state,
    apiPrefix: "/api/v1",
    buildJobDetailEndpoint: (jobId, apiPrefix) => `${apiPrefix}/jobs/${jobId}`,
    fetchJobPayload: async (jobId) => ({ job_id: jobId, status: "running", display_stage: "ocr" }),
    fetchJobEvents: async () => ({ items: [] }),
    fetchJobArtifactsManifest: async () => ({ artifacts: [] }),
    fetchJobStageActions: async () => ({ actions: [] }),
    retryJobStage: async () => ({}),
    submitJson: async () => ({}),
    renderJob: () => {},
    renderJobSecondaryPatch: () => {},
    setText: () => {},
    setWorkflowSections: (job) => workflowCalls.push(job?.job_id || null),
    resetUploadProgress: () => {},
    resetUploadedFile: () => {},
    applyWorkflowMode: () => {},
    clearPageRanges: () => {},
    updateJobWarning: () => {},
    activateDetailTab: () => {},
    libraryEventPort: {
      publishJobCreated(job) {
        libraryCreated.push(job);
      },
      publishJobUpdated(job) {
        libraryUpdated.push(job);
      },
      requestRefresh() {},
    },
    pollingPort: {
      beginPoll: () => 1,
      finishPoll() {},
      isCurrentGeneration: () => true,
      startJob(jobId) {
        state.currentJobId = jobId;
        return { generation: 1, startedAt: "2026-06-17T00:00:00Z" };
      },
      startTimer() {},
      stop() {},
    },
    currentJobPort: {
      jobId: () => state.currentJobId,
    },
    secondaryResourcePort: {
      cachedFor: () => null,
    },
    renderContextPort: {
      applySnapshot: (input) => ({ job: input.payload, jobId: input.payload.job_id }),
    },
    secondaryResourceSchedulerPort: {
      schedule() {},
    },
    jobEventsResource: {
      load: async () => ({ status: "success", data: { items: [] } }),
    },
    jobPresentationPort: {
      isTerminalStatus,
      normalizeJobPayload,
    },
    shellViewPort: {
      closeDialogs() {},
      isReaderOpen: () => false,
      resetEvents() {},
      setCancelDisabled() {},
    },
  });

  feature.startPolling("job-silent", { silent: true });

  assert.deepEqual(libraryCreated, [], "silent 不 publishJobCreated");
  assert.deepEqual(workflowCalls, [], "silent 不 setWorkflowSections");
  // silent: thay đổi status/stage vẫn notify (nút xoay cover), nhưng không refresh toàn trang
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(libraryUpdated.length >= 1, "silent 首帧/阶段变化应 notify 书架以驱动封面 loading");
  assert.ok(
    libraryUpdated.every((job) => job.job_id === "job-silent"),
    "silent notify 仅当前 job",
  );
});

test("job runtime controller routes cancel button state through shell view port", async () => {
  const state = createInitialState();
  state.currentJobId = "job-cancel";
  const calls = [];
  const feature = mountJobRuntimeFeature({
    state,
    apiPrefix: "/api/v1",
    buildJobDetailEndpoint: (jobId, apiPrefix) => `${apiPrefix}/jobs/${jobId}`,
    fetchJobPayload: async (jobId) => ({ job_id: jobId, status: "cancelled" }),
    fetchJobEvents: async () => ({ items: [] }),
    fetchJobArtifactsManifest: async () => ({ artifacts: [] }),
    fetchJobStageActions: async () => ({ actions: [] }),
    retryJobStage: async () => ({}),
    submitJson: async (url) => calls.push(["submit", url]),
    renderJob: () => calls.push(["render"]),
    renderJobSecondaryPatch: () => {},
    setText: (...args) => calls.push(["text", ...args]),
    setWorkflowSections: () => {},
    resetUploadProgress: () => {},
    resetUploadedFile: () => {},
    applyWorkflowMode: () => {},
    clearPageRanges: () => {},
    updateJobWarning: () => {},
    activateDetailTab: () => {},
    libraryEventPort: {
      publishJobUpdated() {},
      requestRefresh() {},
    },
    pollingPort: {
      beginPoll: () => 1,
      finishPoll() {},
      isCurrentGeneration: () => true,
      startJob: () => ({ startedAt: "2026-06-16T00:00:00Z" }),
      startTimer() {},
      stop() {},
    },
    currentJobPort: {
      jobId: () => "job-cancel",
    },
    secondaryResourcePort: {
      cachedFor: () => null,
    },
    renderContextPort: {
      applySnapshot: (input) => ({ job: input.payload, jobId: input.payload.job_id }),
    },
    secondaryResourceSchedulerPort: {
      schedule() {},
    },
    shellViewPort: {
      closeDialogs() {},
      isReaderOpen: () => false,
      resetEvents() {},
      setCancelDisabled: (disabled) => calls.push(["cancel-disabled", disabled]),
    },
  });

  await feature.cancelCurrentJob();

  assert.deepEqual(calls.slice(0, 2), [
    ["cancel-disabled", true],
    ["submit", "/api/v1/jobs/job-cancel/cancel"],
  ]);
});

test("secondary event refresh uses patch renderer instead of full job render", async () => {
  const runtimeState = createInitialState();
  const jobId = "job-secondary-patch";
  const job = {
    job_id: jobId,
    status: "running",
    display_stage: "translation",
    progress: { unit: "batch", current: 1, total: 10 },
  };
  runtimeState.currentJobId = jobId;
  runtimeState.currentJobPollGeneration = 1;
  syncCurrentJobSnapshot(runtimeState, job, jobId);

  const patches = [];
  const libraryUpdates = [];
  scheduleSecondaryResourceFetches({
    state: runtimeState,
    apiPrefix: "/api/v1",
    jobId,
    payload: job,
    generation: 1,
    terminal: false,
    fetchJobEvents: async () => ({
      items: [
        {
          seq: 1,
          display_stage: "translation",
          lane: "main",
          substage: "translation_batches",
          progress: { unit: "batch", current: 2, total: 10 },
        },
      ],
    }),
    fetchJobArtifactsManifest: async () => ({ artifacts: [] }),
    fetchJobStageActions: async () => ({ actions: [] }),
    renderJobSecondaryPatch: (patch) => patches.push(patch),
    notifyLibraryJobUpdated: (item) => libraryUpdates.push(item),
    jobPresentationPort: {
      buildJobPatchWithDisplayState,
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(patches.some((patch) => patch.source === "events"), true);
  assert.equal(patches.some((patch) => patch.source === "manifest"), true);
  assert.equal(patches.some((patch) => patch.source === "stageActions"), true);
  assert.equal(patches.find((patch) => patch.source === "events").context.events.items.at(-1).progress.current, 2);
  assert.equal(patches.find((patch) => patch.source === "manifest").context.manifest.artifacts.length, 0);
  assert.equal(patches.find((patch) => patch.source === "stageActions").context.stageActions.actions.length, 0);
  assert.deepEqual(currentJobStateModule.currentJobSnapshot(runtimeState), job);
  // Resource phụ events không còn đẩy library
  assert.deepEqual(libraryUpdates, []);
});

test("secondary resource patches pass render context instead of raw cache inputs", async () => {
  const runtimeState = createInitialState();
  const jobId = "job-secondary-context";
  const job = {
    job_id: jobId,
    status: "running",
    display_stage: "translation",
  };
  runtimeState.currentJobId = jobId;
  runtimeState.currentJobPollGeneration = 1;
  syncCurrentJobSnapshot(runtimeState, job, jobId);

  const patches = [];
  scheduleSecondaryResourceFetches({
    state: runtimeState,
    apiPrefix: "/api/v1",
    jobId,
    payload: job,
    generation: 1,
    terminal: false,
    fetchJobEvents: async () => ({ items: [{ seq: 1, progress: { current: 3, total: 9 } }] }),
    fetchJobArtifactsManifest: async () => ({ artifacts: [{ artifact_key: "pdf" }] }),
    fetchJobStageActions: async () => ({ actions: [{ stage: "render" }] }),
    renderJobSecondaryPatch: (patch) => patches.push(patch),
    notifyLibraryJobUpdated() {},
    jobPresentationPort: {
      buildJobPatchWithDisplayState,
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  const eventPatch = patches.find((patch) => patch.source === "events");
  assert.equal(eventPatch.jobId, undefined);
  assert.equal(eventPatch.eventsPayload, undefined);
  assert.deepEqual(eventPatch.context.job, job);
  assert.equal(eventPatch.context.jobId, jobId);
  assert.equal(eventPatch.context.events.items[0].progress.current, 3);
});
