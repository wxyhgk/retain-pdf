// 目录和搜索（阅读页左边的「目录 / 搜索」，ReaderFinder）：都从阅读页已经拿到的块（regions）来，不靠 Markdown 面板。
// 目录是标题块（title / heading，带 headingLevel），搜索在每块的原文和译文里找；条目都带原文的页（1 起）和块 id，
// 点了按块跳过去（jumpToAnchor）。

import type { ReaderRegion } from "../data/reader-regions.js";

export type ReaderOutlineEntry = { itemId: string; level: number; page: number; text: string };

export type ReaderSearchHit = {
  itemId: string;
  page: number;
  /** 命中在原文还是译文里（两边都有时算译文：读的是中文）。 */
  side: "source" | "translated";
  /** 命中前后的一截，`at`、`length` 是命中在这一截里的位置，给界面标出来。 */
  snippet: string;
  at: number;
  length: number;
};

const oneLine = (text: string | null | undefined) => `${text ?? ""}`.replace(/\s+/gu, " ").trim();

const SUBSCRIPT: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋" };
const SUPERSCRIPT: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻" };
const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ",
  omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};
const scripted = (text: string, table: Record<string, string>) =>
  [...text].every((character) => character in table) ? [...text].map((character) => table[character]).join("") : text;

/** 标题里的公式（`$\mathrm{H}_{2}\mathrm{O}$`）读成字（H₂O）：目录是一行字，不画公式。只管常见的几样，别的去掉记号照原样。 */
export function plainMath(text: string): string {
  return text.replace(/\$([^$]+)\$/gu, (_whole, math: string) =>
    math
      .replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1")
      .replace(/_\{([^{}]*)\}|_(\w)/gu, (_m, group: string | undefined, single: string | undefined) => scripted(group ?? single ?? "", SUBSCRIPT))
      .replace(/\^\{([^{}]*)\}|\^(\w)/gu, (_m, group: string | undefined, single: string | undefined) => scripted(group ?? single ?? "", SUPERSCRIPT))
      .replace(/\\([a-zA-Z]+)/gu, (_m, name: string) => GREEK[name] ?? "")
      .replace(/[{}]/gu, "")
      .trim(),
  ).replace(/\s+/gu, " ").trim();
}

/** 这一块读者看到的字：译文（组内是自己那一截），没有就原文。 */
function shownText(region: ReaderRegion): string {
  return oneLine(region.translatedBlockText) || oneLine(region.translated.text) || oneLine(region.source.text);
}

const isHeading = (region: ReaderRegion) =>
  Boolean(region.headingLevel) || region.subType === "title" || region.subType === "heading";

/** 标题块按阅读顺序排成目录；没有字、和上一条一样（跨栏拆开的同一个标题）的不要。 */
export function readerOutline(regions: readonly ReaderRegion[]): ReaderOutlineEntry[] {
  const entries: ReaderOutlineEntry[] = [];
  for (const region of regions) {
    if (!isHeading(region)) continue;
    const text = plainMath(shownText(region));
    const page = Number(region.source.page);
    if (!text || !Number.isFinite(page) || page < 1) continue;
    const last = entries[entries.length - 1];
    if (last && last.text === text && last.page === page) continue;
    entries.push({ itemId: region.itemId, level: region.headingLevel && region.headingLevel > 1 ? 2 : 1, page, text });
  }
  return entries;
}

/** 目录里眼下这一页落在哪一条下面：页在它之后（含）的最后一条；在第一条之前是 -1。 */
export function currentOutlineIndex(entries: readonly ReaderOutlineEntry[], page: number): number {
  let found = -1;
  for (let index = 0; index < entries.length; index += 1) {
    if (entries[index]!.page <= page) found = index;
    else break;
  }
  return found;
}

const SNIPPET_BEFORE = 24;
const SNIPPET_AFTER = 60;

function hitIn(text: string, needle: string): { snippet: string; at: number; length: number } | null {
  const index = text.toLowerCase().indexOf(needle);
  if (index < 0) return null;
  const start = Math.max(0, index - SNIPPET_BEFORE);
  const end = Math.min(text.length, index + needle.length + SNIPPET_AFTER);
  const lead = start > 0 ? "…" : "";
  return { snippet: `${lead}${text.slice(start, end)}${end < text.length ? "…" : ""}`, at: lead.length + index - start, length: needle.length };
}

/** 在每块的译文和原文里找（不分大小写），按阅读顺序，最多 `limit` 处。空的、只有空白的不找。 */
export function searchReaderRegions(regions: readonly ReaderRegion[], query: string, limit = 200): ReaderSearchHit[] {
  const needle = oneLine(query).toLowerCase();
  if (!needle) return [];
  const hits: ReaderSearchHit[] = [];
  for (const region of regions) {
    const page = Number(region.source.page);
    if (!Number.isFinite(page) || page < 1) continue;
    const translated = oneLine(region.translatedBlockText) || oneLine(region.translated.text);
    const fromTranslated = translated ? hitIn(translated, needle) : null;
    const found = fromTranslated ?? hitIn(oneLine(region.source.text), needle);
    if (!found) continue;
    hits.push({ itemId: region.itemId, page, side: fromTranslated ? "translated" : "source", ...found });
    if (hits.length >= limit) break;
  }
  return hits;
}
