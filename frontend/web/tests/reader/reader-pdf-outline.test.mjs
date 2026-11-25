/** 目录读 PDF 自带的书签（issue #146、#133）：多级、能折叠，眼下这一节标出来；没有书签退回 OCR 认出的标题。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  OUTLINE_LIMIT,
  ancestorIds,
  currentBookmark,
  flattenOutline,
  readPdfOutline,
} from "../../../packages/reader/src/pdf/pdf-outline.ts";
import { ReaderBookmarkTree } from "../../../packages/reader/src/components/react-pdf/ReaderBookmarkTree.tsx";
import { ReaderFinder } from "../../../packages/reader/src/components/react-pdf/ReaderFinder.tsx";

const REF = (num) => ({ num, gen: 0 });

/** 假的 pdf.js 文档：页对象引用 num → 第 num 页（从 0 数）。 */
function fakePdf(outline, { named = {}, broken = new Set() } = {}) {
  return {
    getOutline: async () => outline,
    getDestination: async (name) => named[name] ?? null,
    getPageIndex: async (ref) => {
      if (broken.has(ref.num)) throw new Error("bad ref");
      return ref.num;
    },
  };
}

test("读书签：页引用、页序号、命名目的地都换成页码；去处坏了页码为 null 但照样列出；空标题跳过", async () => {
  const pdf = fakePdf([
    { title: "  第 3 章  Hartree-Fock ", dest: [REF(122), { name: "XYZ" }, 0, 700, null], items: [
      { title: "3.1 方程", dest: "sec31", items: [{ title: "3.1.2 Fock 算符", dest: [128, { name: "Fit" }] }] },
      { title: "坏的", dest: [REF(999)] },
      { title: "   ", dest: [REF(1)] },
    ] },
    { title: "附录", dest: null },
  ], { named: { sec31: [REF(125), { name: "XYZ" }] }, broken: new Set([999]) });
  const tree = await readPdfOutline(pdf);
  assert.equal(tree.length, 2);
  assert.deepEqual(
    flattenOutline(tree).map((node) => [node.id, node.level, node.title, node.page]),
    [
      ["0", 1, "第 3 章 Hartree-Fock", 123],
      ["0.0", 2, "3.1 方程", 126],
      ["0.0.0", 3, "3.1.2 Fock 算符", 129],
      ["0.1", 2, "坏的", null],
      ["1", 1, "附录", null],
    ],
  );
});

test("没有书签、读书签出错都是空的；太大的书签树只读前面一部分", async () => {
  assert.deepEqual(await readPdfOutline(fakePdf(null)), []);
  assert.deepEqual(await readPdfOutline({ ...fakePdf([]), getOutline: async () => { throw new Error("boom"); } }), []);
  const many = Array.from({ length: OUTLINE_LIMIT + 50 }, (_, index) => ({ title: `第 ${index} 条`, dest: [REF(index)] }));
  assert.equal(flattenOutline(await readPdfOutline(fakePdf(many))).length, OUTLINE_LIMIT);
});

const TREE = [
  { id: "0", title: "第 2 章", page: 54, level: 1, children: [
    { id: "0.0", title: "2.1", page: 55, level: 2, children: [] },
  ] },
  { id: "1", title: "第 3 章", page: 123, level: 1, children: [
    { id: "1.0", title: "3.1", page: 126, level: 2, children: [
      { id: "1.0.0", title: "3.1.1", page: 127, level: 3, children: [] },
      { id: "1.0.1", title: "3.1.2", page: 129, level: 3, children: [] },
    ] },
    { id: "1.1", title: "没页码", page: null, level: 2, children: [] },
  ] },
];

test("眼下在哪一节：页码不超过当前页的最后一条，同一页取最深的；第一条之前没有", () => {
  assert.equal(currentBookmark(TREE, 130), "1.0.1");
  assert.equal(currentBookmark(TREE, 127), "1.0.0");
  assert.equal(currentBookmark(TREE, 123), "1");
  assert.equal(currentBookmark(TREE, 10), null);
  assert.deepEqual(ancestorIds("1.0.1"), ["1", "1.0"]);
  // 一串书签都指向同一页（目录页）：标第一条，不标最后一条。
  const samePage = [
    { id: "0", title: "目录", page: 10, level: 1, children: [
      { id: "0.0", title: "前言", page: 10, level: 2, children: [] },
      { id: "0.1", title: "第 1 章", page: 10, level: 2, children: [] },
      { id: "0.2", title: "第 2 章", page: 10, level: 2, children: [] },
    ] },
    { id: "1", title: "附录", page: 10, level: 1, children: [] },
  ];
  assert.equal(currentBookmark(samePage, 10), "0.0", "第一条的下级同页 → 走到第一个下级，不跳到最后");
  assert.deepEqual(ancestorIds(null), []);
});

test("书签树：眼下这一节和它的上级展开、标出来，别的章收着；没页码的点不了", () => {
  const html = renderToStaticMarkup(createElement(ReaderBookmarkTree, { nodes: TREE, currentPage: 130, onJumpPage: () => {} }));
  assert.match(html, /aria-current="location"[^>]*>.*?3\.1\.2/);
  assert.match(html, /aria-expanded="true"[^>]*aria-label="收起「第 3 章」"|aria-label="收起「第 3 章」"[^>]*aria-expanded="true"/);
  assert.match(html, /aria-label="展开「第 2 章」"/, "别的章收着");
  assert.doesNotMatch(html, />2\.1</, "收着的章不画下级");
  assert.match(html, /disabled=""[^>]*title="这条书签没有指到页"/);
});

test("目录卡：有书签默认按书签；书签和标题都有时能切；没书签照旧按标题", () => {
  const props = { tab: "outline", onTab: () => {}, onClose: () => {}, onJump: () => {}, query: "", onQuery: () => {}, term: "" };
  const withBoth = renderToStaticMarkup(createElement(ReaderFinder, { ...props, bookmarks: TREE, onJumpPage: () => {} }));
  // 没有 reader context 时没有段落数据（标题为空），只出书签、不出切换。
  assert.match(withBoth, /reader-bookmark-tree/);
  assert.doesNotMatch(withBoth, /按标题/);
  const noBookmarks = renderToStaticMarkup(createElement(ReaderFinder, { ...props }));
  assert.doesNotMatch(noBookmarks, /reader-bookmark-tree/);
  assert.match(noBookmarks, /这本书还没有段落数据/);
});
