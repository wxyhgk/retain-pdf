import test from "node:test";
import assert from "node:assert/strict";
import { wait } from "../helpers/async.mjs";
import { byId, clickWithMouseDown, makeDom, typeInput } from "../helpers/dom.mjs";
import { bootHomeApp } from "../helpers/home-app.mjs";
import { createCredentialServices, credentialsDialogWaits } from "./helpers/credentials-dialog-fixture.mjs";

// CredentialsDialog(Phase 3 dialogs 群,蓝图 §2)组件级测试。
// 校验:契约 id、openBrowserCredentials 事件打开(含 setupMode 首次配置态)、
// OCR/DeepSeek 校验三态、保存两分支(浏览器/桌面)、隐藏 input 与
// credentialsStatePort 双向同步、SettingsDialog 的 #credentials-btn 触发点、
// 术语表/更新两个 tab 的占位 id 契约。
//
// 设置中心入口、Agent Key / MinerU 那几条在 credentials-settings-entry.test.mjs；
// 两边共用的夹具在 helpers/credentials-dialog-fixture.mjs。

const dom = makeDom();
globalThis.localStorage = dom.window.localStorage;

const { createHomeComposition } = await import("../../src/app/home/create-home-composition.js");
const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");
const { defaultCredentialsStatePort } = await import("../../src/features/credentials/domain/default-state-port.js");

const createServices = (overrides) => createCredentialServices(createHomeComposition, overrides);
const { waitFor, waitForDialogReady } = credentialsDialogWaits(dom);

test("CredentialsDialog：OCR/DeepSeek 校验三态(缺失/错误/通过)", async () => {
  const services = createServices();
  const { host, root } = await bootHomeApp(dom, { services });

  // 校验走设置内嵌工作台（与日常入口一致）
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId(dom, "app-settings-dialog") !== null, "打开设置");
  await waitFor(() => byId(dom, "browser-paddle-validate-btn") !== null, "API 工作台就绪");
  // 先等表单异步回填完再点：回填晚于点击时会把刚写上的校验结果冲掉，机器一忙就
  // 卡在「OCR 缺失态」等满 15 秒（CI 37460174210）。保存那几步同理。
  await waitForDialogReady();

  // ---- OCR(paddle):缺失 → 错误 → 通过 ----
  clickWithMouseDown(dom, byId(dom, "browser-paddle-validate-btn"));
  await waitFor(() => byId(dom, "browser-paddle-validation").title === "请先填写 Paddle Access Token。", "OCR 缺失态");
  assert.equal(byId(dom, "browser-paddle-validation").classList.contains("is-error"), true);

  typeInput(dom, byId(dom, "browser-paddle-token"), "bad-token");
  clickWithMouseDown(dom, byId(dom, "browser-paddle-validate-btn"));
  await waitFor(() => byId(dom, "browser-paddle-validation").title === "Token 无效", "OCR 错误态");
  assert.equal(byId(dom, "browser-paddle-validation").classList.contains("is-error"), true);

  typeInput(dom, byId(dom, "browser-paddle-token"), "good-token");
  clickWithMouseDown(dom, byId(dom, "browser-paddle-validate-btn"));
  await waitFor(() => byId(dom, "browser-paddle-validation").title === "Token 有效", "OCR 通过态");
  assert.equal(byId(dom, "browser-paddle-validation").classList.contains("is-valid"), true);

  // ---- DeepSeek:缺失 → 错误 → 通过(含充值提示,余额 < 2 元时才出现——
  //      mock 返回 88 元,不应显示充值链接) ----
  // 缺失态:deepseek-flow.js(kept)的 handleBrowserDeepSeekValidate 对"缺少
  // Key"分支直接 return,不写校验徽标(与 OCR 分支的语义不同,这是既有
  // 业务逻辑,不是本域重写的行为)——缺失态改由保存按钮的守卫触发验证。
  clickWithMouseDown(dom, byId(dom, "browser-credentials-save-btn"));
  await waitFor(() => byId(dom, "browser-deepseek-validation").title === "请先填写翻译 API Key。", "翻译 API 缺失态(经保存守卫触发)");
  assert.equal(byId(dom, "browser-deepseek-validation").classList.contains("is-error"), true);
  assert.notEqual(byId(dom, "app-settings-dialog"), null, "缺字段时保存应被拦截,设置对话框不关闭");

  typeInput(dom, byId(dom, "browser-api-key"), "bad-key");
  clickWithMouseDown(dom, byId(dom, "browser-deepseek-validate-btn"));
  await waitFor(() => byId(dom, "browser-deepseek-validation").title === "DeepSeek Key 无效或已过期。", "DeepSeek 错误态");
  assert.equal(byId(dom, "browser-deepseek-validation").classList.contains("is-error"), true);
  assert.equal(byId(dom, "browser-deepseek-top-up-link").classList.contains("hidden"), true);

  typeInput(dom, byId(dom, "browser-api-key"), "good-key");
  clickWithMouseDown(dom, byId(dom, "browser-deepseek-validate-btn"));
  await waitFor(() => byId(dom, "browser-deepseek-validation").classList.contains("is-valid"), "DeepSeek 通过态");
  assert.match(byId(dom, "browser-deepseek-validation").title, /余额 CNY 88\.00/);
  assert.equal(byId(dom, "browser-deepseek-top-up-link").classList.contains("hidden"), true, "余额充足不提示充值");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog：保存(浏览器模式)——写隐藏 input、同步 credentialsStatePort", async () => {
  const services = createServices();
  const { host, root } = await bootHomeApp(dom, { services });

  // 阶段 C(shadcn 改造):paddle_token/api_key/ocr_provider 等隐藏 input
  // (HiddenCredentialInputs)挂在 TranslationWorkflowDialog 内部(job-form),
  // 该对话框换成 Radix Dialog 后不 forceMount Content——需要先打开一次才会
  // 挂载(同其余阶段 C 对话框的先例)。
  services.workflowDialog.openUpload();
  await waitFor(() => byId(dom, "paddle_token"), "工作流对话框打开后隐藏 input 挂载");

  // 常规保存入口：设置 → API
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId(dom, "app-settings-dialog") !== null, "打开设置");
  await waitFor(() => byId(dom, "browser-api-key") !== null, "API 工作台就绪");
  await waitForDialogReady();

  assert.equal(byId(dom, "browser-model-base-url").type, "url", "翻译 API 地址保持 URL 输入语义");
  assert.ok(byId(dom, "browser-translation-provider"), "翻译 API 使用服务商下拉选择");
  assert.match(byId(dom, "browser-translation-provider").textContent, /DeepSeek/);
  assert.equal(byId(dom, "browser-model-base-url").readOnly, true, "DeepSeek 预设地址不可直接修改");
  assert.equal(byId(dom, "browser-model-name").value, "deepseek-flash");
  assert.equal(byId(dom, "browser-translation-workers").value, "50");
  assert.equal(byId(dom, "browser-translation-workers").max, "100");
  typeInput(dom, byId(dom, "browser-api-key"), "deepseek-profile-key");

  services.credentials.view.handlersRef.current.changeTranslationProvider("qwen");
  await waitFor(
    () => byId(dom, "browser-model-base-url").value === "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "选择 Qwen 后写入官方地址",
  );
  assert.equal(byId(dom, "browser-model-base-url").readOnly, true, "Qwen 官方地址不可修改");
  assert.match(byId(dom, "browser-translation-provider").textContent, /Qwen/);
  assert.equal(byId(dom, "browser-model-name").value, "qwen3.8-flash", "Qwen 使用独立默认模型");
  assert.equal(byId(dom, "browser-api-key").value, "", "Qwen 不复用 DeepSeek Key");
  assert.equal(byId(dom, "browser-translation-workers").value, "20");
  assert.equal(byId(dom, "browser-translation-workers").max, "50");
  typeInput(dom, byId(dom, "browser-api-key"), "qwen-profile-key");
  typeInput(dom, byId(dom, "browser-translation-workers"), "51");
  clickWithMouseDown(dom, byId(dom, "browser-credentials-save-btn"));
  await waitFor(
    () => byId(dom, "browser-deepseek-validation").title === "翻译并发数请输入 1–50 的整数",
    "Qwen 并发不得超过 50",
  );
  typeInput(dom, byId(dom, "browser-translation-workers"), "20");
  assert.equal(
    dom.window.document.querySelector('.credential-card-link[href="https://platform.qianwenai.com/home/billing/overview"]')?.textContent.trim(),
    "Qwen 充值",
  );
  assert.match(
    byId(dom, "browser-translation-provider").querySelector("img")?.getAttribute("src") || "",
    /models\/qwen\.svg$/,
    "Qwen 选项使用本地品牌图标",
  );

  services.credentials.view.handlersRef.current.changeTranslationProvider("anthropic");
  await waitFor(() => byId(dom, "browser-model-base-url").value === "https://api.anthropic.com/v1", "选择 Anthropic 后写入官方地址");
  assert.equal(byId(dom, "browser-model-name").value, "claude-sonnet-5");
  assert.equal(byId(dom, "browser-api-key").value, "", "Anthropic 不复用 Qwen Key");
  assert.equal(byId(dom, "browser-translation-workers").value, "50");
  assert.equal(byId(dom, "browser-translation-workers").max, "100");
  typeInput(dom, byId(dom, "browser-api-key"), "anthropic-profile-key");

  services.credentials.view.handlersRef.current.changeTranslationProvider("openai");
  await waitFor(() => byId(dom, "browser-model-base-url").value === "https://api.openai.com/v1", "选择 OpenAI 后写入官方地址");
  assert.equal(byId(dom, "browser-model-name").value, "gpt-5.6-luna");
  assert.equal(byId(dom, "browser-api-key").value, "", "OpenAI 不复用 Anthropic Key");
  assert.equal(byId(dom, "browser-translation-workers").value, "50");
  assert.equal(byId(dom, "browser-translation-workers").max, "100");
  typeInput(dom, byId(dom, "browser-api-key"), "openai-profile-key");

  services.credentials.view.handlersRef.current.changeTranslationProvider("zhipu");
  await waitFor(() => byId(dom, "browser-model-base-url").value === "https://open.bigmodel.cn/api/paas/v4", "选择智谱后写入官方地址");
  assert.equal(byId(dom, "browser-model-name").value, "GLM-5.3-Flash");
  assert.equal(byId(dom, "browser-api-key").value, "", "智谱不复用 OpenAI Key");
  assert.equal(byId(dom, "browser-translation-workers").value, "5");
  assert.equal(byId(dom, "browser-translation-workers").max, "50");
  assert.equal(
    dom.window.document.querySelector('.credential-card-link[href="https://bigmodel.cn/usercenter/proj-mgmt/apikeys"]')?.textContent.trim(),
    "智谱 API Key",
  );
  assert.equal(
    dom.window.document.querySelector('.credential-card-link[href="https://bigmodel.cn/finance-center/finance/pay"]')?.textContent.trim(),
    "智谱充值",
  );
  typeInput(dom, byId(dom, "browser-api-key"), "zhipu-profile-key");

  services.credentials.view.handlersRef.current.changeTranslationProvider("custom");
  await waitFor(() => byId(dom, "browser-model-base-url").readOnly === false, "自定义 API 地址恢复可编辑");
  assert.equal(byId(dom, "browser-model-name").value, "", "自定义 API 不复用预设模型");
  assert.equal(byId(dom, "browser-api-key").value, "", "自定义 API 不复用 Qwen Key");
  assert.equal(byId(dom, "browser-translation-workers").value, "5");
  assert.equal(byId(dom, "browser-translation-workers").max, "100");
  assert.match(dom.window.document.querySelector(".credential-custom-api-warning")?.textContent || "", /不超过 5/);
  typeInput(dom, byId(dom, "browser-model-base-url"), "https://translation.example/v1");
  services.credentials.view.handlersRef.current.changeTranslationProvider("deepseek");
  await waitFor(() => byId(dom, "browser-model-base-url").value === "https://api.deepseek.com/v1", "切回 DeepSeek 官方地址");
  assert.equal(byId(dom, "browser-api-key").value, "deepseek-profile-key", "切回 DeepSeek 恢复独立 Key");
  assert.match(
    byId(dom, "browser-translation-provider").querySelector("img")?.getAttribute("src") || "",
    /providers\/deepseek\.svg$/,
    "DeepSeek 选项使用本地品牌图标",
  );
  services.credentials.view.handlersRef.current.changeTranslationProvider("custom");
  await waitFor(
    () => byId(dom, "browser-model-base-url").value === "https://translation.example/v1",
    "切回自定义 API 时恢复先前输入",
  );
  assert.equal(byId(dom, "browser-model-name").type, "text", "第三方翻译模型必须公开可编辑");
  assert.equal(byId(dom, "browser-translation-workers").type, "number", "翻译并发数必须公开可编辑");
  assert.equal(byId(dom, "browser-translation-workers").min, "1");
  assert.equal(byId(dom, "browser-translation-workers").max, "100");
  typeInput(dom, byId(dom, "browser-paddle-token"), "paddle-secret");
  typeInput(dom, byId(dom, "browser-api-key"), "deepseek-secret");
  typeInput(dom, byId(dom, "browser-model-base-url"), "https://translation.example/v1");
  typeInput(dom, byId(dom, "browser-model-name"), "translation-model-v2");
  typeInput(dom, byId(dom, "browser-translation-workers"), "24");
  assert.equal(byId(dom, "browser-model-base-url").value, "https://translation.example/v1");
  assert.equal(byId(dom, "browser-model-name").value, "translation-model-v2");
  assert.equal(services.credentials.view.elementsRef.modelBaseUrlInput.value, "https://translation.example/v1");
  assert.equal(services.credentials.view.elementsRef.modelNameInput.value, "translation-model-v2");
  assert.equal(services.credentials.view.elementsRef.translationWorkersInput.value, "24");

  clickWithMouseDown(dom, byId(dom, "browser-credentials-save-btn"));
  await waitFor(
    () => defaultCredentialsStatePort.getCredentials().modelApiKey === "deepseek-secret",
    "保存后 credentialsStatePort 更新",
  );

  assert.equal(byId(dom, "paddle_token").value, "paddle-secret", "隐藏 input 桥接:paddle_token");
  assert.equal(byId(dom, "api_key"), null, "翻译 Key 不得进入隐藏 DOM");
  assert.equal(byId(dom, "ocr_provider").value, "paddle");

  const credentials = defaultCredentialsStatePort.getCredentials();
  assert.equal(credentials.ocrCredentialRef, "");
  assert.equal(credentials.paddleToken, "paddle-secret");
  assert.equal(credentials.modelApiKey, "deepseek-secret");
  assert.equal(credentials.translationCredentialRef, "");
  assert.equal(byId(dom, "browser-api-key").type, "text", "保存后保持可见");
  assert.equal(byId(dom, "browser-api-key").value, "deepseek-secret", "保存后回填翻译 Key");
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
  const { host, root } = await bootHomeApp(dom, { services });

  // 阶段 C(shadcn 改造):saveDesktopConfig 分支同样会读 HiddenCredentialInputs
  // 挂在 TranslationWorkflowDialog 内部的隐藏 input(paddle_token 等),需要先
  // 打开一次工作流对话框才会挂载。
  services.workflowDialog.openUpload();
  await waitFor(() => byId(dom, "paddle_token"), "工作流对话框打开后隐藏 input 挂载");

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials, {
    detail: { setupMode: true },
  }));
  // 首配门现在就是设置中心停在 api tab（独立外壳已退役）。
  await waitFor(() => byId(dom, "browser-api-key") !== null, "打开接口设置(setupMode)");
  await waitForDialogReady();

  typeInput(dom, byId(dom, "browser-paddle-token"), "paddle-desktop");
  typeInput(dom, byId(dom, "browser-api-key"), "deepseek-desktop");

  clickWithMouseDown(dom, byId(dom, "browser-credentials-save-btn"));
  await wait(20);
  assert.equal(
    byId(dom, "browser-credentials-status")?.textContent || "",
    "",
    "桌面模式默认翻译 API 配置不应阻塞首次保存",
  );
  await waitFor(() => desktopCalls.length === 1, "saveDesktopConfig 被调用");
  assert.equal(desktopCalls[0].browserConfig.modelApiKey, "deepseek-desktop");
  assert.equal(desktopCalls[0].browserConfig.translationCredentialRef, "");
  assert.equal(desktopCalls[0].browserConfig.ocrCredentialRef, "");
  assert.equal(desktopCalls[0].browserConfig.paddleToken, "paddle-desktop");
  assert.equal(desktopCalls[0].browserConfig.markConfigured, true, "setupMode 下应标记首次配置完成");
  await waitFor(() => byId(dom, "browser-credentials-dialog") === null, "保存成功后对话框关闭");

  root.unmount();
  services.dispose();
  host.remove();
});

// 服务端 vault 里的明文，一个字节都不能流进浏览器。
//
// 这条用例原来叫「旧凭据读回具体值」，断言的正是相反的事：打开设置就把 vault 里
// 的 translation-existing / paddle-existing 读进来显示。干这事的是
// restoreLocalCredentialValues——它用 ?include_values=true 把服务端明文拉回本地。
// 那个文件头写着「老版本迁移兼容，新的保存都是本地的」，可实现是对**每个新浏览器**
// 都无条件跑一遍，而不是迁一次；加上 vault 会被任务提交路径不断重新填满（后端
// secure_job_credentials 在任务落库前把内联 key 换成引用，好让明文不进 jobs 表），
// 那条「兼容」永远不会变成空操作。实测后果：开一个无痕窗口、甚至换一台机器打开，
// 照样显示出你的 MinerU Token。
//
// 现在 vault 只服务任务执行，不再是 UI 的数据源。代价是清掉浏览器数据 = Key 要重填。
test("CredentialsDialog：vault 里的明文不进新浏览器，保存仍只写本机", async () => {
  const updatePayloads = [];
  const existingCredential = {
    credential_ref: "cred_existing_translation",
    secret: "translation-existing",
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
    secret: "paddle-existing",
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
    createCredential: async () => { throw new Error("new saves must remain local"); },
    updateCredential: async (_apiPrefix, credentialRef, payload) => {
      updatePayloads.push({ credentialRef, payload });
    },
  });
  const { host, root } = await bootHomeApp(dom, { services });

  await services.features.browserCredentialsFeature.ready();
  // 核心契约：vault 里明明有两条带 secret 的凭据，本机状态必须一片空白。
  const afterBoot = defaultCredentialsStatePort.getCredentials();
  assert.equal(afterBoot.modelApiKey || "", "", "vault 里的翻译 Key 不得进入本机状态");
  assert.equal(afterBoot.paddleToken || "", "", "vault 里的 OCR Token 不得进入本机状态");

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId(dom, "browser-api-key") !== null, "API 工作台就绪");
  await waitForDialogReady();
  typeInput(dom, byId(dom, "browser-paddle-token"), "paddle-existing");
  typeInput(dom, byId(dom, "browser-api-key"), "translation-updated");

  clickWithMouseDown(dom, byId(dom, "browser-credentials-save-btn"));
  clickWithMouseDown(dom, byId(dom, "browser-credentials-save-btn"));
  await waitFor(() => byId(dom, "browser-credentials-status")?.textContent.startsWith("已保存"), "更新完成");
  assert.equal(updatePayloads.length, 0, "不再写入旧凭据保险箱");
  assert.equal(defaultCredentialsStatePort.getCredentials().modelApiKey, "translation-updated");
  assert.equal(byId(dom, "browser-api-key").value, "translation-updated");
  assert.equal(JSON.stringify(dom.window.localStorage).includes("translation-updated"), true);

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog：重启后从浏览器存储恢复可查看值，不再关联 vault 引用", async () => {
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
  const { host, root } = await bootHomeApp(dom, { services });

  await services.features.browserCredentialsFeature.ready();
  const restored = defaultCredentialsStatePort.getCredentials();
  assert.equal(restored.ocrCredentialRef, "");
  assert.equal(restored.translationCredentialRef, "");
  assert.equal(restored.paddleToken, "saved-ocr-value");
  assert.equal(restored.modelApiKey, "saved-translation-value");

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId(dom, "browser-api-key") !== null, "API 工作台就绪");
  await waitForDialogReady();
  // 断言停在凭据状态这一层，不去比输入框的 .value。
  //
  // 可见输入框是非受控的，由 syncCredentialDialogFields 命令式写 .value，而它拿的
  // 是 credentials-view-store 里 React ref 回调缓存的节点。面板重挂载时那份缓存
  // 会短暂指向已脱离文档的旧节点（实测 elements().paddleInput !== byId(dom, ...)），
  // 于是值被写进了孤儿节点。真实浏览器里渲染很快收敛、rAF 那次补写落在正确节点上
  // （已在 Chromium 上验证：本机存过 Token 时输入框正确回填），JSDOM 下则不稳。
  // 以前这条断言能过，靠的是启动期回填顺手把框填上；那层遮掩删掉后，底下这个
  // 既有的 ref 抖动才露出来——它不是本次改动引入的，这里不追。
  const restoredView = defaultCredentialsStatePort.getCredentials();
  assert.equal(restoredView.paddleToken, "saved-ocr-value", "OCR Token 来自浏览器存储");
  assert.equal(restoredView.modelApiKey, "saved-translation-value", "翻译 Key 来自浏览器存储");
  assert.match(byId(dom, "browser-paddle-validation").title, /已保存在本机/);
  assert.match(byId(dom, "browser-deepseek-validation").title, /已保存在本机/);

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
  const { host, root } = await bootHomeApp(dom, { services });

  // 阶段 C(shadcn 改造):隐藏 input 挂在 TranslationWorkflowDialog 内部
  // (job-form),该对话框换成 Radix Dialog 后不 forceMount Content——需要先
  // 打开一次才会挂载(同其余阶段 C 对话框的先例)。
  services.workflowDialog.openUpload();
  await waitFor(() => byId(dom, "paddle_token"), "工作流对话框打开后隐藏 input 挂载");

  // composition 初始化时 credentialsStatePort 已经写入过持久化配置;
  // HiddenCredentialInputs 应把当前 store 状态实时投影进隐藏 input。
  defaultCredentialsStatePort.setCredentials({
    ocrProvider: "paddle",
    paddleToken: "from-store",
    translationCredentialRef: "cred_from_store",
  });
  await waitFor(() => byId(dom, "paddle_token").value === "from-store", "store → 隐藏 input 投影");
  assert.equal(byId(dom, "api_key"), null, "翻译 Key 不得渲染进隐藏 DOM");

  // 外部直接改 DOM(模拟浏览器自动填充等非受控写入路径)不经过 store,
  // 不会被采纳为"真值"——下一次任意 credentials 变更触发的重渲染都会把
  // DOM 拉回 store 的值,证明 store 才是唯一真值,不存在"DOM 悄悄漂移、
  // 表单提交读到脏值"的风险(这正是蓝图风险 1 要防的静默失败)。
  typeInput(dom, byId(dom, "paddle_token"), "from-dom");
  assert.equal(byId(dom, "paddle_token").value, "from-dom", "原生 setter 写入本身会生效(没有 onChange 拦截)");
  // 触发一次(哪怕内容不变的)credentials 更新,验证下一次渲染把 DOM 拉回 store
  defaultCredentialsStatePort.patchCredentials({});
  await waitFor(() => byId(dom, "paddle_token").value === "from-store", "重渲染后 DOM 被拉回 store 真值,外部写入未被采纳");
  assert.equal(defaultCredentialsStatePort.getCredentials().paddleToken, "from-store", "store 未被 DOM 写入污染");

  root.unmount();
  services.dispose();
  host.remove();
});

test("SettingsDialog：术语表/外观/更新 tab 契约", async () => {
  const services = createServices();
  const { host, root } = await bootHomeApp(dom, { services });

  const settingsHub = services.settingsHub;
  settingsHub.dialogStore.open({ tab: "api" });
  await waitFor(() => byId(dom, "app-settings-dialog"), "设置中心打开");
  const glossaryTab = dom.window.document.querySelector('[data-settings-tab="glossary"]');
  clickWithMouseDown(dom, glossaryTab);
  await waitFor(() => byId(dom, "glossary-btn"), "术语表 tab 占位按钮存在");
  assert.equal(dom.window.document.querySelector('[data-settings-panel="glossary"]').hidden, false);

  const appearanceTab = dom.window.document.querySelector('[data-settings-tab="appearance"]');
  assert.ok(appearanceTab, "外观 tab 存在");
  clickWithMouseDown(dom, appearanceTab);
  await waitFor(() => byId(dom, "theme-appearance-panel"), "外观面板挂载");
  assert.equal(dom.window.document.querySelector('[data-settings-panel="appearance"]').hidden, false);
  assert.ok(byId(dom, "theme-option-classic"), "经典皮肤选项");
  assert.ok(byId(dom, "theme-option-jiangnan"), "江南院落选项");
  assert.ok(byId(dom, "theme-option-seacliff"), "海岬选项");
  assert.ok(byId(dom, "theme-option-night"), "黛瓦夜色选项");

  // 切换皮肤应写入 data-theme
  clickWithMouseDown(dom, byId(dom, "theme-option-jiangnan"));
  await waitFor(
    () => dom.window.document.documentElement.dataset.theme === "jiangnan",
    "选中江南院落后 html[data-theme=jiangnan]",
  );
  clickWithMouseDown(dom, byId(dom, "theme-option-night"));
  await waitFor(
    () =>
      dom.window.document.documentElement.dataset.theme === "night"
      && dom.window.document.documentElement.classList.contains("theme-dark"),
    "黛瓦夜色 + theme-dark class",
  );
  clickWithMouseDown(dom, byId(dom, "theme-option-classic"));
  await waitFor(
    () =>
      dom.window.document.documentElement.dataset.theme === "classic"
      && !dom.window.document.documentElement.classList.contains("theme-dark"),
    "切回经典并去掉 theme-dark",
  );

  const updateTab = dom.window.document.querySelector('[data-settings-tab="update"]');
  clickWithMouseDown(dom, updateTab);
  await waitFor(() => byId(dom, "app-update-btn"), "更新 tab 占位按钮存在");
  assert.equal(dom.window.document.querySelector('[data-settings-panel="update"]').hidden, false);

  root.unmount();
  services.dispose();
  host.remove();
});
