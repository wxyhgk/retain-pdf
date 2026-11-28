const k = "RP_MATH_";
let m = null, $ = null;
function Z(e) {
  $ = e, m = null;
}
function B() {
  $ = null, m = null;
}
function b(e) {
  return `${e}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function N(e) {
  return `${k}${e}`;
}
const S = /[0-9A-Za-z\\{}_^()\[\]|+\-=,.:;'~*/<>!\u00b0\u00b1\u00d7\u00f7\u2212\u2202\u03b1-\u03c9\u0391-\u03a9]+/g, F = /\\[A-Za-z]+|[_^]\{/;
function H(e, t) {
  const n = new RegExp(`${k}\\d+`, "g"), a = (c) => c.replace(
    S,
    (i) => F.test(i) ? t(i, !1) : i
  );
  let r = "", o = 0, l;
  for (; (l = n.exec(e)) !== null; )
    r += a(e.slice(o, l.index)) + l[0], o = l.index + l[0].length;
  return r += a(e.slice(o)), r;
}
const P = /<([futnvc]\d+-[0-9a-z]{3})\/>/g;
function L(e) {
  let t = 0;
  return { text: `${e ?? ""}`.replace(P, (a, r) => (t += 1, `[未还原 token ${r}]`)), count: t };
}
function j(e, t = {}) {
  const n = [], a = L(`${e ?? ""}`);
  a.count && (s.protectedTokens += a.count, s.protectedTokens <= 5 && console.warn(
    `[markdown-math] 译文里有 ${a.count} 个未还原的保护 token，已原样显示`
  ));
  let r = a.text;
  const o = (l, c) => {
    const i = `${l ?? ""}`.trim();
    if (!i)
      return c ? `$$${l}$$` : `$${l}$`;
    const g = N(n.length);
    return n.push({ token: g, tex: i, display: c }), g;
  };
  return r = r.replace(/\$\$([\s\S]+?)\$\$/g, (l, c) => o(c, !0)), r = r.replace(new RegExp("(?<![\\\\$])\\$(?!\\$)((?:\\\\.|[^$\\n])+?)\\$(?!\\$)", "g"), (l, c) => `${c}`.trim() ? o(c, !1) : l), t.bareLatex && (r = H(r, o)), { text: r, slots: n };
}
const I = 20, O = /data-mml-node="mtext"[^>]*fill="red"/;
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
async function z() {
  const [e, t, n, a, r, o] = await Promise.all([
    import("mathjax-full/js/mathjax.js"),
    import("mathjax-full/js/input/tex.js"),
    import("mathjax-full/js/output/svg.js"),
    import("mathjax-full/js/adaptors/liteAdaptor.js"),
    import("mathjax-full/js/handlers/html.js"),
    import("mathjax-full/js/input/tex/AllPackages.js")
  ]), l = d(e, "mathjax"), c = d(t, "TeX"), i = d(n, "SVG"), g = d(a, "liteAdaptor"), T = d(r, "RegisterHTMLHandler"), A = d(o, "AllPackages"), w = g();
  T(w);
  const v = l.document("", {
    InputJax: new c({
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
      packages: A.filter((h) => h !== "html").concat("unicode")
    }),
    OutputJax: new i({ fontCache: "none" })
  });
  return {
    convert(h, R) {
      const y = v.convert(h, { display: R }), p = w.outerHTML(y);
      if (!/<svg[\s>]/i.test(p))
        throw new Error("mathjax produced no svg");
      if (/data-mjx-error|merror/i.test(p))
        throw new Error("mathjax error node");
      if (O.test(p))
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
function u(e, t, n = "") {
  const a = `${(t == null ? void 0 : t.message) || t}`;
  if (s.lastReason = a, e === "engine-load") {
    s.engineLoad += 1, console.warn("[markdown-math] MathJax 引擎加载失败，公式将退回纯文本：", a);
    return;
  }
  s.convert += 1, s.samples.length < I && s.samples.push(n), s.convert <= 5 && console.warn(`[markdown-math] 公式渲染失败（第 ${s.convert} 条）：`, n, a);
}
function E() {
  return m || (m = ($ ?? z)().catch((t) => {
    throw m = null, t;
  })), m;
}
async function G(e, t) {
  let n;
  try {
    n = await E();
  } catch (a) {
    return u("engine-load", a), null;
  }
  try {
    return n.convert(e, t);
  } catch (a) {
    return u("convert", a, e), null;
  }
}
function f(e, t) {
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
    let l = o.arg, c = o.next;
    for (; c < t.length; ) {
      let i = c;
      for (; i < t.length && t[i] === " "; ) i += 1;
      if (t[i] !== r) break;
      const g = M(t, i + 1);
      l = `${l}${t.slice(c, i)}${r}${g.arg}`, c = g.next;
    }
    n += `${r}{${l}}`, a = c;
  }
  return n;
}
async function K(e, t) {
  if (!t.length)
    return e;
  let n = null;
  try {
    n = await E();
  } catch (o) {
    n = null, u("engine-load", o);
  }
  const a = /* @__PURE__ */ new Map();
  let r = 0;
  for (const o of t) {
    let l;
    if (n)
      try {
        l = D(n.convert(J(o.tex), o.display), o.display);
      } catch (c) {
        l = f(o.tex, o.display), u("convert", c, o.tex);
      }
    else
      l = f(o.tex, o.display);
    a.set(o.token, l), r += 1, r % 24 === 0 && await new Promise((c) => setTimeout(c, 0));
  }
  return _(`${e ?? ""}`, t, a);
}
function _(e, t, n) {
  if (!t.length) return e;
  const a = new RegExp(
    t.map((r) => r.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "g"
  );
  return e.replace(a, (r) => n.get(r) || r);
}
function q(e, t) {
  const n = new Map(
    t.map((a) => [a.token, f(a.tex, a.display)])
  );
  return _(`${e ?? ""}`, t, n);
}
async function V(e, t) {
  const { text: n, slots: a } = j(e), r = t(n);
  return K(r, a);
}
export {
  K as a,
  s as b,
  G as c,
  B as d,
  j as e,
  L as f,
  q as m,
  J as n,
  V as p,
  f as r,
  Z as s,
  D as w
};
//# sourceMappingURL=markdown-math-B8jhIfTG.js.map
