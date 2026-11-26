/** 阅读页这一侧的提问：右键 / ? 拼出处、书上的位置 → 提问窗的上下文、接线、问答记录（书页上的「?」）。
 * 提问窗本身（ACP、回答怎么画）的测试在 tests/ask/。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAskAnchor, nearestRegion, sectionForPage } from "../../../packages/reader/src/ask/anchor.ts";
import { anchorPreamble, bindAskPort, toAskContext } from "../../../packages/reader/src/ask/ask-context.ts";
import { normalizeReaderMetadata, normalizeReaderRegions } from "../../../packages/reader/src/shared/data/reader-regions.ts";

const ANCHOR = { pane: "translated", page: 56, itemId: "p056-b0003", selection: "", sourceText: "H = -Σ ∇²/2", translatedText: "哈密顿量", section: "2.1 电子问题", point: { x: 0.2, y: 0.4 } };

test("出处：第一句前面带第几页、哪一节、原文译文、任务号和块号；没认出字就说可能是扫描页", () => {
  const preamble = anchorPreamble(ANCHOR, "job-1", "现代量子化学");
  assert.match(preamble, /我在读《现代量子化学》，第 56 页，「2\.1 电子问题」（译文栏）/);
  assert.match(preamble, /这一块的原文：\nH = -Σ/);
  assert.match(preamble, /任务 job-1，块 p056-b0003，第 56 页/);
  assert.match(anchorPreamble({ ...ANCHOR, itemId: null, sourceText: "", translatedText: "" }, "job-1"), /没有认出文字/);
});

test("书上的位置 → 提问窗的上下文：页码、悬停写全的位置、引用（先给看问的那一栏）、出处；端口开会话时绑上任务号", async () => {
  const context = toAskContext(ANCHOR, "job-1", "现代量子化学");
  assert.equal(context.page, 56);
  assert.equal(context.label, "第 56 页 · 2.1 电子问题");
  assert.deepEqual(context.quote, { selection: undefined, source: "H = -Σ ∇²/2", translated: "哈密顿量", prefer: "translated" });
  assert.equal(context.preamble, anchorPreamble(ANCHOR, "job-1", "现代量子化学"));
  const seen = [];
  const port = bindAskPort({ listAgents: async () => [{ id: "a", name: "A" }], openSession: async (options) => { seen.push(options); return {}; } }, "job-1");
  assert.deepEqual(await port.listAgents(), [{ id: "a", name: "A" }]);
  await port.openSession({ agentId: "a" }, {});
  assert.deepEqual(seen, [{ agentId: "a", jobId: "job-1" }]);
});

test("拼出处：页、栏、页内位置、悬停认出的块、章节（书签优先，没有就前面最近的标题）", () => {
  const regions = [
    { itemId: "h1", headingLevel: 1, source: { page: 50, text: "第 2 章 多电子" }, translated: { text: "" }, markdown: "" },
    { itemId: "p056-b0003", source: { page: 56, text: "原文" }, translated: { text: "译文" }, markdown: "", translatedBlockText: "整块译文" },
  ];
  const pageElement = {
    getAttribute: (name) => ({ "data-reader-page": "56", "data-reader-pane": "source" })[name] ?? null,
    getBoundingClientRect: () => ({ left: 100, top: 0, width: 400, height: 600 }),
  };
  const anchor = buildAskAnchor({ pageElement, clientX: 200, clientY: 150, itemId: "p056-b0003", selection: "选的字", regions, bookmarks: [] });
  assert.deepEqual(anchor, { pane: "source", page: 56, itemId: "p056-b0003", selection: "选的字", sourceText: "原文", translatedText: "整块译文", section: "第 2 章 多电子", point: { x: 0.25, y: 0.25 } });
  const bookmarks = [{ id: "0", title: "Chapter 2", page: 40, level: 1, children: [] }];
  assert.equal(sectionForPage(bookmarks, regions, 56), "Chapter 2");
  assert.equal(buildAskAnchor({ pageElement: null, clientX: 0, clientY: 0, itemId: null, selection: "", regions, bookmarks }), null);
});

test("接线：宿主不给端口就没有提问入口；? 只在选着书页上的字时拦（不然照旧是快捷键帮助）；提问窗单独一块、用到才加载", () => {
  const app = readFileSync(new URL("../../../packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url), "utf8");
  assert.match(app, /actions=\{askPort && menuAsk \?/);
  assert.match(app, /\{askPort && ask \? \(/);
  assert.match(app, /if \(!picked\.text \|\| !picked\.element \|\| !picked\.rect\) return;/);
  assert.match(app, /window\.addEventListener\("keydown", onKey, true\)/);
  assert.match(app, /lazy\(\(\) => import\("\.\/ask\/ReaderAskPanel\.js"\)\)/);
  const host = readFileSync(new URL("../../src/features/reader/domain/ask-port.ts", import.meta.url), "utf8");
  assert.match(host, /if \(isMockMode\(\)\) return mockAskPort;/, "演示模式给假 agent");
  assert.match(host, /if \(isLanSharedPage\(\)\) return null;/, "局域网共享的页面不给（网关拦了 \/api\/v1\/ai）");
  const vite = readFileSync(new URL("../../../packages/reader/vite.config.ts", import.meta.url), "utf8");
  assert.match(vite, /@retainpdf\\\/ask/, "提问窗的包不打进阅读器 dist");
});

test("问答记录接线：读回问过的地方、每答完一轮存、一句没问就关不留「?」、能删", () => {
  const hook = readFileSync(new URL("../../../packages/reader/src/ask/use-ask-threads.ts", import.meta.url), "utf8");
  assert.match(hook, /threads\.list\(documentId\)/);
  assert.match(hook, /threads\.create\(documentId, \{ agentId, anchor: mark\.anchor, messages \}\)/);
  assert.match(hook, /threads\.update\(documentId, mark\.threadId, \{ agentId, messages \}\)/);
  assert.match(hook, /if \(mark && !mark\.threadId\) setMarks/);
});

test("悬停还没认出块（鼠标刚移过来、点在两段之间）：按位置找同一页最近的块，太远（超过页高 15%）不算", () => {
  const box = (bbox) => ({ page: 5, bbox, text: "t" });
  const regions = normalizeReaderRegions({ items: [
    { item_id: "top", source: box([50, 100, 550, 200]), translated: box([50, 100, 550, 200]) },
    { item_id: "mid", source: box([50, 400, 550, 500]), translated: box([50, 400, 550, 500]) },
    { item_id: "other-page", source: { page: 6, bbox: [50, 400, 550, 500], text: "x" }, translated: { page: 6, bbox: [50, 400, 550, 500], text: "x" } },
  ] });
  const doc = { pages: [5, 6].map((page) => ({ page, width: 600, height: 1000 })) };
  const metadata = normalizeReaderMetadata({ source: doc, translated: doc });
  assert.equal(nearestRegion(regions, metadata, "source", 5, { x: 0.5, y: 0.45 })?.itemId, "mid", "点在块里");
  assert.equal(nearestRegion(regions, metadata, "source", 5, { x: 0.5, y: 0.3 })?.itemId, "top", "两段之间取近的");
  assert.equal(nearestRegion(regions, metadata, "source", 5, { x: 0.5, y: 0.9 }), null, "离最近的块也太远");
  const pageElement = { getAttribute: (name) => ({ "data-reader-page": "5", "data-reader-pane": "translated" })[name] ?? null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 1000 }) };
  const anchor = buildAskAnchor({ pageElement, clientX: 300, clientY: 300, itemId: null, selection: "", regions, bookmarks: [], metadata });
  assert.equal(anchor.itemId, "top");
  assert.equal(anchor.sourceText, "t");
});
