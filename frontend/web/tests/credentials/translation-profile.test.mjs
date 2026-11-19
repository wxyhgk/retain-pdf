import test from "node:test";
import assert from "node:assert/strict";

// credentials/domain/translation-profile.ts（从 browser.ts 抽出的纯逻辑）。

const {
  dialogDataset,
  normalizeTranslationProfile,
  parseModelList,
  translationConfigError,
  translationProfileDefaults,
  translationWorkersError,
} = await import("../../src/features/credentials/domain/translation-profile.js");

test("translation profile：URL / 模型名 / 并发数校验文案", () => {
  assert.equal(translationConfigError("", "deepseek"), "请填写翻译 API URL");
  assert.match(translationConfigError("ftp://x", "m"), /http\(s\)/);
  assert.match(translationConfigError("https://u:p@x.com", "m"), /用户名或密码/);
  assert.equal(translationConfigError("https://api.deepseek.com", ""), "请填写翻译模型名称");
  assert.equal(translationConfigError("https://api.deepseek.com", "deepseek-chat"), "");

  assert.match(translationWorkersError(0), /1–\d+ 的整数/);
  assert.match(translationWorkersError("abc"), /1–\d+ 的整数/);
  assert.match(translationWorkersError(9999), /1–\d+ 的整数/);
  assert.equal(translationWorkersError(4), "");
});

test("translation profile：默认值与归一化（越界回退默认）", () => {
  const defaults = translationProfileDefaults("custom");
  assert.equal(typeof defaults.baseUrl, "string");
  assert.ok(defaults.workers >= 1);

  const normalized = normalizeTranslationProfile("custom", {
    baseUrl: "  https://x.example  ",
    model: "  m  ",
    workers: 3,
  });
  assert.equal(normalized.baseUrl, "https://x.example");
  assert.equal(normalized.model, "m");
  assert.equal(normalized.workers, 3);

  const bad = normalizeTranslationProfile("custom", { workers: 99999 });
  assert.equal(bad.workers, defaults.workers, "越界 workers 回退默认");
});

test("dialogDataset：只在对象带 dataset 时返回", () => {
  const dataset = { mode: "api" };
  assert.equal(dialogDataset({ dataset }), dataset);
  assert.equal(dialogDataset(null), undefined);
  assert.equal(dialogDataset(false), undefined);
});


test("OpenCode Go preset：默认连接、模型、并发与地址识别", async () => {
  const { inferTranslationProvider, normalizeTranslationProvider } = await import("../../src/platform/config/providers.js");
  const defaults = translationProfileDefaults("opencode");
  assert.equal(normalizeTranslationProvider("opencode"), "opencode");
  assert.equal(defaults.baseUrl, "https://opencode.ai/inference/go/v1");
  assert.equal(defaults.model, "deepseek-v4.1-flash");
  assert.equal(defaults.workers, 5);
  assert.equal(defaults.apiProtocol, "openai_responses");
  for (const path of ["/inference/go/v1", "/zen/go/v1", "/inference/go/v1/chat/completions"]) {
    assert.equal(inferTranslationProvider(`https://opencode.ai${path}`), "opencode");
  }
  assert.equal(inferTranslationProvider("https://opencode.ai.example/inference/go/v1"), "custom");
  const profile = normalizeTranslationProfile("opencode", {apiKey: "test-key", workers: 101});
  assert.equal(profile.apiKey, "test-key");
  assert.equal(profile.workers, 5);
});

test("translation profile：其他模型按逗号、顿号、空白分；去空去重、去掉默认模型；最多 20 个", () => {
  assert.deepEqual(parseModelList("deepseek-v4-pro, deepseek-v4-flash、qwen3.8-plus\n  qwen3.8-plus", "deepseek-v4-flash"), ["deepseek-v4-pro", "qwen3.8-plus"]);
  assert.deepEqual(parseModelList(["a", " b ", ""], "a"), ["b"]);
  assert.equal(parseModelList(Array.from({ length: 30 }, (_, i) => `m${i}`)).length, 20);
  assert.deepEqual(normalizeTranslationProfile("deepseek", { model: "deepseek-v4-flash", models: "deepseek-v4-pro" }).models, ["deepseek-v4-pro"]);
  assert.deepEqual(normalizeTranslationProfile("deepseek", {}).models, []);
});

test("translation profiles：「其他模型」从输入框读进档案，保存时不被盖掉，换服务商再换回来填回输入框", async () => {
  const { createTranslationProfiles } = await import("../../src/features/credentials/domain/translation-profiles.js");
  const elements = {
    apiKeyInput: { value: "sk" }, modelBaseUrlInput: { value: "" }, modelNameInput: { value: "deepseek-v4-flash" },
    extraModelsInput: { value: "deepseek-v4-pro, deepseek-v4-flash" }, translationWorkersInput: { value: "5" },
    translationProtocolSelect: { value: "" }, translationThinkingSelect: { value: "off" },
  };
  const profiles = createTranslationProfiles({ dialogElementsPort: { elements: () => elements } });
  profiles.hydrate({}, { translationProvider: "deepseek" });
  profiles.captureCurrent();
  profiles.recordCurrentProfile({ apiKey: "sk", baseUrl: "", model: "deepseek-v4-flash", workers: 5 });
  assert.deepEqual(profiles.persistable().deepseek.models, ["deepseek-v4-pro"]);
  profiles.applyProfile("qwen");
  assert.equal(elements.extraModelsInput.value, "");
  profiles.applyProfile("deepseek");
  assert.equal(elements.extraModelsInput.value, "deepseek-v4-pro");
});
