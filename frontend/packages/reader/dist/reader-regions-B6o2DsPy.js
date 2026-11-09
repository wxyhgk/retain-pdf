const N = /^p0*(\d+)-b0*(\d+)$/i;
function $(n) {
  const t = N.exec(`${n || ""}`.trim());
  return t ? `p${Number(t[1])}-b${Number(t[2])}` : `${n || ""}`.trim();
}
function g(n) {
  return n && typeof n == "object" && !Array.isArray(n) ? n : null;
}
function R(n) {
  const t = g(n);
  return t && "data" in t ? t.data : n;
}
function h(n) {
  const t = Number(n);
  return Number.isFinite(t) && t > 0 ? t : null;
}
function y(n) {
  const t = g(n);
  if (!t || !Array.isArray(t.bbox) || t.bbox.length !== 4) return null;
  const e = t.bbox.map(Number);
  if (!e.every(Number.isFinite)) return null;
  const s = h(t.page);
  if (s == null) return null;
  const [o, a, r, u] = e, l = Math.min(o, r), i = Math.min(a, u), f = Math.max(o, r), c = Math.max(a, u);
  if (f <= l || c <= i) return null;
  const p = `${t.unit || "pdf_point"}`.trim().toLowerCase();
  if (p !== "pdf_point" && p !== "pt") return null;
  const d = `${t.origin || "top_left"}`.trim().toLowerCase();
  return d !== "top_left" && d !== "bottom_left" ? null : {
    page: Math.floor(s),
    bbox: [l, i, f, c],
    unit: "pdf_point",
    origin: d,
    text: `${t.text || ""}`
  };
}
function A(n) {
  const t = {}, e = Number((n == null ? void 0 : n.reading_order) ?? (n == null ? void 0 : n.readingOrder));
  ((n == null ? void 0 : n.reading_order) != null || (n == null ? void 0 : n.readingOrder) != null) && Number.isFinite(e) && (t.readingOrder = e);
  const s = Number((n == null ? void 0 : n.heading_level) ?? (n == null ? void 0 : n.headingLevel));
  Number.isFinite(s) && s > 0 && (t.headingLevel = s);
  const o = `${(n == null ? void 0 : n.sub_type) ?? (n == null ? void 0 : n.subType) ?? ""}`.trim();
  o && (t.subType = o);
  const a = `${(n == null ? void 0 : n.continuation_group_id) ?? (n == null ? void 0 : n.continuationGroupId) ?? ""}`.trim();
  a && (t.continuationGroupId = a);
  const r = (n == null ? void 0 : n.translated_block_text) ?? (n == null ? void 0 : n.translatedBlockText);
  return typeof r == "string" && r && (t.translatedBlockText = r), t;
}
function T(n) {
  const t = R(n), e = g(t), s = Array.isArray(t) ? t : Array.isArray(e == null ? void 0 : e.items) ? e.items : [], o = [];
  for (const a of s) {
    const r = g(a), u = `${(r == null ? void 0 : r.item_id) || (r == null ? void 0 : r.itemId) || ""}`.trim(), l = y(r == null ? void 0 : r.source), i = y(r == null ? void 0 : r.translated);
    !u || !l || !i || o.push({
      itemId: u,
      source: l,
      translated: i,
      markdown: `${(r == null ? void 0 : r.markdown) || ""}`,
      regionType: `${(r == null ? void 0 : r.region_type) || (r == null ? void 0 : r.regionType) || ""}`,
      status: `${(r == null ? void 0 : r.status) || ""}`,
      assetIds: (Array.isArray(r == null ? void 0 : r.asset_ids) ? r.asset_ids : Array.isArray(r == null ? void 0 : r.assetIds) ? r.assetIds : []).map((f) => `${f || ""}`.trim()).filter(Boolean),
      assetUrls: (Array.isArray(r == null ? void 0 : r.asset_urls) ? r.asset_urls : Array.isArray(r == null ? void 0 : r.assetUrls) ? r.assetUrls : []).map((f) => `${f || ""}`.trim()).filter(Boolean),
      ...A(r)
    });
  }
  return o;
}
function C(n) {
  const t = `${n || ""}`.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return t.includes("formula") || t.includes("equation") ? "formula" : t.includes("table") ? "table" : t.includes("figure") || t.includes("image") || t.includes("chart") || t.includes("seal") ? "figure" : t.includes("text") || t.includes("title") || t.includes("paragraph") || t.includes("reference") || t.includes("caption") ? "text" : "region";
}
function M(n) {
  const t = C(n.regionType);
  if (t !== "region") return t;
  if (n.assetIds.length || n.assetUrls.length) return "figure";
  const e = `${n.markdown || n.source.text || n.translated.text || ""}`.trim();
  return /^<table(?:\s|>)/i.test(e) || /\n\s*\|?\s*:?-{3,}/.test(e) ? "table" : /^\$\$[\s\S]+\$\$$/.test(e) || /^\\\[[\s\S]+\\\]$/.test(e) || /^\\begin\{(?:equation|align|gather|multline)\*?\}/.test(e) ? "formula" : e ? "text" : t;
}
function F(n) {
  const t = M(n);
  return t === "formula" || t === "table" || t === "figure";
}
function k(n, t) {
  return `${m(n, t).text || n.markdown || ""}`.trim();
}
function z(n, t) {
  const e = k(n, t) || (t === "translated" ? `${n.source.text || ""}`.trim() : "");
  return M(n) === "formula" ? B(e) : e;
}
function B(n) {
  let t = `${n || ""}`.trim();
  if (!t) return "";
  const e = t.match(/^```(?:latex|tex|math)?\s*([\s\S]*?)\s*```$/i);
  e && (t = e[1].trim());
  const s = [
    ["$$", "$$"],
    ["\\[", "\\]"],
    ["\\(", "\\)"],
    ["$", "$"]
  ];
  for (const [o, a] of s)
    if (t.startsWith(o) && t.endsWith(a) && t.length > o.length + a.length)
      return t.slice(o.length, -a.length).trim();
  return t;
}
function w(n) {
  const t = g(n);
  if (!t) return null;
  const e = [];
  for (const o of Array.isArray(t.pages) ? t.pages : []) {
    const a = g(o), r = h(a == null ? void 0 : a.page), u = h(a == null ? void 0 : a.width), l = h(a == null ? void 0 : a.height);
    r == null || u == null || l == null || e.push({ page: Math.floor(r), width: u, height: l });
  }
  if (!e.length) return null;
  const s = h(t.page_count ?? t.pageCount);
  return {
    pageCount: s == null ? e.length : Math.floor(s),
    pages: e
  };
}
function U(n) {
  const t = g(R(n));
  return {
    source: w(t == null ? void 0 : t.source),
    translated: w(t == null ? void 0 : t.translated)
  };
}
function I(n, t) {
  const e = $(t);
  return e && n.find((s) => $(s.itemId) === e) || null;
}
function b(n) {
  return `${n || ""}`.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "").trim();
}
function L(n) {
  const t = `${n || ""}`.trim();
  if (!t) return [];
  const e = t.split(/\n\s*\n/g).map(b).filter(Boolean), s = t.split(">").map(b).filter(Boolean), o = [...e.reverse(), ...s.reverse(), b(t)];
  return [...new Set(o)].filter((a) => a.length >= 16);
}
function S(n, t) {
  if (!n || !t) return 0;
  if (n.includes(t)) return 1e4 + t.length;
  const e = Math.min(72, t.length);
  if (e < 24) return 0;
  const s = Math.min(32, Math.max(0, t.length - e));
  for (let o = 0; o <= s; o += 4) {
    const a = t.slice(o, o + e);
    if (a.length >= 24 && n.includes(a))
      return a.length * 100 - o;
  }
  return 0;
}
function v(n, t) {
  if (!t) return null;
  const e = I(n, t.block_id);
  if (e) return e;
  const s = L(t.snippet);
  if (!s.length) return null;
  const o = t.page_idx != null ? Number(t.page_idx) + 1 : t.page != null ? Number(t.page) : null, a = Number.isFinite(o) && Number(o) >= 1 ? n.filter((i) => i.source.page === Math.floor(Number(o)) || i.translated.page === Math.floor(Number(o))) : n;
  let r = null, u = 0, l = !1;
  for (const i of a) {
    const f = [i.source.text, i.translated.text, i.markdown].map(b).filter(Boolean);
    let c = 0;
    for (const p of s)
      for (const d of f)
        c = Math.max(c, S(d, p));
    c > u ? (r = i, u = c, l = !1) : c > 0 && c === u && (l = !0);
  }
  return u > 0 && !l ? r : null;
}
function _(n) {
  let t = `${n || ""}`.trim().replace(/\\/g, "/");
  if (!t) return "";
  try {
    t = decodeURIComponent(new URL(t, "http://retainpdf.local/").pathname);
  } catch {
    try {
      t = decodeURIComponent(t);
    } catch {
    }
  }
  for (const e of ["/files/output/ocr/images/", "/markdown/images/"]) {
    const s = t.toLowerCase().indexOf(e);
    if (s >= 0) {
      t = t.slice(s + e.length);
      break;
    }
  }
  return t.replace(/^\.?\/?(?:images\/)?/i, "").replace(/\/{2,}/g, "/");
}
function O(n, t, e) {
  const s = _(t);
  if (!s) return null;
  const o = Number(e);
  return (Number.isFinite(o) && o >= 1 ? n.filter((r) => r.source.page === Math.floor(o)) : n).find((r) => [...r.assetUrls, ...r.assetIds].some((u) => {
    const l = _(u);
    return !!l && (l === s || s.endsWith(`/${l}`) || l.endsWith(`/${s}`));
  })) || null;
}
function m(n, t) {
  return t === "translated" ? n.translated : n.source;
}
function K(n, t, e) {
  if (!n || !t) return null;
  const s = m(n, e), o = e === "translated" ? t.translated : t.source || t.translated, a = o == null ? void 0 : o.pages.find((r) => r.page === s.page);
  return a ? { itemId: n.itemId, region: n, box: s, pageSize: a } : null;
}
function P(n, t, e) {
  if (!n || t <= 0 || e <= 0) return null;
  const { box: s, pageSize: o } = n;
  if (o.width <= 0 || o.height <= 0) return null;
  const [a, r, u, l] = s.bbox, i = s.origin === "bottom_left" ? o.height - l : r, f = s.origin === "bottom_left" ? o.height - r : l, c = Math.max(0, Math.min(t, a / o.width * t)), p = Math.max(c, Math.min(t, u / o.width * t)), d = Math.max(0, Math.min(e, i / o.height * e)), x = Math.max(d, Math.min(e, f / o.height * e));
  return p <= c || x <= d ? null : { left: c, top: d, width: p - c, height: x - d };
}
export {
  $ as a,
  O as b,
  v as c,
  U as d,
  B as e,
  I as f,
  z as g,
  C as h,
  F as i,
  M as j,
  m as k,
  K as l,
  T as n,
  P as p,
  k as r
};
//# sourceMappingURL=reader-regions-B6o2DsPy.js.map
