import { normalizeBlockKey } from "../utils/block-key.js";
import type { ReaderPaneId } from "../../pdf/reader-dom-contract.js";

export type ReaderRegionBox = {
  page: number;
  bbox: [number, number, number, number];
  unit: "pdf_point";
  origin: "top_left" | "bottom_left";
  text: string;
};

export type ReaderRegion = {
  itemId: string;
  source: ReaderRegionBox;
  translated: ReaderRegionBox;
  markdown: string;
  regionType: string;
  status: string;
  assetIds: string[];
  assetUrls: string[];
};

export type ReaderRegionKind = "formula" | "table" | "figure" | "text" | "region";

export type ReaderRegionSelection = {
  selectionType: "region";
  region: ReaderRegion;
  kind: ReaderRegionKind;
  page: number;
  pane: ReaderPaneId;
  /** 视口坐标，用于浮条定位。 */
  rect: ReaderRegionRect;
};

export type ReaderTextSelection = {
  selectionType: "text";
  quote: string;
  page: number;
  pane: ReaderPaneId;
  /** 视口坐标，用于浮条定位。 */
  rect: ReaderRegionRect;
};

export type ReaderSelection = ReaderRegionSelection | ReaderTextSelection;

export type ReaderPageMetadata = {
  page: number;
  width: number;
  height: number;
};

export type ReaderDocumentMetadata = {
  pageCount: number;
  pages: ReaderPageMetadata[];
};

export type ReaderMetadata = {
  source: ReaderDocumentMetadata | null;
  translated: ReaderDocumentMetadata | null;
};

export type ReaderRegionHighlight = {
  itemId: string;
  region: ReaderRegion;
  box: ReaderRegionBox;
  pageSize: ReaderPageMetadata;
};

export type ReaderRegionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function unwrapData(value: unknown): unknown {
  const object = asObject(value);
  return object && "data" in object ? object.data : value;
}

function finitePositive(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeBox(value: unknown): ReaderRegionBox | null {
  const object = asObject(value);
  if (!object || !Array.isArray(object.bbox) || object.bbox.length !== 4) return null;
  const values = object.bbox.map(Number);
  if (!values.every(Number.isFinite)) return null;
  const page = finitePositive(object.page);
  if (page == null) return null;
  const [rawX0, rawY0, rawX1, rawY1] = values;
  const x0 = Math.min(rawX0, rawX1);
  const y0 = Math.min(rawY0, rawY1);
  const x1 = Math.max(rawX0, rawX1);
  const y1 = Math.max(rawY0, rawY1);
  if (x1 <= x0 || y1 <= y0) return null;
  const unit = `${object.unit || "pdf_point"}`.trim().toLowerCase();
  if (unit !== "pdf_point" && unit !== "pt") return null;
  const origin = `${object.origin || "top_left"}`.trim().toLowerCase();
  if (origin !== "top_left" && origin !== "bottom_left") return null;
  return {
    page: Math.floor(page),
    bbox: [x0, y0, x1, y1],
    unit: "pdf_point",
    origin,
    text: `${object.text || ""}`,
  };
}

export function normalizeReaderRegions(payload: unknown): ReaderRegion[] {
  const object = asObject(unwrapData(payload));
  const items = Array.isArray(object?.items) ? object.items : [];
  const regions: ReaderRegion[] = [];
  for (const raw of items) {
    const item = asObject(raw);
    const itemId = `${item?.item_id || item?.itemId || ""}`.trim();
    const source = normalizeBox(item?.source);
    const translated = normalizeBox(item?.translated);
    if (!itemId || !source || !translated) continue;
    regions.push({
      itemId,
      source,
      translated,
      markdown: `${item?.markdown || ""}`,
      regionType: `${item?.region_type || item?.regionType || ""}`,
      status: `${item?.status || ""}`,
      assetIds: (Array.isArray(item?.asset_ids) ? item.asset_ids : [])
        .map((value) => `${value || ""}`.trim())
        .filter(Boolean),
      assetUrls: (Array.isArray(item?.asset_urls) ? item.asset_urls : [])
        .map((value) => `${value || ""}`.trim())
        .filter(Boolean),
    });
  }
  return regions;
}

export function readerRegionKind(regionType: string): ReaderRegionKind {
  const value = `${regionType || ""}`.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (value.includes("formula") || value.includes("equation")) return "formula";
  if (value.includes("table")) return "table";
  if (
    value.includes("figure")
    || value.includes("image")
    || value.includes("chart")
    || value.includes("seal")
  ) return "figure";
  if (
    value.includes("text")
    || value.includes("title")
    || value.includes("paragraph")
    || value.includes("reference")
    || value.includes("caption")
  ) return "text";
  return "region";
}

export function readerRegionKindForRegion(region: ReaderRegion): ReaderRegionKind {
  const declared = readerRegionKind(region.regionType);
  if (declared !== "region") return declared;
  if (region.assetIds.length || region.assetUrls.length) return "figure";
  const content = `${region.markdown || region.source.text || region.translated.text || ""}`.trim();
  if (/^<table(?:\s|>)/i.test(content) || /\n\s*\|?\s*:?-{3,}/.test(content)) return "table";
  if (
    /^\$\$[\s\S]+\$\$$/.test(content)
    || /^\\\[[\s\S]+\\\]$/.test(content)
    || /^\\begin\{(?:equation|align|gather|multline)\*?\}/.test(content)
  ) return "formula";
  // 旧任务常把 layout_role 写成 unknown，但仍携带正常正文。把有文本的
  // 未知区域视为文字，确保源文件也能悬停和选择。
  return content ? "text" : declared;
}

export function isStructuredReaderRegion(region: ReaderRegion): boolean {
  const kind = readerRegionKindForRegion(region);
  return kind === "formula" || kind === "table" || kind === "figure";
}

export function readerRegionContent(region: ReaderRegion, pane: ReaderPaneId): string {
  const box = regionBoxForPane(region, pane);
  // source 必须优先原文；否则 translation markdown 会让源文件复制出译文。
  return `${box.text || region.markdown || ""}`.trim();
}

export function extractReaderFormulaLatex(value: string): string {
  let result = `${value || ""}`.trim();
  if (!result) return "";
  const fenced = result.match(/^```(?:latex|tex|math)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) result = fenced[1].trim();
  const wrappers: Array<[string, string]> = [
    ["$$", "$$"],
    ["\\[", "\\]"],
    ["\\(", "\\)"],
    ["$", "$"],
  ];
  for (const [start, end] of wrappers) {
    if (result.startsWith(start) && result.endsWith(end) && result.length > start.length + end.length) {
      return result.slice(start.length, -end.length).trim();
    }
  }
  return result;
}

function normalizeDocumentMetadata(value: unknown): ReaderDocumentMetadata | null {
  const object = asObject(value);
  if (!object) return null;
  const pages: ReaderPageMetadata[] = [];
  for (const raw of Array.isArray(object.pages) ? object.pages : []) {
    const page = asObject(raw);
    const pageNumber = finitePositive(page?.page);
    const width = finitePositive(page?.width);
    const height = finitePositive(page?.height);
    if (pageNumber == null || width == null || height == null) continue;
    pages.push({ page: Math.floor(pageNumber), width, height });
  }
  if (!pages.length) return null;
  const rawCount = finitePositive(object.page_count ?? object.pageCount);
  return {
    pageCount: rawCount == null ? pages.length : Math.floor(rawCount),
    pages,
  };
}

export function normalizeReaderMetadata(payload: unknown): ReaderMetadata {
  const object = asObject(unwrapData(payload));
  return {
    source: normalizeDocumentMetadata(object?.source),
    translated: normalizeDocumentMetadata(object?.translated),
  };
}

export function findReaderRegion(
  regions: readonly ReaderRegion[],
  blockId: string | null | undefined,
): ReaderRegion | null {
  const key = normalizeBlockKey(blockId);
  if (!key) return null;
  return regions.find((region) => normalizeBlockKey(region.itemId) === key) || null;
}

type ReaderCitationTarget = {
  block_id?: string;
  page_idx?: number;
  page?: number;
  snippet?: string;
};

function normalizeCitationSearchText(value: unknown): string {
  return `${value || ""}`
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .trim();
}

function citationSnippetCandidates(value: unknown): string[] {
  const raw = `${value || ""}`.trim();
  if (!raw) return [];
  const paragraphs = raw.split(/\n\s*\n/g).map(normalizeCitationSearchText).filter(Boolean);
  const pathParts = raw.split(">").map(normalizeCitationSearchText).filter(Boolean);
  const candidates = [...paragraphs.reverse(), ...pathParts.reverse(), normalizeCitationSearchText(raw)];
  return [...new Set(candidates)].filter((candidate) => candidate.length >= 16);
}

function citationMatchScore(haystack: string, candidate: string): number {
  if (!haystack || !candidate) return 0;
  if (haystack.includes(candidate)) return 10_000 + candidate.length;

  // Markdown fallback snippets may begin or end mid-word at a chunk boundary.
  // Match a substantial interior fingerprint, but keep the threshold high
  // enough that common headings cannot send the reader to an unrelated page.
  const windowLength = Math.min(72, candidate.length);
  if (windowLength < 24) return 0;
  const maxOffset = Math.min(32, Math.max(0, candidate.length - windowLength));
  for (let offset = 0; offset <= maxOffset; offset += 4) {
    const fingerprint = candidate.slice(offset, offset + windowLength);
    if (fingerprint.length >= 24 && haystack.includes(fingerprint)) {
      return fingerprint.length * 100 - offset;
    }
  }
  return 0;
}

/**
 * Resolve legacy Markdown fallback citations (md-xxxx, no page_idx) against
 * the structured region layer. The same region coordinates work for source
 * and translated PDFs, so one match restores navigation in either pane.
 */
export function findReaderRegionByCitation(
  regions: readonly ReaderRegion[],
  citation: ReaderCitationTarget | null | undefined,
): ReaderRegion | null {
  if (!citation) return null;
  const direct = findReaderRegion(regions, citation.block_id);
  if (direct) return direct;

  const candidates = citationSnippetCandidates(citation.snippet);
  if (!candidates.length) return null;
  const pageHint = citation.page_idx != null
    ? Number(citation.page_idx) + 1
    : citation.page != null
      ? Number(citation.page)
      : null;
  const pool = Number.isFinite(pageHint) && Number(pageHint) >= 1
    ? regions.filter((region) => (
      region.source.page === Math.floor(Number(pageHint))
      || region.translated.page === Math.floor(Number(pageHint))
    ))
    : regions;

  let best: ReaderRegion | null = null;
  let bestScore = 0;
  let tied = false;
  for (const region of pool) {
    const regionText = [region.source.text, region.translated.text, region.markdown]
      .map(normalizeCitationSearchText)
      .filter(Boolean);
    let score = 0;
    for (const candidate of candidates) {
      for (const text of regionText) {
        score = Math.max(score, citationMatchScore(text, candidate));
      }
    }
    if (score > bestScore) {
      best = region;
      bestScore = score;
      tied = false;
    } else if (score > 0 && score === bestScore) {
      tied = true;
    }
  }
  return bestScore > 0 && !tied ? best : null;
}

function normalizeReaderAssetPath(value: unknown): string {
  let path = `${value || ""}`.trim().replace(/\\/g, "/");
  if (!path) return "";
  try {
    path = decodeURIComponent(new URL(path, "http://retainpdf.local/").pathname);
  } catch {
    try { path = decodeURIComponent(path); } catch { /* keep raw path */ }
  }
  const apiMarker = "/markdown/images/";
  const apiIndex = path.toLowerCase().indexOf(apiMarker);
  if (apiIndex >= 0) path = path.slice(apiIndex + apiMarker.length);
  return path.replace(/^\.?\/?(?:images\/)?/i, "").replace(/\/{2,}/g, "/");
}

/** Match an AI-rendered image back to its structured PDF region. */
export function findReaderRegionByAssetUrl(
  regions: readonly ReaderRegion[],
  assetUrl: string | null | undefined,
  page?: number | null,
): ReaderRegion | null {
  const target = normalizeReaderAssetPath(assetUrl);
  if (!target) return null;
  const pageNumber = Number(page);
  const candidates = Number.isFinite(pageNumber) && pageNumber >= 1
    ? regions.filter((region) => region.source.page === Math.floor(pageNumber))
    : regions;
  return candidates.find((region) => (
    [...region.assetUrls, ...region.assetIds].some((value) => {
      const candidate = normalizeReaderAssetPath(value);
      return Boolean(candidate) && (
        candidate === target
        || target.endsWith(`/${candidate}`)
        || candidate.endsWith(`/${target}`)
      );
    })
  )) || null;
}

export function regionBoxForPane(
  region: ReaderRegion,
  pane: ReaderPaneId,
): ReaderRegionBox {
  return pane === "translated" ? region.translated : region.source;
}

export function resolveReaderRegionHighlight(
  region: ReaderRegion | null | undefined,
  metadata: ReaderMetadata | null | undefined,
  pane: ReaderPaneId,
): ReaderRegionHighlight | null {
  if (!region || !metadata) return null;
  const box = regionBoxForPane(region, pane);
  // Some translation jobs expose only the rendered/translated page metadata,
  // even though their region payload contains both source and translated
  // coordinates. The translated PDF preserves the source page canvas, so its
  // page dimensions are also the safe projection basis for the source pane.
  // Keep the fallback one-way: a source-only OCR job must not pretend that a
  // translated document exists.
  const documentMetadata = pane === "translated"
    ? metadata.translated
    : metadata.source || metadata.translated;
  const pageSize = documentMetadata?.pages.find((page) => page.page === box.page);
  return pageSize ? { itemId: region.itemId, region, box, pageSize } : null;
}

export function projectReaderRegion(
  highlight: ReaderRegionHighlight | null | undefined,
  renderedWidth: number,
  renderedHeight: number,
): ReaderRegionRect | null {
  if (!highlight || renderedWidth <= 0 || renderedHeight <= 0) return null;
  const { box, pageSize } = highlight;
  if (pageSize.width <= 0 || pageSize.height <= 0) return null;
  const [x0, rawY0, x1, rawY1] = box.bbox;
  const y0 = box.origin === "bottom_left" ? pageSize.height - rawY1 : rawY0;
  const y1 = box.origin === "bottom_left" ? pageSize.height - rawY0 : rawY1;
  const left = Math.max(0, Math.min(renderedWidth, x0 / pageSize.width * renderedWidth));
  const right = Math.max(left, Math.min(renderedWidth, x1 / pageSize.width * renderedWidth));
  const top = Math.max(0, Math.min(renderedHeight, y0 / pageSize.height * renderedHeight));
  const bottom = Math.max(top, Math.min(renderedHeight, y1 / pageSize.height * renderedHeight));
  if (right <= left || bottom <= top) return null;
  return { left, top, width: right - left, height: bottom - top };
}
