import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createDesktopConfigStore } = require("./desktop-config.js");

test("builds the complete runtime config for the active backend port", () => {
  const app = {
    getPath() {
      throw new Error("runtime config construction must not touch the filesystem");
    },
  };
  const store = createDesktopConfigStore(app, { desktopApiKey: "desktop-test-key" });
  store.setBackendApiPort(41234);

  const runtimeConfig = store.buildDesktopRuntimeConfig({
    ocrProvider: "paddle",
    ocrCredentialRef: "cred_ocr",
    translationCredentialRef: "cred_translation",
    mineruToken: "mineru-token",
    paddleToken: "paddle-token",
    modelApiKey: "model-key",
    model: "model-name",
    baseUrl: "https://model.example/v1",
    developerConfig: { trace: true },
  });

  assert.deepEqual(runtimeConfig, {
    apiBase: "http://127.0.0.1:41234",
    xApiKey: "desktop-test-key",
    ocrProvider: "paddle",
    ocrCredentialRef: "cred_ocr",
    translationCredentialRef: "cred_translation",
    mineruToken: "mineru-token",
    paddleToken: "paddle-token",
    modelApiKey: "model-key",
    model: "model-name",
    baseUrl: "https://model.example/v1",
    developerConfig: { trace: true },
  });
});

test("persists desktop credential values together with backend references", (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-desktop-config-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const store = createDesktopConfigStore({
    getPath(name) {
      assert.equal(name, "userData");
      return userData;
    },
  });

  const saved = store.saveDesktopConfig({
    firstRunCompleted: true,
    ocrProvider: "paddle",
    ocrCredentialRef: "cred_ocr",
    translationCredentialRef: "cred_translation",
    paddleToken: "desktop-ocr",
    modelApiKey: "desktop-model",
  });

  assert.equal(saved.firstRunCompleted, true);
  assert.equal(saved.ocrCredentialRef, "cred_ocr");
  assert.equal(saved.translationCredentialRef, "cred_translation");
  assert.equal(saved.paddleToken, "desktop-ocr");
  assert.equal(saved.modelApiKey, "desktop-model");
  const raw = fs.readFileSync(store.resolveDesktopConfigPath(), "utf8");
  assert.equal(raw.includes("desktop-ocr"), true);
  assert.equal(raw.includes("desktop-model"), true);
});

test("restores desktop values from existing vault references during migration", (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-desktop-vault-migration-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const secretsDir = path.join(userData, "data", "secrets");
  fs.mkdirSync(secretsDir, { recursive: true });
  fs.writeFileSync(path.join(secretsDir, "credentials.json"), JSON.stringify({
    credentials: {
      cred_ocr: { kind: "ocr_provider_token", provider: "paddle", secret: "restored-ocr" },
      cred_translation: { kind: "translation_api_key", secret: "restored-model" },
    },
  }));
  const store = createDesktopConfigStore({
    getPath(name) {
      assert.equal(name, "userData");
      return userData;
    },
  });

  const response = store.buildDesktopConfigResponse({
    firstRunCompleted: true,
    closeToTrayHintShown: false,
    ocrProvider: "paddle",
    ocrCredentialRef: "cred_ocr",
    translationCredentialRef: "cred_translation",
    paddleToken: "",
    modelApiKey: "",
    mineruToken: "",
    model: "model-name",
    baseUrl: "https://model.example/v1",
    developerConfig: {},
  });

  assert.equal(response.browserConfig.paddleToken, "restored-ocr");
  assert.equal(response.browserConfig.modelApiKey, "restored-model");
});

test("MinerU remains independently saved locally and restores only matching legacy tokens", (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-desktop-mineru-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const secretsDir = path.join(userData, "data", "secrets");
  fs.mkdirSync(secretsDir, { recursive: true });
  fs.writeFileSync(path.join(secretsDir, "credentials.json"), JSON.stringify({
    credentials: {
      cred_mineru: { kind: "ocr_provider_token", provider: "mineru", secret: "legacy-mineru" },
      cred_paddle: { kind: "ocr_provider_token", provider: "paddle", secret: "legacy-paddle" },
    },
  }));
  const store = createDesktopConfigStore({ getPath: () => userData });
  const saved = store.saveDesktopConfig({
    ocrProvider: "mineru", mineruToken: "local-mineru", paddleToken: "local-paddle",
  });
  assert.equal(saved.ocrProvider, "mineru");
  assert.equal(store.loadDesktopConfig().mineruToken, "local-mineru");
  assert.equal(store.loadDesktopConfig().paddleToken, "local-paddle");
  assert.equal(store.buildDesktopConfigResponse({
    ...saved, mineruToken: "", ocrCredentialRef: "cred_mineru",
  }).browserConfig.mineruToken, "legacy-mineru");
  assert.equal(store.buildDesktopConfigResponse({
    ...saved, mineruToken: "", ocrCredentialRef: "cred_paddle",
  }).browserConfig.mineruToken, "");
  assert.equal(store.buildDesktopConfigResponse({
    ...saved, ocrCredentialRef: "cred_mineru",
  }).browserConfig.mineruToken, "local-mineru", "local edits win over legacy values");
});

// ---------------------------------------------------------------- ~/.retainpdf/

const { createRetainpdfHome, changesFromDesktop, overlayExport } = require("./retainpdf-home.js");

const fakeExport = {
  translation: { provider: "qwen", model: "qwen3.8-flash", base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1", workers: 30, api_key: "sk-qwen" },
  providers: {
    deepseek: { model: "deepseek-flash", base_url: "https://api.deepseek.com/v1", workers: 50, api_key: null },
    qwen: { model: "qwen3.8-flash", base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1", workers: 30, api_key: "sk-qwen" },
    custom: { model: "", base_url: "", workers: 5, api_key: null },
  },
  ocr: { provider: "mineru", tokens: { paddle: null, mineru: "mineru-tok" } },
  backend: { data_dir: null, max_running_jobs: 3 },
  assistant: { model: "qwen3.8-flash" },
};

test("settings from ~/.retainpdf fill the fields the settings page reads", () => {
  const merged = overlayExport({ firstRunCompleted: true, developerConfig: { mathMode: "placeholder" } }, fakeExport);
  assert.equal(merged.firstRunCompleted, true);
  assert.equal(merged.ocrProvider, "mineru");
  assert.equal(merged.mineruToken, "mineru-tok");
  assert.equal(merged.modelApiKey, "sk-qwen");
  assert.equal(merged.developerConfig.mathMode, "placeholder", "other task options are kept");
  assert.equal(merged.developerConfig.translationProvider, "qwen");
  assert.deepEqual(merged.developerConfig.translationProfiles.qwen, {
    apiKey: "sk-qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.8-flash",
    workers: 30,
  });
});

test("saving from the settings page becomes ~/.retainpdf changes; legacy top-level keys fill the current profile", () => {
  const changes = changesFromDesktop(
    {
      ocrProvider: "paddle",
      paddleToken: " paddle-tok ",
      mineruToken: "",
      modelApiKey: "sk-legacy",
      developerConfig: {
        translationProvider: "deepseek",
        workers: 64,
        translationProfiles: {
          custom: { apiKey: "", baseUrl: "https://llm.example.com/v1", model: "m1", workers: 4 },
          "made-up": { apiKey: "x" },
        },
      },
    },
    ["deepseek", "qwen", "custom"],
  );
  assert.equal(changes["translation.provider"], "deepseek");
  assert.equal(changes["providers.deepseek.api_key"], "sk-legacy");
  assert.equal(changes["providers.deepseek.workers"], "64");
  assert.equal(changes["providers.custom.base_url"], "https://llm.example.com/v1");
  assert.equal(changes["providers.custom.api_key"], null);
  assert.equal(changes["ocr.paddle_token"], "paddle-tok");
  assert.equal(changes["ocr.mineru_token"], null);
  assert.ok(!Object.keys(changes).some((key) => key.includes("made-up")), "unknown providers are ignored");
});

function fakeCli() {
  const calls = [];
  let state = JSON.parse(JSON.stringify(fakeExport));
  return {
    calls,
    runCli(_cli, args, input) {
      calls.push({ args, input: input ? JSON.parse(input) : null });
      if (args.includes("export")) return JSON.stringify(state);
      const changes = JSON.parse(input);
      if (changes["providers.deepseek.api_key"]) state.providers.deepseek.api_key = changes["providers.deepseek.api_key"];
      if (changes["translation.provider"]) state.translation.provider = changes["translation.provider"];
      return "{}";
    },
  };
}

test("an old desktop config is moved to ~/.retainpdf once, backed up, and loses its secrets", (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-desktop-home-"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-home-"));
  t.after(() => {
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  });
  const legacyPath = path.join(userData, "desktop-config.json");
  fs.writeFileSync(legacyPath, JSON.stringify({
    firstRunCompleted: true,
    ocrProvider: "paddle",
    paddleToken: "legacy-paddle",
    modelApiKey: "sk-legacy",
    model: "deepseek-flash",
    baseUrl: "https://api.deepseek.com/v1",
    developerConfig: { translationProvider: "deepseek", mathMode: "placeholder" },
  }));
  const cli = fakeCli();
  const cliPath = path.join(home, "fake-retainpdf");
  fs.writeFileSync(cliPath, "");
  const retainpdfHome = createRetainpdfHome({
    resolveCli: () => cliPath,
    runCli: cli.runCli,
    env: { RETAINPDF_HOME: home },
    logger: { log() {} },
  });
  const store = createDesktopConfigStore({ getPath: () => userData }, { retainpdfHome });

  const loaded = store.loadDesktopConfig();
  const imported = cli.calls.find((c) => c.args.includes("import"));
  assert.equal(imported.input["providers.deepseek.api_key"], "sk-legacy");
  assert.equal(imported.input["ocr.paddle_token"], "legacy-paddle");
  assert.equal(loaded.firstRunCompleted, true);
  assert.equal(loaded.developerConfig.mathMode, "placeholder");
  const rewritten = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
  assert.equal(rewritten.modelApiKey, undefined, "secrets leave the desktop file");
  assert.equal(rewritten.paddleToken, undefined);
  assert.equal(rewritten.developerConfig.mathMode, "placeholder");
  const backup = JSON.parse(fs.readFileSync(path.join(userData, "desktop-config.before-retainpdf-home.json"), "utf8"));
  assert.equal(backup.modelApiKey, "sk-legacy", "the original is kept as a backup");

  // 已经有 ~/.retainpdf/config.toml:不再搬。
  fs.writeFileSync(path.join(home, "config.toml"), "");
  const before = cli.calls.filter((c) => c.args.includes("import")).length;
  store.loadDesktopConfig();
  assert.equal(cli.calls.filter((c) => c.args.includes("import")).length, before);
});

test("without the command line the desktop keeps storing everything itself", (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-desktop-nocli-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const retainpdfHome = createRetainpdfHome({ resolveCli: () => "", logger: { log() {} } });
  const store = createDesktopConfigStore({ getPath: () => userData }, { retainpdfHome });
  store.saveDesktopConfig({ modelApiKey: "sk-local", firstRunCompleted: true });
  assert.equal(store.loadDesktopConfig().modelApiKey, "sk-local");
});
