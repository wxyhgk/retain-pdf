// 重新翻译换模型：从设置里存的连接（每家服务商一套 key、地址、模型）挑一个；选了就把整套
// （base_url、model、api_key、api_protocol、thinking）放进 overrides.translation，和翻译方式一起带；不选不带。
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { waitFor } from "../helpers/async.mjs";
import { makeDom } from "../helpers/dom.mjs";

import { translationConnectionsFrom } from "../../src/platform/config/translation-connections.js";
import {
  KEEP_MODEL,
  connectionOverrides,
  estimateText,
  retranslateModelOptions,
} from "../../src/features/book-detail/domain/retranslate-model.js";
import { RetranslateModelSelect } from "../../src/features/book-detail/ui/panels/translate/RetranslateModelSelect.jsx";

const CONFIG = {
  translationProfiles: {
    deepseek: { apiKey: "sk-ds", baseUrl: "", model: "deepseek-v4-flash", models: ["deepseek-v4-pro", "deepseek-v4-flash", " "], workers: 50, apiProtocol: "", thinking: "" },
    qwen: { apiKey: "", baseUrl: "", model: "qwen3.8-flash" },
    anthropic: { apiKey: "sk-ant", baseUrl: "https://api.anthropic.com/v1", model: "claude-haiku-5-5", apiProtocol: "anthropic", thinking: "low" },
    custom: { apiKey: "sk-c", baseUrl: "https://llm.example.com/v1", model: "my-model" },
    zhipu: { apiKey: "sk-z", baseUrl: "", model: "" },
  },
};

test("连接：填了 key 和模型的才算，其他模型各一条；官方服务商没存地址用它的官方地址；自定义用主机名当名字", () => {
  const connections = translationConnectionsFrom(CONFIG);
  assert.deepEqual(connections.map((c) => [c.provider, c.label, c.model]).sort(), [
    ["anthropic", "Anthropic", "claude-haiku-5-5"],
    ["custom", "llm.example.com", "my-model"],
    ["deepseek", "DeepSeek", "deepseek-v4-flash"],
    ["deepseek", "DeepSeek", "deepseek-v4-pro"],
  ].sort(), "「其他模型」各算一条，去重、去空");
  const deepseek = connections.find((c) => c.provider === "deepseek");
  assert.equal(deepseek.baseUrl, "https://api.deepseek.com/v1");
  assert.equal(deepseek.apiProtocol, "openai_responses");
  assert.equal(deepseek.thinking, "off");
  assert.equal(connections.find((c) => c.provider === "anthropic").thinking, "low");
  assert.deepEqual(translationConnectionsFrom(null), []);
  assert.deepEqual(translationConnectionsFrom({ translationProfiles: "x" }), []);
});

test("下拉：先「沿用原来的」，原任务在用的那条标出来；选中的换成整套 overrides", () => {
  const connections = translationConnectionsFrom(CONFIG);
  const options = retranslateModelOptions(connections, { baseUrl: "https://api.deepseek.com/v1/", model: "deepseek-v4-flash" });
  assert.equal(options[0].value, KEEP_MODEL);
  assert.equal(options[0].connection, null);
  assert.match(options.find((o) => o.value === "deepseek::deepseek-v4-flash").label, /DeepSeek · deepseek-v4-flash（原来用的）/);
  assert.deepEqual(connectionOverrides(connections.find((c) => c.provider === "anthropic")), {
    base_url: "https://api.anthropic.com/v1",
    model: "claude-haiku-5-5",
    api_key: "sk-ant",
    api_protocol: "anthropic",
    thinking: "low",
  });
  assert.equal(connectionOverrides(null), null);

  const html = renderToStaticMarkup(createElement(RetranslateModelSelect, {
    options, value: "", onChange: () => {}, priceOf: (value) => (value === "custom::my-model" ? "约 ¥1.20–1.80" : ""),
  }));
  assert.match(html, /my-model　约 ¥1\.20–1\.80/);
  assert.equal(renderToStaticMarkup(createElement(RetranslateModelSelect, { options: options.slice(0, 1), value: "", onChange: () => {} })), "", "没有存连接就不画");
});

test("重新翻译带连接：overrides.translation 里翻译方式和整套连接一起带；不选连接只带翻译方式", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useBookDetailStageActions } = await import("../../src/features/book-detail/ui/use-book-detail-stage-actions.js");
  const calls = [];
  let api = null;
  function Probe() {
    api = useBookDetailStageActions({
      open: true,
      job: { job_id: "job-1", status: "succeeded", document_id: "doc-1" },
      actions: {
        getJobStageActions: async () => ({
          job_id: "job-1",
          stages: [{ stage: "translation", label: "重新翻译", can_retry: true, danger: true, action: { body: { stage: "translation" } } }],
        }),
        retryJobStage: async (...args) => {
          calls.push(args);
          return { job_id: "job-1", workflow: "book" };
        },
      },
    });
    return null;
  }
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  root.render(React.createElement(Probe));
  await waitFor(() => api?.stageActions?.length, "读到阶段能力");
  const connection = translationConnectionsFrom(CONFIG).find((c) => c.provider === "custom");
  await api.retry("translation", { acceptDuplicateRisk: true, translationQuality: "terms", translationConnection: connection });
  await waitFor(() => calls.length === 1, "提交");
  assert.deepEqual(calls[0][2].overrides.translation, {
    engine: "legacy", preparation: "terms+style", refine: "off",
    base_url: "https://llm.example.com/v1", model: "my-model", api_key: "sk-c", api_protocol: "openai_responses", thinking: "off",
  });
  await waitFor(() => !api.pendingStage, "提交完");
  await api.retry("translation", { acceptDuplicateRisk: true, translationQuality: "standard" });
  await waitFor(() => calls.length === 2, "第二次");
  assert.deepEqual(calls[1][2].overrides.translation, { engine: "legacy", preparation: "off", refine: "off" });
  root.unmount();
  dom.window.close();
});

test("估价：翻译加精修的人民币区间；按书库平均的注一句；没可参照的用量、查不到价不显示", () => {
  const part = (low, high) => ({ requests: 1, input_tokens: 1, output_tokens: 1, cache_hit_tokens: 0, low_usd: 0, high_usd: 0, low_cny: low, high_cny: high });
  assert.equal(estimateText({ basis: "book_history", translation: part(1.2, 1.8), refine: null }), "约 ¥1.20–1.80");
  assert.equal(estimateText({ basis: "book_history", translation: part(1.2, 1.8), refine: part(0.3, 0.5) }), "约 ¥1.50–2.30");
  assert.equal(estimateText({ basis: "library_average", translation: part(120.4, 180.6), refine: null }), "约 ¥120–181（按书库平均）");
  assert.equal(estimateText({ basis: "book_history", translation: part(0.001, 0.002), refine: null }), "约 ¥<0.01");
  assert.equal(estimateText({ basis: "none", translation: null, refine: null }), "");
  assert.equal(estimateText({ basis: "book_history", translation: part(null, null), refine: null }), "", "查不到价");
  assert.equal(estimateText(null), "");
});

test("重新翻译清单：每条连接问一次估价，写在下拉选项后面、确认框里", async () => {
  const dom = makeDom("", { keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "HTMLSelectElement", "Element", "Event", "MouseEvent", "Node", "MutationObserver"] });
  dom.window.localStorage.setItem("retainpdf.developer.config.v1", JSON.stringify(CONFIG));
  globalThis.localStorage = dom.window.localStorage;
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { TranslationStageActions } = await import("../../src/features/book-detail/ui/panels/translate/TranslationStageActions.jsx");
  const asked = [];
  const estimate = async (baseUrl, model) => {
    asked.push(model);
    if (model === "my-model") return { basis: "none", translation: null, refine: null };
    return { basis: "book_history", translation: { low_cny: 1.2, high_cny: 1.8 }, refine: null };
  };
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  root.render(React.createElement(TranslationStageActions, {
    variant: "sheet",
    stages: ["translation"],
    actions: [{ stage: "translation", label: "重新翻译", can_retry: true, danger: true }],
    onRetry: async () => {},
    estimate,
  }));
  const doc = dom.window.document;
  await waitFor(() => doc.querySelector("[data-retranslate-model-list]"), "模型列表");
  const rowOf = (value) => doc.querySelector(`[data-model-value="${value}"]`);
  await waitFor(() => /约 ¥1\.20–1\.80/.test(rowOf("anthropic::claude-haiku-5-5")?.textContent || ""), "估价写在行尾");
  assert.deepEqual(asked.sort(), ["claude-haiku-5-5", "deepseek-v4-flash", "deepseek-v4-pro", "my-model"]);
  assert.doesNotMatch(rowOf("custom::my-model").textContent, /¥/, "没有可参照的用量不写价");
  // 按服务商分组；第一行「沿用原来的」选中
  assert.deepEqual([...doc.querySelectorAll("[data-model-group]")].map((g) => g.dataset.modelGroup), ["DeepSeek", "Anthropic", "llm.example.com"]);
  assert.equal(rowOf("").getAttribute("aria-checked"), "true");
  // 点一行就选中，确认框里写这次用哪个模型和估价
  rowOf("anthropic::claude-haiku-5-5").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await waitFor(() => rowOf("anthropic::claude-haiku-5-5").getAttribute("aria-checked") === "true", "选中");
  assert.equal(rowOf("").getAttribute("aria-checked"), "false");
  root.unmount();
  delete globalThis.localStorage;
  dom.window.close();
});

test("换一本书：重新翻译的模型选择回到「沿用原来的」，不带上一本书选的；沿用那行写出这本书现在用的模型", async () => {
  const dom = makeDom("", { keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "HTMLSelectElement", "Element", "Event", "MouseEvent", "Node", "MutationObserver", "CustomEvent"] });
  dom.window.localStorage.setItem("retainpdf.developer.config.v1", JSON.stringify(CONFIG));
  globalThis.localStorage = dom.window.localStorage;
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { stationActionsOf } = await import("../../src/features/book-detail/ui/tabs/processing-station-actions.jsx");
  const submitted = [];
  function Sheet({ item, currentModel }) {
    const actions = stationActionsOf({
      ocr: {},
      translation: {
        item,
        stageActions: [{ stage: "translation", label: "重新翻译", can_retry: true }],
        onRetryStage: async (stage, options) => { submitted.push([item.document_id, options]); },
      },
      translationStopped: false,
      currentModel,
    });
    return actions.translate.content;
  }
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  const doc = dom.window.document;
  const rowOf = (value) => doc.querySelector(`[data-model-value="${value}"]`);
  root.render(React.createElement(Sheet, { item: { document_id: "doc-a", job_id: "job-a" }, currentModel: "deepseek-v4-flash" }));
  await waitFor(() => rowOf("anthropic::claude-haiku-5-5"), "书 A 的模型列表");
  assert.match(rowOf("").textContent, /沿用原来的模型（deepseek-v4-flash）/);
  assert.match(rowOf("deepseek::deepseek-v4-flash").textContent, /原来用的/);
  rowOf("anthropic::claude-haiku-5-5").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await waitFor(() => rowOf("anthropic::claude-haiku-5-5").getAttribute("aria-checked") === "true", "书 A 选了 haiku");

  root.render(React.createElement(Sheet, { item: { document_id: "doc-b", job_id: "job-b" }, currentModel: "qwen3.8-flash" }));
  await waitFor(() => /沿用原来的模型（qwen3\.8-flash）/.test(rowOf("")?.textContent || ""), "换到书 B");
  assert.equal(rowOf("").getAttribute("aria-checked"), "true", "书 B 回到沿用原来的");
  assert.equal(rowOf("anthropic::claude-haiku-5-5").getAttribute("aria-checked"), "false");
  doc.querySelector("#book-detail-retry-translation-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await waitFor(() => submitted.length === 1, "书 B 提交");
  assert.equal(submitted[0][0], "doc-b");
  assert.equal(submitted[0][1]?.translationConnection, undefined, "书 B 不带书 A 选的模型");

  // 设置一保存，列表就重读（不用关书详情）
  dom.window.localStorage.setItem("retainpdf.developer.config.v1", JSON.stringify({ translationProfiles: { qwen: { apiKey: "sk-q", model: "qwen3.8-flash" } } }));
  doc.dispatchEvent(new dom.window.CustomEvent("retainpdf:credentials-changed"));
  await waitFor(() => rowOf("qwen::qwen3.8-flash") && !rowOf("anthropic::claude-haiku-5-5"), "设置改了列表跟着变");
  root.unmount();
  delete globalThis.localStorage;
  dom.window.close();
});
