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
