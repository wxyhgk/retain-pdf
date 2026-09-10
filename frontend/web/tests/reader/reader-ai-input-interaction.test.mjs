import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

test("AI 会话隔离不再吞掉 composer 的点击与输入焦点", async () => {
  const dom = new JSDOM(
    "<!doctype html><html><body><form data-reader-ai-composer><textarea class='aui-input'></textarea></form><button id='page-action'>page</button></body></html>",
    { url: "http://localhost/reader.html", pretendToBeVisual: true },
  );
  for (const key of ["window", "document", "Element", "HTMLElement", "Event", "Node"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      writable: true,
      configurable: true,
    });
  }

  const {
    armReaderAiClickShield,
    clearReaderAiNavigationLock,
  } = await import(
    `../../../../frontend/packages/reader/src/shared/ai/ui-interaction-lock.ts?input-test=${Date.now()}`
  );
  const input = document.querySelector("textarea");
  const pageAction = document.getElementById("page-action");
  let inputClicks = 0;
  let pageClicks = 0;
  input.addEventListener("click", () => {
    inputClicks += 1;
    input.focus();
  });
  pageAction.addEventListener("click", () => {
    pageClicks += 1;
  });

  armReaderAiClickShield(500);
  const marker = document.querySelector("[data-reader-ai-pointer-shield='1']");
  assert.ok(marker, "切换期仍应保留可观测状态标记");
  assert.equal(marker.style.pointerEvents, "none", "状态标记不能覆盖 composer");

  assert.equal(input.dispatchEvent(new dom.window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  })), true);
  assert.equal(inputClicks, 1);
  assert.equal(document.activeElement, input);

  assert.equal(pageAction.dispatchEvent(new dom.window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  })), false, "切换期仍应阻止阅读页上的误操作");
  assert.equal(pageClicks, 0);

  clearReaderAiNavigationLock();
  dom.window.close();
});

test("Markdown-only AI composer 不受翻译状态影响并保持可输入", async () => {
  const [appSource, threadSource, surfaceSource, primitivesSource, readingViewSource, operationsViewSource, panelSource, floatCss, notesCss, assistantCss] = await Promise.all([
    readFile(new URL("../../../../frontend/packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/src/components/react-pdf/assistant/ReaderAssistantThread.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/src/components/react-pdf/assistant/ReaderAssistantSurface.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/src/components/react-pdf/assistant/reader-assistant-primitives.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/src/components/react-pdf/assistant/ReaderReadingView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/src/components/react-pdf/assistant/ReaderOperationsView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/src/components/react-pdf/ReaderAiPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/styles/float-ai.css", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/styles/notes-float.css", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/styles/assistant-dock.css", import.meta.url), "utf8"),
  ]);

  assert.match(primitivesSource, /data-reader-ai-composer/);
  assert.match(primitivesSource, /aria-label="AI 模式"/);
  assert.match(primitivesSource, />阅读问答</);
  assert.match(primitivesSource, />PDF Agent</);
  assert.match(primitivesSource, /placeholder=\{mode === "operations" \? "描述要执行的 PDF 操作…" : "询问当前文档…"\}/);
  assert.match(panelSource, /assistantMode=\{assistantMode\}/);
  assert.match(primitivesSource, /<ComposerPrimitive\.Input[\s\S]*?autoFocus/);
  assert.match(readingViewSource, /<ThreadPrimitive\.ViewportFooter/);
  assert.match(operationsViewSource, /<ThreadPrimitive\.ViewportFooter/);
  assert.match(surfaceSource, /turnAnchor="top"/);
  assert.match(threadSource, /@assistant-ui\/react/);
  assert.match(surfaceSource, /data-chat-ui="assistant-ui-official-thread"/);
  assert.doesNotMatch(threadSource, /MutationObserver|useViewportStickBottom/);
  assert.doesNotMatch(surfaceSource, /MutationObserver|useViewportStickBottom/);
  assert.doesNotMatch(primitivesSource, /MutationObserver|useViewportStickBottom/);
  assert.doesNotMatch(threadSource, /components\/ai-elements/);
  assert.match(panelSource, /const enabled = open && Boolean\(jobId\)/);
  assert.match(panelSource, /layout === "workspace" \? "workspace"/);
  assert.match(panelSource, /showHeader=\{layout !== "workspace"\}/);
  assert.match(panelSource, /is-\$\{layout\}/);
  assert.doesNotMatch(panelSource, /!sourceOnly|sourceOnly \|\| !jobId/);
  assert.match(appSource, /is-workspace-\$\{workspaceView\}/);
  assert.match(appSource, /resolveReaderAiLayout\(_mode: string\): "workspace"/);
  assert.doesNotMatch(appSource, /tools\.close\("ai"\)/);
  assert.doesNotMatch(appSource, /retainpdf\.reader\.ai-layout/);
  assert.doesNotMatch(panelSource, /onLayoutChange|reader-ai-layout-toggle/);
  assert.match(appSource, /<ReaderAiPanel key=\{session\.documentId \|\| session\.jobId \|\| "reader-ai-pending"\}/);
  assert.doesNotMatch(appSource, /<ReaderAiPanel[^>]*sourceOnly=/);
  assert.doesNotMatch(panelSource, /aui-branch-pointer-shield/);
  assert.doesNotMatch(floatCss, /\.aui-branch-pointer-shield/);
  assert.match(floatCss, /\.reader-float-ai\.reader-notes-panel--docked/);
  assert.match(floatCss, /@media \(max-width: 899px\)[\s\S]*?\.reader-float-ai\.is-floating[\s\S]*?inset:\s*0 !important/);
  assert.match(assistantCss, /\.reader-react-root\.is-assistant-open \.reader-react-scroll-shell[\s\S]*?right:\s*var\(--reader-ai-split-width\)/);
  assert.doesNotMatch(notesCss, /\.reader-notes-panel--float\s*\{\s*touch-action:\s*none/);
});

test("assistant-ui Composer can type and submit in an OCR-only Reader", async () => {
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
    "HTMLTextAreaElement",
    "Event",
    "KeyboardEvent",
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
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  dom.window.HTMLElement.prototype.scrollTo = function scrollTo(options) {
    this.scrollTop = typeof options === "number" ? options : Number(options?.top || 0);
  };
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(callback) { this.callback = callback; }
    observe(target) { this.callback([{ target, contentRect: { height: 100 } }]); }
    disconnect() {}
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { setReaderAdapters } = await import("../../../../frontend/packages/reader/src/adapters.ts");
  const { ReaderAssistantThread } = await import(
    "../../../../frontend/packages/reader/src/components/react-pdf/assistant/ReaderAssistantThread.tsx"
  );
  setReaderAdapters({
    credentialsPort: { getCredentials: () => ({ modelApiKey: "test" }) },
  });
  const submitted = [];
  const root = createRoot(document.getElementById("root"));

  try {
    await React.act(async () => {
      root.render(React.createElement(ReaderAssistantThread, {
        jobId: "ocr-only-job",
        onSubmit(question) { submitted.push(question); },
        onRetry() {},
        onCancel() {},
      }));
    });

    const input = document.querySelector("textarea.aui-input");
    assert.ok(input, "OCR-only Reader 应直接渲染 assistant-ui Composer");
    input.focus();
    const valueSetter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLTextAreaElement.prototype,
      "value",
    ).set;
    await React.act(async () => {
      valueSetter.call(input, "只根据 Markdown 回答");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    assert.equal(input.value, "只根据 Markdown 回答");

    await React.act(async () => {
      input.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }));
    });
    assert.deepEqual(submitted, ["只根据 Markdown 回答"]);
    assert.equal(input.value, "", "提交成功后应清空受控输入");
  } finally {
    await React.act(async () => root.unmount());
    setReaderAdapters(null);
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    dom.window.close();
  }
});
