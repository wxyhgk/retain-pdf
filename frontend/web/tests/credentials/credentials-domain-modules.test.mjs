import test from "node:test";
import assert from "node:assert/strict";

// 从 browser.ts 抽出的聚焦模块：credential-access / translation-profiles /
// dialog-flow（门禁与 provider 切换）。

const { createCredentialAccess } = await import(
  "../../src/features/credentials/domain/credential-access.js"
);
const { createTranslationProfiles } = await import(
  "../../src/features/credentials/domain/translation-profiles.js"
);
const { createCredentialDialogFlow } = await import(
  "../../src/features/credentials/domain/dialog-flow.js"
);
const { translationProfileDefaults } = await import(
  "../../src/features/credentials/domain/translation-profile.js"
);

test("credential access：OCR provider 归一化与就绪判定", () => {
  const access = createCredentialAccess({
    credentialsStatePort: {
      getCredentials: () => ({
        ocrProvider: "not-a-provider",
        ocrCredentialRef: "",
        paddleToken: "",
        translationCredentialRef: "",
        modelApiKey: "",
      }),
      hasComplete: () => false,
      getOcrToken: () => "",
    },
    defaultPaddleToken: () => "",
  });

  assert.equal(access.currentOcrProvider(), "paddle");
  assert.equal(access.hasBrowserCredentials(), false);
  assert.equal(access.hasOcrCredentials(), false);

  const ready = createCredentialAccess({
    credentialsStatePort: {
      getCredentials: () => ({
        ocrProvider: "paddle",
        ocrCredentialRef: "cred_ocr",
        paddleToken: "",
        translationCredentialRef: "cred_tr",
        modelApiKey: "",
      }),
      hasComplete: () => true,
      getOcrToken: () => "",
    },
    defaultPaddleToken: () => "",
  });
  assert.equal(ready.hasBrowserCredentials(), true);
  assert.equal(ready.hasOcrCredentials(), true);
});

test("translation profiles：hydrate 恢复存储 profile，缺 apiKey 时回落到凭据", () => {
  const applied = [];
  const manager = createTranslationProfiles({
    dialogElementsPort: { elements: () => ({}) },
    setTranslationProvider: (provider) => applied.push(provider),
  });

  manager.hydrate(
    { modelApiKey: "sk-model" },
    {
      translationProvider: "custom",
      baseUrl: "https://task.example/v1",
      model: "task-model",
      workers: 7,
      translationProfiles: {
        custom: {
          apiKey: "stored-key",
          baseUrl: "https://stored.example",
          model: "stored-model",
          workers: 9,
          apiProtocol: "anthropic",
          thinking: "high",
        },
      },
    },
  );
  assert.equal(manager.getCurrentProvider(), "custom");
  assert.deepEqual(manager.getCurrentProfile(), {
    apiKey: "stored-key",
    baseUrl: "https://stored.example",
    model: "stored-model",
    workers: 9,
    apiProtocol: "anthropic",
    thinking: "high",
  });

  manager.hydrate(
    { modelApiKey: "sk-model" },
    {
      translationProvider: "custom",
      baseUrl: "https://task.example/v1",
      model: "task-model",
      workers: 3,
      translationProfiles: {},
    },
  );
  assert.equal(manager.getCurrentProfile().apiKey, "sk-model");
  assert.equal(manager.getCurrentProfile().baseUrl, "https://task.example/v1");
  assert.equal(manager.getCurrentProfile().model, "task-model");
  assert.equal(manager.getCurrentProfile().workers, 3);
  // 没存过的服务商：协议用服务商自己的默认，思考深度为自动。
  assert.equal(manager.getCurrentProfile().apiProtocol, "openai");
  assert.equal(manager.getCurrentProfile().thinking, "auto");
});

test("translation profiles：Anthropic 默认 Anthropic 协议，非法值回落默认", () => {
  const manager = createTranslationProfiles({ dialogElementsPort: { elements: () => ({}) } });
  manager.hydrate({}, {
    translationProvider: "anthropic",
    translationProfiles: { anthropic: { apiProtocol: "gemini", thinking: "deep" } },
  });
  assert.equal(manager.getCurrentProfile().apiProtocol, "anthropic");
  assert.equal(manager.getCurrentProfile().thinking, "auto");
});

test("translation profiles：capture / apply 往返，自定义地址记忆", () => {
  const applied = [];
  const elements = {
    apiKeyInput: { value: "" },
    modelBaseUrlInput: { value: "" },
    modelNameInput: { value: "" },
    translationWorkersInput: { value: "" },
  };
  const manager = createTranslationProfiles({
    dialogElementsPort: { elements: () => elements },
    setTranslationProvider: (provider) => applied.push(provider),
  });

  manager.applyProfile("deepseek");
  const deepseek = translationProfileDefaults("deepseek");
  assert.equal(elements.modelBaseUrlInput.value, deepseek.baseUrl);
  assert.equal(elements.translationWorkersInput.value, `${deepseek.workers}`);
  assert.equal(applied.at(-1), "deepseek");

  elements.apiKeyInput.value = "sk-edit";
  elements.modelNameInput.value = "m-edit";
  elements.translationWorkersInput.value = "4";
  manager.captureCurrent();
  assert.equal(manager.persistable().deepseek.apiKey, "sk-edit");
  assert.equal(manager.persistable().deepseek.model, "m-edit");
  assert.equal(manager.persistable().deepseek.workers, 4);

  // custom 地址在切换后再回来要保留
  manager.applyProfile("custom");
  elements.modelBaseUrlInput.value = "https://custom.example/v1";
  manager.captureCurrent();
  manager.applyProfile("deepseek");
  manager.applyProfile("custom");
  assert.equal(elements.modelBaseUrlInput.value, "https://custom.example/v1");
});

test("translation profiles：providerFromBaseUrl 映射官方地址", () => {
  const manager = createTranslationProfiles({
    dialogElementsPort: { elements: () => ({}) },
  });
  assert.equal(manager.providerFromBaseUrl("https://api.deepseek.com/v1"), "deepseek");
  assert.equal(manager.providerFromBaseUrl("https://custom.example/v1"), "openai_compatible");
  assert.equal(manager.providerFromBaseUrl(""), "openai_compatible");
});

test("dialog flow：门禁按 desktop / 凭据状态计算并刷新提交控件", () => {
  const calls = [];
  const makeFlow = (overrides = {}) => createCredentialDialogFlow({
    viewPort: {
      setDialogMode() {},
      activateTab() {},
      setOcrValidationMessage() {},
      setDeepSeekValidationMessage() {},
      setDeepSeekTopUpVisible() {},
      setDialogStatus() {},
      setHiddenOcrProvider() {},
      syncOcrProviderControls() {},
      updateCredentialGate: (options) => {
        calls.push(options);
        return true;
      },
    },
    credentialsStatePort: { patchCredentials() {} },
    getTaskOptions: () => ({}),
    defaultModelBaseUrl: () => "",
    defaultModelApiKey: () => "",
    dialogElementsPort: { elements: () => ({}) },
    balanceState: { resetDeepSeekBalance() {} },
    translation: {
      hydrate() {},
      captureCurrent() {},
      applyProfile() {},
      getCurrentProvider: () => "deepseek",
      getCurrentProfile: () => ({}),
    },
    access: {
      readCurrentCredentials: () => ({}),
      currentOcrProvider: () => "paddle",
      hasBrowserCredentials: () => false,
    },
    uploadState: { getSnapshot: () => ({ uploadId: "u1" }) },
    runtimeEnv: { isDesktopMode: () => true },
    onCredentialStateChange() {},
    ...overrides,
  });

  const desktopFlow = makeFlow();
  desktopFlow.updateCredentialGate({
    workflowNeedsCredentials: () => true,
    workflowNeedsUpload: () => true,
    refreshSubmitControls: () => calls.push(["refresh"]),
  });
  assert.equal(calls[0].desktopMode, true);
  assert.equal(calls[0].show, false);
  assert.equal(calls[0].uploadReady, true);
  assert.deepEqual(calls[1], ["refresh"]);

  calls.length = 0;
  const browserFlow = makeFlow({ runtimeEnv: { isDesktopMode: () => false } });
  browserFlow.updateCredentialGate({
    workflowNeedsCredentials: () => true,
    workflowNeedsUpload: () => true,
    refreshSubmitControls: () => calls.push(["refresh"]),
  });
  assert.equal(calls[0].desktopMode, false);
  assert.equal(calls[0].show, true, "未就绪凭据时展示门禁");
});

test("dialog flow：切换翻译 provider 时采集并复位校验态", () => {
  const events = [];
  const translation = {
    hydrate() {},
    captureCurrent: () => events.push("capture"),
    applyProfile: (providerId) => events.push(["apply", providerId]),
    getCurrentProvider: () => "deepseek",
    getCurrentProfile: () => ({}),
  };
  const flow = createCredentialDialogFlow({
    viewPort: {
      setDeepSeekValidationMessage: (...args) => events.push(["message", ...args]),
      setDeepSeekTopUpVisible: (visible) => events.push(["top-up", visible]),
    },
    credentialsStatePort: { patchCredentials() {} },
    getTaskOptions: () => ({}),
    defaultModelBaseUrl: () => "",
    defaultModelApiKey: () => "",
    dialogElementsPort: { elements: () => ({}) },
    balanceState: { resetDeepSeekBalance: () => events.push("balance-reset") },
    translation,
    access: {
      readCurrentCredentials: () => ({}),
      currentOcrProvider: () => "paddle",
      hasBrowserCredentials: () => false,
    },
    uploadState: { getSnapshot: () => ({}) },
    runtimeEnv: { isDesktopMode: () => false },
    onCredentialStateChange: () => events.push("changed"),
  });

  flow.handleTranslationProviderChange("qwen");
  assert.deepEqual(events, [
    "capture",
    ["apply", "qwen"],
    ["message", "", ""],
    ["top-up", false],
    "balance-reset",
    "changed",
  ]);
});
