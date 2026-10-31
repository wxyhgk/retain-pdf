/** 编辑部画面：工位手上的页、累计数字、回放按钮（不自动播，靠单步和拖进度条，测试里没有定时器）。 */
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { click, makeDom } from "../helpers/dom.mjs";

async function mount(element) {
  const { createRoot } = await import("react-dom/client");
  const host = globalThis.document.createElement("div");
  globalThis.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(element);
  return { host, unmount: () => root.unmount() };
}

const stat = (host, key) => host.querySelector(`[data-editorial-stat="${key}"] dd`).textContent;
const holding = (host, station) =>
  host.querySelector(`[data-editorial-station="${station}"]`).getAttribute("data-editorial-holding");

test("画面：第 N 页在审校、第 N+1 页在译者手上；数字、术语表、待人看、筹备中的工位", async () => {
  makeDom();
  const React = await import("react");
  const room = await import("../../src/features/editorial-room/index.ts");
  const events = room.buildDemoEditorialRun();
  // 找到「第 1 页开审、第 2 页刚开翻」那一刻。
  const index = events.findIndex((event) => event.type === "translate_call" && event.page === 2) + 1;
  const state = room.roomStateAt(events, index);
  const { host, unmount } = await mount(React.createElement(room.EditorialRoom, { state, recent: events.slice(0, index).reverse() }));
  try {
    await waitFor(() => host.querySelector("[data-editorial-room]"));
    assert.equal(holding(host, "reviewer"), "1");
    assert.equal(holding(host, "translator"), "2");
    assert.equal(host.querySelector('[data-editorial-station="reviewer"]').dataset.busy, "true");
    assert.equal(host.querySelector('[data-editorial-station="checker"]').dataset.busy, "false");
    assert.equal(stat(host, "ok"), "6");
    assert.equal(stat(host, "retries"), "1");
    assert.equal(stat(host, "glossary"), "第 2 版");
    assert.equal(host.querySelectorAll("[data-editorial-planned]").length, 5);
    assert.equal(host.querySelector('[data-editorial-rail-page="2"]').className.includes("is-translating"), true);
    assert.match(host.querySelector(".editorial-room-log-line.is-latest").textContent, /译者开始翻第 2 页/);
    assert.equal(host.querySelector("[data-editorial-status-pill]").textContent, "翻译中");
  } finally {
    unmount();
  }
});

test("停下了：状态写清原因，停在哪页还看得出来", async () => {
  makeDom();
  const React = await import("react");
  const room = await import("../../src/features/editorial-room/index.ts");
  const events = room.buildDemoEditorialRun({ stopAfterPage: 4 });
  const state = room.roomStateAt(events, events.length);
  const { host, unmount } = await mount(React.createElement(room.EditorialRoom, { state }));
  try {
    await waitFor(() => host.querySelector("[data-editorial-room]"));
    assert.equal(host.querySelector("[data-editorial-room]").dataset.editorialStatus, "stopped");
    assert.match(host.querySelector("[data-editorial-status-pill]").textContent, /额度用完了/);
    assert.equal(stat(host, "done"), "4 / 6");
    assert.equal(host.querySelector("[data-editorial-basket]").dataset.editorialBasket, "1");
    assert.equal(host.querySelectorAll("[data-editorial-ticket]").length, 1);
  } finally {
    unmount();
  }
});

test("调试视图的回放：不自动播时停在开头；单步一条条叠，拖进度条直接到最后", async () => {
  const dom = makeDom();
  const React = await import("react");
  const room = await import("../../src/features/editorial-room/index.ts");
  const events = room.buildDemoEditorialRun();
  const { host, unmount } = await mount(React.createElement(room.EditorialRoomReplay, { events, autoplay: false, debug: true }));
  try {
    await waitFor(() => host.querySelector("[data-editorial-replay]"));
    const count = () => host.querySelector(".editorial-room-count").textContent.replace(/\s+/g, "");
    assert.equal(count(), `0/${events.length}`);
    assert.equal(host.querySelector("[data-editorial-room]").dataset.editorialStatus, "idle");

    click(dom, host.querySelector('[data-editorial-control="step"]'));
    await waitFor(() => count() === `1/${events.length}`, `单步后 ${count()}`);
    assert.equal(host.querySelector("[data-editorial-room]").dataset.editorialStatus, "running");

    const seek = host.querySelector('[data-editorial-control="seek"]');
    const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
    setValue.call(seek, String(events.length));
    seek.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await waitFor(() => count() === `${events.length}/${events.length}`, `拖到最后 ${count()}`);
    assert.equal(host.querySelector("[data-editorial-room]").dataset.editorialStatus, "done");
    assert.equal(host.querySelector('[data-editorial-control="step"]').disabled, true);

    click(dom, host.querySelector('[data-editorial-speed="4"]'));
    await waitFor(() => host.querySelector('[data-editorial-speed="4"]').getAttribute("aria-checked") === "true");
  } finally {
    unmount();
  }
});

test("用户视图（2.5D 编辑部）：三个人、两个机器人、闸门和档案柜；忙的人头上一个词；没有数字卡片和按钮", async () => {
  makeDom();
  const React = await import("react");
  const room = await import("../../src/features/editorial-room/index.ts");
  const events = room.buildDemoEditorialRun();
  const index = events.findIndex((event) => event.type === "translate_call" && event.page === 2) + 1;
  const { host, unmount } = await mount(React.createElement(room.EditorialStage, { state: room.roomStateAt(events, index) }));
  try {
    await waitFor(() => host.querySelector("[data-editorial-office]"));
    const seats = [...host.querySelectorAll("[data-editorial-seat]")].map((seat) => seat.dataset.editorialSeat).sort();
    assert.deepEqual(seats, ["reader", "reviewer", "translator"]);
    const stations = [...host.querySelectorAll("[data-editorial-station]")].map((node) => node.dataset.editorialStation).sort();
    assert.deepEqual(stations, ["archive", "checker", "dispatcher", "reviser"]);
    assert.equal(host.querySelectorAll("[data-editorial-planned]").length, 5, "筹备中的工位画成灰色空桌");
    const tags = [...host.querySelectorAll(".editorial-room-office-tag text")].map((node) => node.textContent).sort();
    assert.deepEqual(tags, ["审第 1 页", "翻译第 2 页"]);
    const sheets = [...host.querySelectorAll(".editorial-room-office-sheet")].map((node) => `${node.dataset.editorialPage}:${node.dataset.editorialStage}`).sort();
    assert.deepEqual(sheets, ["1:reviewing", "2:translating"], "稿纸停在各自工位前的传送带上");
    assert.equal(host.querySelector('[data-editorial-seat="reader"]').dataset.busy, "false");
    assert.equal(host.querySelector('[data-editorial-station="dispatcher"]').dataset.busy, "true", "还有页没派");
    assert.equal(host.querySelector("[data-editorial-progress]").textContent.replace(/\s+/g, ""), "第1/6页");
    assert.equal(host.querySelector("[data-editorial-now]").textContent, "译者翻译第 2 页，审校审第 1 页");
    assert.equal(host.querySelectorAll("[data-editorial-stat], button").length, 0);
    assert.equal(host.querySelector("[data-editorial-attention]"), null, "没有要人看的就不出现");
    assert.match(host.querySelector('[data-editorial-seat="translator"] title').textContent, /第 2 页，第 1 次 · 8 块/, "细节在悬停提示里");
  } finally {
    unmount();
  }
});

test("用户视图：退回重翻时稿纸回到译者、闸门亮红；术语表改了白板闪、出轻提示；跑完都进档案柜", async () => {
  makeDom();
  const React = await import("react");
  const room = await import("../../src/features/editorial-room/index.ts");
  const events = room.buildDemoEditorialRun();
  const render = (n) => mount(React.createElement(room.EditorialStage, { state: room.roomStateAt(events, n) }));

  const failed = await render(events.findIndex((event) => event.type === "check_result" && event.error > 0) + 1);
  try {
    await waitFor(() => failed.host.querySelector("[data-editorial-office]"));
    assert.equal(failed.host.querySelector('[data-editorial-station="checker"]').dataset.tone, "error");
  } finally {
    failed.unmount();
  }
  const paperAt = (host, stage) =>
    host.querySelector(`.editorial-room-office-sheet[data-editorial-stage="${stage}"] polygon`).getAttribute("points");
  const translating = await render(events.findIndex((event) => event.type === "translate_call") + 1);
  let translatorSpot = "";
  try {
    await waitFor(() => translating.host.querySelector("[data-editorial-office]"));
    translatorSpot = paperAt(translating.host, "translating");
  } finally {
    translating.unmount();
  }
  const retry = await render(events.findIndex((event) => event.type === "retry") + 1);
  try {
    await waitFor(() => retry.host.querySelector("[data-editorial-office]"));
    assert.equal(paperAt(retry.host, "retrying"), translatorSpot, "退回的稿纸回到译者桌前");
    assert.match(retry.host.querySelector(".editorial-room-office-tag text").textContent, /重翻第 1 页/);
  } finally {
    retry.unmount();
  }
  const glossary = await render(events.findIndex((event) => event.type === "glossary_changed") + 1);
  try {
    await waitFor(() => glossary.host.querySelector("[data-editorial-glossary-hint]"));
    assert.ok(glossary.host.querySelector(".editorial-room-office-whiteboard.is-fresh"));
    assert.equal(glossary.host.querySelector("[data-editorial-now]").textContent, "通读员在读全书");
    assert.equal(glossary.host.querySelector(".editorial-room-office-tag text").textContent, "读书中");
  } finally {
    glossary.unmount();
  }
  const end = await render(events.length);
  try {
    await waitFor(() => end.host.querySelector("[data-editorial-office]"));
    assert.equal(end.host.querySelector("[data-editorial-progress]").dataset.editorialProgress, "6/6");
    assert.equal(end.host.querySelector('[data-editorial-station="archive"]').dataset.done, "6");
    assert.equal(end.host.querySelectorAll(".editorial-room-office-paper.is-filed.is-flagged").length, 1, "退回原文的那页标红");
    assert.equal(end.host.querySelector("[data-editorial-attention]").textContent, "需要人看 1 处");
    assert.equal(end.host.querySelector("[data-editorial-now]").textContent, "全部翻完了");
    assert.equal(end.host.querySelector("[data-editorial-glossary-hint]"), null, "提示过几条事件就收起");
    assert.equal(end.host.querySelectorAll(".editorial-room-office-sheet, .editorial-room-office-tag").length, 0, "跑完了传送带上没有稿子、没人忙");
  } finally {
    end.unmount();
  }
});

test("长书翻完：档案柜上的纸堆封顶，不顶出画面；退回原文的页所在那叠标红", async () => {
  makeDom();
  const React = await import("react");
  const room = await import("../../src/features/editorial-room/index.ts");
  const events = room.buildDemoEditorialRun();
  const end = room.roomStateAt(events, events.length);
  const template = end.pages.find((card) => !card.fallback);
  const pages = Array.from({ length: 106 }, (_, i) => ({
    ...template,
    page: i + 1,
    label: String(i + 1),
    fallback: i === 99 ? 1 : 0,
  }));
  const { host, unmount } = await mount(React.createElement(room.EditorialStage, { state: { ...end, pages } }));
  try {
    await waitFor(() => host.querySelector("[data-editorial-office]"));
    assert.equal(host.querySelector('[data-editorial-station="archive"]').dataset.done, "106");
    assert.equal(host.querySelectorAll(".editorial-room-office-paper.is-filed").length, 10, "106 页也只叠 10 张高");
    assert.equal(host.querySelectorAll(".editorial-room-office-paper.is-filed.is-flagged").length, 1);
    assert.match(host.querySelector('[data-editorial-station="archive"] title').textContent, /定稿 106 \/ 106 页/);
  } finally {
    unmount();
  }
});

test("默认回放是用户视图：没有按钮，不显示调试信息", async () => {
  makeDom();
  const React = await import("react");
  const room = await import("../../src/features/editorial-room/index.ts");
  const events = room.buildDemoEditorialRun();
  const { host, unmount } = await mount(React.createElement(room.EditorialRoomReplay, { events, autoplay: false }));
  try {
    await waitFor(() => host.querySelector("[data-editorial-stage]"));
    assert.equal(host.querySelector("[data-editorial-room]"), null);
    assert.equal(host.querySelectorAll("button").length, 0);
  } finally {
    unmount();
  }
});
