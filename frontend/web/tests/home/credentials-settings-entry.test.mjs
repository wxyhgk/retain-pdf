// 设置中心 API 区：Agent Key / MinerU Token 的回填与保存、保存按钮的可见反馈、
// 常规与首次配置共用一个弹窗、各个凭据入口都打开它。
// 从原 credentials-dialog-component.test.mjs（1000+ 行）拆出，用例原样搬移；
// 两边共用的夹具在 helpers/credentials-dialog-fixture.mjs。

import test from "node:test";
import assert from "node:assert/strict";
import { wait } from "../helpers/async.mjs";
import { byId, clickWithMouseDown, makeDom, typeInput } from "../helpers/dom.mjs";
import { bootHomeApp } from "../helpers/home-app.mjs";
import { createCredentialServices, credentialsDialogWaits } from "./helpers/credentials-dialog-fixture.mjs";

const dom = makeDom();
globalThis.localStorage = dom.window.localStorage;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { createHomeComposition } = await import("../../src/app/home/create-home-composition.js");
const { AgentRuntimeSettingsCard } = await import("../../src/features/credentials/ui/AgentRuntimeSettingsCard.jsx");
const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");
const { defaultCredentialsStatePort } = await import("../../src/features/credentials/domain/default-state-port.js");

const createServices = (overrides) => createCredentialServices(createHomeComposition, overrides);
const { waitFor, waitForDialogReady } = credentialsDialogWaits(dom);

test("Agent Key：读取 Python 接口后明文回填，保存和重新挂载后保留", async () => {
  const previousFetch = globalThis.fetch;
  let saved = {
    schema: "retainpdf_ai_runtime_config_view_v1",
    active_runtime: "python-retrieval-v1", configured_runtime: "python",
    configured_revision: 1, active_revision: 1, restart_state: "active",
    agent_confirmation_mode: "explicit", restart_required: false,
    llm_base_url: "https://model.example/v1", llm_model: "fixture-model",
    llm_api_key: "saved-agent-key", llm_api_key_configured: true,
    fx_gateway_api_key: "saved-fx-key", fx_gateway_api_key_configured: true,
  };
  globalThis.fetch = async (url, options) => {
    assert.match(`${url}`, /\/ai\/runtime-config$/);
    if (options.method === "PUT") saved = { ...saved, ...JSON.parse(options.body) };
    return new Response(JSON.stringify({ data: saved }), { status: 200 });
  };
  const host = document.createElement("div");
  document.body.appendChild(host);
  let root = createRoot(host);
  const input = (label) => host.querySelector(`input[aria-label="${label}"]`);
  try {
    root.render(React.createElement(AgentRuntimeSettingsCard));
    await waitFor(() => input("模型 API Key")?.value === "saved-agent-key", "Agent Key 回填");
    assert.equal(input("模型 API Key").type, "text");
    typeInput(dom, input("模型 API Key"), "edited-agent-key");
    clickWithMouseDown(dom, host.querySelector(".credential-agent-save-button"));
    await waitFor(() => host.textContent.includes("已保存在本机"), "Agent 保存完成");
    assert.equal(saved.llm_api_key, "edited-agent-key");
    assert.equal(input("模型 API Key").value, "edited-agent-key");
    root.unmount();
    root = createRoot(host);
    root.render(React.createElement(AgentRuntimeSettingsCard));
    await waitFor(() => input("模型 API Key")?.value === "edited-agent-key", "重新打开后恢复 Agent Key");
    const mode = host.querySelector('select[aria-label="AI Agent 运行模式"]');
    mode.value = "fx";
    mode.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await waitFor(() => input("FX Gateway Key")?.value === "saved-fx-key", "FX Key 回填");
    assert.equal(input("FX Gateway Key").type, "text");
  } finally {
    root.unmount();
    host.remove();
    globalThis.fetch = previousFetch;
  }
});

test("MinerU：Token 本机保存、明文回填，切回 Paddle 保留各自 Token", async () => {
  const services = createServices();
  const { host, root } = await bootHomeApp(dom, { services });
  try {
    dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
    await waitFor(() => byId(dom, "browser-ocr-provider-select"), "OCR 提供商选择器");
    const select = byId(dom, "browser-ocr-provider-select");
    assert.deepEqual([...select.options].map((option) => option.value), ["paddle", "mineru", "glm_ocr"]);
    await waitForDialogReady();
    typeInput(dom, byId(dom, "browser-paddle-token"), "paddle-ui-fixture");
    typeInput(dom, byId(dom, "browser-api-key"), "translation-ui-fixture");
    clickWithMouseDown(dom, byId(dom, "browser-credentials-save-btn"));
    await waitFor(() => byId(dom, "browser-credentials-status").textContent.includes("已保存"), "保存 Paddle");
    const paddleRef = defaultCredentialsStatePort.getCredentials().ocrCredentialRef;

    select.value = "mineru";
    select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await waitFor(() => !byId(dom, "browser-mineru-token").closest("section").hidden, "显示 MinerU 面板");
    assert.equal(byId(dom, "browser-paddle-token").closest("section").hidden, true);
    assert.equal(byId(dom, "browser-mineru-token").type, "text");
    assert.ok(byId(dom, "browser-mineru-validate-btn"), "显示 MinerU 独立检测按钮");
    assert.doesNotMatch(byId(dom, "browser-mineru-token").closest("section").textContent, /暂不支持单独检测|提交 OCR 任务时校验/);
    assert.equal(byId(dom, "browser-mineru-token").placeholder, "MinerU API Token");
    assert.equal(defaultCredentialsStatePort.getCredentials().ocrCredentialRef, "");
    typeInput(dom, byId(dom, "browser-mineru-token"), "mineru-ui-fixture");
    clickWithMouseDown(dom, byId(dom, "browser-credentials-save-btn"));
    await waitFor(() => defaultCredentialsStatePort.getCredentials().mineruToken === "mineru-ui-fixture", "保存独立 MinerU Token");
    await waitFor(() => byId(dom, "browser-credentials-status").textContent.startsWith("已保存"), "等待 MinerU 本机保存完成");
    assert.equal(byId(dom, "browser-mineru-token").value, "mineru-ui-fixture");
    assert.equal(defaultCredentialsStatePort.getCredentials().ocrCredentialRef, "");
    assert.equal(defaultCredentialsStatePort.getCredentials().paddleToken, "paddle-ui-fixture");
    assert.equal(JSON.stringify(dom.window.localStorage).includes("mineru-ui-fixture"), true);
    assert.equal(dom.window.document.querySelector('input[type="hidden"][value="mineru-ui-fixture"]'), null);

    select.value = "paddle";
    select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await waitFor(() => defaultCredentialsStatePort.getCredentials().ocrProvider === "paddle", "切回 Paddle");
    assert.equal(defaultCredentialsStatePort.getCredentials().ocrCredentialRef, paddleRef);
    assert.equal(byId(dom, "browser-paddle-token").value, "paddle-ui-fixture");
  } finally {
    root.unmount();
    services.dispose();
    host.remove();
  }
});

test("MinerU：独立检测接入真实 API transport，显示缺失、过期、网络失败和成功状态", async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  let outcome = "expired";
  let finish;
  globalThis.fetch = async (url, options = {}) => {
    if (!`${url}`.endsWith("/providers/mineru/validate-token")) {
      throw new Error(`unexpected test request: ${url}`);
    }
    calls.push({ url: `${url}`, method: options.method, payload: JSON.parse(options.body) });
    if (outcome === "network_error") throw new TypeError("offline fixture");
    if (outcome === "valid") await new Promise((resolve) => { finish = resolve; });
    return new Response(JSON.stringify({ code: 0, data: {
      ok: outcome === "valid", status: outcome,
      summary: outcome === "valid" ? "MinerU Token 可用" : "MinerU Token 已过期",
    } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  // 上一条用例存过 MinerU Token：不清掉的话，切到 MinerU 后它会异步回填，压在下面
  // 「清空再检测」的后面，输入框就不是空的，「请填写」永远等不到（负载下偶发）。
  dom.window.localStorage.clear();
  const services = createServices({ validateOcrToken: undefined });
  const { host, root } = await bootHomeApp(dom, { services });
  try {
    document.dispatchEvent(new CustomEvent(APP_EVENTS.openBrowserCredentials));
    await waitFor(() => byId(dom, "browser-ocr-provider-select"), "OCR 提供商选择器");
    await waitForDialogReady();
    const select = byId(dom, "browser-ocr-provider-select");
    select.value = "mineru";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => !byId(dom, "browser-mineru-token").closest("section").hidden, "MinerU 面板");
    const input = byId(dom, "browser-mineru-token");
    const button = byId(dom, "browser-mineru-validate-btn");
    const status = byId(dom, "browser-mineru-validation");
    const statusMessage = () => status.getAttribute("aria-label") || "";
    typeInput(dom, input, "");
    clickWithMouseDown(dom, button);
    await waitFor(() => /请(?:先)?填写/.test(statusMessage()), "提示填写 Token");
    assert.equal(calls.length, 0);
    typeInput(dom, input, " mineru-transport-fixture ");
    clickWithMouseDown(dom, button);
    await waitFor(() => statusMessage().includes("已过期"), "过期检测结果");
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].payload, { mineru_token: "mineru-transport-fixture" });
    assert.match(calls[0].url, /\/api\/v1\/providers\/mineru\/validate-token$/);
    assert.ok(status.classList.contains("is-error"));
    assert.equal(button.disabled, false);
    outcome = "network_error";
    clickWithMouseDown(dom, button);
    await waitFor(() => statusMessage().includes("检测失败"), "网络错误提示");
    assert.equal(button.disabled, false);
    outcome = "valid";
    clickWithMouseDown(dom, button);
    await waitFor(() => finish && button.disabled, "检测中禁用按钮");
    assert.match(statusMessage(), /正在检测 MinerU Token/);
    finish();
    await waitFor(() => statusMessage().includes("Token 可用"), "Token 检测成功");
    assert.ok(status.classList.contains("is-valid"));
    assert.equal(button.disabled, false);
    assert.equal(input.type, "text");
    assert.equal(input.value.trim(), "mineru-transport-fixture");
    assert.equal(calls.length, 3, "只调用检测接口，不提交 OCR 任务");
  } finally {
    finish?.();
    root.unmount();
    services.dispose();
    host.remove();
    globalThis.fetch = previousFetch;
  }
});

test("保存按钮每次点击都有可见反馈，不会让人以为没生效", async () => {
  const services = createServices();
  const { host, root } = await bootHomeApp(dom, { services });
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId(dom, "browser-api-key") !== null, "API 区");
  // 先等表单异步回填完：回填晚于输入时会把刚敲进去的值冲掉，保存走错分支，
  // 状态条一直是空的，等满 15 秒（CI 37636560695）。
  await waitForDialogReady();

  const statusEl = () => byId(dom, "browser-credentials-status");
  const saveBtn = () => byId(dom, "browser-credentials-save-btn");

  // MutationObserver 捕获所有中间帧——这个缺陷的本质就是"中间帧存在但
  // 起点与终点相同"，只看最终态是测不出来的。
  const frames = [];
  const record = () => {
    const entry = `${statusEl()?.textContent ?? ""}|${saveBtn()?.disabled}|${saveBtn()?.textContent ?? ""}`;
    if (frames[frames.length - 1] !== entry) frames.push(entry);
  };
  const observer = new dom.window.MutationObserver(record);
  observer.observe(dom.window.document.body, { subtree: true, childList: true, characterData: true, attributes: true });

  typeInput(dom, byId(dom, "browser-paddle-token"), "paddle-fixture");
  typeInput(dom, byId(dom, "browser-api-key"), "sk-key");
  typeInput(dom, byId(dom, "browser-model-name"), "m1");

  clickWithMouseDown(dom, saveBtn());
  await waitFor(() => statusEl().textContent.startsWith("已保存"), "首次保存完成");
  await waitFor(() => saveBtn().textContent === "已保存", "按钮进入成功态");

  // 关键场景：什么都不改，直接再点一次。旧实现下状态是
  // "已保存"→"已保存"，按钮全程可点且文案不变，屏幕毫无变化。
  frames.length = 0;
  record();
  clickWithMouseDown(dom, saveBtn());
  await waitFor(() => frames.some((f) => f.includes("|true|")), "保存中按钮应被禁用");
  await waitFor(() => saveBtn().textContent === "已保存", "重新播放成功反馈");
  await wait(30);
  observer.disconnect();

  assert.ok(
    frames.some((f) => f.startsWith("正在保存…|true|正在保存…")),
    `重复保存应出现"正在保存…"且按钮禁用，实际帧：${JSON.stringify(frames)}`,
  );
  assert.ok(
    frames.length >= 3,
    `重复保存必须产生可见的状态变化，实际帧：${JSON.stringify(frames)}`,
  );
  assert.match(statusEl().textContent, /^已保存 \d{2}:\d{2}:\d{2}$/, "状态行带时刻");

  root.unmount();
  services.dispose();
  host.remove();
});

// 「打开接口设置」只有一个落点：设置弹窗停在 api tab。
//
// 此前首次配置门另有一个独立外壳（CredentialsDialog），于是同一件事有两个长得
// 不一样的窗——用户从设置里看到的和首次启动时看到的不是同一个东西。现在两条路
// 都是本弹窗，区别只在 payload.setupMode：多一句引导、保存按钮变成「保存并启动」、
// 收起 AI Agent 卡片（首配不该被非必填项挡住），保存时写 firstRunCompleted。
//
// 两种形态都钉住，因为它们各自都能悄悄退化：常规入口混进 setupMode 会让用户在
// 设置里看到莫名其妙的「保存并启动」；setupMode 丢掉则首配存完不标记完成，
// 下次启动又被拦一遍。
test("接口设置只有一个弹窗：常规与首次配置共用设置中心 API 区", async () => {
  const services = createServices();
  const { host, root } = await bootHomeApp(dom, { services });

  assert.equal(byId(dom, "app-settings-dialog"), null, "初始未打开时不挂载");
  assert.equal(byId(dom, "browser-credentials-dialog"), null, "独立首配弹窗已退役，任何时候都不该出现");

  // ---- 常规入口 ----
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId(dom, "app-settings-dialog") !== null, "常规打开设置中心");
  await waitFor(() => byId(dom, "browser-api-key") !== null, "API 区内嵌工作台");
  assert.equal(byId(dom, "browser-credentials-dialog"), null, "常规不再弹独立接口设置窗");
  assert.equal(byId(dom, "browser-credentials-save-btn").textContent, "保存接口");
  assert.equal(byId(dom, "browser-credentials-subtitle"), null, "常规入口不该出现首配引导语");
  assert.ok(
    dom.window.document.querySelector(".credential-agent-section > .credential-agent-card"),
    "常规入口展示 AI Agent 表单",
  );

  services.settingsHub.dialogStore.close();
  await waitFor(() => byId(dom, "app-settings-dialog") === null, "关闭设置");

  // ---- 首次配置门：同一个弹窗，换成引导形态 ----
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials, {
    detail: { setupMode: true },
  }));
  await waitFor(() => byId(dom, "app-settings-dialog") !== null, "setupMode 开的仍是设置中心");
  assert.equal(byId(dom, "browser-credentials-dialog"), null, "setupMode 不再另开一个壳");
  await waitFor(
    () => byId(dom, "browser-credentials-subtitle")?.textContent === "先配好接口再开始",
    "setupMode 引导语",
  );
  await waitFor(
    () => byId(dom, "browser-credentials-save-btn")?.textContent === "保存并启动",
    "setupMode 保存按钮",
  );

  for (const id of [
    "browser-credentials-status", "browser-credentials-save-btn",
    "browser-paddle-token", "browser-paddle-validate-btn", "browser-paddle-validation",
    "browser-api-key", "browser-deepseek-validate-btn", "browser-deepseek-validation",
    "browser-deepseek-top-up-link",
  ]) {
    assert.ok(byId(dom, id), `契约 id 缺失：#${id}`);
  }

  assert.equal(byId(dom, "browser-credentials-tabs"), null, "首次配置也不显示多余的二级 Tab");
  assert.equal(
    dom.window.document.querySelector(".credential-agent-card"),
    null,
    "首次配置不展示另行保存的 Agent 表单",
  );
  assert.match(
    dom.window.document.querySelector(".credential-agent-setup-note").textContent,
    /稍后在设置中配置/,
  );

  root.unmount();
  services.dispose();
  host.remove();
});

test("凭据入口：设置 API 区内嵌工作台；#credential-gate-action 也打开设置 API", async () => {
  const services = createServices();
  const { host, root } = await bootHomeApp(dom, { services });

  // 设置 → API 区：CredentialsWorkbench 直接内嵌(v2 大改,门厅按钮
  // #credentials-btn 退役),不再弹 browser-credentials-dialog。
  clickWithMouseDown(dom, byId(dom, "app-settings-btn"));
  await waitFor(() => byId(dom, "app-settings-dialog") !== null, "设置对话框打开");
  await waitFor(() => byId(dom, "browser-api-key") !== null, "API 区内嵌凭据工作台挂载");
  await waitForDialogReady();
  assert.ok(byId(dom, "browser-credentials-save-btn"), "内嵌工作台带保存按钮");
  assert.equal(byId(dom, "browser-credentials-tabs"), null, "API 页面不再嵌套二级 Tab");
  assert.equal(byId(dom, "browser-credentials-save-btn").textContent, "保存接口");
  assert.equal(byId(dom, "browser-job-math-mode"), null, "API 页面不再展示公式处理方式");
  const translationKeyInput = byId(dom, "browser-api-key");
  const hideTranslationKey = dom.window.document.querySelector('[aria-label="隐藏翻译 API Key"]');
  assert.ok(hideTranslationKey, "翻译 Key 默认可见，可手动隐藏");
  assert.equal(
    translationKeyInput.nextElementSibling,
    hideTranslationKey,
    "小眼睛按钮应紧跟输入框并显示在右侧",
  );
  assert.equal(translationKeyInput.type, "text");
  typeInput(dom, translationKeyInput, "visibility-check");
  assert.equal(hideTranslationKey.getAttribute("aria-pressed"), "true");
  clickWithMouseDown(dom, hideTranslationKey);
  await waitFor(() => translationKeyInput.type === "password", "手动隐藏翻译 Key");
  const showTranslationKey = dom.window.document.querySelector('[aria-label="显示翻译 API Key"]');
  assert.ok(showTranslationKey);
  clickWithMouseDown(dom, showTranslationKey);
  await waitFor(() => translationKeyInput.type === "text", "重新显示翻译 Key");
  assert.equal(translationKeyInput.value, "visibility-check", "切换可见性不能清空用户输入");
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
    dom.window.document.querySelector('[aria-label="隐藏模型 API Key"]'),
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
    dom.window.document.querySelector('[aria-label="隐藏 FX Gateway Key"]'),
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
  assert.equal(byId(dom, "credentials-btn"), null, "门厅按钮已退役");
  assert.equal(byId(dom, "browser-credentials-dialog"), null, "设置内不再弹二层凭据对话框");

  services.settingsHub.dialogStore.close();
  await waitFor(() => byId(dom, "app-settings-dialog") === null, "关闭设置对话框");

  // 阶段 C(shadcn 改造):credential-gate-action 挂在 TranslationWorkflowDialog
  // 内部(HeroUpload 的上传引导区),该对话框换成 Radix Dialog 后不 forceMount
  // Content——需要先打开一次才会挂载(同其余阶段 C 对话框的先例)。
  services.workflowDialog.openUpload();
  await waitFor(() => byId(dom, "credential-gate-action"), "工作流对话框打开后 credential-gate-action 挂载");
  clickWithMouseDown(dom, byId(dom, "credential-gate-action"));
  await waitFor(() => byId(dom, "app-settings-dialog") !== null, "credential-gate-action 打开设置中心");
  await waitFor(() => byId(dom, "browser-api-key") !== null, "落到接口设置工作台");
  assert.equal(byId(dom, "browser-credentials-dialog"), null, "常规门禁不弹独立接口窗");

  root.unmount();
  services.dispose();
  host.remove();
});
