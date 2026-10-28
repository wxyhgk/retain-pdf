/** 终端作用域条：物化要几秒，期间用户切到别的标签。结果要写回点击时的那条标签，
 * 不能写回「物化完那一刻的当前标签」——以前在标签 1 点了文件夹、物化中切到标签 2，
 * 换作用域的是标签 2。忙碌态也只挂在发起的那条标签上。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "Node", "Event", "MouseEvent", "navigator"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { TerminalScopeBar } = await import("../../src/features/reader/ui/terminal-chrome.tsx");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("物化期间切了标签，作用域写回点击时的那条标签", async () => {
  const oldFetch = globalThis.fetch;
  let finishWorkspace;
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(String(url)).pathname;
    if ((init.method || "GET") === "POST" && path.endsWith("/agent-workspace")) {
      await new Promise((resolve) => { finishWorkspace = resolve; });
      return Response.json({ code: 0, data: { books: [{ job_id: "job-1" }] } });
    }
    return Response.json({ code: 0, data: { collections: [{ collection_id: "col-a", name: "化学", document_count: 2 }] } });
  };
  const changes = [];
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = (tabId) => root.render(React.createElement(TerminalScopeBar, {
    tabId,
    scope: { kind: "job", jobId: "job-1" },
    jobId: "job-1",
    onChange: (...args) => changes.push(args),
  }));
  try {
    await React.act(async () => { render("tab-1"); await tick(); });
    const folder = [...host.querySelectorAll("button")].find((button) => button.textContent.includes("化学"));
    assert.ok(folder, "文件夹按钮出现");

    await React.act(async () => { folder.click(); await tick(); });
    assert.equal(folder.disabled, true, "标签 1 物化中，按钮禁用");

    // 物化还没完，用户切到标签 2
    await React.act(async () => { render("tab-2"); await tick(); });
    const onTab2 = [...host.querySelectorAll("button")].find((button) => button.textContent.includes("化学"));
    assert.equal(onTab2.disabled, false, "标签 2 没在物化，不该跟着禁用");

    await React.act(async () => { finishWorkspace(); await tick(); await tick(); });
    assert.equal(changes.length, 1);
    assert.equal(changes[0][0], "tab-1", "作用域写回点击时的标签 1，而不是当前的标签 2");
    assert.equal(changes[0][1].kind, "collection");
    assert.equal(changes[0][1].collectionId, "col-a");
  } finally {
    await React.act(async () => root.unmount());
    host.remove();
    globalThis.fetch = oldFetch;
  }
});
