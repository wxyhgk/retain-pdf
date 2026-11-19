// 阅读页「改译文」：悬停框里的「改」→ 这一段变成编辑框（大块盖在原位，小块旁边弹出来）→ 改了保存（PATCH，不排版）→
// PDF 上先盖着新译文、右下角「改了 N 处，还没排进 PDF · 重新排版」；修订历史能「用这版」回去；
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
  editableBlockIds,
  inlineEditLayout,
  revisionIssueTexts,
} from "../../../../frontend/packages/reader/src/shared/data/block-edit.ts";
import { ReaderTextHoverLayer } from "../../../../frontend/packages/reader/src/pdf/ReaderTextHoverLayer.tsx";

const REVISIONS = {
  data: {
    rows: [
      { item_id: "p003-b002", reader_item_id: "p003-b0002", ts: "2026-11-19T06:10:00Z", source: "user", reason: "顺一下", previous_text: "精修过的", new_text: "手改的" },
      { item_id: "p003-b002", reader_item_id: "p003-b0002", ts: "2026-11-18T01:00:00Z", source: "refine", reason: "", previous_text: "初译", new_text: "精修过的" },
    ],
  },
};

test("改译文模型：页码、拼出来的书、排版时间", () => {
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
  const selected = [];
  let rerenders = 0;
  let closes = 0;
  return {
    saved,
    selected,
    get rerenders() { return rerenders; },
    get closes() { return closes; },
    edit: {
      available: true,
      blockedReason: "",
      port,
      ownerJobId: "job-1",
      target: { itemId: "p003-b0002", page: 3 },
      select: (itemId) => selected.push(itemId),
      close: () => { closes += 1; },
      memory: { drafts: new Map(), generation: { current: null } },
      pendingEdits: new Map([["p001-b0001", "别处改的"]]),
      savedCounts: new Map(),
      markSaved: (itemId, text) => saved.push([itemId, text]),
      rerender: { phase: "idle" },
      startRerender: async () => { rerenders += 1; },
      ...overrides,
    },
  };
}

function hoverTarget(itemId, rect) {
  return {
    itemId,
    rect,
    highlight: {
      itemId,
      region: { itemId, regionType: "text", source: null, translated: null, markdown: "", status: "", assetIds: [], assetUrls: [] },
      box: { page: 3, bbox: [0, 0, 1, 1], unit: "pdf_point", origin: "top_left", text: "" },
      pageSize: { page: 3, width: 600, height: 800 },
    },
  };
}

const REGIONS = ["p003-b0001", "p003-b0002", "p003-b0003"].map((itemId) => ({ itemId, regionType: "text", source: null, translated: null, markdown: "", status: "", assetIds: [], assetUrls: [] }));

async function mountEditor(edit, { rect = { left: 40, top: 100, width: 420, height: 120 }, showSource = true } = {}) {
  const dom = makeDom("", { keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLFormElement", "Element", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver"] });
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { ReaderInlineBlockEditor } = await import("../../../../frontend/packages/reader/src/pdf/ReaderInlineBlockEditor.tsx");
  const { ReaderPendingEditsPill } = await import("../../../../frontend/packages/reader/src/components/react-pdf/ReaderPendingEditsPill.tsx");
  const root = createRoot(container);
  const render = (next, options = {}) => root.render(React.createElement(React.Fragment, null,
    React.createElement(ReaderInlineBlockEditor, {
      target: hoverTarget(next.target?.itemId || "p003-b0002", options.rect || rect),
      page: { width: 600, height: 800 },
      edit: next,
      showSource: options.showSource ?? showSource,
      regions: REGIONS,
      jumpToBlock: () => {},
    }),
    React.createElement(ReaderPendingEditsPill, { edit: next }),
  ));
  render(edit);
  return { dom, doc: dom.window.document, root, render };
}

test("编辑框放哪：大块盖在原位；小块在下面弹一个放大的框，离页底太近就放上面，左右夹在页里", () => {
  const page = { width: 600, height: 800 };
  assert.deepEqual(inlineEditLayout({ left: 40, top: 100, width: 420, height: 120 }, page), { mode: "inline", left: 40, top: 100, width: 420, minHeight: 120 });
  assert.deepEqual(inlineEditLayout({ left: 500, top: 100, width: 80, height: 20 }, page), { mode: "popout", left: 232, width: 360, top: 126 });
  assert.deepEqual(inlineEditLayout({ left: 40, top: 700, width: 420, height: 30 }, page), { mode: "popout", left: 40, width: 420, bottom: 106 });
  assert.equal(inlineEditLayout({ left: 0, top: 0, width: 100, height: 20 }, { width: 300, height: 800 }).width, 284, "页太窄：铺满页宽减边");
});

test("框里改：用阅读页块号读、按条目实际写法写回；只看译文时带原文；保存走 PATCH（source=user、带原因），存好收起；历史能用回初译；Esc 取消丢草稿；Alt+↓ 换段；右下角重新排版", async () => {
  const calls = [];
  let history = { data: { rows: [] } };
  const port = {
    resolveOwnerJobId: async (id) => id,
    loadItem: async (jobId, itemId) => {
      calls.push(["load", jobId, itemId]);
      // 后端认四位块号，回条目里实际存的写法（三位）
      return { item_id: "p003-b002", item: { source_text: "The coroner arrived.", protected_translated_text: "验尸官来了。" } };
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
  const { dom, doc, root } = await mountEditor(fake.edit);
  const text = await waitFor(() => doc.querySelector("#reader-block-edit-text"), "编辑框");
  assert.equal(text.value, "验尸官来了。");
  assert.equal(doc.querySelector("[data-inline-edit-mode]").dataset.inlineEditMode, "inline");
  assert.match(doc.querySelector("[data-block-edit-source]").textContent, /coroner/);
  assert.deepEqual(calls.filter((c) => c[0] === "load").map((c) => c[2]), ["p003-b0002"], "直接用阅读页块号读一次");
  assert.match(doc.querySelector("[data-block-edit-pending]").textContent, /改了 1 处，还没排进 PDF/);

  typeInput(dom, text, "验尸官到了。");
  typeInput(dom, doc.querySelector(".reader-inline-edit-reason"), "更自然");
  click(dom, doc.querySelector('[data-block-edit-action="save"]'));
  await waitFor(() => fake.saved.length === 1 && fake.closes === 1, "存好收起");
  const revise = calls.find((c) => c[0] === "revise");
  assert.deepEqual(revise.slice(1), ["job-1", "p003-b002", { translated_text: "验尸官到了。", source: "user", reason: "更自然" }]);
  assert.deepEqual(fake.saved[0], ["p003-b0002", "验尸官到了。"]);

  // 存完重读历史：点「历史」，初译那一版能「用这版」回去，带上 generation 防冲突
  click(dom, await waitFor(() => doc.querySelector('[data-block-edit-action="history"]'), "历史按钮"));
  click(dom, await waitFor(() => doc.querySelector('[data-block-edit-history="初译"] [data-block-edit-action="restore"]'), "初译可以用回去"));
  await waitFor(() => calls.filter((c) => c[0] === "revise").length === 2 && fake.closes === 2, "用这版");
  const restore = calls.filter((c) => c[0] === "revise")[1];
  assert.equal(restore[3].translated_text, "验尸官来了。");
  assert.equal(restore[3].expected_generation, 7);
  assert.match(restore[3].reason, /初译/);

  // Esc：取消，草稿丢掉
  typeInput(dom, doc.querySelector("#reader-block-edit-text"), "改到一半");
  assert.equal(fake.edit.memory.drafts.get("p003-b0002"), "改到一半");
  doc.querySelector("#reader-block-edit-text").dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await waitFor(() => fake.closes === 3, "取消");
  assert.equal(fake.edit.memory.drafts.has("p003-b0002"), false);

  dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true }));
  assert.deepEqual(fake.selected, ["p003-b0003"]);

  click(dom, doc.querySelector('[data-block-edit-action="rerender"]'));
  await waitFor(() => fake.rerenders === 1, "重新排版");
  root.unmount();
});

test("框里改：小块弹出来、原段描框；对照时不带原文；有公式就预览；没过检查列原因；不能改时说原因；排版中右下角说一声", async () => {
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
  const small = { rect: { left: 40, top: 100, width: 120, height: 24 }, showSource: false };
  const { dom, doc, root, render } = await mountEditor(fake.edit, small);
  const text = await waitFor(() => doc.querySelector("#reader-block-edit-text"), "编辑框");
  assert.equal(doc.querySelector("[data-inline-edit-mode]").dataset.inlineEditMode, "popout");
  assert.ok(doc.querySelector(".reader-inline-edit-frame"), "原来那段描一圈");
  assert.equal(doc.querySelector("[data-block-edit-source]"), null, "对照时左边就是原文");
  assert.equal(doc.querySelector("[data-block-edit-pending]"), null, "没有待排版的就不画右下角");
  await waitFor(() => doc.querySelector("[data-inline-edit-preview]"), "公式预览");

  typeInput(dom, text, "x 等于 $a");
  click(dom, doc.querySelector('[data-block-edit-action="save"]'));
  await waitFor(() => doc.querySelector("[data-block-edit-issues]"), "问题列表");
  assert.match(doc.querySelector("[data-block-edit-issues]").textContent, /公式的 \$ 或括号不成对/);
  assert.match(doc.querySelector(".reader-inline-edit-status").textContent, /没通过检查/);
  assert.equal(fake.saved.length, 0);
  assert.equal(fake.closes, 0, "没存成不收起");

  render({ ...fake.edit, blockedReason: "这本书正在处理（翻译或排版），处理完才能改。", rerender: { phase: "running", seenActive: true } }, small);
  await waitFor(() => doc.querySelector("[data-block-edit-blocked]"), "说原因");
  assert.match(doc.querySelector("[data-block-edit-rerender]").textContent, /正在重新排版/);
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
