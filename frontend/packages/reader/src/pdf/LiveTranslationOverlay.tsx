import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  LiveTranslationLayoutBlock,
  LiveTranslationLayoutPage,
  LiveTranslationTypography,
} from "@retainpdf/api/live-translation";
import type { LiveTranslationPageState } from "../shared/data/live-translation-state.js";
import {
  extractMarkdownMath,
  materializeMarkdownMathFallbackHtml,
  materializeMarkdownMathHtml,
} from "../shared/content/markdown-math.js";
import {
  projectReaderRegion,
  type ReaderRegion,
  type ReaderRegionHighlight,
  type ReaderRegionRect,
} from "../shared/data/reader-regions.js";

export type ProjectedLiveTranslationItem = {
  itemId: string;
  translatedText: string;
  status: string;
  kind: string;
  sourceText: string;
  typography?: LiveTranslationTypography;
  rect: ReaderRegionRect;
  changedAtSeq: number;
  changedNow: boolean;
};

function asHighlight(
  page: LiveTranslationLayoutPage,
  block: LiveTranslationLayoutBlock,
): ReaderRegionHighlight {
  const pageNumber = page.page_idx + 1;
  const box = {
    page: pageNumber,
    bbox: block.bbox,
    unit: "pdf_point" as const,
    origin: "top_left" as const,
    text: block.source_text,
  };
  const region: ReaderRegion = {
    itemId: block.item_id,
    source: box,
    translated: box,
    markdown: block.source_text,
    regionType: block.kind,
    status: "live_translation",
    assetIds: [],
    assetUrls: [],
  };
  return {
    itemId: block.item_id,
    region,
    box,
    pageSize: { page: pageNumber, width: page.width, height: page.height },
  };
}

export function projectLiveTranslationItems(
  layoutPage: LiveTranslationLayoutPage | undefined,
  pageState: LiveTranslationPageState | undefined,
  renderedWidth: number,
  renderedHeight: number,
): ProjectedLiveTranslationItem[] {
  if (!layoutPage || !pageState) return [];
  const projected: ProjectedLiveTranslationItem[] = [];
  for (const block of layoutPage.blocks) {
    const item = pageState.itemsById.get(block.item_id);
    if (!item?.translated_text) continue;
    const rect = projectReaderRegion(
      asHighlight(layoutPage, block),
      renderedWidth,
      renderedHeight,
    );
    if (!rect) continue;
    projected.push({
      itemId: block.item_id,
      translatedText: item.translated_text,
      status: item.status,
      kind: block.kind,
      sourceText: block.source_text,
      typography: block.typography,
      rect,
      changedAtSeq: pageState.changedAtSeqById.get(block.item_id) || 0,
      changedNow: pageState.changedAtSeqById.get(block.item_id) === pageState.lastEventSeq,
    });
  }
  return projected;
}

export type LiveTranslationOverlayProps = {
  layoutPage?: LiveTranslationLayoutPage;
  pageState?: LiveTranslationPageState;
  width: number;
  height: number;
};

type LiveTranslationTextStyle = {
  fontFamily: string;
  fontSizePx: number;
  minFontSizePx: number;
  maxFontSizePx: number;
  lineHeight: number;
  fontWeight: string | number;
  textAlign: "left" | "center" | "right" | "justify";
  padding: [number, number, number, number];
  exact: boolean;
};

const DEFAULT_FONT_FAMILY = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif';
const mathHtmlCache = new Map<string, Promise<string>>();

function escapeHtml(value: string): string {
  return `${value || ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function prepareLiveTranslationMathHtml(text: string): {
  fallbackHtml: string;
  richHtml: Promise<string>;
  hasMath: boolean;
} {
  const source = `${text || ""}`;
  const { text: protectedText, slots } = extractMarkdownMath(source);
  const escaped = escapeHtml(protectedText);
  const fallbackHtml = materializeMarkdownMathFallbackHtml(escaped, slots);
  if (!slots.length) {
    return { fallbackHtml, richHtml: Promise.resolve(fallbackHtml), hasMath: false };
  }
  let richHtml = mathHtmlCache.get(source);
  if (!richHtml) {
    richHtml = materializeMarkdownMathHtml(escaped, slots);
    mathHtmlCache.set(source, richHtml);
  }
  return { fallbackHtml, richHtml, hasMath: true };
}

function isDisplayKind(kind: string): boolean {
  return /title|heading|header|display_formula|equation/i.test(kind);
}

function finitePositive(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

/** Translate Typst point/em values into the current PDF viewport. */
export function resolveLiveTranslationTextStyle(
  item: Pick<ProjectedLiveTranslationItem, "kind" | "rect" | "sourceText" | "typography">,
  pageScale: number,
): LiveTranslationTextStyle {
  const typography = item.typography;
  const scale = finitePositive(pageScale) || 1;
  const exactFontSize = finitePositive(typography?.font_size_pt);
  const inferredLines = Math.max(1, `${item.sourceText || ""}`.split(/\n+/).length);
  const heightBound = item.rect.height / Math.max(1.28, inferredLines * 1.18);
  const roleBoundPt = isDisplayKind(item.kind) ? 24 : /caption|footnote|table/i.test(item.kind) ? 9.5 : 11;
  const inferredMax = Math.max(5.5 * scale, Math.min(heightBound, roleBoundPt * scale));
  const configuredMin = finitePositive(typography?.fit_min_font_size_pt);
  const configuredMax = finitePositive(typography?.fit_max_font_size_pt);
  const minFontSizePx = Math.max(3.5, (configuredMin || 5.5) * scale);
  const maxFontSizePx = Math.max(
    minFontSizePx,
    (configuredMax ? configuredMax * scale : exactFontSize ? exactFontSize * scale : inferredMax),
  );
  const requestedFontSize = exactFontSize ? exactFontSize * scale : inferredMax;
  const leadingEm = finitePositive(typography?.leading_em);
  const padding = [
    finitePositive(typography?.padding_top_pt) || 0,
    finitePositive(typography?.padding_right_pt) || 0,
    finitePositive(typography?.padding_bottom_pt) || 0,
    finitePositive(typography?.padding_left_pt) || 0,
  ].map((value) => value * scale) as [number, number, number, number];
  return {
    fontFamily: `${typography?.font_family || ""}`.trim() || DEFAULT_FONT_FAMILY,
    fontSizePx: Math.max(minFontSizePx, Math.min(maxFontSizePx, requestedFontSize)),
    minFontSizePx,
    maxFontSizePx,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: leadingEm ? 1 + leadingEm : 1.3,
    fontWeight: typography?.font_weight || (isDisplayKind(item.kind) ? 600 : 400),
    textAlign: typography?.text_align || (isDisplayKind(item.kind) ? "center" : "justify"),
    padding,
    exact: Boolean(exactFontSize),
  };
}

type LiveTranslationTextItemProps = {
  item: ProjectedLiveTranslationItem;
  pageScale: number;
};

function LiveTranslationTextItem({ item, pageScale }: LiveTranslationTextItemProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const prepared = useMemo(
    () => prepareLiveTranslationMathHtml(item.translatedText),
    [item.translatedText],
  );
  const [html, setHtml] = useState(prepared.fallbackHtml);
  const textStyle = useMemo(
    () => resolveLiveTranslationTextStyle(item, pageScale),
    [item, pageScale],
  );

  useEffect(() => {
    let active = true;
    setHtml(prepared.fallbackHtml);
    if (prepared.hasMath) {
      void prepared.richHtml.then((nextHtml) => {
        if (active) setHtml(nextHtml);
      });
    }
    return () => {
      active = false;
    };
  }, [prepared]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const [paddingTop, paddingRight, paddingBottom, paddingLeft] = textStyle.padding;
    const availableWidth = Math.max(1, item.rect.width - paddingLeft - paddingRight);
    const availableHeight = Math.max(1, item.rect.height - paddingTop - paddingBottom);
    let low = textStyle.minFontSizePx;
    let high = textStyle.maxFontSizePx;
    let fitted = Math.min(textStyle.fontSizePx, high);
    const fits = (size: number) => {
      content.style.fontSize = `${size}px`;
      return content.scrollWidth <= availableWidth + 0.5 && content.scrollHeight <= availableHeight + 0.5;
    };
    if (!fits(fitted)) {
      high = fitted;
      fitted = low;
      for (let iteration = 0; iteration < 8; iteration += 1) {
        const candidate = (low + high) / 2;
        if (fits(candidate)) {
          fitted = candidate;
          low = candidate;
        } else {
          high = candidate;
        }
      }
    } else if (!textStyle.exact) {
      low = fitted;
      for (let iteration = 0; iteration < 6; iteration += 1) {
        const candidate = (low + high) / 2;
        if (fits(candidate)) {
          fitted = candidate;
          low = candidate;
        } else {
          high = candidate;
        }
      }
    }
    content.style.fontSize = `${Math.max(textStyle.minFontSizePx, fitted).toFixed(2)}px`;
  }, [html, item.rect.height, item.rect.width, textStyle]);

  const [paddingTop, paddingRight, paddingBottom, paddingLeft] = textStyle.padding;
  return (
    <div
      className={`reader-live-translation-item${item.changedNow ? " is-changed" : ""}`}
      data-live-translation-item={item.itemId}
      data-live-translation-kind={item.kind}
      data-live-translation-status={item.status}
      data-live-translation-typography={textStyle.exact ? "typst" : "fitted"}
      style={{
        ...item.rect,
        padding: `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`,
      }}
    >
      <div
        ref={contentRef}
        className="reader-live-translation-content"
        style={{
          fontFamily: textStyle.fontFamily,
          fontSize: textStyle.fontSizePx,
          fontWeight: textStyle.fontWeight,
          lineHeight: textStyle.lineHeight,
          textAlign: textStyle.textAlign,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function LiveTranslationOverlayInner({
  layoutPage,
  pageState,
  width,
  height,
}: LiveTranslationOverlayProps) {
  const items = useMemo(
    () => projectLiveTranslationItems(layoutPage, pageState, width, height),
    [height, layoutPage, pageState, width],
  );
  if (!items.length) return null;
  return (
    <div
      className="reader-live-translation-overlay"
      data-live-translation-page={layoutPage?.page_idx}
      data-live-translation-generation={pageState?.generation}
      aria-hidden="true"
    >
      {items.map((item) => (
        <LiveTranslationTextItem
          key={`${item.itemId}:${item.changedAtSeq}`}
          item={item}
          pageScale={layoutPage?.width ? width / layoutPage.width : 1}
        />
      ))}
    </div>
  );
}

export const LiveTranslationOverlay = memo(LiveTranslationOverlayInner);
