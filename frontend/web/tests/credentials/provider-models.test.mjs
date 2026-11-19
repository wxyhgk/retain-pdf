// 设置「翻译 API」的「从服务商拉取模型」：后端代调服务商 /models；默认只列对话模型、可搜、带单价；
// 勾几个、标默认，写回「模型」「其他模型」两栏；不支持、Key 不对就地说原因；没填 Key 不发请求。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { click, makeDom, typeInput } from "../helpers/dom.mjs";

import {
  applyModelSelection,
  initialSelection,
  modelListStatusText,
  modelPriceText,
  visibleModels,
} from "../../src/features/credentials/domain/provider-models.js";

const MODELS = [
  { id: "claude-haiku-5-5", kind: "chat", price: { input: 1, output: 5 } },
  { id: "claude-fable-5-2", kind: "chat", price: null },
  { id: "claude-opus-5-5", kind: "chat", price: { input: 15, output: 75 } },
  { id: "text-embedding-x", kind: "other", price: null },
];

test("拉取结果说成人话：成功说拉到几个；不支持、Key 不对、连不上各一句，带服务商原话", () => {
  assert.deepEqual(modelListStatusText({ ok: true, status: "ok", chat_models: 3, models: MODELS }), { tone: "ok", text: "拉到 3 个对话模型（共 4 个）。" });
  assert.equal(modelListStatusText({ ok: true, status: "ok", chat_models: 1, models: [MODELS[0]] }).text, "拉到 1 个模型。");
  assert.match(modelListStatusText({ ok: false, status: "unsupported", models: [] }).text, /不支持列模型，请在下面手动填/);
  assert.match(modelListStatusText({ ok: false, status: "unauthorized", provider_message: "invalid x-api-key", models: [] }).text, /Key 不对.*（invalid x-api-key）/);
  assert.match(modelListStatusText({ ok: false, status: "unreachable", models: [] }).text, /连不上/);
  assert.equal(modelListStatusText({ ok: true, status: "ok", models: [] }).tone, "error");
});

test("单价按人民币写每百万 token；查不到价是空；默认只列对话模型，可搜", () => {
  assert.equal(modelPriceText(MODELS[0]), "输入 ¥7.16 · 输出 ¥35.8 /百万 token");
  assert.equal(modelPriceText({ price: { input: 0.05, output: 0.4 } }), "输入 ¥0.358 · 输出 ¥2.86 /百万 token");
  assert.equal(modelPriceText(MODELS[1]), "");
  assert.deepEqual(visibleModels(MODELS).map((m) => m.id), ["claude-haiku-5-5", "claude-fable-5-2", "claude-opus-5-5"]);
  assert.equal(visibleModels(MODELS, { showAll: true }).length, 4);
  assert.deepEqual(visibleModels(MODELS, { query: "OPUS" }).map((m) => m.id), ["claude-opus-5-5"]);
});

test("预先勾上现在用的；写回时默认没勾就换成勾的第一个，其余进其他模型；都没勾不改", () => {
  assert.deepEqual(initialSelection(MODELS, { model: "claude-fable-5-2", extras: ["claude-haiku-5-5", "gone-model"] }), ["claude-fable-5-2", "claude-haiku-5-5"]);
  assert.deepEqual(applyModelSelection(["claude-haiku-5-5", "claude-opus-5-5"], "claude-opus-5-5"), { model: "claude-opus-5-5", extras: ["claude-haiku-5-5"] });
  assert.deepEqual(applyModelSelection(["claude-haiku-5-5"], "claude-fable-5-2"), { model: "claude-haiku-5-5", extras: [] });
  assert.equal(applyModelSelection([], "x"), null);
});

async function mountPicker(props) {
  const dom = makeDom("", { keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "HTMLInputElement", "Element", "Event", "MouseEvent", "Node", "MutationObserver"] });
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { ProviderModelPicker } = await import("../../src/features/credentials/ui/ProviderModelPicker.jsx");
  const root = createRoot(container);
  root.render(React.createElement(ProviderModelPicker, props));
  await waitFor(() => dom.window.document.querySelector('[data-provider-model-action="pull"]'), "拉取按钮");
  return { dom, doc: dom.window.document, root };
}

test("拉取面板：用表单里的地址、Key、协议去拉；勾选、设默认、「用这几个」写回；没填 Key 不发请求", async () => {
  const requests = [];
  let applied = null;
  let key = "";
  const { dom, doc, root } = await mountPicker({
    readRequest: () => (key ? { base_url: "https://api.anthropic.com/v1", api_key: key, api_protocol: "anthropic" } : { error: "先填 API Key 再拉。" }),
    readCurrent: () => ({ model: "claude-fable-5-2", extras: [] }),
    onApply: (result) => { applied = result; },
    fetchModels: async (request) => { requests.push(request); return { ok: true, status: "ok", chat_models: 3, models: MODELS }; },
  });
  const pull = () => click(dom, doc.querySelector('[data-provider-model-action="pull"]'));
  pull();
  await waitFor(() => /先填 API Key/.test(doc.body.textContent), "没 Key 先说");
  assert.equal(requests.length, 0);

  key = "sk-test";
  pull();
  await waitFor(() => doc.querySelector('[data-model-id="claude-haiku-5-5"]'), "列出模型");
  assert.deepEqual(requests[0], { base_url: "https://api.anthropic.com/v1", api_key: "sk-test", api_protocol: "anthropic" });
  assert.match(doc.body.textContent, /拉到 3 个对话模型（共 4 个）/);
  assert.equal(doc.querySelector('[data-model-id="text-embedding-x"]'), null, "默认不列非对话模型");
  assert.equal(doc.querySelector('[data-model-id="claude-fable-5-2"]').dataset.checked, "true", "现在用的预先勾上");
  assert.match(doc.querySelector('[data-model-id="claude-haiku-5-5"]').textContent, /输入 ¥7\.16/);

  click(dom, doc.querySelector('[data-model-id="claude-haiku-5-5"] input[type="checkbox"]'));
  click(dom, doc.querySelector('[data-model-id="claude-opus-5-5"] [data-provider-model-action="default"]'));
  await waitFor(() => doc.querySelector('[data-model-id="claude-opus-5-5"]').dataset.checked === "true", "设默认顺便勾上");
  typeInput(dom, doc.querySelector(".credential-model-picker-search"), "haiku");
  await waitFor(() => !doc.querySelector('[data-model-id="claude-opus-5-5"]'), "搜索筛掉");
  click(dom, doc.querySelector('[data-provider-model-action="apply"]'));
  await waitFor(() => applied, "写回");
  assert.deepEqual(applied, { model: "claude-opus-5-5", extras: ["claude-fable-5-2", "claude-haiku-5-5"] });
  assert.match(doc.body.textContent, /点「保存接口」才会存下来/);
  root.unmount();
});

test("拉取面板：服务商不支持列模型时就地说，不出清单", async () => {
  const { doc, dom, root } = await mountPicker({
    readRequest: () => ({ base_url: "https://proxy.example/v1", api_key: "sk", api_protocol: "openai_responses" }),
    readCurrent: () => ({ model: "m", extras: [] }),
    onApply: () => {},
    fetchModels: async () => ({ ok: false, status: "unsupported", models: [] }),
  });
  click(dom, doc.querySelector('[data-provider-model-action="pull"]'));
  await waitFor(() => /不支持列模型/.test(doc.body.textContent), "说原因");
  assert.equal(doc.querySelector(".credential-model-picker-list"), null);
  root.unmount();
});
