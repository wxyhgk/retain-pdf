// 书籍详情的「用量」卡、设置的「总用量」：显示、失败重试、说明。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { clickWithMouseDown, makeDom as makeDomWith } from "../helpers/dom.mjs";

const makeDom = () => makeDomWith("", {
  html: "<!doctype html><html><body><div id='root'></div></body></html>",
  keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "Element", "SVGElement", "Event", "MouseEvent", "Node", "MutationObserver"],
});

const bucket = (total, extra = {}) => ({
  requests: 10, requests_without_usage: 0, input_tokens: Math.round(total * 0.75), output_tokens: Math.round(total * 0.25),
  total_tokens: total, cache_hit_tokens: 0, cache_reported_input_tokens: 0, cache_write_tokens: 0, reasoning_tokens: 0, ...extra,
});
const summary = (scope) => ({
  scope,
  totals: bucket(5_470_000),
  by_stage: [{ stage: "translation", label: "翻译", group: "translation", ...bucket(5_470_000) }],
  by_model: [{ model: "qwen3.8-flash", host: "dashscope.aliyuncs.com", ...bucket(5_470_000) }],
  by_month: [{ month: "2026-09", ...bucket(1_296_000) }, { month: "2026-10", ...bucket(4_174_000) }],
  jobs_counted: 29, jobs_estimated_from_reports: 29, first_at: null, last_at: null,
});

test("书籍「用量」卡：读失败给中文和重试，重试后显示合计与说明", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { BookUsageCard } = await import("../../src/features/usage/ui/BookUsageCard.jsx");
  let calls = 0;
  const load = async (documentId) => {
    calls += 1;
    assert.equal(documentId, "doc-1");
    if (calls === 1) throw new Error("连不上后端");
    return summary("document");
  };
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(BookUsageCard, { documentId: "doc-1", load }));
  const doc = dom.window.document;

  const retry = await waitFor(() => doc.querySelector(".usage-retry"), "失败后有重试");
  assert.match(doc.querySelector("[role=alert]").textContent, /连不上后端/);
  clickWithMouseDown(dom, retry);
  const total = await waitFor(() => doc.querySelector('[data-usage-metric="total"] dd'), "合计");
  assert.equal(total.textContent, "547.0 万");
  assert.equal(total.getAttribute("title"), "5,470,000 token");
  assert.equal(doc.querySelector('[data-usage-metric="cache"] dd').textContent, "未报");
  assert.match(doc.querySelector(".usage-notes").textContent, /按当时的报告折算/);
  assert.ok(doc.querySelector('[data-usage-section="stages"]'), "书籍卡显示按环节");
  assert.equal(doc.querySelector('[data-usage-section="months"]'), null, "书籍卡不显示按月");
  root.unmount();
});

test("设置「总用量」：按月、按模型，并说明删除的书不计入", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { UsageSettingsPanel } = await import("../../src/features/usage/ui/UsageSettingsPanel.jsx");
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(UsageSettingsPanel, { load: async () => summary("all") }));
  const doc = dom.window.document;

  await waitFor(() => doc.querySelector('[data-usage-section="months"]'), "按月");
  const months = [...doc.querySelectorAll('[data-usage-section="months"] .usage-bar-row')].map((row) => row.textContent);
  assert.deepEqual(months, ["2026 年 9 月129.6 万", "2026 年 10 月417.4 万"]);
  assert.match(doc.querySelector('[data-usage-section="models"]').textContent, /qwen3\.8-flash/);
  assert.match(doc.querySelector(".usage-settings-sub").textContent, /计入 29 个任务/);
  assert.match(doc.querySelector(".usage-settings-foot").textContent, /删除的书不计入/);
  root.unmount();
});
