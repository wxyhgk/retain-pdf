const f = "RP_MATH_";
let s = null, d = null;
function v(t) {
  d = t, s = null;
}
function H() {
  d = null, s = null;
}
function g(t) {
  return `${t}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function M(t) {
  return `${f}${t}`;
}
function w(t) {
  const n = [];
  let e = `${t ?? ""}`;
  const r = (l, a) => {
    const o = `${l ?? ""}`.trim();
    if (!o)
      return a ? `$$${l}$$` : `$${l}$`;
    const c = M(n.length);
    return n.push({ token: c, tex: o, display: a }), c;
  };
  return e = e.replace(/\$\$([\s\S]+?)\$\$/g, (l, a) => r(a, !0)), e = e.replace(/\\\[([\s\S]+?)\\\]/g, (l, a) => r(a, !0)), e = e.replace(/\\\(([\s\S]+?)\\\)/g, (l, a) => r(a, !1)), e = e.replace(new RegExp("(?<![\\\\$])\\$(?!\\$)((?:\\\\.|[^$\\n])+?)\\$(?!\\$)", "g"), (l, a) => `${a}`.trim() ? r(a, !1) : l), { text: e, slots: n };
}
async function k() {
  const [
    { mathjax: t },
    { TeX: n },
    { SVG: e },
    { liteAdaptor: r },
    { RegisterHTMLHandler: l },
    { AllPackages: a }
  ] = await Promise.all([
    import("mathjax-full/js/mathjax.js"),
    import("mathjax-full/js/input/tex.js"),
    import("mathjax-full/js/output/svg.js"),
    import("mathjax-full/js/adaptors/liteAdaptor.js"),
    import("mathjax-full/js/handlers/html.js"),
    import("mathjax-full/js/input/tex/AllPackages.js")
  ]), o = r();
  l(o);
  const c = t.document("", {
    InputJax: new n({
      packages: a
    }),
    OutputJax: new e({ fontCache: "none" })
  });
  return {
    convert(p, h) {
      const $ = c.convert(p, { display: h }), m = o.outerHTML($);
      if (!/<svg[\s>]/i.test(m))
        throw new Error("mathjax produced no svg");
      return m;
    }
  };
}
function x() {
  return s || (s = (d ?? k)().catch((n) => {
    throw s = null, n;
  })), s;
}
function i(t, n) {
  const e = `<code class="reader-md-math-error" title="公式渲染失败">${g(t)}</code>`;
  return n ? `<div class="reader-md-math reader-md-math-display reader-md-math-failed">${e}</div>` : `<span class="reader-md-math reader-md-math-inline reader-md-math-failed">${e}</span>`;
}
function y(t, n) {
  const e = n ? "reader-md-math reader-md-math-display" : "reader-md-math reader-md-math-inline", r = n ? "div" : "span";
  return `<${r} class="${e}">${t}</${r}>`;
}
async function E(t, n) {
  if (!n.length)
    return t;
  let e = null;
  try {
    e = await x();
  } catch {
    e = null;
  }
  const r = /* @__PURE__ */ new Map();
  let l = 0;
  for (const a of n) {
    let o;
    if (e)
      try {
        o = y(e.convert(a.tex, a.display), a.display);
      } catch {
        o = i(a.tex, a.display);
      }
    else
      o = i(a.tex, a.display);
    r.set(a.token, o), l += 1, l % 24 === 0 && await new Promise((c) => setTimeout(c, 0));
  }
  return u(`${t ?? ""}`, n, r);
}
function u(t, n, e) {
  if (!n.length) return t;
  const r = new RegExp(
    n.map((l) => l.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "g"
  );
  return t.replace(r, (l) => e.get(l) || l);
}
function A(t, n) {
  const e = new Map(
    n.map((r) => [r.token, i(r.tex, r.display)])
  );
  return u(`${t ?? ""}`, n, e);
}
async function T(t, n) {
  const { text: e, slots: r } = w(t), l = n(e);
  return E(l, r);
}
export {
  E as a,
  H as b,
  w as e,
  A as m,
  T as p,
  i as r,
  v as s,
  y as w
};
//# sourceMappingURL=markdown-math-Cb17EyYs.js.map
