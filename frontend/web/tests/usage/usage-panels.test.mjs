// 书籍详情「进度」页的用量（UsageCompact）、设置的「总用量」：显示、失败重试、说明。
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

test("书籍「进度」页的用量：读失败给中文和重试，重试后一排图标数字、按环节条形和说明", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { UsageCompact } = await import("../../src/features/usage/ui/UsageCompact.jsx");
  const { useUsage } = await import("../../src/features/usage/ui/use-usage.js");
  const { usageViewModel } = await import("../../src/features/usage/domain/usage-view-model.js");
  let calls = 0;
  const load = async () => {
    calls += 1;
    if (calls === 1) throw new Error("连不上后端");
    return summary("document");
  };
  function Harness() {
    const state = useUsage("doc-1", load);
    return React.createElement(UsageCompact, {
      model: usageViewModel(state.data), loading: state.loading, error: state.error, onRetry: state.reload,
    });
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Harness));
  const doc = dom.window.document;

  const retry = await waitFor(() => [...doc.querySelectorAll("button")].find((b) => b.textContent === "重试"), "失败后有重试");
  assert.match(doc.querySelector("[role=alert]").textContent, /连不上后端/);
  clickWithMouseDown(dom, retry);
  const total = await waitFor(() => doc.querySelector('[data-usage-metric="total"]'), "合计");
  assert.match(total.textContent, /547\.0 万/);
  assert.match(total.getAttribute("title"), /合计 · 5,470,000 token/, "精确值在悬停里");
  assert.match(doc.querySelector('[data-usage-metric="cache"]').textContent, /未报/);
  assert.equal(doc.querySelector('[data-usage-metric="reasoning"]'), null, "思考为 0 不摆");
  assert.match(doc.querySelector(".usage-compact-note").textContent, /按当时的报告折算/);
  assert.ok(doc.querySelector('[data-usage-section="stages"] [data-usage-group]'), "按环节一行一条");
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

test("进度页读这一次任务的用量（GET /jobs/:id/reports/usage），不读整本书的合计；没有任务编号不读", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useJobUsage } = await import("../../src/features/usage/ui/use-usage.js");
  const previousFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    requested.push(`${input?.url ?? input}`);
    return new Response(JSON.stringify({ code: 0, data: { ...summary("job"), jobs_counted: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  let seen = null;
  function Harness({ jobId }) {
    const state = useJobUsage(jobId);
    seen = state;
    return null;
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  try {
    root.render(React.createElement(Harness, { jobId: "" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(requested.length, 0, "没有任务编号不读");
    root.render(React.createElement(Harness, { jobId: "20261119143624-4c7fd3" }));
    await waitFor(() => seen?.data, "读到");
    assert.equal(requested.length, 1);
    assert.match(requested[0], /\/jobs\/20261119143624-4c7fd3\/reports\/usage$/);
    assert.equal(seen.data.scope, "job");
  } finally {
    root.unmount();
    globalThis.fetch = previousFetch;
  }
});

test("概览的「花费」是全书累计：读这本书的用量，小字写「全书累计 N 个任务」，和进度页的「这一次」分开", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { DocumentCostFact } = await import("../../src/features/usage/ui/DocumentCostFact.jsx");
  const previousFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    requested.push(`${input?.url ?? input}`);
    const data = { ...summary("document"), jobs_counted: 10, totals: bucket(10_402_000, { estimated_cost_usd: 2.176 }) };
    return new Response(JSON.stringify({ code: 0, data }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const root = createRoot(dom.window.document.getElementById("root"));
  try {
    root.render(React.createElement("dl", null, React.createElement(DocumentCostFact, { open: true, documentId: "doc-1", jobs: [] })));
    const fact = await waitFor(() => dom.window.document.querySelector('[data-book-detail-fact="cost"]'), "花费");
    assert.equal(fact.querySelector("dt").textContent, "花费");
    assert.match(fact.querySelector("[data-usage-cost='total']").textContent, /约 ¥15\.58/);
    assert.equal(fact.querySelector("small").textContent, "全书累计 10 个任务，按标价估算");
    assert.match(requested[0], /\/documents\/doc-1\/usage$/);
  } finally {
    root.unmount();
    globalThis.fetch = previousFetch;
  }
});

test("设置「总用量」后端很慢：再打开先显示上一次的数字、写「正在更新…」，读好换上；同一时间只发一个请求", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { UsageSettingsPanel } = await import("../../src/features/usage/ui/UsageSettingsPanel.jsx");
  const { resetRememberedUsage } = await import("../../src/features/usage/ui/use-usage.js");
  resetRememberedUsage();
  const doc = dom.window.document;
  let calls = 0;
  const pending = [];
  const load = () => {
    calls += 1;
    return new Promise((resolve) => pending.push(resolve));
  };
  const first = summary("all");
  const second = { ...summary("all"), jobs_counted: 30 };

  // 第一次：没有记住的，等着读；两个面板同时开也只发一个请求。
  const host = doc.getElementById("root");
  const extra = doc.createElement("div");
  doc.body.appendChild(extra);
  const rootA = createRoot(host);
  const rootB = createRoot(extra);
  rootA.render(React.createElement(UsageSettingsPanel, { load }));
  rootB.render(React.createElement(UsageSettingsPanel, { load }));
  await waitFor(() => /正在读取用量/.test(host.textContent), "第一次显示正在读取");
  assert.equal(calls, 1, "同一份正在读，不发第二个请求");
  pending.shift()(first);
  await waitFor(() => /计入 29 个任务/.test(host.textContent), "读好显示");
  rootA.unmount();
  rootB.unmount();

  // 再打开：马上是上一次的数字，后面写「正在更新…」；读好换成新的。
  const rootC = createRoot(host);
  rootC.render(React.createElement(UsageSettingsPanel, { load }));
  await waitFor(() => doc.querySelector("[data-usage-refreshing]"), "正在更新");
  assert.match(host.textContent, /计入 29 个任务/, "先显示上一次的");
  // 重读在 effect 里发：先显示、后发请求，机器忙时两者之间有空档。
  await waitFor(() => calls === 2 && pending.length === 1, "后台重读");
  pending.shift()(second);
  await waitFor(() => /计入 30 个任务/.test(host.textContent), "换成新的");
  assert.equal(doc.querySelector("[data-usage-refreshing]"), null);
  rootC.unmount();
  extra.remove();
  resetRememberedUsage();
});
