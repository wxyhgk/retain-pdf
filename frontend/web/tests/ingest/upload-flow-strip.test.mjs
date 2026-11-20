/** 上传弹窗模式下面的流程条：翻译走 上传 → 识别版面 → 翻译 → 译文 PDF，仅 OCR 走 上传 → 识别版面 → Markdown。 */
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { UPLOAD_FLOW_STEPS, UploadFlowStrip } from "../../src/features/ingest/ui/components/upload/UploadFlowStrip.tsx";

test("两种模式的步骤", () => {
  assert.deepEqual(UPLOAD_FLOW_STEPS.translate.map((step) => step.label), ["上传 PDF", "识别版面", "翻译", "译文 PDF"]);
  assert.deepEqual(UPLOAD_FLOW_STEPS.ocr.map((step) => step.label), ["上传 PDF", "识别版面", "Markdown"]);
});

test("每一步一个图标，步骤之间一个箭头（第一步前面没有）", () => {
  const html = renderToStaticMarkup(createElement(UploadFlowStrip, { ocrOnly: true }));
  assert.match(html, /data-flow="ocr"/);
  assert.equal((html.match(/upload-flow-icon/g) || []).length, 3);
  assert.equal((html.match(/upload-flow-arrow/g) || []).length, 2);
});
