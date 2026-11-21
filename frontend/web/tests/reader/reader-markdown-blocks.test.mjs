// Markdown 面板按块视图：regions → 块。
//
// 形状照着两本真实 job 的 reader/regions 输出造（Paddle 34 页 / MinerU 128 项）：
// 后端已按 (页, 页内顺序) 排好，图表公式和正文交错；跨页的一段两块共享 continuation_group_id，
// 而且 translated.text 在两块上都是整段译文。
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReaderRegions } from "../../../../frontend/packages/reader/src/shared/data/reader-regions.ts";
import {
  buildReaderMdBlocks,
  readerMdBlockMarkdown,
} from "../../../../frontend/packages/reader/src/shared/content/reader-blocks.ts";
import { createRegionHoverStore } from "../../../../frontend/packages/reader/src/shared/state/region-hover-store.ts";

function item(id, page, order, subType, source, extra = {}) {
  const box = (text) => ({ page, bbox: [10, 10 + order * 20, 200, 28 + order * 20], unit: "pdf_point", origin: "top_left", text });
  return {
    item_id: id,
    source: box(source),
    translated: box(extra.translated ?? null),
    markdown: extra.translated ?? source,
    region_type: extra.region_type ?? "text",
    status: extra.translated ? "translated" : "source_only",
    asset_ids: [],
    asset_urls: extra.asset_urls ?? [],
    reading_order: order,
    sub_type: subType,
    ...(extra.heading_level ? { heading_level: extra.heading_level } : {}),
    ...(extra.group ? { continuation_group_id: extra.group } : {}),
    ...(extra.block_text ? { translated_block_text: extra.block_text } : {}),
  };
}

const PAYLOAD = {
  items: [
    item("p001-b000", 1, 0, "title", "Smart Machine Learning", { translated: "智能机器学习", heading_level: 1 }),
    item("p001-b001", 1, 1, "heading", "Introduction", { translated: "引言", heading_level: 2 }),
    item("p001-b002", 1, 2, "body", "Solving the SE is hard,", { translated: "求解薛定谔方程很难，而且这进一步加剧了维度灾难。", group: "cg-1", block_text: "求解薛定谔方程很难，" }),
    item("p001-b003", 1, 3, "page_number", "1"),
    item("p002-b000", 2, 0, "body", "further compounding the curse.", { translated: "求解薛定谔方程很难，而且这进一步加剧了维度灾难。", group: "cg-1", block_text: "而且这进一步加剧了维度灾难。" }),
    item("p002-b001", 2, 1, "display_formula", "$$ H = T + V $$", { region_type: "formula" }),
    item("p002-b002", 2, 2, "formula_number", "(1)"),
    item("p002-b003", 2, 3, "image_body", "", { region_type: "image", asset_urls: ["/api/v1/jobs/j/markdown/images/page-2/a.jpg"] }),
    item("p002-b004", 2, 4, "figure_caption", "Fig. 1 Schematic.", { translated: "图 1 示意图。" }),
    item("p002-b005", 2, 5, "reference_entry", "[1] A. Author, J. Chem. 2020."),
  ],
};

test("老后端没有 reading_order：返回 null，面板退回整篇 full.md", () => {
  const legacy = normalizeReaderRegions({
    items: PAYLOAD.items.map(({ reading_order, sub_type, ...rest }) => rest),
  });
  assert.equal(buildReaderMdBlocks(legacy), null);
});

test("新字段两次归一化后还在（宿主和 session-assets 各归一化一次）", () => {
  const twice = normalizeReaderRegions(normalizeReaderRegions(PAYLOAD));
  const body = twice.find((region) => region.itemId === "p001-b002");
  assert.equal(body.readingOrder, 2);
  assert.equal(body.subType, "body");
  assert.equal(body.continuationGroupId, "cg-1");
  assert.equal(body.translatedBlockText, "求解薛定谔方程很难，");
  assert.equal(twice.find((region) => region.itemId === "p001-b000").headingLevel, 1);
});

test("块按阅读顺序排列，页码不进正文，图和公式留在正文中间", () => {
  const blocks = buildReaderMdBlocks(normalizeReaderRegions(PAYLOAD));
  assert.deepEqual(
    blocks.map((block) => block.kind),
    ["heading", "heading", "paragraph", "formula", "figure", "caption", "reference"],
  );
  assert.ok(!blocks.some((block) => block.source === "1"), "页码混进了正文");
});

test("跨页的一段合成一块：原文接起来，译文只出现一次", () => {
  // 按块直接渲染的话，translated.text 在两块上都是整段，这一段会出现两遍。
  const blocks = buildReaderMdBlocks(normalizeReaderRegions(PAYLOAD));
  const paragraph = blocks.find((block) => block.kind === "paragraph");
  assert.deepEqual(paragraph.itemIds, ["p001-b002", "p002-b000"]);
  assert.equal(paragraph.key, "p001-b002", "点这一块要跳到这段开头");
  assert.equal(paragraph.source, "Solving the SE is hard, further compounding the curse.");
  assert.equal(paragraph.translated, "求解薛定谔方程很难，而且这进一步加剧了维度灾难。");
  const rendered = blocks.map((block) => readerMdBlockMarkdown(block, "translated")).join("\n");
  assert.equal(rendered.split("维度灾难").length - 1, 1, "同一段译文出现了不止一次");
});

test("没有译文的块（公式、参考文献）在译文视图里显示原文", () => {
  const blocks = buildReaderMdBlocks(normalizeReaderRegions(PAYLOAD));
  const formula = blocks.find((block) => block.kind === "formula");
  assert.equal(formula.hasTranslation, false);
  assert.equal(readerMdBlockMarkdown(formula, "translated"), "$$ H = T + V $$");
  assert.equal(formula.label, "(1)", "公式编号应挂在紧挨着的公式上");
});

test("标题按层级渲染成 # / ##，图片块带资源地址", () => {
  const blocks = buildReaderMdBlocks(normalizeReaderRegions(PAYLOAD));
  assert.equal(readerMdBlockMarkdown(blocks[0], "translated"), "# 智能机器学习");
  assert.equal(readerMdBlockMarkdown(blocks[1], "source"), "## Introduction");
  assert.deepEqual(blocks.find((block) => block.kind === "figure").assetUrls, ["/api/v1/jobs/j/markdown/images/page-2/a.jpg"]);
});

test("MinerU 的词表（figure / image_caption / page_footnote / table_body）收成同一套", () => {
  const blocks = buildReaderMdBlocks(normalizeReaderRegions({
    items: [
      item("p001-b000", 1, 0, "figure", "", { region_type: "image", asset_urls: ["/x.jpg"] }),
      item("p001-b001", 1, 1, "image_caption", "Figure 1."),
      item("p001-b002", 1, 2, "table_body", "<table><tr><td>1</td></tr></table>", { region_type: "table" }),
      item("p001-b003", 1, 3, "page_footnote", "* corresponding author"),
    ],
  }));
  assert.deepEqual(blocks.map((block) => block.kind), ["figure", "caption", "table", "footnote"]);
});

test("表格译文（表格 agent 整表翻的 HTML）在译文视图里按表格渲染，原文视图还是原表", () => {
  const sourceHtml = "<table><tr><th>Name</th><th>Value</th></tr><tr><td colspan=\"2\">Total</td></tr></table>";
  const translatedHtml = "<table><tr><th>名称</th><th>数值</th></tr><tr><td colspan=\"2\">合计</td></tr></table>";
  const regions = normalizeReaderRegions({
    items: [
      item("p001-b000", 1, 0, "table_body", sourceHtml, { region_type: "table", translated: translatedHtml }),
      item("p001-b001", 1, 1, "table_body", sourceHtml, { region_type: "table" }),
    ],
  });
  const [translated, kept] = buildReaderMdBlocks(regions);
  assert.equal(translated.kind, "table");
  assert.equal(translated.hasTranslation, true);
  assert.equal(readerMdBlockMarkdown(translated, "translated"), translatedHtml, "交给 marked 的是整段 <table>，不是转义后的文字");
  assert.equal(readerMdBlockMarkdown(translated, "source"), sourceHtml);
  assert.equal(kept.hasTranslation, false, "没翻的表（source_only）照旧显示原表");
  assert.equal(readerMdBlockMarkdown(kept, "translated"), sourceHtml);
});

test("悬停 store：同值不重复通知，记住是谁触发的", () => {
  const store = createRegionHoverStore();
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  store.set("p001-b002", "pdf");
  store.set("p001-b002", "pdf");
  assert.equal(calls, 1);
  assert.deepEqual(store.get(), { itemId: "p001-b002", origin: "pdf" });
  store.set("p001-b002", "markdown");
  assert.equal(calls, 2, "来源变了要通知：面板据此决定滚不滚");
  store.set(null, "markdown");
  assert.deepEqual(store.get(), { itemId: null, origin: null });
  unsubscribe();
  store.set("p002-b001", "pdf");
  assert.equal(calls, 3);
});
