// useStoreSnapshot：同一个 store 已经有人订阅时，后挂上的组件不能再换缓存里的快照引用。
//
// 以前每次订阅都 snapshotCache.set(store, store.getSnapshot())，而 getSnapshot() 每次都是新克隆：
// 后挂的组件订阅完一自查就发现「快照变了」，白白补一次渲染；要是哪个组件每次 render 都重新订阅，
// 就是订阅 → 换引用 → 重渲染 → 再订阅的死循环（React #185，桌面端报过，2026-11-24 加固）。
// 现在只在「没有别的订阅者、缓存可能过期」时对齐（那条见 use-store-stale-snapshot.test.mjs）。

import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "navigator"]) {
  try {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  } catch (_err) { /* navigator 只读时忽略 */ }
}
globalThis.window = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { createStore } = await import("../../src/platform/store/store.js");
const { useStoreSnapshot } = await import("../../src/ui/hooks/use-store.js");

function mountProbe(store) {
  const renders = [];
  function Probe() {
    renders.push(useStoreSnapshot(store));
    return null;
  }
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(Probe));
  });
  return {
    renders,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function makeStore() {
  return createStore({
    name: "shared-snapshot",
    initialState: { count: 0 },
    actions: { bump: (state) => ({ ...state, count: state.count + 1 }) },
  });
}

test("后挂上的订阅者不换快照引用：只渲染一次，和先挂的拿到同一个对象", () => {
  const store = makeStore();
  // 第一个订阅者挂载时会对齐一次缓存（可能多渲染一次，见 use-store-stale-snapshot.test.mjs），这里不管。
  const first = mountProbe(store);
  const firstRenders = first.renders.length;
  const second = mountProbe(store);
  assert.equal(second.renders.length, 1, `后挂的组件不该被「快照变了」补渲染，实际 ${second.renders.length} 次`);
  assert.equal(second.renders.at(-1), first.renders.at(-1), "两个订阅者应读到同一个快照对象");
  assert.equal(first.renders.length, firstRenders, "先挂的组件不受影响");

  act(() => {
    store.actions.bump();
  });
  assert.equal(first.renders.at(-1).count, 1);
  assert.equal(second.renders.at(-1), first.renders.at(-1), "写入后两边仍是同一个快照");
  first.unmount();
  second.unmount();
});

test("先挂的卸了、后挂的还在：再挂上来照样读到最新值", () => {
  const store = makeStore();
  const first = mountProbe(store);
  const second = mountProbe(store);
  first.unmount();
  act(() => {
    store.actions.bump();
  });
  const third = mountProbe(store);
  assert.equal(third.renders.at(-1).count, 1);
  assert.equal(third.renders.length, 1);
  second.unmount();
  third.unmount();
});
