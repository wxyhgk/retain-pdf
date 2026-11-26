// reader/regions → 按阅读顺序排好的 Markdown 块（Markdown 面板按块渲染用）。
//
// 整篇 full.md 是 OCR 整页 markdown 拼起来的，块和 PDF 位置对不上；regions 每一项都带
// item_id + 页码 + bbox，且后端已经按 (页, 页内顺序) 排好、图表公式和正文交错，所以
// 拿它拼出来的每一块都能和左边的 PDF 互相定位，译文也是按块接上的。
//
// 老后端没有 reading_order —— 这时返回 null，面板退回整篇 full.md。

import { extractReaderFormulaLatex, type ReaderRegion } from "../data/reader-regions.js";

export type ReaderMdBlockKind =
  | "heading"
  | "paragraph"
  | "formula"
  | "figure"
  | "table"
  | "caption"
  | "reference"
  | "footnote"
  | "meta";

export type ReaderMdBlock = {
  /** 第一块的 itemId，同时当 React key 和点击跳转目标。 */
  key: string;
  /** 跨页接续的一段会合成一块，这里是它包含的全部 itemId（悬停任何一截都算这块）。 */
  itemIds: string[];
  page: number;
  kind: ReaderMdBlockKind;
  /** 标题层级：1 = 文档标题，2 = 章节标题。 */
  level: number;
  source: string;
  /** 没有译文（公式、参考文献、保留原文的块）时等于 source。 */
  translated: string;
  hasTranslation: boolean;
  assetUrls: string[];
  /** 公式编号，例如 "(3)"：挂在紧挨着的那条公式上。 */
  label: string;
};

export type ReaderMdLanguage = "source" | "translated";

// Paddle 和 MinerU 的 sub_type 词表不一样（image_body / figure，figure_caption /
// image_caption，table_html / table_body，footnote / page_footnote），都收成同一套。
function isPageFurniture(sub: string): boolean {
  return sub === "page_number" || sub === "header" || sub === "footer"
    || sub === "page_header" || sub === "page_footer" || sub === "aside_text";
}

function kindOf(region: ReaderRegion): ReaderMdBlockKind | null {
  const sub = `${region.subType || ""}`.toLowerCase();
  if (isPageFurniture(sub)) return null;
  if (sub === "title" || sub === "heading" || sub === "doc_title" || sub === "paragraph_title") return "heading";
  if (sub === "display_formula" || region.regionType === "formula") return "formula";
  if (sub === "image_body" || sub === "figure" || sub === "image" || sub === "chart" || region.regionType === "image") return "figure";
  if (sub === "table_html" || sub === "table_body" || region.regionType === "table") return "table";
  if (sub.endsWith("caption") || sub === "figure_title" || sub === "table_footnote") return "caption";
  if (sub === "reference_entry") return "reference";
  if (sub === "footnote" || sub === "page_footnote") return "footnote";
  if (sub === "metadata") return "meta";
  return "paragraph";
}

export function readerRegionsHaveReadingOrder(regions: readonly ReaderRegion[]): boolean {
  return regions.length > 0 && regions.every((region) => typeof region.readingOrder === "number");
}

export function buildReaderMdBlocks(regions: readonly ReaderRegion[]): ReaderMdBlock[] | null {
  if (!readerRegionsHaveReadingOrder(regions)) return null;
  const blocks: ReaderMdBlock[] = [];
  const byGroup = new Map<string, ReaderMdBlock>();
  for (const region of regions) {
    const sub = `${region.subType || ""}`.toLowerCase();
    const source = region.source.text.trim();
    if (sub === "formula_number") {
      const previous = blocks[blocks.length - 1];
      if (previous?.kind === "formula" && !previous.label) previous.label = source;
      continue;
    }
    const kind = kindOf(region);
    if (!kind) continue;
    const translatedWhole = region.translated.text.trim();
    const hasTranslation = Boolean(translatedWhole) && translatedWhole !== source;

    const group = region.continuationGroupId;
    const joined = group ? byGroup.get(group) : undefined;
    if (joined) {
      // 同一段的后半截：原文接在后面；译文在第一块上已经是整段，不再追加。
      joined.itemIds.push(region.itemId);
      joined.source = `${joined.source} ${source}`.trim();
      if (!joined.hasTranslation && hasTranslation) {
        joined.translated = translatedWhole;
        joined.hasTranslation = true;
      } else if (!joined.hasTranslation) {
        joined.translated = joined.source;
      }
      continue;
    }
    const block: ReaderMdBlock = {
      key: region.itemId,
      itemIds: [region.itemId],
      page: region.source.page,
      kind,
      level: kind === "heading" ? (region.headingLevel || (sub === "title" || sub === "doc_title" ? 1 : 2)) : 0,
      source,
      translated: hasTranslation ? translatedWhole : source,
      hasTranslation,
      assetUrls: region.assetUrls,
      label: "",
    };
    if (group) byGroup.set(group, block);
    if (!source && kind !== "figure") continue;
    blocks.push(block);
  }
  return blocks;
}

/** 这块要交给 Markdown 渲染器的源码（图片单独渲染，不走这里）。 */
export function readerMdBlockMarkdown(block: ReaderMdBlock, language: ReaderMdLanguage): string {
  const text = language === "translated" ? block.translated : block.source;
  if (block.kind === "heading") {
    const level = Math.min(Math.max(block.level, 1), 6);
    return `${"#".repeat(level)} ${text.replace(/\s*\n\s*/g, " ")}`;
  }
  if (block.kind === "formula") {
    // 公式块整条交给 MathJax：MinerU 给的是没包 $$ 的裸 LaTeX，按裸 LaTeX 片段去认会在空格处切断
    // （`\frac {a}{b}`、`\left( … \right)`），渲染失败。已经包了 $$ / \[ \] / ```latex 的先剥掉，不包两层。
    const latex = extractReaderFormulaLatex(text);
    return latex ? `$$\n${latex}\n$$` : "";
  }
  return text;
}
