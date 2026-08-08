import test from "node:test";
import assert from "node:assert/strict";

import {
  runDeepSeekBalanceCheck,
  runDeepSeekConnectivityCheck,
  runOcrTokenValidation,
} from "../src/js/features/credentials/validation.js";
import {
  handleBrowserDeepSeekValidate,
} from "../src/js/features/credentials/deepseek-flow.js";
import {
  browserValidationIdForProvider,
  CREDENTIAL_DOM_DATASETS,
  CREDENTIAL_DOM_IDS,
  CREDENTIAL_DOM_SELECTORS,
} from "../src/js/features/credentials/credentials-dom-contract.js";
import { mountBrowserCredentialsFeature } from "../src/js/features/credentials/browser.js";
import { ensureOcrCredentialValidationReady } from "../src/js/features/credentials/ocr-readiness-flow.js";
import {
  createCredentialsStatePort,
  hasCompleteCredentials,
  ocrTokenFromCredentials,
} from "../src/js/features/credentials/state.js";
import { createUploadStatePort } from "../src/js/features/upload/state.js";
import { createInitialState } from "../src/js/state/slices.js";

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

test("runDeepSeekConnectivityCheck passes injected apiPrefix to DeepSeek validation port", async () => {
  const calls = [];
  const result = await runDeepSeekConnectivityCheck({
    apiPrefix: "/custom/api",
    apiKey: "sk-test",
    baseUrl: "https://example.test/v1",
    validateDeepSeekToken: async (...args) => {
      calls.push(args);
      return { ok: true, status: 200, summary: "ok" };
    },
    setDeepSeekValidationMessage() {},
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
        apiKeyInput: createCredentialNode({ value: "" }),
        modelBaseUrlInput: createCredentialNode({ value: "" }),
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

test("credentials DOM contract centralizes hidden inputs and browser dialog ids", () => {
  assert.equal(CREDENTIAL_DOM_IDS.hidden.ocrProvider, "ocr_provider");
  assert.equal(CREDENTIAL_DOM_IDS.hidden.modelApiKey, "api_key");
  assert.equal(CREDENTIAL_DOM_IDS.browser.ocrProviderSelect, "browser-ocr-provider-select");
  assert.equal(CREDENTIAL_DOM_IDS.browser.validations.deepseek, "browser-deepseek-validation");
  assert.equal(browserValidationIdForProvider("paddle"), CREDENTIAL_DOM_IDS.browser.validations.paddle);
  assert.equal(CREDENTIAL_DOM_DATASETS.credentialTab, "credentialTab");
  assert.equal(CREDENTIAL_DOM_SELECTORS.trigger, "#credentials-btn, #credential-gate-action");
});

test("credentials state port owns credential source of truth and token helpers", () => {
  const mirrored = [];
  const port = createCredentialsStatePort({
    initialState: {
      ocrProvider: "paddle",
      paddleToken: "paddle-token",
      modelApiKey: "sk-test",
    },
    mirrorToDom: (snapshot) => mirrored.push(snapshot),
  });

  assert.equal(port.getOcrToken({ providerId: "paddle" }), "paddle-token");
  assert.equal(port.getOcrToken({ providerId: "unknown-provider" }), "paddle-token");
  assert.equal(port.hasComplete(), true);
  assert.equal(ocrTokenFromCredentials({ ocrProvider: "paddle" }, {
    defaultPaddleToken: () => "paddle-default",
  }), "paddle-default");
  assert.equal(hasCompleteCredentials({ ocrProvider: "paddle", modelApiKey: "sk" }, {
    defaultPaddleToken: () => "paddle-default",
  }), true);

  port.patchCredentials({ ocrProvider: "bad-provider", paddleToken: "" });

  assert.equal(port.getCredentials().ocrProvider, "paddle");
  assert.equal(port.getCredentials().paddleToken, "");
  assert.equal(mirrored.length, 1);
});

test("credential-free provider (local) is treated as ready without any token", () => {
  const port = createCredentialsStatePort({
    initialState: {
      ocrProvider: "local",
      paddleToken: "",
      modelApiKey: "sk-test",
    },
  });

  // ocrTokenFromCredentials/hasCompleteCredentials must key off the provider's
  // supportsValidation flag, not just "is there a paddleToken".
  assert.equal(port.getOcrToken(), "");
  assert.equal(ocrTokenFromCredentials({ ocrProvider: "local" }), "");
  assert.equal(port.hasComplete(), true);
  assert.equal(hasCompleteCredentials({ ocrProvider: "local", modelApiKey: "sk-test" }), true);
  // No modelApiKey still blocks readiness — local only waives the OCR token.
  assert.equal(hasCompleteCredentials({ ocrProvider: "local", modelApiKey: "" }), false);
  // An explicit providerId override (candidate provider not yet in credentials)
  // must win over whatever credentials.ocrProvider currently says.
  assert.equal(hasCompleteCredentials({ ocrProvider: "paddle", modelApiKey: "sk-test" }, {
    providerId: "local",
  }), true);
});

test("ensureOcrCredentialValidationReady short-circuits to ready for a credential-free provider", async () => {
  let validateCalled = false;
  const result = await ensureOcrCredentialValidationReady({
    apiPrefix: "/api",
    providerId: "local",
    credentials: { ocrProvider: "local", paddleToken: "" },
    defaultPaddleToken: () => "",
    validateOcrToken: async () => {
      validateCalled = true;
      return { ok: true };
    },
    setOcrValidationMessage: () => {},
    showResult: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "not_required");
  assert.equal(result.definition.id, "local");
  assert.equal(result.token, "");
  assert.equal(validateCalled, false);
});

test("credentials state port owns validation and balance runtime state", () => {
  const mirroredRuntime = [];
  const port = createCredentialsStatePort({
    initialState: {
      ocrProvider: "paddle",
      paddleToken: "paddle-token",
      modelApiKey: "sk-test",
    },
    mirrorRuntime: (snapshot) => mirroredRuntime.push(snapshot),
  });

  assert.deepEqual(port.getDeepSeekBalanceState(), {
    balanceCny: null,
    balanceChecked: false,
  });

  port.setDeepSeekBalance("3.5", true);
  assert.deepEqual(port.getDeepSeekBalanceState(), {
    balanceCny: 3.5,
    balanceChecked: true,
  });

  port.setOcrValidationCache({
    provider: "paddle",
    token: "paddle-token",
    status: "valid",
  });

  assert.equal(port.hasValidOcrValidationCache({
    provider: "paddle",
    token: "paddle-token",
  }), true);

  port.resetDeepSeekBalance();
  port.resetOcrValidationCache();

  assert.deepEqual(port.getDeepSeekBalanceState(), {
    balanceCny: null,
    balanceChecked: false,
  });
  assert.equal(port.hasValidOcrValidationCache({
    provider: "paddle",
    token: "paddle-token",
  }), false);
  assert.equal(mirroredRuntime.length, 4);
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

test("browser credential gate reads upload readiness from upload state port", () => {
  const previousDocument = global.document;
  const state = createInitialState();
  const uploadStatePort = createUploadStatePort(state);
  uploadStatePort.setUpload({
    uploadId: "upload-ready",
    uploadedFileName: "book.pdf",
    uploadedPageCount: 12,
    uploadedBytes: 1024,
  });

  const tileCalls = [];
  const elements = new Map([
    [CREDENTIAL_DOM_IDS.trigger, createCredentialNode()],
    [CREDENTIAL_DOM_IDS.gate, createCredentialNode()],
    [CREDENTIAL_DOM_IDS.file, createCredentialNode({
      closest(selector) {
        return selector === ".upload-tile" ? createCredentialNode() : null;
      },
    })],
    ["upload-glyph", createCredentialNode()],
    ["file-label", createCredentialNode()],
    ["upload-help", createCredentialNode()],
    ["upload-status", createCredentialNode()],
  ]);

  global.document = {
    addEventListener() {},
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector(selector) {
      return selector === ".upload-meta" ? createCredentialNode() : null;
    },
  };

  try {
    const feature = mountBrowserCredentialsFeature({
      apiPrefix: "api/v1",
      state,
      uploadStatePort,
      applyHiddenCredentialInputs() {},
      defaultPaddleToken: () => "",
      defaultModelApiKey: () => "",
      defaultModelBaseUrl: () => "",
      getTaskOptions: () => ({}),
      saveTaskOptions() {},
      saveBrowserStoredConfig() {},
      readHiddenCredentialInputs: () => ({
        ocrProvider: "paddle",
        paddleToken: "paddle",
        modelApiKey: "sk",
      }),
      saveDesktopConfig() {},
      checkApiConnectivity: async () => true,
      validateOcrToken: async () => ({ ok: true }),
      validateDeepSeekToken: async () => ({ ok: true }),
      queryDeepSeekBalance: async () => ({ ok: true, balance_cny: 100 }),
      onCredentialStateChange() {},
      // 旧 DOM 直写 viewPort(browser-view-port.js)已随 cutover 删除;这里内联
      // 复刻其 updateCredentialGate 对 uploadTilePort 的转发语义(镜像旧
      // view.js#updateCredentialGateView 非 desktopMode 分支),不依赖真实 DOM。
      viewPort: {
        bindEvents() {},
        updateCredentialGate: ({ show, uploadEnabled, uploadReady }) => {
          tileCalls.push(["locked", { locked: show || !uploadEnabled, enabled: !show && uploadEnabled }]);
          tileCalls.push(["text", { labelVisible: !show, helpVisible: true, statusVisible: show ? false : null }]);
          tileCalls.push(["ready", !show && uploadEnabled && uploadReady]);
          return true;
        },
      },
      dialogElementsPort: { elements: () => ({}) },
    });

    feature.updateCredentialGate({
      workflowNeedsCredentials: () => false,
      workflowNeedsUpload: () => true,
      refreshSubmitControls() {},
    });

    assert.deepEqual(tileCalls.at(-1), ["ready", true]);
  } finally {
    global.document = previousDocument;
  }
});

test("browser credentials controller routes UI operations through view port", () => {
  const calls = [];
  const state = createInitialState();
  const uploadStatePort = createUploadStatePort(state);
  const credentialsStatePort = createCredentialsStatePort({
    initialState: {
      ocrProvider: "paddle",
      paddleToken: "paddle-token",
      modelApiKey: "sk-test",
    },
  });
  let boundHandlers = null;
  const feature = mountBrowserCredentialsFeature({
      apiPrefix: "api/v1",
      state,
      uploadStatePort,
      credentialsStatePort,
      applyHiddenCredentialInputs() {},
      defaultPaddleToken: () => "",
      defaultModelApiKey: () => "",
      defaultModelBaseUrl: () => "",
      getTaskOptions: () => ({}),
      saveTaskOptions() {},
      saveBrowserStoredConfig() {},
      readHiddenCredentialInputs: () => credentialsStatePort.getCredentials(),
      saveDesktopConfig() {},
      checkApiConnectivity: async () => true,
      validateOcrToken: async () => ({ ok: true }),
      validateDeepSeekToken: async () => ({ ok: true }),
      queryDeepSeekBalance: async () => ({ ok: true, balance_cny: 100 }),
      onCredentialStateChange() {},
      viewPort: {
        activateTab: (tabName) => calls.push(["tab", tabName]),
        bindEvents: (handlers) => {
          boundHandlers = handlers;
          calls.push(["bind"]);
        },
        closeDialog: () => calls.push(["close"]),
        dialogElements: () => ({ dialog: {} }),
        openDialog: () => calls.push(["open"]),
        setDeepSeekTopUpVisible: (visible) => calls.push(["top-up", visible]),
        setDeepSeekValidationMessage: (message, tone) => calls.push(["deepseek-message", message, tone]),
        setDialogMode: ({ setupMode }) => calls.push(["mode", setupMode]),
        setDialogStatus: (message, tone) => calls.push(["status", message, tone]),
        setHiddenOcrProvider: (provider) => calls.push(["hidden-provider", provider]),
        setOcrValidationMessage: (message, tone, provider) => calls.push(["ocr-message", message, tone, provider]),
        syncOcrProviderControls: (provider) => calls.push(["controls", provider]),
        updateCredentialGate: (payload) => {
          calls.push(["gate", payload.show, payload.uploadReady]);
          return true;
        },
      },
      dialogElementsPort: {
        elements: () => ({
          paddleInput: createCredentialNode(),
          apiKeyInput: createCredentialNode(),
          modelBaseUrlInput: createCredentialNode(),
          modelNameInput: createCredentialNode(),
          mathModeSelect: createCredentialNode(),
        }),
        syncOcrProviderControls: (provider) => calls.push(["sync-dialog-controls", provider]),
      },
    });

  feature.openBrowserCredentialsDialog({ setupMode: true });
  feature.updateCredentialGate({
    workflowNeedsCredentials: () => true,
    workflowNeedsUpload: () => true,
    refreshSubmitControls: () => calls.push(["refresh-submit"]),
  });
  boundHandlers.changeProvider({ currentTarget: { value: "unknown-provider" } });

  assert.equal(calls.some(([kind]) => kind === "bind"), true);
  assert.equal(calls.some(([kind]) => kind === "open"), true);
  assert.equal(calls.some(([kind, setupMode]) => kind === "mode" && setupMode === true), true);
  assert.equal(calls.some(([kind]) => kind === "gate"), true);
  assert.equal(calls.some(([kind]) => kind === "refresh-submit"), true);
  assert.equal(calls.some(([kind]) => kind === "sync-dialog-controls"), true);
  const hiddenProvider = calls.find(([kind]) => kind === "hidden-provider")?.[1] || "";
  const controlsProvider = calls.find(([kind]) => kind === "controls")?.[1] || "";
  assert.equal(Boolean(hiddenProvider), true);
  assert.equal(controlsProvider, hiddenProvider);
});

test("handleBrowserCredentialSave does not block save for a credential-free provider (local)", async () => {
  const previousWindow = global.window;
  global.window = {};
  try {
    const calls = [];
    const credentialsStatePort = createCredentialsStatePort({
      initialState: {
        ocrProvider: "local",
        paddleToken: "",
        modelApiKey: "",
      },
    });
    let boundHandlers = null;
    mountBrowserCredentialsFeature({
      apiPrefix: "api/v1",
      state: {},
      credentialsStatePort,
      applyHiddenCredentialInputs() {},
      defaultPaddleToken: () => "",
      defaultModelApiKey: () => "",
      defaultModelBaseUrl: () => "",
      getTaskOptions: () => ({}),
      saveTaskOptions() {},
      saveBrowserStoredConfig: (payload) => calls.push(["save-browser-config", payload]),
      readHiddenCredentialInputs: () => credentialsStatePort.getCredentials(),
      saveDesktopConfig() {},
      checkApiConnectivity: async () => true,
      validateOcrToken: async () => ({ ok: true }),
      validateDeepSeekToken: async () => ({ ok: true }),
      queryDeepSeekBalance: async () => ({ ok: true }),
      onCredentialStateChange() {},
      viewPort: {
        activateTab() {},
        bindEvents: (handlers) => {
          boundHandlers = handlers;
        },
        closeDialog: () => calls.push(["close"]),
        dialogElements: () => ({ dialog: {} }),
        openDialog() {},
        setDeepSeekTopUpVisible() {},
        setDeepSeekValidationMessage: (message, tone) => calls.push(["deepseek-message", message, tone]),
        setDialogMode() {},
        setDialogStatus: (message, tone) => calls.push(["status", message, tone]),
        setHiddenOcrProvider() {},
        setOcrValidationMessage: (message, tone, provider) => calls.push(["ocr-message", message, tone, provider]),
        syncOcrProviderControls() {},
        updateCredentialGate: () => true,
      },
      dialogElementsPort: {
        elements: () => ({
          // local 没有可见 token 输入框：paddleInput 恒为 null（对照
          // credentials-view-store.js#elements() 的 tokenInputs.paddle 兜底）。
          paddleInput: null,
          apiKeyInput: createCredentialNode({ value: "sk-new" }),
          modelBaseUrlInput: createCredentialNode(),
          modelNameInput: createCredentialNode(),
          mathModeSelect: createCredentialNode(),
        }),
        syncOcrProviderControls() {},
      },
    });

    await boundHandlers.save();

    assert.equal(
      calls.some(([kind, , tone]) => kind === "ocr-message" && tone === "error"),
      false,
      "local 不该报 OCR token 缺失",
    );
    assert.equal(calls.some(([kind, message]) => kind === "status" && message === "已保存"), true);
    assert.equal(calls.some(([kind, payload]) => kind === "save-browser-config" && payload.modelApiKey === "sk-new"), true);
    assert.equal(credentialsStatePort.getCredentials().modelApiKey, "sk-new");
  } finally {
    global.window = previousWindow;
  }
});

test("browser credentials controller reads runtime and balance state through ports", async () => {
  const calls = [];
  const credentialsStatePort = createCredentialsStatePort({
    initialState: {
      ocrProvider: "paddle",
      paddleToken: "paddle-token",
      modelApiKey: "sk-test",
    },
  });
  let boundHandlers = null;
  const feature = mountBrowserCredentialsFeature({
    apiPrefix: "api/v1",
    state: {
      desktopMode: true,
      uploadId: "",
    },
    uploadStatePort: {
      getSnapshot: () => {
        calls.push(["upload-snapshot"]);
        return { uploadId: "port-upload" };
      },
    },
    runtimeEnvPort: {
      isDesktopMode: () => {
        calls.push(["desktop-mode"]);
        return false;
      },
    },
    balanceStatePort: {
      resetDeepSeekBalance: () => calls.push(["balance-reset"]),
    },
    credentialsStatePort,
    applyHiddenCredentialInputs() {},
    defaultPaddleToken: () => "",
    defaultModelApiKey: () => "",
    defaultModelBaseUrl: () => "",
    getTaskOptions: () => ({}),
    saveTaskOptions() {},
    saveBrowserStoredConfig() {},
    readHiddenCredentialInputs: () => credentialsStatePort.getCredentials(),
    saveDesktopConfig() {},
    checkApiConnectivity: async () => true,
    validateOcrToken: async () => ({ ok: true, status: "valid", summary: "ok" }),
    validateDeepSeekToken: async () => ({ ok: true }),
    queryDeepSeekBalance: async () => ({ ok: true, balance_cny: 100 }),
    onCredentialStateChange: () => calls.push(["credential-change"]),
    viewPort: {
      activateTab: (tabName) => calls.push(["tab", tabName]),
      bindEvents: (handlers) => {
        boundHandlers = handlers;
      },
      closeDialog: () => calls.push(["close"]),
      dialogElements: () => ({ dialog: { dataset: {} } }),
      openDialog: () => calls.push(["open"]),
      setDeepSeekTopUpVisible: (visible) => calls.push(["top-up", visible]),
      setDeepSeekValidationMessage: (message, tone) => calls.push(["deepseek-message", message, tone]),
      setDialogMode: ({ setupMode }) => calls.push(["mode", setupMode]),
      setDialogStatus: (message, tone) => calls.push(["status", message, tone]),
      setHiddenOcrProvider: () => {},
      setOcrValidationMessage: (message, tone, provider) => calls.push(["ocr-message", message, tone, provider]),
      syncOcrProviderControls: () => {},
      updateCredentialGate: (payload) => {
        calls.push(["gate", payload.desktopMode, payload.uploadReady]);
        return true;
      },
    },
    dialogElementsPort: {
      elements: () => ({
        paddleInput: createCredentialNode({ value: "paddle-token" }),
        apiKeyInput: createCredentialNode({ value: "sk-test" }),
        modelBaseUrlInput: createCredentialNode(),
        modelNameInput: createCredentialNode(),
        mathModeSelect: createCredentialNode(),
      }),
      syncOcrProviderControls: () => {},
    },
  });

  feature.openBrowserCredentialsDialog();
  feature.updateCredentialGate({
    workflowNeedsCredentials: () => true,
    workflowNeedsUpload: () => true,
    refreshSubmitControls: () => calls.push(["refresh-submit"]),
  });
  await feature.ensureOcrCredentialsReady();
  boundHandlers.resetDeepSeekValidation();

  assert.ok(calls.some((call) => call[0] === "balance-reset"));
  assert.ok(calls.some((call) => call[0] === "upload-snapshot"));
  assert.ok(calls.some((call) => call[0] === "desktop-mode"));
  assert.ok(calls.some((call) => call[0] === "gate" && call[1] === false && call[2] === true));
  assert.ok(calls.some((call) => call[0] === "credential-change"));
});
