// 桌面端第一次启动、什么都没配：要弹出设置窗口（接口设置、首配模式）。
// 以前靠发 DOM 事件，但启动走到这里时设置弹窗的监听还没挂上（effect 比它晚约 25ms），事件没人接，
// 窗口弹不出来（2026-11-24 查 #185 时顺带发现）。现在首页入口传「直接写弹窗 store」进来。
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "localStorage"]) {
  try {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  } catch (_err) { /* 只读时忽略 */ }
}

const { bootstrapDesktop } = await import("../../src/app/desktop/bootstrap.js");
const { APP_EVENTS } = await import("../../src/platform/contracts/app-contract.js");

function captureEvents() {
  const events = [];
  const listener = (event) => events.push(event.detail);
  document.addEventListener(APP_EVENTS.openBrowserCredentials, listener);
  return { events, stop: () => document.removeEventListener(APP_EVENTS.openBrowserCredentials, listener) };
}

test("没配置：调传进来的 openSetupDialog，不再发没人接的事件", async () => {
  const opened = [];
  const capture = captureEvents();
  await bootstrapDesktop({ browserConfig: {}, developerConfig: {} }, { openSetupDialog: () => opened.push(true) });
  capture.stop();
  assert.equal(opened.length, 1);
  assert.equal(capture.events.length, 0);
});

test("已配置：不弹", async () => {
  const opened = [];
  await bootstrapDesktop(
    { browserConfig: {}, developerConfig: {}, firstRunCompleted: true },
    { openSetupDialog: () => opened.push(true) },
  );
  assert.equal(opened.length, 0);
});

test("不传 openSetupDialog：照旧发事件（老调用方）", async () => {
  const capture = captureEvents();
  await bootstrapDesktop({ browserConfig: {}, developerConfig: {} });
  capture.stop();
  assert.equal(capture.events.length, 1);
  assert.equal(capture.events[0]?.setupMode, true);
});
