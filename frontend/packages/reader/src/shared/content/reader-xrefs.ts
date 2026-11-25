// 书里的引用：「图 2.1」「Table 3」「Eq. (1.24)」「式 (3.21)」。
//
// - 去处从段落数据里认：图注（「Figure 2.1 …」「表 3 …」开头的段）→ 它旁边那张图 / 那个表；公式里写了 \tag{3.21} 的 → 那个公式。
//   认不出去处的引用不标，不猜（扫描书的公式编号 OCR 常常丢，这类引用就不标）。
// - 引用本身在书页的文字层里找（react-pdf 的 customTextRenderer），一段文字里认出来就包一层 <mark class="reader-xref">。
//   原文是扫描版时没有文字层，只有译文栏（我们排的 PDF）里有。

import { readerRegionKindForRegion, type ReaderRegion } from "../data/reader-regions.js";
import { highlightFindTerm } from "./reader-find.js";

export type XrefKind = "figure" | "table" | "equation";

export type XrefTarget = {
  key: string;
  kind: XrefKind;
  label: string;
  /** 跳过去的那一块（图、表、公式；找不到就是图注）。 */
  itemId: string;
  /** 预览画的范围：图注加上它旁边连着的图 / 表 / 公式块（同一页），按阅读顺序。 */
  itemIds: string[];
  /** 图注那一段（没有图注的公式为空）。 */
  captionId: string;
};

export type XrefIndex = ReadonlyMap<string, XrefTarget>;

export const READER_XREF_CLASS = "reader-xref";
export const READER_XREF_ATTR = "data-xref";

const LABEL = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`;

const CAPTION_RE = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${LABEL})`);
const TAG_RE = /\\tag\s*\{\s*([^}]*?)\s*\}/g;

/** 编号统一写法：去空白，各种横线换成 -。 */
export function normalizeXrefLabel(label: string): string {
  return `${label || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}

function captionKind(word: string): XrefKind {
  return /^(table|表)/i.test(word) ? "table" : "figure";
}

function regionText(region: ReaderRegion): string {
  return `${region.source.text || region.markdown || ""}`;
}

/**
 * 图注旁边的那张图 / 那个表：同一页上和图注连着的一串非正文块（图、表、公式；表常被 OCR 认成一串公式），碰到正文、标题就停。
 * 表往下找、图往上找，那边没有再找另一边。返回这一串（不含图注），按阅读顺序；没有就是空的。
 */
function captionNeighbours(regions: readonly ReaderRegion[], index: number, kind: XrefKind): ReaderRegion[] {
  const caption = regions[index];
  const visual = (region: ReaderRegion | undefined) => {
    if (!region || region.source.page !== caption.source.page) return false;
    const regionKind = readerRegionKindForRegion(region);
    return regionKind === "figure" || regionKind === "table" || regionKind === "formula";
  };
  const run = (step: number) => {
    const found: ReaderRegion[] = [];
    for (let at = index + step; visual(regions[at]) && found.length < 40; at += step) found.push(regions[at]);
    return step < 0 ? found.reverse() : found;
  };
  const first = kind === "table" ? run(1) : run(-1);
  return first.length ? first : kind === "table" ? run(-1) : run(1);
}

/** 跳到哪一块：那一串里第一个图 / 表，没有就第一块，再没有就是图注。 */
function primaryOf(neighbours: readonly ReaderRegion[], caption: ReaderRegion, kind: XrefKind): string {
  const wanted = neighbours.find((region) => readerRegionKindForRegion(region) === (kind === "table" ? "table" : "figure"));
  return (wanted || neighbours[0] || caption).itemId;
}

export function buildXrefIndex(regions: readonly ReaderRegion[]): XrefIndex {
  const index = new Map<string, XrefTarget>();
  const add = (target: XrefTarget) => {
    if (!index.has(target.key)) index.set(target.key, target);
  };
  regions.forEach((region, at) => {
    const kind = readerRegionKindForRegion(region);
    const text = regionText(region);
    if (kind === "formula") {
      for (const match of text.matchAll(TAG_RE)) {
        const label = normalizeXrefLabel(match[1]);
        if (label) add({ key: `equation:${label}`, kind: "equation", label, itemId: region.itemId, itemIds: [region.itemId], captionId: "" });
      }
      return;
    }
    if (kind !== "text" && kind !== "region") return;
    const caption = CAPTION_RE.exec(text);
    if (!caption) return;
    const captionLike = /caption/i.test(`${region.subType || ""} ${region.regionType || ""}`);
    // 正文里「Table 2 lists …」开头的不算图注：要么数据标了 caption，要么编号后面紧跟着标点 / 空格再接说明、整段不长。
    if (!captionLike && text.length > 400) return;
    const xrefKind = captionKind(caption[1]);
    const label = normalizeXrefLabel(caption[2]);
    const neighbours = captionNeighbours(regions, at, xrefKind);
    const itemIds = [...neighbours.map((entry) => entry.itemId), region.itemId];
    // 按阅读顺序排（图在图注上面、表在表注下面都可能）。
    const order = new Map(regions.map((entry, position) => [entry.itemId, position]));
    itemIds.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    add({ key: `${xrefKind}:${label}`, kind: xrefKind, label, itemId: primaryOf(neighbours, region, xrefKind), itemIds, captionId: region.itemId });
  });
  return index;
}

export type XrefMatch = { start: number; end: number; key: string };

const REF_RES: Array<{ re: RegExp; kind: (word: string) => XrefKind }> = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${LABEL})`, "g"),
    kind: (word) => (/^tab/i.test(word) ? "table" : "figure"),
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${LABEL})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${LABEL})`, "g"), kind: (word) => (word === "表" ? "table" : "figure") },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${LABEL})\s*[）)]`, "g"), kind: () => "equation" },
];

/** 一段文字里认得出去处的引用（按出现顺序，不重叠）。 */
export function findXrefs(text: string, index: XrefIndex): XrefMatch[] {
  if (!text || !index.size) return [];
  const found: XrefMatch[] = [];
  for (const { re, kind } of REF_RES) {
    re.lastIndex = 0;
    for (const match of text.matchAll(re)) {
      const word = match.length > 2 ? match[1] : "";
      const label = normalizeXrefLabel(match[match.length - 1]);
      const key = `${kind(word)}:${label}`;
      if (!index.has(key)) continue;
      const start = match.index ?? 0;
      found.push({ start, end: start + match[0].length, key });
    }
  }
  found.sort((a, b) => a.start - b.start);
  const kept: XrefMatch[] = [];
  for (const match of found) {
    if (!kept.length || match.start >= kept[kept.length - 1].end) kept.push(match);
  }
  return kept;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * 文字层一段字 → HTML：认出的引用包 <mark class="reader-xref" data-xref="figure:2.1">，搜索词照旧包 <mark>（highlightFindTerm）。
 */
export function renderXrefText(text: string, index: XrefIndex, findTerm = ""): string {
  const matches = findXrefs(text, index);
  if (!matches.length) return highlightFindTerm(text, findTerm);
  let out = "";
  let from = 0;
  for (const match of matches) {
    out += highlightFindTerm(text.slice(from, match.start), findTerm);
    // 用 <mark> 不用 <span>：文字层的 span 都是绝对定位（每个 span 是一段字），套一层 span 会错位。
    out += `<mark class="${READER_XREF_CLASS}" ${READER_XREF_ATTR}="${escapeAttr(match.key)}">${highlightFindTerm(text.slice(match.start, match.end), findTerm)}</mark>`;
    from = match.end;
  }
  return out + highlightFindTerm(text.slice(from), findTerm);
}

const KIND_NAME: Record<XrefKind, string> = { figure: "图", table: "表", equation: "式" };

export function xrefTitle(target: XrefTarget): string {
  return target.kind === "equation" ? `式 (${target.label})` : `${KIND_NAME[target.kind]} ${target.label}`;
}
