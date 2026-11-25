// 质量页「改译」：看原文、改译文或让模型重翻、保存；改几段以后点一次「重新排版」。
// 后端：GET / PATCH /jobs/:id/translations/:item_id、POST …/replay（契约 translation-revisions.v1）。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { makeDom as makeDomWith } from "../helpers/dom.mjs";
import {
  editableTranslation,
  issueText,
  replayOutcome,
} from "../../src/features/book-detail/domain/translation-edit-model.js";

test("编辑框优先放 protected_translated_text（PATCH 要的写法），没有才用 translated_text", () => {
  assert.deepEqual(
    editableTranslation({ source_text: "Let $x$ be", translated_text: "设 x 为", protected_translated_text: "设 $x$ 为" }),
    { source: "Let $x$ be", translated: "设 $x$ 为" },
  );
  assert.deepEqual(editableTranslation({ source_text: "A", translated_text: "甲" }), { source: "A", translated: "甲" });
  assert.deepEqual(editableTranslation(null), { source: "", translated: "" });
});

test("重翻的结果：有新译文就填；模型判断保留原文、没翻出来都不动编辑框", () => {
  assert.deepEqual(replayOutcome({ candidate: { translated_text: "新译文", decision: "translate" } }), { kind: "candidate", text: "新译文" });
  assert.deepEqual(replayOutcome({ candidate: { translated_text: "", decision: "keep_origin" } }), { kind: "keep_origin" });
  const failed = replayOutcome({ candidate: null, payload: { replay_error: { type: "timeout", message: "upstream timed out" } } });
  assert.equal(failed.kind, "failed");
  assert.match(failed.message, /upstream timed out/);
  assert.equal(replayOutcome(null).kind, "failed");
});

test("校验问题说成人话，后端原话跟在后面", () => {
  assert.equal(issueText({ kind: "math_delimiter_unbalanced", message: "unbalanced $" }), "公式的 $ 或括号不成对（unbalanced $）");
  assert.equal(issueText({ kind: "empty_translation" }), "译文是空的");
  assert.equal(issueText({ kind: "something_new", message: "x" }), "something_new（x）");
});

async function mountPanel({ revise, replay, onRerender }) {
  const dom = makeDomWith("", {
    html: "<!doctype html><html><body><div id='root'></div></body></html>",
    keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "HTMLInputElement", "HTMLTextAreaElement", "Element", "SVGElement", "Event", "MouseEvent", "KeyboardEvent", "FocusEvent", "Node", "MutationObserver", "NodeFilter", "CustomEvent", "DocumentFragment"],
  });
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QualityPanel } = await import("../../src/features/book-detail/ui/panels/overview/QualityPanel.jsx");
  const mocks = await import("../../src/platform/api/mocks/quality.js");
  const jobData = await import("../../src/platform/api/mocks/job-data.js");
  const { createQualityListLoader } = await import("../../src/features/book-detail/ui/quality-list-loader.js");
  const calls = { load: [], revise: [], replay: [] };
  const editPorts = {
    load: async (jobId, itemId) => { calls.load.push([jobId, itemId]); return { item: { source_text: "Isolation realms provide …", translated_text: "隔离境界提供……", protected_translated_text: "隔离境界提供……" } }; },
    replay: async (jobId, itemId) => { calls.replay.push([jobId, itemId]); return replay(); },
    revise: async (jobId, itemId, body) => { calls.revise.push([jobId, itemId, body]); return revise(body); },
  };
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(QualityPanel, {
    jobId: "job-render-tail",
    documentId: "doc-1",
    translationJobId: "job-owner",
    onRerender,
    loadSummary: mocks.fetchQualitySummary,
    loadItems: createQualityListLoader(jobData.fetchJobData),
    editPorts,
  }));
  const doc = dom.window.document;
  const click = (el) => el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  const type = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  };
  await waitFor(() => doc.querySelector('[data-quality-row="layout"] [data-quality-toggle="layout"]'), "排版一行");
  doc.querySelector('[data-quality-row="layout"] [data-quality-toggle="layout"]').dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true }));
  click(doc.querySelector('[data-quality-row="layout"] [data-quality-toggle="layout"]'));
  await waitFor(() => doc.querySelector('[data-quality-edit="p012-b004"]'), "明细里的「改译」");
  return { dom, doc, root, calls, click, type, cleanup: () => { root.unmount(); delete globalThis.getComputedStyle; } };
}

test("改译：读的是持有译文的任务；重翻填进框里；保存带 source=user；之后「重新排版」走同一条路", async () => {
  let rerenders = 0;
  const view = await mountPanel({
    replay: () => ({ candidate: { translated_text: "隔离领域提供……", decision: "translate" }, payload: {} }),
    revise: (body) => ({ changed: true, generation: 249, item: { translated_text: body.translated_text } }),
    onRerender: async () => { rerenders += 1; return { job_id: "job-owner" }; },
  });
  const { doc, calls, click } = view;
  try {
    click(doc.querySelector('[data-quality-edit="p012-b004"]'));
    const textarea = await waitFor(() => doc.querySelector("#book-detail-edit-translation-text"), "编辑窗口");
    await waitFor(() => textarea.value === "隔离境界提供……", "填好原来的译文");
    assert.deepEqual(calls.load, [["job-owner", "p012-b004"]], "要读持有译文的任务，不是链尾的重新渲染任务");
    assert.match(doc.querySelector("[data-edit-translation-source]").textContent, /Isolation realms/);
    assert.equal(doc.querySelector("#book-detail-edit-translation-save").disabled, true, "没改不能保存");

    click(doc.querySelector("#book-detail-edit-translation-replay"));
    await waitFor(() => doc.querySelector("#book-detail-edit-translation-text").value === "隔离领域提供……", "重翻的结果填进框里");
    assert.deepEqual(calls.revise, [], "重翻不写回");

    click(doc.querySelector("#book-detail-edit-translation-save"));
    await waitFor(() => !doc.querySelector("#book-detail-edit-translation-text"), "保存后窗口关掉");
    assert.deepEqual(calls.revise[0].slice(0, 2), ["job-owner", "p012-b004"]);
    assert.equal(calls.revise[0][2].translated_text, "隔离领域提供……");
    assert.equal(calls.revise[0][2].source, "user");
    assert.equal(calls.revise[0][2].expected_generation, undefined, "第一次不知道 generation，不带");
    const banner = await waitFor(() => doc.querySelector("[data-quality-edited]"), "已改提示");
    assert.match(banner.textContent, /已改 1 段/);

    click(doc.querySelector("#book-detail-quality-rerender"));
    await waitFor(() => /已提交重新排版/.test(doc.querySelector("[data-quality-edited]")?.textContent || ""), "提交重新排版");
    assert.equal(rerenders, 1);

    // 第二次保存带上上一次的 generation，防止和别处的写回冲突。
    click(doc.querySelector('[data-quality-edit="p012-b004"]'));
    const again = await waitFor(() => doc.querySelector("#book-detail-edit-translation-text"), "再开编辑窗口");
    await waitFor(() => again.value === "隔离境界提供……", "读回译文");
    view.type(again, "隔离领域提供了……");
    await waitFor(() => !doc.querySelector("#book-detail-edit-translation-save").disabled, "改了才能保存");
    click(doc.querySelector("#book-detail-edit-translation-save"));
    await waitFor(() => calls.revise.length === 2, "第二次保存");
    assert.equal(calls.revise[1][2].expected_generation, 249);
  } finally {
    view.cleanup();
  }
});

test("改译：没通过检查时不关窗口，列出原因", async () => {
  const view = await mountPanel({
    replay: () => ({ candidate: null, payload: {} }),
    revise: () => { throw Object.assign(new Error("新译文没通过检查，没有保存。"), { status: 400, reason: "validation_failed", issues: [{ kind: "math_delimiter_unbalanced", severity: "error", message: "unbalanced $" }, { kind: "english_residue", severity: "warning" }] }); },
    onRerender: async () => null,
  });
  const { doc, click } = view;
  try {
    click(doc.querySelector('[data-quality-edit="p012-b004"]'));
    const textarea = await waitFor(() => doc.querySelector("#book-detail-edit-translation-text"), "编辑窗口");
    await waitFor(() => textarea.value === "隔离境界提供……", "填好原来的译文");
    view.type(textarea, "隔离领域 $x 提供……");
    await waitFor(() => !doc.querySelector("#book-detail-edit-translation-save").disabled, "改了才能保存");
    click(doc.querySelector("#book-detail-edit-translation-save"));
    const issues = await waitFor(() => doc.querySelector("[data-edit-translation-issues]"), "列出原因");
    assert.match(issues.textContent, /公式的 \$ 或括号不成对/);
    assert.doesNotMatch(issues.textContent, /英文/, "warning 不拦保存，不列");
    assert.match(doc.body.textContent, /新译文没通过检查/);
    assert.ok(doc.querySelector("#book-detail-edit-translation-text"), "窗口不关");
    assert.equal(doc.querySelector("[data-quality-edited]"), null, "没存成就不算改过");
  } finally {
    view.cleanup();
  }
});
