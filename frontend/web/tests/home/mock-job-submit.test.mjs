import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {
  location: {
    search: "?mock=succeeded",
    protocol: "http:",
    hostname: "127.0.0.1",
  },
};
globalThis.fetch = async () => {
  assert.fail("mock job submission must not call fetch");
};
globalThis.XMLHttpRequest = class {
  constructor() {
    assert.fail("mock OCR submission must not create XMLHttpRequest");
  }
};

const { submitJobRequest } = await import("../../src/platform/api/index.ts");

test("composition submitJobRequest keeps book submission on the mock transport", async () => {
  // 不能带 `mock: true`：那不是 CreateJobInput 的字段，真后端的
  // deny_unknown_fields 会 400 拒掉整个请求。mock 传输是靠 URL 的
  // ?mock=succeeded 选中的，跟 payload 无关。
  const payload = await submitJobRequest("/api/v1", {
    workflow: "book",
    source: {},
  });
  assert.ok(payload?.job_id);
});

test("composition submitJobRequest keeps OCR submission on the mock transport", async () => {
  const payload = await submitJobRequest("/api/v1", {
    workflow: "ocr",
    source: { upload_id: "mock-upload" },
    ocr: { provider: "paddle", paddle_token: "mock-token" },
    mock: true,
  });
  assert.ok(payload?.job_id);
});
