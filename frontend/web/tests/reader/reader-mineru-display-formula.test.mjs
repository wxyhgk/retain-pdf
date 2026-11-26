// MinerU 的行间公式（任务 20261126084948-f748c5 第 1 页的式 (1)、(2)，reader/regions 原样抄的）：
// region_type 是 unknown，sub_type 是 display_formula，带一张公式截图，原文是没包 $$ 的整条 LaTeX（带空格和 \tag），没有译文。
// 以前 ① 有图片资源就归成图片，Windows 2026.11.23 的悬停层不认图片，公式整条悬停不到；
// ② Markdown 面板把裸 LaTeX 原样交出去，按裸 LaTeX 片段认会在空格处切断，「公式渲染失败」。
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { projectReaderTextHoverTargets, ReaderTextHoverLayer } from "../../../../frontend/packages/reader/src/pdf/ReaderTextHoverLayer.tsx";
import { normalizeReaderRegions, readerRegionCopyText, readerRegionKindForRegion } from "../../../../frontend/packages/reader/src/shared/data/reader-regions.ts";
import { buildReaderMdBlocks, readerMdBlockMarkdown } from "../../../../frontend/packages/reader/src/shared/content/reader-blocks.ts";
import { buildReaderMarkdownExport } from "../../../../frontend/packages/reader/src/shared/content/markdown-export.ts";
import { extractMarkdownMath, materializeMarkdownMathHtml, mathFailureStats, resetMarkdownMathEngineLoader } from "../../../../frontend/packages/reader/src/shared/content/markdown-math.ts";

const EQ1 = "p _ {i} = \\mathrm{sg} \\left(\\log \\frac {L (x _ {i} , y _ {i} , t _ {i})}{L (x _ {i} , y _ {i} , t _ {i} ^ {\\prime})}\\right), | \\log \\frac {L (x _ {i} , y _ {i} , t _ {i})}{L (x _ {i} , y _ {i} , t _ {i} ^ {\\prime})} | > c,\\tag{1}";
const EQ2 = "\\mathbf {E} _ {p} (x, y, k) = \\sum_ {e _ {i} \\in \\mathcal {E} _ {p}} \\max \\left(0, 1 - \\frac {| t _ {i} - t _ {k} |}{\\Delta T}\\right),\\tag{2}";

function formula(id, order, text, bbox) {
  const box = (value) => ({ page: 1, bbox, unit: "pdf_point", origin: "top_left", text: value });
  return {
    item_id: id, source: box(text), translated: box(null), markdown: null, region_type: "unknown", sub_type: "display_formula",
    status: "kept_origin", reading_order: order,
    asset_ids: [`page-1/${id}.jpg`], asset_urls: [`/api/v1/jobs/j/files/output/ocr/images/page-1/${id}.jpg`],
  };
}

const REGIONS = normalizeReaderRegions({ items: [
  formula("p001-b0008", 8, EQ1, [321, 293, 534, 320]),
  formula("p001-b0010", 10, EQ2, [342, 384, 526, 415]),
  // 真的图片块：同样 unknown + 图片资源，没有 sub_type 说它是公式。
  { item_id: "p001-b0011", source: { page: 1, bbox: [40, 420, 300, 600], unit: "pdf_point", origin: "top_left", text: "" },
    translated: { page: 1, bbox: [40, 420, 300, 600], unit: "pdf_point", origin: "top_left", text: "" },
    markdown: null, region_type: "unknown", sub_type: "image_body", status: "kept_origin", reading_order: 11,
    asset_ids: ["page-1/fig.jpg"], asset_urls: ["/api/v1/jobs/j/files/output/ocr/images/page-1/fig.jpg"] },
] });

test("unknown + display_formula + 图片资源算公式，不算图片；真的图片块照旧是图片", () => {
  assert.deepEqual(REGIONS.map(readerRegionKindForRegion), ["formula", "formula", "figure"]);
});

test("两栏都悬停得到公式，按钮是「复制 LaTeX」，译文栏（没有译文）复制整条原文", () => {
  for (const [region, latex] of [[REGIONS[0], EQ1], [REGIONS[1], EQ2]]) {
    for (const pane of ["source", "translated"]) {
      const targets = projectReaderTextHoverTargets([{ itemId: region.itemId, region, box: region[pane], pageSize: { page: 1, width: 612, height: 792 } }], 612, 792);
      assert.equal(targets.length, 1, `${region.itemId} ${pane} 是悬停目标`);
      assert.match(renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target: targets[0], pane })), /复制 LaTeX/);
      assert.equal(readerRegionCopyText(region, pane), latex, `${pane} 复制整条 LaTeX`);
    }
  }
  const image = REGIONS[2];
  assert.equal(projectReaderTextHoverTargets([{ itemId: image.itemId, region: image, box: image.source, pageSize: { page: 1, width: 612, height: 792 } }], 612, 792).length, 1, "图片块照样能悬停（放大）");
});

test("Markdown 面板：公式块整条包成一个 $$ 块，每条渲染成一个块级 SVG，不算失败", async () => {
  resetMarkdownMathEngineLoader();
  mathFailureStats.convert = 0;
  const blocks = buildReaderMdBlocks(REGIONS).filter((block) => block.kind === "formula");
  assert.equal(blocks.length, 2);
  for (const [block, latex] of [[blocks[0], EQ1], [blocks[1], EQ2]]) {
    for (const language of ["source", "translated"]) {
      const markdown = readerMdBlockMarkdown(block, language);
      assert.equal(markdown, `$$\n${latex}\n$$`);
      const { text, slots } = extractMarkdownMath(markdown, { bareLatex: true });
      assert.deepEqual(slots.map((slot) => [slot.display, slot.tex.trim()]), [[true, latex]], "整条一个块级公式，不被切开");
      const html = await materializeMarkdownMathHtml(`<p>${text.trim()}</p>`, slots);
      assert.equal(html.match(/reader-md-math-display/g)?.length, 1);
      // MathJax 带 \tag 时外层一个 SVG、里面嵌着公式和编号两块，按 mjx-container 数。
      assert.equal(html.match(/<mjx-container[^>]*display="true"/g)?.length, 1, "一个块级 SVG");
      assert.match(html, /data-labels="true"/, "\\tag 的编号排出来了");
      assert.doesNotMatch(html, /reader-md-math-failed/);
    }
  }
  assert.equal(mathFailureStats.convert, 0);
});

test("已经包了 $$ / \\[ \\] / ```latex 的公式不包两层", () => {
  const block = (source) => ({ key: "k", itemIds: ["k"], page: 1, kind: "formula", level: 0, source, translated: source, hasTranslation: false, assetUrls: [], label: "" });
  for (const wrapped of ["$$ H = T + V $$", "\\[H = T + V\\]", "```latex\nH = T + V\n```"]) {
    assert.equal(readerMdBlockMarkdown(block(wrapped), "source"), "$$\nH = T + V\n$$", wrapped);
  }
  assert.equal(readerMdBlockMarkdown(block("  "), "source"), "", "空公式不出 $$$$");
});

test("导出 md：MinerU 的裸 LaTeX 也包成 $$ 块；自带 \\tag 的再挂编号也不加第二个", () => {
  const items = [formula("p001-b0008", 8, EQ1, [321, 293, 534, 320]), formula("p001-b0010", 10, EQ2, [342, 384, 526, 415])];
  const numbered = { ...items[1], item_id: "p001-b0010n", reading_order: 11, sub_type: "formula_number", source: { ...items[1].source, text: "(2)" }, asset_ids: [], asset_urls: [] };
  const md = buildReaderMarkdownExport({ items: [...items, numbered] }).source;
  assert.equal(md, `$$\n${EQ1}\n$$\n\n$$\n${EQ2}\n$$\n`);
});
