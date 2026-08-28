import test from "node:test";
import assert from "node:assert/strict";

import {
  collectStageProgressByKey,
  resolveDisplayedStagePresentation,
} from "../src/js/job-status/job-stage-presentation.js";
import { compositeTranslationProgressFromRecord } from "../src/js/job-status/job-stage-translation-progress.js";
import { summarizeStageProgressText } from "../src/js/job-status/job-status-summary-progress.js";
import { TRANSLATION_WORKFLOW_DIALOG } from "../src/js/features/translation-workflow-dialog/contract.js";

test("english batch detail is not parsed as translation batch progress", () => {
  assert.equal(
    summarizeStageProgressText({
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "translating",
      substage: "translation_batches",
      stage_detail: "book: completed batch 789/5216",
      progress_unit: "batch",
    }),
    "",
  );
});

test("translation composite progress prefers record unit before payload mirror", () => {
  const progress = compositeTranslationProgressFromRecord({
    stageKey: "translate",
    substageKey: "translation_batches",
    current: 5,
    total: 10,
    progressUnit: "batch",
    progressText: "第 5/10 批",
    payload: {
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 5,
        total: 10,
      },
      progress_unit: "step",
    },
  });

  assert.equal(progress.progressUnit, "batch");
  assert.equal(progress.sourceProgressUnit, "batch");
  assert.equal(progress.progressText, "第 5/10 批");
  assert.equal(progress.payload.progress_unit, "batch");
});

test("collectStageProgressByKey keeps translation substage progress", () => {
  const progressByKey = collectStageProgressByKey(
    {
      job_id: "job-translate",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
    },
    {
      items: [
        {
          seq: 1,
          display_stage: "translation",
          stage: "continuation_review",
          substage: "continuation_review",
          progress: {
            unit: "page",
            current: 2,
            total: 10,
          },
        },
        {
          seq: 2,
          display_stage: "translation",
          stage: "page_policies",
          substage: "page_policies",
          progress: {
            unit: "page",
            current: 3,
            total: 10,
          },
        },
        {
          seq: 3,
          display_stage: "translation",
          stage: "translation_batches",
          substage: "translation_batches",
          progress: {
            unit: "batch",
            current: 4,
            total: 8,
          },
        },
      ],
    },
  );

  assert.equal(progressByKey.translate.current, 4);
  assert.equal(progressByKey.translate.total, 8);
  assert.equal(progressByKey.translate.progressUnit, "batch");
  assert.equal(progressByKey.translate.progressText, "Lô 4/8");
  assert.equal(progressByKey.translate.bySubstage.continuation_review.current, 2);
  assert.equal(progressByKey.translate.bySubstage.continuation_review.total, 10);
  assert.equal(progressByKey.translate.bySubstage.continuation_review.progressUnit, "page");
  assert.equal(progressByKey.translate.bySubstage.page_policies.current, 3);
  assert.equal(progressByKey.translate.bySubstage.page_policies.total, 10);
  assert.equal(progressByKey.translate.bySubstage.page_policies.progressUnit, "page");
});

test("translation main progress follows the latest main substage", () => {
  const progressByKey = collectStageProgressByKey(
    {
      job_id: "job-translate-prefer-batches",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "translating",
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "translating",
          substage: "translation_batches",
          progress: {
            unit: "batch",
            current: 120,
            total: 900,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "garbled_repair",
          substage: "garbled_repair",
          progress: {
            unit: "page",
            current: 5,
            total: 10,
          },
        },
      ],
    },
  );

  assert.equal(progressByKey.translate.current, 5);
  assert.equal(progressByKey.translate.total, 10);
  assert.equal(progressByKey.translate.progressUnit, "page");
  assert.equal(progressByKey.translate.progressText, "Trang 5/10");
  assert.equal(progressByKey.translate.substageKey, "garbled_repair");
  assert.equal(progressByKey.translate.bySubstage.translation_batches.progressText, "Lô 120/900");
  assert.equal(progressByKey.translate.bySubstage.garbled_repair.progressText, "Trang 5/10");
});

test("job snapshot progress does not replace translation event with different substage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-translation-substage-guard",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 800,
        total: 900,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "garbled_repair",
          substage: "garbled_repair",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 4,
            total: 10,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "garbled_repair");
  assert.equal(presentation.progressCurrent, 4);
  assert.equal(presentation.progressTotal, 10);
  assert.equal(presentation.progressUnit, "page");
  assert.equal(presentation.progressText, "Trang 4/10");
});

test("translation detail snapshot composes progress without events", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-translation-detail-only",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 8,
        total: 8,
      },
    },
    null,
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "Đã hoàn tất các lượt dịch");
  assert.equal(presentation.progressCurrent, 8);
  assert.equal(presentation.progressTotal, 8);
  assert.equal(presentation.progressUnit, "batch");
});

test("translation batch progress composes even when substage is missing", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-translation-missing-substage",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "translating",
      progress: {
        unit: "batch",
        current: 8,
        total: 8,
      },
    },
    null,
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "Đã hoàn tất các lượt dịch");
  assert.equal(presentation.progressCurrent, 8);
  assert.equal(presentation.progressTotal, 8);
  assert.equal(presentation.progressUnit, "batch");
});

test("current translation helper substage uses its own progress", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-translate-page-policies",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "page_policies",
      substage: "page_policies",
      progress: {
        unit: "page",
        current: 3,
        total: 10,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "translating",
          substage: "translation_batches",
          progress: {
            unit: "batch",
            current: 120,
            total: 900,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "page_policies",
          substage: "page_policies",
          progress: {
            unit: "page",
            current: 3,
            total: 10,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "page_policies");
  assert.equal(presentation.progressText, "Trang 3/10");
  assert.equal(presentation.progressCurrent, 3);
  assert.equal(presentation.progressTotal, 10);
  assert.equal(presentation.progressUnit, "page");
});

test("translation event stream can advance beyond stale job snapshot substage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-translate-stale-snapshot",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 900,
        total: 900,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 900,
            total: 900,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "garbled_repair",
          substage: "garbled_repair",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 2,
            total: 10,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "garbled_repair");
  assert.equal(presentation.progressText, "Trang 2/10");
  assert.equal(presentation.progressUnit, "page");
  assert.equal(presentation.progressCurrent, 2);
  assert.equal(presentation.progressTotal, 10);
});

test("translation presentation advances from batches to later repair substage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-translate-repair-after-batches",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "garbled_repair",
      substage: "garbled_repair",
      progress: {
        unit: "page",
        current: 5,
        total: 10,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 900,
            total: 900,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "garbled_repair",
          substage: "garbled_repair",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 5,
            total: 10,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "garbled_repair");
  assert.equal(presentation.progressText, "Trang 5/10");
  assert.equal(presentation.progressCurrent, 5);
  assert.equal(presentation.progressTotal, 10);
});

test("translation zero-total repair events remain visible instead of falling back to batches", () => {
  const job = {
    job_id: "job-translate-zero-total-repair",
    workflow: "book",
    status: "running",
    display_stage: "translation",
      stage: "translating",
    stage: "translating",
    substage: "translation_batches",
    progress: {
      unit: "batch",
      current: 56,
      total: 56,
    },
  };
  const eventsPayload = {
    items: [
      {
        seq: 67,
        lane: "main",
        display_stage: "translation",
      stage: "translating",
        stage: "translating",
        substage: "translation_batches",
        event_type: "progress",
        progress: {
          unit: "batch",
          current: 56,
          total: 56,
          percent: 100,
        },
        stage_detail: "翻译批次完成",
      },
      {
        seq: 68,
        lane: "main",
        display_stage: "translation",
      stage: "translating",
        stage: "garbled_repair",
        substage: "garbled_repair",
        event_type: "progress",
        progress: {
          unit: "page",
          current: 0,
          total: 0,
        },
        stage_detail: "乱码候选段修复已跳过",
      },
      {
        seq: 69,
        lane: "main",
        display_stage: "translation",
      stage: "translating",
        stage: "agent_repair",
        substage: "agent_repair",
        event_type: "progress",
        progress: {
          unit: "none",
          current: 0,
          total: 1,
          percent: 0,
        },
        stage_detail: "开始执行翻译结果修复",
      },
      {
        seq: 70,
        lane: "main",
        display_stage: "translation",
      stage: "translating",
        stage: "agent_repair",
        substage: "agent_repair",
        event_type: "progress",
        progress: {
          unit: "step",
          current: 0,
          total: 0,
        },
        stage_detail: "翻译结果修复完成",
      },
    ],
  };

  const presentation = resolveDisplayedStagePresentation(job, eventsPayload);
  const progressByKey = collectStageProgressByKey(job, eventsPayload);

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "agent_repair");
  assert.equal(presentation.progressText, "Đang sửa kết quả dịch");
  assert.equal(presentation.progressCurrent, 100);
  assert.equal(presentation.progressTotal, 100);
  assert.equal(presentation.progressUnit, "percent");
  assert.equal(progressByKey.translate.substageKey, "agent_repair");
  assert.equal(progressByKey.translate.progressText, "Đang sửa kết quả dịch");
  assert.equal(progressByKey.translate.current, 100);
  assert.equal(progressByKey.translate.bySubstage.garbled_repair.progressText, "Đang sửa các đoạn văn bản bị lỗi mã hóa");
  assert.equal(progressByKey.translate.bySubstage.agent_repair.progressText, "Đang sửa kết quả dịch");
});

test("translation batch completion keeps batch progress for the ring", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-translation-batch-room",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 56,
        total: 56,
      },
    },
    null,
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "Đã hoàn tất các lượt dịch");
  assert.equal(presentation.progressCurrent, 56);
  assert.equal(presentation.progressTotal, 56);
  assert.equal(presentation.progressUnit, "batch");
});

test("translation body copy keeps batch progress instead of stale job percent", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-translation-body-progress",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "percent",
        current: 75,
        total: 100,
        percent: 75,
      },
      progress_percent: 75,
    },
    {
      items: [
        {
          seq: 52,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
          },
          stage_detail: "开始批量翻译",
        },
        {
          seq: 53,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 28,
            total: 5216,
            percent: 0.54,
          },
          stage_detail: "已完成第 28/5216 批翻译",
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.detail, "Đang dịch nội dung chính");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "Lô 28/5216");
  assert.equal(presentation.progressCurrent, 28);
  assert.equal(presentation.progressTotal, 5216);
  assert.equal(presentation.progressUnit, "batch");
  assert.equal(Math.round(presentation.displayPercent * 100) / 100, 0.54);
});

test("translation substage progress keeps the latest event by seq", () => {
  const progressByKey = collectStageProgressByKey(
    {
      job_id: "job-translation-latest-substage",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "translating",
    },
    {
      items: [
        {
          seq: 10,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 30,
            total: 100,
          },
        },
        {
          seq: 11,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 45,
            total: 100,
          },
        },
      ],
    },
  );

  assert.equal(progressByKey.translate.bySubstage.translation_batches.current, 45);
  assert.equal(progressByKey.translate.bySubstage.translation_batches.total, 100);
  assert.equal(progressByKey.translate.bySubstage.translation_batches.progressText, "Lô 45/100");
  assert.equal(progressByKey.translate.bySubstage.translation_batches.displayPercent, 45);
});

test("translation helper start event with unit none does not render as batch count", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-agent-repair-start",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "agent_repair",
      substage: "agent_repair",
      progress: {
        unit: "none",
        current: 0,
        total: 1,
        percent: 0,
      },
      stage_detail: "开始执行翻译结果修复",
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "agent_repair",
          substage: "agent_repair",
          event_type: "progress",
          progress: {
            unit: "none",
            current: 0,
            total: 1,
            percent: 0,
          },
          stage_detail: "开始执行翻译结果修复",
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "agent_repair");
  assert.equal(presentation.progressText, "Đang sửa kết quả dịch");
  assert.equal(presentation.progressCurrent, 0);
  assert.equal(presentation.progressTotal, 1);
  assert.equal(presentation.progressUnit, "none");
});

test("canonical translation event without counts does not borrow stale job batch progress", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-canonical-start-no-stale-batch",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 28,
        total: 5216,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
          },
          stage_detail: "开始批量翻译",
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "Đang dịch nội dung chính");
  assert.equal(presentation.progressCurrent, 0);
  assert.equal(presentation.progressTotal, 100);
  assert.equal(presentation.progressUnit, "percent");
});

test("translation unit-only substage snapshots still show progress", () => {
  const cases = [
    ["domain_inference", "domain_inference", "step", 0],
    ["continuation_review", "continuation_review", "page", 0],
    ["page_policies", "page_policies", "page", 0],
    ["translating", "translation_batches", "batch", 0],
    ["translating", "translation_tail_retry", "batch", 0],
    ["agent_repair", "agent_repair", "none", 0],
  ];

  for (const [stage, substage, unit, expectedCurrent] of cases) {
    const presentation = resolveDisplayedStagePresentation(
      {
        job_id: `job-${substage}`,
        workflow: "book",
        status: "running",
        display_stage: "translation",
        stage,
        substage,
        progress: { unit },
        stage_detail: `${substage} start`,
      },
      {
        items: [
          {
            seq: 1,
            lane: "main",
            display_stage: "translation",
            stage,
            substage,
            event_type: "progress",
            progress: { unit },
            stage_detail: `${substage} start`,
          },
        ],
      },
    );

    assert.equal(presentation.stageKey, "translate", substage);
    assert.equal(presentation.substageKey, substage, substage);
    assert.equal(presentation.progressCurrent, expectedCurrent, substage);
    assert.ok(Number(presentation.progressTotal) > 0, substage);
    assert.ok(["percent", unit].includes(presentation.progressUnit), substage);
    assert.notEqual(presentation.progressText, `${substage} start`, substage);
  }
});

test("public display_stage field drives translation stage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-public-stage",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_tail_retry",
      progress: {
        unit: "batch",
        current: 2,
        total: 7,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          substage: "translation_tail_retry",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 2,
            total: 7,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_tail_retry");
  assert.equal(presentation.progressText, "Lô 2/7");
});

test("translation percent substage event updates current substage instead of stale batch progress", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-translation-percent-substage",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "agent_repair",
      substage: "agent_repair",
      progress: {
        unit: "percent",
        current: 65,
        total: 100,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 5216,
            total: 5216,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "agent_repair",
          substage: "agent_repair",
          event_type: "progress",
          progress: {
            unit: "percent",
            current: 65,
            total: 100,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "agent_repair");
  assert.equal(presentation.progressText, "Tiến độ 65%");
  assert.equal(presentation.progressCurrent, 65);
  assert.equal(presentation.progressTotal, 100);
  assert.equal(presentation.progressUnit, "percent");
  assert.equal(Math.round(presentation.displayPercent * 100) / 100, 65);
});

test("background render prewarm does not replace the translation main lane", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-translation-with-render-prewarm",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      stage: "translating",
      substage: "translation_batches",
      lane: "main",
      progress: {
        unit: "batch",
        current: 120,
        total: 900,
      },
      background_stages: [
        {
          display_stage: "render",
          stage: "render_preprocess",
          substage: "render_prewarm",
          lane: "background",
          progress: {
            unit: "step",
            current: 2,
            total: 3,
          },
        },
      ],
    },
    {
      items: [
        {
          seq: 10,
          lane: "main",
          display_stage: "translation",
      stage: "translating",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 121,
            total: 900,
          },
        },
        {
          seq: 11,
          lane: "background",
          display_stage: "render",
          stage: "render_preprocess",
          substage: "render_prewarm",
          event_type: "progress",
          progress: {
            unit: "step",
            current: 3,
            total: 3,
          },
          message: "render payload prewarm: ready indents=333 geometry=836 elapsed=1.58s",
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.visualStageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "Lô 121/900");
  assert.equal(presentation.progressCurrent, 121);
  assert.equal(presentation.progressTotal, 900);
  assert.equal(presentation.progressUnit, "batch");
});
