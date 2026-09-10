import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveDisplayedStagePresentation } from "@retainpdf/domain/job-status";
import { resolveRenderStagePresentation } from "@retainpdf/domain/job-status";
import {
  shouldReplaceCurrentStageProgress,
  shouldReplaceStageProgress,
} from "@retainpdf/domain/job-status";
import {
  compositeRenderProgressFromEvents,
} from "@retainpdf/domain/job-status";
import { summarizeStageProgressText } from "@retainpdf/domain/job-status";
import { resolveSelectedStageContext } from "@retainpdf/domain/job-status";
import { buildSelectedStageDisplay } from "@retainpdf/domain/job-status";
import { currentStageProgressViewModel } from "@retainpdf/domain/job-status";
import {
  buildProgressOptions,
  buildStatusCardProgressPresentation,
  capRunningStagePercent,
} from "@retainpdf/domain/job-status";
// buildProgressRenderModel 随 cutover 从 components/status/job-status-card-rendering.js
// (死,已删除)迁移指向 src/features/jobs/domain/progress-model.js(蓝图判决:
// 45-164 行纯函数拷贝,归属改在新世界,断言口径不变)。
import {
  buildProgressRenderModel,
} from "../../src/features/jobs/domain/progress-model.js";
import {
  buildSubstageViewModel,
  translationSubstageKeyForSnapshot,
} from "@retainpdf/domain/job-status";
import { buildStatusCardPrimaryActions } from "@retainpdf/domain/job-status";
import { buildStatusCardResultActions } from "@retainpdf/domain/job-status";
import { buildStatusCardRetryActions } from "@retainpdf/domain/job-status";
import { normalizeStageRetryActions } from "@retainpdf/domain/job-status";
import { buildStatusCardTaskActions } from "@retainpdf/domain/job-status";
import { buildStatusCardErrorState } from "@retainpdf/domain/job-status";
import {
  effectiveStatusFlowStageKey,
  isSelectableStatusStage,
  resolveSelectedStatusStage,
  STATUS_STAGE_FLOW,
  statusStageLabel,
} from "@retainpdf/domain/job-status";
import {
  normalizeSubstageKey,
  substageCardLabel,
  substageDefaultProgressUnit,
  substageDetail,
  substageLabel,
  substageProgressRange,
  substagesForStage,
  visualStageKeyForSubstage,
} from "@retainpdf/domain/job-status";
import { createLegacyStateFixture } from "../helpers/legacy-state-fixture.mjs";
import { buildStatusCardSnapshot } from "@retainpdf/domain/job-status";
import {
  buildStatusCardPatchPayload,
  buildStatusCardRenderModel,
  createStatusCardViewModelSelector,
  resolveStatusCardStagePresentation,
} from "@retainpdf/domain/job-status";
import {
  buildRuntimeStatusCardPatchPayload,
  buildRuntimeStatusCardSnapshot,
  buildRuntimeStatusCardViewModel,
  finishedAtFallbackForStatusCardRuntime,
  secondaryPayloadForStatusCardJob,
} from "@retainpdf/domain/job-status";

test("status substage badges do not infer translation substages from display text", () => {
  assert.equal(
    translationSubstageKeyForSnapshot({
      stageKey: "translate",
      label: "第 2/4 步 · 跨栏/跨页判断",
      value: "正在判断跨栏/跨页连续段",
      progressText: "第 9/34 页",
    }),
    "translation_batches",
  );
  assert.equal(
    translationSubstageKeyForSnapshot({
      stageKey: "translate",
      substageKey: "continuation_review",
      label: "第 2/4 步 · 跨栏/跨页判断",
    }),
    "continuation_review",
  );
});

test("status card context is the single render model entry point", () => {
  const state = createLegacyStateFixture();
  const job = {
    job_id: "job-status-context",
    status: "running",
    display_stage: "translation",
    stage: "translating",
    substage: "translation_batches",
    progress: {
      unit: "batch",
      current: 28,
      total: 5216,
    },
  };
  const events = {
    items: [
      {
        seq: 10,
        display_stage: "translation",
        lane: "main",
        substage: "translation_batches",
        progress: {
          unit: "batch",
          current: 29,
          total: 5216,
        },
      },
    ],
  };

  const model = buildStatusCardRenderModel({
    state,
    job,
    jobId: job.job_id,
    events,
    manifest: null,
    stageActions: null,
    publicErrorText: "",
  });

  assert.equal(model.jobId, "job-status-context");
  assert.equal(model.stageKey, "translate");
  assert.equal(model.substageKey, "translation_batches");
  assert.equal(model.progressCurrent, 29);
  assert.equal(model.progressTotal, 5216);
});

test("render stage presentation respects trusted public stage while using runtime pin state", () => {
  const state = createLegacyStateFixture();
  const jobId = "job-stage-pin";
  const renderPresentation = resolveRenderStagePresentation({
    state,
    jobId,
    job: {
      job_id: jobId,
      status: "running",
      display_stage: "render",
      progress: { unit: "page", current: 2, total: 10 },
    },
    events: null,
  });

  assert.equal(renderPresentation.stageKey, "render");

  const stalePresentation = resolveRenderStagePresentation({
    state,
    jobId,
    job: {
      job_id: jobId,
      status: "running",
      display_stage: "translation",
      progress: { unit: "batch", current: 3, total: 10 },
    },
    events: null,
  });

  assert.equal(stalePresentation.stageKey, "translate");
  assert.equal(stalePresentation.visualStageKey, "translate");
});

test("render stage presentation follows the current public stage through ui boundary", () => {
  const state = createLegacyStateFixture();
  const jobId = "job-stage-pin-boundary";
  const renderPresentation = resolveRenderStagePresentation({
    state,
    jobId,
    job: {
      job_id: jobId,
      status: "running",
      display_stage: "render",
    },
    events: null,
  });
  const regressedPresentation = resolveRenderStagePresentation({
    state,
    jobId,
    job: {
      job_id: jobId,
      status: "running",
      display_stage: "translation",
    },
    events: null,
  });

  assert.equal(renderPresentation.stageKey, "render");
  assert.equal(regressedPresentation.stageKey, "translate");
  assert.equal(regressedPresentation.visualStageKey, "translate");
  assert.equal(regressedPresentation.detail, "正在翻译正文内容");
});

test("runtime status card snapshot source belongs to job-status boundary", () => {
  const matchingEvents = {
    items: [
      {
        seq: 2,
        display_stage: "translation",
        lane: "main",
        substage: "translation_batches",
        progress: {
          unit: "batch",
          current: 4,
          total: 10,
        },
      },
    ],
  };
  const secondaryResources = {
    events: {
      jobId: "job-runtime-source-model",
      payload: matchingEvents,
    },
    manifest: {
      jobId: "other-job",
      payload: { artifacts: [] },
    },
  };

  assert.equal(
    secondaryPayloadForStatusCardJob(secondaryResources, "manifest", "job-runtime-source-model"),
    null,
  );
  assert.equal(
    secondaryPayloadForStatusCardJob(secondaryResources, "events", "job-runtime-source-model"),
    matchingEvents,
  );

  let fallbackCalls = 0;
  const snapshot = buildRuntimeStatusCardSnapshot({
    currentJob: {
      jobId: "job-runtime-source-model",
      snapshot: {
        job_id: "job-runtime-source-model",
        status: "running",
        display_stage: "translation",
        substage: "translation_batches",
        progress: {
          unit: "batch",
          current: 1,
          total: 10,
        },
      },
    },
    presentationOverride: {
      publicErrorText: "",
    },
    secondaryResources,
    state: createLegacyStateFixture(),
    finishedAtFallback: () => {
      fallbackCalls += 1;
      return "2026-06-17T00:00:00Z";
    },
  });

  assert.equal(snapshot.jobId, "job-runtime-source-model");
  assert.equal(snapshot.progressCurrent, 4);
  assert.equal(snapshot.progressTotal, 10);
  assert.equal(fallbackCalls, 1);
  assert.equal(buildRuntimeStatusCardSnapshot({
    currentJob: {
      jobId: "",
      snapshot: {
        status: "running",
      },
    },
  }), null);
});

test("runtime status card source owns runtime view model and patch payload inputs", () => {
  let fallbackCalls = 0;
  const runtime = {
    state: createLegacyStateFixture(),
    finishedAtFallback: () => {
      fallbackCalls += 1;
      return "2026-06-17T00:00:00Z";
    },
  };
  const job = {
    job_id: "job-runtime-helper",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: {
      unit: "batch",
      current: 2,
      total: 8,
    },
  };
  const events = {
    items: [
      {
        seq: 1,
        display_stage: "translation",
        lane: "main",
        substage: "translation_batches",
        progress: {
          unit: "batch",
          current: 4,
          total: 8,
        },
      },
    ],
  };

  const viewModel = buildRuntimeStatusCardViewModel({
    runtime,
    job,
    jobId: job.job_id,
    events,
    publicErrorText: "",
  });
  const payload = buildRuntimeStatusCardPatchPayload({
    runtime,
    job,
    jobId: job.job_id,
    events,
  });

  assert.equal(viewModel.jobId, "job-runtime-helper");
  assert.equal(viewModel.progressCurrent, 4);
  assert.equal(payload.statusViewModel.progressCurrent, 4);
  assert.equal(payload.stagePresentation, payload.statusViewModel.stagePresentation);
  assert.equal(fallbackCalls, 2);
  assert.equal(finishedAtFallbackForStatusCardRuntime(null), "");
});

test("status card patch payload resolves public error and exposes selected stage presentation", () => {
  const state = createLegacyStateFixture();
  const job = {
    job_id: "job-status-patch",
    status: "failed",
    failure: {
      summary: "模型返回为空",
    },
  };
  const payload = buildStatusCardPatchPayload({
    state,
    job,
    jobId: job.job_id,
    events: { items: [] },
    manifest: null,
    stageActions: null,
  });

  assert.equal(payload.job, job);
  assert.equal(payload.statusViewModel.jobId, "job-status-patch");
  assert.equal(payload.stagePresentation, payload.statusViewModel.stagePresentation);
  assert.match(payload.publicErrorText, /模型返回为空|任务失败/);
});

test("status card selector memoizes stable status card inputs", () => {
  const state = createLegacyStateFixture();
  const stagePresentation = {
    label: "第 2/4 步 · 翻译",
    detail: "正在翻译正文内容",
    stageKey: "translate",
    visualStageKey: "translate",
    progressCurrent: 1,
    progressTotal: 10,
    progressPercent: 10,
    progressText: "第 1/10 批",
    progressUnit: "batch",
    progressIndeterminate: false,
    substageKey: "translation_batches",
  };
  const context = {
    state,
    job: {
      job_id: "job-status-selector",
      status: "running",
      display_stage: "translation",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 1,
        total: 10,
      },
    },
    jobId: "job-status-selector",
    events: { items: [] },
    manifest: null,
    stageActions: null,
    publicErrorText: "",
    stagePresentation,
    finishedAtFallback: "",
  };
  const selector = createStatusCardViewModelSelector();
  const first = selector(context);
  const second = selector({ ...context });
  const third = selector({
    ...context,
    stagePresentation: {
      ...stagePresentation,
      progressText: "完成",
    },
  });

  assert.equal(first, second);
  assert.notEqual(second, third);
  assert.equal(third.progressText, "完成");
});

test("status card stage presentation resolver rejects stale explicit stage", () => {
  const explicit = {
    label: "外部阶段",
    detail: "外部详情",
    stageKey: "render",
  };

  const presentation = resolveStatusCardStagePresentation({
    state: createLegacyStateFixture(),
    job: {
      display_stage: "translation",
    },
    jobId: "job-explicit-stage",
    events: { items: [] },
    stagePresentation: explicit,
  });

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.detail, "正在翻译正文内容");
});

test("status substage view model owns visible active and done states", () => {
  const viewModel = buildSubstageViewModel({
    selectedStageKey: "translate",
    selectedIsCurrent: true,
    snapshot: {
      stageKey: "translate",
      substageKey: "garbled_repair",
    },
    selectedProgress: {
      substageKey: "garbled_repair",
      bySubstage: {
        continuation_review: { current: 2, total: 2 },
        translation_batches: { current: 30, total: 40 },
        garbled_repair: { current: 1, total: 3 },
      },
    },
  });

  assert.equal(viewModel.hidden, false);
  assert.equal(viewModel.activeKey, "garbled_repair");
  assert.equal(viewModel.cssCount, 5);
  assert.deepEqual(
    viewModel.items.map((item) => [item.key, item.label, item.active, item.done]),
    [
      ["continuation_review", "跨栏/跨页", false, true],
      ["page_policies", "页面策略", false, true],
      ["translation_batches", "翻译批次", false, true],
      ["translation_tail_retry", "尾部重试", false, true],
      ["garbled_repair", "乱码修复", true, false],
    ],
  );
});

test("status substage view model shows render substages from progress records", () => {
  const viewModel = buildSubstageViewModel({
    selectedStageKey: "render",
    selectedIsCurrent: true,
    snapshot: {
      stageKey: "render",
      substageKey: "render_compile",
    },
    selectedProgress: {
      substageKey: "render_compile",
      bySubstage: {
        render_pages: { current: 45, total: 100, progressText: "第 50/100 页" },
        render_compile: { current: 90, total: 100, progressText: "正在编译 PDF" },
      },
    },
  });

  assert.equal(viewModel.hidden, false);
  assert.equal(viewModel.activeKey, "render_compile");
  assert.deepEqual(
    viewModel.items.map((item) => [item.key, item.label, item.active, item.done]),
    [
      ["render_pages", "页面", false, true],
      ["render_compile", "编译", true, false],
    ],
  );
});

test("status substage view model fills reached substages before the active one", () => {
  const viewModel = buildSubstageViewModel({
    selectedStageKey: "render",
    selectedIsCurrent: true,
    snapshot: {
      stageKey: "render",
      substageKey: "render_compile",
    },
    selectedProgress: {
      substageKey: "render_compile",
      bySubstage: {
        render_compile: { current: 4, total: 4, progressText: "渲染完成" },
      },
    },
  });

  assert.equal(viewModel.hidden, false);
  assert.deepEqual(
    viewModel.items.map((item) => [item.key, item.active, item.done]),
    [
      ["render_prepare", false, true],
      ["render_prewarm", false, true],
      ["render_pages", false, true],
      ["render_compile", true, false],
    ],
  );
});

test("status substage view model hides unknown or unavailable substages", () => {
  const viewModel = buildSubstageViewModel({
    selectedStageKey: "render",
    selectedIsCurrent: false,
    snapshot: {
      stageKey: "translate",
      substageKey: "translation_batches",
    },
    selectedProgress: {
      bySubstage: {
        translation_batches: { current: 1, total: 2 },
      },
    },
  });

  assert.equal(viewModel.hidden, true);
  assert.equal(viewModel.activeKey, "");
  assert.equal(viewModel.cssCount, 1);
  assert.deepEqual(viewModel.items, []);
});

test("terminal stage flow fallback does not infer done without explicit stage", () => {
  assert.equal(
    effectiveStatusFlowStageKey({
      stageKey: "",
      status: "succeeded",
      stageProgressByKey: {
        ocr: { current: 1, total: 1 },
        done: { current: 100, total: 100 },
      },
    }),
    "",
  );
});

test("status substage contract centralizes aliases labels and details", () => {
  assert.equal(normalizeSubstageKey("provider_processing"), "ocr_processing");
  assert.equal(normalizeSubstageKey("render_preprocess"), "render_prepare");
  assert.equal(substageLabel("continuation_review"), "跨栏/跨页判断");
  assert.equal(substageCardLabel("continuation_review"), "跨栏/跨页");
  assert.equal(substageDetail("continuation_review"), "正在判断跨栏/跨页连续段");
  assert.equal(substageDefaultProgressUnit("continuation_review"), "page");
  assert.equal(substageDefaultProgressUnit("translation_batches"), "batch");
  assert.equal(substageDefaultProgressUnit("agent_repair"), "step");
  assert.equal(visualStageKeyForSubstage("ocr", "provider_processing"), "ocr_processing");
  assert.equal(visualStageKeyForSubstage("ocr", "normalizing"), "ocr_normalizing");
  assert.equal(visualStageKeyForSubstage("translate", "translation_batches"), "");
  assert.deepEqual(substageProgressRange("continuation_review"), [10, 18]);
  assert.deepEqual(
    substagesForStage("translate").map((item) => item.key),
    [
      "translation_prepare",
      "domain_inference",
      "continuation_review",
      "page_policies",
      "translation_batches",
      "translation_tail_retry",
      "garbled_repair",
      "agent_repair",
      "final_untranslated_recovery",
    ],
  );
  assert.deepEqual(substageProgressRange("render_pages"), null);
  assert.deepEqual(
    substagesForStage("render").map((item) => item.key),
    ["render_prepare", "render_prewarm", "render_pages", "render_compile"],
  );
});

test("status progress replacement policy is stable", () => {
  assert.equal(
    shouldReplaceCurrentStageProgress({ seq: 10 }, { seq: 9 }),
    false,
  );
  assert.equal(
    shouldReplaceCurrentStageProgress({ seq: 10 }, { seq: 11 }),
    true,
  );
  assert.equal(
    shouldReplaceStageProgress(
      { stageKey: "translate", progressUnit: "batch", seq: 20 },
      { stageKey: "translate", progressUnit: "page", seq: 19 },
    ),
    false,
  );
  assert.equal(
    shouldReplaceStageProgress(
      { stageKey: "ocr", progressUnit: "step" },
      { stageKey: "ocr", progressUnit: "page", current: 1, total: 10 },
    ),
    true,
  );
});

test("structured substage labels and details are stable", () => {
  assert.equal(
    summarizeStageProgressText({
      status: "running",
      display_stage: "render",
      stage: "rendering",
      substage: "render_compile",
      progress: {
        unit: "step",
        current: 1,
        total: 4,
      },
    }),
    "正在编译 PDF",
  );
  const ocrNormalizing = resolveDisplayedStagePresentation({
    job_id: "job-ocr-normalizing",
    status: "running",
    display_stage: "ocr",
    stage: "normalizing",
    substage: "normalizing",
    progress: {
      unit: "step",
      current: 1,
      total: 2,
    },
  }, null);
  assert.equal(ocrNormalizing.label, "第 1/4 步 · 标准化");
  assert.equal(ocrNormalizing.detail, "正在整理 OCR 结果");

  const translationPrepare = resolveDisplayedStagePresentation({
    job_id: "job-translation-prepare",
    status: "running",
    display_stage: "translation",
    stage: "translating",
    substage: "translation_prepare",
    progress: {
      unit: "step",
      current: 1,
      total: 3,
    },
  }, null);
  assert.equal(translationPrepare.label, "第 2/4 步 · 翻译准备");
  assert.equal(translationPrepare.detail, "正在准备翻译任务");

  const renderCompile = resolveDisplayedStagePresentation({
    job_id: "job-render-compile",
    status: "running",
    display_stage: "render",
    stage: "rendering",
    substage: "render_compile",
    progress: {
      unit: "step",
      current: 1,
      total: 4,
    },
  }, null);
  assert.equal(renderCompile.label, "第 3/4 步 · 编译");
  assert.equal(renderCompile.detail, "正在编译 PDF");
});

test("structured substage matrix uses stable display copy", () => {
  const cases = [
    ["ocr", "ocr_submitting", "第 1/4 步 · 启动", "正在启动 OCR 子任务", "进度 1/3"],
    ["ocr", "ocr_upload", "第 1/4 步 · 上传", "正在上传 PDF", "第 2/34 页"],
    ["ocr", "provider_processing", "第 1/4 步 · OCR 解析", "正在执行云端 OCR", "第 12/34 页"],
    ["ocr", "ocr_result_ready", "第 1/4 步 · 结果整理", "OCR 结果已就绪", "进度 1/1"],
    ["ocr", "normalizing", "第 1/4 步 · 标准化", "正在整理 OCR 结果", "进度 1/2"],
    ["translation", "translation_prepare", "第 2/4 步 · 翻译准备", "正在准备翻译任务", "进度 1/3"],
    ["translation", "domain_inference", "第 2/4 步 · 领域判断", "正在识别文档领域和术语", "进度 1/2"],
    ["translation", "page_policies", "第 2/4 步 · 页面策略", "正在判断正文与保留排版内容", "第 8/34 页"],
    ["translation", "continuation_review", "第 2/4 步 · 跨栏/跨页判断", "正在判断跨栏/跨页连续段", "第 9/34 页"],
    ["translation", "translation_batches", "第 2/4 步 · 翻译", "正在翻译正文内容", "第 789/5216 批"],
    ["translation", "translation_tail_retry", "第 2/4 步 · 尾部重试", "正在重试剩余翻译批次", "第 3/7 批"],
    ["translation", "garbled_repair", "第 2/4 步 · 乱码修复", "正在修复乱码候选段", "第 4/10 批"],
    ["translation", "agent_repair", "第 2/4 步 · 结果修复", "正在修复翻译结果", "第 5/11 批"],
    ["translation", "final_untranslated_recovery", "第 2/4 步 · 最终收口", "正在处理未翻译内容", "第 6/12 批"],
    ["render", "render_prepare", "第 3/4 步 · 准备", "正在准备渲染资源", "准备 1/3"],
    ["render", "render_prewarm", "第 3/4 步 · 预热", "正在预热渲染资源", "预热 2/3"],
    ["render", "render_pages", "第 3/4 步 · 页面", "正在生成页面内容", "第 18/34 页"],
    ["render", "render_compile", "第 3/4 步 · 编译", "正在编译 PDF", "正在编译 PDF"],
  ];
  const progressBySubstage = {
    ocr_submitting: { unit: "step", current: 1, total: 3 },
    ocr_upload: { unit: "page", current: 2, total: 34 },
    provider_processing: { unit: "page", current: 12, total: 34 },
    ocr_result_ready: { unit: "step", current: 1, total: 1 },
    normalizing: { unit: "step", current: 1, total: 2 },
    translation_prepare: { unit: "step", current: 1, total: 3 },
    domain_inference: { unit: "step", current: 1, total: 2 },
    page_policies: { unit: "page", current: 8, total: 34 },
    continuation_review: { unit: "page", current: 9, total: 34 },
    translation_batches: { unit: "batch", current: 789, total: 5216 },
    translation_tail_retry: { unit: "batch", current: 3, total: 7 },
    garbled_repair: { unit: "batch", current: 4, total: 10 },
    agent_repair: { unit: "batch", current: 5, total: 11 },
    final_untranslated_recovery: { unit: "batch", current: 6, total: 12 },
    render_prepare: { unit: "step", current: 1, total: 3 },
    render_prewarm: { unit: "step", current: 2, total: 3 },
    render_pages: { unit: "page", current: 18, total: 34 },
    render_compile: { unit: "step", current: 1, total: 4 },
  };

  for (const [displayStage, substage, label, detail, progressText] of cases) {
    const presentation = resolveDisplayedStagePresentation({
      job_id: `job-${substage}`,
      status: "running",
      display_stage: displayStage,
      stage: `${substage}_internal`,
      substage,
      lane: "main",
      progress: progressBySubstage[substage],
    }, null);

    assert.equal(presentation.label, label, substage);
    assert.equal(presentation.detail, detail, substage);
    assert.equal(presentation.progressText, progressText, substage);
  }
});

test("structured percent progress is displayed as percent before render substage copy", () => {
  assert.equal(
    summarizeStageProgressText({
      status: "running",
      display_stage: "render",
      stage: "rendering",
      substage: "render_compile",
      progress: {
        unit: "percent",
        current: 85,
        total: 100,
      },
    }),
    "进度 85%",
  );
});

test("completed render compile step hides internal step count", () => {
  assert.equal(
    summarizeStageProgressText({
      status: "running",
      display_stage: "render",
      stage: "rendering",
      substage: "render_compile",
      progress: {
        unit: "step",
        current: 4,
        total: 4,
      },
    }),
    "渲染完成",
  );
});

test("done stage inherits the last render progress for the status card", () => {
  const context = resolveSelectedStageContext({
    snapshot: {
      stageKey: "done",
      status: "succeeded",
      progressCurrent: 100,
      progressTotal: 100,
      progressText: "翻译 PDF 已生成",
      progressUnit: "percent",
      stageProgressByKey: {
        render: {
          current: 100,
          total: 100,
          progressText: "渲染完成",
          progressUnit: "percent",
          visualStageKey: "render_compile",
          substageKey: "render_compile",
        },
      },
    },
    selectedStageKey: "",
  });

  assert.equal(context.selected, "done");
  assert.equal(context.selectedProgress.progressText, "渲染完成");
  assert.equal(context.selectedProgress.visualStageKey, "render_compile");
  assert.equal(context.selectedProgress.current, 100);
  assert.equal(context.selectedProgress.total, 100);
  assert.equal(context.selectedProgress.displayPercent, 100);
});

test("succeeded done stage keeps render visual state but forces 100 percent", () => {
  const context = resolveSelectedStageContext({
    snapshot: {
      stageKey: "done",
      status: "succeeded",
      progressCurrent: 100,
      progressTotal: 100,
      progressText: "翻译 PDF 已生成",
      progressUnit: "percent",
      stageProgressByKey: {
        render: {
          current: 90,
          total: 100,
          progressText: "正在编译 PDF",
          progressUnit: "percent",
          visualStageKey: "render_compile",
          substageKey: "render_compile",
        },
      },
    },
    selectedStageKey: "",
  });

  assert.equal(context.selectedProgress.current, 100);
  assert.equal(context.selectedProgress.total, 100);
  assert.equal(context.selectedProgress.displayPercent, 100);
  assert.equal(context.selectedProgress.progressText, "渲染完成");
  assert.equal(context.selectedProgress.visualStageKey, "render_compile");
});

test("completed done stage keeps render visual state but forces 100 percent", () => {
  const context = resolveSelectedStageContext({
    snapshot: {
      stageKey: "done",
      status: "completed",
      progressCurrent: 4,
      progressTotal: 100,
      progressText: "编译 4/4",
      progressUnit: "step",
      stageProgressByKey: {
        render: {
          current: 4,
          total: 100,
          progressText: "编译 4/4",
          progressUnit: "step",
          visualStageKey: "render_compile",
          substageKey: "render_compile",
        },
      },
    },
    selectedStageKey: "",
  });

  assert.equal(context.selectedProgress.current, 100);
  assert.equal(context.selectedProgress.total, 100);
  assert.equal(context.selectedProgress.displayPercent, 100);
  assert.equal(context.selectedProgress.progressText, "渲染完成");
  assert.equal(context.selectedProgress.progressUnit, "percent");
  assert.equal(context.selectedProgress.visualStageKey, "render_compile");
});

test("done stage progress policy is owned by the status progress view model", () => {
  const progress = currentStageProgressViewModel({
    stageKey: "done",
    status: "succeeded",
    progressCurrent: 100,
    progressTotal: 100,
    progressText: "翻译 PDF 已生成",
    progressUnit: "percent",
    stageProgressByKey: {
      render: {
        current: 88,
        total: 100,
        progressText: "正在编译 PDF",
        progressUnit: "percent",
        visualStageKey: "render_compile",
        substageKey: "render_compile",
      },
    },
  }, {
    normalizeSelectedProgress: (value) => value,
  });

  assert.equal(progress.current, 100);
  assert.equal(progress.total, 100);
  assert.equal(progress.displayPercent, 100);
  assert.equal(progress.progressText, "渲染完成");
  assert.equal(progress.progressUnit, "percent");
  assert.equal(progress.visualStageKey, "render_compile");
  assert.equal(progress.substageKey, "render_compile");
});

test("status card primary actions are visible only for selected done stage", () => {
  const snapshot = {
    pdfReady: true,
    pdfUrl: "/api/v1/jobs/job-1/pdf",
    markdownBundleReady: true,
    markdownBundleUrl: "/api/v1/jobs/job-1/artifacts/markdown_zip",
    readerReady: true,
    readerUrl: "/reader.html?job_id=job-1",
    sourcePdfReady: true,
    sourcePdfUrl: "/api/v1/jobs/job-1/artifacts/source_pdf",
  };

  assert.deepEqual(
    buildStatusCardPrimaryActions({
      selectedStageKey: "done",
      snapshot,
    }),
    {
      pdfReady: true,
      pdfUrl: "/api/v1/jobs/job-1/pdf",
      markdownBundleReady: true,
      markdownBundleUrl: "/api/v1/jobs/job-1/artifacts/markdown_zip",
      readerReady: true,
      readerUrl: "/reader.html?job_id=job-1",
      sourcePdfReady: true,
      sourcePdfUrl: "/api/v1/jobs/job-1/artifacts/source_pdf",
    },
  );
  assert.deepEqual(
    buildStatusCardPrimaryActions({
      selectedStageKey: "render",
      snapshot,
    }),
    {
      pdfReady: false,
      pdfUrl: "/api/v1/jobs/job-1/pdf",
      markdownBundleReady: false,
      markdownBundleUrl: "/api/v1/jobs/job-1/artifacts/markdown_zip",
      readerReady: false,
      readerUrl: "/reader.html?job_id=job-1",
      sourcePdfReady: false,
      sourcePdfUrl: "/api/v1/jobs/job-1/artifacts/source_pdf",
    },
  );
});

test("status card result actions view model owns artifact readiness", () => {
  const manifest = {
    items: [
      {
        artifact_key: "source_pdf",
        ready: true,
        resource_path: "/api/v1/jobs/job-result-actions/artifacts/source_pdf",
      },
      {
        artifact_key: "markdown_bundle_zip",
        ready: true,
        resource_path: "/api/v1/jobs/job-result-actions/artifacts/markdown_bundle_zip",
      },
      {
        artifact_key: "pdf",
        ready: true,
        resource_path: "/api/v1/jobs/job-result-actions/pdf",
      },
    ],
  };

  const succeeded = buildStatusCardResultActions({
    job: {
      job_id: "job-result-actions",
      status: "succeeded",
      display_stage: "done",
      output_pdf_ready: true,
      pdf_url: "/api/v1/jobs/job-result-actions/pdf",
    },
    manifest,
  });
  assert.equal(succeeded.readerReady, true);
  assert.equal(succeeded.sourcePdfReady, true);
  assert.equal(succeeded.markdownBundleReady, true);
  assert.match(succeeded.markdownBundleUrl, /include_job_dir=true/);
  assert.equal(succeeded.pdfReady, true);

  const activeStageSucceeded = buildStatusCardResultActions({
    job: {
      job_id: "job-active-stage-result-actions",
      status: "succeeded",
      display_stage: "render",
      output_pdf_ready: true,
      pdf_url: "/api/v1/jobs/job-active-stage-result-actions/pdf",
    },
    manifest,
  });
  assert.equal(activeStageSucceeded.readerReady, false);
  assert.equal(activeStageSucceeded.sourcePdfReady, false);
  assert.equal(activeStageSucceeded.markdownBundleReady, false);
  assert.equal(activeStageSucceeded.pdfReady, false);

  const running = buildStatusCardResultActions({
    job: {
      job_id: "job-result-actions",
      status: "running",
      actions: {
        cancel: {
          enabled: true,
          url: "/api/v1/jobs/job-result-actions/cancel",
        },
      },
    },
    manifest,
  });
  assert.equal(running.readerReady, false);
  assert.equal(running.sourcePdfReady, false);
  assert.equal(running.markdownBundleReady, false);
  assert.equal(running.pdfReady, false);
});

test("status card task actions view model owns cancel readiness", () => {
  const succeeded = buildStatusCardTaskActions({
    job: {
      job_id: "job-task-actions",
      status: "succeeded",
    },
  });
  assert.equal(succeeded.cancelEnabled, false);

  const running = buildStatusCardTaskActions({
    job: {
      job_id: "job-task-actions",
      status: "running",
      actions: {
        cancel: {
          enabled: true,
          url: "/api/v1/jobs/job-task-actions/cancel",
        },
      },
    },
  });
  assert.equal(running.cancelEnabled, true);

  const runningWithoutActionUrl = buildStatusCardTaskActions({
    job: {
      job_id: "job-task-actions-with-standard-route",
      status: "running",
    },
  });
  assert.equal(
    runningWithoutActionUrl.cancelEnabled,
    true,
    "标准 jobs cancel 路由存在时不应强制要求 action URL",
  );
});

test("status card retry actions view model owns stage action normalization", () => {
  const actions = buildStatusCardRetryActions({
    stages: [
      {
        stage: "translation",
        label: "重新翻译",
        can_retry: true,
      },
      {
        stage: "render",
        can_retry: false,
        disabled_reason: "等待翻译完成",
      },
    ],
  });

  assert.equal(actions.translate.stage, "translation");
  assert.equal(actions.translate.label, "重新翻译");
  assert.equal(actions.translate.canRetry, true);
  assert.equal(actions.render.stage, "render");
  assert.equal(actions.render.canRetry, false);
  assert.equal(actions.render.disabledReason, "等待翻译完成");
});

test("ui layer no longer keeps legacy stage action helper", () => {
  assert.equal(
    fs.existsSync(path.resolve("src/js/ui/stage-actions.js")),
    false,
  );
  assert.equal(typeof normalizeStageRetryActions, "function");
});

test("status card error state is owned by the status error view model", () => {
  assert.deepEqual(
    buildStatusCardErrorState({
      stageKey: "failed",
      errorText: "翻译失败",
    }),
    {
      errorText: "翻译失败",
      isErrorStage: true,
      showError: true,
      bodyHasError: true,
    },
  );
  assert.deepEqual(
    buildStatusCardErrorState({
      stageKey: "canceled",
      errorText: "用户取消",
    }),
    {
      errorText: "用户取消",
      isErrorStage: true,
      showError: true,
      bodyHasError: true,
    },
  );
  assert.deepEqual(
    buildStatusCardErrorState({
      stageKey: "translate",
      errorText: "后台诊断文本",
    }),
    {
      errorText: "后台诊断文本",
      isErrorStage: false,
      showError: false,
      bodyHasError: false,
    },
  );
  assert.deepEqual(
    buildStatusCardErrorState({
      stageKey: "failed",
      errorText: "   ",
    }),
    {
      errorText: "",
      isErrorStage: true,
      showError: false,
      bodyHasError: false,
    },
  );
});

test("selected stage display view model groups display state for the status card", () => {
  const display = buildSelectedStageDisplay({
    selectedStageKey: "done",
    snapshot: {
      stageKey: "done",
      status: "succeeded",
      detail: "翻译 PDF 已生成",
      pdfReady: true,
      pdfUrl: "/api/v1/jobs/job-1/pdf",
      markdownBundleReady: true,
      markdownBundleUrl: "/api/v1/jobs/job-1/artifacts/markdown_zip",
      readerReady: true,
      readerUrl: "/reader.html?job_id=job-1",
      sourcePdfReady: true,
      sourcePdfUrl: "/api/v1/jobs/job-1/artifacts/source_pdf",
      stageRetryActions: {
        render: { enabled: true },
      },
      stageProgressByKey: {
        render: {
          current: 90,
          total: 100,
          progressText: "正在编译 PDF",
          progressUnit: "percent",
          visualStageKey: "render_compile",
          substageKey: "render_compile",
        },
      },
    },
  });

  assert.equal(display.selected, "done");
  assert.equal(display.selectedIsCurrent, true);
  assert.equal(display.visualStageKey, "render_compile");
  assert.equal(display.detailText, "翻译 PDF 已生成");
  assert.equal(display.showDetail, true);
  assert.equal(display.errorState.showError, false);
  assert.equal(display.primaryActions.pdfReady, true);
  assert.equal(display.primaryActions.readerReady, true);
  assert.equal(display.retryAction, undefined);

  const renderDisplay = buildSelectedStageDisplay({
    selectedStageKey: "render",
    snapshot: {
      stageKey: "done",
      status: "succeeded",
      detail: "翻译 PDF 已生成",
      pdfReady: true,
      pdfUrl: "/api/v1/jobs/job-1/pdf",
      readerReady: true,
      readerUrl: "/reader.html?job_id=job-1",
      stageRetryActions: {
        render: { enabled: true },
      },
      stageProgressByKey: {
        render: {
          current: 90,
          total: 100,
          progressText: "正在编译 PDF",
          progressUnit: "percent",
          visualStageKey: "render_compile",
          substageKey: "render_compile",
        },
      },
    },
  });

  assert.equal(renderDisplay.selected, "render");
  assert.equal(renderDisplay.selectedIsCurrent, false);
  assert.equal(renderDisplay.visualStageKey, "render_compile");
  assert.equal(renderDisplay.primaryActions.pdfReady, false);
  assert.equal(renderDisplay.primaryActions.readerReady, false);
  assert.deepEqual(renderDisplay.retryAction, { enabled: true });
});

test("done stage progress options keep the ring visible at 100 percent", () => {
  const selectedProgress = {
    current: 100,
    total: 100,
    progressText: "渲染完成",
    progressUnit: "percent",
  };
  const options = buildProgressOptions({
    selected: "done",
    selectedIsCurrent: true,
    snapshot: {
      stageKey: "done",
      status: "succeeded",
      progressFallbackText: "-",
      progressPercent: 100,
    },
    selectedProgress,
  });

  assert.equal(options.current, 100);
  assert.equal(options.total, 100);
  assert.equal(options.displayPercent, 100);
  assert.equal(options.progressText, "渲染完成");
  assert.equal(options.progressUnit, "percent");
  assert.equal(options.forceVisible, true);
});

test("running stage progress options cap terminal-looking percent before rendering", () => {
  const options = buildProgressOptions({
    selected: "translate",
    selectedIsCurrent: true,
    snapshot: {
      stageKey: "translate",
      status: "running",
      progressFallbackText: "-",
      progressPercent: 100,
    },
    selectedProgress: {
      current: 100,
      total: 100,
      displayPercent: 100,
      progressText: "正在翻译正文内容",
      progressUnit: "percent",
    },
  });

  assert.equal(options.displayPercent, 99);
  assert.equal(options.percent, 99);
  assert.equal(options.stageKey, "translate");
});

test("status card progress keeps measured batch text and explicit display percent", () => {
  const options = buildProgressOptions({
    selected: "translate",
    selectedIsCurrent: true,
    snapshot: {
      stageKey: "translate",
      status: "running",
      progressFallbackText: "-",
      progressPercent: 75,
    },
    selectedProgress: {
      current: 28,
      total: 5216,
      displayPercent: 75,
      progressText: "第 28/5216 批",
      progressUnit: "batch",
    },
  });
  const renderModel = buildProgressRenderModel(options);

  assert.equal(options.current, 28);
  assert.equal(options.total, 5216);
  assert.equal(options.displayPercent, 75);
  assert.equal(Number.isNaN(options.percent), true);
  assert.equal(options.progressText, "第 28/5216 批");
  assert.equal(options.progressUnit, "batch");
  assert.equal(renderModel.text, "第 28/5216 批");
  assert.equal(Math.round(renderModel.percent * 100) / 100, 75);
});

test("snapshot-only translation progress derives local substage percent for ring", () => {
  const context = resolveSelectedStageContext({
    snapshot: {
      stageKey: "translate",
      status: "running",
      progressCurrent: 28,
      progressTotal: 5216,
      progressText: "第 28/5216 批",
      progressUnit: "batch",
      substageKey: "translation_batches",
      progressFallbackText: "-",
      stageProgressByKey: {},
    },
    selectedStageKey: "",
  });
  const options = buildProgressOptions({
    selected: context.selected,
    selectedIsCurrent: context.selectedIsCurrent,
    snapshot: {
      stageKey: "translate",
      status: "running",
      progressPercent: 75,
      progressFallbackText: "-",
    },
    selectedProgress: context.selectedProgress,
  });
  const renderModel = buildProgressRenderModel(options);

  assert.equal(context.selectedProgress.progressUnit, "batch");
  assert.equal(Math.round(context.selectedProgress.displayPercent * 100) / 100, 0.54);
  assert.equal(Math.round(options.displayPercent * 100) / 100, 0.54);
  assert.equal(Math.round(renderModel.percent * 100) / 100, 0.54);
});

test("snapshot-only translation progress derives each substage local percent", () => {
  const cases = [
    ["translation_prepare", "step", 1, 4, 25],
    ["domain_inference", "step", 2, 4, 50],
    ["continuation_review", "page", 3, 4, 75],
    ["page_policies", "page", 1, 5, 20],
    ["translation_batches", "batch", 4, 8, 50],
    ["translation_tail_retry", "batch", 3, 6, 50],
    ["garbled_repair", "step", 1, 2, 50],
    ["agent_repair", "step", 1, 2, 50],
    ["final_untranslated_recovery", "step", 1, 2, 50],
  ];
  for (const [substageKey, progressUnit, current, total, expectedPercent] of cases) {
    const context = resolveSelectedStageContext({
      snapshot: {
        stageKey: "translate",
        status: "running",
        progressCurrent: current,
        progressTotal: total,
        progressText: `${current}/${total}`,
        progressUnit,
        substageKey,
        progressFallbackText: "-",
        stageProgressByKey: {},
      },
      selectedStageKey: "",
    });
    const options = buildProgressOptions({
      selected: context.selected,
      selectedIsCurrent: context.selectedIsCurrent,
      snapshot: {
        stageKey: "translate",
        status: "running",
        progressFallbackText: "-",
      },
      selectedProgress: context.selectedProgress,
    });

    assert.equal(context.selectedProgress.substageKey, substageKey);
    assert.equal(context.selectedProgress.displayPercent, expectedPercent);
    assert.equal(buildProgressRenderModel(options).percent, expectedPercent);
  }
});

test("snapshot-only translation progress recognizes substage from visual and payload fields", () => {
  const context = resolveSelectedStageContext({
    snapshot: {
      stageKey: "translate",
      status: "running",
      progressCurrent: 1,
      progressTotal: 2,
      progressText: "乱码修复 1/2",
      progressUnit: "step",
      substageKey: "",
      visualStageKey: "garbled_repair",
      progressFallbackText: "-",
      stageProgressByKey: {},
    },
    selectedStageKey: "",
  });

  assert.equal(context.selectedProgress.substageKey, "garbled_repair");
  assert.equal(context.selectedProgress.displayPercent, 50);
});

test("snapshot-only render progress derives composite percent for ring", () => {
  const pageContext = resolveSelectedStageContext({
    snapshot: {
      stageKey: "render",
      status: "running",
      progressCurrent: 7,
      progressTotal: 14,
      progressText: "第 7/14 页",
      progressUnit: "page",
      substageKey: "render_pages",
      progressFallbackText: "-",
      stageProgressByKey: {},
    },
    selectedStageKey: "",
  });
  const pageOptions = buildProgressOptions({
    selected: pageContext.selected,
    selectedIsCurrent: pageContext.selectedIsCurrent,
    snapshot: {
      stageKey: "render",
      status: "running",
      progressFallbackText: "-",
    },
    selectedProgress: pageContext.selectedProgress,
  });

  assert.equal(pageContext.selectedProgress.progressUnit, "percent");
  assert.equal(pageContext.selectedProgress.displayPercent, 45);
  assert.equal(buildProgressRenderModel(pageOptions).percent, 45);

  const compileContext = resolveSelectedStageContext({
    snapshot: {
      stageKey: "render",
      status: "running",
      progressCurrent: 1,
      progressTotal: 4,
      progressText: "编译 1/4",
      progressUnit: "step",
      substageKey: "render_compile",
      progressFallbackText: "-",
      stageProgressByKey: {},
    },
    selectedStageKey: "",
  });
  const compileOptions = buildProgressOptions({
    selected: compileContext.selected,
    selectedIsCurrent: compileContext.selectedIsCurrent,
    snapshot: {
      stageKey: "render",
      status: "running",
      progressFallbackText: "-",
    },
    selectedProgress: compileContext.selectedProgress,
  });

  assert.equal(compileContext.selectedProgress.displayPercent, 85);
  assert.equal(buildProgressRenderModel(compileOptions).percent, 85);
});

test("status card progress options cap running stages but not done or succeeded stages", () => {
  assert.equal(buildProgressOptions({
    selected: "translate",
    selectedIsCurrent: true,
    snapshot: {
      stageKey: "translate",
      status: "running",
      progressFallbackText: "-",
      progressPercent: 100,
    },
    selectedProgress: {
      current: 100,
      total: 100,
      displayPercent: 100,
      progressText: "翻译完成",
      progressUnit: "percent",
    },
  }).displayPercent, 99);

  assert.equal(buildProgressOptions({
    selected: "translate",
    selectedIsCurrent: true,
    snapshot: {
      stageKey: "translate",
      status: "succeeded",
      progressFallbackText: "-",
      progressPercent: 100,
    },
    selectedProgress: {
      current: 100,
      total: 100,
      displayPercent: 100,
      progressText: "翻译完成",
      progressUnit: "percent",
    },
  }).displayPercent, 100);

  assert.equal(buildProgressOptions({
    selected: "done",
    selectedIsCurrent: true,
    snapshot: {
      stageKey: "done",
      status: "succeeded",
      progressFallbackText: "-",
      progressPercent: 100,
    },
    selectedProgress: {
      current: 100,
      total: 100,
      displayPercent: 100,
      progressText: "渲染完成",
      progressUnit: "percent",
    },
  }).displayPercent, 100);
});

test("status card render model caps running terminal-looking fallback percent", () => {
  assert.equal(buildProgressRenderModel({
    stageKey: "render",
    status: "running",
    current: 100,
    total: 100,
    progressUnit: "percent",
    progressText: "正在编译 PDF",
  }).percent, 99);

  assert.equal(buildProgressRenderModel({
    stageKey: "done",
    status: "succeeded",
    current: 100,
    total: 100,
    progressUnit: "percent",
    progressText: "渲染完成",
    forceVisible: true,
  }).percent, 100);
});

test("status card progress presentation owns visibility cap and animation text", () => {
  const donePresentation = buildStatusCardProgressPresentation({
    selected: "done",
    selectedIsCurrent: true,
    snapshot: {
      stageKey: "done",
      status: "succeeded",
      progressFallbackText: "-",
      progressPercent: 100,
    },
    selectedProgress: {
      current: 100,
      total: 100,
      displayPercent: 100,
      progressText: "渲染完成",
      progressUnit: "percent",
    },
  });
  assert.equal(donePresentation.visible, true);
  assert.equal(donePresentation.displayPercent, 100);
  assert.equal(donePresentation.stageKey, "done");

  const runningPresentation = buildStatusCardProgressPresentation({
    selected: "render",
    selectedIsCurrent: true,
    snapshot: {
      stageKey: "render",
      status: "running",
      progressFallbackText: "-",
      progressPercent: 100,
    },
    selectedProgress: {
      current: 10,
      total: 10,
      displayPercent: 100,
      progressText: "正在生成页面内容",
      progressUnit: "percent",
      indeterminate: true,
    },
  });
  assert.equal(runningPresentation.displayPercent, 99);
  assert.equal(runningPresentation.percent, 99);
  assert.equal(runningPresentation.indeterminate, true);

  const animatedPresentation = buildStatusCardProgressPresentation({
    selected: "render",
    selectedIsCurrent: true,
    snapshot: {
      stageKey: "render",
      status: "running",
      progressFallbackText: "-",
      progressPercent: 50,
    },
    selectedProgress: {
      current: 10,
      total: 20,
      progressText: "第 10/20 页",
      progressUnit: "page",
      indeterminate: true,
    },
    displayedCurrent: 7,
  });
  assert.equal(animatedPresentation.visible, true);
  assert.equal(animatedPresentation.current, 7);
  assert.equal(animatedPresentation.progressText, "第 7/20 页");
  assert.equal(animatedPresentation.progressUnit, "");
  assert.equal(animatedPresentation.indeterminate, false);
});

test("status card progress render model owns progress DOM values", () => {
  assert.deepEqual(buildProgressRenderModel({
    stageKey: "done",
    forceVisible: false,
  }), {
    visible: false,
    percent: 0,
    text: "",
    componentText: "-",
    indeterminate: false,
    legacyIndeterminate: false,
  });

  assert.deepEqual(buildProgressRenderModel({
    stageKey: "render",
    forceVisible: true,
    displayPercent: 90,
    progressText: "正在编译 PDF",
  }), {
    visible: true,
    percent: 90,
    text: "正在编译 PDF",
    componentText: "正在编译 PDF",
    indeterminate: false,
    legacyIndeterminate: false,
  });

  assert.deepEqual(buildProgressRenderModel({
    stageKey: "ocr",
    indeterminate: true,
    progressText: "OCR 准备中",
  }), {
    visible: true,
    percent: 42,
    text: "OCR 准备中",
    componentText: "OCR 准备中",
    indeterminate: true,
    legacyIndeterminate: true,
  });

  assert.deepEqual(buildProgressRenderModel({
    stageKey: "translate",
    current: 28,
    total: 5216,
    progressText: "第 28/5216 批",
    progressUnit: "batch",
  }), {
    visible: true,
    percent: 28 / 5216 * 100,
    text: "第 28/5216 批",
    componentText: "第 28/5216 批",
    indeterminate: false,
    legacyIndeterminate: false,
  });
});

test("status card ignores legacy render prewarm without lane while translation is running", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-legacy-prewarm-no-lane",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 120,
        total: 900,
      },
    },
    {
      items: [
        {
          seq: 10,
          display_stage: "translation",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 120,
            total: 900,
          },
        },
        {
          seq: 11,
          stage: "render_preprocess",
          substage: "render_prewarm",
          stage_detail: "render payload prewarm: ready indents=333 geometry=836",
          event_type: "progress",
          progress: {
            unit: "step",
            current: 3,
            total: 3,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "第 120/900 批");
  assert.equal(presentation.progressCurrent, 120);
  assert.equal(presentation.progressTotal, 900);
  assert.equal(presentation.progressUnit, "batch");
  assert.notEqual(presentation.visualStageKey, "render_prewarm");
});

test("render progress aggregation ignores legacy prewarm while stage snapshot is translation", () => {
  const progress = compositeRenderProgressFromEvents(
    {
      job_id: "job-render-progress-legacy-prewarm",
      status: "running",
      stage_snapshot: {
        publicStage: "translation",
      },
    },
    {
      items: [
        {
          seq: 12,
          stage: "render_preprocess",
          substage: "render_prewarm",
          progress: {
            unit: "step",
            current: 3,
            total: 3,
          },
        },
      ],
    },
    {
      shouldReplaceCurrentStageProgress,
    },
  );

  assert.equal(progress, null);
});

test("status card selected translation body progress prefers substage batch data", () => {
  const context = resolveSelectedStageContext({
    snapshot: {
      stageKey: "translate",
      status: "running",
      progressCurrent: 75,
      progressTotal: 100,
      progressText: "进度 75%",
      progressUnit: "percent",
      substageKey: "translation_batches",
      stageProgressByKey: {
        translate: {
          current: 75,
          total: 100,
          progressText: "进度 75%",
          progressUnit: "percent",
          substageKey: "translation_batches",
          bySubstage: {
            translation_batches: {
              current: 28,
              total: 5216,
              progressText: "第 28/5216 批",
              progressUnit: "batch",
              substageKey: "translation_batches",
            },
          },
        },
      },
    },
    selectedStageKey: "",
  });

  assert.equal(context.selected, "translate");
  assert.equal(context.selectedProgress.substageKey, "translation_batches");
  assert.equal(context.selectedProgress.current, 28);
  assert.equal(context.selectedProgress.total, 5216);
  assert.equal(context.selectedProgress.progressText, "第 28/5216 批");
  assert.equal(context.selectedProgress.progressUnit, "batch");
});

test("status card selected translation helper progress does not fall back to batch text", () => {
  const context = resolveSelectedStageContext({
    snapshot: {
      stageKey: "translate",
      status: "running",
      progressCurrent: 2,
      progressTotal: 10,
      progressText: "第 2/10 页",
      progressUnit: "page",
      substageKey: "garbled_repair",
      stageProgressByKey: {
        translate: {
          current: 2,
          total: 10,
          progressText: "第 2/10 页",
          progressUnit: "page",
          substageKey: "garbled_repair",
          bySubstage: {
            translation_batches: {
              current: 900,
              total: 900,
              progressText: "翻译批次完成",
              progressUnit: "batch",
              substageKey: "translation_batches",
            },
            garbled_repair: {
              current: 2,
              total: 10,
              progressText: "第 2/10 页",
              progressUnit: "page",
              substageKey: "garbled_repair",
            },
          },
        },
      },
    },
    selectedStageKey: "",
  });

  const options = buildProgressOptions({
    selected: context.selected,
    selectedIsCurrent: context.selectedIsCurrent,
    snapshot: {
      stageKey: "translate",
      status: "running",
      progressPercent: 88,
      progressFallbackText: "-",
    },
    selectedProgress: context.selectedProgress,
  });

  assert.equal(context.selected, "translate");
  assert.equal(context.selectedProgress.substageKey, "garbled_repair");
  assert.equal(context.selectedProgress.current, 2);
  assert.equal(context.selectedProgress.total, 10);
  assert.equal(context.selectedProgress.progressText, "第 2/10 页");
  assert.equal(context.selectedProgress.progressUnit, "page");
  assert.equal(options.progressText, "第 2/10 页");
});

test("status card translation ring uses local substage percent", () => {
  const context = resolveSelectedStageContext({
    snapshot: {
      stageKey: "translate",
      status: "running",
      progressCurrent: 28,
      progressTotal: 5216,
      progressText: "第 28/5216 批",
      progressUnit: "batch",
      displayPercent: 0.5368098159509203,
      substageKey: "translation_batches",
      stageProgressByKey: {
        translate: {
          current: 28,
          total: 5216,
          progressText: "第 28/5216 批",
          progressUnit: "batch",
          displayPercent: 0.5368098159509203,
          substageKey: "translation_batches",
          bySubstage: {
            translation_batches: {
              current: 28,
              total: 5216,
              progressText: "第 28/5216 批",
              progressUnit: "batch",
              displayPercent: 0.5368098159509203,
              substageKey: "translation_batches",
            },
          },
        },
      },
    },
    selectedStageKey: "",
  });
  const options = buildProgressOptions({
    selected: context.selected,
    selectedIsCurrent: context.selectedIsCurrent,
    snapshot: {
      stageKey: "translate",
      status: "running",
      progressPercent: 75,
      progressFallbackText: "-",
    },
    selectedProgress: context.selectedProgress,
  });

  assert.equal(context.selectedProgress.progressText, "第 28/5216 批");
  assert.equal(context.selectedProgress.progressUnit, "batch");
  assert.equal(Math.round(context.selectedProgress.displayPercent * 100) / 100, 0.54);
  assert.equal(Math.round(options.displayPercent * 100) / 100, 0.54);
});

test("running stage percent is capped before terminal completion", () => {
  assert.equal(capRunningStagePercent(100, "translate", "running"), 99);
  assert.equal(capRunningStagePercent(100, "render", "running"), 99);
  assert.equal(capRunningStagePercent(100, "done", "succeeded"), 100);
});

test("structured progress does not parse numbers from stage detail", () => {
  assert.equal(
    summarizeStageProgressText({
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      stage_detail: "book: completed batch 789/5216",
      progress: {
        unit: "batch",
        current: null,
        total: null,
      },
    }),
    "",
  );
});

test("ocr processing display stage does not regress to upload wording", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-ocr-processing",
      workflow: "book",
      status: "running",
      display_stage: "ocr",
      stage: "ocr_upload",
      substage: "provider_processing",
      stage_detail: "上传完成，等待 OCR 解析",
      progress: {
        unit: "page",
        current: 12,
        total: 34,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "ocr",
          stage: "ocr_processing",
          substage: "provider_processing",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 12,
            total: 34,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "ocr");
  assert.equal(presentation.detail, "正在执行云端 OCR");
  assert.equal(presentation.substageKey, "ocr_processing");
  assert.equal(presentation.progressText, "第 12/34 页");
  assert.equal(presentation.progressCurrent, 12);
  assert.equal(presentation.progressTotal, 34);
  assert.equal(presentation.progressUnit, "page");
  assert.equal(Math.round(presentation.displayPercent * 100) / 100, 39.71);
  assert.equal(presentation.visualStageKey, "ocr_processing");
});

test("ocr normalizing event advances beyond provider page progress", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-ocr-normalizing-after-pages",
      workflow: "book",
      status: "running",
      display_stage: "ocr",
      stage: "ocr_processing",
      substage: "provider_processing",
      progress: {
        unit: "page",
        current: 34,
        total: 34,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "ocr",
          stage: "ocr_processing",
          substage: "provider_processing",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 34,
            total: 34,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "ocr",
          stage: "normalizing",
          substage: "normalizing",
          event_type: "progress",
          progress: {
            unit: "step",
            current: 1,
            total: 2,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "ocr");
  assert.equal(presentation.detail, "正在整理 OCR 结果");
  assert.equal(presentation.substageKey, "normalizing");
  assert.equal(presentation.progressText, "进度 1/2");
  assert.equal(presentation.progressCurrent, 1);
  assert.equal(presentation.progressTotal, 2);
  assert.equal(presentation.progressUnit, "step");
  assert.equal(presentation.displayPercent, 94.5);
  assert.equal(presentation.visualStageKey, "ocr_normalizing");
});
