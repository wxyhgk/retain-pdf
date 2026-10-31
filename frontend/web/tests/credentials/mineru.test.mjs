import test from "node:test";
import assert from "node:assert/strict";
import { createCredentialsStatePort, ocrTokenFromCredentials } from "../../src/features/credentials/domain/state.js";
import { createCredentialVault } from "../../src/features/credentials/domain/credential-vault.js";
import { mountBrowserCredentialsFeature } from "../../src/features/credentials/domain/browser.js";
import { runOcrTokenValidation } from "../../src/features/credentials/domain/validation.js";
import { readCredentialDialogValues, ocrTokenFromDialogValues } from "../../src/features/credentials/domain/dialog-values.js";
import { normalizeBrowserStoredConfig } from "../../src/platform/config/storage.js";
import { getOcrProviderDefinition, normalizeOcrProvider } from "../../src/platform/config/providers.js";
import { createWorkflowPayloadAssembly } from "../../src/features/ingest/domain/workflow/payload-assembly.js";
import { deferred } from "../helpers/async.mjs";

const storedConfig = new Map();
globalThis.window = { localStorage: {
  getItem: (key) => storedConfig.get(key) || null,
  setItem: (key, value) => storedConfig.set(key, value),
} };

const paddle = { kind: "ocr_provider_token", provider: "paddle", credential_ref: "cred_paddle", revision: 3, secret: "paddle-restored" };
const mineru = { kind: "ocr_provider_token", provider: "mineru", credential_ref: "cred_mineru", revision: 7, secret: "mineru-restored" };
const translation = { kind: "translation_api_key", provider: "deepseek", credential_ref: "cred_translation", revision: 1, secret: "translation-restored" };

function state() {
  return createCredentialsStatePort({ initialState: {
    ocrProvider: "paddle", ocrCredentialRef: paddle.credential_ref,
    paddleToken: "paddle-legacy", translationCredentialRef: translation.credential_ref,
  } });
}

function vaultHarness({ port = state(), items = [paddle, mineru, translation], listCredentials } = {}) {
  const writes = [];
  const options = {
    apiPrefix: "/api/v1", credentialsStatePort: port,
    runtimeEnv: { isDesktopMode: () => false },
    readCurrentCredentials: port.getCredentials,
    currentOcrProvider: () => port.getCredentials().ocrProvider,
    translationProvider: () => "deepseek",
    listCredentials: listCredentials || (async () => ({ revision: 12, credentials: items })),
    createCredential: async (_prefix, payload) => {
      writes.push({ operation: "create", payload });
      return { revision: 13, credential: { credential_ref: `cred_${payload.provider}`, revision: 1 } };
    },
    updateCredential: async (_prefix, ref, payload) => {
      writes.push({ operation: "update", ref, payload });
      return { revision: 13, credential: { credential_ref: ref, revision: 8 } };
    },
  };
  return { port, writes, options, vault: createCredentialVault(options) };
}

test("MinerU stays normalized and never reads Paddle tokens or runtime defaults", () => {
  assert.equal(normalizeOcrProvider(" MinerU "), "mineru");
  assert.equal(normalizeOcrProvider("unknown"), "paddle");
  assert.equal(getOcrProviderDefinition("mineru").tokenField, "mineru_token");
  assert.equal(ocrTokenFromCredentials({ ocrProvider: "mineru", paddleToken: "wrong" }, {
    defaultPaddleToken: () => "also-wrong",
  }), "");
  assert.equal(ocrTokenFromCredentials({ ocrProvider: "paddle", paddleToken: "paddle" }), "paddle");
  const values = readCredentialDialogValues({ elementsPort: { elements: () => ({
    paddleInput: { value: "paddle-draft" }, mineruInput: { value: " mineru-draft " },
  }) } });
  assert.equal(ocrTokenFromDialogValues(values, "mineru"), "mineru-draft");
  assert.equal(ocrTokenFromDialogValues(values, "paddle"), "paddle-draft");
  const persisted = normalizeBrowserStoredConfig({ ocrProvider: "mineru", mineruToken: "local-mineru-key" });
  assert.equal(persisted.ocrProvider, "mineru");
  assert.equal(persisted.mineruToken, "local-mineru-key");
  assert.equal(ocrTokenFromCredentials(persisted), "local-mineru-key");
});

for (const status of ["valid", "unauthorized", "expired", "provider_error"]) {
  test(`MinerU standalone validation reports ${status} through its own provider`, async () => {
    const calls = [];
    const messages = [];
    const port = state();
    const expected = { ok: status === "valid", status, summary: `MinerU ${status}` };
    const result = await runOcrTokenValidation({
      apiPrefix: "/custom/api/v1", providerId: "mineru", token: " mineru-draft ",
      credentialsStatePort: port,
      validateOcrToken: async (...args) => { calls.push(args); return expected; },
      setOcrValidationMessage: (...args) => messages.push(args),
    });
    assert.deepEqual(calls, [["/custom/api/v1", "mineru", "mineru-draft"]]);
    assert.deepEqual(result, expected);
    assert.deepEqual(messages.at(-1), [expected.summary, expected.ok ? "valid" : "error", "mineru"]);
    assert.equal(port.hasValidOcrValidationCache({ provider: "mineru", token: "mineru-draft" }), expected.ok);
    assert.equal(port.hasValidOcrValidationCache({ provider: "paddle", token: "mineru-draft" }), false);
  });
}

test("MinerU standalone validation handles missing tokens and transport failures", async () => {
  const port = state();
  const missing = await runOcrTokenValidation({ providerId: "mineru", token: " ",
    validateOcrToken: () => assert.fail("empty tokens must not reach transport"),
    setOcrValidationMessage() {}, credentialsStatePort: port,
  });
  assert.equal(missing.ok, false);
  const failed = await runOcrTokenValidation({ providerId: "mineru", token: "mineru-draft",
    validateOcrToken: async () => { throw new Error("offline"); },
    setOcrValidationMessage() {}, credentialsStatePort: port,
  });
  assert.equal(failed.status, "network_error");
  assert.equal(failed.ok, false);
  assert.equal(port.hasValidOcrValidationCache({ provider: "mineru", token: "mineru-draft" }), false);
});

test("vault writes MinerU to its own reference, even when current state still holds Paddle", async () => {
  const { vault, writes } = vaultHarness();
  await vault.refreshCredentialReferences({ persist: false });
  assert.equal(await vault.storeOcrCredential({ provider: "mineru", secret: "mineru-new" }), "cred_mineru");
  assert.deepEqual(writes, [{ operation: "update", ref: "cred_mineru", payload: {
    kind: "ocr_provider_token", provider: "mineru", label: "MinerU OCR", secret: "mineru-new",
    expected_revision: 12, expected_credential_revision: 7,
  } }]);
});

test("vault creates a missing MinerU credential instead of overwriting Paddle", async () => {
  const { vault, writes } = vaultHarness({ items: [paddle, translation] });
  await vault.refreshCredentialReferences({ persist: false });
  await vault.storeOcrCredential({ provider: "mineru", secret: "mineru-new" });
  assert.equal(writes[0].operation, "create");
  assert.equal(writes[0].payload.provider, "mineru");
  assert.equal("expected_credential_revision" in writes[0].payload, false);
});

test("vault ignores out-of-order provider reference lookups", async () => {
  const pending = [deferred(), deferred()];
  let call = 0;
  const { port, vault } = vaultHarness({ listCredentials: () => pending[call++].promise });
  const first = vault.refreshCredentialReferences({ persist: false });
  port.patchCredentials({ ocrProvider: "mineru", ocrCredentialRef: "" });
  const second = vault.refreshCredentialReferences({ persist: false });
  pending[1].resolve({ revision: 12, credentials: [mineru, translation] });
  await second;
  pending[0].resolve({ revision: 11, credentials: [paddle, translation] });
  assert.equal(await first, null);
  assert.equal(port.getCredentials().ocrCredentialRef, "cred_mineru");
  await vault.storeOcrCredential({ provider: "mineru", secret: "" });
});

function controllerHarness(overrides = {}) {
  const harness = vaultHarness(overrides);
  const { port, options } = harness;
  let handlers;
  const messages = [];
  const elements = {
    paddleInput: { value: "paddle-legacy" }, mineruInput: { value: "" }, glmOcrInput: { value: "" },
    apiKeyInput: { value: "" }, modelNameInput: { value: "deepseek-chat" },
    modelBaseUrlInput: { value: "https://api.deepseek.com/v1" }, translationWorkersInput: { value: "5" },
  };
  const feature = mountBrowserCredentialsFeature({
    ...options,
    defaultPaddleToken: () => "runtime-paddle",
    getTaskOptions: () => ({ model: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1", workers: 5 }),
    dialogElementsPort: { elements: () => elements, syncOcrProviderControls() {} },
    runtimeEnvPort: { isDesktopMode: () => false },
    setupModePort: { currentSetupMode: () => false },
    onCredentialStateChange() {},
    viewPort: {
      bindEvents(value) { handlers = value; }, setHiddenOcrProvider() {}, syncOcrProviderControls() {},
      setOcrValidationMessage: (...args) => messages.push(args), setDialogStatus() {},
      setDeepSeekValidationMessage() {}, setDeepSeekTopUpVisible() {},
    },
  });
  return { ...harness, feature, handlers, elements, messages };
}

// 切换 OCR 提供商只看本机存过的 Token，vault 里有值也绝不回灌。
//
// 这条用例原来叫 "switching uses separate locally restored tokens"，断言切到
// MinerU 会自动拿到 vault 里的 mineru-restored——本机明明从没填过。那是
// restoreLocalCredentialValues 干的：它用 ?include_values=true 把服务端明文拉回
// 来写进 localStorage，而且对每个新浏览器都跑一遍，等于把 vault 当成了 UI 的
// 数据源。后果是开一个无痕窗口、换一台机器，照样显示出你的 MinerU Token。
//
// 现在 vault 只服务任务执行（后端要在任务落库前把明文换成引用，否则密钥会进
// jobs 表），不再回灌界面。本机没有就是没有。
test("切换 OCR 提供商只用本机 Token，vault 里有值也不回灌", async () => {
  const { port, feature, handlers, writes } = controllerHarness();
  await feature.ready();
  // fixtures 里的 vault 明明有 mineru-restored，但本机 state 只存过 paddleToken。
  const pending = handlers.changeProvider({ currentTarget: { value: "mineru" } });
  assert.equal(port.getCredentials().ocrCredentialRef, "");
  assert.equal(port.getOcrToken(), "", "本机没存过 MinerU Token 就必须是空，不得从 vault 取回明文");
  await pending;
  assert.equal(port.getCredentials().ocrCredentialRef, "");
  assert.equal(feature.hasOcrCredentials(), false, "没有本机 Token 就该判定为未配置，而不是靠 vault 兜底");
  // 切回 Paddle 仍拿到本机那份，两个提供商互不串味。
  await handlers.changeProvider({ currentTarget: { value: "paddle" } });
  assert.equal(port.getOcrToken(), "paddle-legacy");
  assert.deepEqual(writes, [], "切换提供商从不写 vault");
});

test("failed lookup cannot unlock MinerU using the previous Paddle reference", async () => {
  let fail = false;
  const { port, feature, handlers } = controllerHarness({ listCredentials: async () => {
    if (fail) throw new Error("offline");
    return { revision: 12, credentials: [paddle, translation] };
  } });
  await feature.ready();
  fail = true;
  await handlers.changeProvider({ currentTarget: { value: "mineru" } });
  assert.equal(port.getCredentials().ocrCredentialRef, "");
  assert.equal(feature.hasOcrCredentials(), false);
});

test("switching back preserves the local key instead of picking a newer account", async () => {
  const newerPaddle = { ...paddle, credential_ref: "cred_other_paddle", updated_at: "2026-09-14T12:00:00Z" };
  const { port, feature, handlers } = controllerHarness({ items: [newerPaddle, paddle, mineru, translation] });
  await feature.ready();
  assert.equal(port.getOcrToken(), "paddle-legacy");
  await handlers.changeProvider({ currentTarget: { value: "mineru" } });
  await handlers.changeProvider({ currentTarget: { value: "paddle" } });
  assert.equal(port.getOcrToken(), "paddle-legacy");
});

test("saving MinerU persists a visible local key and never writes the vault", async () => {
  const { port, feature, handlers, elements, writes } = controllerHarness();
  await feature.ready();
  await handlers.changeProvider({ currentTarget: { value: "mineru" } });
  elements.mineruInput.value = "new-mineru-secret";
  const saving = handlers.save();
  await handlers.changeProvider({ currentTarget: { value: "paddle" } });
  assert.equal(port.getCredentials().ocrProvider, "mineru", "provider is locked while saving");
  await saving;
  assert.equal(writes.length, 0);
  assert.equal(port.getCredentials().paddleToken, "paddle-legacy");
  assert.equal(port.getCredentials().ocrCredentialRef, "");
  assert.equal(port.getCredentials().mineruToken, "new-mineru-secret");
  assert.equal([...storedConfig.values()].some((value) => value.includes("new-mineru-secret")), true);
  assert.equal(elements.mineruInput.value, "new-mineru-secret", "keep the saved value editable");
});

test("upload and existing-document OCR/translation payloads use MinerU references only", () => {
  for (const ocrOnly of [true, false]) {
    const assembly = createWorkflowPayloadAssembly({
      constants: { WORKFLOW_BOOK: "book", WORKFLOW_TRANSLATE: "translate", DEFAULT_MODEL_VERSION: "vlm" },
      developerConfigWithDefaults: () => ({ workflow: "book" }),
      isOcrOnlyMode: () => ocrOnly, currentPageRanges: () => "2-4",
      getUploadState: () => ({ uploadId: "upload-test" }),
      workflowNeedsUpload: () => true, workflowUsesRenderStage: () => false,
      defaultPaddleApiUrl: () => "https://paddle.invalid", defaultPaddleToken: () => "wrong-default",
      defaultOcrProvider: () => "paddle", defaultModelApiKey: () => "",
      readSubmitValues: () => ({ ocrProvider: "mineru", ocrCredentialRef: "cred_mineru", translationCredentialRef: "cred_translation" }),
    });
    const payloads = [assembly.collectRunPayload(), assembly.buildOcrJobConfig("2-4"), assembly.buildTranslateJobConfig("2-4")];
    for (const payload of payloads) {
      assert.deepEqual(payload.ocr, {
        provider: "mineru", credential_ref: "cred_mineru", model_version: "vlm", language: undefined, page_ranges: "2-4",
      });
      if (payload.translation) assert.equal(payload.translation.credential_ref, "cred_translation");
    }
  }
});

// GLM-OCR（智谱）：不填自己的 key 也能保存，前提是翻译接口就是智谱——后端借翻译的 key；
// 翻译是别家时照样要求填，别家的 key 不会发给智谱。
test("GLM-OCR：翻译是智谱时可以不填 key；翻译是别家时要填", async () => {
  const deepseek = controllerHarness();
  await deepseek.feature.ready();
  await deepseek.handlers.changeProvider({ currentTarget: { value: "glm_ocr" } });
  deepseek.elements.apiKeyInput.value = "deepseek-key";
  await deepseek.handlers.save();
  assert.ok(
    deepseek.messages.some(([message, tone, provider]) => provider === "glm_ocr" && tone === "error" && /智谱 API Key/.test(message)),
    "翻译不是智谱时没提示要填 GLM 的 key",
  );

  const zhipu = controllerHarness();
  await zhipu.feature.ready();
  await zhipu.handlers.changeProvider({ currentTarget: { value: "glm_ocr" } });
  zhipu.elements.apiKeyInput.value = "zhipu-key";
  zhipu.elements.modelBaseUrlInput.value = "https://open.bigmodel.cn/api/paas/v4";
  zhipu.elements.modelNameInput.value = "glm-5.3-flash";
  await zhipu.handlers.save();
  assert.equal(zhipu.messages.some(([, tone, provider]) => provider === "glm_ocr" && tone === "error"), false);
  assert.equal(zhipu.port.getCredentials().ocrProvider, "glm_ocr");
  assert.equal(zhipu.port.getCredentials().glmOcrToken, "");

  zhipu.elements.glmOcrInput.value = "own-glm-key";
  await zhipu.handlers.save();
  assert.equal(zhipu.port.getCredentials().glmOcrToken, "own-glm-key", "填了就存自己的 key");
});

