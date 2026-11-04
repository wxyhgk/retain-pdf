// 前端先挡的单个 PDF 大小上限和后端默认的一样大：以前前端写死 50MB，后端默认 512MB，几百页的扫描书前端就挡了。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { FRONT_MAX_BYTES, FRONT_MAX_SIZE_TEXT } from "../../src/platform/config/upload-constants.ts";

test("前端的上传大小上限 = 后端默认的 DEFAULT_UPLOAD_MAX_BYTES；上传框上写的跟着它", () => {
  const rust = readFileSync(new URL("../../../../backend/packages/retainpdf-core/src/config/upload.rs", import.meta.url), "utf8");
  const match = /pub const DEFAULT_UPLOAD_MAX_BYTES: u64 = (\d+) \* 1024 \* 1024;/u.exec(rust);
  assert.ok(match, "后端的默认上限还在 config/upload.rs");
  assert.equal(FRONT_MAX_BYTES, Number(match[1]) * 1024 * 1024);
  assert.equal(FRONT_MAX_SIZE_TEXT, `${match[1]}MB`);
  const dropzone = readFileSync(new URL("../../src/features/ingest/ui/components/upload/UploadDropzone.tsx", import.meta.url), "utf8");
  assert.match(dropzone, /最大 \{FRONT_MAX_SIZE_TEXT\}/u, "上传框不再写死大小");
  assert.doesNotMatch(dropzone, /最多 999 页/u, "页数上限随所选 OCR，不写死");
});

test("大小上限随所选 OCR：MinerU 整份交 200MB；PaddleOCR、GLM-OCR 分段交，只看后端的 512MB", async () => {
  const { ocrMaxBytes } = await import("../../src/platform/config/providers.ts");
  assert.equal(ocrMaxBytes("mineru"), 200 * 1024 * 1024);
  assert.equal(ocrMaxBytes("paddle"), 0);
  assert.equal(ocrMaxBytes("glm_ocr"), 0);

  const { createBatchFileUploader } = await import("../../src/features/ingest/domain/upload/batch-file-upload.ts");
  let provider = "mineru";
  const sent = [];
  const uploader = createBatchFileUploader({
    configPort: { buildUploadUrl: () => "http://127.0.0.1:41000/api/v1/uploads" },
    apiPrefix: "/api/v1",
    // 和 create-workflow-upload.ts 一样：每次现问。
    frontMaxBytes: () => (ocrMaxBytes(provider) ? Math.min(ocrMaxBytes(provider), FRONT_MAX_BYTES) : FRONT_MAX_BYTES),
    sizeLimitHint: () => (ocrMaxBytes(provider) ? "这是 MinerU 的上限；PaddleOCR、GLM-OCR 分段识别，可以在设置里换成它们" : ""),
    frontMaxPageCount: 0,
    collectUploadFormData: (file) => ({ file: file.name }),
    submitUploadRequest: async (_url, form) => {
      sent.push(form.file);
      return { upload_id: "up-1", document_id: "doc-1", filename: form.file, page_count: 600 };
    },
  });
  const scan = { name: "scan.pdf", size: 300 * 1024 * 1024, type: "application/pdf" };
  await assert.rejects(uploader.uploadFile(scan), { message: "超过 200MB（这是 MinerU 的上限；PaddleOCR、GLM-OCR 分段识别，可以在设置里换成它们）" });
  assert.deepEqual(sent, []);
  provider = "paddle";
  await uploader.uploadFile(scan);
  assert.deepEqual(sent, ["scan.pdf"], "换成 Paddle：300MB 照传");
  await assert.rejects(uploader.uploadFile({ ...scan, size: 600 * 1024 * 1024 }), { message: "超过 512MB" });
});
