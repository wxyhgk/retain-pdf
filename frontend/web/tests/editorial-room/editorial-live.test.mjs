/** 编辑部接真实进度：续跑、按条数续读（文件重开从头取）、书详情「进度」面板里的画面和回放。 */
import test from "node:test";
import assert from "node:assert/strict";

import { parseEditorialEvents } from "../../src/features/editorial-room/domain/events.ts";
import { roomStateAt, roomTotals } from "../../src/features/editorial-room/domain/room-state.ts";
import {
  emptyEditorialLive,
  mergeEditorialPull,
  pullEditorialEvents,
} from "../../src/features/editorial-room/domain/live-feed.ts";
import { hasEditorialRoom, processingFacts } from "../../src/features/book-detail/domain/translation-coverage.ts";
import { waitFor } from "../helpers/async.mjs";
import { click, makeDom } from "../helpers/dom.mjs";

const v = "editorial.v1";
const run = (pages, resumed = 0) => ({ v, ts: 0, type: "run_started", pages, model: "claude-haiku-5-5", doc_title: "Reading Machines", resumed });
const pageDone = (page) => ({ v, ts: page, type: "page_done", page, statuses: { ok: 3, warn: 0, error: 0, fallback_source: 0 } });

// 第一轮：通读、术语表、做完第 1、2 页，第 3 页翻到一半额度用完。
const FIRST_ROUND = [
  run(4),
  { v, ts: 1, type: "reading_started" },
  { v, ts: 1, type: "translate_call", page: 0, attempt: 1, blocks: [], role: "reader" },
  { v, ts: 2, type: "glossary_changed", version: 1, action: "add", source: "attention", target: "注意力" },
  { v, ts: 3, type: "reading_done", genre: "science_paper", name_policy: "keep", terms: 12, headings: 8 },
  { v, ts: 4, type: "page_started", page: 1, label: "i", blocks: 3 },
  pageDone(1),
  { v, ts: 5, type: "page_started", page: 2, label: "ii", blocks: 3 },
  { v, ts: 5, type: "fallback", page: 2, block: "p2-1", reason: "formula_changed" },
  pageDone(2),
  { v, ts: 6, type: "page_started", page: 3, label: "1", blocks: 3 },
  { v, ts: 6, type: "translate_call", page: 3, attempt: 1, blocks: ["p3-1"], role: "translator" },
  { v, ts: 7, type: "run_stopped", reason: "quota_exhausted" },
];

test("续跑：第二条 run_started 不清空；1..resumed 定稿，停在半路的页回到还没派", () => {
  const events = parseEditorialEvents([...FIRST_ROUND, run(4, 2)]);
  assert.equal(events.at(-1).resumed, 2);
  const state = roomStateAt(events, events.length);
  assert.equal(state.status, "running");
  assert.equal(state.stopReason, "");
  assert.deepEqual(state.pages.map((card) => card.stage), ["done", "done", "waiting", "waiting"]);
  assert.equal(state.pages[0].label, "i", "已定稿的页保留标签");
  assert.equal(state.glossary.version, 1, "术语表沿用上一轮");
  assert.equal(state.basket.length, 1, "待人看筐沿用上一轮");
  assert.equal(state.reading?.terms, 12, "通读结果沿用上一轮");
  assert.equal(roomTotals(state).donePages, 2);
});

test("续跑的事件流从中间开始（只拿到第二条 run_started）：1..resumed 也标定稿", () => {
  const state = roomStateAt(parseEditorialEvents([run(3, 2)]), 1);
  assert.deepEqual(state.pages.map((card) => card.stage), ["done", "done", "waiting"]);
});

test("通读的模型调用（page 0）不凭空加出第 0 页", () => {
  const state = roomStateAt(parseEditorialEvents(FIRST_ROUND.slice(0, 3)), 3);
  assert.equal(state.pages.length, 4);
  assert.equal(state.pages.some((card) => card.page === 0), false);
});

function pager(store, limit = 2) {
  const calls = [];
  return {
    calls,
    fetchPage: async (after) => {
      calls.push(after);
      // 和后端一样：next_after 是到这一段为止读过的条数；文件变短（重开）时比带去的 after 小。
      const start = Math.min(after, store.events.length);
      const events = store.events.slice(start, start + limit);
      const next = start + events.length;
      return { events, next_after: next, has_more: next < store.events.length };
    },
  };
}

test("按条数续读：has_more 就接着取；下次从 next_after 接着；不认识的事件跳过", async () => {
  const store = { events: [...FIRST_ROUND.slice(0, 5), { v, ts: 3, type: "brand_new_type" }] };
  const { calls, fetchPage } = pager(store);
  const first = await pullEditorialEvents(fetchPage, 0);
  assert.deepEqual(calls, [0, 2, 4]);
  assert.equal(first.nextAfter, 6);
  let live = mergeEditorialPull(emptyEditorialLive(), first);
  assert.equal(live.events.length, 5);
  assert.equal(live.state.status, "running");

  store.events.push(...FIRST_ROUND.slice(5, 7));
  const second = await pullEditorialEvents(fetchPage, live.after);
  assert.equal(calls.at(-1), 6);
  live = mergeEditorialPull(live, second);
  assert.equal(live.events.length, 7);
  assert.equal(live.state.pages[0].stage, "done");

  const idle = await pullEditorialEvents(fetchPage, live.after);
  assert.deepEqual(idle.raws, []);
  assert.equal(mergeEditorialPull(live, idle).events, live.events, "没有新事件时不换数组");
});

test("next_after 比带去的 after 小：事件文件重开了，从 0 重取，之前的状态作废", async () => {
  const store = { events: FIRST_ROUND.slice(0, 8) };
  const { fetchPage } = pager(store, 50);
  let live = mergeEditorialPull(emptyEditorialLive(), await pullEditorialEvents(fetchPage, 0));
  assert.equal(live.state.glossary.version, 1);

  store.events = [run(2), { v, ts: 1, type: "reading_started" }];
  const pull = await pullEditorialEvents(fetchPage, live.after);
  assert.equal(pull.reset, true);
  live = mergeEditorialPull(live, pull);
  assert.equal(live.events.length, 2);
  assert.equal(live.state.glossary.version, 0);
  assert.equal(live.state.pages.length, 2);
  assert.equal(live.after, 2);
});

test("进度面板：只有 agent 任务（或已经有事件）才有编辑部；翻译站写明翻译 agent", () => {
  const job = (over) => ({
    job_id: "job-a", workflow: "book", status: "succeeded", created_at: "2026-10-30T08:00:00Z",
    finished_at: "2026-10-30T08:10:00Z", model: "claude-haiku-5-5", engine: "agent", has_editorial_events: true,
    pages: [1, 2], supplied_pages: 2, ocr_reused: false, note: null, kept_origin_blocks: 0,
    kept_origin_blocks_supplied: 0, failure_summary: null, error_head: null, ...over,
  });
  const view = (jobs) => ({ page_count: 2, translated_pages: 2, contributing_jobs: 1, jobs, segments: [] });
  assert.equal(hasEditorialRoom(view([job()]), "job-a"), true);
  assert.equal(hasEditorialRoom(view([job({ has_editorial_events: false })]), "job-a"), true, "agent 任务开翻前也要准备好");
  assert.equal(hasEditorialRoom(view([job({ engine: "legacy", has_editorial_events: false })]), "job-a"), false);
  assert.equal(hasEditorialRoom(view([job()]), "job-b"), false);
  assert.equal(hasEditorialRoom(null, "job-a"), false);

  const facts = processingFacts(view([job()]), new Date("2026-10-30T09:00:00Z"));
  assert.match(facts.stageMeta.translate, /翻译 agent · claude-haiku-5-5/);
  assert.ok(facts.facts.includes("翻译 agent · claude-haiku-5-5"));
  const legacy = processingFacts(view([job({ engine: "legacy" })]), new Date("2026-10-30T09:00:00Z"));
  assert.ok(legacy.facts.includes("claude-haiku-5-5"));
  assert.doesNotMatch(legacy.stageMeta.translate, /agent/);
});

async function mountLive(props) {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const room = await import("../../src/features/editorial-room/index.ts");
  function Harness({ jobId, enabled, poll, fetchPage, active }) {
    const live = room.useEditorialLive(jobId, { enabled, poll, fetchPage, intervalMs: 20 });
    return React.createElement(room.EditorialLivePanel, { live, active });
  }
  const host = globalThis.document.createElement("div");
  globalThis.document.body.appendChild(host);
  const root = createRoot(host);
  const render = (next) => root.render(React.createElement(Harness, next));
  render(props);
  return { dom, host, render, unmount: () => root.unmount() };
}

test("面板：任务在跑时跟着新事件动；跑完停在最后，能回放", async () => {
  const store = { events: FIRST_ROUND.slice(0, 6) };
  const { calls, fetchPage: pageOf } = pager(store, 500);
  const fetchPage = (jobId, after) => pageOf(after);
  const props = { jobId: "job-a", enabled: true, poll: true, fetchPage, active: true };
  const { dom, host, render, unmount } = await mountLive(props);
  try {
    await waitFor(() => host.querySelector("[data-editorial-live]"), "有事件后出现编辑部");
    assert.equal(host.querySelector("[data-editorial-live]").dataset.editorialLive, "running");
    assert.equal(host.querySelector("[data-editorial-progress]").dataset.editorialProgress, "1/4");
    assert.equal(host.querySelector("[data-editorial-live-replay]"), null, "在跑时不给回放");

    store.events.push(...FIRST_ROUND.slice(6));
    await waitFor(
      () => host.querySelector("[data-editorial-stage]")?.dataset.editorialStatus === "stopped",
      "轮询拿到后面的事件",
    );
    assert.ok(calls.filter((after) => after === 6).length >= 1, "接着上次的位置取");

    render({ ...props, poll: false, active: false });
    const replay = await waitFor(() => host.querySelector("[data-editorial-live-replay]"), "跑完给回放");
    assert.equal(host.querySelector("[data-editorial-live]").dataset.editorialLive, "settled");
    click(dom, replay);
    await waitFor(() => host.querySelector("[data-editorial-replay]"), "回放画面");
    assert.match(host.querySelector("[data-editorial-live-replay]").textContent, /停止回放/);
  } finally {
    unmount();
  }
});

test("面板：没有事件（legacy 任务、还没开翻）什么都不画；不启用时不请求", async () => {
  let requests = 0;
  const fetchPage = async () => {
    requests += 1;
    return { events: [], next_after: 0, has_more: false };
  };
  const { host, render, unmount } = await mountLive({ jobId: "job-a", enabled: false, poll: true, fetchPage, active: true });
  try {
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(requests, 0);
    render({ jobId: "job-a", enabled: true, poll: false, fetchPage, active: false });
    await waitFor(() => requests === 1, "启用后读一次");
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(requests, 1, "不在跑时只读一次");
    assert.equal(host.querySelector("[data-editorial-live]"), null);
  } finally {
    unmount();
  }
});
