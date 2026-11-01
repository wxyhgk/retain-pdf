import test from "node:test";
import assert from "node:assert/strict";

// credentials/domain/translation-profile.ts（从 browser.ts 抽出的纯逻辑）。

const {
  dialogDataset,
  normalizeTranslationProfile,
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
