// 状态卡 · 子阶段：子阶段视图模型、别名 / 文案契约、结构化子阶段文案矩阵。
// 从原 status-card.test.mjs（2000+ 行）按主题拆出，用例原样搬移。

import test from "node:test";
import assert from "node:assert/strict";
import { resolveDisplayedStagePresentation } from "@retainpdf/domain/job-status";
import {
  shouldReplaceCurrentStageProgress,
  shouldReplaceStageProgress,
} from "@retainpdf/domain/job-status";
import { summarizeStageProgressText } from "@retainpdf/domain/job-status";
import { buildSubstageViewModel } from "@retainpdf/domain/job-status";
import { effectiveStatusFlowStageKey } from "@retainpdf/domain/job-status";
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
    ["refining", "render_prepare", "render_prewarm", "render_pages", "render_compile"],
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

test("精修子步骤是可选的：没开精修的任务不显示，开了才显示", () => {
  const plain = buildSubstageViewModel({
    selectedStageKey: "render",
    selectedIsCurrent: true,
    snapshot: { stageKey: "render", substageKey: "render_pages" },
    selectedProgress: { substageKey: "render_pages", bySubstage: { render_pages: { current: 3, total: 10 } } },
  });
  assert.deepEqual(plain.items.map((item) => item.key), ["render_prepare", "render_prewarm", "render_pages"]);

  const refined = buildSubstageViewModel({
    selectedStageKey: "render",
    selectedIsCurrent: true,
    snapshot: { stageKey: "render", substageKey: "render_pages" },
    selectedProgress: {
      substageKey: "render_pages",
      bySubstage: { refining: { current: 1, total: 1 }, render_pages: { current: 3, total: 10 } },
    },
  });
  assert.deepEqual(
    refined.items.map((item) => [item.key, item.done]),
    [["refining", true], ["render_prepare", true], ["render_prewarm", true], ["render_pages", false]],
  );

  const refining = buildSubstageViewModel({
    selectedStageKey: "render",
    selectedIsCurrent: true,
    snapshot: { stageKey: "render", substageKey: "refining" },
    selectedProgress: { substageKey: "refining", bySubstage: { refining: { current: 1, total: 4 } } },
  });
  assert.deepEqual(refining.items.map((item) => [item.key, item.active]), [["refining", true]]);
});
