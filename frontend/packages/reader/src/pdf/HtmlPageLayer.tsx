// HTML 页（2026-11-28 用户：「PDF 的重排，我们纯 html 渲染整个 pdf，这样后续就能增加更多的功能，比如在文字里面增加动效，
// 以及增加 3d 的场景」，选了「照原样摆」；接着「开始不用做的特别完美，我们不是有 ocr 的框以及 ocr 的结果吗」）：
// 原文页（pdf.js 画布）上叠一层，每个有字的块（正文、标题、图注、行间公式）先用纸色盖住原来的字，再按 OCR 的框把字用 HTML 画上去
// （译文或原文；行内、行间公式用 MathJax 画成 SVG）。图、表先留原页的像素。
// 每块是一个带块 id 的 DOM 元素（data-html-block / data-html-kind）：以后的动效、3D、让书动起来都挂在这一层上。
// 塞字（按框调字号、公式）沿用边翻译边看的叠层（LiveTranslationOverlay 的 LiveTranslationTextItem）。
// 不准的地方：OCR 的框和原字不完全重合（盖不住的边、字号是推的）；以后换成排版引擎的 layout.json（每个字的位置）就一模一样。
import { useMemo, type CSSProperties, type ReactElement } from "react";

import { projectReaderRegion, readerRegionKindForRegion, resolveReaderRegionHighlight, type ReaderMetadata, type ReaderRegion } from "../shared/data/reader-regions.js";
import { LiveTranslationTextItem, type ProjectedLiveTranslationItem } from "./LiveTranslationOverlay.js";

export type HtmlPageText = "translated" | "source";

/** 原文用西文衬线（OCR 的书多是 Times / Computer Modern 一类），中文落到思源宋体。 */
const SOURCE_FONT_FAMILY = '"Times New Roman", "Tinos", "Liberation Serif", "Source Han Serif SC", "Noto Serif CJK SC", serif';
/** 盖住原字时往外多盖一点（OCR 的框贴着字，边上会露出原来的笔画）。 */
const COVER_BLEED_PX = 1.5;

/** 这一块要不要画成 HTML、画什么：正文类画字，行间公式画 LaTeX；图、表、认不出的不画（留原页的像素）。 */
export function htmlBlockContent(region: ReaderRegion, text: HtmlPageText): { kind: string; content: string } | null {
  const kind = readerRegionKindForRegion(region);
  if (kind === "formula") {
    const latex = `${region.markdown || region.source.text || ""}`.trim();
    return latex ? { kind: "display_formula", content: latex } : null;
  }
  if (kind !== "text") return null;
  // 块里的 markdown 是译文的 Markdown（带 $…$ 公式），原文在 source.text。
  const content = text === "translated"
    ? `${region.translatedBlockText || region.markdown || region.translated.text || ""}`.trim()
    : `${region.source.text || ""}`.trim();
  return content ? { kind: region.regionType || "text", content } : null;
}

/** 按页分好的块（整本书只分一次）。 */
export function regionsByPage(regions: readonly ReaderRegion[]): ReadonlyMap<number, ReaderRegion[]> {
  const map = new Map<number, ReaderRegion[]>();
  for (const region of regions) {
    const page = Number(region.source?.page);
    if (!Number.isFinite(page)) continue;
    const list = map.get(page);
    if (list) list.push(region);
    else map.set(page, [region]);
  }
  return map;
}

export function HtmlPageLayer({ page, width, height, regions, metadata, text, arrivedAt }: {
  page: number;
  width: number;
  height: number;
  /** 这一页的块。 */
  regions: readonly ReaderRegion[];
  metadata: ReaderMetadata | null;
  text: HtmlPageText;
  /** 刚打开（或换了画什么）的时候：每块按阅读顺序依次「浮出来」（第一个动效，沿用实时译文到达的那一下）。 */
  arrivedAt: number;
}): ReactElement | null {
  const { items, scale } = useMemo(() => {
    const out: { item: ProjectedLiveTranslationItem; order: number }[] = [];
    let pageScale = 0;
    const sorted = [...regions].sort((a, b) => (a.readingOrder ?? 0) - (b.readingOrder ?? 0));
    for (const region of sorted) {
      const block = htmlBlockContent(region, text);
      if (!block) continue;
      const highlight = resolveReaderRegionHighlight(region, metadata, "source");
      if (!highlight || highlight.box.page !== page) continue;
      const rect = projectReaderRegion(highlight, width, height);
      if (!rect || rect.width < 2 || rect.height < 2) continue;
      if (!pageScale && highlight.pageSize?.width) pageScale = width / highlight.pageSize.width;
      out.push({
        order: out.length,
        item: {
          itemId: region.itemId,
          translatedText: block.content,
          status: "html",
          kind: block.kind,
          sourceText: region.source.text || "",
          typography: text === "source" && block.kind !== "display_formula" ? { font_family: SOURCE_FONT_FAMILY } : undefined,
          rect: {
            left: rect.left - COVER_BLEED_PX,
            top: rect.top - COVER_BLEED_PX,
            width: rect.width + COVER_BLEED_PX * 2,
            height: rect.height + COVER_BLEED_PX * 2,
          },
          changedAtSeq: arrivedAt,
          changedNow: Date.now() - arrivedAt < 1500,
        },
      });
    }
    return { items: out, scale: pageScale || 1 };
  }, [regions, metadata, text, page, width, height, arrivedAt]);
  if (!items.length) return null;
  return (
    <div className="reader-html-page" data-html-page={page} data-html-text={text}>
      {items.map(({ item, order }) => (
        <div
          key={`${item.itemId}:${item.changedAtSeq}`}
          className="reader-html-block"
          data-html-block={item.itemId}
          data-html-kind={item.kind}
          style={{ "--reader-html-order": order } as CSSProperties}
        >
          <LiveTranslationTextItem item={item} pageScale={scale} />
        </div>
      ))}
    </div>
  );
}
