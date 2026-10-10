// 阅读书签：按书存、同页去重、按页排序、读写失败不打断；列表里点一下跳页。
import test from "node:test";
import assert from "node:assert/strict";
import {
  bookmarkLabelForPage,
  readReaderBookmarks,
  removeReaderBookmark,
  toggleReaderBookmark,
} from "../../../packages/reader/src/shared/state/reader-bookmarks.ts";
import { waitFor } from "../helpers/async.mjs";
import { clickWithMouseDown, makeDom as makeDomWith } from "../helpers/dom.mjs";

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, `${v}`), map };
}

test("加、取消、按页排序；不同的书互不影响", () => {
  const storage = memoryStorage();
  const now = () => "2026-10-09T00:00:00Z";
  toggleReaderBookmark("document:a", 12, "2.3 节", { storage, now });
  toggleReaderBookmark("document:a", 3, "", { storage, now });
  toggleReaderBookmark("document:b", 7, "", { storage, now });
  assert.deepEqual(readReaderBookmarks("document:a", storage).map((b) => [b.page, b.label]), [[3, ""], [12, "2.3 节"]]);
  assert.deepEqual(toggleReaderBookmark("document:a", 12, "", { storage, now }).map((b) => b.page), [3], "再点一次取消");
  assert.deepEqual(removeReaderBookmark("document:a", 3, storage), []);
  assert.deepEqual(readReaderBookmarks("document:b", storage).map((b) => b.page), [7]);
});

test("坏数据、存储抛错、没有 scope：当作没有书签", () => {
  const storage = memoryStorage();
  storage.map.set("retainpdf:reader:bookmarks:v1:document:a", "{oops");
  assert.deepEqual(readReaderBookmarks("document:a", storage), []);
  storage.map.set("retainpdf:reader:bookmarks:v1:document:a", JSON.stringify([{ page: 0 }, { page: 5 }, { page: 5, label: "dup" }, "x"]));
  assert.deepEqual(readReaderBookmarks("document:a", storage).map((b) => b.page), [5]);
  const throwing = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("full"); } };
  assert.deepEqual(readReaderBookmarks("document:a", throwing), []);
  assert.deepEqual(toggleReaderBookmark("document:a", 4, "", { storage: throwing }).map((b) => b.page), [4], "存不下也返回本次结果");
  assert.deepEqual(readReaderBookmarks("", storage), []);
});

test("书签名取这一页所在的章节：本页或之前最近的标题，译文优先", () => {
  const regions = [
    { regionType: "heading", source: { page: 2, text: "Intro" }, translated: { page: 2, text: "引言" }, readingOrder: 1 },
    { regionType: "paragraph", source: { page: 3, text: "正文" }, translated: { page: 3, text: "" } },
    { regionType: "heading", source: { page: 5, text: "Method" }, translated: { page: 5, text: "" }, markdown: "", readingOrder: 2 },
    { regionType: "heading", source: { page: 5, text: "Setup" }, translated: { page: 5, text: "实验设置" }, readingOrder: 9 },
  ];
  assert.equal(bookmarkLabelForPage(regions, 1), "");
  assert.equal(bookmarkLabelForPage(regions, 4), "引言");
  assert.equal(bookmarkLabelForPage(regions, 6), "实验设置");
});

test("底栏书签：加书签后列表里能看到，点一下跳页", async () => {
  const dom = makeDomWith("", {
    html: "<!doctype html><html><body><div id='root'></div></body></html>",
    keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "Element", "SVGElement", "Event", "MouseEvent", "PointerEvent", "KeyboardEvent", "Node", "MutationObserver", "localStorage"],
  });
  globalThis.localStorage?.clear?.();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { ReaderBookmarkControl } = await import("../../../packages/reader/src/components/react-pdf/ReaderBookmarkControl.tsx");
  const jumps = [];
  const root = createRoot(dom.window.document.getElementById("root"));
  const regions = [{ regionType: "heading", source: { page: 1, text: "Intro" }, translated: { page: 1, text: "引言" } }];
  root.render(React.createElement(ReaderBookmarkControl, {
    scope: "document:test-bookmarks", currentPage: 8, numPages: 20, regions, onGoToPage: (page) => jumps.push(page),
  }));
  const doc = dom.window.document;
  const toggle = await waitFor(() => doc.querySelector(".reader-bookmark-toggle"), "书签按钮");
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
  clickWithMouseDown(dom, toggle);
  await waitFor(() => doc.querySelector('.reader-bookmark-toggle[aria-pressed="true"]'), "加上了");
  clickWithMouseDown(dom, doc.querySelector(".reader-bookmark-list-btn"));
  const jump = await waitFor(() => doc.querySelector(".reader-bookmark-jump"), "列表");
  assert.match(jump.textContent, /第 8 页.*引言/);
  clickWithMouseDown(dom, jump);
  assert.deepEqual(jumps, [8]);
  root.unmount();
});
