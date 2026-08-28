import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// 上传弹窗：完成后二选一——直接翻译 / 仅收藏（不自动关窗入库）。

function makeDom(search = "") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `http://localhost/index.html${search}`,
  });
  for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  }
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
  assert.fail(`等待超时：${description}`);
}

function click(dom, element) {
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

async function bootHomeApp(dom) {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { createHomeComposition } = await import("../src/pages/home/composition.js");
  const { HomeApp } = await import("../src/pages/home/HomeApp.jsx");

  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);

  const services = createHomeComposition({
    fetchGlossaries: async () => ({ items: [] }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
  services.initialize();

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => dom.window.document.getElementById("app-shell"), "HomeApp 首帧渲染");
  await wait(0);
  return { services, root, host };
}

test("上传弹窗：标题提示 + 就绪后出现直接翻译/仅收藏", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);

  click(dom, byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "添加对话框打开");
  assert.equal(byId("translation-workflow-title").textContent, "Thêm PDF");
  assert.match(byId("translation-workflow-desc").textContent, /直接翻译|收藏/);

  // 模拟上传完成
  services.uploadViewActions.patch({ ready: true, actionSlotVisible: true });
  await waitFor(() => byId("store-only-btn") && !byId("store-only-btn").classList.contains("hidden"), "仅收藏可见");
  await waitFor(() => byId("upload-ready-hint") && !byId("upload-ready-hint").classList.contains("hidden"), "就绪提示可见");
  assert.ok(byId("submit-btn"), "直接翻译按钮存在");
  assert.match(byId("submit-btn").textContent, /直接翻译|提交/);

  // 对话框仍打开（不自动关）
  assert.ok(byId("translation-workflow-dialog"), "就绪后不自动关闭");

  root.unmount();
  services.dispose();
  host.remove();
});

test("仅收藏：关闭对话框且不提交翻译 job", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);
  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");

  click(dom, byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "添加对话框打开");

  let jobSubmitted = false;
  dom.window.document.addEventListener(APP_EVENTS.libraryJobCreated, () => { jobSubmitted = true; });

  services.uploadViewActions.patch({ ready: true, actionSlotVisible: true });
  await waitFor(() => byId("store-only-btn") && !byId("store-only-btn").classList.contains("hidden"), "仅收藏可见");
  click(dom, byId("store-only-btn"));

  await waitFor(() => byId("translation-workflow-dialog") === null, "仅收藏后关闭对话框");
  await wait(50);
  assert.equal(jobSubmitted, false, "仅收藏不提交翻译 job");

  root.unmount();
  services.dispose();
  host.remove();
});
