// 凭据校验流程：OCR Token / DeepSeek 连通性 / 余额查询各自走注入的 port，状态写回
// credentials state port。DOM 契约、state port 与浏览器凭据控制器在
// credentials-browser-state.test.mjs。

import test from "node:test";
import assert from "node:assert/strict";
import {
  runDeepSeekBalanceCheck,
  runDeepSeekConnectivityCheck,
  runOcrTokenValidation,
} from "../../src/features/credentials/domain/validation.js";
import {
  handleBrowserDeepSeekValidate,
} from "../../src/features/credentials/domain/deepseek-flow.js";
import { ensureOcrCredentialValidationReady } from "../../src/features/credentials/domain/ocr-readiness-flow.js";
import {
  browserValidationIdForProvider,
  CREDENTIAL_DOM_DATASETS,
  CREDENTIAL_DOM_IDS,
  CREDENTIAL_DOM_SELECTORS,
} from "../../src/features/credentials/domain/credentials-dom-contract.js";

function createState() {
  return {
    credentials: {
      ocrValidation: {
        provider: "",
        token: "",
        status: "",
      },
    },
  };
}

test("runOcrTokenValidation passes injected apiPrefix to OCR validation port", async () => {
  const calls = [];
  const messages = [];
  const result = await runOcrTokenValidation({
    apiPrefix: "/custom/api",
    state: createState(),
    providerId: "paddle",
    token: "ocr-token",
    validateOcrToken: async (...args) => {
      calls.push(args);
      return { ok: true, status: "valid", summary: "ok" };
    },
    setOcrValidationMessage: (...args) => messages.push(args),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [["/custom/api", "paddle", "ocr-token"]]);
  assert.equal(messages.at(-1)[1], "valid");
});

test("runOcrTokenValidation writes OCR validation state through credentials state port", async () => {
  const calls = [];
  const result = await runOcrTokenValidation({
    apiPrefix: "/custom/api",
    providerId: "paddle",
    token: "ocr-token",
    validateOcrToken: async () => ({ ok: true, status: "valid", summary: "ok" }),
    setOcrValidationMessage() {},
    credentialsStatePort: {
      resetOcrValidationCache: () => calls.push(["reset"]),
      setOcrValidationCache: (payload) => calls.push(["set", payload]),
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [[
    "set",
    {
      provider: "paddle",
      token: "ocr-token",
      status: "valid",
    },
  ]]);
});

test("runOcrTokenValidation does not call validation port without token", async () => {
  let called = false;
  const calls = [];
  const result = await runOcrTokenValidation({
    apiPrefix: "/custom/api",
    providerId: "paddle",
    token: "",
    validateOcrToken: async () => {
      called = true;
      return { ok: true };
    },
    setOcrValidationMessage() {},
    credentialsStatePort: {
      resetOcrValidationCache: () => calls.push(["reset"]),
      setOcrValidationCache: (payload) => calls.push(["set", payload]),
    },
  });

  assert.equal(result.ok, false);
  assert.equal(called, false);
  assert.deepEqual(calls, [["reset"]]);
});

test("stored OCR credential ref is ready without exposing or revalidating its secret", async () => {
  let validationCalls = 0;
  const result = await ensureOcrCredentialValidationReady({
    apiPrefix: "/api/v1",
    providerId: "paddle",
    credentials: {
      ocrProvider: "paddle",
      ocrCredentialRef: "cred_saved_ocr",
      paddleToken: "",
    },
    defaultPaddleToken: () => "",
    validateOcrToken: async () => {
      validationCalls += 1;
      return { ok: true };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "stored");
  assert.equal(result.credentialRef, "cred_saved_ocr");
  assert.equal(result.token, "");
  assert.equal(validationCalls, 0);
});

test("runDeepSeekConnectivityCheck passes injected apiPrefix and model to DeepSeek validation port", async () => {
  const calls = [];
  const result = await runDeepSeekConnectivityCheck({
    apiPrefix: "/custom/api",
    apiKey: "sk-test",
    baseUrl: "https://example.test/v1",
    model: "deepseek-flash",
    validateDeepSeekToken: async (...args) => {
      calls.push(args);
      return { ok: true, status: 200, summary: "ok" };
    },
    setDeepSeekValidationMessage() {},
  });

  assert.equal(result.ok, true);
  // model 必须随探针一起送到后端：后端据此走 /chat/completions 真调一次模型，
  // 少了它就退化成只验 Key，用户填错模型仍会拿到绿灯。
  assert.deepEqual(calls, [[
    "/custom/api",
    {
      api_key: "sk-test",
      base_url: "https://example.test/v1",
      model: "deepseek-flash",
      api_protocol: "openai",
    },
  ]]);
});

test("runDeepSeekConnectivityCheck marks in-flight state with the pending tone", async () => {
  const tones = [];
  await runDeepSeekConnectivityCheck({
    apiPrefix: "/custom/api",
    apiKey: "sk-test",
    baseUrl: "https://example.test/v1",
    model: "m",
    validateDeepSeekToken: async () => ({ ok: true, summary: "ok" }),
    setDeepSeekValidationMessage(_message, tone) {
      tones.push(tone);
    },
  });

  // 进行中必须是显式 "pending"：检测按钮只认这个语气来禁用自己，
  // 用空 tone 表示进行中会让每条中性提示都把按钮锁死。
  assert.equal(tones[0], "pending");
  assert.equal(tones.at(-1), "valid");
});

test("runDeepSeekConnectivityCheck surfaces the timeout message instead of a generic network error", async () => {
  const messages = [];
  const timeoutError = new Error("检测超时（30s），请检查 API URL 与网络后重试。");
  timeoutError.timedOut = true;

  const result = await runDeepSeekConnectivityCheck({
    apiPrefix: "/custom/api",
    apiKey: "sk-test",
    baseUrl: "https://example.test/v1",
    model: "m",
    validateDeepSeekToken: async () => {
      throw timeoutError;
    },
    setDeepSeekValidationMessage(message) {
      messages.push(message);
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "timeout");
  assert.equal(result.summary, timeoutError.message);
  assert.equal(messages.at(-1), timeoutError.message);
});

test("runDeepSeekConnectivityCheck still reports a generic failure for non-timeout errors", async () => {
  const result = await runDeepSeekConnectivityCheck({
    apiPrefix: "/custom/api",
    apiKey: "sk-test",
    baseUrl: "https://example.test/v1",
    model: "m",
    validateDeepSeekToken: async () => {
      throw new Error("提交失败: 500 boom");
    },
    setDeepSeekValidationMessage() {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 0);
  // 非超时异常不把原始 HTTP 文案抛给用户。
  assert.ok(!`${result.summary}`.includes("boom"));
});

test("runDeepSeekConnectivityCheck does not call validation port without API key", async () => {
  let called = false;
  const result = await runDeepSeekConnectivityCheck({
    apiPrefix: "/custom/api",
    apiKey: "",
    baseUrl: "https://example.test/v1",
    validateDeepSeekToken: async () => {
      called = true;
      return { ok: true };
    },
    setDeepSeekValidationMessage() {},
  });

  assert.equal(result.ok, false);
  assert.equal(called, false);
});

test("runDeepSeekBalanceCheck passes injected apiPrefix to balance port", async () => {
  const calls = [];
  const result = await runDeepSeekBalanceCheck({
    apiPrefix: "/custom/api",
    apiKey: "sk-test",
    baseUrl: "https://example.test/v1",
    queryDeepSeekBalance: async (...args) => {
      calls.push(args);
      return { ok: true, is_available: true };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [[
    "/custom/api",
    {
      api_key: "sk-test",
      base_url: "https://example.test/v1",
    },
  ]]);
});

test("handleBrowserDeepSeekValidate writes balance through credentials state port", async () => {
  const calls = [];
  const messages = [];
  const result = await handleBrowserDeepSeekValidate({
    apiPrefix: "/custom/api",
    defaultModelApiKey: () => "sk-test",
    validateDeepSeekToken: async () => ({ ok: true, status: 200 }),
    queryDeepSeekBalance: async () => ({
      ok: true,
      is_available: true,
      balance_infos: [
        { currency: "CNY", total_balance: "3.25" },
      ],
    }),
    onBalanceChange: () => calls.push(["balance-change"]),
    credentialsStatePort: {
      getCredentials: () => ({ modelApiKey: "sk-test" }),
      resetDeepSeekBalance: () => calls.push(["state-reset"]),
      setDeepSeekBalance: (balanceCny, checked) => calls.push(["state-set", balanceCny, checked]),
    },
    viewPort: {
      elements: () => ({
        apiKeyInput: createCredentialNode({ value: "sk-test" }),
        modelBaseUrlInput: createCredentialNode({ value: "" }),
        modelNameInput: createCredentialNode({ value: "deepseek-flash" }),
      }),
      setTopUpVisible: (visible) => calls.push(["top-up", visible]),
      setValidationMessage: (message, tone) => messages.push([message, tone]),
    },
  });

  assert.equal(result.ok, true);
  assert.ok(calls.some((call) => call[0] === "state-reset"));
  assert.ok(calls.some((call) => call[0] === "state-set" && call[1] === 3.25 && call[2] === true));
  assert.deepEqual(messages.at(-1), ["DeepSeek 可用，余额 CNY 3.25", "valid"]);
});

test("third-party translation validation skips DeepSeek-only balance lookup", async () => {
  const calls = [];
  const messages = [];
  const result = await handleBrowserDeepSeekValidate({
    apiPrefix: "/custom/api",
    defaultModelApiKey: () => "sk-test",
    validateDeepSeekToken: async () => ({ ok: true, status: 200 }),
    queryDeepSeekBalance: async () => {
      calls.push(["balance-query"]);
      throw new Error("third-party balance endpoint must not be called");
    },
    credentialsStatePort: {
      getCredentials: () => ({ modelApiKey: "sk-test" }),
      resetDeepSeekBalance: () => calls.push(["state-reset"]),
      setDeepSeekBalance: () => calls.push(["state-set"]),
    },
    viewPort: {
      elements: () => ({
        apiKeyInput: createCredentialNode({ value: "sk-test" }),
        modelBaseUrlInput: createCredentialNode({ value: "https://api.example.com/v1" }),
        modelNameInput: createCredentialNode({ value: "some-model" }),
      }),
      setTopUpVisible: (visible) => calls.push(["top-up", visible]),
      setValidationMessage: (message, tone) => messages.push([message, tone]),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "unsupported_provider");
  assert.equal(calls.some((call) => call[0] === "balance-query"), false);
  assert.equal(calls.some((call) => call[0] === "state-set"), false);
  assert.deepEqual(messages.at(-1), ["翻译接口可用", "valid"]);
});

test("Qwen translation validation uses connectivity only and reports provider name", async () => {
  const calls = [];
  const messages = [];
  const result = await handleBrowserDeepSeekValidate({
    apiPrefix: "/custom/api",
    defaultModelApiKey: () => "sk-test",
    validateDeepSeekToken: async () => ({ ok: true, status: 200 }),
    queryDeepSeekBalance: async () => {
      calls.push(["balance-query"]);
      throw new Error("Qwen must not call the DeepSeek balance endpoint");
    },
    credentialsStatePort: {
      getCredentials: () => ({ modelApiKey: "sk-test" }),
      resetDeepSeekBalance: () => calls.push(["state-reset"]),
      setDeepSeekBalance: () => calls.push(["state-set"]),
    },
    viewPort: {
      elements: () => ({
        apiKeyInput: createCredentialNode({ value: "sk-test" }),
        modelBaseUrlInput: createCredentialNode({
          value: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        }),
        modelNameInput: createCredentialNode({ value: "qwen3.8-flash" }),
      }),
      setTopUpVisible: (visible) => calls.push(["top-up", visible]),
      setValidationMessage: (message, tone) => messages.push([message, tone]),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "unsupported_provider");
  assert.equal(calls.some((call) => call[0] === "balance-query"), false);
  assert.equal(calls.some((call) => call[0] === "state-set"), false);
  assert.deepEqual(messages.at(-1), ["Qwen 可用", "valid"]);
});

test("validation without a model name says so instead of claiming a full green light", async () => {
  const messages = [];
  const payloads = [];
  const result = await handleBrowserDeepSeekValidate({
    apiPrefix: "/custom/api",
    defaultModelApiKey: () => "sk-test",
    validateDeepSeekToken: async (_prefix, payload) => {
      payloads.push(payload);
      return { ok: true, status: 200 };
    },
    queryDeepSeekBalance: async () => ({ ok: true, is_available: true, balance_infos: [] }),
    credentialsStatePort: {
      getCredentials: () => ({ modelApiKey: "sk-test" }),
      resetDeepSeekBalance: () => {},
      setDeepSeekBalance: () => {},
    },
    viewPort: {
      elements: () => ({
        apiKeyInput: createCredentialNode({ value: "sk-test" }),
        modelBaseUrlInput: createCredentialNode({ value: "https://api.example.com/v1" }),
        // 模型名留空：后端只能退回 /models 连通性探针
        modelNameInput: createCredentialNode({ value: "" }),
      }),
      setTopUpVisible: () => {},
      setValidationMessage: (message, tone) => messages.push([message, tone]),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(payloads.at(-1).model, "");
  // 覆盖面小于用户以为的"接口可用"时必须如实标注，否则又是一个假绿灯。
  assert.deepEqual(messages.at(-1), ["翻译接口可用（未验证模型）", "valid"]);
});

test("silent balance refresh must not overwrite the visible validation badge", async () => {
  const messages = [];
  const topUpCalls = [];
  const balanceWrites = [];
  await handleBrowserDeepSeekValidate({
    apiPrefix: "/custom/api",
    defaultModelApiKey: () => "sk-test",
    silent: true,
    validateDeepSeekToken: async () => ({ ok: true, status: 200 }),
    queryDeepSeekBalance: async () => ({
      ok: true,
      is_available: true,
      balance_infos: [{ currency: "CNY", total_balance: "0.5" }],
    }),
    credentialsStatePort: {
      getCredentials: () => ({ modelApiKey: "sk-test" }),
      resetDeepSeekBalance: () => {},
      setDeepSeekBalance: (amount, checked) => balanceWrites.push([amount, checked]),
    },
    viewPort: {
      elements: () => ({
        apiKeyInput: createCredentialNode({ value: "sk-test" }),
        modelBaseUrlInput: createCredentialNode({ value: "https://api.deepseek.com/v1" }),
        modelNameInput: createCredentialNode({ value: "deepseek-flash" }),
      }),
      setTopUpVisible: (visible) => topUpCalls.push(visible),
      setValidationMessage: (message, tone) => messages.push([message, tone]),
    },
  });

  // 余额是真值，silent 下仍要落库供上传门禁使用。
  assert.deepEqual(balanceWrites.at(-1), [0.5, true]);
  // 但面向用户的输出必须保持沉默：refreshDeepSeekBalance 默认 silent 且在后台
  // 跑，写这里就会把用户刚点「检测接口」看到的结果悄悄改掉。
  assert.equal(messages.length, 0);
  assert.deepEqual(topUpCalls, [false]);
});

test("low-balance top-up prompt ignores non-CNY balances instead of summing currencies", async () => {
  const balanceWrites = [];
  const topUpCalls = [];
  await handleBrowserDeepSeekValidate({
    apiPrefix: "/custom/api",
    defaultModelApiKey: () => "sk-test",
    validateDeepSeekToken: async () => ({ ok: true, status: 200 }),
    queryDeepSeekBalance: async () => ({
      ok: true,
      is_available: true,
      // 1 CNY + 1.5 USD：按币种直接相加会凑成 2.5 判成"余额充足"。
      balance_infos: [
        { currency: "CNY", total_balance: "1.00" },
        { currency: "USD", total_balance: "1.50" },
      ],
    }),
    credentialsStatePort: {
      getCredentials: () => ({ modelApiKey: "sk-test" }),
      resetDeepSeekBalance: () => {},
      setDeepSeekBalance: (amount) => balanceWrites.push(amount),
    },
    viewPort: {
      elements: () => ({
        apiKeyInput: createCredentialNode({ value: "sk-test" }),
        modelBaseUrlInput: createCredentialNode({ value: "https://api.deepseek.com/v1" }),
        modelNameInput: createCredentialNode({ value: "deepseek-flash" }),
      }),
      setTopUpVisible: (visible) => topUpCalls.push(visible),
      setValidationMessage: () => {},
    },
  });

  // 阈值是「2 元」，只能拿 CNY 档去比：1.00 < 2 应当提示充值。
  assert.equal(balanceWrites.at(-1), 1);
  assert.equal(topUpCalls.at(-1), true);
});

test("credentials DOM contract centralizes hidden inputs and browser dialog ids", () => {
  assert.equal(CREDENTIAL_DOM_IDS.hidden.ocrProvider, "ocr_provider");
  assert.equal(CREDENTIAL_DOM_IDS.hidden.modelApiKey, "api_key");
  assert.equal(CREDENTIAL_DOM_IDS.browser.ocrProviderSelect, "browser-ocr-provider-select");
  assert.equal(CREDENTIAL_DOM_IDS.browser.validations.deepseek, "browser-deepseek-validation");
  assert.equal(browserValidationIdForProvider("paddle"), CREDENTIAL_DOM_IDS.browser.validations.paddle);
  assert.equal(CREDENTIAL_DOM_DATASETS.credentialTab, "credentialTab");
  assert.equal(CREDENTIAL_DOM_SELECTORS.trigger, "#credentials-btn, #credential-gate-action");
});

function createClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    toggle(name, force) {
      if (force === undefined ? !values.has(name) : force) {
        values.add(name);
      } else {
        values.delete(name);
      }
    },
    contains: (name) => values.has(name),
  };
}

function createCredentialNode(overrides = {}) {
  return {
    classList: createClassList(),
    dataset: {},
    hidden: false,
    value: "",
    textContent: "",
    title: "",
    addEventListener() {},
    closest() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    ...overrides,
  };
}
