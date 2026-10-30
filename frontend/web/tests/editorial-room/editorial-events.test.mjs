/** 编辑部：editorial.v1 事件解析、叠成状态、回放节奏。用后端给的两页示例序列和 6 页模拟数据。 */
import test from "node:test";
import assert from "node:assert/strict";

import { parseEditorialEvent, parseEditorialEvents } from "../../src/features/editorial-room/domain/events.ts";
import {
  roomStateAt,
  roomTotals,
  stationPages,
  waitingPages,
} from "../../src/features/editorial-room/domain/room-state.ts";
import { buildDemoEditorialRun } from "../../src/features/editorial-room/domain/demo-run.ts";
import { narrate } from "../../src/features/editorial-room/domain/narration.ts";
import {
  REPLAY_MAX_GAP_MS,
  REPLAY_MIN_GAP_MS,
  replayDelayMs,
} from "../../src/features/editorial-room/domain/replay.ts";

const v = "editorial.v1";
// 后端通知里的两页示例（ts 是秒）。
const SAMPLE = parseEditorialEvents([
  { v, ts: 0, type: "run_started", pages: 2, model: "claude-haiku-5-5", doc_title: "Reading Machines" },
  { v, ts: 1, type: "reading_started" },
  { v, ts: 2, type: "glossary_changed", version: 1, action: "add", source: "bounding box", target: "边界框" },
  { v, ts: 4, type: "reading_done", genre: "science_paper", name_policy: "keep", terms: 22, headings: 43 },
  { v, ts: 5, type: "page_started", page: 1, label: "1", blocks: 6 },
  { v, ts: 6, type: "translate_call", page: 1, attempt: 1, blocks: ["p1-1"], role: "translator" },
  { v, ts: 9, type: "check_result", page: 1, attempt: 1, ok: 5, warn: 0, error: 1, codes: { number_lost: 1 } },
  { v, ts: 10, type: "retry", page: 1, blocks: ["p1-3"] },
  { v, ts: 11, type: "translate_call", page: 1, attempt: 2, blocks: ["p1-3"], role: "translator" },
  { v, ts: 13, type: "check_result", page: 1, attempt: 2, ok: 6, warn: 0, error: 0, codes: {} },
  { v, ts: 14, type: "review_started", page: 1, blocks: 4 },
  { v, ts: 15, type: "page_started", page: 2, label: "2", blocks: 5 },
  { v, ts: 16, type: "translate_call", page: 2, attempt: 1, blocks: ["p2-1"], role: "translator" },
  { v, ts: 18, type: "review_done", page: 1, tickets: 2, applied: 1, rejected: 1 },
  { v, ts: 19, type: "page_done", page: 1, statuses: { ok: 6, warn: 0, error: 0, fallback_source: 0 } },
]);

test("解析：版本不对、type 不认识的整条跳过；缺的字段给默认值；多的字段不管", () => {
  assert.equal(parseEditorialEvent({ v: "editorial.v2", ts: 1, type: "run_started" }), null);
  assert.equal(parseEditorialEvent({ v, ts: 1, type: "coffee_break" }), null);
  assert.equal(parseEditorialEvent(null), null);
  assert.deepEqual(parseEditorialEvent({ v, ts: "3", type: "page_started", page: 2, extra: true }), {
    type: "page_started",
    ts: 3,
    page: 2,
    label: "2",
    blocks: 0,
  });
  assert.equal(SAMPLE.length, 15);
});

test("示例序列：第 1 页质检不合格 → 退回译者 → 重翻合格；审第 1 页时第 2 页已在译者手上", () => {
  const at = (n) => roomStateAt(SAMPLE, n);
  assert.equal(at(2).status, "reading");
  assert.equal(at(4).status, "running");
  assert.equal(at(4).reading.terms, 22);

  const checked = at(7);
  assert.equal(stationPages(checked).checker.page, 1);
  assert.deepEqual(roomTotals(checked).error, 1);

  const retried = at(8);
  assert.equal(retried.pages[0].stage, "retrying");
  assert.equal(stationPages(retried).translator.page, 1, "退回的稿子回到译者桌上");
  assert.equal(stationPages(retried).checker, null);

  const both = at(13);
  const stations = stationPages(both);
  assert.equal(stations.reviewer.page, 1);
  assert.equal(stations.translator.page, 2);
  assert.equal(both.pages[0].attempt, 2);
  assert.equal(roomTotals(both).error, 0, "重翻后按最近一次质检算，不重复计");
  assert.equal(roomTotals(both).ok, 6);
  assert.equal(roomTotals(both).retries, 1);

  const done = at(15);
  assert.equal(done.pages[0].stage, "done");
  assert.equal(roomTotals(done).applied, 1);
  assert.equal(roomTotals(done).rejected, 1);
  assert.equal(roomTotals(done).donePages, 1);
  assert.equal(done.glossary.version, 1);
});

test("模拟 6 页跑完：每页定稿；合格 + 警告 + 不合格 + 退回原文 = 块数；术语表、歧义单、待人看都有", () => {
  const events = buildDemoEditorialRun();
  const end = roomStateAt(events, events.length);
  assert.equal(end.status, "done");
  assert.ok(end.pages.every((card) => card.stage === "done"));
  for (const card of end.pages) {
    const { ok, warn, error } = card.check;
    assert.equal(ok + warn + error + card.fallback, card.blocks, `第 ${card.page} 页的块数对得上`);
  }
  const totals = roomTotals(end);
  assert.equal(totals.fallback, 1);
  assert.equal(end.basket[0].block, "p3-2");
  assert.equal(totals.ambiguity, 1);
  assert.equal(end.glossary.version, 5);
  assert.equal(events.at(-1).glossary_version, 5);
  // 时间只往前走，回放才算得出间隔。
  assert.ok(events.every((event, i) => i === 0 || event.ts >= events[i - 1].ts));
  // 每条都有一句给人看的话。
  assert.ok(events.every((event) => narrate(event).text));
});

test("模拟「额度用完」：第 4 页定稿后停下，第 5、6 页还在调度看板上", () => {
  const events = buildDemoEditorialRun({ stopAfterPage: 4 });
  const end = roomStateAt(events, events.length);
  assert.equal(end.status, "stopped");
  assert.equal(end.stopReason, "quota_exhausted");
  assert.deepEqual(waitingPages(end).map((card) => card.page), [5, 6]);
  assert.equal(roomTotals(end).donePages, 4);
  assert.match(narrate(events.at(-1)).text, /额度用完/);
});

test("回放节奏：按 ts 差算，压在最短、最长之间，倍速按比例缩短", () => {
  const [a, b] = SAMPLE;
  assert.equal(replayDelayMs(undefined, a), REPLAY_MIN_GAP_MS);
  assert.equal(replayDelayMs(a, { ...b, ts: 0 }), REPLAY_MIN_GAP_MS, "同一秒的事件也留出看清的时间");
  assert.equal(replayDelayMs(a, { ...b, ts: 3600 }), REPLAY_MAX_GAP_MS, "长空档不干等");
  assert.equal(replayDelayMs(a, { ...b, ts: 3600 }, 4), REPLAY_MAX_GAP_MS / 4);
  assert.equal(replayDelayMs(a, { ...b, ts: 3600 }, 0), REPLAY_MAX_GAP_MS, "倍速给 0 当 1 倍");
});

test("模型调用按 role 记到工位：审校的请求算审校中；缺省 role 当译者", () => {
  const events = parseEditorialEvents([
    { v, ts: 0, type: "run_started", pages: 1, model: "m", doc_title: "t" },
    { v, ts: 1, type: "page_started", page: 1, label: "1", blocks: 3 },
    { v, ts: 2, type: "translate_call", page: 1, attempt: 1, blocks: [] },
    { v, ts: 3, type: "check_result", page: 1, attempt: 1, ok: 3, warn: 0, error: 0, codes: {} },
    { v, ts: 4, type: "translate_call", page: 1, attempt: 1, blocks: [], role: "reviewer" },
  ]);
  assert.equal(events[2].role, "translator");
  assert.equal(stationPages(roomStateAt(events, 3)).translator.page, 1);
  const reviewing = roomStateAt(events, 5);
  assert.equal(stationPages(reviewing).reviewer.page, 1);
  assert.equal(stationPages(reviewing).translator, null);
  assert.match(narrate(events[4]).text, /审校/);
});

test("广播只念不合格和警告的代码，info（只算指标）不念；不认识的代码照原样", () => {
  const [event] = parseEditorialEvents([
    { v, ts: 0, type: "check_result", page: 2, attempt: 1, ok: 4, warn: 1, error: 1,
      codes: { footnote_mark_lost: 1, term_mismatch: 1, hedge_lost: 2, review_fluency: 1, brand_new_code: 1 } },
  ]);
  const text = narrate(event).text;
  assert.match(text, /脚注标记丢了 1/);
  assert.match(text, /术语没照用 1/);
  assert.match(text, /brand_new_code 1/);
  assert.doesNotMatch(text, /hedge_lost|review_fluency/);
});
