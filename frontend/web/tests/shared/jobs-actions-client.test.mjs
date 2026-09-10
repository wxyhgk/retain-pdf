import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {
  location: { protocol: "http:", hostname: "127.0.0.1" },
  __FRONT_RUNTIME_CONFIG__: {
    apiBase: "http://127.0.0.1:41000",
    xApiKey: "jobs-actions-key",
  },
};

const {
  cancelJob,
  cancelOcrJob,
  resolveOcrAmbiguity,
} = await import("@retainpdf/api/jobs-actions");

function okResponse(data) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("jobs actions:普通取消、OCR 取消和 ambiguity 恢复使用各自规范端点", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: `${url}`, options });
    return okResponse({
      resolution: "accept_duplicate_risk",
      submission: { job_id: "ocr-recovery-1" },
    });
  };

  try {
    await cancelJob("job id", "/api/v1");
    await cancelOcrJob("job id", "/api/v1");
    await resolveOcrAmbiguity("job id", "/api/v1", {
      resolution: "accept_duplicate_risk",
      resolution_revision: 7,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(calls.map(({ url }) => url), [
    "http://127.0.0.1:41000/api/v1/jobs/job%20id/cancel",
    "http://127.0.0.1:41000/api/v1/ocr/jobs/job%20id/cancel",
    "http://127.0.0.1:41000/api/v1/jobs/job%20id/ocr/resolve-ambiguity",
  ]);
  for (const { options } of calls) {
    assert.equal(options.method, "POST");
    assert.equal(options.headers["X-API-Key"], "jobs-actions-key");
  }
  assert.deepEqual(JSON.parse(calls[0].options.body), {});
  assert.deepEqual(JSON.parse(calls[1].options.body), {});
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    resolution: "accept_duplicate_risk",
    resolution_revision: 7,
  });
});

test("jobs actions:409 错误保留 status 供前端刷新诊断", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ message: "revision stale" }),
    { status: 409, headers: { "Content-Type": "application/json" } },
  );
  try {
    await assert.rejects(
      resolveOcrAmbiguity("job-stale", "/api/v1", {
        resolution: "accept_duplicate_risk",
        resolution_revision: 3,
      }),
      (error) => error.status === 409 && /revision stale/.test(error.message),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
