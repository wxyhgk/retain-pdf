import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function makeDom() {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/index.html",
  });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLButtonElement",
    "Element",
    "SVGElement",
    "CustomEvent",
    "Event",
    "KeyboardEvent",
    "MouseEvent",
    "Node",
    "MutationObserver",
    "NodeFilter",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      configurable: true,
      writable: true,
    });
  }
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

function click(dom, element) {
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    button: 0,
  }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`等待超时：${description}`);
}

test("不明确的翻译阶段必须二次确认重复调用风险", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { TranslationStageActions } = await import(
    "../../src/features/book-detail/ui/panels/translate/TranslationStageActions.jsx"
  );
  const calls = [];
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(TranslationStageActions, {
    actions: [{
      stage: "translation",
      label: "重试翻译",
      can_retry: true,
      danger: true,
      disabled_reason: "request outcome is ambiguous",
    }],
    onRetry: async (...args) => calls.push(args),
  }));

  const retryButton = await waitFor(
    () => dom.window.document.getElementById("book-detail-retry-translation-btn"),
    "重新翻译按钮",
  );
  click(dom, retryButton);
  await waitFor(
    () => dom.window.document.getElementById("book-detail-translation-risk-confirm"),
    "重复风险确认框",
  );
  assert.equal(calls.length, 0, "打开确认框不能直接提交");
  click(dom, dom.window.document.getElementById("book-detail-translation-risk-confirm-confirm"));
  await waitFor(() => calls.length === 1, "确认后提交");
  assert.deepEqual(calls[0], ["translation", { acceptDuplicateRisk: true }]);

  root.unmount();
  dom.window.close();
});

test("阶段能力读取期间固定展示重新翻译和重新渲染按钮", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { TranslationStageActions } = await import(
    "../../src/features/book-detail/ui/panels/translate/TranslationStageActions.jsx"
  );
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(TranslationStageActions, {
    actions: [],
    loading: true,
    onRetry: async () => {},
  }));

  const translation = await waitFor(
    () => dom.window.document.getElementById("book-detail-retry-translation-btn"),
    "加载态重新翻译按钮",
  );
  const render = dom.window.document.getElementById("book-detail-retry-render-btn");
  assert.ok(render, "加载态同时保留重新渲染按钮");
  assert.equal(translation.disabled, true);
  assert.equal(render.disabled, true);
  assert.equal(translation.textContent.trim(), "重新翻译");
  assert.equal(render.textContent.trim(), "重新渲染");
  assert.equal(
    dom.window.document.querySelector('[data-translation-stage-actions="true"]')?.getAttribute("aria-busy"),
    "true",
  );

  root.unmount();
  dom.window.close();
});
