// 管理后台 · 平台设置：选服务带出地址 / 模型 / 协议、密钥留空不改、缺项说人话；
// 界面上读回状态、检测只带对应那一段、没配过的密钥必须填、保存后状态刷新。
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { waitFor } from "../helpers/async.mjs";
import {
  applyTranslationProvider,
  formFromView,
  isPlatformFormDirty,
  missingLabel,
  platformFormProblem,
  platformInput,
  platformTestInput,
  secretPlaceholder,
} from "../../src/features/admin/domain/platform-settings.ts";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/admin.html?view=platform" });
for (const key of ["window", "document", "DocumentFragment", "HTMLElement", "HTMLButtonElement", "HTMLFormElement", "HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "Node", "MutationObserver", "NodeFilter", "CustomEvent", "Event", "MouseEvent", "KeyboardEvent", "getComputedStyle", "navigator"]) {
  Object.defineProperty(globalThis, key, {
    value: key === "getComputedStyle" ? dom.window.getComputedStyle.bind(dom.window) : (dom.window[key] ?? dom.window),
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const doc = dom.window.document;

function setValue(el, value) {
  const proto = el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new dom.window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}
function click(el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0 }));
}
function submit(form) {
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
}

const OPTIONS = { api_protocols: ["openai", "openai_responses", "anthropic"], thinking_levels: ["auto", "off", "low", "medium", "high", "max"], ocr_providers: ["mineru", "paddle"], max_workers_limit: 64 };
const EMPTY = {
  source: "environment",
  translation: { model: "", base_url: "", api_protocol: "", thinking: "", max_workers: 0, api_key_configured: false, api_key_hint: "" },
  ocr: { provider: "paddle", token_configured: false, token_hint: "" },
  ready: false,
  missing: ["translation_model", "translation_base_url", "translation_api_key", "ocr_token"],
  updated_at: null,
  updated_by: null,
  options: OPTIONS,
};
const CONFIGURED = {
  ...EMPTY,
  source: "database",
  translation: { model: "deepseek-flash", base_url: "https://api.deepseek.com/v1", api_protocol: "openai", thinking: "off", max_workers: 8, api_key_configured: true, api_key_hint: "…abcd" },
  ocr: { provider: "paddle", token_configured: true, token_hint: "…9z9z" },
  ready: true,
  missing: [],
};

test("表单：选服务带出默认值、自定义保留；密钥留空不提交；没配过的密钥必填；换 OCR 服务必须填新 token；缺项说人话", () => {
  const form = formFromView(EMPTY);
  assert.equal(form.provider, "deepseek", "没配过时默认 DeepSeek");
  const qwen = applyTranslationProvider(form, "qwen");
  assert.equal(qwen.baseUrl, "https://dashscope.aliyuncs.com/compatible-mode/v1");
  assert.equal(qwen.apiProtocol, "openai_responses", "/chat/completions 去掉了，预设走 Responses");
  assert.ok(qwen.model);
  const custom = applyTranslationProvider({ ...qwen, model: "my-model" }, "custom");
  assert.equal(custom.model, "my-model", "自定义保留当前填的");

  assert.equal(platformFormProblem({ ...qwen, apiKey: "" }, EMPTY), "请填写翻译 API Key。");
  assert.equal(platformFormProblem({ ...qwen, apiKey: "sk-1", ocrToken: "" }, EMPTY), "请填写 Paddle Access Token。");
  assert.equal(platformFormProblem({ ...qwen, baseUrl: "api.x.com" }, EMPTY), "翻译接口地址要以 http:// 或 https:// 开头。");
  assert.match(platformFormProblem({ ...qwen, maxWorkers: "65" }, EMPTY), /并发上限要填 0～64/);
  assert.match(platformFormProblem({ ...qwen, maxWorkers: "-1" }, EMPTY), /并发上限/);

  const saved = formFromView(CONFIGURED);
  assert.equal(saved.provider, "deepseek");
  assert.equal(saved.maxWorkers, "8");
  assert.equal(platformFormProblem(saved, CONFIGURED), "", "已配置的密钥可以留空");
  assert.match(platformFormProblem({ ...saved, ocrProvider: "mineru" }, CONFIGURED), /换了 OCR 服务，要同时填 MinerU API Token/);
  assert.equal(platformFormProblem({ ...saved, ocrProvider: "mineru", ocrToken: "t" }, CONFIGURED), "");

  assert.deepEqual(platformInput({ ...saved, apiKey: " ", ocrToken: "" }), {
    translation: { model: "deepseek-flash", base_url: "https://api.deepseek.com/v1", api_protocol: "openai", thinking: "off", max_workers: 8 },
    ocr: { provider: "paddle" },
  }, "留空的密钥不提交");
  assert.equal(platformInput({ ...saved, apiKey: " sk-1 " }).translation.api_key, "sk-1");
  assert.deepEqual(platformTestInput({ ...saved, apiKey: "" }, "translation"), { model: "deepseek-flash", base_url: "https://api.deepseek.com/v1", api_protocol: "openai", api_key: undefined });
  assert.deepEqual(platformTestInput({ ...saved, ocrProvider: "mineru", ocrToken: "t" }, "ocr"), { provider: "mineru", token: "t" });

  assert.equal(isPlatformFormDirty(saved, CONFIGURED), false);
  assert.equal(isPlatformFormDirty({ ...saved, apiKey: "x" }, CONFIGURED), true);
  assert.equal(isPlatformFormDirty({ ...saved, maxWorkers: "4" }, CONFIGURED), true);
  assert.equal(isPlatformFormDirty({ ...saved, thinking: "high" }, CONFIGURED), true);
  assert.equal(secretPlaceholder(true, "…abcd", "Key"), "已配置 …abcd，留空不改");
  assert.equal(secretPlaceholder(false, "", "Key"), "填写Key");
  assert.equal(missingLabel("translation_api_key"), "翻译 API Key");
  assert.equal(missingLabel("other"), "other");
});

test("界面：读回「还缺」、检测只带翻译那一段、保存前校验、保存后状态变可用", async () => {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { AdminPlatformView } = await import("../../src/features/admin/ui/AdminPlatformView.jsx");
  const calls = [];
  const api = {
    get: async () => EMPTY,
    test: async (target, values) => { calls.push(["test", target, values]); return { target, ok: false, status: "network_error", summary: "Key 无效或已过期", hint: "没有收到服务商的回复，和 Key 无关。底层错误：connection reset" }; },
    save: async (input) => {
      calls.push(["save", input]);
      return {
        source: "database",
        translation: { ...input.translation, api_key: undefined, api_key_configured: true, api_key_hint: "…-key" },
        ocr: { provider: input.ocr.provider, token_configured: true, token_hint: "…oken" },
        ready: true, missing: [], updated_at: "2026-10-11T08:00:00Z", updated_by: { user_id: "u-admin", username: "admin" }, options: OPTIONS,
      };
    },
  };
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(AdminPlatformView, { api }));

  const status = await waitFor(() => host.querySelector(".admin-platform-status"), "状态卡");
  assert.equal(status.dataset.ready, "false");
  assert.match(status.textContent, /还缺：翻译模型、翻译接口地址、翻译 API Key、OCR Token。/);
  assert.match(status.textContent, /部署时的环境变量/);

  const [providerSelect] = host.querySelectorAll(".admin-field select");
  setValue(providerSelect, "deepseek");
  const inputs = () => [...host.querySelectorAll(".admin-field input")];
  await waitFor(() => inputs()[0].value === "https://api.deepseek.com/v1", "选 DeepSeek 带出接口地址");

  setValue(inputs()[2], "sk-test-key");
  click(host.querySelector('[data-admin-test-target="translation"]'));
  await waitFor(() => host.querySelector('[data-admin-test="fail"]')?.textContent === "Key 无效或已过期", "检测结果");
  assert.equal(host.querySelector("[data-admin-test-hint]")?.textContent, "没有收到服务商的回复，和 Key 无关。底层错误：connection reset", "补充说明也显示");
  const [, target, values] = calls.find(([name]) => name === "test");
  assert.equal(target, "translation");
  assert.equal(values.base_url, "https://api.deepseek.com/v1", "检测用表单里还没保存的值");
  assert.equal(values.api_key, "sk-test-key");
  assert.equal(values.token, undefined, "只带翻译那一段");

  const form = host.querySelector('[data-admin-form="platform"]');
  submit(form);
  await waitFor(() => host.querySelector(".admin-savebar .auth-error")?.textContent === "请填写 Paddle Access Token。", "OCR Token 必填");
  assert.ok(!calls.some(([name]) => name === "save"));

  setValue(inputs()[4], "ocr-token");
  submit(form);
  await waitFor(() => host.querySelector(".admin-savebar .auth-ok")?.textContent === "已保存，立即生效。", "保存成功");
  const [, saved] = calls.find(([name]) => name === "save");
  assert.equal(saved.translation.base_url, "https://api.deepseek.com/v1");
  assert.equal(saved.translation.api_key, "sk-test-key");
  assert.deepEqual(saved.ocr, { provider: "paddle", token: "ocr-token" });
  await waitFor(() => host.querySelector(".admin-platform-status")?.dataset.ready === "true", "状态变可用");
  assert.match(host.querySelector(".admin-platform-status").textContent, /这里保存的设置.*（admin）/);
  assert.equal(inputs()[2].value, "", "保存后密钥框清空");
  assert.equal(inputs()[2].placeholder, "已配置 …-key，留空不改");
  root.unmount();
});
