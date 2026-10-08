// 状态详情 · 运行时与协调器：快照的公开阶段、阶段历史、runtime port、恢复操作、
// 概览协调器与译文 Tab 的数据 port / 协调器。
// 本文件原有 1500+ 行，已按主题拆成同目录的 status-detail-*.test.mjs，用例原样搬移。

import test from "node:test";
import assert from "node:assert/strict";
import { createLegacyStateFixture } from "../helpers/legacy-state-fixture.mjs";
import * as currentJobStateModule from "../../src/features/jobs/domain/runtime/current-job-state.js";
import { createSecondaryResourceStatePort } from "../../src/features/jobs/domain/runtime/secondary-resource-cache.js";
import { createJobRenderContextPort } from "../../src/features/jobs/domain/runtime/render-context.js";
import { buildStatusDetailSnapshot } from "../../src/features/job-detail/domain/snapshot/snapshot.js";
import { stageHistoryDisplay } from "@retainpdf/domain/job";
import { buildStageHistoryPresentation } from "../../src/features/job-detail/domain/snapshot/history.js";
// bootstrap/status-detail-runtime-port.js 已随 cutover 删除;这是它的纯逻辑
// 拷贝(job-runtime 三个 kept 端口的字面量组合,零 DOM),迁移指向 pages/home
// 的同名实现(两者函数体完全一致,仅头部注释与相对导入路径不同)。
import { createStatusDetailRuntimePort } from "../../src/features/job-detail/domain/status-detail-runtime-port.js";
import { createTranslationState } from "../../src/features/job-detail/domain/dialog/translation-state.js";
import { createStatusDetailTranslationDataPort } from "../../src/features/job-detail/domain/dialog/translation-data-port.js";
import { createStatusDetailTranslationTabCoordinator } from "../../src/features/job-detail/domain/dialog/translation-tab-coordinator.js";
import { createStatusDetailOverviewCoordinator } from "../../src/features/job-detail/domain/dialog/overview-coordinator.js";
import {
  rerunCurrentJob,
  syncRerunAction,
} from "../../src/features/job-detail/domain/dialog/resume-actions.js";

// createStatusDetailRuntimePort 现在要求组合层注入 job-runtime 三个 kept 端口；
// 测试从 jobs 域直接构造同一份端口（与组合层 create-status-domain.ts 等价）。
function createRuntimePort(state) {
  return createStatusDetailRuntimePort({
    currentJobPort: currentJobStateModule.createCurrentJobStatePort(state),
    secondaryResourcePort: createSecondaryResourceStatePort(state),
    renderContextPort: createJobRenderContextPort(state),
  });
}

global.window ||= {};
global.window.location ||= {
  protocol: "http:",
  origin: "http://localhost",
  pathname: "/",
};

test("status detail snapshot runtime stage follows public presentation", () => {
  const snapshot = buildStatusDetailSnapshot({
    job_id: "job-status-detail-public-stage",
    status: "running",
    display_stage: "translation",
    stage: "render_preprocess",
    current_stage: "render_preprocess",
    stage_detail: "render payload prewarm: ready",
    progress: { unit: "batch", current: 30, total: 100 },
  }, { items: [] });

  assert.equal(/render|prewarm|渲染/.test(snapshot.runtime.currentStage), false);
  assert.match(snapshot.runtime.currentStage, /translation|翻译|第 30\/100 批/);
});

test("status detail snapshot runtime stage follows normalized stage snapshot", () => {
  const snapshot = buildStatusDetailSnapshot({
    job_id: "job-status-detail-normalized-stage",
    status: "running",
    stage: "render_preprocess",
    current_stage: "render_preprocess",
    stage_detail: "render payload prewarm: ready",
    progress: { unit: "step", current: 1, total: 3 },
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
  }, { items: [] });

  assert.equal(/render|prewarm|渲染/.test(snapshot.runtime.currentStage), false);
  assert.match(snapshot.runtime.currentStage, /翻译|第 30\/100 批/);
});

test("status detail snapshot does not use legacy user_stage as runtime public stage", () => {
  const snapshot = buildStatusDetailSnapshot({
    job_id: "job-status-detail-legacy-user-stage",
    status: "running",
    user_stage: "translation",
    stage: "render_preprocess",
    current_stage: "render_preprocess",
    progress: { unit: "batch", current: 30, total: 100 },
  }, { items: [] });

  assert.equal(/translation|翻译|render|渲染/.test(snapshot.runtime.currentStage), false);
});

test("stage history display prefers public stage over raw internal stage", () => {
  const entry = {
    display_stage: "translation",
    stage: "render_preprocess",
    detail: "",
  };
  const display = stageHistoryDisplay(entry);

  assert.equal(display.title, "翻译准备 / 跨栏跨页判断");
  assert.equal(display.stage, "翻译准备 / 跨栏跨页判断");
  assert.equal(/render|prewarm|渲染/.test(`${display.title} ${display.stage}`), false);

  const presentation = buildStageHistoryPresentation({
    status: "running",
    stage_history: [
      {
        ...entry,
        enter_at: "2026-01-01T00:00:00Z",
      },
    ],
  }, {
    now: "2026-01-01T00:00:01Z",
  });

  assert.equal(presentation.hasItems, true);
  assert.match(presentation.markup, /翻译准备/);
  assert.equal(/render_preprocess|prewarm/.test(presentation.markup), false);
});

test("stage history presentation accepts backend runtime stage history payload", () => {
  const presentation = buildStageHistoryPresentation({
    status: "running",
    runtime: {
      stage_history: [
        {
          display_stage: "translation",
          stage: "render_preprocess",
          enter_at: "2026-01-01T00:00:00Z",
          duration_ms: 1000,
        },
      ],
    },
  });

  assert.equal(presentation.hasItems, true);
  assert.equal(presentation.emptyText, "暂无阶段记录");
  assert.match(presentation.markup, /翻译准备/);
  assert.equal(/后端未返回 runtime\.stage_history|render_preprocess/.test(presentation.markup), false);
});

test("status detail runtime port narrows current job cache access", () => {
  const state = createLegacyStateFixture();
  const port = createRuntimePort(state);
  const job = { job_id: "job-detail-port", status: "running" };
  const events = { items: [{ seq: 1, display_stage: "translation" }] };
  const diagnostics = { summary: "ok" };
  const resumePlan = { can_resume: true };

  const context = port.applyOverviewPayload({
    payload: {
      ...job,
      started_at: "2026-01-01T00:00:00Z",
      finished_at: "2026-01-01T00:02:00Z",
    },
    eventsPayload: events,
    diagnosticsPayload: diagnostics,
    resumePlan,
    fallbackJobId: job.job_id,
  });

  assert.equal(port.currentJobId(), job.job_id);
  assert.equal(context.job.job_id, job.job_id);
  assert.deepEqual(context.job.diagnostics, diagnostics);
  assert.deepEqual(context.events, events);
  assert.equal(port.currentJobSnapshot().job_id, job.job_id);
  assert.deepEqual(port.currentRenderContext(job.job_id).events, events);
  assert.equal(port.currentJobFinishedAt(), "2026-01-01T00:02:00Z");
  assert.equal(port.rerunContext().job.job_id, job.job_id);
  assert.deepEqual(port.rerunContext().resumePlan, resumePlan);
  assert.deepEqual(currentJobStateModule.createCurrentJobStatePort(state).getSnapshot().diagnostics, diagnostics);
  assert.deepEqual(createJobRenderContextPort(state).currentFor(job.job_id).events, events);
  assert.deepEqual(createSecondaryResourceStatePort(state).cachedFor("events", job.job_id), events);
});

test("status detail runtime port ignores stale resume plans", () => {
  const state = createLegacyStateFixture();
  const job = { job_id: "job-current", status: "failed" };
  currentJobStateModule.syncCurrentJobSnapshot(state, job, job.job_id);
  currentJobStateModule.cacheJobResumePlan(state, "job-old", { can_resume: true });

  const port = createRuntimePort(state);

  assert.equal(port.currentJobId(), job.job_id);
  assert.deepEqual(port.rerunContext().job, job);
  assert.equal(port.rerunContext().resumePlan, null);
});

test("status detail runtime port reads current job store instead of legacy fields", () => {
  const state = createLegacyStateFixture();
  const currentJobPort = currentJobStateModule.createCurrentJobStatePort(state);
  const job = { job_id: "job-store-authority", status: "failed" };
  const resumePlan = { can_resume: true };

  currentJobPort.syncSnapshot(job, job.job_id, {
    startedAt: "2026-02-01T00:00:00Z",
    finishedAt: "2026-02-01T00:03:00Z",
  });
  currentJobPort.cacheResumePlan(job.job_id, resumePlan);

  state.currentJobId = "legacy-wrong";
  state.currentJobSnapshot = { job_id: "legacy-wrong", status: "running" };
  state.currentJobResumePlanJobId = "legacy-wrong";
  state.currentJobResumePlan = { can_resume: false };
  state.currentJobFinishedAt = "legacy-finished-at";

  const port = createRuntimePort(state);

  assert.equal(port.currentJobId(), job.job_id);
  assert.deepEqual(port.currentJobSnapshot(), job);
  assert.deepEqual(port.currentResumePlan(), resumePlan);
  assert.deepEqual(port.rerunContext(), { job, resumePlan });
  assert.equal(port.currentJobFinishedAt(), "2026-02-01T00:03:00Z");
});

test("status detail resume actions route UI side effects through view port", async () => {
  const calls = [];
  const viewPort = {
    closeDialog: () => calls.push(["close"]),
    setRerunAction: (payload) => calls.push(["action", payload.enabled, payload.status]),
    setRerunDisabled: (disabled) => calls.push(["disabled", disabled]),
  };
  const rerunContext = {
    job: {
      job_id: "job-resume-action",
      status: "failed",
      actions: {
        rerun: {
          enabled: true,
          url: "/api/v1/jobs/job-resume-action/rerun",
        },
      },
    },
    resumePlan: { can_resume: true, from_stage: "translation" },
  };
  const textCalls = [];
  const pollingCalls = [];
  const resolveActions = (job) => ({
    rerun: job.actions.rerun.url,
    rerunEnabled: job.actions.rerun.enabled,
  });

  const actionUrl = syncRerunAction({
    ...rerunContext,
    viewPort,
    resolveActions,
  });
  await rerunCurrentJob({
    rerunContext,
    rerunJob: async (url) => {
      calls.push(["rerun", url]);
      return { job_id: "job-resumed-action" };
    },
    setText: (...args) => textCalls.push(args),
    startPolling: (jobId) => pollingCalls.push(jobId),
    viewPort,
    resolveActions,
  });

  assert.match(actionUrl, /\/api\/v1\/jobs\/job-resume-action\/rerun$/);
  assert.deepEqual(calls, [
    ["action", true, "可从 translation 恢复"],
    ["action", true, "正在提交恢复任务..."],
    ["disabled", true],
    ["rerun", actionUrl],
    ["close"],
    // finally 语义：settled 即解禁，成功也不残留禁用。
    ["disabled", false],
  ]);
  assert.deepEqual(textCalls, [["error-box", "已创建恢复任务 job-resumed-action，开始轮询。"]]);
  assert.deepEqual(pollingCalls, ["job-resumed-action"]);
});

test("status detail overview coordinator renders cached snapshot before fresh payload", async () => {
  const state = createLegacyStateFixture();
  const runtimePort = createRuntimePort(state);
  const snapshots = [];
  const renders = [];
  currentJobStateModule.syncCurrentJobSnapshot(state, {
    job_id: "job-overview",
    status: "running",
    display_stage: "translation",
  }, "job-overview");

  const coordinator = createStatusDetailOverviewCoordinator({
    runtimePort,
    apiPrefix: "/api/v1",
    fetchJobPayload: async (jobId, options) => {
      const apiPrefix = typeof options === "string" ? options : options?.apiPrefix;
      assert.equal(jobId, "job-overview");
      assert.equal(apiPrefix, "/api/v1");
      return {
        job_id: "job-overview",
        status: "succeeded",
        display_stage: "done",
      };
    },
    fetchJobEvents: async (_jobId, _apiPrefix, query) => {
      assert.deepEqual(query, { limit: 500, start: "tail" });
      return { items: [{ seq: 2, display_stage: "done" }] };
    },
    fetchJobDiagnostics: async () => ({ summary: "ok" }),
    fetchResumePlan: async () => ({ can_resume: false }),
    fetchJobStageActions: async () => ({
      stages: [{
        stage: "ocr",
        can_retry: true,
        action: { method: "POST", url: "/retry-stage", body: { stage: "ocr" } },
      }],
    }),
    renderJob: (context) => renders.push(context),
    renderOverviewSnapshot: (context) => snapshots.push(context),
  });

  await coordinator.ensureLoaded();

  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].job.job_id, "job-overview");
  assert.equal(snapshots[0].job.status, "running");
  assert.equal(snapshots[1].job.status, "succeeded");
  assert.equal(renders.length, 1);
  assert.equal(runtimePort.currentJobSnapshot().diagnostics.summary, "ok");
  assert.equal(runtimePort.rerunContext().resumePlan.can_resume, false);
  assert.equal(snapshots[1].stageActions.stages[0].action.body.stage, "ocr");
});

test("status detail overview coordinator reuses in-flight refresh", async () => {
  const state = createLegacyStateFixture();
  const runtimePort = createRuntimePort(state);
  currentJobStateModule.syncCurrentJobSnapshot(state, {
    job_id: "job-overview-inflight",
    status: "running",
  }, "job-overview-inflight");
  let fetchCount = 0;
  let resolvePayload;
  const payloadPromise = new Promise((resolve) => {
    resolvePayload = resolve;
  });
  const coordinator = createStatusDetailOverviewCoordinator({
    runtimePort,
    fetchJobPayload: () => {
      fetchCount += 1;
      return payloadPromise;
    },
    renderOverviewSnapshot() {},
  });

  const first = coordinator.ensureLoaded();
  const second = coordinator.ensureLoaded();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCount, 1);
  resolvePayload({ job_id: "job-overview-inflight", status: "succeeded" });
  await Promise.all([first, second]);
  assert.equal(fetchCount, 1);
});

test("status detail overview coordinator ignores stale fresh payloads", async () => {
  const state = createLegacyStateFixture();
  const runtimePort = createRuntimePort(state);
  const renders = [];
  currentJobStateModule.syncCurrentJobSnapshot(state, {
    job_id: "job-a",
    status: "running",
  }, "job-a");
  let resolvePayload;
  const payloadPromise = new Promise((resolve) => {
    resolvePayload = resolve;
  });
  const coordinator = createStatusDetailOverviewCoordinator({
    runtimePort,
    fetchJobPayload: () => payloadPromise,
    fetchJobEvents: async () => ({ items: [{ seq: 1, display_stage: "translation" }] }),
    fetchResumePlan: async () => ({ can_resume: true }),
    renderJob: (context) => renders.push(context),
    renderOverviewSnapshot() {},
  });

  const refresh = coordinator.ensureLoaded();
  await new Promise((resolve) => setImmediate(resolve));
  currentJobStateModule.syncCurrentJobSnapshot(state, {
    job_id: "job-b",
    status: "running",
  }, "job-b");
  resolvePayload({
    job_id: "job-a",
    status: "succeeded",
  });
  await refresh;

  const snapshot = currentJobStateModule.createCurrentJobStatePort(state).getSnapshot();
  assert.equal(snapshot.jobId, "job-b");
  assert.equal(snapshot.snapshot.job_id, "job-b");
  assert.notEqual(snapshot.resumePlanJobId, "job-a");
  assert.equal(renders.length, 0);
});

test("status detail translation data port owns query paging and item selection", async () => {
  const state = createTranslationState();
  let current = "job-translation-port";
  const calls = [];
  const port = createStatusDetailTranslationDataPort({
    translationState: state,
    apiPrefix: "/api/v1",
    currentJobId: () => current,
    fetchTranslationDiagnostics: async (jobId, apiPrefix) => {
      calls.push(["summary", jobId, apiPrefix]);
      return { summary: { counts: { total: 2 } } };
    },
    fetchTranslationItems: async (jobId, apiPrefix, query) => {
      calls.push(["items", jobId, apiPrefix, { ...query }]);
      return {
        total: 2,
        items: [
          { item_id: "item-1" },
          { item_id: "item-2" },
        ],
      };
    },
    fetchTranslationItem: async (jobId, itemId, apiPrefix) => {
      calls.push(["item", jobId, itemId, apiPrefix]);
      return { item_id: itemId, item: { item_id: itemId, source_text: "source" } };
    },
    replayTranslationItem: async (jobId, itemId, apiPrefix) => {
      calls.push(["replay", jobId, itemId, apiPrefix]);
      return { payload: { replay_result: "ok" } };
    },
  });

  port.applyQuery({ finalStatus: "failed", q: "term" });
  const selection = await port.loadSummaryAndItems({ selectFirst: true });
  assert.deepEqual(selection, {
    jobId: "job-translation-port",
    selectedItemId: "item-1",
    shouldLoadSelectedItem: true,
    selectionChanged: true,
  });
  assert.equal(state.query.finalStatus, "failed");
  assert.equal(state.query.q, "term");
  assert.equal(state.query.offset, 0);
  assert.equal(state.summary.summary.counts.total, 2);
  assert.equal(state.selectedItemId, "item-1");

  await port.loadItem(selection.jobId, selection.selectedItemId);
  assert.equal(state.selectedItem.item.item_id, "item-1");
  await port.replaySelectedItem();
  assert.equal(state.replay.payload.replay_result, "ok");

  assert.equal(port.changePage("next"), true);
  assert.equal(state.query.offset, 20);
  const keptSelection = await port.loadItems(current, { selectFirst: true });
  assert.deepEqual(keptSelection, {
    selectedItemId: "item-1",
    shouldLoadSelectedItem: false,
    selectionChanged: false,
  });

  current = "job-other";
  assert.equal(port.syncJob(), "job-other");
  assert.equal(state.jobId, "job-other");
  assert.equal(state.selectedItemId, "");
});

test("status detail translation data port clears stale selected item for empty result pages", async () => {
  const state = createTranslationState();
  state.jobId = "job-empty";
  state.selectedItemId = "item-old";
  state.selectedItem = { item_id: "item-old" };
  state.replay = { payload: {} };
  const port = createStatusDetailTranslationDataPort({
    translationState: state,
    apiPrefix: "/api/v1",
    currentJobId: () => "job-empty",
    fetchTranslationDiagnostics: async () => ({}),
    fetchTranslationItems: async () => ({ total: 0, items: [] }),
    fetchTranslationItem: async () => {
      throw new Error("empty item pages should not load item details");
    },
    replayTranslationItem: async () => ({}),
  });

  const selection = await port.loadItems("job-empty", { selectFirst: true });

  assert.deepEqual(selection, {
    selectedItemId: "",
    shouldLoadSelectedItem: false,
    selectionChanged: true,
  });
  assert.equal(state.selectedItemId, "");
  assert.equal(state.selectedItem, null);
  assert.equal(state.replay, null);
});

test("status detail translation tab coordinator owns render orchestration", async () => {
  const state = createTranslationState();
  const renderCalls = [];
  const dataPort = createStatusDetailTranslationDataPort({
    translationState: state,
    apiPrefix: "/api/v1",
    currentJobId: () => "job-tab",
    fetchTranslationDiagnostics: async () => ({ summary: { counts: { total: 1 } } }),
    fetchTranslationItems: async () => ({
      total: 1,
      items: [{ item_id: "item-tab" }],
    }),
    fetchTranslationItem: async (_jobId, itemId) => ({
      item_id: itemId,
      item: { item_id: itemId },
    }),
    replayTranslationItem: async () => ({ payload: { replay_result: "ok" } }),
  });
  const coordinator = createStatusDetailTranslationTabCoordinator({
    dataPort,
    renderEmpty: (message) => renderCalls.push(["empty", message]),
    renderSummary: () => renderCalls.push(["summary"]),
    renderItems: (options = {}) => renderCalls.push(["items", options]),
    renderItemDetail: (options = {}) => renderCalls.push(["detail", options]),
    renderReplay: () => renderCalls.push(["replay"]),
    setReplayLoading: (payload) => renderCalls.push(["replay-loading", payload]),
  });

  await coordinator.ensureLoaded();

  assert.equal(state.loaded, true);
  assert.equal(state.selectedItemId, "item-tab");
  assert.equal(state.selectedItem.item.item_id, "item-tab");
  assert.deepEqual(renderCalls.map((call) => call[0]), [
    "empty",
    "summary",
    "items",
    "detail",
    "replay",
    "items",
    "detail",
    "replay",
    "detail",
  ]);

  renderCalls.length = 0;
  await coordinator.ensureLoaded();
  assert.deepEqual(renderCalls.map((call) => call[0]), ["summary", "items", "detail", "replay"]);

  renderCalls.length = 0;
  await coordinator.changePage("prev");
  assert.deepEqual(renderCalls, []);
});

test("status detail translation tab coordinator applies filters and replays selected item", async () => {
  const state = createTranslationState();
  let itemCalls = 0;
  const renderCalls = [];
  const dataPort = createStatusDetailTranslationDataPort({
    translationState: state,
    apiPrefix: "/api/v1",
    currentJobId: () => "job-tab-filter",
    fetchTranslationDiagnostics: async () => ({}),
    fetchTranslationItems: async () => ({
      total: 0,
      items: [],
    }),
    fetchTranslationItem: async () => {
      itemCalls += 1;
      return {};
    },
    replayTranslationItem: async () => ({ payload: { replay_result: "ok" } }),
  });
  const coordinator = createStatusDetailTranslationTabCoordinator({
    dataPort,
    renderEmpty: (message) => renderCalls.push(["empty", message]),
    renderSummary: () => renderCalls.push(["summary"]),
    renderItems: (options = {}) => renderCalls.push(["items", options]),
    renderItemDetail: (options = {}) => renderCalls.push(["detail", options]),
    renderReplay: () => renderCalls.push(["replay"]),
    setReplayLoading: (payload) => renderCalls.push(["replay-loading", payload]),
  });

  await coordinator.applyFilter({ finalStatus: "failed", q: "abc" });
  assert.equal(state.query.finalStatus, "failed");
  assert.equal(state.query.q, "abc");
  assert.equal(state.selectedItemId, "");
  assert.equal(itemCalls, 0);
  assert.deepEqual(renderCalls.map((call) => call[0]), [
    "summary",
    "summary",
    "items",
    "detail",
    "replay",
  ]);

  renderCalls.length = 0;
  state.selectedItemId = "item-replay";
  await coordinator.replaySelected();
  assert.equal(state.replay.payload.replay_result, "ok");
  assert.deepEqual(renderCalls.map((call) => call[0]), ["replay-loading", "replay"]);
});

test("status detail rerun: 409 translation ambiguity asks for confirmation, second click retries translation with duplicate risk (#132)", async () => {
  const { createStatusDetailResumeActions } = await import(
    "../../src/features/job-detail/domain/dialog/controller-resume.js"
  );
  const { TRANSLATION_DUPLICATE_RISK_PROMPT } = await import(
    "../../src/features/job-detail/domain/dialog/resume-actions.js"
  );
  const jobFor = (jobId) => ({
    job_id: jobId,
    status: "failed",
    actions: { rerun: { enabled: true, url: `/api/v1/jobs/${jobId}/rerun` } },
  });
  let currentJob = jobFor("job-ambiguous");
  const overviews = [];
  const calls = [];
  const resume = createStatusDetailResumeActions({
    runtimePort: { rerunContext: () => ({ job: currentJob, resumePlan: null }) },
    store: {
      actions: {
        setOverview: (patch) => overviews.push(patch.rerun),
        setRerunPending: () => {},
      },
    },
    dialogStore: { close: () => calls.push(["close"]) },
    rerunJob: async (url) => {
      calls.push(["rerun", url]);
      throw new Error("提交失败: 409 translation request outcome is ambiguous; generic rerun is paused. Use retry-stage with stage=translation and ambiguous_request_policy=accept_duplicate_risk");
    },
    retryTranslationWithRisk: async (jobId) => {
      calls.push(["retry-translation", jobId]);
      return { job_id: "job-retried" };
    },
    setText: () => {},
    startPolling: (jobId) => calls.push(["poll", jobId]),
    resolveActions: (job) => ({ rerun: job.actions.rerun.url, rerunEnabled: job.actions.rerun.enabled }),
  });

  // 第一次：通用重跑被 409 拦下 → 不报英文原文，给出二次确认提示，按钮仍可点。
  await resume.rerunCurrentJob();
  assert.deepEqual(calls, [["rerun", "/api/v1/jobs/job-ambiguous/rerun"]]);
  assert.equal(overviews.at(-1).status, TRANSLATION_DUPLICATE_RISK_PROMPT);
  assert.equal(overviews.at(-1).enabled, true);

  // 换了任务：确认不能带过去，仍先走通用重跑。
  currentJob = jobFor("job-other");
  await resume.rerunCurrentJob();
  assert.deepEqual(calls.at(-1), ["rerun", "/api/v1/jobs/job-other/rerun"]);

  // 回到原任务需要重新确认：再被 409 拦一次 → 第二次点击才走 retry-stage(translation)。
  currentJob = jobFor("job-ambiguous");
  calls.length = 0;
  await resume.rerunCurrentJob();
  await resume.rerunCurrentJob();
  assert.deepEqual(calls, [
    ["rerun", "/api/v1/jobs/job-ambiguous/rerun"],
    ["retry-translation", "job-ambiguous"],
    ["close"],
    ["poll", "job-retried"],
  ]);

  // 确认只用一次：之后再点又回到通用重跑。
  calls.length = 0;
  await resume.rerunCurrentJob();
  assert.deepEqual(calls[0], ["rerun", "/api/v1/jobs/job-ambiguous/rerun"]);
});

test("status detail rerun: non-ambiguity errors are still shown as-is", async () => {
  const overviews = [];
  await rerunCurrentJob({
    rerunContext: {
      job: { job_id: "job-x", status: "failed", actions: { rerun: { enabled: true, url: "/r" } } },
      resumePlan: null,
    },
    rerunJob: async () => { throw new Error("提交失败: 500 boom"); },
    retryTranslationWithRisk: async () => { throw new Error("must not be called"); },
    viewPort: {
      closeDialog: () => {},
      setRerunAction: (payload) => overviews.push(payload.status),
      setRerunDisabled: () => {},
    },
    resolveActions: (job) => ({ rerun: job.actions.rerun.url, rerunEnabled: true }),
  });
  assert.equal(overviews.at(-1), "提交失败: 500 boom");
});
