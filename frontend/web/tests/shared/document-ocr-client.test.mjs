import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {
  location: { protocol: "http:", hostname: "127.0.0.1" },
  __FRONT_RUNTIME_CONFIG__: {
    apiBase: "http://127.0.0.1:41000",
    xApiKey: "document-ocr-key",
  },
};

const { fetchDocumentJobs, ocrDocument, translateDocument } = await import("@retainpdf/api/documents");

function okResponse(data) {
  // 与真实后端一致：ApiResponse::ok 恒发 {code:0, message:"ok", data}。
  return new Response(JSON.stringify({ code: 0, message: "ok", data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("documents client uses document-scoped OCR and job history endpoints", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: `${url}`, options });
    if (`${url}`.includes("/jobs?")) {
      return okResponse({ items: [{ job_id: "ocr-1", workflow: "ocr", status: "running" }] });
    }
    return okResponse({ job_id: "ocr-1", workflow: "ocr", status: "queued" });
  };

  try {
    const submission = await ocrDocument("/api/v1", "doc id", {
      workflow: "ocr",
      ocr: { page_ranges: "2-4" },
    });
    const history = await fetchDocumentJobs("/api/v1", "doc id");
    await fetchDocumentJobs("/api/v1", "doc id", { limit: 12, offset: 6 });
    assert.equal(submission.job_id, "ocr-1");
    assert.equal(history.items[0].workflow, "ocr");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls[0].url, "http://127.0.0.1:41000/api/v1/documents/doc%20id/ocr");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["X-API-Key"], "document-ocr-key");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    workflow: "ocr",
    ocr: { page_ranges: "2-4" },
  });
  assert.equal(calls[1].url, "http://127.0.0.1:41000/api/v1/documents/doc%20id/jobs?limit=50&offset=0");
  assert.equal(calls[1].options.headers["X-API-Key"], "document-ocr-key");
  assert.equal(calls[2].url, "http://127.0.0.1:41000/api/v1/documents/doc%20id/jobs?limit=12&offset=6");
});

test("documents client preserves OCR artifact-backed translation payload", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: `${url}`, options });
    return okResponse({
      job_id: "translate-1",
      workflow: "translate",
      status: "queued",
      ocr_reused: true,
    });
  };

  try {
    const result = await translateDocument("/api/v1", "doc reuse", {
      workflow: "translate",
      source: { artifact_job_id: "ocr-1" },
      translation: { page_ranges: [2, 3, 4] },
    });
    assert.equal(result.ocr_reused, true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls[0].url, "http://127.0.0.1:41000/api/v1/documents/doc%20reuse/translate");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    workflow: "translate",
    source: { artifact_job_id: "ocr-1" },
    translation: { page_ranges: [2, 3, 4] },
  });
});

test("documents client preserves structured OCR reuse failure details", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      message: "OCR artifact cannot be reused",
      error_code: "OCR_ARTIFACT_NOT_REUSABLE",
      reason: "missing_layout_data",
      can_fallback_to_ocr: true,
    }),
    { status: 422, headers: { "Content-Type": "application/json" } },
  );

  try {
    await assert.rejects(
      translateDocument("/api/v1", "doc-1", {
        workflow: "translate",
        source: { artifact_job_id: "ocr-1" },
      }),
      (error) => error.status === 422
        && error.errorCode === "OCR_ARTIFACT_NOT_REUSABLE"
        && error.reason === "missing_layout_data"
        && error.canFallbackToOcr === true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
