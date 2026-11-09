const k = "RP_MATH_";
let m = null, f = null;
function Z(e) {
  f = e, m = null;
}
function B() {
  f = null, m = null;
}
function b(e) {
  return `${e}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function N(e) {
  return `${k}${e}`;
}
const F = /[0-9A-Za-z\\{}_^()\[\]|+\-=,.:;'~*/<>!\u00b0\u00b1\u00d7\u00f7\u2212\u2202\u03b1-\u03c9\u0391-\u03a9]+/g, H = /\\[A-Za-z]+|[_^]\{/;
function S(e, t) {
  const n = new RegExp(`${k}\\d+`, "g"), a = (i) => i.replace(
    F,
    (c) => H.test(c) ? t(c, !1) : c
  );
  let r = "", o = 0, l;
  for (; (l = n.exec(e)) !== null; )
    r += a(e.slice(o, l.index)) + l[0], o = l.index + l[0].length;
  return r += a(e.slice(o)), r;
}
const y = /<([futnvc]\d+-[0-9a-z]{3})\/>/g;
function P(e) {
  let t = 0;
  return { text: `${e ?? ""}`.replace(y, (a, r) => (t += 1, `[未还原 token ${r}]`)), count: t };
}
function L(e, t = {}) {
  const n = [], a = P(`${e ?? ""}`);
  a.count && (s.protectedTokens += a.count, s.protectedTokens <= 5 && console.warn(
    `[markdown-math] 译文里有 ${a.count} 个未还原的保护 token，已原样显示`
  ));
  let r = a.text;
  const o = (l, i) => {
    const c = `${l ?? ""}`.trim();
    if (!c)
      return i ? `$$${l}$$` : `$${l}$`;
    const g = N(n.length);
    return n.push({ token: g, tex: c, display: i }), g;
  };
  return r = r.replace(/\$\$([\s\S]+?)\$\$/g, (l, i) => o(i, !0)), r = r.replace(new RegExp("(?<![\\\\$])\\$(?!\\$)((?:\\\\.|[^$\\n])+?)\\$(?!\\$)", "g"), (l, i) => `${i}`.trim() ? o(i, !1) : l), t.bareLatex && (r = S(r, o)), { text: r, slots: n };
}
const j = 20, I = /data-mml-node="mtext"[^>]*fill="red"/;
function d(e, t) {
  var o;
  const n = e, a = n == null ? void 0 : n[t];
  if (a !== void 0)
    return a;
  const r = (o = n == null ? void 0 : n.default) == null ? void 0 : o[t];
  if (r !== void 0)
    return r;
  throw new Error(`mathjax-full 未导出 ${t}（CJS/ESM 互操作问题）`);
}
async function O() {
  const [e, t, n, a, r, o] = await Promise.all([
    import("mathjax-full/js/mathjax.js"),
    import("mathjax-full/js/input/tex.js"),
    import("mathjax-full/js/output/svg.js"),
    import("mathjax-full/js/adaptors/liteAdaptor.js"),
    import("mathjax-full/js/handlers/html.js"),
    import("mathjax-full/js/input/tex/AllPackages.js")
  ]), l = d(e, "mathjax"), i = d(t, "TeX"), c = d(n, "SVG"), g = d(a, "liteAdaptor"), _ = d(r, "RegisterHTMLHandler"), T = d(o, "AllPackages"), $ = g();
  _($);
  const A = l.document("", {
    InputJax: new i({
      // 方案 C：宽容渲染。`unicode` 包让 Unicode 数学符号（⟨⟩、希腊字母、
      // 运算符等）尽量直接渲染，减少严格 TeX 的报错面。
      //
      // 摘掉 `html` 包。它提供 `\href`/`\class`/`\cssId`，链接原样进 SVG，而译文
      // 是模型对 OCR 文本的输出、源头是用户上传的 PDF——不是可信输入。实测
      // `$\href{javascript:alert(1)}{x}$` 渲染出 `<a href="javascript:alert(1)">`，
      // 而实时翻译叠层是 dangerouslySetInnerHTML 直接注入，中间没有任何消毒层。
      //
      // 试过在字符串层用正则摘掉危险协议，不成立：`jav&#x61;script:` 在字符串里
      // 看着无害，浏览器解析属性时会把实体解码回 `javascript:`。能被绕过的清洗器
      // 比没有更糟，它只提供虚假的安全感。所以从根上不产生这类属性。
      //
      // 代价：文档里真有 `\href` 时不再渲染成链接，退化成失败回退显示原文。渲染
      // PDF 的 mitex 本来也不支持 `\href`，两边因此一致。
      packages: T.filter((u) => u !== "html").concat("unicode")
    }),
    OutputJax: new c({ fontCache: "none" })
  });
  return {
    convert(u, v) {
      const R = A.convert(u, { display: v }), p = $.outerHTML(R);
      if (!/<svg[\s>]/i.test(p))
        throw new Error("mathjax produced no svg");
      if (/data-mjx-error|merror/i.test(p))
        throw new Error("mathjax error node");
      if (I.test(p))
        throw new Error("mathjax undefined command");
      return p;
    }
  };
}
const s = {
  engineLoad: 0,
  convert: 0,
  lastReason: "",
  /** 最近若干条失败的公式原文，用来判断是哪一类写法出了问题。 */
  samples: [],
  /** 译文里漏还原的后端保护 token 数量。不是渲染失败，是上游漏了一步。 */
  protectedTokens: 0
};
try {
  globalThis.__retainMathFailures = s;
} catch {
}
function w(e, t, n = "") {
  const a = `${(t == null ? void 0 : t.message) || t}`;
  if (s.lastReason = a, e === "engine-load") {
    s.engineLoad += 1, console.warn("[markdown-math] MathJax 引擎加载失败，公式将退回纯文本：", a);
    return;
  }
  s.convert += 1, s.samples.length < j && s.samples.push(n), s.convert <= 5 && console.warn(`[markdown-math] 公式渲染失败（第 ${s.convert} 条）：`, n, a);
}
function z() {
  return m || (m = (f ?? O)().catch((t) => {
    throw m = null, t;
  })), m;
}
function h(e, t) {
  const n = `<code class="reader-md-math-error" title="公式渲染失败">${b(e)}</code>`;
  return t ? `<div class="reader-md-math reader-md-math-display reader-md-math-failed">${n}</div>` : `<span class="reader-md-math reader-md-math-inline reader-md-math-failed">${n}</span>`;
}
function D(e, t) {
  const n = t ? "reader-md-math reader-md-math-display" : "reader-md-math reader-md-math-inline", a = t ? "div" : "span";
  return `<${a} class="${n}">${e}</${a}>`;
}
const U = [
  [/[⟨〈]/g, "\\langle "],
  [/[⟩〉]/g, "\\rangle "],
  [/∣/g, "\\mid "],
  [/‖/g, "\\| "],
  [/[≤⩽]/g, "\\le "],
  [/[≥⩾]/g, "\\ge "],
  [/≠/g, "\\ne "],
  [/≈/g, "\\approx "],
  [/≡/g, "\\equiv "],
  [/×/g, "\\times "],
  [/÷/g, "\\div "],
  [/[·⋅]/g, "\\cdot "],
  [/±/g, "\\pm "],
  [/∓/g, "\\mp "],
  [/[−–]/g, "-"],
  [/∞/g, "\\infty "],
  [/∑/g, "\\sum "],
  [/∏/g, "\\prod "],
  [/∫/g, "\\int "],
  [/√/g, "\\surd "],
  [/∂/g, "\\partial "],
  [/∇/g, "\\nabla "],
  [/→/g, "\\to "],
  [/←/g, "\\leftarrow "],
  [/⇒/g, "\\Rightarrow "],
  [/⇔/g, "\\Leftrightarrow "],
  [/∈/g, "\\in "],
  [/∉/g, "\\notin "],
  [/∀/g, "\\forall "],
  [/∃/g, "\\exists "],
  [/∅/g, "\\emptyset "],
  [/∝/g, "\\propto "],
  [/≃/g, "\\simeq "],
  [/≅/g, "\\cong "],
  [/⊥/g, "\\perp "],
  [/∥/g, "\\parallel "],
  [/[′ʹ]/g, "'"],
  [/[″ʺ]/g, "''"],
  [/Δ/g, "\\Delta "],
  [/Ω/g, "\\Omega "],
  [/μ/g, "\\mu "],
  [/λ/g, "\\lambda "],
  [/σ/g, "\\sigma "],
  [/π/g, "\\pi "],
  [/θ/g, "\\theta "],
  [/φ/g, "\\varphi "],
  [/α/g, "\\alpha "],
  [/β/g, "\\beta "],
  [/γ/g, "\\gamma "],
  [/ω/g, "\\omega "]
];
function J(e) {
  let t = `${e ?? ""}`;
  for (const [n, a] of U)
    t = t.replace(n, a);
  return X(t) ? C(t) : t;
}
function X(e) {
  const t = "(?:\\{[^{}]*\\}|\\\\[A-Za-z]+|[A-Za-z0-9*])", n = new RegExp(`[_^]${t}\\s*(?=[_^])`), a = new RegExp(`[_^]${t}\\s*'`);
  return n.test(e) || a.test(e) || /\^\s*\^/.test(e) || /__/.test(e);
}
function x(e, t) {
  let n = 0, a = t;
  for (; a < e.length; a += 1)
    if (e[a] === "{") n += 1;
    else if (e[a] === "}" && (n -= 1, n === 0)) {
      a += 1;
      break;
    }
  return { arg: e.slice(t, a), next: a };
}
function M(e, t) {
  let n = t;
  for (; n < e.length && e[n] === " "; ) n += 1;
  if (e[n] === "{") return x(e, n);
  if (e[n] === "\\") {
    let a = n + 1;
    for (; a < e.length && /[A-Za-z]/.test(e[a]); ) a += 1;
    let r = a > n + 1 ? a : a + 1;
    for (; ; ) {
      let o = r;
      for (; o < e.length && e[o] === " "; ) o += 1;
      if (e[o] !== "{") break;
      r = x(e, o).next;
    }
    return { arg: e.slice(n, r), next: r };
  }
  return { arg: e[n] ?? "", next: n + 1 };
}
function C(e) {
  const t = e.replace(/\^\s*\^/g, "^").replace(/''/g, "^{\\prime\\prime}").replace(/'/g, "^{\\prime}");
  let n = "", a = 0;
  for (; a < t.length; ) {
    const r = t[a];
    if (r !== "_" && r !== "^") {
      n += r, a += 1;
      continue;
    }
    const o = M(t, a + 1);
    let l = o.arg, i = o.next;
    for (; i < t.length; ) {
      let c = i;
      for (; c < t.length && t[c] === " "; ) c += 1;
      if (t[c] !== r) break;
      const g = M(t, c + 1);
      l = `${l}${t.slice(i, c)}${r}${g.arg}`, i = g.next;
    }
    n += `${r}{${l}}`, a = i;
  }
  return n;
}
async function K(e, t) {
  if (!t.length)
    return e;
  let n = null;
  try {
    n = await z();
  } catch (o) {
    n = null, w("engine-load", o);
  }
  const a = /* @__PURE__ */ new Map();
  let r = 0;
  for (const o of t) {
    let l;
    if (n)
      try {
        l = D(n.convert(J(o.tex), o.display), o.display);
      } catch (i) {
        l = h(o.tex, o.display), w("convert", i, o.tex);
      }
    else
      l = h(o.tex, o.display);
    a.set(o.token, l), r += 1, r % 24 === 0 && await new Promise((i) => setTimeout(i, 0));
  }
  return E(`${e ?? ""}`, t, a);
}
function E(e, t, n) {
  if (!t.length) return e;
  const a = new RegExp(
    t.map((r) => r.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "g"
  );
  return e.replace(a, (r) => n.get(r) || r);
}
function G(e, t) {
  const n = new Map(
    t.map((a) => [a.token, h(a.tex, a.display)])
  );
  return E(`${e ?? ""}`, t, n);
}
async function q(e, t) {
  const { text: n, slots: a } = L(e), r = t(n);
  return K(r, a);
}
export {
  K as a,
  s as b,
  B as c,
  P as d,
  L as e,
  G as m,
  J as n,
  q as p,
  h as r,
  Z as s,
  D as w
};
//# sourceMappingURL=markdown-math-XkF5urpn.js.map
