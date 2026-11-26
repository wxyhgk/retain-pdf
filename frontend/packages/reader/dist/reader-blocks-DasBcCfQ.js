import { e as g } from "./reader-regions-BmqHsJ-I.js";
function m(t) {
  return t === "page_number" || t === "header" || t === "footer" || t === "page_header" || t === "page_footer" || t === "aside_text";
}
function p(t) {
  const e = `${t.subType || ""}`.toLowerCase();
  return m(e) ? null : e === "title" || e === "heading" || e === "doc_title" || e === "paragraph_title" ? "heading" : e === "display_formula" || t.regionType === "formula" ? "formula" : e === "image_body" || e === "figure" || e === "image" || e === "chart" || t.regionType === "image" ? "figure" : e === "table_html" || e === "table_body" || t.regionType === "table" ? "table" : e.endsWith("caption") || e === "figure_title" || e === "table_footnote" ? "caption" : e === "reference_entry" ? "reference" : e === "footnote" || e === "page_footnote" ? "footnote" : e === "metadata" ? "meta" : "paragraph";
}
function h(t) {
  return t.length > 0 && t.every((e) => typeof e.readingOrder == "number");
}
function b(t) {
  if (!h(t)) return null;
  const e = [], a = /* @__PURE__ */ new Map();
  for (const r of t) {
    const f = `${r.subType || ""}`.toLowerCase(), o = r.source.text.trim();
    if (f === "formula_number") {
      const i = e[e.length - 1];
      (i == null ? void 0 : i.kind) === "formula" && !i.label && (i.label = o);
      continue;
    }
    const s = p(r);
    if (!s) continue;
    const l = r.translated.text.trim(), d = !!l && l !== o, u = r.continuationGroupId, n = u ? a.get(u) : void 0;
    if (n) {
      n.itemIds.push(r.itemId), n.source = `${n.source} ${o}`.trim(), !n.hasTranslation && d ? (n.translated = l, n.hasTranslation = !0) : n.hasTranslation || (n.translated = n.source);
      continue;
    }
    const c = {
      key: r.itemId,
      itemIds: [r.itemId],
      page: r.source.page,
      kind: s,
      level: s === "heading" ? r.headingLevel || (f === "title" || f === "doc_title" ? 1 : 2) : 0,
      source: o,
      translated: d ? l : o,
      hasTranslation: d,
      assetUrls: r.assetUrls,
      label: ""
    };
    u && a.set(u, c), !(!o && s !== "figure") && e.push(c);
  }
  return e;
}
function y(t, e) {
  const a = e === "translated" ? t.translated : t.source;
  if (t.kind === "heading") {
    const r = Math.min(Math.max(t.level, 1), 6);
    return `${"#".repeat(r)} ${a.replace(/\s*\n\s*/g, " ")}`;
  }
  if (t.kind === "formula") {
    const r = g(a);
    return r ? `$$
${r}
$$` : "";
  }
  return a;
}
export {
  b,
  y as r
};
//# sourceMappingURL=reader-blocks-DasBcCfQ.js.map
