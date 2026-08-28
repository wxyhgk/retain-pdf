import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  collectStageProgressByKey,
  resolveDisplayedStagePresentation,
} from "../src/js/job-status/job-stage-presentation.js";
import { resolveJobDisplayState } from "../src/js/job-status/job-display-state.js";
import {
  publicStageKeyOf,
  summarizeStageKey,
} from "../src/js/job-status/job-status-summary.js";
import {
  publicSubstageKeyOf,
  stageSubtypeOfPayload,
} from "../src/js/job-status/job-stage-substage-adapter.js";
import {
  eventStageForMatch,
  normalizedStageEventRecord,
  stagePayloadFromEventRecord,
} from "../src/js/job-status/job-stage-event-record.js";
import { progressFromEvent } from "../src/js/job-status/job-stage-event-progress.js";
import {
  jobProgressRecord,
} from "../src/js/job-status/job-stage-job-progress.js";
import {
  publicProgressOf,
  structuredProgressOf,
  legacyProgressOf,
} from "../src/js/job-status/job-stage-progress-adapter.js";
import { normalizeProgressRecordFromEventRecord } from "../src/js/job-status/job-stage-progress-record-normalizer.js";
import {
  adaptJobEventStageSnapshot,
  adaptJobStageSnapshot,
} from "../src/js/job-status/job-stage-contract-adapter.js";
import {
  hasCanonicalEventContract,
  progressUnitOf,
  structuredPublicStageOf,
} from "../src/js/job-status/job-stage-event-contract.js";
import { publicStageOf } from "../src/js/job-status/job-stage-presentation-utils.js";

function collectSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(fullPath);
    }
    return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
  });
}

test("frontend progress uses canonical display_stage event contract", () => {
  const progressByKey = collectStageProgressByKey(
    {
      job_id: "job-new-events",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      progress: {
        unit: "batch",
        current: 1,
        total: 8,
      },
    },
    {
      items: [
        {
          seq: 1,
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
        {
          seq: 2,
          display_stage: "translation",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 4,
            total: 8,
          },
        },
        {
          seq: 3,
          display_stage: "render",
          stage: "rendering",
          substage: "render_pages",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 5,
            total: 20,
          },
        },
      ],
    },
  );

  assert.equal(progressByKey.ocr.progressText, "第 12/34 页");
  assert.equal(Math.round(progressByKey.ocr.displayPercent * 100) / 100, 39.71);
  assert.equal(progressByKey.translate.progressText, "第 4/8 批");
  assert.equal(progressByKey.render.progressText, "第 5/20 页");
});

test("succeeded job lights up the done tab regardless of stale display_stage", () => {
  // Backend v1: succeeded jobs ship stage_snapshot=null and no display_stage.
  // Even if a stale display_stage="ocr" leaks through, status="succeeded" must
  // win — otherwise reopening the dialog on a finished job would resurrect the
  // OCR tab via the stage-pin's "fallback to previous stageKey" path.
  const jobPresentation = resolveDisplayedStagePresentation({
    job_id: "job-ocr-subtask-succeeded",
    status: "succeeded",
    display_stage: "ocr",
    stage: "ocr_processing",
    substage: "provider_processing",
    progress: {
      unit: "page",
      current: 12,
      total: 34,
    },
  }, { items: [] });

  // Lower-level adapters operate without status context — they faithfully
  // report whatever stage was passed in. The clamp lives in the higher-level
  // resolveDisplayedStagePresentation pipeline.
  const jobSnapshot = adaptJobStageSnapshot({
    job_id: "job-ocr-subtask-succeeded",
    status: "succeeded",
    display_stage: "ocr",
    stage: "ocr_processing",
    substage: "provider_processing",
    progress: {
      unit: "page",
      current: 12,
      total: 34,
    },
  });

  assert.equal(jobPresentation.stageKey, "done");
  assert.equal(jobPresentation.stageKeyTrusted, true);
  assert.equal(jobSnapshot.stageKey, "ocr");
  assert.equal(jobSnapshot.publicStage, "ocr");
});

test("succeeded job with stage_snapshot=null still resolves to done (new contract)", () => {
  // Real shape of a finished job from rust_api v1: no display_stage, no
  // top-level stage info, stage_snapshot=null. The card must light up the
  // final tab — not stay stuck on whatever the previous frame showed.
  const presentation = resolveDisplayedStagePresentation({
    job_id: "job-new-contract-succeeded",
    status: "succeeded",
    stage_snapshot: null,
    background_snapshots: [],
  }, { items: [] });

  assert.equal(presentation.stageKey, "done");
  assert.equal(presentation.stageKeyTrusted, true);
  assert.equal(presentation.label, "完成");
});

test("running job with display_stage=done does not skip render in the stage flow", () => {
  // Backends sometimes flip display_stage to "done" (or push the same via
  // stage_snapshot.publicStage / a final-artifact signal) while the job is
  // still in render. Without a clamp the stage-flow card would mark every
  // earlier stage as done and jump straight to "完成".
  const directDoneRunning = resolveDisplayedStagePresentation({
    job_id: "job-display-stage-done-running",
    status: "running",
    display_stage: "done",
    progress: { unit: "page", current: 1, total: 4 },
  }, { items: [] });
  assert.equal(directDoneRunning.stageKey, "render");
  assert.equal(directDoneRunning.label.includes("完成"), false);

  const snapshotDoneQueued = resolveDisplayedStagePresentation({
    job_id: "job-snapshot-done-queued",
    status: "queued",
    stage_snapshot: { publicStage: "done", source: "render-flow" },
  }, { items: [] });
  assert.equal(snapshotDoneQueued.stageKey, "render");
  assert.equal(snapshotDoneQueued.label.includes("完成"), false);

  const succeededDone = resolveDisplayedStagePresentation({
    job_id: "job-display-stage-done-succeeded",
    status: "succeeded",
    display_stage: "done",
  }, { items: [] });
  assert.equal(succeededDone.stageKey, "done");
});

test("recent-jobs card label clamps done while the job is still running", async () => {
  const { stageKeyForRecentJobLabel, recentJobStageLabel } = await import(
    "../src/js/components/recent-jobs/recent-job-card-presenter.js"
  );
  // running + display_stage="done" should not advance the small card to "已完成".
  const runningWithDoneFlag = {
    job_id: "recent-running-done-flag",
    status: "running",
    display_stage: "done",
  };
  assert.equal(stageKeyForRecentJobLabel(runningWithDoneFlag), "render");
  assert.equal(recentJobStageLabel(runningWithDoneFlag), "渲染中");

  // queued + stage_snapshot.publicStage="done" should also be clamped.
  const queuedSnapshotDone = {
    job_id: "recent-queued-snapshot-done",
    status: "queued",
    stage_snapshot: { publicStage: "done", source: "render-flow" },
  };
  assert.equal(stageKeyForRecentJobLabel(queuedSnapshotDone), "render");

  // running + runtime_status.publicStage="done" — same clamp via the runtime path.
  const runtimeStatusDone = {
    job_id: "recent-runtime-status-done",
    status: "running",
    runtime_status: { publicStage: "done" },
  };
  assert.equal(stageKeyForRecentJobLabel(runtimeStatusDone), "render");
  assert.equal(recentJobStageLabel(runtimeStatusDone), "渲染中");

  // Truly succeeded jobs must still surface as "已完成".
  const succeededDone = {
    job_id: "recent-succeeded-done",
    status: "succeeded",
    display_stage: "done",
  };
  assert.equal(stageKeyForRecentJobLabel(succeededDone), "done");
  assert.equal(recentJobStageLabel(succeededDone), "已完成");
});

test("library merge keeps recent-jobs item.display_stage out of done while running", async () => {
  const { mergeLibraryJobItem } = await import(
    "../src/js/features/recent-jobs/runtime-item.js"
  );
  // Backend pushes a runtime patch with display_stage="done" while status is still "running".
  const merged = mergeLibraryJobItem(
    { job_id: "recent-merge-running-done", status: "running", stage: "render", display_stage: "render" },
    { job_id: "recent-merge-running-done", status: "running", display_stage: "done" },
    { stageAdapterPort: {} },
  );
  // The item we hand off to the card must not advertise the "done" stage yet.
  assert.notEqual(merged.display_stage, "done");
  assert.notEqual(merged.stage, "done");
  assert.notEqual(merged.runtime_status?.publicStage, "done");

  // Once status flips to succeeded, "done" propagates normally.
  const completed = mergeLibraryJobItem(
    { job_id: "recent-merge-succeeded", status: "running", stage: "render", display_stage: "render" },
    { job_id: "recent-merge-succeeded", status: "succeeded", display_stage: "done" },
    { stageAdapterPort: {} },
  );
  assert.equal(completed.display_stage, "done");
  assert.equal(completed.stage, "done");
});

test("internal completed text does not infer a public stage", () => {
  const runningTranslation = {
    job_id: "job-translation-internal-complete",
    workflow: "book",
    status: "succeeded",
    stage: "translation_batches_complete",
    substage: "translation_batches",
  };
  const runningRender = {
    job_id: "job-render-internal-succeeded",
    workflow: "book",
    status: "succeeded",
    stage: "render_compile_succeeded",
    substage: "render_compile",
  };

  assert.equal(summarizeStageKey(runningTranslation), "idle");
  assert.equal(summarizeStageKey(runningRender), "idle");
  assert.equal(publicStageKeyOf(runningTranslation), "");
  assert.equal(publicStageKeyOf(runningRender), "");
});

test("OCR stage progress keeps latest substage and composite percent", () => {
  const progressByKey = collectStageProgressByKey(
    {
      job_id: "job-ocr-substage-progress",
      workflow: "book",
      status: "running",
      display_stage: "ocr",
      stage: "ocr_processing",
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
            current: 8,
            total: 20,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "ocr",
          stage: "ocr_processing",
          substage: "provider_processing",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 12,
            total: 20,
          },
        },
      ],
    },
  );

  assert.equal(progressByKey.ocr.substageKey, "ocr_processing");
  assert.equal(progressByKey.ocr.current, 12);
  assert.equal(progressByKey.ocr.total, 20);
  assert.equal(progressByKey.ocr.progressText, "第 12/20 页");
  assert.equal(progressByKey.ocr.displayPercent, 57);
  assert.equal(progressByKey.ocr.bySubstage.ocr_processing.current, 12);
});

test("production status code does not import legacy compatibility facades", () => {
  const sourceRoot = path.resolve("src/js");
  const blockedImports = [
    "job-stage-contract.js",
    "job-stage-render-detection.js",
  ];
  for (const blocked of blockedImports) {
    assert.equal(fs.existsSync(path.join(sourceRoot, "job-status", blocked)), false);
  }
  const offenders = collectSourceFiles(sourceRoot)
    .flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      return blockedImports
        .filter((blocked) => source.includes(`/${blocked}`) || source.includes(`./${blocked}`) || source.includes(`../${blocked}`))
        .map((blocked) => `${path.relative(sourceRoot, file)} -> ${blocked}`);
    });

  assert.deepEqual(offenders, []);
});

test("production status code keeps legacy stage payload adapter isolated", () => {
  const sourceRoot = path.resolve("src/js/job-status");
  const allowedFiles = new Set([
    "job-stage-event-record.js",
  ]);
  const offenders = collectSourceFiles(sourceRoot)
    .filter((file) => !allowedFiles.has(path.relative(sourceRoot, file)))
    .flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      return source.includes("legacyStagePayloadFromEventRecord")
        ? [path.relative(sourceRoot, file)]
        : [];
    });

  assert.deepEqual(offenders, []);
});

test("OCR raw stage no longer creates fallback progress or visual state", () => {
  const presentation = resolveDisplayedStagePresentation({
    job_id: "job-ocr-raw-stage-only",
    status: "running",
    display_stage: "ocr",
    stage: "ocr_processing",
  }, { items: [] });

  assert.equal(presentation.stageKey, "ocr");
  assert.equal(presentation.visualStageKey, "ocr");
  assert.equal(presentation.progressCurrent, null);
  assert.equal(presentation.progressTotal, null);
  assert.equal(presentation.progressText, "");
});

test("canonical OCR visual stage ignores raw OCR fallback", () => {
  const progressByKey = collectStageProgressByKey(
    {
      job_id: "job-canonical-ocr-visual",
      status: "running",
      display_stage: "ocr",
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "ocr",
          stage: "ocr_upload",
          substage: "provider_processing",
          progress: {
            unit: "page",
            current: 8,
            total: 20,
          },
        },
      ],
    },
  );

  assert.equal(progressByKey.ocr.stageKey, "ocr");
  assert.equal(progressByKey.ocr.substageKey, "ocr_processing");
  assert.equal(progressByKey.ocr.visualStageKey, "ocr_processing");
  assert.equal(progressByKey.ocr.current, 8);
  assert.equal(progressByKey.ocr.total, 20);
});

test("canonical OCR without recognized substage does not use raw visual fallback", () => {
  const progressByKey = collectStageProgressByKey(
    {
      job_id: "job-canonical-ocr-unknown-substage",
      status: "running",
      display_stage: "ocr",
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "ocr",
          stage: "ocr_upload",
          substage: "provider_waiting",
          progress: {
            unit: "step",
            current: 1,
            total: 3,
          },
        },
      ],
    },
  );

  assert.equal(progressByKey.ocr.stageKey, "ocr");
  assert.equal(progressByKey.ocr.substageKey, "");
  assert.equal(progressByKey.ocr.visualStageKey, "ocr");
});

test("background render events do not advance the main status card", () => {
  const job = {
    job_id: "job-parallel",
    workflow: "book",
    status: "running",
    display_stage: "translation",
    stage: "translating",
    progress: {
      unit: "batch",
      current: 120,
      total: 900,
    },
  };
  const eventsPayload = {
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
          current: 120,
          total: 900,
        },
      },
      {
        seq: 2,
        lane: "background",
        display_stage: "render",
        stage: "render_preprocess",
        substage: "render_prewarm",
        event_type: "progress",
        progress: {
          unit: "step",
          current: 2,
          total: 3,
        },
      },
    ],
  };

  const presentation = resolveDisplayedStagePresentation(job, eventsPayload);
  const progressByKey = collectStageProgressByKey(job, eventsPayload);

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.progressText, "第 120/900 批");
  assert.equal(progressByKey.render, undefined);
});

test("job display state separates main translation from background render prewarm", () => {
  const displayState = resolveJobDisplayState(
    {
      job_id: "job-display-state-parallel",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
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
            current: 1,
            total: 3,
          },
        },
      ],
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
            current: 121,
            total: 900,
          },
        },
        {
          seq: 2,
          lane: "background",
          display_stage: "render",
          stage: "render_preprocess",
          substage: "render_prewarm",
          event_type: "progress",
          payload: {
            display_stage: "translation",
            substage: "translation_batches",
          },
          progress: {
            unit: "step",
            current: 2,
            total: 3,
          },
        },
      ],
    },
  );

  assert.equal(displayState.mainStageKey, "translate");
  assert.equal(displayState.mainSubstageKey, "translation_batches");
  assert.equal(displayState.stagePresentation.progressText, "第 121/900 批");
  assert.equal(displayState.stageProgressByKey.translate.progressText, "第 121/900 批");
  assert.equal(displayState.stageProgressByKey.render, undefined);
  assert.equal(displayState.backgroundStages.length, 1);
  assert.equal(displayState.backgroundStages[0].stageKey, "render");
  assert.equal(displayState.backgroundStages[0].substageKey, "render_prewarm");
  assert.equal(displayState.backgroundStages[0].detail, "正在预热渲染资源");
  assert.equal(displayState.backgroundStages[0].progressText, "预热 2/3");
  assert.equal(displayState.backgroundStages[0].progress.current, 2);
  assert.equal(displayState.backgroundStages[0].progress.total, 3);
  assert.equal(displayState.backgroundStages[0].progress.unit, "step");
  assert.equal(displayState.backgroundStages[0].progress.percent, 2 / 3 * 100);
});

test("latest background render prewarm does not replace translation batch progress", () => {
  const job = {
    job_id: "job-parallel-batch",
    workflow: "book",
    status: "running",
    display_stage: "translation",
    stage: "translating",
    substage: "translation_batches",
    progress: {
      unit: "batch",
      current: 29,
      total: 5216,
    },
  };
  const eventsPayload = {
    items: [
      {
        seq: 41,
        lane: "main",
        display_stage: "translation",
        stage: "translating",
        substage: "translation_batches",
        event_type: "progress",
        progress: {
          unit: "batch",
          current: 29,
          total: 5216,
        },
      },
      {
        seq: 42,
        lane: "background",
        display_stage: "render",
        stage: "render_preprocess",
        substage: "render_prewarm",
        event_type: "progress",
        progress: {
          unit: "step",
          current: 2,
          total: 3,
        },
      },
    ],
  };

  const presentation = resolveDisplayedStagePresentation(job, eventsPayload);
  const progressByKey = collectStageProgressByKey(job, eventsPayload);

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "第 29/5216 批");
  assert.equal(presentation.progressUnit, "batch");
  assert.notEqual(presentation.visualStageKey, "render_prewarm");
  assert.equal(progressByKey.render, undefined);
});

test("same-seq background render prewarm does not replace translation batch progress", () => {
  const job = {
    job_id: "job-parallel-same-seq",
    workflow: "book",
    status: "running",
    display_stage: "translation",
    stage: "translating",
    substage: "translation_batches",
    progress: {
      unit: "batch",
      current: 29,
      total: 5216,
    },
  };
  const eventsPayload = {
    items: [
      {
        seq: 42,
        lane: "main",
        display_stage: "translation",
        stage: "translating",
        substage: "translation_batches",
        event_type: "progress",
        progress: {
          unit: "batch",
          current: 30,
          total: 5216,
        },
      },
      {
        seq: 42,
        lane: "background",
        display_stage: "render",
        stage: "render_preprocess",
        substage: "render_prewarm",
        event_type: "progress",
        progress: {
          unit: "step",
          current: 2,
          total: 3,
        },
      },
    ],
  };

  const presentation = resolveDisplayedStagePresentation(job, eventsPayload);
  const progressByKey = collectStageProgressByKey(job, eventsPayload);

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "第 30/5216 批");
  assert.equal(presentation.progressUnit, "batch");
  assert.notEqual(presentation.visualStageKey, "render_prewarm");
  assert.equal(progressByKey.render, undefined);
});

test("main render prepare events do not override an explicit translation snapshot", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-parallel-main-render",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      progress: {
        unit: "batch",
        current: 120,
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
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 120,
            total: 900,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "render",
          stage: "render_preprocess",
          substage: "render_prewarm",
          event_type: "progress",
          progress: {
            unit: "step",
            current: 1,
            total: 3,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.progressText, "第 120/900 批");
});

test("main render page progress does not override an explicit translation stage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-parallel-main-render-pages",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
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
          seq: 1,
          lane: "main",
          display_stage: "translation",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 120,
            total: 900,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "render",
          stage: "rendering",
          substage: "render_pages",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 20,
            total: 100,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "第 120/900 批");
});

test("render prewarm without lane does not override an explicit translation snapshot", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-parallel-missing-lane",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
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
          seq: 1,
          lane: "main",
          display_stage: "translation",
          stage: "translating",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 120,
            total: 900,
          },
        },
        {
          seq: 2,
          display_stage: "render",
          stage: "render_preprocess",
          substage: "render_prewarm",
          event_type: "progress",
          progress: {
            unit: "step",
            current: 1,
            total: 3,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "第 120/900 批");
});

test("explicit translation job stage wins over render preprocess internals", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-render-preprocess-in-translation",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "render_preprocess",
      substage: "render_prewarm",
      stage_detail: "render payload prewarm: ready indents=333 geometry=836",
      progress: {
        unit: "batch",
        current: 240,
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
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 240,
            total: 900,
          },
        },
        {
          seq: 2,
          lane: "background",
          display_stage: "render",
          stage: "render_preprocess",
          substage: "render_prewarm",
          event_type: "progress",
          message: "render payload prewarm: ready indents=333 geometry=836",
          progress: {
            unit: "step",
            current: 2,
            total: 3,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.stageKeyTrusted, true);
  assert.equal(presentation.progressText, "第 240/900 批");
});

test("render words in message or stage detail do not override display_stage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-render-message",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      progress: {
        unit: "batch",
        current: 8,
        total: 20,
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
          stage_detail: "render payload prewarm: ready indents=333 geometry=836",
          message: "render payload prewarm: ready indents=333 geometry=836",
          progress: {
            unit: "batch",
            current: 8,
            total: 20,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.detail, "正在翻译正文内容");
  assert.equal(presentation.progressText, "第 8/20 批");
});

test("canonical event contract uses display_stage instead of internal render text", () => {
  const translationPrewarmEvent = {
    lane: "main",
    display_stage: "translation",
    stage: "render_preprocess",
    substage: "render_prewarm",
    message: "render payload prewarm: ready",
    progress: {
      unit: "batch",
      current: 8,
      total: 20,
    },
  };
  const renderPrewarmEvent = {
    lane: "background",
    display_stage: "render",
    stage: "render_preprocess",
    substage: "render_prewarm",
    progress: {
      unit: "step",
      current: 1,
      total: 3,
    },
  };

  assert.equal(eventStageForMatch(translationPrewarmEvent), "translate");
  assert.equal(eventStageForMatch(renderPrewarmEvent), "render");
});

test("event stage matching only uses public display stage", () => {
  assert.equal(
    eventStageForMatch({
      display_stage: "translation",
      lane: "main",
      stage: "render_preprocess",
      substage: "translation_batches",
      progress: { unit: "batch", current: 4, total: 10 },
    }),
    "translate",
  );

  assert.equal(
    eventStageForMatch({
      stage: "render_preprocess",
      progress_current: 1,
      progress_total: 3,
      progress_unit: "step",
    }),
    "",
  );
});

test("canonical lane without display_stage does not use user or internal stage for main status", () => {
  const event = {
    lane: "main",
    user_stage: "render",
    stage: "render_preprocess",
    substage: "render_prewarm",
    progress: { unit: "step", current: 1, total: 3 },
  };

  assert.equal(eventStageForMatch(event), "");
  const record = normalizedStageEventRecord(event);
  assert.equal(record.canonicalDisplayStage, "");
  assert.equal(record.publicStage, "");
  assert.equal(record.displayStage, "");
});

test("canonical lane-only payload does not summarize from legacy stage fields", () => {
  const event = {
    lane: "main",
    user_stage: "render",
    stage: "render_preprocess",
    substage: "render_prewarm",
    status: "running",
    progress: { unit: "step", current: 1, total: 3 },
  };

  assert.equal(publicStageOf(event), "");
  assert.equal(summarizeStageKey(event), "running");
});

test("stage payloads synthesized from canonical records keep canonical markers", () => {
  const record = normalizedStageEventRecord({
    lane: "main",
    user_stage: "render",
    stage: "render_preprocess",
    substage: "render_prewarm",
    stage_detail: "render payload prewarm: ready",
    progress: { unit: "step", current: 1, total: 3 },
  });
  const payload = stagePayloadFromEventRecord({ status: "running" }, record);

  assert.equal(payload.lane, "main");
  assert.equal(payload.display_stage, "");
  assert.equal(payload.internal_stage, "");
  assert.equal(payload.stage_detail, "");
  assert.equal(payload.substage, "render_prewarm");
  assert.equal(summarizeStageKey(payload), "running");
});

test("canonical events do not read legacy progress fields", () => {
  const progress = progressFromEvent({
    lane: "main",
    display_stage: "translation",
    stage: "translating",
    substage: "translation_batches",
    progress_current: 28,
    progress_total: 5216,
    progress_unit: "batch",
  });

  assert.deepEqual(progress, {
    current: null,
    total: null,
  });
});

test("progress adapter prefers structured progress over legacy progress fields", () => {
  const payload = {
    progress: {
      unit: "batch",
      current: 12,
      total: 40,
      percent: 30,
    },
    progress_current: 1,
    progress_total: 2,
    progress_unit: "step",
    progress_percent: 50,
  };

  assert.deepEqual(structuredProgressOf(payload), {
    current: 12,
    total: 40,
    percent: 30,
    unit: "batch",
  });
  assert.deepEqual(legacyProgressOf(payload), {
    current: 1,
    total: 2,
    percent: 50,
    unit: "step",
  });
  assert.deepEqual(publicProgressOf(payload), {
    current: 12,
    total: 40,
    percent: 30,
    unit: "batch",
  });
});

test("progress adapter blocks legacy progress fields for canonical lane-only payloads", () => {
  assert.deepEqual(publicProgressOf({
    lane: "main",
    stage: "render_preprocess",
    substage: "render_prewarm",
    progress_current: 1,
    progress_total: 3,
    progress_unit: "step",
    progress_percent: 33,
  }), {
    current: null,
    total: null,
    percent: null,
    unit: "",
  });
});

test("progress adapter preserves legacy progress fields for non-canonical payloads", () => {
  assert.deepEqual(publicProgressOf({
    stage: "translating",
    progress_current: 28,
    progress_total: 5216,
    progress_unit: "batch",
  }), {
    current: 28,
    total: 5216,
    percent: null,
    unit: "batch",
  });
});

test("job snapshot progress record uses structured progress for canonical payloads", () => {
  const canonicalRecord = jobProgressRecord({
    display_stage: "translation",
    lane: "main",
    substage: "translation_batches",
    progress: {
      unit: "batch",
      current: 12,
      total: 40,
      percent: 30,
    },
    progress_current: 1,
    progress_total: 3,
    progress_unit: "step",
    progress_percent: 33,
  }, "translate");

  assert.equal(canonicalRecord.current, 12);
  assert.equal(canonicalRecord.total, 40);
  assert.equal(canonicalRecord.progressUnit, "batch");
  assert.equal(canonicalRecord.progressPercent, 30);

  const laneOnlyRecord = jobProgressRecord({
    lane: "main",
    stage: "render_preprocess",
    substage: "render_prewarm",
    progress_current: 1,
    progress_total: 3,
    progress_unit: "step",
  }, "render");

  assert.equal(laneOnlyRecord, null);
});

test("event progress uses structured progress and keeps legacy fallback isolated", () => {
  assert.deepEqual(progressFromEvent({
    lane: "main",
    display_stage: "translation",
    progress: {
      unit: "batch",
      current: 28,
      total: 5216,
    },
    progress_current: 1,
    progress_total: 3,
  }), {
    current: 28,
    total: 5216,
  });

  assert.deepEqual(progressFromEvent({
    lane: "main",
    stage: "render_preprocess",
    progress_current: 1,
    progress_total: 3,
  }), {
    current: null,
    total: null,
  });

  assert.deepEqual(progressFromEvent({
    stage: "translating",
    payload: {
      current_page: 7,
      total_pages: 20,
    },
  }), {
    current: 7,
    total: 20,
  });
});

test("progress unit helper blocks legacy unit for canonical events", () => {
  assert.equal(progressUnitOf({
    lane: "main",
    stage: "render_preprocess",
    progress_unit: "step",
    payload: {
      progress_unit: "batch",
    },
  }), "");

  assert.equal(progressUnitOf({
    lane: "main",
    display_stage: "translation",
    progress: {
      unit: "batch",
    },
    progress_unit: "step",
  }), "batch");

  assert.equal(progressUnitOf({
    stage: "translating",
    progress_unit: "batch",
  }), "batch");
});

test("stage progress aggregation keeps canonical translation separate from internal render stage", () => {
  const progressByKey = collectStageProgressByKey(
    {
      job_id: "job-canonical-translation-progress",
      status: "running",
      display_stage: "translation",
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
      ],
    },
  );

  assert.equal(progressByKey.translate?.current, 4);
  assert.equal(progressByKey.translate?.total, 10);
  assert.equal(progressByKey.render, undefined);
});

test("progress record normalizer consumes normalized event records", () => {
  const record = normalizedStageEventRecord({
    seq: 1,
    lane: "main",
    display_stage: "translation",
    stage: "render_preprocess",
    substage: "translation_batches",
    progress: { unit: "batch", current: 7, total: 10 },
  });

  const progressRecord = normalizeProgressRecordFromEventRecord(
    { job_id: "job-progress-record-normalizer", status: "running" },
    record,
    "translate",
  );

  assert.equal(progressRecord.stageKey, "translate");
  assert.equal(progressRecord.substageKey, "translation_batches");
  assert.equal(progressRecord.current, 7);
  assert.equal(progressRecord.total, 10);
  assert.equal(progressRecord.progressUnit, "batch");

  const pollutedRecord = normalizeProgressRecordFromEventRecord(
    { job_id: "job-progress-record-normalizer", status: "running" },
    {
      ...record,
      progressUnit: "batch",
      progress: { current: 7, total: 10 },
      item: {
        ...record.item,
        progress: { unit: "batch", current: 7, total: 10 },
        progress_unit: "step",
      },
    },
    "translate",
  );

  assert.equal(pollutedRecord.progressUnit, "batch");
});

test("normalized stage event record builds progress text from structured progress", () => {
  const record = normalizedStageEventRecord({
    seq: 1,
    lane: "main",
    display_stage: "translation",
    stage: "render_preprocess",
    substage: "translation_batches",
    progress: {
      unit: "batch",
      current: 28,
      total: 5216,
    },
    progress_unit: "step",
    progress_current: 1,
    progress_total: 3,
  });

  assert.equal(record.progressUnit, "batch");
  assert.equal(record.progressText, "第 28/5216 批");
});

test("canonical stage event record ignores stage detail for status text", () => {
  const record = normalizedStageEventRecord({
    seq: 1,
    lane: "main",
    display_stage: "translation",
    stage: "translating",
    substage: "translation_batches",
    stage_detail: "翻译 PDF 已生成",
    message: "render payload prewarm: ready indents=333 geometry=836",
    progress: {
      unit: "batch",
      current: 28,
      total: 5216,
    },
  });

  assert.equal(record.progressText, "第 28/5216 批");
  assert.equal(record.stageText, "第 28/5216 批");
});

test("normalized stage event record does not use substage copy without public stage", () => {
  const record = normalizedStageEventRecord({
    seq: 1,
    lane: "main",
    user_stage: "render",
    stage: "render_preprocess",
    substage: "render_prewarm",
    progress: {
      unit: "step",
      current: 1,
      total: 3,
    },
  });

  assert.equal(record.canonicalDisplayStage, "");
  assert.equal(record.progressText, "Tiến độ 1/3");
});

test("structured public stage ignores internal stage values", () => {
  const event = {
    display_stage: "translation",
    stage: "render_preprocess",
    substage: "render_prewarm",
    lane: "background",
  };

  assert.equal(hasCanonicalEventContract(event), true);
  assert.equal(structuredPublicStageOf(event), "translate");
  assert.equal(publicStageOf(event), "translate");
});

test("legacy public stage fallback is removed from structured stage parsing", () => {
  assert.equal(structuredPublicStageOf({
    user_stage: "translation",
    stage: "translating",
  }), "");
  assert.equal(publicStageOf({
    user_stage: "translation",
    stage: "translating",
  }), "");
});

test("job public stage and progress can come from normalized stage snapshot", () => {
  const job = {
    status: "running",
    stage: "render_preprocess",
    current_stage: "render_preprocess",
    progress_current: 1,
    progress_total: 3,
    progress_unit: "step",
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
  };

  assert.equal(publicStageOf(job), "translate");
  assert.deepEqual(publicProgressOf(job), {
    current: 30,
    total: 100,
    percent: 30,
    unit: "batch",
  });
});

test("canonical job wrapper can still use normalized stage snapshot", () => {
  const job = {
    status: "running",
    lane: "main",
    stage: "render_preprocess",
    current_stage: "render_preprocess",
    progress_current: 1,
    progress_total: 3,
    progress_unit: "step",
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
  };

  assert.equal(publicStageOf(job), "translate");
  assert.deepEqual(publicProgressOf(job), {
    current: 30,
    total: 100,
    percent: 30,
    unit: "batch",
  });
});

test("public stage helpers ignore legacy user and internal stage fields", () => {
  const canonicalTranslation = {
    display_stage: "translation",
    stage: "render_preprocess",
    substage: "render_prewarm",
    lane: "main",
  };
  assert.equal(publicStageKeyOf(canonicalTranslation), "translate");
  assert.equal(summarizeStageKey(canonicalTranslation), "translate");

  const canonicalLaneOnly = {
    lane: "main",
    user_stage: "render",
    stage: "render_preprocess",
    substage: "render_prewarm",
    status: "running",
  };
  assert.equal(publicStageKeyOf(canonicalLaneOnly), "");
  assert.equal(summarizeStageKey(canonicalLaneOnly), "running");

  const oldContractPayload = {
    user_stage: "translation",
    stage: "translating",
    status: "running",
  };
  assert.equal(publicStageKeyOf(oldContractPayload), "");
  assert.equal(summarizeStageKey(oldContractPayload), "running");

  const oldContractTranslationWithRenderPrewarm = {
    user_stage: "translation",
    stage: "render_preprocess",
    substage: "render_prewarm",
    status: "running",
  };
  assert.equal(publicStageKeyOf(oldContractTranslationWithRenderPrewarm), "");
  assert.equal(summarizeStageKey(oldContractTranslationWithRenderPrewarm), "running");
});

test("public substage helpers ignore raw internal stage fallback", () => {
  const canonicalStructured = {
    lane: "main",
    display_stage: "translation",
    stage: "render_preprocess",
    substage: "translation_batches",
  };
  assert.equal(publicSubstageKeyOf(canonicalStructured), "translation_batches");
  assert.equal(stageSubtypeOfPayload(canonicalStructured), "translation_batches");

  const canonicalUnknown = {
    lane: "main",
    display_stage: "translation",
    substage: "provider_waiting",
  };
  assert.equal(publicSubstageKeyOf(canonicalUnknown), "");
  assert.equal(stageSubtypeOfPayload(canonicalUnknown), "");

  const legacyUnknown = {
    status: "running",
    substage: "provider_waiting",
  };
  assert.equal(publicSubstageKeyOf(legacyUnknown), "provider_waiting");
  assert.equal(stageSubtypeOfPayload(legacyUnknown), "provider_waiting");

  const legacyRawStageFallback = {
    status: "running",
    stage: "render_preprocess",
  };
  assert.equal(publicSubstageKeyOf(legacyRawStageFallback), "");
  assert.equal(stageSubtypeOfPayload(legacyRawStageFallback), "");
});

test("translation render prewarm snapshot keeps translation wording", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-translate-render-wording",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "render_preprocess",
      substage: "render_prewarm",
      stage_detail: "render payload prewarm: ready indents=333 geometry=836 elapsed=1.58s",
      progress: {
        unit: "batch",
        current: 120,
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
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 120,
            total: 900,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.detail, "正在翻译正文内容");
  assert.equal(presentation.progressText, "第 120/900 批");
});

test("new job detail contract uses display stage instead of internal stage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-new-detail-contract",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "render_preprocess",
      substage: "translation_batches",
      lane: "main",
      stage_detail: "正在翻译第 120/900 批",
      progress: {
        unit: "batch",
        current: 120,
        total: 900,
        percent: 13.333,
      },
      background_stages: [
        {
          display_stage: "render",
          stage: "rendering",
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
    null,
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "第 120/900 批");
  assert.equal(presentation.progressUnit, "batch");
});

test("structured stage detail does not infer render substage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-structured-no-substage",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      lane: "main",
      stage_detail: "render payload prewarm: ready indents=333",
      progress: {
        unit: "batch",
        current: 8,
        total: 20,
      },
    },
    null,
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.detail, "正在翻译正文内容");
  assert.equal(presentation.progressText, "第 8/20 批");
});

test("structured event context uses record substage instead of render detail text", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-event-record-substage",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
          stage: "render_preprocess",
          substage: "translation_batches",
          stage_detail: "render payload prewarm: ready indents=333",
          payload: {
            stage: "render_preprocess",
            substage: "render_prewarm",
            progress_unit: "step",
            progress_current: 1,
            progress_total: 3,
          },
          progress: {
            unit: "batch",
            current: 9,
            total: 20,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.notEqual(presentation.visualStageKey, "render_prewarm");
  assert.equal(presentation.label, "第 2/4 步 · 翻译");
  assert.ok(!presentation.label.includes("预热"));
  assert.equal(presentation.detail, "正在翻译正文内容");
  assert.equal(presentation.progressText, "第 9/20 批");
});

test("canonical payload without display_stage does not infer public stage from internal stage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-canonical-no-display-stage",
      workflow: "book",
      status: "running",
      stage: "render_preprocess",
      lane: "main",
      progress: {
        unit: "batch",
        current: 8,
        total: 20,
      },
    },
    null,
  );

  assert.equal(presentation.stageKey, "running");
  assert.equal(presentation.stageKeyTrusted, false);
  assert.equal(presentation.substageKey, "");
  assert.equal(presentation.progressText, "第 8/20 批");
});

test("fallback stage trust only comes from structured display_stage", () => {
  const structured = resolveDisplayedStagePresentation(
    {
      job_id: "job-structured-fallback-trust",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      progress: {
        unit: "batch",
        current: 8,
        total: 20,
      },
    },
    null,
  );
  const legacy = resolveDisplayedStagePresentation(
    {
      job_id: "job-legacy-fallback-untrusted",
      workflow: "book",
      status: "running",
      user_stage: "translation",
      progress: {
        unit: "batch",
        current: 8,
        total: 20,
      },
    },
    null,
  );

  assert.equal(structured.stageKey, "translate");
  assert.equal(structured.stageKeyTrusted, true);
  assert.equal(legacy.stageKey, "running");
  assert.equal(legacy.stageKeyTrusted, false);
});

test("event presentation ignores legacy user_stage as a public stage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-event-legacy-user-stage",
      workflow: "book",
      status: "running",
      user_stage: "translation",
      progress: {
        unit: "batch",
        current: 8,
        total: 20,
      },
    },
    {
      items: [
        {
          seq: 1,
          user_stage: "translation",
          stage: "translating",
          substage: "translation_batches",
          progress_current: 9,
          progress_total: 20,
          progress_unit: "batch",
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "running");
  assert.equal(presentation.stageKeyTrusted, false);
  assert.equal(presentation.progressText, "第 8/20 批");
});

test("canonical lane-only internal stage does not borrow fallback progress", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-lane-only-no-fallback-progress",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 8,
        total: 20,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          stage: "render_preprocess",
          substage: "render_prewarm",
          event_type: "progress",
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.stageKeyTrusted, true);
  assert.equal(presentation.progressText, "第 8/20 批");
});

test("canonical lane-only internal stage does not drive forward stage selection", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-lane-only-forward-selection",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 8,
        total: 20,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          stage: "render_preprocess",
          substage: "render_prewarm",
          event_type: "progress",
          progress: {
            unit: "step",
            current: 1,
            total: 3,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.notEqual(presentation.visualStageKey, "render_prewarm");
  assert.equal(presentation.progressText, "第 8/20 批");
});

test("canonical lane-only nested payload does not drive forward stage selection", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-lane-only-nested-payload-forward-selection",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 8,
        total: 20,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          payload: {
            stage: "render_preprocess",
            current_stage: "render_preprocess",
            user_stage: "render",
            substage: "render_prewarm",
            progress_current: 1,
            progress_total: 3,
            progress_unit: "step",
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.notEqual(presentation.visualStageKey, "render_prewarm");
  assert.equal(presentation.progressText, "第 8/20 批");
});

test("live stage forward selection prefers display stage over internal stage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-live-stage-public-stage",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 8,
        total: 20,
      },
    },
    {
      live_stage: {
        status: "running",
        display_stage: "translation",
        stage: "render_preprocess",
        substage: "translation_batches",
        progress: {
          unit: "batch",
          current: 9,
          total: 20,
        },
      },
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
          stage: "render_preprocess",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 9,
            total: 20,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "第 9/20 批");
});

test("structured text-only events do not replace structured progress event", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-text-only-event",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 8,
        total: 20,
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
            total: 20,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "translation",
          stage: "translating",
          event_type: "progress",
          stage_detail: "book: completed batch 999/999",
          message: "book: completed batch 999/999",
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.progressText, "第 8/20 批");
});

test("translation internal substage progress advances beyond batch range", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-translation-helper-stage",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 20,
        total: 20,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "translation",
          stage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 20,
            total: 20,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "translation",
          stage: "garbled_repair",
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

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "garbled_repair");
  assert.equal(presentation.progressUnit, "step");
  assert.equal(presentation.displayPercent, 50);
});

test("canonical text-only forward event does not advance the main stage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-forward-text-only-event",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 12,
        total: 20,
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
            current: 12,
            total: 20,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "render",
          stage: "render_preprocess",
          substage: "render_prewarm",
          event_type: "diagnostic",
          stage_detail: "render payload prewarm: ready",
          message: "render payload prewarm: ready",
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "第 12/20 批");
});

test("canonical forward diagnostic without progress does not advance the main stage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-forward-diagnostic-event",
      workflow: "book",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 12,
        total: 20,
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
            current: 12,
            total: 20,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "render",
          stage: "rendering",
          substage: "render_pages",
          event_type: "diagnostic",
          stage_detail: "render page specs ready",
          message: "render page specs ready",
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.progressText, "第 12/20 批");
});

test("public stage engine does not advance OCR from later main stage events", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-ocr-no-forward-events",
      workflow: "book",
      status: "running",
      display_stage: "ocr",
      substage: "provider_processing",
      progress: {
        unit: "page",
        current: 5,
        total: 20,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "ocr",
          substage: "provider_processing",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 5,
            total: 20,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "translation",
          substage: "translation_batches",
          event_type: "progress",
          progress: {
            unit: "batch",
            current: 2,
            total: 10,
          },
        },
        {
          seq: 3,
          lane: "main",
          display_stage: "render",
          substage: "render_pages",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 2,
            total: 20,
          },
        },
        {
          seq: 4,
          lane: "main",
          display_stage: "done",
          event_type: "terminal",
          progress: {
            unit: "percent",
            current: 100,
            total: 100,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "ocr");
  assert.equal(presentation.substageKey, "ocr_processing");
  assert.equal(presentation.progressText, "第 5/20 页");
});

test("public stage engine does not advance render to done from terminal event alone", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-render-no-forward-done",
      workflow: "book",
      status: "running",
      display_stage: "render",
      substage: "render_pages",
      progress: {
        unit: "page",
        current: 30,
        total: 100,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "render",
          substage: "render_pages",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 30,
            total: 100,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "done",
          event_type: "terminal",
          progress: {
            unit: "percent",
            current: 100,
            total: 100,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "render");
  assert.equal(presentation.substageKey, "render_pages");
  assert.equal(presentation.progressText, "第 30/100 页");
});

test("public stage engine keeps running payloads without public stage from event promotion", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-running-no-public-stage",
      workflow: "book",
      status: "running",
      stage: "render_preprocess",
      progress: {
        unit: "step",
        current: 1,
        total: 3,
      },
    },
    {
      items: [
        {
          seq: 1,
          lane: "main",
          display_stage: "render",
          substage: "render_pages",
          event_type: "progress",
          progress: {
            unit: "page",
            current: 1,
            total: 10,
          },
        },
        {
          seq: 2,
          lane: "main",
          display_stage: "done",
          event_type: "terminal",
          progress: {
            unit: "percent",
            current: 100,
            total: 100,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "running");
  assert.equal(presentation.stageKeyTrusted, false);
});

test("job stage contract adapter follows public display stage over internal stage", () => {
  const snapshot = adaptJobStageSnapshot({
    job_id: "job-contract-1",
    status: "running",
    display_stage: "translation",
    stage: "render_preprocess",
    substage: "render_prewarm",
    lane: "background",
    stage_detail: "render payload prewarm: ready",
    progress: {
      unit: "step",
      current: 1,
      total: 3,
    },
  });

  assert.equal(snapshot.jobId, "job-contract-1");
  assert.equal(snapshot.stageKey, "translate");
  assert.equal(snapshot.publicStage, "translation");
  assert.equal(snapshot.substage, "render_prewarm");
  assert.equal(snapshot.detail, "translate");
  assert.equal(snapshot.lane, "background");
  assert.deepEqual(snapshot.progress, {
    current: 1,
    total: 3,
    percent: 33.33333333333333,
    unit: "step",
  });
});

test("job stage contract adapter does not infer stage from canonical lane-only payload", () => {
  const snapshot = adaptJobStageSnapshot({
    job_id: "job-contract-lane-only",
    status: "running",
    lane: "background",
    stage: "render_preprocess",
    substage: "render_prewarm",
    stage_detail: "render payload prewarm: ready",
    progress: {
      unit: "step",
      current: 1,
      total: 3,
    },
  });

  assert.equal(snapshot.jobId, "job-contract-lane-only");
  assert.equal(snapshot.stageKey, "");
  assert.equal(snapshot.publicStage, "");
  assert.equal(snapshot.lane, "background");
  assert.equal(snapshot.substage, "render_prewarm");
  assert.equal(snapshot.detail, "");
  assert.equal(snapshot.source, "canonical-empty-stage");
});

test("job stage event adapter reads canonical fields from nested payload", () => {
  const snapshot = adaptJobEventStageSnapshot({
    seq: 9,
    event_type: "progress",
    payload: {
      display_stage: "translation",
      lane: "main",
      stage: "render_preprocess",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 12,
        total: 40,
      },
    },
  });

  assert.equal(snapshot.stageKey, "translate");
  assert.equal(snapshot.publicStage, "translation");
  assert.equal(snapshot.substage, "translation_batches");
  assert.equal(snapshot.detail, "正在翻译正文内容");
  assert.equal(snapshot.lane, "main");
  assert.equal(snapshot.progress.unit, "batch");
  assert.equal(snapshot.progress.current, 12);
  assert.equal(snapshot.progress.total, 40);
});

test("main translation display stage blocks render preprocess internal stage", () => {
  const presentation = resolveDisplayedStagePresentation(
    {
      job_id: "job-main-translation-render-internal",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 10,
        total: 100,
      },
    },
    {
      items: [
        {
          seq: 1,
          event_type: "progress",
          lane: "main",
          display_stage: "translation",
          stage: "render_preprocess",
          substage: "translation_batches",
          progress: {
            unit: "batch",
            current: 11,
            total: 100,
          },
        },
      ],
    },
  );

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.notEqual(presentation.visualStageKey, "render_prewarm");
  assert.equal(presentation.progressCurrent, 11);
  assert.equal(presentation.progressTotal, 100);
  assert.equal(presentation.progressUnit, "batch");
});

test("fallback presentation uses normalized stage snapshot before raw internal fields", () => {
  const presentation = resolveDisplayedStagePresentation({
    job_id: "job-fallback-normalized-snapshot",
    status: "running",
    stage: "render_preprocess",
    current_stage: "render_preprocess",
    stage_detail: "render payload prewarm: ready",
    progress: {
      current: 1,
      total: 3,
      percent: 33,
      unit: "step",
    },
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

  assert.equal(presentation.stageKey, "translate");
  assert.equal(presentation.substageKey, "translation_batches");
  assert.equal(presentation.detail, "正在翻译正文内容");
  assert.equal(presentation.progressCurrent, 30);
  assert.equal(presentation.progressTotal, 100);
  assert.equal(presentation.progressUnit, "batch");
  assert.equal(/render|prewarm|渲染/.test(`${presentation.label} ${presentation.detail} ${presentation.progressText}`), false);
});
