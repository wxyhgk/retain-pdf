import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {
  location: { protocol: "http:", hostname: "127.0.0.1" },
  __FRONT_RUNTIME_CONFIG__: {
    apiBase: "http://127.0.0.1:41000",
    xApiKey: "translation-debug-key",
  },
};

const {
  fetchTranslationDiagnostics,
  fetchTranslationItem,
  replayTranslationItem,
  reviseTranslationItem,
} = await import("@retainpdf/api/translation-debug");

function notFound(reason) {
  const error = reason ? { code: "NOT_FOUND", details: { reason } } : { code: "NOT_FOUND" };
  return new Response(JSON.stringify({ code: 404, message: "x", error }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

async function withFetch(response, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response();
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("翻译报告、清单还没产出（404 + not_ready）提示还没生成，不说成找不到", async () => {
  await withFetch(() => notFound("not_ready"), async () => {
    await assert.rejects(fetchTranslationDiagnostics("job-1", "/api/v1"), /还没生成/);
    await assert.rejects(fetchTranslationItem("job-1", "item-1", "/api/v1"), /还没生成/);
    await assert.rejects(replayTranslationItem("job-1", "item-1", "/api/v1"), /还没生成/);
  });
});

test("不带 reason 的 404 照旧是找不到", async () => {
  await withFetch(() => notFound(""), async () => {
    await assert.rejects(fetchTranslationDiagnostics("job-1", "/api/v1"), /未找到翻译调试信息/);
    await assert.rejects(fetchTranslationItem("job-1", "item-1", "/api/v1"), /未找到该翻译 item，请确认/);
    await assert.rejects(replayTranslationItem("job-1", "item-1", "/api/v1"), /无法重放/);
  });
});

function errorResponse(status, code, details) {
  return new Response(JSON.stringify({ code: status, message: "x", error: { code, message: "backend says no", details } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("改单条译文：PATCH 到 /jobs/:id/translations/:item，带上请求体", async () => {
  const seen = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    seen.push({ url: String(input?.url ?? input), method: init?.method, body: init?.body });
    return new Response(JSON.stringify({ code: 0, data: { job_id: "job-1", item_id: "p001-b002", changed: true, generation: 3 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const view = await reviseTranslationItem("job-1", "p001-b002", { translated_text: "新", source: "user" }, "/api/v1");
    assert.equal(view.generation, 3);
    assert.equal(seen[0].method, "PATCH");
    assert.match(seen[0].url, /\/api\/v1\/jobs\/job-1\/translations\/p001-b002$/);
    assert.deepEqual(JSON.parse(seen[0].body), { translated_text: "新", source: "user" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("改单条译文被拒：按 details.reason 说人话，校验没过时带上每一条问题", async () => {
  const issues = [{ item_id: "p001-b002", kind: "math_delimiter_unbalanced", severity: "error", message: "unbalanced $", retryable: false }];
  await withFetch(() => errorResponse(422, "TRANSLATION_REVISION_REJECTED", { reason: "validation_failed", validation: { passed: false, issues } }), async () => {
    await assert.rejects(reviseTranslationItem("job-1", "p001-b002", { translated_text: "x", source: "user" }, "/api/v1"), (error) => {
      assert.match(error.message, /没通过检查/);
      assert.equal(error.status, 422);
      assert.equal(error.reason, "validation_failed");
      assert.deepEqual(error.issues, issues);
      return true;
    });
  });
  await withFetch(() => errorResponse(409, "TRANSLATION_REVISION_CONFLICT", { reason: "job_running", status: "running" }), async () => {
    await assert.rejects(reviseTranslationItem("job-1", "p001-b002", { translated_text: "x", source: "user" }, "/api/v1"), /正在处理/);
  });
  await withFetch(() => errorResponse(500, "INTERNAL", {}), async () => {
    await assert.rejects(reviseTranslationItem("job-1", "p001-b002", { translated_text: "x", source: "user" }, "/api/v1"), /保存译文失败：backend says no/);
  });
});
