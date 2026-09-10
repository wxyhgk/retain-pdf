import test from "node:test";
import assert from "node:assert/strict";

import { normalizeJobPayload } from "@retainpdf/domain/job";

test("normalizeJobPayload completes progress for explicit done jobs", () => {
  const job = normalizeJobPayload({
    code: 0,
    data: {
      job_id: "job-1",
      status: "succeeded",
      display_stage: "done",
      progress: {
        current: 2,
        total: 8,
        percent: 25,
      },
    },
  });

  assert.equal(job.progress_current, 8);
  assert.equal(job.progress_total, 8);
  assert.equal(job.progress_percent, 100);
});

test("normalizeJobPayload completes progress for succeeded jobs with final PDF artifact", () => {
  const job = normalizeJobPayload({
    code: 0,
    data: {
      job_id: "job-final-pdf-ready",
      status: "succeeded",
      output_pdf_ready: true,
      progress: {
        current: 2,
        total: 8,
        percent: 25,
      },
    },
  });

  assert.equal(job.progress_current, 8);
  assert.equal(job.progress_total, 8);
  assert.equal(job.progress_percent, 100);
  assert.equal(job.stage_snapshot.terminal, true);
});

test("normalizeJobPayload does not complete progress for ambiguous succeeded payloads", () => {
  const job = normalizeJobPayload({
    code: 0,
    data: {
      job_id: "job-ambiguous-succeeded",
      status: "succeeded",
      progress: {
        current: 2,
        total: 8,
        percent: 25,
      },
    },
  });

  assert.equal(job.progress_current, 2);
  assert.equal(job.progress_total, 8);
  assert.equal(job.progress_percent, 25);
  assert.notEqual(job.stage_snapshot.stageKey, "done");
  assert.equal(job.stage_snapshot.terminal, false);
});

test("normalizeJobPayload does not complete progress for succeeded non-done public stages", () => {
  const cases = [
    ["ocr", { display_stage: "ocr", stage: "ocr_processing", unit: "page" }],
    ["translate", { display_stage: "translation", stage: "translating", unit: "batch" }],
    ["render", { display_stage: "render", stage: "rendering", unit: "page" }],
    ["translate-legacy", { stage: "translating", unit: "batch" }],
    ["render-legacy", { stage: "rendering", unit: "page" }],
  ];

  for (const [name, payload] of cases) {
    const job = normalizeJobPayload({
      code: 0,
      data: {
        job_id: `job-${name}-subtask`,
        status: "succeeded",
        ...payload,
        progress: {
          unit: payload.unit,
          current: 2,
          total: 8,
          percent: 25,
        },
      },
    });

    assert.equal(job.progress_current, 2, name);
    assert.equal(job.progress_total, 8, name);
    assert.equal(job.progress_percent, 25, name);
    assert.notEqual(job.stage_snapshot.stageKey, "done", name);
  }
});

test("normalizeJobPayload exposes canonical stage snapshot", () => {
  const job = normalizeJobPayload({
    job_id: "job-normalize-stage",
    status: "running",
    display_stage: "translation",
    stage: "render_preprocess",
    stage_detail: "render payload prewarm: ready",
    substage: "translation_batches",
    progress: {
      unit: "batch",
      current: 30,
      total: 100,
    },
  });

  assert.equal(job.stage_snapshot.stageKey, "translate");
  assert.equal(job.stage_snapshot.publicStage, "translation");
  assert.equal(job.stage_snapshot.detail, "正在翻译正文内容");
  assert.equal(job.stage_snapshot.progress.current, 30);
  assert.equal(job.stage_snapshot.progress.total, 100);
  assert.equal(job.stage_snapshot.progress.unit, "batch");
});

test("normalizeJobPayload keeps library identity fields for home-card upsert", () => {
  // 回归：重试/轮询 notify 前走 normalize；若丢掉 document_id/source_job_id，
  // 主页卡对不上原书，一直显示「已翻译」不转圈。
  const job = normalizeJobPayload({
    job_id: "mock-ocr-retry-1",
    source_job_id: "20260520-att-001",
    document_id: "doc-1b8c52d9a304",
    title: "Attention Is All You Need",
    display_name: "Attention Is All You Need",
    cover_url: "mock://document-cover.png",
    thumbnail_url: "mock://document-thumb.png",
    page_count: 15,
    status: "running",
    display_stage: "ocr",
    library_only: false,
    active_job_id: "mock-ocr-retry-1",
  });

  assert.equal(job.job_id, "mock-ocr-retry-1");
  assert.equal(job.source_job_id, "20260520-att-001");
  assert.equal(job.document_id, "doc-1b8c52d9a304");
  assert.equal(job.title, "Attention Is All You Need");
  assert.equal(job.cover_url, "mock://document-cover.png");
  assert.equal(job.page_count, 15);
  assert.equal(job.active_job_id, "mock-ocr-retry-1");
  assert.equal(job.status, "running");
});

test("normalizeJobPayload reads new-contract stage_snapshot and projects legacy fields", () => {
  // Backend rust_api v1 stopped emitting top-level display_stage/stage/substage/lane/
  // stage_detail/progress/background_stages. They live inside stage_snapshot now.
  // The normalizer must project them back to keep ~48 downstream consumers working.
  const running = normalizeJobPayload({
    code: 0,
    message: "ok",
    data: {
      job_id: "job-new-contract-running",
      status: "running",
      stage_snapshot: {
        display_stage: "translation",
        stage: "translating",
        substage: "translation_batches",
        lane: "main",
        stage_detail: "正在翻译，第 3/12 批",
        progress: { unit: "batch", current: 3, total: 12, percent: 25.0 },
      },
      background_snapshots: [
        {
          display_stage: "render",
          stage: "render_preprocess",
          substage: "render_prewarm",
          lane: "background",
          stage_detail: "渲染预热完成",
          progress: { unit: "step", current: 2, total: 3, percent: 66.66 },
        },
      ],
    },
  });

  assert.equal(running.display_stage, "translation");
  assert.equal(running.stage, "translating");
  assert.equal(running.substage, "translation_batches");
  assert.equal(running.stage_detail, "正在翻译，第 3/12 批");
  assert.equal(running.progress.unit, "batch");
  assert.equal(running.progress.current, 3);
  assert.equal(running.progress.total, 12);
  assert.equal(running.progress_unit, "batch");
  assert.equal(running.progress_current, 3);
  assert.equal(running.progress_total, 12);
  assert.equal(running.background_stages.length, 1);
  assert.equal(running.background_stages[0].display_stage, "render");
  assert.equal(running.background_stages[0].substage, "render_prewarm");
  assert.equal(running.stage_snapshot.publicStage, "translation");
  assert.equal(running.stage_snapshot.stageKey, "translate");

  // Terminal job: stage_snapshot is null per contract.
  const terminal = normalizeJobPayload({
    code: 0,
    message: "ok",
    data: {
      job_id: "job-new-contract-terminal",
      status: "succeeded",
      stage_snapshot: null,
      background_snapshots: [],
      artifacts: { pdf_ready: true },
    },
  });

  assert.equal(terminal.status, "succeeded");
  // succeeded job does not advertise display_stage="done" anymore — UI keys off status.
  assert.notEqual(terminal.display_stage, "done");
  assert.equal(terminal.background_stages.length, 0);
  assert.equal(terminal.pdf_ready, true);
});
