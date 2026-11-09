function g(t) {
  return t === "page_number" || t === "header" || t === "footer" || t === "page_header" || t === "page_footer" || t === "aside_text";
}
function p(t) {
  const e = `${t.subType || ""}`.toLowerCase();
  return g(e) ? null : e === "title" || e === "heading" || e === "doc_title" || e === "paragraph_title" ? "heading" : e === "display_formula" || t.regionType === "formula" ? "formula" : e === "image_body" || e === "figure" || e === "image" || e === "chart" || t.regionType === "image" ? "figure" : e === "table_html" || e === "table_body" || t.regionType === "table" ? "table" : e.endsWith("caption") || e === "figure_title" || e === "table_footnote" ? "caption" : e === "reference_entry" ? "reference" : e === "footnote" || e === "page_footnote" ? "footnote" : e === "metadata" ? "meta" : "paragraph";
}
function m(t) {
  return t.length > 0 && t.every((e) => typeof e.readingOrder == "number");
}
function h(t) {
  if (!m(t)) return null;
  const e = [], o = /* @__PURE__ */ new Map();
  for (const r of t) {
    const d = `${r.subType || ""}`.toLowerCase(), a = r.source.text.trim();
    if (d === "formula_number") {
      const i = e[e.length - 1];
      (i == null ? void 0 : i.kind) === "formula" && !i.label && (i.label = a);
      continue;
    }
    const s = p(r);
    if (!s) continue;
    const l = r.translated.text.trim(), f = !!l && l !== a, u = r.continuationGroupId, n = u ? o.get(u) : void 0;
    if (n) {
      n.itemIds.push(r.itemId), n.source = `${n.source} ${a}`.trim(), !n.hasTranslation && f ? (n.translated = l, n.hasTranslation = !0) : n.hasTranslation || (n.translated = n.source);
      continue;
    }
    const c = {
      key: r.itemId,
      itemIds: [r.itemId],
      page: r.source.page,
      kind: s,
      level: s === "heading" ? r.headingLevel || (d === "title" || d === "doc_title" ? 1 : 2) : 0,
      source: a,
      translated: f ? l : a,
      hasTranslation: f,
      assetUrls: r.assetUrls,
      label: ""
    };
    u && o.set(u, c), !(!a && s !== "figure") && e.push(c);
  }
  return e;
}
function _(t, e) {
  const o = e === "translated" ? t.translated : t.source;
  if (t.kind === "heading") {
    const r = Math.min(Math.max(t.level, 1), 6);
    return `${"#".repeat(r)} ${o.replace(/\s*\n\s*/g, " ")}`;
  }
  return o;
}
export {
  h as b,
  _ as r
};
//# sourceMappingURL=reader-blocks-BxElLvLX.js.map
