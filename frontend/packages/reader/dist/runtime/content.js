import { e as T, m as U, a as j, b as z, n as E, p as I, r as y, c as B, d as F, s as H, w as L } from "../markdown-math-XkF5urpn.js";
import { n as f } from "../reader-regions-B6o2DsPy.js";
import { a as v } from "../reader-regions-B6o2DsPy.js";
import { b as h, r as p } from "../reader-blocks-BxElLvLX.js";
function g(e, s) {
  const n = s.replace(/^\s*\(\s*|\s*\)\s*$/g, "").trim();
  if (!n) return e;
  const t = e.trimEnd();
  return t.endsWith("$$") && t.length > 4 ? `${t.slice(0, -2).trimEnd()} \\tag{${n}}$$` : `${t} ${s.trim()}`;
}
function M() {
  const e = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set();
  return (n) => {
    const t = e.get(n);
    if (t) return t;
    let o = n;
    try {
      o = new URL(n, "http://local.invalid/").pathname;
    } catch {
    }
    const i = (() => {
      try {
        return decodeURIComponent(o);
      } catch {
        return o;
      }
    })(), l = ((i.includes("/images/") ? i.slice(i.lastIndexOf("/images/") + 8) : "") || i.split("/").filter(Boolean).pop() || "image").replace(/^\/+/, "").split("/").map((a) => a.replace(/[^\w.\-一-鿿]+/g, "_") || "_").join("/");
    let r = `images/${l}`;
    for (let a = 2; s.has(r); a += 1) r = `images/${l.replace(/(\.[^./]+)?$/, `-${a}$1`)}`;
    return s.add(r), e.set(n, r), r;
  };
}
function w(e, s, n) {
  let t = e;
  for (const o of s)
    o && t.includes(o) && (t = t.split(o).join(n(o)));
  return t;
}
function u(e, s, n) {
  if (e.kind === "figure")
    return e.assetUrls.map((o) => `![](${n(o)})`).join(`

`);
  let t = w(p(e, s), e.assetUrls, n);
  return e.kind === "formula" && e.label && (t = g(t, e.label)), t;
}
function b(e) {
  const s = h(f(e));
  if (!s || s.length === 0) return null;
  const n = M(), t = [], o = [], i = [];
  for (const r of s) {
    const a = u(r, "source", n), c = r.hasTranslation ? u(r, "translated", n) : a;
    a && t.push(a), c && o.push(c), a && i.push(r.hasTranslation && c && c !== a ? `${a}

${c}` : a);
  }
  const d = (r) => `${r.join(`

`).trim()}
`, m = [], l = /* @__PURE__ */ new Set();
  for (const r of s)
    for (const a of r.assetUrls)
      !a || l.has(a) || (l.add(a), m.push({ url: a, path: n(a) }));
  return {
    source: d(t),
    translated: d(o),
    bilingual: d(i),
    hasTranslation: s.some((r) => r.hasTranslation),
    assets: m
  };
}
export {
  b as buildReaderMarkdownExport,
  T as extractMarkdownMath,
  U as materializeMarkdownMathFallbackHtml,
  j as materializeMarkdownMathHtml,
  z as mathFailureStats,
  v as normalizeBlockKey,
  E as normalizeMathTex,
  I as parseMarkdownWithMath,
  y as renderMathFallbackHtml,
  B as resetMarkdownMathEngineLoader,
  F as revealProtectedTokens,
  H as setMarkdownMathEngineLoader,
  L as wrapMathSvgHtml
};
//# sourceMappingURL=content.js.map
