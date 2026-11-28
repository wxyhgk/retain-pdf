// 书页上能选字的几层（2026-11-28）：pdf.js 的文字层、HTML 页照版面画的那层（LayoutPageLayer，一页一个 SVG）、
// 按 OCR 框塞字的那层（HtmlPageLayer）。选字的清洗、色带、浮条、提问取出处都按这里认（ReaderSelectionLayer、ask/anchor.ts）。
import { cleanPdfSelectionText } from "../shared/content/selection-text.js";

export const SELECTABLE_LAYER = ".textLayer, .reader-layout-page, .reader-html-page";
const LAYOUT_PAGE = ".reader-layout-page";
const LAYOUT_MATH = "svg.reader-layout-math";

export function elementOfNode(node: Node | null): Element | null {
  if (!node) return null;
  return node.nodeType === 1 ? (node as Element) : node.parentElement;
}

/** 选区所在的那一层（开头那头先，没有就看结尾那头）。 */
export function selectionLayerOf(range: Range): Element | null {
  return elementOfNode(range.startContainer)?.closest(SELECTABLE_LAYER) ?? elementOfNode(range.endContainer)?.closest(SELECTABLE_LAYER) ?? null;
}

// 只认拉丁字母、数字（汉字也是 \p{L}，不能用它：量不出字宽时汉字之间会被当成隔开、补上空格）。
const LATIN_END = /[\p{Script=Latin}\p{N})\].,;:!?%]$/u;
const LATIN_START = /^[\p{Script=Latin}\p{N}(\[$]/u;

/**
 * 版面层（一个字簇一个 <text>，公式是一个嵌套的 <svg>）里选中的字：按文档顺序拼，
 * 基线（y）变了是新的一行（换行，后面 cleanPdfSelectionText 会接成空格或直接接上），换了一块是新的一段（空一行）；
 * 同一行两簇之间隔得开（> 0.2 个字号）、两边又是西文时补一个空格；公式整个算进来，写成 $LaTeX$。
 */
export function layoutSelectionText(range: Range, root: Element): string {
  let out = "";
  let lastY: string | null = null;
  let lastBlock: string | null = null;
  let lastEnd = Number.NaN;
  for (const element of root.querySelectorAll<SVGElement>(`text, ${LAYOUT_MATH}`)) {
    if (!range.intersectsNode(element)) continue;
    let piece: string;
    let x = Number(element.getAttribute("x"));
    let end: number;
    let y: string | null;
    if (element.matches(LAYOUT_MATH)) {
      piece = `$${element.getAttribute("data-tex") || ""}$`;
      y = element.getAttribute("data-baseline");
      end = x + Number(element.getAttribute("width") || 0);
    } else {
      const text = element.textContent || "";
      const node = element.firstChild;
      let start = 0;
      let stop = text.length;
      if (node && node === range.startContainer) start = range.startOffset;
      if (node && node === range.endContainer) stop = range.endOffset;
      piece = text.slice(start, stop);
      y = element.getAttribute("y");
      let width = 0;
      try {
        width = (element as SVGTextContentElement).getComputedTextLength?.() || 0;
      } catch {
        width = 0;
      }
      end = x + width;
      if (start > 0) x = Number.NaN;
    }
    if (!piece) continue;
    const block = element.closest("[data-html-block]")?.getAttribute("data-html-block") ?? null;
    if (lastBlock !== null && block !== lastBlock) out += "\n\n";
    else if (lastY !== null && y !== lastY) out += "\n";
    else if (out && Number.isFinite(lastEnd) && Number.isFinite(x)) {
      const size = Number(element.closest("[font-size]")?.getAttribute("font-size")) || 10;
      if (x - lastEnd > size * 0.2 && LATIN_END.test(out) && LATIN_START.test(piece)) out += " ";
    }
    out += piece;
    lastY = y;
    lastBlock = block;
    lastEnd = end;
  }
  return out;
}

/** 选区的原文（还没收拾）：碰到版面层的按版面拼，别的用浏览器自己的。 */
export function selectionRawText(selection: Selection): string {
  if (!selection.rangeCount) return "";
  const range = selection.getRangeAt(0);
  const common = elementOfNode(range.commonAncestorContainer);
  const layout = common?.closest(LAYOUT_PAGE) ?? (common?.querySelector(LAYOUT_PAGE) ? common : null);
  if (layout) {
    const pages = layout.matches(LAYOUT_PAGE) ? [layout] : [...layout.querySelectorAll(LAYOUT_PAGE)].filter((page) => range.intersectsNode(page));
    if (pages.length) return pages.map((page) => layoutSelectionText(range, page)).filter(Boolean).join("\n\n");
  }
  return `${selection}`;
}

/** 选区收拾好的字（复制、收藏、提问都用这个）。 */
export function selectionCleanText(selection: Selection): string {
  return cleanPdfSelectionText(selectionRawText(selection));
}
