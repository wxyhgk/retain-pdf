/** 书卡装饰位（主题完全可自定义第 3 步）：书签丝带表示「在读」，折角纯装饰；默认都不显示。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BookCard } from "../../src/features/library/ui/shell/BookCard.tsx";

const css = readFileSync(new URL("../../src/features/library/ui/shell/BookCard.css", import.meta.url), "utf8");

function ruleBody(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `BookCard.css 里没有 ${selector}`);
  return css.slice(start, css.indexOf("}", start));
}

test("书卡根带阅读状态，主题按它挂书签丝带", () => {
  const html = renderToStaticMarkup(createElement(BookCard, {
    item: { job_id: "job-1", document_id: "doc-1", title: "Book", status: "succeeded", reading_status: "reading" },
  }));
  assert.match(html, /data-reading-status="reading"/);
  const unread = renderToStaticMarkup(createElement(BookCard, { item: { job_id: "job-2", title: "Book" } }));
  assert.match(unread, /data-reading-status=""/);
});

test("书签丝带只挂在「在读」的书上，默认不显示", () => {
  const ribbon = ruleBody('.book-card[data-reading-status="reading"]::before');
  assert.match(ribbon, /display:\s*var\(--card-ribbon-display,\s*none\)/);
  assert.doesNotMatch(css, /\.book-card::before/, "丝带不能挂到所有书卡上");
});

test("折角默认大小为 0（现有皮肤看不到）", () => {
  const fold = ruleBody(".book-card::after");
  assert.match(fold, /width:\s*var\(--card-fold-size,\s*0px\)/);
  assert.match(fold, /height:\s*var\(--card-fold-size,\s*0px\)/);
  assert.match(fold, /pointer-events:\s*none/);
});
