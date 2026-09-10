import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// 上传弹窗：先选择翻译 / 仅 OCR 模式，再上传并执行当前模式或仅收藏。

function makeDom(search = "") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `http://localhost/index.html${search}`,
  });
  for (const key of ["window", "document", "DocumentFragment", "HTMLElement", "HTMLButtonElement", "HTMLFormElement", "HTMLInputElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
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
  const { createHomeComposition } = await import("../../src/app/home/create-home-composition.js");
  const { HomeApp } = await import("../../src/app/home/HomeApp.jsx");

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

test("上传弹窗：恢复顶部模式切换 + 就绪后执行当前模式或仅收藏", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);

  click(dom, byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "添加对话框打开");
  assert.equal(byId("translation-workflow-title").textContent, "添加 PDF");
  assert.equal(byId("translation-workflow-title").classList.contains("sr-only"), true);
  assert.equal(byId("translation-workflow-desc"), null);
  assert.ok(byId("ocr-only-toggle"), "顶部模式切换存在");
  assert.equal(byId("file-label").textContent, "点击选择文件或拖到这里");

  // 模拟上传完成
  services.uploadViewActions.patch({ ready: true, actionSlotVisible: true });
  await waitFor(() => !byId("store-only-btn").disabled, "仅收藏动作可用");
  await waitFor(() => dom.window.document.querySelector(".upload-tile.is-ready"), "上传区进入就绪态");
  assert.ok(byId("page-range-btn"), "文件就绪后显示翻译选项入口");
  assert.equal(byId("store-only-btn").textContent.trim(), "仅收藏");
  assert.match(byId("submit-btn").textContent.trim(), /翻译/);

  const ocrModeTab = dom.window.document.querySelector('[aria-label="仅 OCR 模式"]');
  assert.ok(ocrModeTab, "仅 OCR 模式入口存在");
  click(dom, ocrModeTab);
  await waitFor(() => byId("submit-btn").textContent.trim() === "开始 OCR", "切换为 OCR 主动作");

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
  const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");

  click(dom, byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "添加对话框打开");

  let jobSubmitted = false;
  dom.window.document.addEventListener(APP_EVENTS.libraryJobCreated, () => { jobSubmitted = true; });

  services.uploadViewActions.patch({ ready: true, actionSlotVisible: true });
  await waitFor(() => !byId("store-only-btn").disabled, "仅收藏可选择");
  click(dom, byId("store-only-btn"));

  await waitFor(() => byId("translation-workflow-dialog") === null, "仅收藏后关闭对话框");
  await wait(50);
  assert.equal(jobSubmitted, false, "仅收藏不提交翻译 job");

  root.unmount();
  services.dispose();
  host.remove();
});
