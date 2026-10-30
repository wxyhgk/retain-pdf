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

test("回放：不自动播时停在开头；单步一条条叠，拖进度条直接到最后", async () => {
  const dom = makeDom();
  const React = await import("react");
  const room = await import("../../src/features/editorial-room/index.ts");
  const events = room.buildDemoEditorialRun();
  const { host, unmount } = await mount(React.createElement(room.EditorialRoomReplay, { events, autoplay: false }));
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
