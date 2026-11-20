/** 2.5D 编辑部里一闪而过的动作：状态里留哪些事件、每种画成什么、打开时之前的事件不一起炸开、白板写真术语。 */
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { makeDom } from "../helpers/dom.mjs";

import { parseEditorialEvents } from "../../src/features/editorial-room/domain/events.ts";
import { toolBubbleText } from "../../src/features/editorial-room/domain/narration.ts";
import { buildDemoEditorialRun } from "../../src/features/editorial-room/domain/demo-run.ts";
import { roomStateAt } from "../../src/features/editorial-room/domain/room-state.ts";

const v = "editorial.v1";

async function mount(element) {
  const { createRoot } = await import("react-dom/client");
  const host = globalThis.document.createElement("div");
  globalThis.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(element);
  return { host, root, unmount: () => root.unmount() };
}

test("状态只留会画成动作的事件，带序号，最多 12 条", () => {
  const events = parseEditorialEvents([
    { v, ts: 0, type: "run_started", pages: 1, model: "m", doc_title: "t" },
    { v, ts: 1, type: "page_started", page: 1, label: "1", blocks: 3 },
    { v, ts: 2, type: "tool_call", page: 1, role: "translator", tool: "search_book", query: "attention", found: 4 },
    { v, ts: 3, type: "check_result", page: 1, attempt: 1, ok: 3, warn: 0, error: 0, codes: {} },
  ]);
  const state = roomStateAt(events, events.length);
  assert.deepEqual(state.moments.map((m) => [m.seq, m.event.type]), [[3, "tool_call"], [4, "check_result"]]);
  const many = parseEditorialEvents(Array.from({ length: 20 }, (_, i) => ({ v, ts: i, type: "retry", page: 1, blocks: [] })));
  const capped = roomStateAt(many, many.length).moments;
  assert.equal(capped.length, 12);
  assert.equal(capped.at(-1).seq, 20);
});

test("气泡里的查资料：工具名换成中文，查的词太长截断，没查成写没查成", () => {
  assert.equal(toolBubbleText({ tool: "search_book", query: "attention", found: 4, error: "" }), "查全书「attention」· 4 处");
  assert.equal(toolBubbleText({ tool: "lookup_term", query: "token", found: 0, error: "" }), "查术语表「token」· 没有");
  assert.equal(toolBubbleText({ tool: "search_book", query: "a very long phrase that goes on", found: 1, error: "" }), "查全书「a very long phr…」· 1 处");
  assert.equal(toolBubbleText({ tool: "search_book", query: "x", found: 0, error: "limit" }), "查全书「x」没查成");
});

test("每种动作画出来：查资料气泡、质检扫描、退回原文抛进筐、审校单按结果分三种、定稿盖章；同一种只留最新一条", async () => {
  makeDom();
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { OfficeMoments } = await import("../../src/features/editorial-room/ui/office/OfficeMoments.tsx");
  const events = parseEditorialEvents([
    { v, ts: 1, type: "tool_call", page: 1, role: "translator", tool: "search_book", query: "old", found: 1 },
    { v, ts: 2, type: "tool_call", page: 1, role: "translator", tool: "lookup_term", query: "token", found: 2 },
    { v, ts: 3, type: "check_result", page: 1, attempt: 1, ok: 2, warn: 1, error: 0, codes: {} },
    { v, ts: 4, type: "fallback", page: 1, block: "p1-2", reason: "formula_changed" },
    { v, ts: 5, type: "review_done", page: 1, tickets: 4, applied: 2, rejected: 2, withdrawn: 1 },
    { v, ts: 6, type: "page_done", page: 1, statuses: { ok: 3, warn: 0, error: 0, fallback_source: 1 } },
  ]);
  const moments = events.map((event, i) => ({ seq: i + 1, event }));
  const html = renderToStaticMarkup(React.createElement(OfficeMoments, { moments, filedCount: 1 }));
  const dom = new globalThis.window.DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${html}</svg>`, "image/svg+xml");
  const kinds = [...dom.querySelectorAll("[data-editorial-moment]")].map((el) => el.getAttribute("data-editorial-moment"));
  assert.deepEqual(kinds, ["bubble", "scan", "fallback", "review-notes", "bubble", "filed"], "两条查资料只画最新那条");
  assert.match(dom.querySelector('[data-editorial-moment="bubble"]').textContent, /查术语表「token」· 2 条/);
  assert.ok(dom.querySelector('[data-editorial-moment="scan"]').getAttribute("class").includes("is-warn"));
  const notes = [...dom.querySelectorAll(".editorial-room-office-note-flyer")].map((el) => el.getAttribute("class").split(" ").at(-1));
  assert.deepEqual(notes, ["is-applied", "is-applied", "is-rejected", "is-withdrawn"]);
  assert.equal(dom.querySelectorAll(".editorial-room-office-note-check").length, 2, "改进去的才打勾");
  assert.match(dom.querySelector('[data-editorial-moment="review-notes"]').textContent, /改 2 · 没收 1 · 撤回 1/);
  const filed = dom.querySelector('[data-editorial-moment="filed"]');
  assert.match(filed.textContent, /定稿/);
  assert.ok(filed.querySelector(".editorial-room-office-paper.is-flagged"), "有退回原文的页标红");

  const clean = renderToStaticMarkup(React.createElement(OfficeMoments, {
    moments: [{ seq: 1, event: { v, ts: 0, type: "review_done", page: 2, tickets: 0, applied: 0, rejected: 0, withdrawn: 0 } }],
    filedCount: 0,
  }));
  assert.match(clean, /这页没问题/);
  assert.doesNotMatch(clean, /note-flyer/);
});

test("打开时已经发生的事不重播，之后来的才播；白板写最近的术语（先译法后原文，同一原文只写最新）", async () => {
  makeDom();
  const React = await import("react");
  const { EditorialOffice } = await import("../../src/features/editorial-room/ui/office/EditorialOffice.tsx");
  const events = buildDemoEditorialRun();
  const firstLookup = events.findIndex((event) => event.type === "tool_call");
  const glossaryV3 = events.findIndex((event) => event.type === "glossary_changed" && event.version === 3);
  const at = (count) => React.createElement(EditorialOffice, { state: roomStateAt(events, count), glossaryFresh: false });

  const { host, root, unmount } = await mount(at(firstLookup + 1));
  try {
    await waitFor(() => host.querySelector("[data-editorial-office]"));
    assert.equal(host.querySelectorAll("[data-editorial-moment]").length, 0, "挂上之前的查资料不播");
    const terms = [...host.querySelectorAll("[data-editorial-term]")].map((el) => el.textContent);
    assert.deepEqual(terms, ["版面分析layout analys…", "边界框bounding box"], "原文长了截断，译法不截");
    assert.equal(host.querySelector(".editorial-room-office-term-cover"), null, "挂上之前改的版不重写");

    root.render(at(glossaryV3 + 1));
    await waitFor(() => host.querySelector(".editorial-room-office-term-cover"), "新改的那条写上去");
    assert.ok(host.querySelector('[data-editorial-moment="filed"]'), "第 1 页定稿是挂上以后的事，播");
    const after = [...host.querySelectorAll("[data-editorial-term]")].map((el) => el.dataset.editorialTerm);
    assert.deepEqual(after, ["bounding box", "layout analysis"], "bounding box 第 3 版审定，排最上，不重复");
  } finally {
    unmount();
  }
});
