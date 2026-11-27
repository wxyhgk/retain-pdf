import { jsxs as _, jsx as b } from "react/jsx-runtime";
import { useEffect as Y, useRef as T, useState as z, useMemo as De } from "react";
import { Search as Le, ChevronUp as Ae, ChevronDown as Ue, ListTree as Se } from "lucide-react";
import { f as pe, g as se, h as fe, u as xe } from "./ReaderApp-Cm0fjd1Y.js";
import { e as me, m as ze, a as we } from "./markdown-math-XkF5urpn.js";
import { n as Pe } from "./markdown-payload-kK3ewW_I.js";
import { r as Te, b as qe } from "./reader-blocks-DasBcCfQ.js";
const ve = "h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre";
function Ne(t) {
  t.querySelectorAll(".reader-markdown-search-hit, .reader-markdown-search-hit-active").forEach((e) => {
    e.classList.remove("reader-markdown-search-hit", "reader-markdown-search-hit-active");
  });
}
function Re(t, e) {
  Ne(t);
  const s = e.trim().toLocaleLowerCase();
  if (!s) return [];
  const o = [...t.querySelectorAll(ve)].filter((a) => [...a.children].some((d) => d.matches(ve)) ? !1 : (a.textContent || "").toLocaleLowerCase().includes(s));
  return o.forEach((a) => a.classList.add("reader-markdown-search-hit")), o;
}
function Ie({
  id: t,
  open: e,
  ariaLabel: s,
  className: c = "",
  onClose: o,
  toolbar: a,
  children: d
}) {
  return Y(() => {
    if (!e) return;
    const w = (M) => {
      var U;
      if (M.key !== "Escape") return;
      const k = M.target;
      (U = k == null ? void 0 : k.closest) != null && U.call(k, "textarea, input, select, [contenteditable='true']") || (M.preventDefault(), o());
    };
    return window.addEventListener("keydown", w), () => window.removeEventListener("keydown", w);
  }, [e, o]), e ? /* @__PURE__ */ _(
    "aside",
    {
      id: t,
      className: `reader-notes-panel reader-notes-panel--workspace${a ? " has-panel-toolbar" : ""} ${c}`.trim(),
      "aria-label": s,
      role: "dialog",
      "aria-modal": "false",
      children: [
        a ? /* @__PURE__ */ b("div", { className: "reader-notes-panel-toolbar", children: a }) : null,
        /* @__PURE__ */ b("div", { className: "reader-notes-panel-body", children: d })
      ]
    }
  ) : null;
}
function Be(t) {
  return t.normalize("NFKC").trim().toLocaleLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "") || "section";
}
function ae(t, e = /* @__PURE__ */ new Map()) {
  return [...t.querySelectorAll("h1, h2, h3, h4, h5, h6")].flatMap((s) => {
    const c = (s.textContent || "").replace(/\s+/g, " ").trim();
    if (!c) return [];
    const o = Be(c), a = (e.get(o) || 0) + 1;
    e.set(o, a);
    const d = a === 1 ? `reader-md-${o}` : `reader-md-${o}-${a}`;
    return s.id = d, [{ id: d, level: Number(s.tagName.slice(1)), text: c }];
  });
}
function Ve(t, e = "http://localhost/") {
  var s;
  if (/^mock:\/\//i.test(t)) return !0;
  try {
    const c = ((s = globalThis.location) == null ? void 0 : s.href) || "http://localhost/", o = new URL(e, c), a = new URL(t, o);
    if (!/\/api\/v1\/jobs\/[^/]+\/(?:markdown|files\/output\/ocr)\/images\//.test(a.pathname)) return !1;
    if (!/^[a-z][a-z\d+.-]*:/i.test(t)) return !0;
    const d = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(a.hostname);
    return a.origin === o.origin || d;
  } catch {
    return !1;
  }
}
function Ke(t, e) {
  if (/^data:image\//i.test(t) || /^blob:/i.test(t)) return !0;
  try {
    const s = new URL(t, e);
    return s.protocol === "http:" || s.protocol === "https:";
  } catch {
    return !1;
  }
}
function be(t, e) {
  let s = !1, c = 0, o = 0, a = 0;
  const d = [], w = [], M = /* @__PURE__ */ new Set(), k = (u, v) => {
    const m = u.ownerDocument.createElement("span");
    m.className = "reader-markdown-image-missing", m.textContent = v, m.title = u.getAttribute("data-reader-md-src") || "", u.replaceWith(m);
  };
  for (const u of t) {
    const v = u.getAttribute("data-reader-md-src") || "", m = u.ownerDocument.baseURI || "http://localhost/";
    Ve(v, e.protectedBaseUrl || m) ? w.push(u) : Ke(v, m) ? u.src = v : k(u, "[图片地址不可用]");
  }
  const U = () => {
    var u;
    return (u = e.onProgress) == null ? void 0 : u.call(e, { failed: a, loaded: o, total: w.length });
  }, f = () => {
    if (!s)
      for (; c < 4 && d.length > 0; ) {
        const u = d.shift();
        if (!(u != null && u.isConnected)) continue;
        c += 1;
        const v = u.getAttribute("data-reader-md-src") || "";
        e.fetchImage(v, e.signal ? { signal: e.signal } : void 0).then(async (m) => {
          if (!(m != null && m.ok)) throw new Error(`HTTP ${(m == null ? void 0 : m.status) || 0}`);
          const V = URL.createObjectURL(await m.blob());
          if (s || !u.isConnected) {
            try {
              URL.revokeObjectURL(V);
            } catch {
            }
            return;
          }
          e.onObjectUrl(V), u.src = V, o += 1;
        }).catch(() => {
          s || !u.isConnected || (a += 1, k(u, "[图片暂不可用]"));
        }).finally(() => {
          c -= 1, s || (U(), f());
        });
      }
  }, E = (u) => {
    s || M.has(u) || (M.add(u), d.push(u), f());
  }, q = globalThis.IntersectionObserver;
  let p = null;
  return q && w.length > 0 ? (p = new q((u) => {
    u.forEach((v) => {
      if (!v.isIntersecting) return;
      const m = v.target;
      p == null || p.unobserve(m), E(m);
    });
  }, { root: e.root || null, rootMargin: "600px 0px" }), w.forEach((u) => p == null ? void 0 : p.observe(u))) : w.forEach(E), U(), () => {
    s = !0, d.length = 0, p == null || p.disconnect();
  };
}
let ue = null;
function ge() {
  return ue || (ue = import("marked").catch((t) => {
    throw ue = null, t;
  })), ue;
}
function _e(t) {
  t.querySelectorAll("script, iframe, object, embed, style, link, meta, base, form, input, button, textarea, select").forEach((e) => e.remove()), t.querySelectorAll("*").forEach((e) => {
    for (const s of [...e.attributes])
      /^on/i.test(s.name) && e.removeAttribute(s.name);
  }), t.querySelectorAll("a[href]").forEach((e) => {
    const s = e;
    /^\s*javascript:/i.test(s.getAttribute("href") || "") && s.removeAttribute("href"), s.setAttribute("target", "_blank"), s.setAttribute("rel", "noopener noreferrer");
  });
}
function le(t, e, s, c = {}) {
  const o = t.ownerDocument.createElement("template");
  return o.innerHTML = e, _e(o.content), o.content.querySelectorAll("img[src]").forEach((a) => {
    var M;
    const d = a.getAttribute("src") || "", w = ((M = c.resolveAssetUrl) == null ? void 0 : M.call(c, s, d)) || d;
    a.setAttribute("data-reader-md-src", w), a.setAttribute("loading", "lazy"), a.setAttribute("decoding", "async"), a.removeAttribute("src");
  }), t.replaceChildren(o.content), t.classList.remove("hidden"), [...t.querySelectorAll("img[data-reader-md-src]")];
}
function Fe(t, e) {
  let s = e;
  for (; s < t.length; ) {
    const c = t.indexOf(`
`, s), o = c === -1 ? t.length : c, a = t.slice(s, o).trim();
    if (a !== "") return a;
    if (c === -1) return null;
    s = c + 1;
  }
  return null;
}
const We = /^\s{0,3}\[[^\]]+\]:/;
function ye(t) {
  const e = t.match(/^(?:([-*+])|(\d+)([.)]))\s+/);
  return e ? e[1] ? `ul:${e[1]}` : `ol:${e[3]}` : null;
}
function He(t, e, s) {
  const c = Fe(t, e);
  if (!c) return !1;
  if (We.test(c)) return !0;
  const o = s ? ye(s) : null, a = ye(c);
  return o != null && o === a;
}
function Me(t, { minChars: e = 16384 } = {}) {
  if (!t) return null;
  let s = "", c = null, o = 0;
  const a = t.length;
  for (; o < a; ) {
    const d = t.indexOf(`
`, o), w = d === -1 ? a : d, k = t.slice(o, w).trim(), U = k.match(/^(`{3,}|~{3,})/);
    if (U) {
      const f = U[1][0];
      s ? s === f && (s = "") : s = f;
    }
    if (!s && k === "") {
      const f = d === -1 ? a : d + 1;
      if (f >= e && !He(t, f, c))
        return { complete: t.slice(0, f), rest: t.slice(f) };
    } else k !== "" && (c = k);
    if (d === -1) break;
    o = d + 1;
  }
  return null;
}
function Qe({
  open: t,
  jobId: e,
  sourceOnly: s,
  searchQueryRef: c,
  reapplySearchRef: o
}) {
  const a = T(null), [d, w] = z("尚未加载"), M = T([]), k = T(null), U = T(/* @__PURE__ */ new Map()), f = T([]), E = T(null), q = T(!1), p = T(!1), u = T(null), [v, m] = z([]), [V, I] = z(!1), [O, S] = z(!1), C = () => {
    for (const n of M.current)
      try {
        URL.revokeObjectURL(n);
      } catch {
      }
    M.current = [];
  }, N = () => {
    var n, i;
    (n = k.current) == null || n.call(k), k.current = null;
    for (const h of f.current) h();
    f.current = [], (i = E.current) == null || i.call(E), E.current = null, C();
  }, $ = () => {
    const n = a.current;
    n && (U.current = /* @__PURE__ */ new Map(), m(ae(n, U.current)));
  }, r = () => {
    const n = u.current, i = a.current;
    if (!n || !i) return;
    const h = [...i.querySelectorAll("h1, h2, h3, h4, h5, h6")].find((L) => L.id === n);
    h && (u.current = null, typeof h.scrollIntoView == "function" && h.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  return Y(() => () => {
    var n;
    (n = k.current) == null || n.call(k), C();
  }, []), Y(() => {
    if (!t) {
      N(), m([]), p.current = !1, I(!1);
      return;
    }
    let n = !1;
    N(), U.current = /* @__PURE__ */ new Map(), p.current = !1, I(!1), m([]), q.current = !1, u.current = null, S(!1);
    const i = new AbortController(), h = pe;
    async function L() {
      var l, g, D, P, R, F;
      const B = e.startsWith("doc:");
      if (!e || B) {
        w(!e && s ? "源文档阅读不提供 Markdown 产物" : "该任务暂无 Markdown 产物"), a.current && (a.current.replaceChildren(), a.current.classList.add("hidden"));
        return;
      }
      w("正在加载 Markdown…"), (l = a.current) == null || l.replaceChildren(), (g = a.current) == null || g.classList.add("hidden");
      try {
        if (typeof (h == null ? void 0 : h.loadMarkdownSource) == "function" && typeof (h == null ? void 0 : h.loadMarkdownRange) == "function") {
          const x = await h.loadMarkdownSource(e, i.signal);
          if (n) return;
          if (x != null && x.rawUrl) {
            await A(x);
            return;
          }
        }
      } catch {
      }
      try {
        const x = await pe.loadMarkdownPayload(e);
        if (n) return;
        const { content: W, imagesBaseUrl: X } = Pe(x);
        if (!W.trim()) {
          w("该任务暂无 Markdown 产物"), (D = a.current) == null || D.replaceChildren(), (P = a.current) == null || P.classList.add("hidden");
          return;
        }
        const { marked: K } = await ge();
        if (n || !a.current) return;
        const { text: j, slots: G } = me(W, { bareLatex: !0 }), te = String(K.parse(j, { async: !1 })), re = ze(te, G);
        le(a.current, re, X, {
          resolveAssetUrl: se
        }), m(ae(a.current)), (R = o.current) == null || R.call(o), w(G.length > 0 ? `正文已显示 · 正在渲染 ${G.length} 个公式…` : "");
        const oe = G.length > 0 ? await we(te, G) : te;
        if (n || !a.current) return;
        const ce = le(a.current, oe, X, {
          resolveAssetUrl: se
        });
        m(ae(a.current)), p.current = !0, I(!0), (F = o.current) == null || F.call(o), w("");
        const de = a.current.closest(".reader-notes-panel-body");
        k.current = be(ce, {
          root: de,
          protectedBaseUrl: X || a.current.ownerDocument.baseURI,
          fetchImage: fe,
          signal: i.signal,
          onObjectUrl: (J) => M.current.push(J),
          onProgress: ({ failed: J }) => {
            !n && J > 0 && w(`正文已加载 · ${J} 张图片不可用`);
          }
        });
      } catch (x) {
        if (n) return;
        w(x instanceof Error ? x.message : "Markdown 加载失败");
      }
    }
    async function A(B) {
      var J;
      const l = a.current;
      if (!l) return;
      const g = 262144, D = 8192, P = `${B.imagesBaseUrl || ""}`, R = l.closest(".reader-notes-panel-body");
      let F = new TextDecoder(), x = 0, W = `${B.etag || ""}`, X = Number.isFinite(Number(B.totalBytes)) ? Number(B.totalBytes) : null, K = "", j = !1;
      const G = 4, te = 4e3;
      let re = 0;
      const oe = () => {
        for (const y of f.current) y();
        f.current = [], C(), U.current = /* @__PURE__ */ new Map(), m([]);
      }, ce = async (y) => {
        const { marked: H } = await ge();
        if (n || !a.current) return;
        const { text: Q, slots: Z } = me(y, { bareLatex: !0 }), ne = String(H.parse(Q, { async: !1 })), he = Z.length > 0 ? await we(ne, Z) : ne;
        if (n || !a.current) return;
        const ie = l.ownerDocument.createElement("section");
        ie.className = "reader-markdown-chunk";
        const Oe = le(ie, he, P, {
          resolveAssetUrl: se
        });
        l.appendChild(ie), l.classList.remove("hidden");
        const ke = ae(ie, U.current);
        ke.length && m((ee) => [...ee, ...ke]), r();
        const $e = be(Oe, {
          root: R,
          protectedBaseUrl: P || l.ownerDocument.baseURI,
          fetchImage: fe,
          signal: i.signal,
          onObjectUrl: (ee) => M.current.push(ee),
          onProgress: ({ failed: ee }) => {
            !n && ee > 0 && w(`正文已加载 · ${ee} 张图片不可用`);
          }
        });
        f.current.push($e);
      }, de = async () => {
        q.current || !R || n || l.scrollHeight <= R.clientHeight * 2 || (S(!0), w("已加载部分 · 滚动或点击继续加载"), await new Promise((y) => {
          let H = !1, Q = null;
          const Z = (he) => {
            H || (H = !0, R.removeEventListener("scroll", ne), Q && (clearTimeout(Q), Q = null), E.current = null, n || (S(!1), he && (re = 0)), y());
          }, ne = () => {
            (l.scrollHeight <= R.clientHeight * 2 || R.scrollTop + R.clientHeight >= l.scrollHeight - 800) && Z(!0);
          };
          E.current = () => Z(!0), R.addEventListener("scroll", ne, { passive: !0 }), re < G && (re += 1, Q = setTimeout(() => Z(!1), te));
        }));
      };
      try {
        for (; !j && !n; ) {
          const y = await h.loadMarkdownRange(
            B.rawUrl,
            x,
            x + g - 1,
            W || void 0,
            i.signal
          );
          if (n) return;
          if (y.status === 404) {
            w("该任务暂无 Markdown 产物"), l.replaceChildren(), l.classList.add("hidden");
            return;
          }
          if (y.status === 200)
            l.replaceChildren(), oe(), F = new TextDecoder(), K = F.decode(y.bytes, { stream: !1 }), j = !0;
          else if (y.status === 206) {
            if (W && y.etag && y.etag !== W) {
              l.replaceChildren(), oe(), F = new TextDecoder(), K = "", x = 0, j = !1, W = y.etag;
              continue;
            }
            !W && y.etag && (W = y.etag), y.totalBytes != null && (X = y.totalBytes);
            const Q = y.rangeEnd != null ? y.rangeEnd + 1 : x + y.bytes.length;
            j = X != null ? Q >= X : y.bytes.length < g, K += F.decode(y.bytes, { stream: !j }), x = Q;
          } else
            throw new Error(`读取 Markdown 失败，请稍后重试。(${y.status})`);
          let H = Me(K, { minChars: D });
          for (; H && !n; ) {
            if (K = H.rest, await ce(H.complete), n) return;
            await de(), H = Me(K, { minChars: D });
          }
          j && K.trim() && (await ce(K), K = "");
        }
        n || ($(), p.current = !0, I(!0), r(), w(""), c.current.trim() && ((J = o.current) == null || J.call(o)));
      } catch (y) {
        if (n || i.signal.aborted) return;
        w(y instanceof Error ? y.message : "Markdown 加载失败");
      }
    }
    return L(), () => {
      n = !0, i.abort(), N();
    };
  }, [t, e, s]), {
    contentRef: a,
    status: d,
    setStatus: w,
    outline: v,
    setOutline: m,
    outlineComplete: V,
    setOutlineComplete: I,
    outlineCompleteRef: p,
    pendingResume: O,
    rebuildOutline: $,
    renderAllRef: q,
    pendingAnchorRef: u,
    resumeCleanupRef: E
  };
}
const Ee = 40, Ce = { resolveAssetUrl: se };
function je(t, e, s, c) {
  const [o, a] = z(""), [d, w] = z([]), M = T(/* @__PURE__ */ new Map()), [k, U] = z(0);
  return Y(() => {
    const f = t.current;
    if (!c || !f) return;
    let E = !1;
    const q = new AbortController(), p = [], u = [], v = /* @__PURE__ */ new Map();
    M.current = v, f.replaceChildren(), a("正在排版…");
    const m = f.closest(".reader-notes-panel-body"), V = async (O, S) => {
      const { text: C, slots: N } = me(O, { bareLatex: !0 }), $ = S(C);
      return N.length > 0 ? we($, N) : $;
    }, I = async (O, S, C, N) => {
      if (S.kind === "figure") {
        const r = S.assetUrls.map((n) => `<img src="${Xe(n)}" alt="">`).join("");
        return le(O, r, "", Ce);
      }
      let $ = await V(Te(S, C), N);
      return S.kind === "formula" && S.label && ($ += `<span class="reader-md-formula-label">${Ge(S.label)}</span>`), le(O, $, "", Ce);
    };
    return (async () => {
      try {
        const { marked: O } = await ge(), S = (C) => String(O.parse(C, { async: !1 }));
        for (let C = 0; C < e.length; C += Ee) {
          if (E) return;
          const N = f.ownerDocument.createDocumentFragment(), $ = [];
          for (const r of e.slice(C, C + Ee)) {
            const n = f.ownerDocument.createElement("div");
            n.className = `reader-md-block is-${r.kind}`, n.dataset.mdBlock = r.key, n.dataset.mdPage = `${r.page}`, n.tabIndex = 0, n.setAttribute("role", "button"), n.setAttribute("aria-label", `跳到第 ${r.page} 页的这一块`);
            const i = s === "bilingual" && r.hasTranslation, h = i ? ["source", "translated"] : [s === "source" ? "source" : "translated"];
            for (const L of h) {
              const A = f.ownerDocument.createElement("div");
              if (A.className = i ? `reader-md-block-${L}` : "reader-md-block-body", $.push(...await I(A, r, L, S)), E) return;
              n.appendChild(A);
            }
            for (const L of r.itemIds) v.set(L, n);
            N.appendChild(n);
          }
          f.appendChild(N), f.classList.remove("hidden"), u.push(be($, {
            root: m,
            // 受保护的判断要以 API 地址为准（它可能是局域网 IP，和静态页不同源）。
            protectedBaseUrl: se("", "/api/v1/"),
            fetchImage: fe,
            signal: q.signal,
            onObjectUrl: (r) => p.push(r)
          })), await new Promise((r) => setTimeout(r, 0));
        }
        if (E) return;
        w(ae(f).filter((C) => {
          var N;
          return !((N = f.querySelector(`#${CSS.escape(C.id)}`)) != null && N.closest(".reader-md-block-source"));
        })), a(`${e.length} 块`), U((C) => C + 1);
      } catch (O) {
        E || a(O instanceof Error ? O.message : "Markdown 排版失败");
      }
    })(), () => {
      E = !0, q.abort();
      for (const O of u) O();
      for (const O of p)
        try {
          URL.revokeObjectURL(O);
        } catch {
        }
    };
  }, [e, s, c, t]), { status: o, outline: d, elementsRef: M, renderedRevision: k };
}
function Xe(t) {
  return t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function Ge(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const Je = [
  { value: "translated", label: "译文" },
  { value: "source", label: "原文" },
  { value: "bilingual", label: "双语" }
];
function Ye({
  open: t,
  blocks: e,
  side: s = "right",
  regionHover: c,
  jumpToBlock: o,
  onClose: a
}) {
  const d = T(null), w = e.some((r) => r.hasTranslation), [M, k] = z(w ? "translated" : "source"), { status: U, outline: f, elementsRef: E, renderedRevision: q } = je(d, e, M, t), [p, u] = z(!1), [v, m] = z(""), V = T([]), [I, O] = z(0), [S, C] = z(-1);
  Y(() => {
    if (!c) return;
    let r = null;
    const n = () => {
      const { itemId: h, origin: L } = c.get(), A = h ? E.current.get(h) ?? null : null;
      A !== r && (r == null || r.classList.remove("is-linked"), r = A, A && (A.classList.add("is-linked"), L === "pdf" && typeof A.scrollIntoView == "function" && A.scrollIntoView({ block: "nearest", behavior: "smooth" })));
    };
    n();
    const i = c.subscribe(n);
    return () => {
      i(), r == null || r.classList.remove("is-linked");
    };
  }, [c, E, q]), Y(() => {
    const r = d.current;
    if (!r) return;
    const n = (l) => l instanceof Element ? l.closest("[data-md-block]") : null, i = (l) => {
      const g = n(l.target);
      c == null || c.set((g == null ? void 0 : g.dataset.mdBlock) ?? null, "markdown");
    }, h = () => c == null ? void 0 : c.set(null, "markdown"), L = (l) => {
      const g = l == null ? void 0 : l.dataset.mdBlock;
      g && (o == null || o(g));
    }, A = (l) => {
      var g;
      (g = r.ownerDocument.getSelection()) != null && g.toString() || l.target instanceof Element && l.target.closest("a[href]") || L(n(l.target));
    }, B = (l) => {
      if (l.key !== "Enter" && l.key !== " ") return;
      const g = n(l.target);
      !g || g !== l.target || (l.preventDefault(), L(g));
    };
    return r.addEventListener("mouseover", i), r.addEventListener("mouseleave", h), r.addEventListener("click", A), r.addEventListener("keydown", B), () => {
      r.removeEventListener("mouseover", i), r.removeEventListener("mouseleave", h), r.removeEventListener("click", A), r.removeEventListener("keydown", B);
    };
  }, [c, o]);
  const N = (r, n = !0) => {
    const i = V.current;
    if (i.forEach((A) => A.classList.remove("reader-markdown-search-hit-active")), i.length === 0) {
      C(-1);
      return;
    }
    const h = (r + i.length) % i.length, L = i[h];
    L.classList.add("reader-markdown-search-hit-active"), C(h), n && typeof L.scrollIntoView == "function" && L.scrollIntoView({ block: "center", behavior: "smooth" });
  }, $ = (r, n = !1) => {
    const i = d.current;
    if (!i) return;
    r.trim() || Ne(i);
    const h = r.trim() ? Re(i, r) : [];
    V.current = h, O(h.length), N(h.length > 0 ? 0 : -1, n);
  };
  return Y(() => {
    v.trim() && $(v);
  }, [q]), /* @__PURE__ */ _(
    Ie,
    {
      id: "reader-markdown-panel",
      open: t,
      ariaLabel: "Markdown 预览",
      className: `is-pane-${s}`,
      onClose: a,
      toolbar: /* @__PURE__ */ b("span", { className: "reader-notes-count", children: U || "已加载" }),
      children: [
        /* @__PURE__ */ _("div", { className: "reader-markdown-nav", "aria-label": "Markdown 导航与搜索", children: [
          w ? /* @__PURE__ */ b("div", { className: "reader-md-view-switch", role: "tablist", "aria-label": "显示原文还是译文", children: Je.map((r) => /* @__PURE__ */ b(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": M === r.value,
              className: M === r.value ? "is-active" : void 0,
              onClick: () => k(r.value),
              children: r.label
            },
            r.value
          )) }) : null,
          /* @__PURE__ */ _("label", { className: "reader-markdown-search", children: [
            /* @__PURE__ */ b(Le, { size: 13, "aria-hidden": !0 }),
            /* @__PURE__ */ b(
              "input",
              {
                type: "search",
                value: v,
                placeholder: "搜索正文",
                "aria-label": "搜索 Markdown 正文",
                onChange: (r) => {
                  m(r.target.value), $(r.target.value, !1);
                },
                onKeyDown: (r) => {
                  r.key !== "Enter" || I === 0 || (r.preventDefault(), N(S + (r.shiftKey ? -1 : 1)));
                }
              }
            ),
            v ? /* @__PURE__ */ b("span", { className: "reader-markdown-search-count", "aria-live": "polite", children: I > 0 ? `${S + 1}/${I}` : "0/0" }) : null,
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "上一个搜索结果",
                disabled: I === 0,
                onClick: () => N(S - 1),
                children: /* @__PURE__ */ b(Ae, { size: 13, "aria-hidden": !0 })
              }
            ),
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "下一个搜索结果",
                disabled: I === 0,
                onClick: () => N(S + 1),
                children: /* @__PURE__ */ b(Ue, { size: 13, "aria-hidden": !0 })
              }
            )
          ] }),
          /* @__PURE__ */ _(
            "button",
            {
              type: "button",
              className: "reader-markdown-outline-toggle",
              "aria-expanded": p,
              disabled: f.length === 0,
              onClick: () => u((r) => !r),
              children: [
                /* @__PURE__ */ b(Se, { size: 13, "aria-hidden": !0 }),
                "目录",
                f.length > 0 ? ` ${f.length}` : ""
              ]
            }
          )
        ] }),
        p && f.length > 0 ? /* @__PURE__ */ b("nav", { className: "reader-markdown-outline", "aria-label": "Markdown 目录", children: f.map((r) => /* @__PURE__ */ b(
          "button",
          {
            type: "button",
            style: { "--reader-md-outline-level": r.level - 1 },
            onClick: () => {
              var h, L, A;
              const n = (h = d.current) == null ? void 0 : h.querySelector(`#${CSS.escape(r.id)}`);
              (L = n == null ? void 0 : n.scrollIntoView) == null || L.call(n, { block: "start", behavior: "smooth" });
              const i = (A = n == null ? void 0 : n.closest("[data-md-block]")) == null ? void 0 : A.dataset.mdBlock;
              i && (o == null || o(i));
            },
            children: r.text
          },
          r.id
        )) }) : null,
        /* @__PURE__ */ b(
          "article",
          {
            ref: d,
            id: "reader-markdown-content",
            className: "reader-markdown-content reader-float-markdown-content is-blocks"
          }
        )
      ]
    }
  );
}
function ot(t) {
  const e = xe(), s = e == null ? void 0 : e.regions, c = De(() => s ? qe(s) : null, [s]);
  return c && c.length > 0 ? /* @__PURE__ */ b(
    Ye,
    {
      open: t.open,
      blocks: c,
      side: t.side,
      regionHover: e == null ? void 0 : e.regionHover,
      jumpToBlock: e == null ? void 0 : e.jumpToBlock,
      onClose: t.onClose
    }
  ) : /* @__PURE__ */ b(Ze, { ...t });
}
function Ze({
  open: t,
  jobId: e,
  sourceOnly: s,
  side: c = "right",
  onClose: o
}) {
  var A, B;
  const a = T([]), d = T(""), w = T(() => {
  }), [M, k] = z(!1), [U, f] = z(""), [E, q] = z(0), [p, u] = z(-1), {
    contentRef: v,
    status: m,
    setStatus: V,
    outline: I,
    outlineComplete: O,
    setOutlineComplete: S,
    outlineCompleteRef: C,
    pendingResume: N,
    rebuildOutline: $,
    renderAllRef: r,
    pendingAnchorRef: n,
    resumeCleanupRef: i
  } = Qe({
    open: t,
    jobId: e,
    sourceOnly: s,
    searchQueryRef: d,
    reapplySearchRef: w
  }), h = (l, g = !0) => {
    const D = a.current;
    if (D.forEach((F) => F.classList.remove("reader-markdown-search-hit-active")), D.length === 0) {
      u(-1);
      return;
    }
    const P = (l + D.length) % D.length, R = D[P];
    R.classList.add("reader-markdown-search-hit-active"), u(P), g && typeof R.scrollIntoView == "function" && R.scrollIntoView({ block: "center", behavior: "smooth" });
  }, L = (l, g = !1) => {
    var R;
    const D = `${l || ""}`.trim();
    if (r.current = D.length > 0, r.current && ((R = i.current) == null || R.call(i)), !v.current) return;
    const P = Re(v.current, l);
    a.current = P, q(P.length), h(P.length > 0 ? 0 : -1, g);
  };
  return w.current = () => L(d.current), /* @__PURE__ */ _(
    Ie,
    {
      id: "reader-markdown-panel",
      open: t,
      ariaLabel: "Markdown 预览",
      className: `is-pane-${c}`,
      onClose: o,
      toolbar: /* @__PURE__ */ b("span", { className: "reader-notes-count", children: m || "已加载" }),
      children: [
        /* @__PURE__ */ _("div", { className: "reader-markdown-nav", "aria-label": "Markdown 导航与搜索", children: [
          /* @__PURE__ */ _("label", { className: "reader-markdown-search", children: [
            /* @__PURE__ */ b(Le, { size: 13, "aria-hidden": !0 }),
            /* @__PURE__ */ b(
              "input",
              {
                type: "search",
                value: U,
                placeholder: "搜索正文",
                "aria-label": "搜索 Markdown 正文",
                onChange: (l) => {
                  const g = l.target.value;
                  d.current = g, f(g), L(g, !1);
                },
                onKeyDown: (l) => {
                  l.key !== "Enter" || E === 0 || (l.preventDefault(), h(p + (l.shiftKey ? -1 : 1)));
                }
              }
            ),
            U ? /* @__PURE__ */ b("span", { className: "reader-markdown-search-count", "aria-live": "polite", children: E > 0 ? `${p + 1}/${E}` : "0/0" }) : null,
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "上一个搜索结果",
                disabled: E === 0,
                onClick: () => h(p - 1),
                children: /* @__PURE__ */ b(Ae, { size: 13, "aria-hidden": !0 })
              }
            ),
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "下一个搜索结果",
                disabled: E === 0,
                onClick: () => h(p + 1),
                children: /* @__PURE__ */ b(Ue, { size: 13, "aria-hidden": !0 })
              }
            )
          ] }),
          /* @__PURE__ */ _(
            "button",
            {
              type: "button",
              className: "reader-markdown-outline-toggle",
              "aria-expanded": M,
              disabled: I.length === 0,
              onClick: () => {
                $(), S(C.current), k((l) => !l);
              },
              children: [
                /* @__PURE__ */ b(Se, { size: 13, "aria-hidden": !0 }),
                "目录",
                I.length > 0 ? ` ${I.length}` : ""
              ]
            }
          ),
          N ? /* @__PURE__ */ b(
            "button",
            {
              type: "button",
              className: "reader-markdown-resume",
              onClick: () => {
                var l;
                return (l = i.current) == null ? void 0 : l.call(i);
              },
              children: "继续加载"
            }
          ) : null
        ] }),
        M && I.length > 0 ? /* @__PURE__ */ _("nav", { className: "reader-markdown-outline", "aria-label": "Markdown 目录", children: [
          O ? null : /* @__PURE__ */ b("p", { className: "reader-markdown-outline-note", children: "仅显示已加载内容，滚动可加载更多" }),
          I.map((l) => /* @__PURE__ */ b(
            "button",
            {
              type: "button",
              style: { "--reader-md-outline-level": l.level - 1 },
              onClick: () => {
                var D, P;
                const g = [...((D = v.current) == null ? void 0 : D.querySelectorAll("h1, h2, h3, h4, h5, h6")) || []].find((R) => R.id === l.id);
                if (g && typeof g.scrollIntoView == "function") {
                  g.scrollIntoView({ block: "start", behavior: "smooth" });
                  return;
                }
                n.current = l.id, r.current = !0, (P = i.current) == null || P.call(i), V("正在加载目标章节…");
              },
              children: l.text
            },
            l.id
          ))
        ] }) : null,
        m && !((B = (A = v.current) == null ? void 0 : A.childNodes) != null && B.length) ? /* @__PURE__ */ b("p", { className: "reader-notes-empty", children: m }) : null,
        /* @__PURE__ */ b(
          "article",
          {
            ref: v,
            id: "reader-markdown-content",
            className: "reader-markdown-content reader-float-markdown-content"
          }
        )
      ]
    }
  );
}
export {
  ot as ReaderMarkdownPanel,
  ae as buildMarkdownOutline,
  Ne as clearMarkdownSearchHighlights,
  Re as findMarkdownSearchTargets,
  Ve as isProtectedMarkdownAssetUrl,
  be as startMarkdownImageLoading
};
//# sourceMappingURL=ReaderMarkdownPanel-B0ntO5Mh.js.map
