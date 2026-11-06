import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import {
  ReaderProvider,
} from "../../../../frontend/packages/reader/src/components/react-pdf/reader-context.tsx";
import { ReaderZoomHud } from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderZoomHud.tsx";
import { ReaderWorkspaceTabs } from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderWorkspaceTabs.tsx";
import { ReaderPanelToggles } from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderAssistantDock.tsx";
import { ReaderDownloadActions } from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderDownloadActions.tsx";
import {
  READER_DOWNLOAD_ORDER,
  resolveReaderDownloadTargets,
} from "../../../../frontend/packages/reader/src/components/react-pdf/use-reader-downloads.ts";

const NOOP = () => {};

function readerSource(relative) {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

function withProvider(value, hud, node) {
  return renderToStaticMarkup(
    createElement(ReaderProvider, { value, hud }, node),
  );
}

test("zoom hud reads userZoom from reader context and page from hud context", () => {
  const markup = withProvider(
    { userZoom: 0.65, onZoomChange: NOOP, goToPage: NOOP },
    { currentPage: 7, numPages: 42 },
    createElement(ReaderZoomHud, { mode: "compare", modeControls: null }),
  );
  assert.match(markup, />65%</);
  assert.match(markup, /7 \/ 42/);
});

test("explicit zoom hud props override the context", () => {
  const markup = withProvider(
    { userZoom: 0.65, onZoomChange: NOOP, goToPage: NOOP },
    { currentPage: 7, numPages: 42 },
    createElement(ReaderZoomHud, {
      userZoom: 0.8,
      currentPage: 3,
      numPages: 10,
      mode: "compare",
      modeControls: null,
    }),
  );
  assert.match(markup, />80%</);
  assert.match(markup, /3 \/ 10/);
});

test("zoom hud still renders standalone with props and no provider", () => {
  const markup = renderToStaticMarkup(createElement(ReaderZoomHud, {
    userZoom: 0.5,
    currentPage: 1,
    numPages: 5,
    mode: "compare",
    modeControls: null,
  }));
  assert.match(markup, />50%</);
  assert.match(markup, /1 \/ 5/);
});

test("workspace tabs take sourceOnly from context and keep disabled copy", () => {
  const markup = withProvider(
    { sourceViewOnly: true },
    { currentPage: 1, numPages: 1 },
    createElement(ReaderWorkspaceTabs, {
      mode: "source",
      documentReady: true,
      onModeChange: NOOP,
    }),
  );
  assert.match(markup, /对照 需要文档任务/);
  assert.match(markup, /译文 需要文档任务/);
});

test("assistant dock falls back to context callbacks without crashing", () => {
  const markup = withProvider(
    { assistant: { select: NOOP, close: NOOP } },
    { currentPage: 1, numPages: 1 },
    createElement(ReaderPanelToggles, { active: null }),
  );
  assert.match(markup, /reader-panel-toggle/);
  assert.match(markup, /aria-label="打开Markdown"/);
});

function downloadContext(overrides = {}) {
  return {
    fetchProtected: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
    jobId: "",
    jobPayload: null,
    manifestPayload: null,
    sourceUrl: "http://reader.local/source.pdf",
    translatedUrl: "http://reader.local/translated.pdf",
    sourceOnly: true,
    ...overrides,
  };
}

test("顶栏下载组从 context 取 download，三路都画出来", () => {
  // 这一组原来在可拖动圆钮的菜单里，圆钮被一条 CSS 在 dock 开着时整个吃掉。
  const markup = withProvider(
    { sourceOnly: false, download: downloadContext({ sourceOnly: false }) },
    { currentPage: 1, numPages: 1 },
    createElement(ReaderDownloadActions, {}),
  );
  assert.match(markup, /reader-download-actions/);
  for (const [id, label] of [["source", "原文"], ["sideBySide", "对照"], ["translated", "译文"]]) {
    assert.match(markup, new RegExp(`id="reader-download-${id}"`), `${label}那一路没画`);
  }
});

test("download urls keep source-only artifacts and never fall back sideBySide", () => {
  assert.deepEqual(READER_DOWNLOAD_ORDER, ["source", "sideBySide", "translated"]);
  assert.deepEqual(resolveReaderDownloadTargets(downloadContext()), {
    source: "http://reader.local/source.pdf",
    translated: "http://reader.local/translated.pdf",
    sideBySide: "",
  });
});

test("产物没就绪的那一路禁用但不隐藏，原因就地写在菜单项里", () => {
  // 隐藏掉的话，用户看到的是「这个功能没有」，而不是「还没生成」。
  const markup = withProvider(
    {
      sourceOnly: false,
      download: downloadContext({ sourceOnly: false, translatedUrl: "" }),
    },
    { currentPage: 1, numPages: 1 },
    createElement(ReaderDownloadActions, {}),
  );
  assert.match(markup, /id="reader-download-translated"[^>]*disabled/);
  assert.match(markup, /译文 PDF 尚未生成或清单不可用/);
  // 原文那一路是好的，必须没被一起禁掉 —— 否则上面那条断言在"全都禁用"时也绿。
  assert.doesNotMatch(markup, /id="reader-download-source"[^>]*disabled/);

  // **原因就地写成菜单项下面那一行**（不靠 title：disabled 的按钮不派发鼠标事件，
  // title 弹不出来）。下载收进菜单后，点开就能看到哪一路为什么不能下。
  const doc = new JSDOM(`<body>${markup}</body>`).window.document;
  const button = doc.querySelector("#reader-download-translated");
  assert.ok(button.disabled, "这条门禁守错了地方：这一路没被禁用");
  assert.match(
    button.querySelector(".reader-download-action-reason")?.textContent || "",
    /译文 PDF 尚未生成或清单不可用/,
    "原因没写在菜单项里",
  );
  assert.equal(doc.querySelector("#reader-download-source .reader-download-action-reason"), null, "可用的那一路不该带原因");
});

test("ReaderAppReactPdf provides context and stops drilling controller props", () => {
  const app = readerSource("../../../../frontend/packages/reader/src/ReaderAppReactPdf.tsx");
  assert.match(app, /<ReaderProvider value=\{readerContext\} hud=\{readerHud\}>/);
  assert.match(app, /from "\.\/components\/react-pdf\/reader-context\.js"/);
  // 这些此前纯透传的 props 不再出现在 use-site。
  for (const prop of [
    "bindShell={",
    "shellEl={",
    "mountSource={",
    "mountTranslated={",
    "sourceUrl={",
    "translatedUrl={",
    "activeRegion={",
    "onMetrics={",
    "onNumPagesChange={",
    "userZoom={",
    "onZoomChange={",
    "currentPage={",
    "numPages={",
  ]) {
    assert.doesNotMatch(app, new RegExp(prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
