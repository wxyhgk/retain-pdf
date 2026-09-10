import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveSubmitReadiness,
  SUBMIT_BLOCK_REASONS,
} from "@/platform/contracts/submit-readiness-contract.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { publishSubmitSuccess } from "../../src/features/ingest/domain/actions/submit-flow.js";
import { resolveSubmitControlState } from "../../src/features/ingest/domain/workflow/submit-controls.js";

const workflowNeedsUpload = (workflow) => workflow !== "render";
const workflowNeedsCredentials = (workflow) => workflow !== "render";
const workflowSubmitLabel = (workflow) => workflow === "render" ? "开始渲染" : "直接翻译";

test("resolveSubmitReadiness allows mock submissions without source or credentials", () => {
  const readiness = resolveSubmitReadiness({
    workflow: "book",
    isMock: true,
    needsUpload: true,
    needsCredentials: true,
  });

  assert.equal(readiness.ready, true);
  assert.equal(readiness.reason, SUBMIT_BLOCK_REASONS.NONE);
});

test("resolveSubmitReadiness reports missing browser credentials before source checks", () => {
  const readiness = resolveSubmitReadiness({
    workflow: "book",
    desktopMode: false,
    hasBrowserCredentials: false,
    needsUpload: true,
    needsCredentials: true,
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.credentialsMissing, true);
  assert.equal(readiness.reason, SUBMIT_BLOCK_REASONS.MISSING_CREDENTIALS);
});

test("resolveSubmitReadiness reports missing upload for upload workflows", () => {
  const readiness = resolveSubmitReadiness({
    workflow: "book",
    desktopMode: false,
    hasBrowserCredentials: true,
    needsUpload: true,
    needsCredentials: true,
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.reason, SUBMIT_BLOCK_REASONS.MISSING_UPLOAD);
});

test("resolveSubmitReadiness reports missing render source for render workflows", () => {
  const readiness = resolveSubmitReadiness({
    workflow: "render",
    needsUpload: false,
    needsCredentials: false,
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.reason, SUBMIT_BLOCK_REASONS.MISSING_RENDER_SOURCE);
});

test("resolveSubmitReadiness reports budget blocking after source is ready", () => {
  const readiness = resolveSubmitReadiness({
    workflow: "book",
    uploadId: "upload-1",
    hasBrowserCredentials: true,
    needsUpload: true,
    needsCredentials: true,
    budgetBlocking: true,
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.reason, SUBMIT_BLOCK_REASONS.BUDGET_BLOCKING);
});

test("resolveSubmitControlState consumes shared submit readiness", () => {
  const state = resolveSubmitControlState({
    workflow: "book",
    isMock: false,
    desktopMode: false,
    uploadId: "upload-1",
    renderSourceJobId: "",
    hasBrowserCredentials: true,
    workflowNeedsUpload,
    workflowNeedsCredentials,
    workflowSubmitLabel,
  });

  assert.equal(state.disabled, false);
  assert.equal(state.actionVisible, true);
  assert.equal(state.pageRangeVisible, true);
  assert.equal(state.label, "直接翻译");
  assert.equal(state.readiness.ready, true);
});

test("resolveSubmitControlState disables submit when budget blocks", () => {
  const state = resolveSubmitControlState({
    workflow: "book",
    isMock: false,
    desktopMode: false,
    uploadId: "upload-1",
    renderSourceJobId: "",
    hasBrowserCredentials: true,
    budgetBlocking: true,
    workflowNeedsUpload,
    workflowNeedsCredentials,
    workflowSubmitLabel,
  });

  assert.equal(state.disabled, true);
  assert.equal(state.actionVisible, true);
  assert.equal(state.readiness.reason, SUBMIT_BLOCK_REASONS.BUDGET_BLOCKING);
});

test("resolveSubmitControlState preserves render source disabled behavior", () => {
  const state = resolveSubmitControlState({
    workflow: "render",
    isMock: false,
    desktopMode: false,
    uploadId: "",
    renderSourceJobId: "",
    hasBrowserCredentials: false,
    workflowNeedsUpload,
    workflowNeedsCredentials,
    workflowSubmitLabel,
  });

  assert.equal(state.disabled, true);
  assert.equal(state.actionVisible, true);
  assert.equal(state.pageRangeVisible, false);
  assert.equal(state.label, "开始渲染");
  assert.equal(state.readiness.reason, SUBMIT_BLOCK_REASONS.MISSING_RENDER_SOURCE);
});

test("publishSubmitSuccess transfers the job to runtime before closing the upload dialog", () => {
  const calls = [];
  const timers = [];
  class TestCustomEvent {
    constructor(type) {
      this.type = type;
    }
  }

  publishSubmitSuccess({
    payload: { job_id: "job-new" },
    state: { marker: "state" },
    libraryEventPort: {
      publishJobCreated: (job) => calls.push(["created", job.job_id]),
      requestRefresh: (options) => calls.push(["refresh", options]),
    },
    syncCurrentJobSnapshot: (_state, _payload, jobId) => calls.push(["sync", jobId]),
    renderJob: (job) => calls.push(["render", job.job_id]),
    startJobPolling: (jobId) => calls.push(["poll", jobId]),
    documentRef: {
      defaultView: { CustomEvent: TestCustomEvent },
      dispatchEvent: (event) => {
        calls.push(["event", event.type]);
        return true;
      },
    },
    windowRef: {
      setTimeout: (handler, delay) => {
        timers.push({ handler, delay });
        return timers.length;
      },
    },
    now: () => "2026-09-03T00:00:00.000Z",
  });

  assert.deepEqual(calls, [
    ["created", "job-new"],
    ["sync", "job-new"],
    ["render", "job-new"],
    ["poll", "job-new"],
    ["event", APP_EVENTS.closeTranslationWorkflow],
  ]);
  assert.equal(timers.length, 2);
  assert.equal(timers[0].delay, 800);
  assert.equal(timers[1].delay, 5000);

  timers[0].handler();
  assert.deepEqual(calls.at(-1), ["refresh", { delay: 0, force: false }]);
  // 兜底对账：5 秒后强制刷新一次，保证后端建档稍慢时新任务也可见
  timers[1].handler();
  assert.deepEqual(calls.at(-1), ["refresh", { delay: 0, force: true }]);
});
