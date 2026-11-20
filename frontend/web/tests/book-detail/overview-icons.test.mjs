/** 概览信息区带图标：每格一个图标方块，翻译那格按状态换图标和颜色；合集、阅读状态两行也有图标。 */
import test from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../helpers/dom.mjs";

async function render(props) {
  makeDom();
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { BookDetailOverviewTab } = await import("../../src/features/book-detail/ui/tabs/BookDetailOverviewTab.tsx");
  const html = renderToStaticMarkup(React.createElement(BookDetailOverviewTab, {
    pageCount: 209, bytes: 6.1 * 1024 * 1024, addedAt: "2026-11-16T00:00:00Z",
    editing: false, titleText: "", busy: "", onStartEdit() {}, onCancelEdit() {}, onSave() {}, onTitleChange() {},
    readingSlot: React.createElement("span", null, "R"), collectionsSlot: React.createElement("span", null, "C"),
    ...props,
  }));
  return new globalThis.window.DOMParser().parseFromString(html, "text/html");
}

test("四格各一个图标方块，翻译那格标着状态（完成、在跑、失败、没翻）", async () => {
  const doc = await render({ translationStatus: { label: "已完成", tone: "done" } });
  const icons = [...doc.querySelectorAll("[data-fact-icon]")].map((el) => el.dataset.factIcon);
  assert.deepEqual(icons, ["pages", "size", "added", "translation"]);
  assert.ok(doc.querySelectorAll("[data-fact-icon] svg").length === 4);
  assert.equal(doc.querySelector('[data-book-detail-fact="translation"]').dataset.tone, "done");
  assert.match(doc.querySelector('[data-book-detail-fact="pages"]').textContent, /页数209 页/);
  for (const tone of ["active", "failed", "muted"]) {
    const other = await render({ translationStatus: { label: "x", tone } });
    assert.equal(other.querySelector('[data-book-detail-fact="translation"]').dataset.tone, tone);
  }
  const labels = [...doc.querySelectorAll(".book-detail-overview-row-label")];
  assert.deepEqual(labels.map((el) => el.textContent), ["合集", "阅读状态"]);
  assert.ok(labels.every((el) => el.querySelector("svg")), "两行前面都有图标");
  assert.ok(doc.querySelector(".book-detail-overview-card-heading h3 svg"), "「文档信息」标题带图标");
});
