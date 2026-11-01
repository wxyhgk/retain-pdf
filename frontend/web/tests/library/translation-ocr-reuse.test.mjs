import test from "node:test";
import assert from "node:assert/strict";

import {
  inclusivePageNumbers,
  mergeTranslatePayload,
  selectDocumentOcrStatusJob,
  selectReusableOcrJob,
  translationUsesReusedOcr,
} from "../../src/features/library/domain/translation-ocr-reuse.js";

test("OCR 复用：指定范围展开为一基连续页码数组", () => {
  assert.deepEqual(inclusivePageNumbers(2, 5), [2, 3, 4, 5]);
  assert.deepEqual(inclusivePageNumbers(0, 5), []);
  assert.deepEqual(inclusivePageNumbers(5, 2), []);
});

test("OCR 复用：选择最新的成功 OCR-only 任务", () => {
  const selected = selectReusableOcrJob([
    {
      job_id: "ocr-running",
      workflow: "ocr",
      status: "running",
      updated_at: "2026-09-01T10:00:00Z",
    },
    {
      job_id: "ocr-old",
      workflow: "ocr",
      status: "succeeded",
      updated_at: "2026-09-01T08:00:00Z",
    },
    {
      job_id: "ocr-incompatible",
      workflow: "ocr",
      status: "succeeded",
      ocr_reusable: false,
      updated_at: "2026-09-01T11:00:00Z",
    },
    {
      job_id: "ocr-new",
      workflow: "ocr",
      status: "succeeded",
      updated_at: "2026-09-01T09:00:00Z",
    },
  ]);

  assert.equal(selected?.job_id, "ocr-new");
});

test("OCR 复用：失败的整本任务只要 OCR 阶段完成也能作为候选", () => {
  const selected = selectReusableOcrJob([
    {
      job_id: "book-failed-after-ocr",
      workflow: "book",
      status: "failed",
      stages: {
        ocr: { state: "completed" },
        translation: { state: "failed" },
      },
      updated_at: "2026-09-01T09:00:00Z",
    },
  ]);

  assert.equal(selected?.job_id, "book-failed-after-ocr");
  // 派生候选按原样返回，不被改写成 OCR-only 任务。
  assert.equal(selected?.workflow, "book");
  assert.equal(selected?.status, "failed");
});

test("OCR 复用：OCR 阶段未完成的整本任务不是候选", () => {
  assert.equal(
    selectReusableOcrJob([
      {
        job_id: "book-ocr-running",
        workflow: "book",
        status: "running",
        stages: { ocr: { state: "in_progress" } },
        updated_at: "2026-09-01T09:00:00Z",
      },
      {
        job_id: "book-ocr-failed",
        workflow: "book",
        status: "failed",
        stages: { ocr: { state: "failed" } },
        updated_at: "2026-09-01T10:00:00Z",
      },
    ]),
    null,
  );
});

test("OCR 复用：独立 OCR 任务优先于派生候选", () => {
  const selected = selectReusableOcrJob([
    {
      job_id: "book-newer",
      workflow: "book",
      status: "failed",
      stages: { ocr: { state: "completed" } },
      updated_at: "2026-09-02T12:00:00Z",
    },
    {
      job_id: "ocr-older",
      workflow: "ocr",
      status: "succeeded",
      updated_at: "2026-09-01T08:00:00Z",
    },
  ]);

  assert.equal(selected?.job_id, "ocr-older");
});

test("OCR 复用：同类候选内部按时间倒序取最新", () => {
  const selected = selectReusableOcrJob([
    {
      job_id: "book-old",
      workflow: "book",
      status: "failed",
      stages: { ocr: { state: "completed" } },
      updated_at: "2026-09-01T08:00:00Z",
    },
    {
      job_id: "book-new",
      workflow: "book",
      status: "failed",
      stages: { ocr: { state: "reused" } },
      updated_at: "2026-09-01T11:00:00Z",
    },
    {
      job_id: "book-mid",
      workflow: "translate",
      status: "succeeded",
      updated_at: "2026-09-01T09:00:00Z",
    },
  ]);

  assert.equal(selected?.job_id, "book-new");
});

test("OCR 复用：后端不可复用信号对派生候选同样生效", () => {
  const base = {
    workflow: "book",
    status: "failed",
    stages: { ocr: { state: "completed" } },
    updated_at: "2026-09-01T10:00:00Z",
  };

  assert.equal(
    selectReusableOcrJob([{ ...base, job_id: "book-not-reusable", ocr_reusable: false }]),
    null,
  );
  assert.equal(
    selectReusableOcrJob([{ ...base, job_id: "book-source-not-ready", translation_source_ready: false }]),
    null,
  );
  assert.equal(selectReusableOcrJob([{ ...base, job_id: "doc:abc" }]), null);
  assert.equal(selectReusableOcrJob([{ ...base, job_id: "" }]), null);

  // 不可复用的候选被跳过，让位给下一个合法候选。
  assert.equal(
    selectReusableOcrJob([
      { ...base, job_id: "book-blocked", ocr_reusable: false, updated_at: "2026-09-03T10:00:00Z" },
      { ...base, job_id: "book-usable" },
    ])?.job_id,
    "book-usable",
  );
});

test("文档 OCR 状态：整本翻译完成可证明 OCR 已完成", () => {
  const selected = selectDocumentOcrStatusJob([{
    job_id: "book-complete",
    workflow: "book",
    status: "succeeded",
    stages: {
      ocr: { state: "completed" },
      translation: { state: "completed" },
      render: { state: "completed" },
    },
  }]);

  assert.equal(selected?.job_id, "book-complete");
  assert.equal(selected?.workflow, "ocr");
  assert.equal(selected?.status, "succeeded");
  assert.equal(selected?.ocr_status_derived, true);
});

test("文档 OCR 状态：翻译任务有自己的 OCR 子任务时用子任务，不从排在前面的翻译任务推", () => {
  // 列表按更新时间排：OCR 和翻译并行（GLM-OCR）时翻译任务一直在更新，排在子任务前面，而且已经进了 translating。
  const running = selectDocumentOcrStatusJob([
    { job_id: "job-p", workflow: "book", status: "running", stage: "translating", display_stage: "translate" },
    { job_id: "job-p-ocr", workflow: "ocr", status: "running", stage: "ocr_processing" },
  ]);
  assert.equal(running?.job_id, "job-p-ocr");
  assert.equal(running?.status, "running", "从翻译任务推出来会是「已完成」，OCR 站就不亮了");
  assert.equal(running?.ocr_status_derived, undefined);
  const finished = selectDocumentOcrStatusJob([
    { job_id: "job-p", workflow: "book", status: "succeeded" },
    { job_id: "job-p-ocr", workflow: "ocr", status: "succeeded" },
  ]);
  assert.equal(finished?.job_id, "job-p-ocr", "跑完了也用子任务：它有自己的计时");
});

test("文档 OCR 状态：复用 OCR 的翻译任务从提交首帧即显示已完成", () => {
  const selected = selectDocumentOcrStatusJob([{
    job_id: "translate-queued",
    workflow: "translate",
    status: "queued",
    ocr_reused: true,
  }]);

  assert.equal(selected?.status, "succeeded");
});

test("OCR 复用：translate 请求移除 OCR 凭据并保留翻译配置", () => {
  const payload = mergeTranslatePayload(
    {
      ocr: {
        provider: "paddle",
        paddle_token: "must-not-be-sent",
        page_ranges: "2-5",
      },
      translation: {
        model: "deepseek-chat",
        api_key: "translation-key",
      },
    },
    {
      workflow: "translate",
      source: { artifact_job_id: "ocr-ready" },
      translation: { page_ranges: [2, 3, 4, 5] },
    },
  );

  assert.deepEqual(payload, {
    workflow: "translate",
    source: { artifact_job_id: "ocr-ready" },
    translation: {
      model: "deepseek-chat",
      api_key: "translation-key",
      page_ranges: [2, 3, 4, 5],
    },
  });
  assert.equal("ocr" in payload, false);
});

test("OCR 复用：无候选时仍保留完整 book 流程配置", () => {
  const payload = mergeTranslatePayload(
    {
      ocr: { provider: "paddle", paddle_token: "ocr-key" },
      translation: { model: "deepseek-chat" },
    },
    {
      ocr: { page_ranges: "3-4" },
      translation: { start_page: 3, end_page: 4 },
    },
  );

  assert.deepEqual(payload.ocr, {
    provider: "paddle",
    paddle_token: "ocr-key",
    page_ranges: "3-4",
  });
  assert.equal(payload.source, undefined);
  assert.equal(translationUsesReusedOcr({ workflow: "book" }), false);
  assert.equal(translationUsesReusedOcr({ workflow: "translate" }), true);
});
