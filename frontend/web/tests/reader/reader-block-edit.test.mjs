// 阅读页「改译文」：悬停框里的「改」→ 侧栏读这一段（阅读页块号对到译文条目号）→ 改了保存（PATCH，不排版）→
// PDF 上先盖着新译文、顶上「改了 N 处，还没排进 PDF · 重新排版」；修订历史能「用这版」回去；
// 拼出来的书、正在处理的书不能改。
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { waitFor } from "../helpers/async.mjs";
import { click, makeDom, typeInput } from "../helpers/dom.mjs";

import {
  isMergedReadingJob,
  jobRenderedAt,
  pageOfReaderItem,
  pendingEditsFromRevisions,
  revisionHistory,
  revisionIssueTexts,
  translationItemIdCandidates,
} from "../../../../frontend/packages/reader/src/shared/data/block-edit.ts";
import { editableBlockIds } from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderBlockEditPanel.tsx";
import { ReaderTextHoverLayer } from "../../../../frontend/packages/reader/src/pdf/ReaderTextHoverLayer.tsx";

const REVISIONS = {
  data: {
    rows: [
      { item_id: "p003-b002", reader_item_id: "p003-b0002", ts: "2026-11-19T06:10:00Z", source: "user", reason: "顺一下", previous_text: "精修过的", new_text: "手改的" },
      { item_id: "p003-b002", reader_item_id: "p003-b0002", ts: "2026-11-18T01:00:00Z", source: "refine", reason: "", previous_text: "初译", new_text: "精修过的" },
    ],
  },
};

test("改译文模型：块号的几种写法、页码、拼出来的书、排版时间", () => {
  assert.deepEqual(translationItemIdCandidates("p012-b0005"), ["p012-b0005", "p012-b005", "p012-b5"]);
  assert.deepEqual(translationItemIdCandidates("p012-b1234"), ["p012-b1234"]);
  assert.deepEqual(translationItemIdCandidates("odd"), ["odd"]);
  assert.equal(pageOfReaderItem("p012-b0005"), 12);
  assert.equal(pageOfReaderItem("x"), 0);
  assert.equal(isMergedReadingJob("merged-abc-123"), true);
  assert.equal(isMergedReadingJob("job-1"), false);
  assert.equal(jobRenderedAt({ timestamps: { finished_at: "2026-11-19T06:00:00Z" } }), "2026-11-19T06:00:00Z");
  assert.equal(jobRenderedAt({ data: { finished_at: "2026-11-19T06:00:00Z" } }), "2026-11-19T06:00:00Z");
  assert.equal(jobRenderedAt(null), "");
});

test("改译文模型：修订历史新的在前、最后是初译；排版以后才写回的算待排版", () => {
  const history = revisionHistory(REVISIONS);
  assert.deepEqual(history.map((entry) => [entry.label, entry.text]), [["手改", "手改的"], ["精修", "精修过的"], ["初译", "初译"]]);
  assert.equal(history[0].reason, "顺一下");
  assert.deepEqual(revisionHistory({ data: { rows: [] } }), []);

  const pending = pendingEditsFromRevisions(REVISIONS, "2026-11-19T06:00:00Z");
  assert.deepEqual([...pending], [["p003-b0002", "手改的"]]);
  assert.equal(pendingEditsFromRevisions(REVISIONS, "2026-11-19T07:00:00Z").size, 0);
  assert.equal(pendingEditsFromRevisions(REVISIONS, "").size, 0, "不知道 PDF 什么时候排的，就不猜");

  assert.deepEqual(
    revisionIssueTexts([
      { kind: "math_delimiter_unbalanced", severity: "error", message: "unbalanced $" },
      { kind: "english_residue", severity: "warning", message: "x" },
    ]),
    ["公式的 $ 或括号不成对（unbalanced $）"],
  );
});

test("改译文模型：上一段 / 下一段只走正文、公式、表格，去重、保持阅读顺序", () => {
  const region = (itemId, regionType) => ({ itemId, regionType, source: null, translated: null, markdown: "", status: "", assetIds: [], assetUrls: [] });
  assert.deepEqual(
    editableBlockIds([region("p001-b0001", "text"), region("p001-b0002", "image"), region("p001-b0003", "table"), region("p001-b0001", "text"), region("p002-b0001", "text")]),
    ["p001-b0001", "p001-b0003", "p002-b0001"],
  );
});

test("悬停框：译文栏给了 onEdit 才有「改」，原文栏没有", () => {
  const target = {
    itemId: "p001-b0003",
    rect: { left: 10, top: 10, width: 300, height: 80 },
    highlight: {
      itemId: "p001-b0003",
      region: { itemId: "p001-b0003", regionType: "text", source: { text: "src" }, translated: { text: "译" }, markdown: "译", status: "", assetIds: [], assetUrls: [] },
      box: { page: 1, bbox: [0, 0, 1, 1], unit: "pdf_point", origin: "top_left", text: "译" },
      pageSize: { page: 1, width: 600, height: 800 },
    },
  };
  const onEdit = () => {};
  assert.match(renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target, pane: "translated", onEdit })), /reader-text-hover-edit[^>]*>改</);
  assert.doesNotMatch(renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target, pane: "translated" })), /reader-text-hover-edit/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target, pane: "source", onEdit })), /reader-text-hover-edit/);
});

function fakeEdit(port, overrides = {}) {
  const saved = [];
  let rerenders = 0;
  return {
    saved,
    get rerenders() { return rerenders; },
    edit: {
      available: true,
      blockedReason: "",
      port,
      ownerJobId: "job-1",
      target: { itemId: "p003-b0002", page: 3 },
      select: () => {},
      pendingEdits: new Map([["p001-b0001", "别处改的"]]),
      savedCounts: new Map(),
      markSaved: (itemId, text) => saved.push([itemId, text]),
      rerender: { phase: "idle" },
      startRerender: async () => { rerenders += 1; },
      ...overrides,
    },
  };
}

async function mountPanel(edit) {
  const dom = makeDom("", { keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLFormElement", "Element", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver"] });
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { ReaderBlockEditPanel } = await import("../../../../frontend/packages/reader/src/components/react-pdf/ReaderBlockEditPanel.tsx");
  const root = createRoot(container);
  const render = (next) => root.render(React.createElement(ReaderBlockEditPanel, { open: true, onClose: () => {}, edit: next, regions: [], jumpToBlock: () => {} }));
  render(edit);
  return { dom, doc: dom.window.document, root, render };
}

test("改译文面板：块号对不上四位就试三位；改了保存走 PATCH（source=user、带原因），不排版；顶上能点重新排版", async () => {
  const calls = [];
  let history = { data: { rows: [] } };
  const port = {
    resolveOwnerJobId: async (id) => id,
    loadItem: async (jobId, itemId) => {
      calls.push(["load", jobId, itemId]);
      if (itemId === "p003-b0002") throw Object.assign(new Error("找不到"), { status: 404, reason: "" });
      return { item: { source_text: "The coroner arrived.", protected_translated_text: "验尸官来了。" } };
    },
    revise: async (jobId, itemId, body) => {
      calls.push(["revise", jobId, itemId, body]);
      history = { data: { rows: [{ ts: "2026-11-19T06:10:00Z", source: "user", reason: body.reason, previous_text: "验尸官来了。", new_text: body.translated_text }] } };
      return { generation: 7, changed: true };
    },
    fetchRevisions: async (jobId, readerItemId) => { calls.push(["history", jobId, readerItemId]); return history; },
    rerender: async () => {},
  };
  const fake = fakeEdit(port);
  const { dom, doc, root } = await mountPanel(fake.edit);
  const text = await waitFor(() => doc.querySelector("#reader-block-edit-text"), "编辑框");
  assert.equal(text.value, "验尸官来了。");
  assert.match(doc.querySelector("[data-block-edit-source]").textContent, /coroner/);
  assert.deepEqual(calls.filter((c) => c[0] === "load").map((c) => c[2]), ["p003-b0002", "p003-b002"]);
  assert.match(doc.querySelector("[data-block-edit-pending]").textContent, /改了 1 处，还没排进 PDF/);

  typeInput(dom, text, "验尸官到了。");
  typeInput(dom, doc.querySelector(".reader-block-edit-reason"), "更自然");
  doc.querySelector(".reader-block-edit-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(() => fake.saved.length === 1, "存好");
  const revise = calls.find((c) => c[0] === "revise");
  assert.deepEqual(revise.slice(1), ["job-1", "p003-b002", { translated_text: "验尸官到了。", source: "user", reason: "更自然" }]);
  assert.deepEqual(fake.saved[0], ["p003-b0002", "验尸官到了。"]);
  await waitFor(() => /重新排版/.test(doc.querySelector(".reader-block-edit-status")?.textContent || ""), "提示要排版");
  // 存完重读历史：初译那一版能「用这版」回去，下一次保存带上 generation 防冲突
  await waitFor(() => doc.querySelector('[data-block-edit-history="初译"] [data-block-edit-action="restore"]'), "初译可以用回去");
  click(dom, doc.querySelector('[data-block-edit-history="初译"] [data-block-edit-action="restore"]'));
  await waitFor(() => calls.filter((c) => c[0] === "revise").length === 2, "用这版");
  const restore = calls.filter((c) => c[0] === "revise")[1];
  assert.equal(restore[3].translated_text, "验尸官来了。");
  assert.equal(restore[3].expected_generation, 7);
  assert.match(restore[3].reason, /初译/);

  click(dom, doc.querySelector('[data-block-edit-action="rerender"]'));
  await waitFor(() => fake.rerenders === 1, "重新排版");
  root.unmount();
});

test("改译文面板：保存没过检查就地列出原因；不能改时说原因、框是灰的；没选块时教怎么选", async () => {
  const port = {
    resolveOwnerJobId: async (id) => id,
    loadItem: async () => ({ item: { source_text: "x = $a$", protected_translated_text: "x 等于 $a$" } }),
    revise: async () => {
      throw Object.assign(new Error("新译文没通过检查，没有保存。"), {
        status: 422,
        reason: "validation_failed",
        issues: [{ kind: "math_delimiter_unbalanced", severity: "error", message: "" }],
      });
    },
    fetchRevisions: async () => ({ data: { rows: [] } }),
    rerender: async () => {},
  };
  const fake = fakeEdit(port, { pendingEdits: new Map() });
  const { dom, doc, root, render } = await mountPanel(fake.edit);
  const text = await waitFor(() => doc.querySelector("#reader-block-edit-text"), "编辑框");
  assert.equal(doc.querySelector("[data-block-edit-pending]"), null, "没有待排版的就不画那一条");
  typeInput(dom, text, "x 等于 $a");
  doc.querySelector(".reader-block-edit-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(() => doc.querySelector("[data-block-edit-issues]"), "问题列表");
  assert.match(doc.querySelector("[data-block-edit-issues]").textContent, /公式的 \$ 或括号不成对/);
  assert.match(doc.querySelector(".reader-block-edit-status").textContent, /没通过检查/);
  assert.equal(fake.saved.length, 0);

  render({ ...fake.edit, blockedReason: "这本书正在处理（翻译或排版），处理完才能改。", rerender: { phase: "running", seenActive: true } });
  await waitFor(() => doc.querySelector("[data-block-edit-blocked]"), "说原因");
  assert.match(doc.querySelector("[data-block-edit-rerender]").textContent, /正在重新排版/);
  render({ ...fake.edit, target: null });
  await waitFor(() => /按 E/.test(doc.querySelector(".reader-block-edit").textContent), "教怎么选");
  root.unmount();
});

test("改译文状态：拼出来的书不能改；待排版按修订记录现算；排版提交后等任务跑完，成功清空、失败留着改动", async () => {
  const dom = makeDom("", { keys: ["window", "document", "HTMLElement", "Element", "Event", "Node", "MutationObserver"] });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { setReaderAdapters } = await import("../../../../frontend/packages/reader/src/adapters.ts");
  const { useReaderBlockEdit } = await import("../../../../frontend/packages/reader/src/hooks/use-reader-block-edit.ts");
  const calls = [];
  const port = {
    resolveOwnerJobId: async (id) => { calls.push(["owner", id]); return id === "render-2" ? "job-1" : id; },
    loadItem: async () => null,
    revise: async () => null,
    fetchRevisions: async (jobId) => { calls.push(["revisions", jobId]); return REVISIONS; },
    rerender: async (jobId) => { calls.push(["rerender", jobId]); },
  };
  setReaderAdapters({ sessionData: { translationEdit: port } });
  let latest = null;
  let statusRefreshes = 0;
  function Harness(props) {
    latest = useReaderBlockEdit({ ...props, hasTranslation: true, refreshJobStatus: async () => { statusRefreshes += 1; } });
    return null;
  }
  const root = createRoot(dom.window.document.createElement("div"));
  const show = (props) => root.render(React.createElement(Harness, props));

  show({ jobId: "merged-abc-0123", jobStatus: "succeeded", jobPayload: {} });
  await waitFor(() => latest?.blockedReason, "拼出来的书");
  assert.match(latest.blockedReason, /拼起来的/);

  // 重新排版出来的任务：译文在来源任务上，修订记录也从那里读
  const rendered = { timestamps: { finished_at: "2026-11-19T06:00:00Z" } };
  show({ jobId: "render-2", jobStatus: "succeeded", jobPayload: rendered });
  await waitFor(() => latest.ownerJobId === "job-1" && latest.pendingEdits.size === 1, "待排版");
  assert.equal(latest.blockedReason, "");
  assert.ok(calls.some((c) => c[0] === "revisions" && c[1] === "job-1"));
  latest.select("p004-b0001");
  await waitFor(() => latest.target?.page === 4, "选中");
  latest.markSaved("p004-b0001", "新的");
  await waitFor(() => latest.pendingEdits.get("p004-b0001") === "新的" && latest.savedCounts.get("p004-b0001") === 1, "本地记上");

  await latest.startRerender();
  assert.deepEqual(calls.filter((c) => c[0] === "rerender"), [["rerender", "render-2"]], "排版的是正在读的任务");
  assert.equal(statusRefreshes, 1);
  await waitFor(() => latest.rerender.phase === "running", "排版中");
  assert.match(latest.blockedReason, /正在处理/);
  // 旧的 succeeded 还在：不能当成排完了
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(latest.rerender.phase, "running");
  show({ jobId: "render-2", jobStatus: "running", jobPayload: rendered });
  await waitFor(() => latest.rerender.seenActive, "看到在跑");
  show({ jobId: "render-2", jobStatus: "failed", jobPayload: rendered });
  await waitFor(() => latest.rerender.phase === "failed", "失败");
  assert.equal(latest.pendingEdits.size, 2, "失败了改动还在");

  await latest.startRerender();
  show({ jobId: "render-2", jobStatus: "running", jobPayload: rendered });
  await waitFor(() => latest.rerender.phase === "running" && latest.rerender.seenActive, "又在跑");
  show({ jobId: "render-2", jobStatus: "succeeded", jobPayload: { timestamps: { finished_at: "2026-11-19T08:00:00Z" } } });
  await waitFor(() => latest.rerender.phase === "idle" && latest.pendingEdits.size === 0, "排完清空");
  root.unmount();
  setReaderAdapters(null);
});
