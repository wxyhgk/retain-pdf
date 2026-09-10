import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// CredentialsDialog(Phase 3 dialogs 群,蓝图 §2)组件级测试。
// 校验:契约 id、openBrowserCredentials 事件打开(含 setupMode 首次配置态)、
// OCR/DeepSeek 校验三态、保存两分支(浏览器/桌面)、隐藏 input 与
// credentialsStatePort 双向同步、SettingsHubDialog 的 #credentials-btn 触发点、
// 词表/更新两个 tab 的占位 id 契约。

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
for (const key of ["window", "document", "DocumentFragment", "HTMLElement", "HTMLButtonElement", "HTMLFormElement", "HTMLInputElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.localStorage = dom.window.localStorage;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs(阶段 B 引入)在 jsdom 下需要 cancelAnimationFrame
// (TabsContent 的 mount 动画计时器清理)和 getComputedStyle(Presence 读取
// animation-name 判断退场动画是否结束)——jsdom 的 window 上有实现,只是没有
// 像 requestAnimationFrame 一样被复制到裸 global 上,这里一并补上。
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { createHomeComposition } = await import("../../src/app/home/create-home-composition.js");
const { HomeApp } = await import("../../src/app/home/HomeApp.jsx");
const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");
const { defaultCredentialsStatePort } = await import("../../src/features/credentials/domain/default-state-port.js");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
  assert.fail(`等待超时：${description}`);
}

function byId(id) {
  return dom.window.document.getElementById(id);
}

function click(element) {
  // Radix Tabs 的 Trigger 激活逻辑挂在 onMouseDown(不是 onClick)上——阶段 B
  // 迁移到 Radix Tabs 后(CredentialsDialog/SettingsHubDialog 的 tab),只
  // dispatch "click" 不会触发 tab 切换。真实浏览器点击本来就是
  // mousedown→mouseup→click 全套,这里补上 mousedown 让模拟点击更贴近真实
  // 交互,而不是放宽任何断言。
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function typeInput(element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function mockValidators(overrides = {}) {
  return {
    validateOcrToken: async (_apiPrefix, _providerId, token) => {
      if (!token) {
        return { ok: false, status: "unauthorized", summary: "缺少 token" };
      }
      if (token === "bad-token") {
        return { ok: false, status: "unauthorized", summary: "Token 无效" };
      }
      return { ok: true, status: "valid", summary: "Token 有效" };
    },
    validateDeepSeekToken: async (_apiPrefix, payload) => {
      if (!payload?.api_key) {
        return { ok: false, status: 0 };
      }
      if (payload.api_key === "bad-key") {
        return { ok: false, status: 401, summary: "DeepSeek Key 无效或已过期。" };
      }
      return { ok: true, status: 200, summary: "DeepSeek 接口连接成功。" };
    },
    queryDeepSeekBalance: async () => ({
      ok: true,
      is_available: true,
      balance_infos: [{ currency: "CNY", total_balance: "88.00" }],
    }),
    ...overrides,
  };
}

function createServices(overrides = {}) {
  const { validateOcrToken, validateDeepSeekToken, queryDeepSeekBalance, ...rest } = mockValidators(overrides.validators);
  let vaultRevision = 0;
  let credentials = [];
  return createHomeComposition({
    fetchGlossaries: async () => ({ items: [] }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    validateOcrToken,
    validateDeepSeekToken,
    queryDeepSeekBalance,
    listCredentials: async () => ({
      credentials,
      revision: vaultRevision,
    }),
    createCredential: async (_apiPrefix, payload) => {
      vaultRevision += 1;
      const credential = {
        credential_ref: payload.kind === "ocr_provider_token"
          ? "cred_test_ocr"
          : "cred_test_translation",
        kind: payload.kind,
        provider: payload.provider,
        label: payload.label,
        configured: true,
        revision: 1,
        created_at: "2026-09-02T00:00:00Z",
        updated_at: "2026-09-02T00:00:00Z",
      };
      credentials = [...credentials, credential];
      return { credential, revision: vaultRevision };
    },
    updateCredential: async (_apiPrefix, credentialRef, payload) => {
      vaultRevision += 1;
      const previous = credentials.find((item) => item.credential_ref === credentialRef) || {};
      const credential = {
        ...previous,
        credential_ref: credentialRef,
        kind: payload.kind || "translation_api_key",
        provider: payload.provider || "deepseek",
        label: payload.label || "翻译 API",
        configured: true,
        revision: Number(previous.revision || 0) + 1,
        updated_at: "2026-09-02T00:00:01Z",
      };
      credentials = credentials.filter((item) => item.credential_ref !== credentialRef);
      credentials.push(credential);
      return { credential, revision: vaultRevision };
    },
    ...rest,
    ...overrides,
  });
}

async function mountHome(services) {
  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);
  services.initialize();
  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp 首帧渲染");
  await wait(0);
  return { host, root };
}

test("CredentialsDialog：常规入口走设置 API；setupMode 仍开独立首次配置门", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

  // 阶段 C(shadcn 改造):CredentialsDialog 换成 Radix Dialog 后不 forceMount
  // Content——对话框关闭时整个内容(含下面这批契约 id)都不挂载。
  assert.equal(byId("browser-credentials-dialog"), null, "初始未打开时不挂载");

  // 常规：openBrowserCredentials → 设置中心 API 区（唯一日常入口）
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId("app-settings-dialog") !== null, "常规打开设置中心");
  await waitFor(() => byId("browser-api-key") !== null, "API 区内嵌工作台");
  assert.equal(byId("browser-credentials-dialog"), null, "常规不再弹独立接口设置窗");
  assert.ok(byId("browser-credentials-save-btn"), "内嵌工作台有保存");

  services.settingsHub.dialogStore.close();
  await waitFor(() => byId("app-settings-dialog") === null, "关闭设置");

  // ---- setupMode 首次配置态：独立弹窗，标题/保存文案切换 ----
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials, {
    detail: { setupMode: true },
  }));
  await waitFor(() => byId("browser-credentials-dialog") !== null, "setupMode 打开独立弹窗");
  await waitFor(() => byId("browser-credentials-title")?.textContent === "首次配置", "setupMode 标题切换");

  for (const id of [
    "browser-credentials-title", "browser-credentials-close-btn", "browser-credentials-status",
    "browser-credentials-save-btn", "browser-paddle-token", "browser-paddle-validate-btn",
    "browser-paddle-validation", "browser-api-key", "browser-deepseek-validate-btn",
    "browser-deepseek-validation", "browser-deepseek-top-up-link",
  ]) {
    assert.ok(byId(id), `契约 id 缺失：#${id}`);
  }

  assert.equal(byId("browser-credentials-save-btn").textContent, "保存并启动");
  assert.equal(byId("browser-credentials-tabs"), null, "首次配置也不显示多余的二级 Tab");
  assert.equal(
    dom.window.document.querySelector(".credential-agent-card"),
    null,
    "首次配置不展示另行保存的 Agent 表单",
  );
  assert.match(
    dom.window.document.querySelector(".credential-agent-setup-note").textContent,
    /稍后在设置中配置/,
  );
  assert.equal(byId("browser-credentials-dialog").dataset.setupMode, "1");

  root.unmount();
  services.dispose();
  host.remove();
});

test("凭据入口：设置 API 区内嵌工作台；#credential-gate-action 也打开设置 API", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

  // 设置 → API 区：CredentialsWorkbench 直接内嵌(v2 大改,门厅按钮
  // #credentials-btn 退役),不再弹 browser-credentials-dialog。
  click(byId("app-settings-btn"));
  await waitFor(() => byId("app-settings-dialog") !== null, "设置对话框打开");
  await waitFor(() => byId("browser-api-key") !== null, "API 区内嵌凭据工作台挂载");
  assert.ok(byId("browser-credentials-save-btn"), "内嵌工作台带保存按钮");
  assert.equal(byId("browser-credentials-tabs"), null, "API 页面不再嵌套二级 Tab");
  assert.equal(byId("browser-credentials-save-btn").textContent, "保存接口");
  assert.equal(byId("browser-job-math-mode"), null, "API 页面不再展示公式处理方式");
  const translationKeyInput = byId("browser-api-key");
  const showTranslationKey = dom.window.document.querySelector('[aria-label="显示翻译 API Key"]');
  assert.ok(showTranslationKey, "翻译 Key 默认提供显示按钮");
  assert.equal(
    translationKeyInput.nextElementSibling,
    showTranslationKey,
    "小眼睛按钮应紧跟输入框并显示在右侧",
  );
  assert.equal(translationKeyInput.type, "password");
  typeInput(translationKeyInput, "visibility-check");
  click(showTranslationKey);
  await waitFor(() => translationKeyInput.type === "text", "显示翻译 Key");
  assert.equal(translationKeyInput.value, "visibility-check", "切换可见性不能清空用户输入");
  const hideTranslationKey = dom.window.document.querySelector('[aria-label="隐藏翻译 API Key"]');
  assert.ok(hideTranslationKey, "显示后按钮切换为隐藏状态");
  assert.equal(hideTranslationKey.getAttribute("aria-pressed"), "true");
  click(hideTranslationKey);
  await waitFor(() => translationKeyInput.type === "password", "重新隐藏翻译 Key");
  const apiCards = [...dom.window.document.querySelectorAll(".credential-api-grid > .credential-card")];
  assert.deepEqual(
    apiCards.map((card) => [
      card.classList.contains("credential-ocr-card"),
      card.classList.contains("credential-translation-card"),
    ]),
    [[true, false], [false, true]],
    "接口页按 OCR、翻译的纵向顺序排列",
  );
  assert.ok(dom.window.document.querySelector(".credential-agent-section > .credential-agent-card"));
  assert.match(
    dom.window.document.querySelector(".credential-agent-beta")?.textContent || "",
    /Beta/i,
    "AI Agent 标题显示测试阶段徽标",
  );
  assert.equal(
    dom.window.document.querySelector(".credential-agent-save-button").classList.contains("secondary"),
    true,
    "Agent 保存使用次级按钮，避免与文档接口保存混淆",
  );
  assert.equal(
    dom.window.document.querySelector(".credential-save-note"),
    null,
    "接口页不重复说明保存范围",
  );
  const agentModeSelect = dom.window.document.querySelector('[aria-label="AI Agent 运行模式"]');
  assert.ok(
    dom.window.document.querySelector('[aria-label="显示模型 API Key"]'),
    "AI Agent 模型 Key 使用相同的双态显示控件",
  );
  assert.deepEqual(
    [...agentModeSelect.options].map((option) => [option.value, option.textContent]),
    [
      ["python", "Markdown 检索问答"],
      ["openai", "OpenAI 兼容 Agent"],
      ["fx", "FX Gateway Agent"],
    ],
  );
  agentModeSelect.value = "fx";
  agentModeSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await waitFor(
    () => dom.window.document.querySelector('[aria-label="FX Gateway URL"]'),
    "FX 模式显示自定义 Gateway URL",
  );
  assert.ok(
    dom.window.document.querySelector('[aria-label="显示 FX Gateway Key"]'),
    "FX Gateway Key 使用相同的双态显示控件",
  );
  assert.match(
    dom.window.document.querySelector(".credential-agent-fx-url-note").textContent,
    /仅支持本机 HTTP \+ 端口/,
  );
  assert.match(
    dom.window.document.querySelector(".credential-agent-fx-url-note").textContent,
    /远程地址请使用 OpenAI 模式/,
  );
  assert.equal(byId("credentials-btn"), null, "门厅按钮已退役");
  assert.equal(byId("browser-credentials-dialog"), null, "设置内不再弹二层凭据对话框");

  services.settingsHub.dialogStore.close();
  await waitFor(() => byId("app-settings-dialog") === null, "关闭设置对话框");

  // 阶段 C(shadcn 改造):credential-gate-action 挂在 TranslationWorkflowDialog
  // 内部(HeroUpload 的上传引导区),该对话框换成 Radix Dialog 后不 forceMount
  // Content——需要先打开一次才会挂载(同其余阶段 C 对话框的先例)。
  services.workflowDialog.openUpload();
  await waitFor(() => byId("credential-gate-action"), "工作流对话框打开后 credential-gate-action 挂载");
  click(byId("credential-gate-action"));
  await waitFor(() => byId("app-settings-dialog") !== null, "credential-gate-action 打开设置中心");
  await waitFor(() => byId("browser-api-key") !== null, "落到 API 设置工作台");
  assert.equal(byId("browser-credentials-dialog"), null, "常规门禁不弹独立接口窗");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog：OCR/DeepSeek 校验三态(缺失/错误/通过)", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

  // 校验走设置内嵌工作台（与日常入口一致）
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId("app-settings-dialog") !== null, "打开设置");
  await waitFor(() => byId("browser-paddle-validate-btn") !== null, "API 工作台就绪");

  // ---- OCR(paddle):缺失 → 错误 → 通过 ----
  click(byId("browser-paddle-validate-btn"));
  await waitFor(() => byId("browser-paddle-validation").title === "请先填写 Paddle Access Token。", "OCR 缺失态");
  assert.equal(byId("browser-paddle-validation").classList.contains("is-error"), true);

  typeInput(byId("browser-paddle-token"), "bad-token");
  click(byId("browser-paddle-validate-btn"));
  await waitFor(() => byId("browser-paddle-validation").title === "Token 无效", "OCR 错误态");
  assert.equal(byId("browser-paddle-validation").classList.contains("is-error"), true);

  typeInput(byId("browser-paddle-token"), "good-token");
  click(byId("browser-paddle-validate-btn"));
  await waitFor(() => byId("browser-paddle-validation").title === "Token 有效", "OCR 通过态");
  assert.equal(byId("browser-paddle-validation").classList.contains("is-valid"), true);

  // ---- DeepSeek:缺失 → 错误 → 通过(含充值提示,余额 < 2 元时才出现——
  //      mock 返回 88 元,不应显示充值链接) ----
  // 缺失态:deepseek-flow.js(kept)的 handleBrowserDeepSeekValidate 对"缺少
  // Key"分支直接 return,不写校验徽标(与 OCR 分支的语义不同,这是既有
  // 业务逻辑,不是本域重写的行为)——缺失态改由保存按钮的守卫触发验证。
  click(byId("browser-credentials-save-btn"));
  await waitFor(() => byId("browser-deepseek-validation").title === "请先填写翻译 API Key。", "翻译 API 缺失态(经保存守卫触发)");
  assert.equal(byId("browser-deepseek-validation").classList.contains("is-error"), true);
  assert.notEqual(byId("app-settings-dialog"), null, "缺字段时保存应被拦截,设置对话框不关闭");

  typeInput(byId("browser-api-key"), "bad-key");
  click(byId("browser-deepseek-validate-btn"));
  await waitFor(() => byId("browser-deepseek-validation").title === "DeepSeek Key 无效或已过期。", "DeepSeek 错误态");
  assert.equal(byId("browser-deepseek-validation").classList.contains("is-error"), true);
  assert.equal(byId("browser-deepseek-top-up-link").classList.contains("hidden"), true);

  typeInput(byId("browser-api-key"), "good-key");
  click(byId("browser-deepseek-validate-btn"));
  await waitFor(() => byId("browser-deepseek-validation").classList.contains("is-valid"), "DeepSeek 通过态");
  assert.match(byId("browser-deepseek-validation").title, /余额 CNY 88\.00/);
  assert.equal(byId("browser-deepseek-top-up-link").classList.contains("hidden"), true, "余额充足不提示充值");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog：保存(浏览器模式)——写隐藏 input、同步 credentialsStatePort", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

  // 阶段 C(shadcn 改造):paddle_token/api_key/ocr_provider 等隐藏 input
  // (HiddenCredentialInputs)挂在 TranslationWorkflowDialog 内部(job-form),
  // 该对话框换成 Radix Dialog 后不 forceMount Content——需要先打开一次才会
  // 挂载(同其余阶段 C 对话框的先例)。
  services.workflowDialog.openUpload();
  await waitFor(() => byId("paddle_token"), "工作流对话框打开后隐藏 input 挂载");

  // 常规保存入口：设置 → API
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId("app-settings-dialog") !== null, "打开设置");
  await waitFor(() => byId("browser-api-key") !== null, "API 工作台就绪");

  assert.equal(byId("browser-model-base-url").type, "url", "翻译 API 地址保持 URL 输入语义");
  assert.ok(byId("browser-translation-provider"), "翻译 API 使用服务商下拉选择");
  assert.match(byId("browser-translation-provider").textContent, /DeepSeek/);
  assert.equal(byId("browser-model-base-url").readOnly, true, "DeepSeek 预设地址不可直接修改");
  assert.equal(byId("browser-model-name").value, "deepseek-v4-flash");
  assert.equal(byId("browser-translation-workers").value, "50");
  assert.equal(byId("browser-translation-workers").max, "100");
  typeInput(byId("browser-api-key"), "deepseek-profile-key");

  services.credentials.view.handlersRef.current.changeTranslationProvider("qwen");
  await waitFor(
    () => byId("browser-model-base-url").value === "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "选择 Qwen 后写入官方地址",
  );
  assert.equal(byId("browser-model-base-url").readOnly, true, "Qwen 官方地址不可修改");
  assert.match(byId("browser-translation-provider").textContent, /Qwen/);
  assert.equal(byId("browser-model-name").value, "qwen3.8-flash", "Qwen 使用独立默认模型");
  assert.equal(byId("browser-api-key").value, "", "Qwen 不复用 DeepSeek Key");
  assert.equal(byId("browser-translation-workers").value, "20");
  assert.equal(byId("browser-translation-workers").max, "50");
  typeInput(byId("browser-api-key"), "qwen-profile-key");
  typeInput(byId("browser-translation-workers"), "51");
  click(byId("browser-credentials-save-btn"));
  await waitFor(
    () => byId("browser-deepseek-validation").title === "翻译并发数请输入 1–50 的整数",
    "Qwen 并发不得超过 50",
  );
  typeInput(byId("browser-translation-workers"), "20");
  assert.equal(
    dom.window.document.querySelector('.credential-card-link[href="https://platform.qianwenai.com/home/billing/overview"]')?.textContent.trim(),
    "Qwen 充值",
  );
  assert.match(
    byId("browser-translation-provider").querySelector("img")?.getAttribute("src") || "",
    /providers\/qwen\.svg$/,
    "Qwen 选项使用本地品牌图标",
  );

  services.credentials.view.handlersRef.current.changeTranslationProvider("anthropic");
  await waitFor(() => byId("browser-model-base-url").value === "https://api.anthropic.com/v1", "选择 Anthropic 后写入官方地址");
  assert.equal(byId("browser-model-name").value, "claude-sonnet-5");
  assert.equal(byId("browser-api-key").value, "", "Anthropic 不复用 Qwen Key");
  assert.equal(byId("browser-translation-workers").value, "50");
  assert.equal(byId("browser-translation-workers").max, "100");
  typeInput(byId("browser-api-key"), "anthropic-profile-key");

  services.credentials.view.handlersRef.current.changeTranslationProvider("openai");
  await waitFor(() => byId("browser-model-base-url").value === "https://api.openai.com/v1", "选择 OpenAI 后写入官方地址");
  assert.equal(byId("browser-model-name").value, "gpt-5.6-luna");
  assert.equal(byId("browser-api-key").value, "", "OpenAI 不复用 Anthropic Key");
  assert.equal(byId("browser-translation-workers").value, "50");
  assert.equal(byId("browser-translation-workers").max, "100");
  typeInput(byId("browser-api-key"), "openai-profile-key");

  services.credentials.view.handlersRef.current.changeTranslationProvider("zhipu");
  await waitFor(() => byId("browser-model-base-url").value === "https://open.bigmodel.cn/api/paas/v4", "选择智谱后写入官方地址");
  assert.equal(byId("browser-model-name").value, "GLM-5.3-Flash");
  assert.equal(byId("browser-api-key").value, "", "智谱不复用 OpenAI Key");
  assert.equal(byId("browser-translation-workers").value, "5");
  assert.equal(byId("browser-translation-workers").max, "50");
  assert.equal(
    dom.window.document.querySelector('.credential-card-link[href="https://bigmodel.cn/usercenter/proj-mgmt/apikeys"]')?.textContent.trim(),
    "智谱 API Key",
  );
  assert.equal(
    dom.window.document.querySelector('.credential-card-link[href="https://bigmodel.cn/finance-center/finance/pay"]')?.textContent.trim(),
    "智谱充值",
  );
  typeInput(byId("browser-api-key"), "zhipu-profile-key");

  services.credentials.view.handlersRef.current.changeTranslationProvider("custom");
  await waitFor(() => byId("browser-model-base-url").readOnly === false, "自定义 API 地址恢复可编辑");
  assert.equal(byId("browser-model-name").value, "", "自定义 API 不复用预设模型");
  assert.equal(byId("browser-api-key").value, "", "自定义 API 不复用 Qwen Key");
  assert.equal(byId("browser-translation-workers").value, "5");
  assert.equal(byId("browser-translation-workers").max, "100");
  assert.match(dom.window.document.querySelector(".credential-custom-api-warning")?.textContent || "", /不超过 5/);
  typeInput(byId("browser-model-base-url"), "https://translation.example/v1");
  services.credentials.view.handlersRef.current.changeTranslationProvider("deepseek");
  await waitFor(() => byId("browser-model-base-url").value === "https://api.deepseek.com/v1", "切回 DeepSeek 官方地址");
  assert.equal(byId("browser-api-key").value, "deepseek-profile-key", "切回 DeepSeek 恢复独立 Key");
  assert.match(
    byId("browser-translation-provider").querySelector("img")?.getAttribute("src") || "",
    /providers\/deepseek\.svg$/,
    "DeepSeek 选项使用本地品牌图标",
  );
  services.credentials.view.handlersRef.current.changeTranslationProvider("custom");
  await waitFor(
    () => byId("browser-model-base-url").value === "https://translation.example/v1",
    "切回自定义 API 时恢复先前输入",
  );
  assert.equal(byId("browser-model-name").type, "text", "第三方翻译模型必须公开可编辑");
  assert.equal(byId("browser-translation-workers").type, "number", "翻译并发数必须公开可编辑");
  assert.equal(byId("browser-translation-workers").min, "1");
  assert.equal(byId("browser-translation-workers").max, "100");
  typeInput(byId("browser-paddle-token"), "paddle-secret");
  typeInput(byId("browser-api-key"), "deepseek-secret");
  typeInput(byId("browser-model-base-url"), "https://translation.example/v1");
  typeInput(byId("browser-model-name"), "translation-model-v2");
  typeInput(byId("browser-translation-workers"), "24");
  assert.equal(byId("browser-model-base-url").value, "https://translation.example/v1");
  assert.equal(byId("browser-model-name").value, "translation-model-v2");
  assert.equal(services.credentials.view.elementsRef.modelBaseUrlInput.value, "https://translation.example/v1");
  assert.equal(services.credentials.view.elementsRef.modelNameInput.value, "translation-model-v2");
  assert.equal(services.credentials.view.elementsRef.translationWorkersInput.value, "24");

  click(byId("browser-credentials-save-btn"));
  await waitFor(
    () => defaultCredentialsStatePort.getCredentials().translationCredentialRef === "cred_test_translation",
    "保存后 credentialsStatePort 更新",
  );

  assert.equal(byId("paddle_token").value, "paddle-secret", "隐藏 input 桥接:paddle_token");
  assert.equal(byId("api_key"), null, "翻译 Key 不得进入隐藏 DOM");
  assert.equal(byId("ocr_provider").value, "paddle");

  const credentials = defaultCredentialsStatePort.getCredentials();
  assert.equal(credentials.ocrCredentialRef, "cred_test_ocr");
  assert.equal(credentials.paddleToken, "paddle-secret");
  assert.equal(credentials.modelApiKey, "deepseek-secret");
  assert.equal(credentials.translationCredentialRef, "cred_test_translation");
  assert.equal(byId("browser-api-key").type, "password", "保存后默认继续遮蔽 Key");
  assert.equal(byId("browser-api-key").value, "deepseek-secret", "保存后回填翻译 Key");
  const persistedValues = Array.from({ length: dom.window.localStorage.length }, (_, index) => (
    dom.window.localStorage.getItem(dom.window.localStorage.key(index)) || ""
  ));
  assert.equal(
    persistedValues.some((value) => value.includes("deepseek-secret") && value.includes("paddle-secret")),
    true,
    "普通网页把 OCR 与翻译密钥保存在当前浏览器",
  );
  await waitFor(
    () => services.features.workflowFeature.developerConfigWithDefaults().baseUrl === "https://translation.example/v1",
    "第三方翻译 API 配置保存完成",
  );
  const translationConfig = services.features.workflowFeature.developerConfigWithDefaults();
  assert.equal(translationConfig.baseUrl, "https://translation.example/v1");
  assert.equal(translationConfig.model, "translation-model-v2");
  assert.equal(translationConfig.workers, 24);
  assert.equal(translationConfig.translationProvider, "custom");
  assert.equal(translationConfig.translationProfiles.deepseek.apiKey, "deepseek-profile-key");
  assert.equal(translationConfig.translationProfiles.deepseek.workers, 50);
  assert.equal(translationConfig.translationProfiles.qwen.apiKey, "qwen-profile-key");
  assert.equal(translationConfig.translationProfiles.qwen.model, "qwen3.8-flash");
  assert.equal(translationConfig.translationProfiles.qwen.workers, 20);
  assert.equal(translationConfig.translationProfiles.anthropic.apiKey, "anthropic-profile-key");
  assert.equal(translationConfig.translationProfiles.anthropic.model, "claude-sonnet-5");
  assert.equal(translationConfig.translationProfiles.openai.apiKey, "openai-profile-key");
  assert.equal(translationConfig.translationProfiles.openai.model, "gpt-5.6-luna");
  assert.equal(translationConfig.translationProfiles.zhipu.apiKey, "zhipu-profile-key");
  assert.equal(translationConfig.translationProfiles.zhipu.model, "GLM-5.3-Flash");
  assert.equal(translationConfig.translationProfiles.zhipu.workers, 5);
  assert.equal(translationConfig.translationProfiles.custom.apiKey, "deepseek-secret");
  assert.equal(translationConfig.translationProfiles.custom.workers, 24);
  assert.equal(
    services.features.workflowFeature.buildTranslateJobConfig("").translation.workers,
    24,
    "文档翻译与 OCR 复用翻译都使用已保存的并发数",
  );

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog：保存(桌面模式)——走 saveDesktopConfig 分支", async () => {
  const desktopCalls = [];
  const services = createServices({
    initialDesktopMode: true,
    saveDesktopConfig: async (browserConfig, afterSave) => {
      desktopCalls.push({ browserConfig });
      await afterSave?.();
      return { firstRunCompleted: true };
    },
  });
  const { host, root } = await mountHome(services);

  // 阶段 C(shadcn 改造):saveDesktopConfig 分支同样会读 HiddenCredentialInputs
  // 挂在 TranslationWorkflowDialog 内部的隐藏 input(paddle_token 等),需要先
  // 打开一次工作流对话框才会挂载。
  services.workflowDialog.openUpload();
  await waitFor(() => byId("paddle_token"), "工作流对话框打开后隐藏 input 挂载");

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials, {
    detail: { setupMode: true },
  }));
  await waitFor(() => byId("browser-credentials-dialog") !== null, "打开对话框(setupMode)");

  typeInput(byId("browser-paddle-token"), "paddle-desktop");
  typeInput(byId("browser-api-key"), "deepseek-desktop");

  click(byId("browser-credentials-save-btn"));
  await wait(20);
  assert.equal(
    byId("browser-credentials-status")?.textContent || "",
    "",
    "桌面模式默认翻译 API 配置不应阻塞首次保存",
  );
  await waitFor(() => desktopCalls.length === 1, "saveDesktopConfig 被调用");
  assert.equal(desktopCalls[0].browserConfig.modelApiKey, "deepseek-desktop");
  assert.equal(desktopCalls[0].browserConfig.translationCredentialRef, "cred_test_translation");
  assert.equal(desktopCalls[0].browserConfig.ocrCredentialRef, "cred_test_ocr");
  assert.equal(desktopCalls[0].browserConfig.paddleToken, "paddle-desktop");
  assert.equal(desktopCalls[0].browserConfig.markConfigured, true, "setupMode 下应标记首次配置完成");
  await waitFor(() => byId("browser-credentials-dialog") === null, "保存成功后对话框关闭");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog：既有翻译凭据按记录 revision 更新并串行化重复保存", async () => {
  const updatePayloads = [];
  let releaseUpdate;
  const updateGate = new Promise((resolve) => {
    releaseUpdate = resolve;
  });
  const existingCredential = {
    credential_ref: "cred_existing_translation",
    kind: "translation_api_key",
    provider: "deepseek",
    label: "翻译 API",
    configured: true,
    revision: 7,
    created_at: "2026-09-02T00:00:00Z",
    updated_at: "2026-09-02T00:00:00Z",
  };
  const existingOcrCredential = {
    credential_ref: "cred_existing_ocr",
    kind: "ocr_provider_token",
    provider: "paddle",
    label: "Paddle OCR",
    configured: true,
    revision: 3,
    created_at: "2026-09-02T00:00:00Z",
    updated_at: "2026-09-02T00:00:00Z",
  };
  const services = createServices({
    listCredentials: async () => ({
      credentials: [existingCredential, existingOcrCredential],
      // Simulate an unrelated OCR import after this credential was created.
      revision: 12,
    }),
    createCredential: async () => { throw new Error("existing credential must be updated"); },
    updateCredential: async (_apiPrefix, credentialRef, payload) => {
      if (payload.kind === "ocr_provider_token") {
        return {
          credential: { ...existingOcrCredential, revision: 4 },
          revision: 13,
        };
      }
      updatePayloads.push({ credentialRef, payload });
      await updateGate;
      return {
        credential: { ...existingCredential, revision: 8 },
        revision: 14,
      };
    },
  });
  const { host, root } = await mountHome(services);

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId("browser-api-key") !== null, "API 工作台就绪");
  await waitFor(
    () => defaultCredentialsStatePort.getCredentials().translationCredentialRef === existingCredential.credential_ref,
    "既有翻译凭据元数据加载完成",
  );
  typeInput(byId("browser-paddle-token"), "paddle-existing");
  typeInput(byId("browser-api-key"), "translation-updated");

  click(byId("browser-credentials-save-btn"));
  click(byId("browser-credentials-save-btn"));
  await waitFor(() => updatePayloads.length === 1, "重复点击只发起一次更新");
  assert.equal(updatePayloads[0].credentialRef, existingCredential.credential_ref);
  assert.equal(updatePayloads[0].payload.expected_revision, 13);
  assert.equal(updatePayloads[0].payload.expected_credential_revision, 7);
  releaseUpdate();
  await waitFor(() => byId("browser-credentials-status")?.textContent === "已保存", "更新完成");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog：重启后从浏览器存储恢复可查看值并关联 vault 引用", async () => {
  const vaultCredentials = [
    {
      credential_ref: "cred_saved_ocr",
      kind: "ocr_provider_token",
      provider: "paddle",
      label: "Paddle OCR",
      configured: true,
      revision: 2,
      created_at: "2026-09-02T00:00:00Z",
      updated_at: "2026-09-02T00:00:02Z",
    },
    {
      credential_ref: "cred_saved_translation",
      kind: "translation_api_key",
      provider: "deepseek",
      label: "翻译 API",
      configured: true,
      revision: 4,
      created_at: "2026-09-02T00:00:00Z",
      updated_at: "2026-09-02T00:00:04Z",
    },
  ];
  const services = createServices({
    loadPersistedBrowserConfig: () => ({
      ocrProvider: "paddle",
      paddleToken: "saved-ocr-value",
      modelApiKey: "saved-translation-value",
    }),
    listCredentials: async () => ({ credentials: vaultCredentials, revision: 8 }),
    createCredential: async () => { throw new Error("saved credentials must be reused"); },
    updateCredential: async () => { throw new Error("blank inputs must not rotate saved credentials"); },
  });
  const { host, root } = await mountHome(services);

  await services.features.browserCredentialsFeature.ready();
  const restored = defaultCredentialsStatePort.getCredentials();
  assert.equal(restored.ocrCredentialRef, "cred_saved_ocr");
  assert.equal(restored.translationCredentialRef, "cred_saved_translation");
  assert.equal(restored.paddleToken, "saved-ocr-value");
  assert.equal(restored.modelApiKey, "saved-translation-value");

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId("browser-api-key") !== null, "API 工作台就绪");
  assert.equal(byId("browser-paddle-token").value, "saved-ocr-value");
  assert.equal(byId("browser-api-key").value, "saved-translation-value");
  assert.match(byId("browser-paddle-validation").title, /已安全保存/);
  assert.match(byId("browser-deepseek-validation").title, /已安全保存/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog：隐藏 input 与 credentialsStatePort 单向受控同步(蓝图风险 1)", async () => {
  // 实现调整说明(见 HiddenCredentialInputs.jsx 头注释):隐藏 input 改走
  // 受控渲染(value 直接订阅 credentialsStatePort.store),不是蓝图原计划的
  // "非受控 ref + mirrorCredentialsToHiddenInputs 双向同步"——实测证实那套
  // 组合在任何兄弟组件重渲染时都会被 React 的表单元素受控态回收逻辑悄悄清空
  // (上传进行中 HeroUpload 高频重渲染,会把刚保存的 token 冲掉),受控是唯一
  // 不会被 React 自己吃掉的写法。store 是唯一真值,DOM 是纯投影,因此这里只
  // 断言"store → 隐藏 input"单向同步,并确认"外部直接改 DOM"不会被采纳
  // (证明真值确实是 store,不是可以被绕过的 DOM)。
  const services = createServices();
  const { host, root } = await mountHome(services);

  // 阶段 C(shadcn 改造):隐藏 input 挂在 TranslationWorkflowDialog 内部
  // (job-form),该对话框换成 Radix Dialog 后不 forceMount Content——需要先
  // 打开一次才会挂载(同其余阶段 C 对话框的先例)。
  services.workflowDialog.openUpload();
  await waitFor(() => byId("paddle_token"), "工作流对话框打开后隐藏 input 挂载");

  // composition 初始化时 credentialsStatePort 已经写入过持久化配置;
  // HiddenCredentialInputs 应把当前 store 状态实时投影进隐藏 input。
  defaultCredentialsStatePort.setCredentials({
    ocrProvider: "paddle",
    paddleToken: "from-store",
    translationCredentialRef: "cred_from_store",
  });
  await waitFor(() => byId("paddle_token").value === "from-store", "store → 隐藏 input 投影");
  assert.equal(byId("api_key"), null, "翻译 Key 不得渲染进隐藏 DOM");

  // 外部直接改 DOM(模拟浏览器自动填充等非受控写入路径)不经过 store,
  // 不会被采纳为"真值"——下一次任意 credentials 变更触发的重渲染都会把
  // DOM 拉回 store 的值,证明 store 才是唯一真值,不存在"DOM 悄悄漂移、
  // 表单提交读到脏值"的风险(这正是蓝图风险 1 要防的静默失败)。
  typeInput(byId("paddle_token"), "from-dom");
  assert.equal(byId("paddle_token").value, "from-dom", "原生 setter 写入本身会生效(没有 onChange 拦截)");
  // 触发一次(哪怕内容不变的)credentials 更新,验证下一次渲染把 DOM 拉回 store
  defaultCredentialsStatePort.patchCredentials({});
  await waitFor(() => byId("paddle_token").value === "from-store", "重渲染后 DOM 被拉回 store 真值,外部写入未被采纳");
  assert.equal(defaultCredentialsStatePort.getCredentials().paddleToken, "from-store", "store 未被 DOM 写入污染");

  root.unmount();
  services.dispose();
  host.remove();
});

test("SettingsHubDialog：词表/外观/更新 tab 契约", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

  click(byId("app-settings-btn"));
  await waitFor(() => byId("app-settings-dialog") !== null, "设置对话框打开");

  const glossaryTab = dom.window.document.querySelector('[data-settings-tab="glossary"]');
  click(glossaryTab);
  await waitFor(() => byId("glossary-btn"), "词表 tab 占位按钮存在");
  assert.equal(dom.window.document.querySelector('[data-settings-panel="glossary"]').hidden, false);

  const appearanceTab = dom.window.document.querySelector('[data-settings-tab="appearance"]');
  assert.ok(appearanceTab, "外观 tab 存在");
  click(appearanceTab);
  await waitFor(() => byId("theme-appearance-panel"), "外观面板挂载");
  assert.equal(dom.window.document.querySelector('[data-settings-panel="appearance"]').hidden, false);
  assert.ok(byId("theme-option-classic"), "经典皮肤选项");
  assert.ok(byId("theme-option-jiangnan"), "江南院落选项");
  assert.ok(byId("theme-option-seacliff"), "海岬选项");
  assert.ok(byId("theme-option-night"), "黛瓦夜色选项");

  // 切换皮肤应写入 data-theme
  click(byId("theme-option-jiangnan"));
  await waitFor(
    () => dom.window.document.documentElement.dataset.theme === "jiangnan",
    "选中江南院落后 html[data-theme=jiangnan]",
  );
  click(byId("theme-option-night"));
  await waitFor(
    () =>
      dom.window.document.documentElement.dataset.theme === "night"
      && dom.window.document.documentElement.classList.contains("theme-dark"),
    "黛瓦夜色 + theme-dark class",
  );
  click(byId("theme-option-classic"));
  await waitFor(
    () =>
      dom.window.document.documentElement.dataset.theme === "classic"
      && !dom.window.document.documentElement.classList.contains("theme-dark"),
    "切回经典并去掉 theme-dark",
  );

  const updateTab = dom.window.document.querySelector('[data-settings-tab="update"]');
  click(updateTab);
  await waitFor(() => byId("app-update-btn"), "更新 tab 占位按钮存在");
  assert.equal(dom.window.document.querySelector('[data-settings-panel="update"]').hidden, false);

  root.unmount();
  services.dispose();
  host.remove();
});
