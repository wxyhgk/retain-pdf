import test from "node:test";
import assert from "node:assert/strict";

import {
  DEEPSEEK_BALANCE_CHECK_TIMEOUT_MS,
  ensureDeepSeekBudgetReady,
  ensureOcrCredentialsForSubmit,
  needsDeepSeekBudgetCheck,
  runSubmitFlow,
} from "../../src/features/ingest/domain/actions/submit-flow.js";
import { currentSubmitReadiness } from "../../src/features/ingest/domain/actions/submit-flow.js";

function createHarness(overrides = {}) {
  const calls = [];
  const errors = [];
  const deps = {
    workflow: "book",
    desktopMode: false,
    desktopConfigured: true,
    apiPrefix: "/api",
    uploadId: "upload-1",
    configPort: { isMock: () => false },
    state: { marker: "state" },
    setText: (id, text) => {
      calls.push(["setText", id]);
      errors.push({ id, text });
    },
    workflowNeedsUpload: () => true,
    workflowNeedsCredentials: () => true,
    hasBrowserCredentials: () => true,
    currentRenderSourceJobId: () => "",
    currentBudgetState: () => ({}),
    validateBeforeSubmit: () => true,
    ensureOcrCredentialsReady: () => true,
    collectRunPayload: () => ({ workflow: "book" }),
    submitJobRequest: async (_prefix, _payload) => ({ job_id: "job-new" }),
    libraryEventPort: {
      publishJobCreated: (job) => calls.push(["created", job?.job_id]),
    },
    ...overrides,
  };
  deps.calls = calls;
  deps.errors = errors;
  return deps;
}

test("facade keeps the original public surface", () => {
  assert.equal(DEEPSEEK_BALANCE_CHECK_TIMEOUT_MS, 12000);
  assert.equal(typeof runSubmitFlow, "function");
  assert.equal(typeof needsDeepSeekBudgetCheck, "function");
  assert.equal(typeof ensureDeepSeekBudgetReady, "function");
  assert.equal(typeof ensureOcrCredentialsForSubmit, "function");
  assert.equal(typeof currentSubmitReadiness, "function");
});

test("runSubmitFlow mock branch skips validation and publishes success", async () => {
  const h = createHarness({ configPort: { isMock: () => true } });
  const result = await runSubmitFlow(h);
  assert.equal(result.status, "submitted");
  assert.equal(result.mock, true);
  assert.equal(result.payload.job_id, "job-new");
  assert.deepEqual(h.calls[0], ["setText", "error-box"]);
  assert.deepEqual(h.calls[1], ["created", "job-new"]);
});

test("runSubmitFlow blocks on readiness without requesting submit", async () => {
  let requested = false;
  const h = createHarness({
    hasBrowserCredentials: () => false,
    submitJobRequest: async () => {
      requested = true;
      return {};
    },
  });
  const result = await runSubmitFlow(h);
  assert.equal(result.status, "blocked");
  assert.equal(requested, false);
  assert.equal(h.errors.at(-1).text, "请先在接口设置里填好 OCR 和翻译模型的 Key。");
});

test("runSubmitFlow returns invalid_page_ranges before any request", async () => {
  let requested = false;
  const h = createHarness({
    validateBeforeSubmit: () => false,
    submitJobRequest: async () => {
      requested = true;
      return {};
    },
  });
  const result = await runSubmitFlow(h);
  assert.equal(result.status, "invalid_page_ranges");
  assert.equal(requested, false);
});

// provider 预检（DeepSeek 余额 / OCR Token）不再挡在提交前面。
//
// 它们以前各是一次第三方网络往返（余额检测超时上限 12 秒），而 OCR 校验缓存是
// 纯内存的（无 TTL、不跨刷新），所以每次刷新后的第一次提交都要重跑全程——用户点
// 「直接翻译」后要干等，任务迟迟不落盘。现在改成点击时并行发起、不 await。
//
// 安全边界靠这一条：「压根没填凭据」由 readiness 拦着（纯本地判断，不走网络，
// 见上面 "runSubmitFlow blocks on readiness" 那条），这两道只覆盖「填了但无效 /
// 余额不够」——那类问题本来也要等流水线跑到那一步才暴露。
//
// 不写这两条就会重犯：把预检改回阻塞很容易（"顺手 await 一下更稳"），而症状是
// 用户感知的延迟，测试不会红。

test("余额检测失败不再拦截提交，任务照样落盘，原因经 notify 报出", async () => {
  // withTimeout 是浏览器实现（裸 window），测试环境需补上计时器宿主。
  const hadWindow = "window" in globalThis;
  globalThis.window = globalThis;
  try {
    const warnings = [];
    let requested = false;
    const h = createHarness({
      currentBudgetState: () => ({ visible: true, blocking: false, balanceChecked: true }),
      refreshDeepSeekBalance: async () => ({ status: "missing_key" }),
      notifyPreflightWarning: (message) => warnings.push(message),
      submitJobRequest: async () => {
        requested = true;
        return {};
      },
    });
    const result = await runSubmitFlow(h);
    assert.equal(result.status, "submitted", "余额检测失败不得阻止任务落盘");
    assert.equal(requested, true, "提交请求必须真的发出去");
    // 预检是后台并行的，结果可能晚于 runSubmitFlow 返回。
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(
      warnings.some((text) => /DeepSeek API Key/.test(String(text))),
      `失败原因必须经 notify 报给用户，实际：${JSON.stringify(warnings)}`,
    );
  } finally {
    if (!hadWindow) {
      delete globalThis.window;
    }
  }
});

test("OCR 凭证校验失败同样不拦截提交", async () => {
  let requested = false;
  const h = createHarness({
    ensureOcrCredentialsReady: () => false,
    submitJobRequest: async () => {
      requested = true;
      return {};
    },
  });
  const result = await runSubmitFlow(h);
  assert.equal(result.status, "submitted", "OCR 凭证校验失败不得阻止任务落盘");
  assert.equal(requested, true, "提交请求必须真的发出去");
});

test("runSubmitFlow submits real payload and publishes success", async () => {
  const h = createHarness();
  const result = await runSubmitFlow(h);
  assert.equal(result.status, "submitted");
  assert.equal(result.mock, false);
  assert.deepEqual(result.payload, { job_id: "job-new" });
  assert.deepEqual(h.calls.at(-1), ["created", "job-new"]);
});

test("runSubmitFlow maps missing upload errors without diagnostics", async () => {
  let handled = 0;
  const h = createHarness({
    submitJobRequest: async () => {
      throw new Error("upload not found");
    },
    isMissingUploadError: () => true,
    handleMissingUploadError: () => {
      handled += 1;
    },
  });
  const result = await runSubmitFlow(h);
  assert.equal(result.status, "missing_upload");
  assert.equal(handled, 1);
});

test("runSubmitFlow writes an error-box diagnostic for generic failures", async () => {
  const h = createHarness({
    submitJobRequest: async () => {
      throw new Error("boom");
    },
    isMissingUploadError: () => false,
  });
  const result = await runSubmitFlow(h);
  assert.equal(result.status, "error");
  const lastText = h.errors.at(-1).text;
  assert.match(String(lastText.summary), /提交 PDF 任务失败：boom/);
  assert.match(String(lastText.diagnostic), /\/jobs/);
});

test("ensureDeepSeekBudgetReady short-circuits when budget is not visible", async () => {
  const calls = [];
  const ok = await ensureDeepSeekBudgetReady({
    workflowNeedsUpload: () => true,
    currentBudgetState: () => ({ visible: false }),
    setText: (id, text) => calls.push([id, text]),
  });
  assert.equal(ok, true);
  assert.deepEqual(calls, []);
  assert.equal(needsDeepSeekBudgetCheck({
    workflowNeedsUpload: () => true,
    currentBudgetState: () => ({ visible: false }),
  }), false);
});
