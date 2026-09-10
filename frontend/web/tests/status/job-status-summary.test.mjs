import test from "node:test";
import assert from "node:assert/strict";

import {
  progressTextForStageProgress,
  summarizeStageProgressText,
} from "@retainpdf/domain/job-status";
import { buildJobStatusSummaryViewModel } from "@retainpdf/domain/job-status";

test("summarizeStageProgressText formats stable user-facing progress copy", () => {
  assert.equal(
    summarizeStageProgressText({
      status: "running",
      display_stage: "translation",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 2,
        total: 5,
      },
    }),
    "第 2/5 批",
  );

  assert.equal(
    summarizeStageProgressText({
      status: "running",
      display_stage: "render",
      stage: "rendering",
      substage: "render_compile",
      progress: {
        unit: "step",
        current: 1,
        total: 2,
      },
    }),
    "正在编译 PDF",
  );

  assert.equal(
    summarizeStageProgressText({
      status: "running",
      display_stage: "render",
      stage: "rendering",
      substage: "render_prewarm",
      progress: {
        unit: "step",
        current: 1,
        total: 4,
      },
    }),
    "预热 1/4",
  );
});

test("progressTextForStageProgress formats record progress without legacy payload", () => {
  assert.equal(
    progressTextForStageProgress({
      stageKey: "translate",
      substageKey: "translation_batches",
      progress: {
        current: 2,
        total: 5,
        unit: "batch",
      },
    }),
    "第 2/5 批",
  );

  assert.equal(
    progressTextForStageProgress({
      stageKey: "render",
      substageKey: "render_compile",
      progress: {
        current: 1,
        total: 2,
        unit: "step",
      },
    }),
    "正在编译 PDF",
  );

  assert.equal(
    progressTextForStageProgress({
      stageKey: "render",
      substageKey: "render_prewarm",
      progress: {
        current: 1,
        total: 4,
        unit: "step",
      },
    }),
    "预热 1/4",
  );
});

test("job status summary view model owns summary fields without DOM writes", () => {
  const viewModel = buildJobStatusSummaryViewModel({
    job_id: "job-summary-vm",
    status: "failed",
    failure: {
      summary: "翻译失败",
    },
  }, {
    detail: "正在翻译正文内容",
  });

  assert.deepEqual(viewModel.fields, {
    jobId: "job-summary-vm",
    jobIdInput: "job-summary-vm",
    stageDetail: "正在翻译正文内容",
    statusSummary: "任务已失败，请检查报错提示后重试。",
    finishedAt: "-",
    queryFinishedAt: "-",
  });
  assert.equal(viewModel.publicErrorText, "翻译失败");
  assert.equal(viewModel.errorText, "翻译失败");
});
