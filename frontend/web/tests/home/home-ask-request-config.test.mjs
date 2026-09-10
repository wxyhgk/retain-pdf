import test from "node:test";
import assert from "node:assert/strict";

const { buildHomeAskModelRequestOverrides } = await import(
  "../../src/features/ask/domain/home-ask-request-config.js"
);

test("home ask: browser key 为空时不覆盖后端安全运行配置", () => {
  assert.deepEqual(buildHomeAskModelRequestOverrides({
    apiKey: "",
    baseUrl: "https://legacy.example/v1",
    model: "legacy-model",
  }), {});
});

test("home ask: 旧浏览器 key 存在时仍作为完整的单次请求覆盖", () => {
  assert.deepEqual(buildHomeAskModelRequestOverrides({
    apiKey: "  sk-browser  ",
    baseUrl: " https://legacy.example/v1 ",
    model: " legacy-model ",
  }), {
    llmApiKey: "sk-browser",
    llmBaseUrl: "https://legacy.example/v1",
    llmModel: "legacy-model",
  });
});
