import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

test("Reader AI 对话区是可收缩的独立滚动视口", async () => {
  const css = await readFile(
    new URL("../../../../frontend/packages/reader/styles/float-ai-aui.css", import.meta.url),
    "utf8",
  );
  const viewportRule = css.match(/\.reader-float-ai \.aui-viewport\s*\{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(viewportRule, /flex:\s*1 1 0\s*;/);
  assert.match(viewportRule, /min-height:\s*0\s*;/);
  assert.match(viewportRule, /height:\s*0\s*;/);
  assert.match(viewportRule, /overflow-y:\s*auto\s*;/);
  assert.match(viewportRule, /touch-action:\s*pan-y\s*;/);
  assert.doesNotMatch(viewportRule, /min-height:\s*min\(/);
});

test("Reader AI 流式增长时尊重用户上滑，手动滚底后才恢复跟随", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/reader.html",
    pretendToBeVisual: true,
  });
  for (const key of [
    "window",
    "document",
    "location",
    "Element",
    "HTMLElement",
    "Event",
    "MouseEvent",
    "MutationObserver",
    "Node",
    "NodeFilter",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      writable: true,
      configurable: true,
    });
  }
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  dom.window.HTMLElement.prototype.scrollTo = function scrollTo(options) {
    const requestedTop = typeof options === "number" ? options : Number(options?.top || 0);
    this.scrollTop = Math.min(requestedTop, Math.max(0, this.scrollHeight - this.clientHeight));
    this.dispatchEvent(new dom.window.Event("scroll"));
  };
  const resizeObservers = new Set();
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
      resizeObservers.add(this);
    }
    observe(target) {
      this.target = target;
      this.flush(100);
    }
    disconnect() {
      resizeObservers.delete(this);
    }
    flush(height) {
      if (!this.target) return;
      this.callback([{ target: this.target, contentRect: { height } }]);
    }
  };
  const flushResize = (height) => {
    for (const observer of resizeObservers) observer.flush(height);
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { setReaderAdapters } = await import("../../../../frontend/packages/reader/src/adapters.ts");
  const { ReaderAssistantThread } = await import(
    "../../../../frontend/packages/reader/src/components/react-pdf/assistant/ReaderAssistantThread.tsx"
  );
  setReaderAdapters({
    credentialsPort: { getCredentials: () => ({ modelApiKey: "test" }) },
  });

  const root = createRoot(document.getElementById("root"));
  const render = (content) => root.render(React.createElement(ReaderAssistantThread, {
    jobId: "job-scroll",
    messages: [{
      id: "answer-1",
      role: "assistant",
      content,
      status: { type: "running" },
    }],
    streamingAssistantId: "answer-1",
    isRunning: true,
    onSubmit() {},
    onRetry() {},
    onCancel() {},
  }));

  try {
    render("第一段回答");
    await wait();
    const viewport = document.querySelector("[data-reader-ai-viewport='true']");
    assert.ok(viewport, "assistant-ui ThreadPrimitive.Viewport 应作为真正的滚动容器");

    let scrollHeight = 1000;
    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      get: () => 300,
    });
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      writable: true,
      value: 700,
    });

    render("第一段回答，准备继续生成。");
    flushResize(200);
    await wait(80);
    assert.equal(viewport.scrollTop, 700, "初始贴底状态应跟随新内容");

    viewport.scrollTop = 120;
    viewport.dispatchEvent(new dom.window.Event("scroll"));
    await wait(30);
    assert.equal(viewport.scrollTop, 120, "上滑事件应立即取消自动跟随");
    scrollHeight = 1300;
    render("第一段回答\n\n第二段正在生成，内容继续增长。");
    flushResize(300);
    await wait(80);
    assert.equal(viewport.scrollTop, 120, "用户上滑后不得被流式回答拖回底部");

    document.querySelector("button[aria-label='滚到最新']").click();
    await wait(30);
    assert.equal(viewport.scrollTop, 1000);

    scrollHeight = 1600;
    render("第一段回答\n\n第二段正在生成，内容继续增长。\n\n第三段。");
    flushResize(400);
    await wait(80);
    assert.equal(viewport.scrollTop, 1300, "手动滚到最新后应恢复跟随");
  } finally {
    root.unmount();
    setReaderAdapters(null);
    dom.window.close();
  }
});
