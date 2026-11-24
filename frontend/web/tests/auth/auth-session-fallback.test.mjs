// 没有 AuthSessionProvider 时 useAuthSession 当单机处理，而且每次 render 给同一个对象：
// 以前每次新建，拿它当依赖的 effect / memo 每次都跑，effect 里再写 store 就是 React #185（2026-11-24 加固）。
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "Node"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key] ?? dom.window, writable: true, configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { act, createElement, useState } = await import("react");
const { createRoot } = await import("react-dom/client");
const { useAuthSession } = await import("../../src/features/auth/ui/auth-session-context.js");

test("没有 Provider：单机会话，多次 render 是同一个对象", () => {
  const seen = [];
  let rerender;
  function Probe() {
    const [, setTick] = useState(0);
    rerender = () => setTick((n) => n + 1);
    seen.push(useAuthSession());
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(createElement(Probe)));
  act(() => rerender());
  act(() => root.unmount());
  assert.ok(seen.length >= 2);
  assert.equal(seen[0].mode, "single");
  assert.equal(seen[0].authenticated, true);
  assert.equal(seen[1], seen[0]);
});
