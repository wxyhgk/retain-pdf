import { e as R, m as U, a as j, b as y, n as z, p as E, r as I, c as S, d as v, f as B, s as F, w as H } from "../markdown-math-B8jhIfTG.js";
import { n as f } from "../reader-regions-BmqHsJ-I.js";
import { a as P } from "../reader-regions-BmqHsJ-I.js";
import { b as h, r as p } from "../reader-blocks-DasBcCfQ.js";
function g(a, o) {
  const n = o.replace(/^\s*\(\s*|\s*\)\s*$/g, "").trim();
  if (!n) return a;
  const t = a.trimEnd();
  if (t.endsWith("$$") && t.length > 4) {
    const r = t.slice(0, -2).trimEnd();
    return /\\tag\s*\{/.test(r) ? t : `${r} \\tag{${n}}
$$`;
  }
  return `${t} ${o.trim()}`;
}
function M() {
  const a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set();
  return (n) => {
    const t = a.get(n);
    if (t) return t;
    let r = n;
    try {
      r = new URL(n, "http://local.invalid/").pathname;
    } catch {
    }
    const i = (() => {
      try {
        return decodeURIComponent(r);
      } catch {
        return r;
      }
    })(), l = ((i.includes("/images/") ? i.slice(i.lastIndexOf("/images/") + 8) : "") || i.split("/").filter(Boolean).pop() || "image").replace(/^\/+/, "").split("/").map((e) => e.replace(/[^\w.\-一-鿿]+/g, "_") || "_").join("/");
    let s = `images/${l}`;
    for (let e = 2; o.has(s); e += 1) s = `images/${l.replace(/(\.[^./]+)?$/, `-${e}$1`)}`;
    return o.add(s), a.set(n, s), s;
  };
}
function w(a, o, n) {
  let t = a;
  for (const r of o)
    r && t.includes(r) && (t = t.split(r).join(n(r)));
  return t;
}
function u(a, o, n) {
  if (a.kind === "figure")
    return a.assetUrls.map((r) => `![](${n(r)})`).join(`

`);
  let t = w(p(a, o), a.assetUrls, n);
  return a.kind === "formula" && a.label && (t = g(t, a.label)), t;
}
function b(a) {
  const o = h(f(a));
  if (!o || o.length === 0) return null;
  const n = M(), t = [], r = [], i = [];
  for (const s of o) {
    const e = u(s, "source", n), c = s.hasTranslation ? u(s, "translated", n) : e;
    e && t.push(e), c && r.push(c), e && i.push(s.hasTranslation && c && c !== e ? `${e}

${c}` : e);
  }
  const d = (s) => `${s.join(`

`).trim()}
`, m = [], l = /* @__PURE__ */ new Set();
  for (const s of o)
    for (const e of s.assetUrls)
      !e || l.has(e) || (l.add(e), m.push({ url: e, path: n(e) }));
  return {
    source: d(t),
    translated: d(r),
    bilingual: d(i),
    hasTranslation: o.some((s) => s.hasTranslation),
    assets: m
  };
}
export {
  b as buildReaderMarkdownExport,
  R as extractMarkdownMath,
  U as materializeMarkdownMathFallbackHtml,
  j as materializeMarkdownMathHtml,
  y as mathFailureStats,
  P as normalizeBlockKey,
  z as normalizeMathTex,
  E as parseMarkdownWithMath,
  I as renderMathFallbackHtml,
  S as renderTexToSvg,
  v as resetMarkdownMathEngineLoader,
  B as revealProtectedTokens,
  F as setMarkdownMathEngineLoader,
  H as wrapMathSvgHtml
};
//# sourceMappingURL=content.js.map
