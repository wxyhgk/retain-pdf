// 只做 OCR 的任务：单机照旧走 /ocr/jobs（multipart）；多用户走 POST /jobs（JSON + upload_id）。
import test from "node:test";
import assert from "node:assert/strict";
import { setApiAuthMode } from "../../../packages/api/src/internal/runtime.ts";
import { submitJobRequest } from "../../../packages/api/src/jobs-submit.ts";

const OCR_PAYLOAD = { workflow: "ocr", source: { upload_id: "up-1", file: "blob-placeholder" }, ocr: { provider: "mineru" }, runtime: { timeout_seconds: 1800 }, __file: "x" };

test("多用户：OCR 走 /jobs 的 JSON，去掉浏览器里的文件字段；没有 upload_id 直接报错", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: `${url}`, init }); return new Response(JSON.stringify({ code: 0, message: "ok", data: { job_id: "j1" } }), { status: 200, headers: { "content-type": "application/json" } }); };
  try {
    setApiAuthMode("multi");
    await submitJobRequest("/api/v1", OCR_PAYLOAD);
    assert.match(calls[0].url, /\/api\/v1\/jobs$/);
    assert.equal(calls[0].init.credentials, "include");
    assert.deepEqual(JSON.parse(calls[0].init.body), { workflow: "ocr", source: { upload_id: "up-1" }, ocr: { provider: "mineru" }, runtime: { timeout_seconds: 1800 } });
    await assert.rejects(submitJobRequest("/api/v1", { workflow: "ocr", source: {} }), /请先上传文件/);
  } finally {
    setApiAuthMode("single");
    globalThis.fetch = originalFetch;
  }
});
