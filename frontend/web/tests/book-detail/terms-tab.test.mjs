// 「术语」页签：通用词默认不显示、按处理方式筛、搜索；冲突和风格规则；风格指南没生成要提醒。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { clickWithMouseDown, makeDom as makeDomWith } from "../helpers/dom.mjs";
import { filterTerms, termCounts, termRows } from "../../src/features/book-detail/domain/terms-model.js";

const RAW = [
  { source: "fiber", target: "纤程", category: "technical", treatment: "lock", frequency: 231, conflict_candidates: [{ target: "纤体", votes: 6 }] },
  { source: "the", target: "", category: "common", treatment: "drop", frequency: 900 },
  { source: "Haskell", target: "Haskell", category: "technical", treatment: "keep_original", frequency: 12 },
  { source: "effect", target: "效应", category: "technical", treatment: "free", frequency: 80 },
];

test("术语模型：「全部」不含通用词，按出现次数排；搜索原文和译文都算", () => {
  const rows = termRows(RAW);
  assert.deepEqual(termCounts(rows), { all: 3, lock: 1, keep_original: 1, free: 1, drop: 1 });
  assert.deepEqual(filterTerms(rows).map((r) => r.source), ["fiber", "effect", "Haskell"]);
  assert.deepEqual(filterTerms(rows, { treatment: "drop" }).map((r) => r.source), ["the"]);
  assert.deepEqual(filterTerms(rows, { search: "效应" }).map((r) => r.source), ["effect"]);
  assert.deepEqual(filterTerms(rows, { search: "FIB" }).map((r) => r.source), ["fiber"]);
});

test("术语页签：显示领域、术语、冲突、风格规则；点「通用词」才看到通用词", async () => {
  const dom = makeDomWith("", {
    html: "<!doctype html><html><body><div id='root'></div></body></html>",
    keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "HTMLInputElement", "Element", "Event", "MouseEvent", "Node", "MutationObserver"],
  });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { BookDetailTermsTab } = await import("../../src/features/book-detail/ui/tabs/BookDetailTermsTab.jsx");
  const asked = [];
  const load = async (jobId, dataset) => {
    asked.push(dataset);
    const rows = { terms: RAW, term_conflicts: [{ source: "fiber", target: "纤程", conflict_candidates: [{ target: "纤体", votes: 6 }, { target: "纤", votes: 2 }] }], style_rules: [{ id: "r1", rule: "术语首次出现加括注。", example: "卷积神经网络（CNN）" }] }[dataset];
    if (rows) return { kind: "rows", available: true, total: rows.length, rows };
    const object = { style_guide: { llm_status: "failed" }, domain_context: { domain: "编程语言理论", summary: "讨论效应系统。", translation_guidance: "术语一致。" } }[dataset];
    return { kind: "object", available: true, total: 1, object };
  };
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(BookDetailTermsTab, { jobId: "job-1", load }));
  const doc = dom.window.document;
  await waitFor(() => doc.querySelector("[data-book-detail-tab='terms']"), "术语页签");
  assert.deepEqual(asked.sort(), ["domain_context", "style_guide", "style_rules", "term_conflicts", "terms"]);
  assert.match(doc.querySelector(".book-detail-terms-domain").textContent, /编程语言理论/);
  const sources = () => [...doc.querySelectorAll(".book-detail-terms-list [data-term-source]")].map((li) => li.dataset.termSource);
  assert.deepEqual(sources(), ["fiber", "effect", "Haskell"]);
  assert.match(doc.querySelector('[data-term-source="Haskell"]').textContent, /保留原文/);
  clickWithMouseDown(dom, doc.querySelector('[data-terms-filter="drop"]'));
  await waitFor(() => sources().join() === "the", "切到通用词");
  assert.match(doc.querySelector(".book-detail-terms-conflicts").textContent, /纤体 6 · 纤 2/);
  assert.match(doc.querySelector(".book-detail-terms-rules").textContent, /风格指南没生成成功/);
  root.unmount();
});
