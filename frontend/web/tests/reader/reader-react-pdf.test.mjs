import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  cloneProtectedPdfFileForWorker,
  loadProtectedPdfFile,
} from "../../../../frontend/packages/reader/src/pdf/useProtectedPdfFile.ts";
import {
  liveTranslationPendingCopy,
  resolveReaderGridPresentation,
  resolveReaderPageWidthBasis,
} from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderCompareGrid.tsx";
import { resolveInitialAssistantPanel } from "../../../../frontend/packages/reader/src/hooks/use-reader-assistant-panel.ts";
import { ReaderAssistantDock } from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderAssistantDock.tsx";
import {
  isReaderWorkspaceDisabled,
  liveTranslationStatusCopy,
  ReaderWorkspaceTabs,
} from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderWorkspaceTabs.tsx";
import {
  hitTestReaderTextHoverTarget,
  projectReaderTextHoverTargets,
} from "../../../../frontend/packages/reader/src/pdf/ReaderTextHoverLayer.tsx";
import { resolveReaderModeShortcut } from "../../../../frontend/packages/reader/src/hooks/use-reader-keyboard.ts";
import { findReaderRegionByAssetUrl } from "../../../../frontend/packages/reader/src/shared/data/reader-regions.ts";

test("page hover hit testing observes pointer movement in capture phase", () => {
  const source = readFileSync(
    new URL("../../../../frontend/packages/reader/src/pdf/PdfPageSlot.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /onPointerMoveCapture=\{handlePointerMove\}/);
  assert.doesNotMatch(source, /\sonPointerMove=\{handlePointerMove\}/);
});

test("text hover uses passive projected hit testing without turning text into buttons", () => {
  const region = {
    itemId: "text-1",
    source: { page: 1, bbox: [10, 20, 90, 50], unit: "pdf_point", origin: "top_left", text: "正文" },
    translated: { page: 1, bbox: [10, 20, 90, 50], unit: "pdf_point", origin: "top_left", text: "正文" },
    markdown: "正文",
    regionType: "paragraph",
    status: "source_only",
    assetIds: [],
    assetUrls: [],
  };
  const targets = projectReaderTextHoverTargets([{
    itemId: region.itemId,
    region,
    box: region.source,
    pageSize: { page: 1, width: 100, height: 200 },
  }], 200, 400);
  assert.equal(targets.length, 1);
  assert.deepEqual(targets[0].rect, { left: 20, top: 40, width: 160, height: 60 });
  assert.equal(hitTestReaderTextHoverTarget(targets, 40, 50)?.itemId, "text-1");
  assert.equal(hitTestReaderTextHoverTarget(targets, 5, 5), null);
});

test("AI image URLs resolve to the matching structured region on the cited page", () => {
  const regions = [{
    itemId: "p002-b0005",
    source: { page: 2, bbox: [10, 20, 90, 80], unit: "pdf_point", origin: "top_left", text: "Figure 1" },
    translated: { page: 2, bbox: [12, 22, 92, 82], unit: "pdf_point", origin: "top_left", text: "图 1" },
    markdown: "![图 1](images/page-2/imgs/figure.png)",
    regionType: "image",
    status: "translated",
    assetIds: ["imgs/figure.png"],
    assetUrls: ["/api/v1/jobs/job-1/markdown/images/page-2/imgs/figure.png"],
  }];
  assert.equal(
    findReaderRegionByAssetUrl(
      regions,
      "/api/v1/jobs/job-1/markdown/images/page-2/imgs/figure.png",
      2,
    )?.itemId,
    "p002-b0005",
  );
  assert.equal(findReaderRegionByAssetUrl(regions, "images/page-3/imgs/figure.png", 3), null);
});

test("reader mode number shortcuts match the visible tab order", () => {
  assert.equal(resolveReaderModeShortcut("1", false), "source");
  assert.equal(resolveReaderModeShortcut("2", false), "compare");
  assert.equal(resolveReaderModeShortcut("3", false), "translated");
  assert.equal(resolveReaderModeShortcut("2", true), null);
  assert.equal(resolveReaderModeShortcut("3", true), null);
});

test("failed live translation remains a readable paused workspace", () => {
  const failedWithoutPages = {
    layoutByPage: new Map(),
    pagesByPage: new Map(),
    lastSeq: 0,
    connection: "terminal",
    jobStatus: "failed",
    error: "",
  };
  assert.equal(liveTranslationStatusCopy(failedWithoutPages), "实时译文 · 已暂停");
  assert.equal(liveTranslationPendingCopy(failedWithoutPages), "翻译已暂停，原始 PDF 仍可阅读");

  const failedWithPages = {
    ...failedWithoutPages,
    pagesByPage: new Map([[0, {}], [1, {}]]),
  };
  assert.equal(liveTranslationPendingCopy(failedWithPages), "翻译已暂停，已保留 2 页译文");
});

test("reader workspace bar keeps only three icon-only reading modes", () => {
  const markup = renderToStaticMarkup(createElement(ReaderWorkspaceTabs, {
    mode: "compare",
    documentReady: true,
    onModeChange() {},
  }));
  assert.match(markup, /aria-label="阅读工作区"/);
  assert.match(markup, />原文</);
  assert.match(markup, />对照</);
  assert.match(markup, />译文</);
  assert.doesNotMatch(markup, />Markdown</);
  assert.doesNotMatch(markup, />AI</);
  assert.match(markup, /reader-workspace-tab-label/);
  assert.match(markup, /aria-selected="true"[^>]*aria-label="对照"/);
});

test("compare mode requires a translated artifact unless live translation supplies the second pane", () => {
  assert.equal(isReaderWorkspaceDisabled({
    id: "compare",
    documentReady: true,
    sourceViewOnly: true,
    liveTranslationAvailable: false,
  }), true);
  assert.equal(isReaderWorkspaceDisabled({
    id: "compare",
    documentReady: true,
    sourceViewOnly: true,
    liveTranslationAvailable: true,
  }), false);
  assert.equal(isReaderWorkspaceDisabled({
    id: "translated",
    documentReady: true,
    sourceViewOnly: true,
    liveTranslationAvailable: true,
  }), true);
});

test("assistant tools use a visible right rail and a unified dock header", () => {
  const rail = renderToStaticMarkup(createElement(ReaderAssistantDock, {
    active: null,
    onSelect() {},
    onClose() {},
  }));
  assert.match(rail, /reader-assistant-rail/);
  assert.match(rail, /aria-label="打开Markdown"/);

  const dock = renderToStaticMarkup(createElement(ReaderAssistantDock, {
    active: "markdown",
    onSelect() {},
    onClose() {},
  }));
  assert.match(dock, /reader-assistant-dock-header/);
  assert.match(dock, /role="tab" aria-selected="true"/);
  assert.match(dock, /aria-label="关闭阅读辅助面板"/);
});

test("assistant state restores directly and migrates the former split preference", () => {
  assert.equal(resolveInitialAssistantPanel({
    schema: "retainpdf_reader_view_v1",
    assistantPanel: "markdown",
    updatedAt: 1,
  }), "markdown");
  // 存着旧两栏布局、右栏是 AI 的人：那个面板已经不存在了，所以不开任何面板。
  // 迁到终端更糟 —— 恢复出一个用户没要过的 agent 会话。
  assert.equal(resolveInitialAssistantPanel({
    schema: "retainpdf_reader_view_v1",
    splitLayout: { left: "source", right: "ai" },
    updatedAt: 1,
  }), null);
  assert.equal(resolveInitialAssistantPanel({
    schema: "retainpdf_reader_view_v1",
    splitLayout: { left: "source", right: "translated" },
    updatedAt: 1,
  }), null);
  assert.equal(resolveInitialAssistantPanel(null), null);
});

test("assistant dock does not expose arbitrary left and right pane composition", () => {
  const markup = renderToStaticMarkup(createElement(ReaderAssistantDock, {
    active: "markdown",
    onChange() {},
    onSelect() {},
    onClose() {},
  }));
  assert.doesNotMatch(markup, /左侧窗格|右侧窗格|aria-haspopup="menu"/);
});

import {
  loadReaderViewState,
  normalizeReaderViewState,
  readerViewStateScope,
  saveReaderViewState,
} from "../../../../frontend/packages/reader/src/shared/state/reader-view-state.ts";

test("reader view state persists page fraction, zoom and assistant panel without secrets", () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
  const scope = readerViewStateScope({ documentId: "doc-1", jobId: "job-ignored" });
  saveReaderViewState(scope, { anchor: { page: 7, fraction: 0.42 } }, storage);
  saveReaderViewState(scope, {
    zoom: 0.65,
    assistantPanel: "markdown",
    splitLayout: null,
  }, storage);
  assert.deepEqual(loadReaderViewState(scope, storage), {
    schema: "retainpdf_reader_view_v1",
    anchor: { page: 7, fraction: 0.42 },
    zoom: 0.65,
    splitLayout: null,
    assistantPanel: "markdown",
    updatedAt: loadReaderViewState(scope, storage).updatedAt,
  });
  assert.equal(readerViewStateScope({ jobId: "job-2" }), "job:job-2");
  assert.equal(values.size, 1);
});

test("reader view state rejects malformed layouts and clamps recoverable values", () => {
  assert.deepEqual(normalizeReaderViewState({
    schema: "retainpdf_reader_view_v1",
    anchor: { page: 3.9, fraction: 2 },
    zoom: 9,
    splitLayout: { left: "source", right: "source" },
    updatedAt: 12,
  }), {
    schema: "retainpdf_reader_view_v1",
    anchor: { page: 3, fraction: 1 },
    zoom: 1,
    updatedAt: 12,
  });
});

test("开着侧栏时，50% 缩放在**整个拖拽区间**都铺满 PDF 栏", () => {
  // 原来这条只钉了三个数字，其中正好只覆盖分栏 50% 那一个点。而分栏是可拖的
  // （reader-assistant-split-constraints：30%–65%），basis 里那个
  // `Math.min(shellWidth * 2, viewportWidth)` 在 30%–50% 区间把基准钳成常量：
  //
  //   面板 30%  shell 1344  基准封顶 1920  50%页宽 936  栏宽 1344  ← 差 400px
  //
  // 用户看到的是「把分隔条往右拖给 PDF 更多地方，页面一点都不变大」。
  // 挑点测抓不到，所以这里扫整个区间。
  const V = 1920;
  for (const assistantPercent of [30, 35, 40, 45, 50, 55, 60, 65]) {
    const shell = (V * (100 - assistantPercent)) / 100;
    const basis = resolveReaderPageWidthBasis(shell, true, V);
    const pageWidth = pageWidthFromShell(basis, 0.5);
    // fitContentWidth 恒扣 24px 的 padding，所以留一点余量。
    assert.ok(
      Math.abs(pageWidth - shell) <= 30,
      `面板 ${assistantPercent}% 时页宽 ${Math.round(pageWidth)} 没铺满栏宽 ${Math.round(shell)}`,
    );
  }
  // 没有侧栏时基准就是 shell 宽（50% = 半栏，这是默认阅读的样子）。
  assert.equal(resolveReaderPageWidthBasis(600, false), 600);
  // shell 还没量出来时才用 viewport 兜底，别算成 0。
  assert.equal(resolveReaderPageWidthBasis(0, true, 1200), 1200);
});

test("assistant dock keeps the PDF mounted and owns Markdown or AI independently", () => {
  const source = readFileSync(
    new URL("../../../../frontend/packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /is-workspace-\$\{workspaceView\}/);
  assert.match(source, /<ReaderCompareGrid/);
  assert.match(source, /<ReaderAssistantDock\s+active=\{assistantPanel\}/);
  assert.match(source, /assistantOpen \? <ReaderAssistantSplitResizeHandle \/>/);
  assert.match(source, /markdownSplit=\{markdownSlot\.open\}/);
  assert.match(source, /assistantSplit=\{assistantOpen\}/);
  assert.match(source, /modeControls=\{null\}/);
  assert.doesNotMatch(source, /<ReaderPaneSelector/);
  assert.doesNotMatch(source, /setAssistantPanel\(next\)[\s\S]{0,120}setModeKeepingPage/);
});

test("Markdown split turns PDF compare into source PDF + Markdown", () => {
  assert.equal(resolveReaderPageWidthBasis(600, true), 1200);
  assert.equal(resolveReaderPageWidthBasis(1200, false), 1200);
  assert.deepEqual(
    resolveReaderGridPresentation({
      mode: "compare",
      compareMode: true,
      showSource: true,
      showTranslated: true,
      markdownSplit: true,
    }),
    {
      mode: "source",
      compareMode: false,
      showSource: true,
      showTranslated: false,
    },
  );
  assert.deepEqual(
    resolveReaderGridPresentation({
      mode: "translated",
      compareMode: false,
      showSource: false,
      showTranslated: true,
      markdownSplit: true,
    }),
    {
      mode: "translated",
      compareMode: false,
      showSource: false,
      showTranslated: true,
    },
  );
});

test("live translation overlays source without hiding the compare right pane", () => {
  // 对照态叠加不再「消栏」：右栏保留，只在源栏叠加。
  assert.deepEqual(
    resolveReaderGridPresentation({
      mode: "compare",
      compareMode: true,
      showSource: true,
      showTranslated: true,
      markdownSplit: false,
      overlayOnSource: true,
    }),
    {
      mode: "compare",
      compareMode: true,
      showSource: true,
      showTranslated: true,
    },
  );
  // 最终译文未叠加时，正常对照呈现不变。
  assert.deepEqual(
    resolveReaderGridPresentation({
      mode: "compare",
      compareMode: true,
      showSource: true,
      showTranslated: true,
      markdownSplit: false,
      overlayOnSource: false,
    }),
    {
      mode: "compare",
      compareMode: true,
      showSource: true,
      showTranslated: true,
    },
  );
});

test("live translation keeps a useful right-pane placeholder through OCR", () => {
  assert.equal(liveTranslationPendingCopy({
    layoutByPage: new Map(),
    pagesByPage: new Map(),
    lastSeq: 0,
    connection: "connecting",
    error: "",
  }), "正在完成 OCR，译文将在这里逐页出现");
  assert.equal(liveTranslationPendingCopy({
    layoutByPage: new Map([[0, {}]]),
    pagesByPage: new Map(),
    lastSeq: 0,
    connection: "connecting",
    error: "",
  }), "版面已就绪，正在等待首个译文页面");
  assert.equal(liveTranslationPendingCopy({
    layoutByPage: new Map([[0, {}]]),
    pagesByPage: new Map([[0, {}]]),
    lastSeq: 1,
    connection: "live",
    error: "",
  }), "");
});

test("loadProtectedPdfFile returns null for empty url", async () => {
  assert.equal(await loadProtectedPdfFile(""), null);
});

test("loadProtectedPdfFile uses fetchProtected and returns data bytes", async () => {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
  const file = await loadProtectedPdfFile("mock://demo.pdf", async (url) => {
    assert.equal(url, "mock://demo.pdf");
    return {
      ok: true,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
  });
  assert.ok(file);
  assert.equal(file.data[0], 0x25);
  assert.equal(file.data.length, 4);
});

test("PDF.js receives a disposable byte copy so panel remounts keep cached bytes intact", () => {
  const cached = { data: new Uint8Array([0x25, 0x50, 0x44, 0x46]) };
  const firstWorkerFile = cloneProtectedPdfFileForWorker(cached);
  const secondWorkerFile = cloneProtectedPdfFileForWorker(cached);
  assert.ok(firstWorkerFile);
  assert.ok(secondWorkerFile);
  assert.notEqual(firstWorkerFile.data.buffer, cached.data.buffer);
  assert.notEqual(secondWorkerFile.data.buffer, cached.data.buffer);
  assert.notEqual(firstWorkerFile.data.buffer, secondWorkerFile.data.buffer);
  firstWorkerFile.data[0] = 0;
  assert.equal(cached.data[0], 0x25);
  assert.equal(secondWorkerFile.data[0], 0x25);
});

test("loadProtectedPdfFile throws on non-ok response", async () => {
  await assert.rejects(
    () => loadProtectedPdfFile("http://x/pdf", async () => ({ ok: false, status: 404 })),
    /404/,
  );
});

test("loadProtectedPdfFile 把 404 的 error.details.reason 挂到错误上（not_ready = 译文 PDF 还没产出）", async () => {
  await assert.rejects(
    () => loadProtectedPdfFile("http://x/not-ready.pdf", async () => ({
      ok: false,
      status: 404,
      json: async () => ({ code: 404, message: "translated.pdf not ready", error: { code: "NOT_FOUND", details: { reason: "not_ready" } } }),
    })),
    (error) => error.status === 404 && error.reason === "not_ready",
  );
  await assert.rejects(
    () => loadProtectedPdfFile("http://x/not-json.pdf", async () => ({
      ok: false,
      status: 404,
      json: async () => { throw new SyntaxError("not json"); },
    })),
    (error) => error.status === 404 && error.reason === undefined,
  );
});

import {
  clampReaderZoom,
  comparePaneWidth,
  defaultZoomForMode,
  displayPercentToZoom,
  fitContentWidth,
  pageWidthFromShell,
  stepReaderZoom,
  zoomToDisplayPercent,
  READER_ZOOM_MIN,
  READER_ZOOM_MAX,
  READER_ZOOM_DEFAULT,
} from "../../../../frontend/packages/reader/src/pdf/reader-zoom.ts";

test("clampReaderZoom: 0.25–1 (fraction of full shell)", () => {
  assert.equal(clampReaderZoom(0.1), READER_ZOOM_MIN);
  assert.equal(clampReaderZoom(9), READER_ZOOM_MAX);
  assert.equal(clampReaderZoom(0.75), 0.75);
  assert.equal(READER_ZOOM_MAX, 1);
  assert.equal(READER_ZOOM_DEFAULT, 0.5);
});

test("stepReaderZoom steps by 0.05", () => {
  assert.equal(stepReaderZoom(0.5, 1), 0.55);
  assert.equal(stepReaderZoom(0.5, -1), 0.45);
  assert.equal(stepReaderZoom(READER_ZOOM_MIN, -1), READER_ZOOM_MIN);
});

test("display percent is zoom×100 (50% = half browser, 100% = full)", () => {
  assert.equal(zoomToDisplayPercent(0.5), 50);
  assert.equal(zoomToDisplayPercent(1), 100);
  assert.equal(displayPercentToZoom(50), 0.5);
  assert.equal(displayPercentToZoom(100), 1);
});

test("pageWidthFromShell: same zoom → same width regardless of mode concept", () => {
  const shell = 1000;
  const at50 = pageWidthFromShell(shell, 0.5);
  const at100 = pageWidthFromShell(shell, 1);
  // 50% ≈ half shell content (after pad)
  assert.equal(at50, fitContentWidth(shell * 0.5));
  assert.equal(at100, fitContentWidth(shell));
  // 50% width roughly half of 100% (padding makes not exact 2x but close)
  assert.ok(at100 > at50 * 1.5);
  // 对照半栏宽约等于 50% 页宽 + 少量 pad 误差范围内
  const halfPane = comparePaneWidth(shell);
  assert.ok(Math.abs(at50 - fitContentWidth(halfPane)) < 30);
});

test("defaultZoom 50% unifies single and compare column fill", () => {
  assert.equal(defaultZoomForMode("source"), 0.5);
  assert.equal(defaultZoomForMode("compare"), 0.5);
  assert.equal(zoomToDisplayPercent(defaultZoomForMode("compare")), 50);
});

import {
  READER_PAGE_ATTR,
  READER_PANE_ATTR,
  READER_NATURAL_HEIGHT_ATTR,
  READER_MD_SRC_ATTR,
  READER_ROOT_CLASS,
  READER_GRID_CLASS,
  READER_SCROLL_SHELL_CLASS,
  READER_PDF_PANE_CLASS,
  READER_PDF_PAGE_CLASS,
  READER_PDF_PAGE_PLACEHOLDER_CLASS,
  READER_PAGE_SLOT_CLASS,
  pageSelector,
  pageInPaneSelector,
  pageSlotSelector,
} from "../../../../frontend/packages/reader/src/pdf/reader-dom-contract.ts";

test("reader-dom-contract: DOM attr/class constants stay canonical", () => {
  assert.equal(READER_PAGE_ATTR, "data-reader-page");
  assert.equal(READER_PANE_ATTR, "data-reader-pane");
  assert.equal(READER_NATURAL_HEIGHT_ATTR, "data-natural-height");
  assert.equal(READER_MD_SRC_ATTR, "data-reader-md-src");
  assert.equal(READER_ROOT_CLASS, "reader-react-root");
  assert.equal(READER_GRID_CLASS, "reader-react-grid");
  assert.equal(READER_SCROLL_SHELL_CLASS, "reader-react-scroll-shell");
  assert.equal(READER_PDF_PANE_CLASS, "reader-react-pdf-pane");
  assert.equal(READER_PDF_PAGE_CLASS, "reader-react-pdf-page");
  assert.equal(READER_PDF_PAGE_PLACEHOLDER_CLASS, "reader-react-pdf-page-placeholder");
  assert.equal(READER_PAGE_SLOT_CLASS, "reader-react-pdf-page-slot");
});

test("reader-dom-contract: pageSelector strings", () => {
  assert.equal(pageSelector(), `[${READER_PAGE_ATTR}]`);
  assert.equal(pageSelector(undefined), `[${READER_PAGE_ATTR}]`);
  assert.equal(pageSelector(3), `[${READER_PAGE_ATTR}="3"]`);
  assert.equal(
    pageSelector(undefined, "source"),
    `[${READER_PAGE_ATTR}][${READER_PANE_ATTR}="source"]`,
  );
  assert.equal(
    pageSelector(2, "translated"),
    `[${READER_PAGE_ATTR}="2"][${READER_PANE_ATTR}="translated"]`,
  );
});

test("reader-dom-contract: pageInPaneSelector strings", () => {
  assert.equal(
    pageInPaneSelector("source"),
    `[${READER_PAGE_ATTR}][${READER_PANE_ATTR}="source"]`,
  );
  assert.equal(
    pageInPaneSelector("translated"),
    `[${READER_PAGE_ATTR}][${READER_PANE_ATTR}="translated"]`,
  );
});

test("reader-dom-contract: pageSlotSelector strings", () => {
  assert.equal(
    pageSlotSelector(),
    `.${READER_PAGE_SLOT_CLASS}[${READER_PAGE_ATTR}]`,
  );
});

import {
  clampPageNumber,
  scrollShellToPage,
} from "../../../../frontend/packages/reader/src/pdf/scroll-to-page.ts";
import { JSDOM } from "jsdom";

test("clampPageNumber bounds", () => {
  assert.equal(clampPageNumber(0, 10), 1);
  assert.equal(clampPageNumber(99, 10), 10);
  assert.equal(clampPageNumber(3.7, 10), 3);
  assert.equal(clampPageNumber(NaN, 10), 1);
});

function makeScrollRootWithPages(pageCount = 5, pageHeight = 200) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    pretendToBeVisual: true,
  });
  const { document } = dom.window;
  const root = document.createElement("div");
  root.style.cssText = "overflow:auto;height:400px;position:relative;";
  Object.defineProperty(root, "clientHeight", { value: 400, configurable: true });
  let scrollTop = 0;
  Object.defineProperty(root, "scrollTop", {
    get() {
      return scrollTop;
    },
    set(v) {
      scrollTop = Number(v) || 0;
    },
    configurable: true,
  });
  root.scrollTo = ({ top }) => {
    scrollTop = Math.max(0, Number(top) || 0);
  };

  root.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    bottom: 400,
    right: 300,
    width: 300,
    height: 400,
    x: 0,
    y: 0,
    toJSON() {},
  });

  for (let i = 1; i <= pageCount; i += 1) {
    const page = document.createElement("div");
    page.setAttribute("data-reader-page", String(i));
    page.setAttribute("data-reader-pane", "source");
    const topInContent = (i - 1) * pageHeight;
    page.getBoundingClientRect = () => {
      const top = topInContent - scrollTop;
      return {
        top,
        left: 0,
        bottom: top + pageHeight,
        right: 300,
        width: 300,
        height: pageHeight,
        x: 0,
        y: top,
        toJSON() {},
      };
    };
    root.appendChild(page);
  }

  document.body.appendChild(root);
  return { root, dom };
}

test("scrollShellToPage moves shared shell scrollTop near page top", () => {
  const { root, dom } = makeScrollRootWithPages(5, 200);
  assert.equal(scrollShellToPage(root, 3, "auto", "source"), true);
  assert.ok(Math.abs(root.scrollTop - 352) < 2, `scrollTop=${root.scrollTop}`);
  dom.window.close();
});

import {
  applyPageScrollProgress,
  measurePageScrollProgress,
  cloneProgress,
  readingFocusY,
  pickPageAtFocus,
  READER_SCROLL_FOCUS_PX,
} from "../../../../frontend/packages/reader/src/pdf/scroll-to-page.ts";

test("locked progress apply is stable (no drift when re-applied)", () => {
  const { root, dom } = makeScrollRootWithPages(5, 200);
  root.scrollTop = 250;
  const progress = measurePageScrollProgress(root, "source");
  assert.ok(progress);
  assert.equal(progress.page, 2);
  const locked = cloneProgress(progress);
  applyPageScrollProgress(root, locked, "auto", "source");
  const first = root.scrollTop;
  applyPageScrollProgress(root, locked, "auto", "source");
  applyPageScrollProgress(root, locked, "auto", "source");
  assert.ok(Math.abs(root.scrollTop - first) < 1, `drift ${root.scrollTop - first}`);
  assert.ok(root.scrollTop < 600, `scrollTop=${root.scrollTop}`);
  dom.window.close();
});

test("readingFocusY uses READER_SCROLL_FOCUS_PX from root top", () => {
  const { root, dom } = makeScrollRootWithPages(3, 200);
  assert.equal(readingFocusY(root), READER_SCROLL_FOCUS_PX);
  assert.equal(readingFocusY(root, 20), 20);
  dom.window.close();
});

test("pickPageAtFocus matches measurePageScrollProgress page + fraction", () => {
  const { root, dom } = makeScrollRootWithPages(5, 200);
  root.scrollTop = 250;
  const progress = measurePageScrollProgress(root, "source");
  const pages = Array.from(root.querySelectorAll("[data-reader-page]"));
  const picked = pickPageAtFocus(pages, readingFocusY(root));
  assert.ok(progress && picked);
  assert.equal(picked.page, progress.page);
  assert.ok(Math.abs(picked.fraction - progress.fraction) < 0.001);
  dom.window.close();
});

test("pickPageAtFocus picks last page whose top is at or above focus line", () => {
  const { root, dom } = makeScrollRootWithPages(5, 200);
  root.scrollTop = 200;
  const pages = Array.from(root.querySelectorAll("[data-reader-page]"));
  const focusY = readingFocusY(root);
  const picked = pickPageAtFocus(pages, focusY);
  assert.ok(picked);
  assert.equal(picked.page, 2);
  dom.window.close();
});
