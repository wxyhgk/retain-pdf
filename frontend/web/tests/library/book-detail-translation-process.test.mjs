import test from "node:test";
import assert from "node:assert/strict";

const { translationProcessModel } = await import(
  "../../src/features/book-detail/ui/panels/translate/TranslationProcessOverview.js"
);

test("翻译过程：失败任务保留已完成阶段并标记失败阶段", () => {
  const model = translationProcessModel({
    job_id: "job-failed",
    status: "failed",
    display_stage: "translation",
    stage_snapshot: {
      publicStage: "translation",
      stage_detail: "翻译批次失败",
      progress: { current: 3, total: 10 },
    },
  });

  assert.equal(model.currentStage, "translate");
  assert.equal(model.progress, 30);
  assert.deepEqual(
    model.steps.map(({ key, state }) => [key, state]),
    [
      ["ocr", "done"],
      ["translate", "failed"],
      ["render", "pending"],
      ["done", "pending"],
    ],
  );
});

test("翻译过程：成功任务四个阶段全部完成", () => {
  const model = translationProcessModel({
    job_id: "job-done",
    status: "succeeded",
  });

  assert.equal(model.currentStage, "done");
  assert.deepEqual(model.steps.map(({ state }) => state), ["done", "done", "done", "done"]);
});

test("翻译过程：不从非结构化错误文案猜测阶段", () => {
  const model = translationProcessModel({
    job_id: "job-unknown",
    status: "failed",
    stage_detail: "翻译步骤似乎失败",
  });

  assert.equal(model.currentStage, "");
  assert.deepEqual(model.steps.map(({ state }) => state), ["pending", "pending", "pending", "pending"]);
});

test("翻译过程：translate workflow 将 OCR 显示为已复用并直接进入翻译", () => {
  const model = translationProcessModel({
    job_id: "translate-from-ocr",
    workflow: "translate",
    status: "queued",
  });

  assert.equal(model.ocrReused, true);
  assert.equal(model.currentStage, "translate");
  assert.deepEqual(
    model.steps.map(({ key, state }) => [key, state]),
    [
      ["ocr", "done"],
      ["translate", "active"],
      ["render", "pending"],
      ["done", "pending"],
    ],
  );
});

test("翻译过程：后端 stages 是 OCR 复用任务的权威状态", () => {
  const model = translationProcessModel({
    job_id: "translate-authoritative-stages",
    workflow: "translate",
    status: "queued",
    stages: {
      ocr: { state: "reused" },
      translation: { state: "queued" },
      render: { state: "pending" },
    },
  });

  assert.equal(model.ocrReused, true);
  assert.equal(model.currentStage, "translate");
  assert.deepEqual(model.steps.map(({ state }) => state), ["done", "active", "pending", "pending"]);
});
