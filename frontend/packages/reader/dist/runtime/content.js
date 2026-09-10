import { e as i, m, a as M, p as x, r as k, b as I, s as A, w } from "../markdown-math-Cb17EyYs.js";
import { n as N } from "../block-key-BTxcG28S.js";
const p = Object.freeze({
  sentence: { label: "句子" },
  data: { label: "数据" },
  figure: { label: "图表" }
});
function l(e) {
  return Array.isArray(e) ? [...e].sort((r, t) => {
    const u = Number((r == null ? void 0 : r.pageIdx) ?? 0) - Number((t == null ? void 0 : t.pageIdx) ?? 0);
    if (u !== 0)
      return u;
    const s = `${(r == null ? void 0 : r.createdAt) || ""}`, a = `${(t == null ? void 0 : t.createdAt) || ""}`;
    return s < a ? -1 : s > a ? 1 : 0;
  }) : [];
}
function n(e) {
  const r = [];
  for (const t of l(e)) {
    const u = Number((t == null ? void 0 : t.pageIdx) ?? 0), s = r[r.length - 1];
    s && s.pageIdx === u ? s.items.push(t) : r.push({ pageIdx: u, items: [t] });
  }
  return r;
}
function c(e) {
  return `${e || ""}`.split(`
`).map((r) => `> ${r}`);
}
function d({
  title: e = "",
  annotations: r = []
} = {}) {
  const t = e ? `# ${e} 批注` : "# 批注", u = n(r);
  if (u.length === 0)
    return `${t}

(暂无批注)
`;
  const s = [t, ""];
  for (const a of u) {
    s.push(`## 第 ${a.pageIdx + 1} 页`, "");
    for (const o of a.items)
      s.push(...c(o == null ? void 0 : o.quoteText)), o != null && o.translatedQuoteText && s.push(...c(`—— ${o.translatedQuoteText}`)), o != null && o.note && s.push("", `笔记:${o.note}`), s.push("");
  }
  return s.join(`
`);
}
function f(e) {
  return {
    pageIdx: e == null ? void 0 : e.pageIdx,
    blockId: e == null ? void 0 : e.blockId
  };
}
export {
  p as ANNOTATION_KIND_META,
  f as annotationAnchor,
  d as buildAnnotationsMarkdown,
  i as extractMarkdownMath,
  n as groupAnnotationsByPage,
  m as materializeMarkdownMathFallbackHtml,
  M as materializeMarkdownMathHtml,
  N as normalizeBlockKey,
  x as parseMarkdownWithMath,
  k as renderMathFallbackHtml,
  I as resetMarkdownMathEngineLoader,
  A as setMarkdownMathEngineLoader,
  l as sortAnnotations,
  w as wrapMathSvgHtml
};
//# sourceMappingURL=content.js.map
