// 任务运行时 · 状态：回首页清理、耗时文案、事件页合并、当前任务 / 次级资源的 state port
// （由 framework store 承载、批量通知、窄读取器）与渲染上下文。
// 从原 job-runtime.test.mjs（1700+ 行）按主题拆出，用例原样搬移。

import test from "node:test";
import assert from "node:assert/strict";
import { eventPage } from "../helpers/job-events-fixture.mjs";
import { createLegacyStateFixture } from "../helpers/legacy-state-fixture.mjs";
import * as secondaryResourceCacheModule from "../../src/features/jobs/domain/runtime/secondary-resource-cache.js";
import * as currentJobStateModule from "../../src/features/jobs/domain/runtime/current-job-state.js";
import * as renderContextModule from "../../src/features/jobs/domain/runtime/render-context.js";
import { buildElapsedViewModel } from "@retainpdf/domain/job";
import { returnJobRuntimeToHome } from "../../src/features/jobs/domain/runtime/runtime-reset.js";
import { createUploadStatePort } from "../../src/features/ingest/domain/upload/state.js";
import { fetchRecentJobEvents, mergeJobEventsPayload } from "../../src/features/jobs/domain/runtime/job-events-resource.js";
import { normalizeJobPayload } from "@retainpdf/domain/job";

// 这里原先直接用 js/state 的全局单例当夹具（secondaryResourceCache 只是往传入
// 对象上读写，并不要求它是那个单例）。改用测试自持的同形夹具，好让生产代码
// 删掉那 6 片死 slice。
const state = createLegacyStateFixture();

test("returnJobRuntimeToHome clears page range through upload state port", () => {
  const previousDocument = global.document;
  const previousCustomEvent = global.CustomEvent;
  const runtimeState = createLegacyStateFixture();
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
      updateJobWarning: (value) => calls.push(["warning", value]),
      activateDetailTab: (value) => calls.push(["tab", value]),
      shellViewPort: {
        closeDialogs: () => calls.push("close-dialogs"),
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
  assert.ok(calls.includes("page-ranges"));
  assert.deepEqual(calls.find((call) => call[0] === "tab"), ["tab", "overview"], "状态详情弹窗回到概览页");
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
    apiPrefix: "/api/v1", jobId: "job-long-events",
    fetchJobEvents: async (_jobId, _apiPrefix, query) => {
      calls.push(query);
      return eventPage(Array.from({ length: 500 }, (_, index) => ({ seq: 9501 + index })));
    },
  });
  assert.deepEqual(calls, [{ limit: 500, start: "tail" }]);
  assert.equal(payload.items[0].seq, 9501);
});

test("mergeJobEventsPayload keeps newer translation progress events", () => {
  const merged = mergeJobEventsPayload(
    {
      items: [
        {
          seq: 10,
          event_id: "event-10",
          display_stage: "translation",
          substage: "translation_batches",
          progress: { unit: "batch", current: 28, total: 5216 },
        },
        {
          seq: 11,
          event_id: "event-11",
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
          event_id: "event-11",
          display_stage: "translation",
          substage: "translation_batches",
          progress: { unit: "batch", current: 29, total: 5216 },
        },
        {
          seq: 12,
          event_id: "event-12",
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
          event_id: "main-20",
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
          event_id: "background-20",
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
          event_id: "repair-20",
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
  const state = createLegacyStateFixture();
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
  const state = createLegacyStateFixture();
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
  const state = createLegacyStateFixture();
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

test("current job state owns snapshot timing and detail caches", () => {
  const state = createLegacyStateFixture();
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
  const state = createLegacyStateFixture();
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
  // 迁移完成:store 是唯一真值,旧 state 对象不再被回写
  assert.equal(state.currentJobId, "");
  assert.equal(state.currentJobSnapshot, null);
});

test("current job state port batches snapshot diagnostics and resume plan", () => {
  const state = createLegacyStateFixture();
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
  const state = createLegacyStateFixture();
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
  const state = createLegacyStateFixture();
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
  const state = createLegacyStateFixture();
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
