#!/usr/bin/env node

import {
  collectStageProgressByKey,
  resolveDisplayedStagePresentation,
} from "../src/js/job-stage-presentation.js";
import { resolveVisualStageKeyForSnapshot } from "../src/js/components/status/job-status-card-visuals.js";

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}


function checkOcrPresentationUsesPageProgress() {
  const job = {
    status: "running",
    stage: "ocr_processing",
    current_stage: "ocr_processing",
    stage_detail: "正在执行 OCR，第 5/12 页",
    progress_current: 5,
    progress_total: 12,
  };
  const events = {
    items: [
      {
        stage: "queued",
        event_type: "stage_progress",
        stage_detail: "PDF 上传完成",
        progress_current: 2,
        progress_total: 12,
      },
      {
        stage: "ocr_processing",
        provider_stage: "paddle_running",
        event_type: "stage_progress",
        stage_detail: "正在执行 OCR，第 5/12 页",
        progress_current: 5,
        progress_total: 12,
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.stageKey, "ocr", "OCR stage");
  assertEqual(presentation.progressText, "第 5/12 页", "OCR progress text");
  assertEqual(presentation.progressCurrent, 5, "OCR progress current");
  assertEqual(presentation.progressTotal, 12, "OCR progress total");
}

function checkOcrPresentationIgnoresFutureStageEvents() {
  const job = {
    status: "running",
    stage: "ocr_processing",
    current_stage: "ocr_processing",
    stage_detail: "正在执行 OCR",
    progress_current: 5,
    progress_total: 12,
  };
  const events = {
    items: [
      {
        stage: "ocr_processing",
        event_type: "stage_progress",
        stage_detail: "正在执行 OCR，第 5/12 页",
        progress_current: 5,
        progress_total: 12,
      },
      {
        stage: "translating",
        event_type: "stage_progress",
        stage_detail: "正在翻译正文，第 18/55 批",
        progress_current: 18,
        progress_total: 55,
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.stageKey, "ocr", "OCR stage with newer translation event");
  assertEqual(presentation.progressText, "第 5/12 页", "OCR progress text with newer translation event");
}

function checkOcrPresentationFallsBackToJobProgress() {
  const job = {
    status: "running",
    stage: "ocr_processing",
    current_stage: "ocr_processing",
    stage_detail: "正在执行 OCR",
    progress_current: 7,
    progress_total: 12,
  };
  const events = {
    items: [
      {
        stage: "ocr_processing",
        event_type: "stage_transition",
        stage_detail: "正在执行 OCR",
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.stageKey, "ocr", "OCR stage fallback");
  assertEqual(presentation.progressText, "第 7/12 页", "OCR job progress fallback text");
}

function checkTranslatePresentationUsesBatchProgressWhenDetailMentionsOcr() {
  const job = {
    status: "running",
    stage: "translating",
    current_stage: "translating",
    stage_detail: "OCR 完成，开始翻译正文",
    progress_current: 18,
    progress_total: 55,
  };
  const events = {
    items: [
      {
        stage: "ocr_processing",
        event_type: "stage_progress",
        stage_detail: "正在执行 OCR，第 12/12 页",
        progress_current: 12,
        progress_total: 12,
      },
      {
        stage: "translating",
        event_type: "stage_progress",
        stage_detail: "OCR 完成，正在翻译正文，第 18/55 批",
        progress_current: 18,
        progress_total: 55,
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.stageKey, "translate", "Translate stage with OCR text");
  assertEqual(presentation.progressText, "第 18/55 批", "Translate batch progress with OCR text");
}

function checkTranslatePresentationIgnoresOcrEvents() {
  const job = {
    status: "running",
    stage: "translating",
    current_stage: "translating",
    stage_detail: "正在翻译正文",
    progress_current: 18,
    progress_total: 55,
  };
  const events = {
    items: [
      {
        stage: "ocr_processing",
        event_type: "stage_progress",
        stage_detail: "正在执行 OCR，第 12/12 页",
        progress_current: 12,
        progress_total: 12,
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.stageKey, "translate", "Translate stage ignores OCR event");
  assertEqual(presentation.progressText, "第 18/55 批", "Translate falls back to job batch progress");
}

function checkContinuationReviewUsesPageProgress() {
  const job = {
    status: "running",
    stage: "continuation_review",
    current_stage: "continuation_review",
    stage_detail: "开始复核跨栏/跨页连续段",
    progress_current: 4,
    progress_total: 12,
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "translate", "Continuation review belongs to translate stage");
  assertEqual(presentation.label, "第 2/4 步 · 跨栏/跨页判断", "Continuation review label");
  assertEqual(presentation.progressText, "第 4/12 页", "Continuation review page progress");
}

function checkPagePoliciesUsePageProgress() {
  const job = {
    status: "running",
    stage: "page_policies",
    current_stage: "page_policies",
    stage_detail: "开始执行页面策略和块分类",
    progress_current: 6,
    progress_total: 12,
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "translate", "Page policies belongs to translate stage");
  assertEqual(presentation.label, "第 2/4 步 · 页面策略", "Page policies label");
  assertEqual(presentation.progressText, "第 6/12 页", "Page policies page progress");
}

function checkTranslateUsesLatestSubstageProgress() {
  const job = {
    status: "running",
    stage: "translating",
    current_stage: "translating",
    stage_detail: "OCR 完成，开始翻译",
  };
  const events = {
    items: [
      {
        stage: "translating",
        event_type: "stage_transition",
        stage_detail: "开始准备纯翻译阶段",
      },
      {
        stage: "continuation_review",
        event_type: "stage_transition",
        stage_detail: "开始复核跨栏/跨页连续段",
        progress_current: 2,
        progress_total: 10,
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.stageKey, "translate", "Translate substage stage");
  assertEqual(presentation.label, "第 2/4 步 · 跨栏/跨页判断", "Translate substage label");
  assertEqual(presentation.progressText, "第 2/10 页", "Translate substage progress");
  assertEqual(presentation.progressCurrent, 2, "Translate substage current");
  assertEqual(presentation.progressTotal, 10, "Translate substage total");
}

function checkTranslateUsesLatestProgressfulEvent() {
  const job = {
    status: "running",
    stage: "translating",
    current_stage: "translating",
    stage_detail: "OCR 完成，开始翻译",
  };
  const events = {
    items: [
      {
        stage: "continuation_review",
        event_type: "stage_transition",
        stage_detail: "开始复核跨栏/跨页连续段",
        progress_current: 0,
        progress_total: 1,
      },
      {
        stage: "continuation_review",
        event_type: "stage_progress",
        stage_detail: "跨栏/跨页连续段复核完成",
        progress_current: 1,
        progress_total: 1,
      },
      {
        stage: "page_policies",
        event_type: "stage_transition",
        stage_detail: "开始执行页面策略和块分类",
        progress_current: 0,
        progress_total: 1,
      },
      {
        stage: "translating",
        event_type: "stage_transition",
        stage_detail: "开始批量翻译",
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.label, "第 2/4 步 · 页面策略", "Latest progressful substage label");
  assertEqual(presentation.progressText, "第 0/1 页", "Latest progressful substage progress");
}

function checkOcrPercentProgressDoesNotLookLikePages() {
  const job = {
    status: "running",
    stage: "ocr_processing",
    current_stage: "ocr_processing",
    stage_detail: "OCR provider 正在处理",
    progress_current: 0,
    progress_total: 100,
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "ocr", "OCR percent stage");
  assertEqual(presentation.progressText, "OCR 处理中", "OCR zero percent text");
}

function checkOcrFallbackProgressUsesStageSteps() {
  const job = {
    status: "running",
    stage: "ocr_upload",
    current_stage: "ocr_upload",
    stage_detail: "OCR provider transport 启动中",
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "ocr", "OCR fallback stage");
  assertEqual(presentation.progressText, "OCR 准备中", "OCR fallback text");
  assertEqual(presentation.progressCurrent, 1, "OCR fallback current");
  assertEqual(presentation.progressTotal, 4, "OCR fallback total");
  assertEqual(presentation.progressIndeterminate, true, "OCR fallback is indeterminate");
}

function checkOcrRealPageProgressIsDeterminate() {
  const job = {
    status: "running",
    stage: "ocr_processing",
    current_stage: "ocr_processing",
    stage_detail: "OCR 子任务：Paddle 正在解析文件",
    progress_current: 9,
    progress_total: 24,
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.progressText, "第 9/24 页", "OCR real page text");
  assertEqual(presentation.progressIndeterminate, false, "OCR real page is determinate");
}

function checkOcrInternalStagesUseDistinctAnimationKeys() {
  const cases = [
    ["ocr_upload", "ocr_upload"],
    ["ocr_processing", "ocr_processing"],
    ["ocr_result_ready", "ocr_result_ready"],
    ["normalizing", "ocr_normalizing"],
  ];
  for (const [stage, visualStageKey] of cases) {
    const presentation = resolveDisplayedStagePresentation(
      {
        status: "running",
        stage,
        current_stage: stage,
        stage_detail: stage,
      },
      { items: [] },
    );
    assertEqual(presentation.visualStageKey, visualStageKey, `${stage} visual stage`);
  }
}

function checkOcrResultReadyStaysInOcrStage() {
  const job = {
    status: "running",
    stage: "ocr_result_ready",
    current_stage: "ocr_result_ready",
    stage_detail: "OCR provider 结果已就绪，正在下载原始 bundle",
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "ocr", "OCR result ready stage");
  assertEqual(presentation.detail, "OCR provider 结果已就绪，正在下载原始 bundle", "OCR result ready detail");
}

function checkOcrUploadWaitingDoesNotLookQueued() {
  const job = {
    status: "running",
    stage: "ocr_upload",
    current_stage: "ocr_upload",
    stage_detail: "OCR 子任务：Paddle 已接收任务，等待排队",
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "ocr", "OCR upload waiting stage");
  assertEqual(presentation.visualStageKey, "ocr_upload", "OCR upload animation stage");
  assertEqual(presentation.label, "第 1/4 步 · OCR 解析", "OCR upload waiting label");
  assertEqual(presentation.detail, "Paddle 已接收任务，等待排队", "OCR upload waiting detail");
}

function checkTranslationSubstageOrderDoesNotPreferBatchWhenReviewing() {
  const job = {
    status: "running",
    stage: "continuation_review",
    current_stage: "continuation_review",
    stage_detail: "正在判断跨栏/跨页连续段，第 3/9 页",
    progress_current: 3,
    progress_total: 9,
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "translate", "Continuation review remains translate stage");
  assertEqual(presentation.label, "第 2/4 步 · 跨栏/跨页判断", "Continuation review label wins");
  assertEqual(presentation.progressText, "第 3/9 页", "Continuation review keeps page progress");
}

function checkCompletedStageHasDoneKeyAndNoProgressTextRequirement() {
  const job = {
    status: "succeeded",
    stage: "finished",
    current_stage: "finished",
    stage_detail: "处理完成，可以下载结果",
    progress_current: 12,
    progress_total: 12,
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "done", "Completed stage");
  assertEqual(presentation.label, "完成", "Completed label");
}

function checkFailedStageUsesFailureSummary() {
  const job = {
    status: "failed",
    stage: "rendering",
    current_stage: "rendering",
    stage_detail: "渲染阶段失败",
    failure: {
      summary: "Typst 渲染失败：页面 9 文本溢出",
    },
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "failed", "Failed stage");
  assertEqual(presentation.label, "失败", "Failed label");
  assertEqual(presentation.detail, "Typst 渲染失败：页面 9 文本溢出", "Failed detail uses failure summary");
}

function checkRunningFinishedStageStaysInRenderUntilTerminal() {
  const job = {
    status: "running",
    stage: "finished",
    current_stage: "finished",
    stage_detail: "任务完成",
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "render", "Running finished transition stays render");
  assertEqual(presentation.label, "第 3/4 步 · 渲染", "Running finished transition label");
}

function checkStartupStageUsesWorkflowContext() {
  const cases = [
    ["ocr", "ocr", "第 1/4 步 · 启动"],
    ["translate", "translate", "第 2/4 步 · 启动"],
    ["render", "render", "第 3/4 步 · 启动"],
  ];
  for (const [workflow, expectedStageKey, expectedLabel] of cases) {
    const presentation = resolveDisplayedStagePresentation(
      {
        status: "running",
        workflow,
        job_type: workflow,
        stage: "startup",
        current_stage: "startup",
        stage_detail: `${workflow} worker 已启动`,
      },
      { items: [] },
    );
    assertEqual(presentation.stageKey, expectedStageKey, `${workflow} startup stage`);
    assertEqual(presentation.label, expectedLabel, `${workflow} startup label`);
  }
}

function checkRenderPrepareDoesNotLookLikeOcr() {
  const presentation = resolveDisplayedStagePresentation(
    {
      status: "running",
      workflow: "render",
      stage: "render_prepare",
      current_stage: "render_prepare",
      stage_detail: "开始准备纯渲染阶段",
    },
    { items: [] },
  );
  assertEqual(presentation.stageKey, "render", "Render prepare stage");
  assertEqual(presentation.label, "第 3/4 步 · 渲染", "Render prepare label");
}

function checkSelectedFutureStageUsesSelectedAnimation() {
  const visualStageKey = resolveVisualStageKeyForSnapshot(
    {
      stageKey: "ocr",
      visualStageKey: "ocr_processing",
    },
    "translate",
  );
  assertEqual(visualStageKey, "translate", "Manual selected stage animation");
}

function checkHistoricalOcrProgressCanBeRecoveredFromEvents() {
  const progressByKey = collectStageProgressByKey(
    {
      status: "succeeded",
      stage: "finished",
      current_stage: "finished",
      stage_detail: "任务完成",
    },
    {
      items: [
        {
          stage: "ocr_processing",
          event_type: "stage_progress",
          stage_detail: "OCR 子任务：Paddle 正在解析文件",
          progress_current: 15,
          progress_total: 22,
        },
        {
          stage: "translating",
          event_type: "stage_progress",
          stage_detail: "正在翻译正文，第 2/9 批",
          progress_current: 2,
          progress_total: 9,
        },
      ],
    },
  );
  assertEqual(progressByKey.ocr.progressText, "第 15/22 页", "Historical OCR progress text");
  assertEqual(progressByKey.translate.progressText, "第 2/9 批", "Historical translate progress text");
}

function checkFormalEventContractProgressUnits() {
  const progressByKey = collectStageProgressByKey(
    {
      status: "running",
      stage: "rendering",
      current_stage: "rendering",
      stage_detail: "正在渲染",
    },
    {
      items: [
        {
          user_stage: "ocr",
          stage: "ocr_processing",
          substage: "provider_processing",
          stage_detail: "Paddle 正在解析文件",
          event_type: "stage_progress",
          progress_unit: "page",
          progress_current: 12,
          progress_total: 34,
        },
        {
          user_stage: "translate",
          stage: "translating",
          stage_detail: "正在翻译",
          event_type: "stage_progress",
          progress_unit: "batch",
          progress_current: 8,
          progress_total: 42,
        },
        {
          user_stage: "render",
          stage: "rendering",
          stage_detail: "正在渲染",
          event_type: "stage_progress",
          progress_unit: "page",
          progress_current: 18,
          progress_total: 34,
        },
      ],
    },
  );
  assertEqual(progressByKey.ocr.progressText, "第 12/34 页", "Formal OCR page progress");
  assertEqual(progressByKey.translate.progressText, "第 8/42 批", "Formal translate batch progress");
  assertEqual(progressByKey.render.progressText, "第 18/34 页", "Formal render page progress");
}

function checkOcrZeroPageProgressIsVisibleIndeterminate() {
  const progressByKey = collectStageProgressByKey(
    {
      status: "running",
      stage: "ocr_processing",
      current_stage: "ocr_processing",
      stage_detail: "Paddle 正在解析文件，第 0/33 页",
    },
    {
      items: [
        {
          user_stage: "ocr",
          stage: "ocr_processing",
          substage: "running",
          stage_detail: "Paddle 正在解析文件，第 0/33 页",
          event_type: "stage_progress",
          progress_unit: "page",
          progress_current: 0,
          progress_total: 33,
        },
      ],
    },
  );
  assertEqual(progressByKey.ocr.progressText, "OCR 处理中，共 33 页", "OCR zero page progress text");
  assertEqual(progressByKey.ocr.indeterminate, true, "OCR zero page indeterminate progress");
  assertEqual(progressByKey.ocr.visualStageKey, "ocr_processing", "OCR zero page animation stage");
}

function checkPageProgressBeatsLaterStepProgress() {
  const progressByKey = collectStageProgressByKey(
    {
      status: "running",
      stage: "translating",
      current_stage: "translating",
      stage_detail: "OCR 完成，开始翻译",
    },
    {
      items: [
        {
          user_stage: "ocr",
          stage: "ocr_processing",
          stage_detail: "Paddle 正在解析文件，第 4/9 页",
          progress_unit: "page",
          progress_current: 4,
          progress_total: 9,
        },
        {
          user_stage: "ocr",
          stage: "normalizing",
          stage_detail: "OCR 完成，开始标准化",
          progress_unit: "step",
          progress_current: 9,
          progress_total: 9,
        },
      ],
    },
  );
  assertEqual(progressByKey.ocr.progressText, "第 4/9 页", "OCR page progress beats later step progress");
}

function checkCompletedOcrPageProgressBeatsPartialPageProgress() {
  const progressByKey = collectStageProgressByKey(
    {
      status: "succeeded",
      stage: "finished",
      current_stage: "finished",
      stage_detail: "任务完成",
    },
    {
      items: [
        {
          user_stage: "ocr",
          stage: "ocr_processing",
          stage_detail: "Paddle 正在解析文件，第 28/33 页",
          progress_unit: "page",
          progress_current: 28,
          progress_total: 33,
        },
        {
          user_stage: "ocr",
          stage: "ocr_result_ready",
          stage_detail: "Paddle 正在解析文件，第 33/33 页",
          progress_unit: "none",
          progress_current: 33,
          progress_total: 33,
        },
      ],
    },
  );
  assertEqual(progressByKey.ocr.progressText, "第 33/33 页", "Completed OCR progress beats partial page progress");
}

function checkFormalCurrentEventWinsStageAndUnit() {
  const presentation = resolveDisplayedStagePresentation(
    {
      status: "running",
      stage: "translating",
      current_stage: "translating",
      stage_detail: "正在翻译",
    },
    {
      items: [
        {
          user_stage: "translate",
          stage: "continuation_review",
          substage: "continuation_review",
          stage_detail: "跨栏/跨页判断",
          event_type: "stage_progress",
          progress_unit: "page",
          progress_current: 4,
          progress_total: 18,
        },
      ],
    },
  );
  assertEqual(presentation.stageKey, "translate", "Formal translate substage");
  assertEqual(presentation.progressText, "第 4/18 页", "Formal translate page unit");
}

function checkTranslateProgressTextFallbackParsesStageDetail() {
  const presentation = resolveDisplayedStagePresentation(
    {
      status: "running",
      stage: "translating",
      stage_detail: "已完成第 1292/5216 批翻译（最近页: 132）",
    },
    { items: [] },
  );
  assertEqual(presentation.stageKey, "translate", "Translate stage detail fallback stage");
  assertEqual(presentation.progressText, "第 1292/5216 批", "Translate stage detail fallback progress text");
  assertEqual(presentation.progressCurrent, 1292, "Translate stage detail fallback current");
  assertEqual(presentation.progressTotal, 5216, "Translate stage detail fallback total");
}

function checkRenderZeroPageProgressShowsUsefulText() {
  const presentation = resolveDisplayedStagePresentation(
    {
      status: "running",
      stage: "rendering",
      stage_detail: "开始渲染翻译 PDF",
    },
    {
      items: [
        {
          user_stage: "render",
          stage: "rendering",
          stage_detail: "开始渲染翻译 PDF",
          progress_unit: "page",
          progress_current: 0,
          progress_total: 533,
        },
      ],
    },
  );
  assertEqual(presentation.stageKey, "render", "Render zero page stage");
  assertEqual(presentation.progressText, "渲染准备中，共 533 页", "Render zero page progress text");
  assertEqual(presentation.progressCurrent, 0, "Render zero page current");
  assertEqual(presentation.progressTotal, 533, "Render zero page total");
}

checkOcrPresentationUsesPageProgress();
checkOcrPresentationIgnoresFutureStageEvents();
checkOcrPresentationFallsBackToJobProgress();
checkTranslatePresentationUsesBatchProgressWhenDetailMentionsOcr();
checkTranslatePresentationIgnoresOcrEvents();
checkContinuationReviewUsesPageProgress();
checkPagePoliciesUsePageProgress();
checkTranslateUsesLatestSubstageProgress();
checkTranslateUsesLatestProgressfulEvent();
checkOcrPercentProgressDoesNotLookLikePages();
checkOcrFallbackProgressUsesStageSteps();
checkOcrRealPageProgressIsDeterminate();
checkOcrInternalStagesUseDistinctAnimationKeys();
checkOcrResultReadyStaysInOcrStage();
checkOcrUploadWaitingDoesNotLookQueued();
checkTranslationSubstageOrderDoesNotPreferBatchWhenReviewing();
checkCompletedStageHasDoneKeyAndNoProgressTextRequirement();
checkFailedStageUsesFailureSummary();
checkRunningFinishedStageStaysInRenderUntilTerminal();
checkStartupStageUsesWorkflowContext();
checkRenderPrepareDoesNotLookLikeOcr();
checkSelectedFutureStageUsesSelectedAnimation();
checkHistoricalOcrProgressCanBeRecoveredFromEvents();
checkFormalEventContractProgressUnits();
checkOcrZeroPageProgressIsVisibleIndeterminate();
checkPageProgressBeatsLaterStepProgress();
checkCompletedOcrPageProgressBeatsPartialPageProgress();
checkFormalCurrentEventWinsStageAndUnit();
checkTranslateProgressTextFallbackParsesStageDetail();
checkRenderZeroPageProgressShowsUsefulText();

console.log("status presentation smoke passed");
