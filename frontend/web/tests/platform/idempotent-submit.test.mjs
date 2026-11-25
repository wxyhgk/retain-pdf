/** 建任务、续跑、重试带 Idempotency-Key；续跑 / 重试撞上 409 derived_job_active 时切到在跑的那个任务。
 *
 * 后端 2026-11-24 起（#187，docs/api/00-约定/06-防重复提交.md）：带同一把 key 的重复请求只执行一次；
 * 续跑 / 重试时这个任务已经派生出一个在排队或在跑的新任务，回 409 derived_job_active 和 active_job_id。
 * 另外 2026-11-25 起按任务读文件的接口对很早版本的任务回 409 legacy_job_unsupported，统一换成一句能照着做的话。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { IDEMPOTENCY_KEY_HEADER, newIdempotencyKey } from "../../../packages/api/src/idempotency.ts";
import { LEGACY_JOB_UNSUPPORTED_MESSAGE, attachErrorDetails } from "../../../packages/api/src/http.ts";
import { request } from "../../../packages/api/src/request.ts";
import { fetchJobStageActions, resolveOcrAmbiguity, resumeJob as resumeJobApi, retryJobStage as retryJobStageApi } from "../../../packages/api/src/jobs-actions.ts";
import { ocrDocument, translateDocument } from "../../../packages/api/src/documents.ts";
import { submitJobRequest } from "../../../packages/api/src/jobs-submit.ts";
import {
  derivedActiveJobId,
  describeActionError,
  resumeJob,
  retryJobStage,
} from "../../src/platform/api/domains/jobs-actions.ts";
import { isAlreadyActiveReceipt } from "../../src/features/job-detail/domain/dialog/resume-actions.ts";
import { resolveOcrAmbiguityRecovery } from "../../src/features/job-detail/domain/ocr-ambiguity-recovery.ts";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const ok = (data) => json({ code: 0, message: "ok", data });
const conflict = (reason, extra = {}) => json({
  code: 40900,
  message: "conflict",
  error: { code: "CONFLICT", details: { reason, ...extra } },
}, 409);

/** 换掉全局 fetch，记下每个请求的方法、地址和请求头；route 决定回什么。 */
async function withFetch(route, run) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = `${input}`;
    const headers = new Headers(init.headers || {});
    const call = { url, method: init.method || "GET", headers };
    calls.push(call);
    return route(call);
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

test("key 是 UUID v4；没有 randomUUID（局域网 http 打开）时退回 getRandomValues", () => {
  const a = newIdempotencyKey();
  const b = newIdempotencyKey();
  assert.match(a, UUID_V4);
  assert.notEqual(a, b);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const real = globalThis.crypto;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { getRandomValues: (bytes) => real.getRandomValues(bytes) },
  });
  try {
    assert.match(newIdempotencyKey(), UUID_V4);
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
});

test("request：给了 idempotencyKey 才带请求头", async () => {
  const seen = [];
  const fetchImpl = async (_url, init) => {
    seen.push(new Headers(init.headers).get(IDEMPOTENCY_KEY_HEADER));
    return ok({});
  };
  await request({ apiPrefix: "/api/v1", method: "POST", path: "jobs", body: {}, options: { fetchImpl, idempotencyKey: "k-1" } });
  await request({ apiPrefix: "/api/v1", method: "POST", path: "jobs", body: {}, options: { fetchImpl } });
  assert.deepEqual(seen, ["k-1", null]);
});

test("建任务的 6 个入口每次都带一把新 key；读接口不带", async () => {
  await withFetch(() => ok({ job_id: "job-new", status: "queued", submission: { job_id: "job-new" } }), async (calls) => {
    await submitJobRequest("/api/v1", { workflow: "ocr", source: { upload_id: "up-1" }, ocr: { provider: "paddle" } });
    await translateDocument("/api/v1", "doc-1", { workflow: "book" });
    await ocrDocument("/api/v1", "doc-1", { workflow: "ocr" });
    await resumeJobApi("job-1", "/api/v1");
    await retryJobStageApi("job-1", "/api/v1", "render");
    await resolveOcrAmbiguity("job-1", "/api/v1", { resolution: "accept_duplicate_risk" });
    await fetchJobStageActions("job-1", "/api/v1");
    const keys = calls.map((call) => call.headers.get(IDEMPOTENCY_KEY_HEADER));
    const posts = calls.filter((call) => call.method === "POST").map((call) => new URL(call.url).pathname);
    assert.deepEqual(posts, [
      "/api/v1/jobs",
      "/api/v1/documents/doc-1/translate",
      "/api/v1/documents/doc-1/ocr",
      "/api/v1/jobs/job-1/actions/resume",
      "/api/v1/jobs/job-1/actions/retry-stage",
      "/api/v1/jobs/job-1/actions/resolve-ocr-ambiguity",
    ]);
    const postKeys = keys.slice(0, 6);
    for (const key of postKeys) assert.match(key, UUID_V4);
    assert.equal(new Set(postKeys).size, 6, "每次点击一把新 key");
    assert.equal(keys[6], null, "GET 不带");
  });
});

test("409 derived_job_active：错误对象挂上 activeJobId", () => {
  const error = attachErrorDetails(new Error("x"), { error: { code: "CONFLICT", details: { reason: "derived_job_active", active_job_id: "job-2" } } });
  assert.equal(error.reason, "derived_job_active");
  assert.equal(error.activeJobId, "job-2");
  assert.equal(derivedActiveJobId(error), "job-2");
  assert.equal(derivedActiveJobId(Object.assign(new Error("x"), { reason: "job_active", activeJobId: "job-2" })), "");
  assert.match(describeActionError(Object.assign(new Error("x"), { reason: "derived_job_active" })), /等它结束/);
});

test("续跑撞上在跑的派生任务：返回指向它的回执（already_active），不报错", async () => {
  await withFetch((call) => (call.method === "POST"
    ? conflict("derived_job_active", { active_job_id: "job-2" })
    : ok({ job_id: "job-1", request_payload: {} })), async () => {
    const receipt = await resumeJob("job-1", "/api/v1");
    assert.equal(receipt.job_id, "job-2");
    assert.equal(receipt.active_job_id, "job-2");
    assert.equal(receipt.source_job_id, "job-1");
    assert.equal(receipt.already_active, true);
    assert.ok(isAlreadyActiveReceipt(receipt));
  });
});

test("重试撞上在跑的派生任务：回执带上书的信息；别的 409 照旧抛", async () => {
  await withFetch((call) => (call.method === "POST"
    ? conflict("derived_job_active", { active_job_id: "job-3" })
    : ok({ job_id: "job-1", request_payload: {} })), async () => {
    const receipt = await retryJobStage("job-1", "/api/v1", "render", { document_id: "doc-1", title: "书名" });
    assert.equal(receipt.job_id, "job-3");
    assert.equal(receipt.document_id, "doc-1");
    assert.equal(receipt.title, "书名");
    assert.equal(receipt.already_active, true);
  });
  await withFetch((call) => (call.method === "POST"
    ? conflict("job_active")
    : ok({ job_id: "job-1", request_payload: {} })), async () => {
    await assert.rejects(resumeJob("job-1", "/api/v1"), (error) => error.reason === "job_active");
  });
});

test("OCR 歧义处理撞上在跑的派生任务：关窗口、跟进那个任务，不去刷新诊断", async () => {
  const events = [];
  const outcome = await resolveOcrAmbiguityRecovery({
    job: { job_id: "job-1" },
    apiPrefix: "/api/v1",
    descriptor: { allowed_resolutions: ["accept_duplicate_risk"], resolution_revision: 3, receipt_fields: [] },
    resolution: "accept_duplicate_risk",
    values: {},
    resolveOcrAmbiguity: async () => {
      throw Object.assign(new Error("conflict"), { status: 409, reason: "derived_job_active", activeJobId: "job-4" });
    },
    setStatus: (text) => events.push(["status", text]),
    setPending: () => {},
    closeDialog: () => events.push(["close"]),
    setGlobalError: () => {},
    startPolling: (jobId) => events.push(["poll", jobId]),
    refreshDiagnostics: async () => events.push(["refresh"]),
  });
  assert.deepEqual(outcome, { ok: true, conflict: false });
  assert.deepEqual(events.filter(([kind]) => kind !== "status"), [["close"], ["poll", "job-4"]]);
});

test("很早版本的任务读不了产物：不管调用方给的是什么文案，都换成同一句能照着做的话", async () => {
  const fetchImpl = async () => conflict("legacy_job_unsupported");
  await assert.rejects(
    request({ apiPrefix: "/api/v1", method: "GET", path: "jobs/old/reader/document", options: { fetchImpl, onError: (status) => Object.assign(new Error(`读取阅读数据失败(${status})`), { status }) } }),
    (error) => error.message === LEGACY_JOB_UNSUPPORTED_MESSAGE && error.reason === "legacy_job_unsupported" && error.status === 409,
  );
});
