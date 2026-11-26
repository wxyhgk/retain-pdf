/** 阅读页提问窗的细节：回答里的页码能点、引用原文里的公式、用量那一行的图标版、思考用时存回、窗口三种摆法。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PAGE_HREF_PREFIX, pageFromHref, remarkPageCitations, splitPageRefs } from "../../../packages/reader/src/ask/page-citations.ts";
import { compactNumber, emptyTurn, turnFooterItems } from "../../../packages/reader/src/ask/acp-parts.ts";
import { toInitialMessages, toStoredMessages } from "../../../packages/reader/src/ask/thread-messages.ts";
import { splitMath } from "../../../packages/reader/src/ask/AskQuote.tsx";
import { shortAgentName } from "../../../packages/reader/src/ask/AskHeader.tsx";

const pages = (segments) => segments.filter((segment) => segment.type === "page").map((segment) => segment.page);

test("页码：「（第 12 页）」「第 56、58 页」「第 3–5 页」「p. 12」「pp. 4-6」里的数字认成页码，别的数不动", () => {
  assert.deepEqual(pages(splitPageRefs("见（第 12 页）。")), [12]);
  assert.deepEqual(pages(splitPageRefs("第 56、58 页都有")), [56, 58]);
  assert.deepEqual(pages(splitPageRefs("第3–5页")), [3, 5]);
  assert.deepEqual(pages(splitPageRefs("see p. 12 and pp. 4-6")), [12, 4, 6]);
  assert.deepEqual(pages(splitPageRefs("第 2 章有 3 个式子，式 (2.2)")), [], "不是页码");
  const segments = splitPageRefs("书里第 2、3 页");
  assert.equal(segments.map((segment) => segment.value).join(""), "书里第 2、3 页", "切开再拼回去一字不差");
  assert.deepEqual(pages(splitPageRefs("第 2、900 页", 481)), [2], "超出这本书的页数不算");
});

test("页码 remark 插件：正文里的页码换成页码链接，代码、公式、已有链接里的不动", () => {
  const tree = { type: "root", children: [
    { type: "paragraph", children: [{ type: "text", value: "看第 7 页" }, { type: "inlineCode", value: "第 8 页" }, { type: "inlineMath", value: "p. 9" }] },
    { type: "paragraph", children: [{ type: "link", url: "https://x", children: [{ type: "text", value: "第 10 页" }] }] },
  ] };
  remarkPageCitations()(tree);
  const [first, second] = tree.children;
  assert.deepEqual(first.children.map((node) => node.type), ["text", "link", "text", "inlineCode", "inlineMath"]);
  assert.equal(first.children[1].url, `${PAGE_HREF_PREFIX}7`);
  assert.equal(pageFromHref(first.children[1].url), 7);
  assert.equal(second.children[0].url, "https://x");
  assert.equal(pageFromHref("https://x"), null);
});

test("引用原文：OCR 的 $ M_{A} $、$$…$$、\\(…\\) 切出公式，别的照原样", () => {
  assert.deepEqual(splitMath("where $ M_{A} $ is the mass"), [
    { type: "text", value: "where " },
    { type: "math", value: "M_{A}" },
    { type: "text", value: " is the mass" },
  ]);
  assert.deepEqual(splitMath("$$a+b$$ 和 \\(c\\)").map((segment) => segment.type), ["math", "text", "math"]);
  assert.deepEqual(splitMath("没有公式"), [{ type: "text", value: "没有公式" }]);
});

test("用量那一行（图标版）：每项短字 + 悬停写全，数字缩写，没有的项不出", () => {
  const turn = { ...emptyTurn(0), firstTokenAt: 3100, lastTokenAt: 6000, chunks: 30, usage: { model: "claude-haiku-5-5", inputTokens: 3822, outputTokens: 636, cacheWriteTokens: 3818, contextUsed: 4000, contextSize: 200000 } };
  const items = turnFooterItems(turn, 6600, "RetainPDF 自带模型");
  assert.deepEqual(items.map((item) => item.key), ["model", "input", "output", "cacheWrite", "context", "speed", "firstToken", "elapsed"]);
  assert.equal(items[0].text, "claude-haiku-5-5");
  assert.equal(items[0].title, "RetainPDF 自带模型（claude-haiku-5-5）");
  assert.equal(items[1].text, "3.8k");
  assert.equal(items[1].title, "输入 3822 token");
  assert.equal(items[4].text, "2%");
  assert.equal(items.at(-1).text, "6.6s");
  assert.equal(compactNumber(999), "999");
  assert.equal(compactNumber(12345), "12k");
  assert.equal(compactNumber(1_234_567), "1.2M");
  assert.deepEqual(turnFooterItems(emptyTurn(0), null), []);
});

test("思考用时存进问答记录，重新打开放回思考那一段（标题照样写用时）", () => {
  const stored = toStoredMessages([
    { role: "user", content: [{ type: "text", text: "Q" }] },
    { role: "assistant", content: [{ type: "reasoning", text: "想", timing: { startedAt: 1000, completedAt: 1800 } }, { type: "text", text: "A" }], metadata: { custom: {} } },
  ]);
  assert.equal(stored[1].usage.thoughtMs, 800);
  const [, assistant] = toInitialMessages(stored);
  assert.deepEqual(assistant.content[0].timing, { startedAt: 0, completedAt: 800 });
});

test("提问窗：标题栏图标为主（名字短写）、三种摆法、页码点了跳页、单个工具不套分组", () => {
  assert.equal(shortAgentName("RetainPDF 自带模型"), "自带模型");
  assert.equal(shortAgentName("Claude Code"), "Claude Code");
  const windowSource = readFileSync(new URL("../../../packages/reader/src/ask/ReaderAskWindow.tsx", import.meta.url), "utf8");
  assert.match(windowSource, /enableResizing=\{mode === "full" \? false : mode === "dock" \? \{ left: true \} : true\}/);
  assert.match(windowSource, /<AskPageContext\.Provider value=\{pages\}>/);
  const app = readFileSync(new URL("../../../packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url), "utf8");
  assert.match(app, /onJumpToPage=\{\(page\) => c\.goToPage\(page, ask\.anchor\.pane\)\}/);
  const blocks = readFileSync(new URL("../../../packages/reader/src/ask/ask-blocks.tsx", import.meta.url), "utf8");
  assert.match(blocks, /if \(tools\.length <= 1\) return <>\{children\}<\/>;/);
  const markdown = readFileSync(new URL("../../../packages/reader/src/ask/ui/elements/markdown-text.tsx", import.meta.url), "utf8");
  assert.match(markdown, /remarkPlugins=\{\[remarkGfm, remarkMath, remarkPageCitations\]\}/);
});
