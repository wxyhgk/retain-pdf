import test from "node:test";
import assert from "node:assert/strict";

import { mergeSnapshotWithFallback } from "../../src/features/jobs/domain/merge-snapshot-with-fallback.js";

function staleCompletedSnapshot() {
  return {
    jobId: "old-job",
    status: "succeeded",
    label: "完成",
    value: "翻译 PDF 已生成",
    detail: "任务完成",
    stageKey: "done",
    visualStageKey: "done",
    displayPercent: 100,
    progressPercent: 100,
    progressCurrent: 10,
    progressTotal: 10,
    progressFallbackText: "完成",
    progressText: "渲染完成",
    progressUnit: "page",
    progressIndeterminate: false,
    substageKey: "",
    errorText: "",
    stageProgressByKey: { done: { current: 10, total: 10 } },
    stageRetryActions: { render: { canRetry: true } },
    pdfReady: true,
    pdfUrl: "/old.pdf",
    markdownBundleReady: true,
    markdownBundleUrl: "/old.zip",
    readerReady: true,
    readerUrl: "/old-reader",
    sourcePdfReady: true,
    sourcePdfUrl: "/source.pdf",
    cancelEnabled: false,
    backgroundStages: [],
    job: { job_id: "old-job", status: "succeeded" },
    summary: null,
  };
}

test("failed fallback isolates a different job and clears stale terminal progress", () => {
  const merged = mergeSnapshotWithFallback(staleCompletedSnapshot(), {
    job_id: "failed-job",
    status: "failed",
    stage_snapshot: {
      display_stage: "ocr",
      stage_detail: "OCR provider 请求失败",
      progress: { current: 0, total: 20, percent: 0 },
    },
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:02Z",
  });

  assert.equal(merged.jobId, "failed-job");
  assert.equal(merged.status, "failed");
  assert.equal(merged.stageKey, "ocr");
  assert.equal(merged.displayPercent, 0);
  assert.equal(merged.progressPercent, 0);
  assert.deepEqual(merged.stageProgressByKey, {});
  assert.deepEqual(merged.stageRetryActions, {});
  assert.equal(merged.pdfReady, false);
  assert.equal(merged.readerReady, false);
  assert.equal(merged.cancelEnabled, false);
  assert.equal(merged.job?.job_id, "failed-job");
});

test("active fallback keeps the standard cancel action available without an action URL", () => {
  const merged = mergeSnapshotWithFallback(staleCompletedSnapshot(), {
    job_id: "running-job",
    status: "running",
    stage_snapshot: {
      display_stage: "translation",
      stage_detail: "正在翻译正文",
      progress: { current: 12, total: 20, percent: 60 },
    },
  });

  assert.equal(merged.jobId, "running-job");
  assert.equal(merged.status, "running");
  assert.equal(merged.cancelEnabled, true);
});
