import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {
  location: {
    search: "",
    protocol: "http:",
    hostname: "127.0.0.1",
    origin: "http://127.0.0.1:40001",
  },
};

const { submitJobRequest } = await import("@/platform/api/legacy/jobs-submit.ts");

test("OCR multipart submission sends ocr_credential_ref without Paddle token plaintext", async () => {
  let submittedForm = null;
  const previousXhr = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = class {
    constructor() {
      this.status = 200;
      this.response = { data: { job_id: "job-ocr" } };
      this.upload = { addEventListener() {} };
      this.listeners = {};
    }

    open() {}
    setRequestHeader() {}
    addEventListener(name, callback) { this.listeners[name] = callback; }
    send(form) {
      submittedForm = form;
      this.listeners.load();
    }
  };

  try {
    await submitJobRequest("/api/v1", {
      workflow: "ocr",
      source: { upload_id: "upload-ocr" },
      ocr: {
        provider: "paddle",
        credential_ref: "cred_saved_ocr",
        paddle_token: "",
      },
      runtime: { timeout_seconds: 120 },
    });

    assert.equal(submittedForm.get("ocr_credential_ref"), "cred_saved_ocr");
    assert.equal(submittedForm.has("credential_ref"), false);
    assert.equal(submittedForm.has("paddle_token"), false);
  } finally {
    globalThis.XMLHttpRequest = previousXhr;
  }
});
