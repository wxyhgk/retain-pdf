import test, { before } from "node:test";
import assert from "node:assert/strict";

import { BROWSER_CONFIG_STORAGE_KEY } from "../src/js/config/storage-keys.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

let persistedConfig;
let runtime;
let credentialsState;
let workflowPayload;

before(async () => {
  // 必须先挂 window（含 localStorage stub）再动态 import，desktop/host.js 的
  // desktopHost 探测、storage.js 的 window.localStorage 访问都在模块求值期
  // 就发生一次。
  global.window = {
    localStorage: createMemoryStorage(),
    __FRONT_RUNTIME_CONFIG__: {},
  };
  persistedConfig = await import("../src/js/config/persisted-config.js");
  runtime = await import("../src/js/config/runtime.js");
  credentialsState = await import("../src/js/features/credentials/state.js");
  workflowPayload = await import("../src/js/features/workflow/payload.js");
});

const constants = {
  DEFAULT_MODEL_VERSION: "PP-StructureV3",
  DEFAULT_LANGUAGE: "ch",
};

test("loadBrowserStoredConfig seeds ocrProvider from the env default when localStorage never saved one", () => {
  global.window.localStorage.clear();
  runtime.setRuntimeConfig({ ocrProvider: "local" });

  const loaded = persistedConfig.loadBrowserStoredConfig();

  assert.equal(loaded.ocrProvider, "local");
});

test("loadBrowserStoredConfig still respects a previously saved explicit choice, even 'paddle', over the env default", () => {
  global.window.localStorage.clear();
  global.window.localStorage.setItem(
    BROWSER_CONFIG_STORAGE_KEY,
    JSON.stringify({ ocrProvider: "paddle", paddleToken: "", modelApiKey: "" }),
  );
  runtime.setRuntimeConfig({ ocrProvider: "local" });

  const loaded = persistedConfig.loadBrowserStoredConfig();

  assert.equal(loaded.ocrProvider, "paddle");
});

test("loadBrowserStoredConfig falls back to the hardcoded default when nothing was ever saved and no env default is set", () => {
  global.window.localStorage.clear();
  runtime.setRuntimeConfig({ ocrProvider: undefined });

  const loaded = persistedConfig.loadBrowserStoredConfig();

  assert.equal(loaded.ocrProvider, "paddle");
});

test("end-to-end: fresh boot with FRONT_OCR_PROVIDER=local reaches a submittable, credential-free OCR payload", () => {
  // This is the seam test the second review round asked for: three
  // independently-passing unit fixes (boot seeding, credential gate, payload
  // shaping) can each be correct in isolation while the handoff between them
  // still breaks. Assert the whole chain using only the output of the
  // previous step as the input to the next, the way the real app does.

  // --- Fresh browser: nothing in localStorage, FRONT_OCR_PROVIDER=local ---
  global.window.localStorage.clear();
  runtime.setRuntimeConfig({ ocrProvider: "local" });

  // 1) Boot-time seeding (persisted-config.ts) must surface "local", not the
  //    hardcoded DEFAULT_OCR_PROVIDER ("paddle").
  const bootedConfig = persistedConfig.loadBrowserStoredConfig();
  assert.equal(bootedConfig.ocrProvider, "local");

  // Credentials as the app would actually hold them after boot: seeded
  // provider, no OCR token (never asked for one), and a translation key the
  // user has entered (workflows still need DeepSeek regardless of OCR
  // provider).
  const credentials = {
    ocrProvider: bootedConfig.ocrProvider,
    paddleToken: "",
    modelApiKey: "sk-deepseek-test",
  };

  // 2) The credential-readiness gate must report ready without requiring any
  //    OCR token for a provider with supportsValidation: false.
  assert.equal(credentialsState.hasCompleteCredentials(credentials), true);
  const ocrToken = credentialsState.ocrTokenFromCredentials(credentials);
  assert.equal(ocrToken, "");

  // 3) The submitted OCR payload must carry no *_token field the backend's
  //    #[serde(deny_unknown_fields)] OcrInput would reject.
  const ocrPayload = workflowPayload.buildOcrPayload({
    pageRanges: "1-3",
    ocrProvider: credentials.ocrProvider,
    ocrToken,
    defaultPaddleApiUrl: () => "",
    constants,
  });

  assert.equal(ocrPayload.provider, "local");
  assert.equal("local_token" in ocrPayload, false);
  assert.equal("paddle_token" in ocrPayload, false);
  assert.equal("paddle_api_url" in ocrPayload, false);
  assert.equal(ocrPayload.page_ranges, "1-3");
});
