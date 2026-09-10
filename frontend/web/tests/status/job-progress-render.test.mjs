import test from "node:test";
import assert from "node:assert/strict";

import {
  collectStageProgressByKey,
  resolveDisplayedStagePresentation,
} from "@retainpdf/domain/job-status";
import { compositeRenderProgressFromEvents } from "@retainpdf/domain/job-status";
import { shouldReplaceCurrentStageProgress } from "@retainpdf/domain/job-status";
import { stageProgressAdapterFor } from "@retainpdf/domain/job-status";

test("resolveDisplayedStagePresentation exposes composite render compile progress", () => {
  const job = {
    job_id: "job-render",
    workflow: "book",
    status: "running",
    display_stage: "render",
    stage: "rendering",
    progress: {
      unit: "percent",
      current: 0,
      total: 100,
    },
  };
  const eventsPayload = {
    items: [
      {
        seq: 1,
        display_stage: "render",
        event_type: "stage_progress",
        stage: "render_prepare",
        substage: "render_prepare",
        progress: {
          unit: "step",
          current: 1,
          total: 2,
        },
      },
      {
        seq: 2,
        display_stage: "render",
        event_type: "stage_progress",
        stage: "rendering",
        substage: "render_pages",
        progress: {
          unit: "page",
          current: 5,
          total: 10,
        },
      },
      {
        seq: 3,
        display_stage: "render",
        event_type: "stage_progress",
        stage: "compile",
        substage: "render_compile",
        progress: {
          unit: "step",
          current: 1,
          total: 2,
        },
      },
    ],
  };

  const presentation = resolveDisplayedStagePresentation(job, eventsPayload);

  assert.equal(presentation.stageKey, "render");
  assert.equal(presentation.progressCurrent, 90);
  assert.equal(presentation.progressTotal, 100);
  assert.equal(presentation.displayPercent, 90);
  assert.equal(presentation.progressUnit, "percent");
  assert.equal(presentation.progressText, "正在编译 PDF");
});

test("resolveDisplayedStagePresentation preserves composite render prewarm progress text", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-prewarm",
      workflow: "book",
      status: "running",
      display_stage: "render",
      stage: "rendering",
    },
    {
      items: [
        {
          seq: 1,
          display_stage: "render",
          event_type: "stage_progress",
          stage: "rendering",
          substage: "render_prewarm",
          progress: {
            unit: "step",
            current: 2,
            total: 4,
          },
        },
      ],
    },
  );

  assert.equal(presentation.progressCurrent, 5);
  assert.equal(presentation.progressTotal, 100);
  assert.equal(presentation.progressUnit, "percent");
  assert.equal(presentation.progressText, "预热 2/4");
});

test("resolveDisplayedStagePresentation accepts structured event progress objects", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-structured-progress",
      workflow: "book",
      status: "running",
      display_stage: "render",
      stage: "rendering",
      progress: {
        current: 0,
        total: 100,
        percent: 0,
        unit: "percent",
      },
    },
    {
      items: [
        {
          seq: 1,
          display_stage: "render",
          stage: "rendering",
          substage: "render_pages",
          progress: {
            unit: "page",
            current: 4,
            total: 20,
            percent: 20,
          },
        },
        {
          seq: 2,
          display_stage: "render",
          stage: "rendering",
          substage: "render_compile",
          progress: {
            unit: "step",
            current: 1,
            total: 2,
            percent: 50,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "render");
  assert.equal(presentation.progressCurrent, 90);
  assert.equal(presentation.progressTotal, 100);
  assert.equal(presentation.displayPercent, 90);
  assert.equal(presentation.progressUnit, "percent");
  assert.equal(presentation.progressText, "正在编译 PDF");
});

test("main render event does not advance an explicit translation snapshot", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-render-after-translation",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 8,
        total: 8,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 8,
            total: 8,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "render",
      stage: "rendering",
          stage: "rendering",
          substage: "render_pages",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 1,
            total: 8,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "翻译批次完成");
  assert.equal(presentation.progressUnit, "batch");
});

test("render page progress is preferred over render step progress for historical render summary", () => {
  const progressByKey = collectStageProgressByKey(
    {
      job_id: "job-render-substages",
      workflow: "book",
      status: "running",
      display_stage: "render",
      stage: "rendering",
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "render",
      stage: "rendering",
          display_stage: "render",
      stage: "rendering",
          substage: "render_prepare",
          progress: {
            unit: "step",
            current: 1,
            total: 3,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "render",
      stage: "rendering",
          display_stage: "render",
      stage: "rendering",
          substage: "render_pages",
          progress: {
            unit: "page",
            current: 20,
            total: 100,
          },
        },
        {
          seq: 3,
          lane: "main",
          display_stage: "render",
      stage: "rendering",
          display_stage: "render",
      stage: "rendering",
          substage: "render_compile",
          progress: {
            unit: "step",
            current: 1,
            total: 4,
          },
        },
      ],
    },
  );

  assert.equal(progressByKey.render.progressText, "正在编译 PDF");
  assert.equal(progressByKey.render.progressUnit, "percent");
  assert.equal(progressByKey.render.current, 85);
  assert.equal(progressByKey.render.total, 100);
});

test("render composite progress prefers compile over later page event", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-render-compile-priority",
      workflow: "book",
      status: "running",
      display_stage: "render",
      stage: "rendering",
      stage: "rendering",
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "render",
      stage: "rendering",
          stage: "rendering",
          substage: "render_pages",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 80,
            total: 100,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "render",
      stage: "rendering",
          stage: "rendering",
          substage: "render_compile",
          event_type: "progress",
          progress: {
            unit: "step",
            current: 1,
            total: 4,
          },
        },
        {
          seq: 3,
          lane: "main",
          display_stage: "render",
      stage: "rendering",
          stage: "rendering",
          substage: "render_pages",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 99,
            total: 100,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "render");
  assert.equal(presentation.substageKey, "render_compile");
  assert.equal(presentation.progressCurrent, 85);
  assert.equal(presentation.progressTotal, 100);
  assert.equal(presentation.progressUnit, "percent");
  assert.equal(presentation.progressText, "正在编译 PDF");
});

test("render compile event without counts does not fall back to stale page progress", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-render-compile-start",
      workflow: "book",
      status: "running",
      display_stage: "render",
      stage: "rendering",
      stage: "rendering",
      progress: {
        unit: "page",
        current: 80,
        total: 100,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "render",
      stage: "rendering",
          stage: "rendering",
          substage: "render_pages",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 80,
            total: 100,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "render",
      stage: "rendering",
          stage: "rendering",
          substage: "render_compile",
          event_type: "progress",
          progress: {
            unit: "step",
          },
          stage_detail: "开始编译 PDF",
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "render");
  assert.equal(presentation.substageKey, "render_compile");
  assert.equal(presentation.progressText, "正在编译 PDF");
  assert.equal(presentation.progressCurrent, 80);
  assert.equal(presentation.progressTotal, 100);
  assert.equal(presentation.progressUnit, "percent");
});

test("render progress compatibility API uses normalized event records", () => {
  const progress = compositeRenderProgressFromEvents(
    {
      job_id: "job-render-record-api",
      status: "running",
      display_stage: "render",
      stage: "rendering",
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
          stage: "render_preprocess",
          substage: "translation_batches",
          progress: { unit: "batch", current: 4, total: 10 },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "render",
      stage: "rendering",
          stage: "rendering",
          substage: "render_pages",
          progress: { unit: "page", current: 25, total: 100 },
        },
      ],
    },
    { shouldReplaceCurrentStageProgress },
  );

  assert.equal(progress.progressText, "第 25/100 页");
  assert.equal(progress.progressUnit, "percent");
  assert.equal(progress.current, 28);
  assert.equal(progress.total, 100);
});

test("stage progress adapters own translation substage and render composite policies", () => {
  const replace = (_previous, _next) => true;
  const translationContext = {
    latest: null,
    latestSameSubstage: null,
    requestedSubstageKey: "",
    mode: "summary",
  };
  const translationAdapter = stageProgressAdapterFor("translate");
  translationAdapter.record(translationContext, {
    stageKey: "translate",
    substageKey: "translation_batches",
    current: 10,
    total: 20,
    progressUnit: "batch",
    progressText: "第 10/20 批",
    payload: { progress_unit: "batch", progress_current: 10, progress_total: 20 },
  }, {
    shouldReplaceCurrentStageProgress: replace,
    shouldReplaceStageProgress: replace,
  });
  translationAdapter.record(translationContext, {
    stageKey: "translate",
    substageKey: "garbled_repair",
    current: 2,
    total: 5,
    progressUnit: "page",
    progressText: "第 2/5 页",
    payload: { substage: "garbled_repair", progress_unit: "page", progress_current: 2, progress_total: 5 },
  }, {
    shouldReplaceCurrentStageProgress: replace,
    shouldReplaceStageProgress: replace,
  });

  const translationProgress = translationAdapter.final(translationContext);
  assert.equal(translationProgress.bySubstage.translation_batches.progressText, "第 10/20 批");
  assert.equal(translationProgress.bySubstage.garbled_repair.progressText, "第 2/5 页");

  const renderContext = {
    latest: null,
    latestSameSubstage: null,
    requestedSubstageKey: "",
    mode: "summary",
  };
  const renderAdapter = stageProgressAdapterFor("render");
  renderAdapter.record(renderContext, {
    stageKey: "render",
    substageKey: "render_pages",
    current: 50,
    total: 100,
    progressUnit: "page",
    progressText: "第 50/100 页",
    payload: { progress_unit: "page", progress_current: 50, progress_total: 100 },
  }, {
    shouldReplaceCurrentStageProgress: replace,
    shouldReplaceStageProgress: replace,
  });
  renderAdapter.record(renderContext, {
    stageKey: "render",
    substageKey: "render_compile",
    current: 1,
    total: 2,
    progressUnit: "step",
    progressText: "编译 1/2",
    payload: { substage: "render_compile", progress_unit: "step", progress_current: 1, progress_total: 2 },
  }, {
    shouldReplaceCurrentStageProgress: replace,
    shouldReplaceStageProgress: replace,
  });

  const renderProgress = renderAdapter.final(renderContext);
  assert.equal(renderProgress.progressText, "正在编译 PDF");
  assert.equal(renderProgress.progressUnit, "percent");
  assert.equal(renderProgress.current, 90);
  assert.equal(renderProgress.total, 100);
  assert.equal(renderProgress.bySubstage.render_pages.progressText, "第 50/100 页");
  assert.equal(renderProgress.bySubstage.render_pages.current, 45);
  assert.equal(renderProgress.bySubstage.render_compile.progressText, "正在编译 PDF");
  assert.equal(renderProgress.bySubstage.render_compile.current, 90);
});

test("render compile substage hides internal step count in substage progress", () => {
  const progressByKey = collectStageProgressByKey(
    {
      job_id: "job-render-substage-compile-copy",
      workflow: "book",
      status: "running",
      display_stage: "render",
      stage: "rendering",
      stage: "rendering",
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "render",
      stage: "rendering",
          stage: "rendering",
          substage: "render_compile",
          event_type: "progress",
          progress: {
            unit: "step",
            current: 4,
            total: 4,
          },
          stage_detail: "编译 4/4",
        },
      ],
    },
  );

  assert.equal(progressByKey.render.progressText, "渲染完成");
  assert.equal(progressByKey.render.current, 100);
  assert.equal(progressByKey.render.total, 100);
  assert.equal(progressByKey.render.bySubstage.render_compile.progressText, "渲染完成");
  assert.equal(progressByKey.render.bySubstage.render_compile.current, 100);
});

test("render pages compose into percent progress before compile starts", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-render-pages-only",
      workflow: "book",
      status: "running",
      display_stage: "render",
      stage: "rendering",
      stage: "rendering",
      substage: "render_pages",
      progress: {
        unit: "page",
        current: 18,
        total: 34,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "render",
      stage: "rendering",
          stage: "rendering",
          substage: "render_pages",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 18,
            total: 34,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "render");
  assert.equal(presentation.substageKey, "render_pages");
  assert.equal(presentation.progressText, "第 18/34 页");
  assert.equal(presentation.progressCurrent, 47);
  assert.equal(presentation.progressTotal, 100);
  assert.equal(presentation.displayPercent, 47);
  assert.equal(presentation.progressUnit, "percent");
});
