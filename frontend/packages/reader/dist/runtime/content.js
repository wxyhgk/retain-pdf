import { e as T, m as U, a as j, b as y, n as z, p as E, r as I, c as B, d as F, s as H, w as L } from "../markdown-math-XkF5urpn.js";
import { n as f } from "../reader-regions-BmqHsJ-I.js";
import { a as v } from "../reader-regions-BmqHsJ-I.js";
import { b as h, r as p } from "../reader-blocks-DasBcCfQ.js";
function g(a, o) {
  const n = o.replace(/^\s*\(\s*|\s*\)\s*$/g, "").trim();
  if (!n) return a;
  const t = a.trimEnd();
  if (t.endsWith("$$") && t.length > 4) {
    const s = t.slice(0, -2).trimEnd();
    return /\\tag\s*\{/.test(s) ? t : `${s} \\tag{${n}}
$$`;
  }
  return `${t} ${o.trim()}`;
}
function M() {
  const a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set();
  return (n) => {
    const t = a.get(n);
    if (t) return t;
    let s = n;
    try {
      s = new URL(n, "http://local.invalid/").pathname;
    } catch {
    }
    const i = (() => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    })(), l = ((i.includes("/images/") ? i.slice(i.lastIndexOf("/images/") + 8) : "") || i.split("/").filter(Boolean).pop() || "image").replace(/^\/+/, "").split("/").map((e) => e.replace(/[^\w.\-一-鿿]+/g, "_") || "_").join("/");
    let r = `images/${l}`;
    for (let e = 2; o.has(r); e += 1) r = `images/${l.replace(/(\.[^./]+)?$/, `-${e}$1`)}`;
    return o.add(r), a.set(n, r), r;
  };
}
function w(a, o, n) {
  let t = a;
  for (const s of o)
    s && t.includes(s) && (t = t.split(s).join(n(s)));
  return t;
}
function u(a, o, n) {
  if (a.kind === "figure")
    return a.assetUrls.map((s) => `![](${n(s)})`).join(`

`);
  let t = w(p(a, o), a.assetUrls, n);
  return a.kind === "formula" && a.label && (t = g(t, a.label)), t;
}
function b(a) {
  const o = h(f(a));
  if (!o || o.length === 0) return null;
  const n = M(), t = [], s = [], i = [];
  for (const r of o) {
    const e = u(r, "source", n), c = r.hasTranslation ? u(r, "translated", n) : e;
    e && t.push(e), c && s.push(c), e && i.push(r.hasTranslation && c && c !== e ? `${e}

${c}` : e);
  }
  const d = (r) => `${r.join(`

`).trim()}
`, m = [], l = /* @__PURE__ */ new Set();
  for (const r of o)
    for (const e of r.assetUrls)
      !e || l.has(e) || (l.add(e), m.push({ url: e, path: n(e) }));
  return {
    source: d(t),
    translated: d(s),
    bilingual: d(i),
    hasTranslation: o.some((r) => r.hasTranslation),
    assets: m
  };
}
export {
  b as buildReaderMarkdownExport,
  T as extractMarkdownMath,
  U as materializeMarkdownMathFallbackHtml,
  j as materializeMarkdownMathHtml,
  y as mathFailureStats,
  v as normalizeBlockKey,
  z as normalizeMathTex,
  E as parseMarkdownWithMath,
  I as renderMathFallbackHtml,
  B as resetMarkdownMathEngineLoader,
  F as revealProtectedTokens,
  H as setMarkdownMathEngineLoader,
  L as wrapMathSvgHtml
};
//# sourceMappingURL=content.js.map
