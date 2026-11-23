/** 提交时检测翻译 Key（submit/translation-probe.ts）。
 *
 * 起因：提交前只查 DeepSeek 余额和 OCR Token，通义、智谱、自定义接口的翻译 Key 填错了没人查，
 * 要等 OCR 整本跑完、翻译第一批请求被 401 拒掉才失败。现在提交时顺手测一次，不挡提交，没过就 toast。
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  createTranslationProbe,
  translationProbeInputOf,
  translationProbeWarning,
} from "../../src/features/ingest/domain/actions/submit/translation-probe.js";
import { runSubmitFlow } from "../../src/features/ingest/domain/actions/submit-flow.js";
import { runBatchSubmit } from "../../src/features/ingest/domain/actions/submit/batch.js";

const payload = {
  workflow: "book",
  translation: { api_key: " sk-test ", base_url: "https://dashscope.example/v1", model: "qwen-x", api_protocol: "openai_chat" },
};
const input = translationProbeInputOf(payload);
const unauthorized = { ok: false, status: "unauthorized", summary: "翻译 API Key 无效" };

test("检测参数取自这次真要提交的 payload；只做 OCR、旧的 credential_ref 不测", () => {
  assert.deepEqual(input, { apiKey: "sk-test", baseUrl: "https://dashscope.example/v1", model: "qwen-x", apiProtocol: "openai_chat" });
  assert.equal(translationProbeInputOf({ workflow: "ocr", ocr: {} }), null);
  assert.equal(translationProbeInputOf({ translation: { credential_ref: "ref-1", base_url: "x" } }), null);
  assert.equal(translationProbeInputOf(null), null);
});

test("只对 Key、模型、余额这类确定的配置错误提醒；网络抖动、限流不吓人", () => {
  assert.match(translationProbeWarning(unauthorized), /^翻译 API Key 无效。.*去设置里改好翻译 Key/);
  for (const status of ["model_unavailable", "insufficient_balance", "quota_exceeded", "invalid_input"]) {
    assert.ok(translationProbeWarning({ ok: false, status, summary: "x" }), `${status} 应该提醒`);
  }
  for (const status of ["network_error", "provider_error", "rate_limited", "redirected"]) {
    assert.equal(translationProbeWarning({ ok: false, status, summary: "x" }), "", `${status} 不该提醒`);
  }
  assert.equal(translationProbeWarning({ ok: true, status: "valid" }), "");
  assert.equal(translationProbeWarning(null), "");
});

test("送去探针的是 payload 里的 Key、地址、模型、协议", async () => {
  const sent = [];
  const warning = await createTranslationProbe(async (body) => { sent.push(body); return unauthorized; })(input);
  assert.deepEqual(sent, [{ api_key: "sk-test", base_url: "https://dashscope.example/v1", model: "qwen-x", api_protocol: "openai_chat" }]);
  assert.match(warning, /翻译 API Key 无效/);
});

test("一次上传多本：同一组参数只测一次、只报一次", async () => {
  let calls = 0;
  const validateTranslationKey = async () => { calls += 1; return unauthorized; };
  const probe = createTranslationProbe(validateTranslationKey, { now: () => 1000 });
  const results = await Promise.all([1, 2, 3].map(() => probe(input)));
  assert.equal(calls, 1);
  assert.equal(results.filter(Boolean).length, 1);
});

test("通过的记 10 分钟；没通过的 1 分钟后再提交还会再提醒；换了 Key 立刻重测", async () => {
  let clock = 0;
  const now = () => clock;
  let calls = 0;
  const okProbe = createTranslationProbe(async () => { calls += 1; return { ok: true, status: "valid" }; }, { now });
  await okProbe(input);
  clock = 9 * 60_000;
  await okProbe(input);
  assert.equal(calls, 1, "10 分钟内通过的不该重测（每次都测要花钱）");

  clock = 0;
  let fixedCalls = 0;
  const badProbe = createTranslationProbe(async (body) => {
    if (body.api_key === "sk-new") { fixedCalls += 1; return { ok: true }; }
    return unauthorized;
  }, { now });
  assert.ok(await badProbe(input));
  clock = 30_000;
  assert.equal(await badProbe(input), "");
  clock = 61_000;
  assert.ok(await badProbe(input), "过了 1 分钟还没改，要再提醒");
  await badProbe({ ...input, apiKey: "sk-new" });
  assert.equal(fixedCalls, 1, "换了 Key 要重测");
});

test("探针自己出错（超时、后端不通）不算 Key 有问题，也不缓存", async () => {
  let calls = 0;
  const flaky = async () => { calls += 1; throw new Error("timeout"); };
  const probe = createTranslationProbe(flaky);
  assert.equal(await probe(input), "");
  assert.equal(await probe(input), "");
  assert.equal(calls, 2);
});

function harness(overrides = {}) {
  return {
    workflow: "book",
    desktopMode: false,
    desktopConfigured: true,
    apiPrefix: "/api",
    uploadId: "upload-1",
    configPort: { isMock: () => false },
    setText: () => {},
    workflowNeedsUpload: () => true,
    workflowNeedsCredentials: () => false,
    hasBrowserCredentials: () => true,
    currentRenderSourceJobId: () => "",
    currentBudgetState: () => ({}),
    validateBeforeSubmit: () => true,
    ensureOcrCredentialsReady: () => true,
    collectRunPayload: () => payload,
    submitJobRequest: async () => ({ job_id: "job-new" }),
    libraryEventPort: {},
    ...overrides,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("单本提交：Key 无效不挡提交，任务照样落盘，原因经 notify 报出", async () => {
  const warnings = [];
  let requested = false;
  const result = await runSubmitFlow(harness({
    probeTranslationKey: createTranslationProbe(async () => unauthorized),
    notifyPreflightWarning: (message) => warnings.push(message),
    submitJobRequest: async () => { requested = true; return { job_id: "job-new" }; },
  }));
  assert.equal(result.status, "submitted");
  assert.equal(requested, true);
  await settle();
  assert.ok(warnings.some((text) => /翻译 API Key 无效/.test(text)), JSON.stringify(warnings));
});

test("批量提交：拿第一本的 payload 测一次", async () => {
  const warnings = [];
  const asked = [];
  await runBatchSubmit(harness({
    uploadIds: ["u1", "u2", "u3"],
    collectRunPayload: (overrides) => { asked.push(overrides?.uploadId); return payload; },
    probeTranslationKey: createTranslationProbe(async () => unauthorized),
    notifyPreflightWarning: (message) => warnings.push(message),
  }));
  await settle();
  assert.equal(warnings.filter((text) => /翻译 API Key 无效/.test(text)).length, 1);
  assert.equal(asked[0], "u1");
});

test("DeepSeek 官方的余额检测已经测过 Key 时不再测第二遍", async () => {
  const hadWindow = "window" in globalThis;
  globalThis.window = globalThis;
  try {
    let probed = 0;
    await runSubmitFlow(harness({
      currentBudgetState: () => ({ visible: true, blocking: false, balanceChecked: true }),
      refreshDeepSeekBalance: async () => ({ status: "valid" }),
      probeTranslationKey: createTranslationProbe(async () => { probed += 1; return unauthorized; }),
    }));
    await settle();
    assert.equal(probed, 0);
  } finally {
    if (!hadWindow) delete globalThis.window;
  }
});
