import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  collectPageRowHeights,
  measureNaturalPageHeight,
} from "../../../../frontend/packages/reader/src/pdf/usePageRowSync.ts";
import { READER_PAGE_SLOT_CLASS } from "../../../../frontend/packages/reader/src/pdf/reader-dom-contract.ts";

function makeDom() {
  return new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
}

test("page row measurement prefers data-natural-height without layout reads", () => {
  const dom = makeDom();
  try {
    const slot = dom.window.document.createElement("div");
    slot.setAttribute("data-natural-height", "321");
    let rectCalls = 0;
    slot.getBoundingClientRect = () => {
      rectCalls += 1;
      return { height: 999 };
    };
    slot.querySelector = () => {
      throw new Error("attribute path must not query page content");
    };
    assert.equal(measureNaturalPageHeight(slot), 321);
    assert.equal(rectCalls, 0);
  } finally {
    dom.window.close();
  }
});

test("page row measurement caches the content lookup across ticks", () => {
  const dom = makeDom();
  try {
    const slot = dom.window.document.createElement("div");
    const content = dom.window.document.createElement("canvas");
    let height = 200;
    content.getBoundingClientRect = () => ({ height });
    slot.appendChild(content);
    dom.window.document.body.appendChild(slot);
    let queries = 0;
    slot.querySelector = () => {
      queries += 1;
      return content;
    };
    assert.equal(measureNaturalPageHeight(slot), 200);
    height = 250;
    assert.equal(measureNaturalPageHeight(slot), 250);
    assert.equal(queries, 1, "content node reference should be reused");
  } finally {
    dom.window.close();
  }
});

test("page row sync publishes max natural height only when both panes have the page", () => {
  const dom = makeDom();
  try {
    const { document } = dom.window;
    const shell = document.createElement("div");
    const addSlot = (page, pane, natural) => {
      const slot = document.createElement("div");
      slot.className = READER_PAGE_SLOT_CLASS;
      slot.setAttribute("data-reader-page", String(page));
      slot.setAttribute("data-reader-pane", pane);
      slot.setAttribute("data-natural-height", String(natural));
      shell.appendChild(slot);
    };
    addSlot(1, "source", 200);
    addSlot(1, "translated", 260);
    addSlot(2, "source", 180);
    addSlot(3, "source", 120);
    addSlot(3, "translated", 100);

    assert.deepEqual([...collectPageRowHeights(shell)], [[1, 260], [3, 120]]);
  } finally {
    dom.window.close();
  }
});

test("pane owns the IntersectionObservers: one for window + canvas activeness, one for text layers near the view", () => {
  const pane = readFileSync(
    new URL("../../../../frontend/packages/reader/src/pdf/PdfDocumentPane.tsx", import.meta.url),
    "utf8",
  );
  const slot = readFileSync(
    new URL("../../../../frontend/packages/reader/src/pdf/PdfPageSlot.tsx", import.meta.url),
    "utf8",
  );

  // 第二个只管文字层和实时译文框（TEXT_ROOT_MARGIN，眼前的页）：WebKit 里每个绝对定位的 span 都是一个 RenderLayer，
  // 挂着 11 页的文字层时每次排版、滚动都要全走一遍。页槽自己还是不许有 observer。
  assert.equal((pane.match(/new IntersectionObserver/g) || []).length, 2);
  assert.match(pane, /const TEXT_ROOT_MARGIN = "25% 0px"/);
  assert.match(pane, /textLayer=\{!textWindowed \|\| textPages\.has\(pageNumber\)\}/);
  assert.match(slot, /renderTextLayer=\{textLayer\}/);
  assert.match(pane, /const ACTIVE_ROOT_MARGIN = "120% 0px"/);
  assert.match(pane, /const ACTIVE_LEAVE_MS = 120/);
  assert.match(pane, /activePages\.has\(pageNumber\)/);
  assert.match(pane, /const isWindowed = windowedSet\.has\(pageNumber\)/);

  assert.doesNotMatch(slot, /new IntersectionObserver/);
  assert.doesNotMatch(slot, /getSharedObserver|sharedObserverMap|releaseSharedObserver/);
  assert.match(slot, /active = false/);
});

test("aspect reporting runs outside the state updater", () => {
  const slot = readFileSync(
    new URL("../../../../frontend/packages/reader/src/pdf/PdfPageSlot.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(slot, /queueMicrotask/);
  assert.doesNotMatch(slot, /setAspect\(\(prev\)/);
  assert.match(slot, /onAspectChange\?\.\(pageNumber, next\)/);
  assert.match(slot, /setAspect\(next\)/);
});
