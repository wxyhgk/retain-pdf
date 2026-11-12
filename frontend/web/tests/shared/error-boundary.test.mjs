/** 出错兜底（@retainpdf/ui 的 ErrorBoundary）。
 *
 * 起因：全仓没有一个 ErrorBoundary，任何组件渲染时抛错，React 会卸掉整棵树，整页白屏；
 * 用户只能说「坏了」，我们拿不到调用栈。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeDom } from "../helpers/dom.mjs";
import { waitFor } from "../helpers/async.mjs";

async function mount(element) {
  const dom = makeDom("", { html: "<!doctype html><html><body><div id='root'></div></body></html>" });
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const root = createRoot(dom.window.document.getElementById("root"), {
    // 测试里不要 React 把预期中的错误刷到输出里。
    onCaughtError: () => {},
  });
  await act(async () => { root.render(element); });
  return {
    dom,
    root,
    text: () => dom.window.document.body.textContent,
    query: (selector) => dom.window.document.querySelector(selector),
    async rerender(next) { await act(async () => { root.render(next); }); },
    async click(element) {
      await act(async () => { element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
    },
    close() { root.unmount(); dom.window.close(); },
  };
}

test("子组件渲染出错：换成说明卡，不白屏；兄弟节点不受影响", async () => {
  const React = await import("react");
  const { ErrorBoundary } = await import("@retainpdf/ui");
  function Boom() { throw new Error("读不到 stations"); }
  const caught = [];
  const view = await mount(React.createElement("div", null,
    React.createElement("p", { id: "sibling" }, "左栏"),
    React.createElement(ErrorBoundary, { scope: "section", label: "「进度」页", onError: (error) => caught.push(error.message) },
      React.createElement(Boom))));
  try {
    assert.ok(view.query(".ui-error-fallback[role=alert]"), "没画出说明卡");
    assert.match(view.text(), /「进度」页出错了/);
    assert.match(view.text(), /读不到 stations/);
    assert.match(view.text(), /页面其他部分不受影响/);
    assert.equal(view.query("#sibling")?.textContent, "左栏", "兄弟节点被一起卸掉了");
    assert.deepEqual(caught, ["读不到 stations"]);
  } finally {
    view.close();
  }
});

test("「再试一次」重新渲染子树；好了就回到正常内容", async () => {
  const React = await import("react");
  const { ErrorBoundary } = await import("@retainpdf/ui");
  let broken = true;
  function Flaky() {
    if (broken) throw new Error("瞬时错误");
    return React.createElement("p", { id: "ok" }, "正常内容");
  }
  const view = await mount(React.createElement(ErrorBoundary, { scope: "page" }, React.createElement(Flaky)));
  try {
    assert.match(view.text(), /页面出错了/);
    broken = false;
    const retry = [...view.dom.window.document.querySelectorAll(".ui-error-fallback-action")].find((b) => b.textContent === "再试一次");
    await view.click(retry);
    await waitFor(() => view.query("#ok"), "再试一次后回到正常内容");
    assert.equal(view.query(".ui-error-fallback"), null);
  } finally {
    view.close();
  }
});

test("resetKeys 变了（换了一本书）自动退出出错状态；没变就保持", async () => {
  const React = await import("react");
  const { ErrorBoundary } = await import("@retainpdf/ui");
  function Book({ id }) {
    if (id === "bad") throw new Error("这本书的数据坏了");
    return React.createElement("p", { id: "book" }, id);
  }
  const tree = (id) => React.createElement(ErrorBoundary, { resetKeys: [id] }, React.createElement(Book, { id }));
  const view = await mount(tree("bad"));
  try {
    assert.ok(view.query(".ui-error-fallback"));
    await view.rerender(tree("bad"));
    assert.ok(view.query(".ui-error-fallback"), "同一本书重渲染不该自己恢复");
    await view.rerender(tree("good"));
    assert.equal(view.query("#book")?.textContent, "good");
  } finally {
    view.close();
  }
});

test("错误详情：带时间、位置、页面路径、错误和两种调用栈；页面地址不带域名", async () => {
  const { errorDiagnosticText } = await import("@retainpdf/ui");
  const error = new TypeError("Cannot read properties of undefined (reading 'map')");
  const text = errorDiagnosticText({
    error,
    componentStack: "\n    at ProcessingTab\n    at BookDetailDialog",
    label: "「进度」页",
    now: new Date("2026-11-12T08:00:00Z"),
    location: { pathname: "/index.html", search: "?doc=1" },
    userAgent: "TestUA",
  });
  assert.match(text, /^时间: 2026-11-12T08:00:00.000Z/);
  assert.match(text, /位置: 「进度」页/);
  assert.match(text, /页面: \/index.html\?doc=1/);
  assert.match(text, /错误: TypeError: Cannot read properties of undefined/);
  assert.match(text, /调用栈:\n/);
  assert.match(text, /组件栈:\n {4}at ProcessingTab/);
  assert.doesNotMatch(text, /https?:\/\//);
});

test("每个页面入口都套了整页兜底；书籍详情每个页签各套一层", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  assert.match(read("../../src/app/shell-boot.ts"), /createElement\(ErrorBoundary, \{ scope: "page" \}, app\)/,
    "mountShellPage（首页、详情页、编辑部、管理页共用）没有套兜底");
  assert.match(read("../../../packages/reader/src/boot.tsx"), /<ErrorBoundary scope="page"[^>]*><ReaderApp \/><\/ErrorBoundary>/,
    "阅读页没有套兜底");
  assert.match(read("../../src/features/book-detail/ui/tabs/BookDetailRightTabs.tsx"), /<ErrorBoundary scope="section"/,
    "书籍详情的页签没有各自的兜底");
});
