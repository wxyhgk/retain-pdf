import { jsxs as _, jsx as b } from "react/jsx-runtime";
import { useEffect as Y, useRef as T, useState as z, useMemo as De } from "react";
import { Search as Le, ChevronUp as Ae, ChevronDown as Ue, ListTree as Se } from "lucide-react";
import { d as pe, r as se, f as fe, u as xe } from "./ReaderApp-C6FE9bMo.js";
import { e as me, m as ze, a as we } from "./markdown-math-XkF5urpn.js";
import { n as Pe } from "./markdown-payload-kK3ewW_I.js";
import { r as Te, b as qe } from "./reader-blocks-BxElLvLX.js";
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
  keepMounted: o = !1,
  onClose: a,
  toolbar: d,
  children: w
}) {
  return Y(() => {
    if (!e) return;
    const E = (p) => {
      var h;
      if (p.key !== "Escape") return;
      const C = p.target;
      (h = C == null ? void 0 : C.closest) != null && h.call(C, "textarea, input, select, [contenteditable='true']") || (p.preventDefault(), a());
    };
    return window.addEventListener("keydown", E), () => window.removeEventListener("keydown", E);
  }, [e, a]), !e && !o ? null : /* @__PURE__ */ _(
    "aside",
    {
      id: t,
      className: `reader-notes-panel reader-notes-panel--workspace${d ? " has-panel-toolbar" : ""} ${c}`.trim(),
      "aria-label": s,
      role: "dialog",
      "aria-modal": "false",
      "data-hidden": e ? void 0 : "",
      inert: e ? void 0 : !0,
      "aria-hidden": e ? void 0 : !0,
      children: [
        d ? /* @__PURE__ */ b("div", { className: "reader-notes-panel-toolbar", children: d }) : null,
        /* @__PURE__ */ b("div", { className: "reader-notes-panel-body", children: w })
      ]
    }
  );
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
  const d = [], w = [], E = /* @__PURE__ */ new Set(), p = (u, v) => {
    const m = u.ownerDocument.createElement("span");
    m.className = "reader-markdown-image-missing", m.textContent = v, m.title = u.getAttribute("data-reader-md-src") || "", u.replaceWith(m);
  };
  for (const u of t) {
    const v = u.getAttribute("data-reader-md-src") || "", m = u.ownerDocument.baseURI || "http://localhost/";
    Ve(v, e.protectedBaseUrl || m) ? w.push(u) : Ke(v, m) ? u.src = v : p(u, "[图片地址不可用]");
  }
  const C = () => {
    var u;
    return (u = e.onProgress) == null ? void 0 : u.call(e, { failed: a, loaded: o, total: w.length });
  }, h = () => {
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
          s || !u.isConnected || (a += 1, p(u, "[图片暂不可用]"));
        }).finally(() => {
          c -= 1, s || (C(), h());
        });
      }
  }, M = (u) => {
    s || E.has(u) || (E.add(u), d.push(u), h());
  }, q = globalThis.IntersectionObserver;
  let k = null;
  return q && w.length > 0 ? (k = new q((u) => {
    u.forEach((v) => {
      if (!v.isIntersecting) return;
      const m = v.target;
      k == null || k.unobserve(m), M(m);
    });
  }, { root: e.root || null, rootMargin: "600px 0px" }), w.forEach((u) => k == null ? void 0 : k.observe(u))) : w.forEach(M), C(), () => {
    s = !0, d.length = 0, k == null || k.disconnect();
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
    var E;
    const d = a.getAttribute("src") || "", w = ((E = c.resolveAssetUrl) == null ? void 0 : E.call(c, s, d)) || d;
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
`, o), w = d === -1 ? a : d, p = t.slice(o, w).trim(), C = p.match(/^(`{3,}|~{3,})/);
    if (C) {
      const h = C[1][0];
      s ? s === h && (s = "") : s = h;
    }
    if (!s && p === "") {
      const h = d === -1 ? a : d + 1;
      if (h >= e && !He(t, h, c))
        return { complete: t.slice(0, h), rest: t.slice(h) };
    } else p !== "" && (c = p);
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
  const a = T(null), [d, w] = z("尚未加载"), E = T([]), p = T(null), C = T(/* @__PURE__ */ new Map()), h = T([]), M = T(null), q = T(!1), k = T(!1), u = T(null), [v, m] = z([]), [V, I] = z(!1), [O, S] = z(!1), L = () => {
    for (const n of E.current)
      try {
        URL.revokeObjectURL(n);
      } catch {
      }
    E.current = [];
  }, N = () => {
    var n, i;
    (n = p.current) == null || n.call(p), p.current = null;
    for (const f of h.current) f();
    h.current = [], (i = M.current) == null || i.call(M), M.current = null, L();
  }, $ = () => {
    const n = a.current;
    n && (C.current = /* @__PURE__ */ new Map(), m(ae(n, C.current)));
  }, r = () => {
    const n = u.current, i = a.current;
    if (!n || !i) return;
    const f = [...i.querySelectorAll("h1, h2, h3, h4, h5, h6")].find((A) => A.id === n);
    f && (u.current = null, typeof f.scrollIntoView == "function" && f.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  return Y(() => () => {
    var n;
    (n = p.current) == null || n.call(p), L();
  }, []), Y(() => {
    if (!t) {
      N(), m([]), k.current = !1, I(!1);
      return;
    }
    let n = !1;
    N(), C.current = /* @__PURE__ */ new Map(), k.current = !1, I(!1), m([]), q.current = !1, u.current = null, S(!1);
    const i = new AbortController(), f = pe;
    async function A() {
      var l, g, D, P, R, F;
      const B = e.startsWith("doc:");
      if (!e || B) {
        w(!e && s ? "源文档阅读不提供 Markdown 产物" : "该任务暂无 Markdown 产物"), a.current && (a.current.replaceChildren(), a.current.classList.add("hidden"));
        return;
      }
      w("正在加载 Markdown…"), (l = a.current) == null || l.replaceChildren(), (g = a.current) == null || g.classList.add("hidden");
      try {
        if (typeof (f == null ? void 0 : f.loadMarkdownSource) == "function" && typeof (f == null ? void 0 : f.loadMarkdownRange) == "function") {
          const x = await f.loadMarkdownSource(e, i.signal);
          if (n) return;
          if (x != null && x.rawUrl) {
            await U(x);
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
        m(ae(a.current)), k.current = !0, I(!0), (F = o.current) == null || F.call(o), w("");
        const de = a.current.closest(".reader-notes-panel-body");
        p.current = be(ce, {
          root: de,
          protectedBaseUrl: X || a.current.ownerDocument.baseURI,
          fetchImage: fe,
          signal: i.signal,
          onObjectUrl: (J) => E.current.push(J),
          onProgress: ({ failed: J }) => {
            !n && J > 0 && w(`正文已加载 · ${J} 张图片不可用`);
          }
        });
      } catch (x) {
        if (n) return;
        w(x instanceof Error ? x.message : "Markdown 加载失败");
      }
    }
    async function U(B) {
      var J;
      const l = a.current;
      if (!l) return;
      const g = 262144, D = 8192, P = `${B.imagesBaseUrl || ""}`, R = l.closest(".reader-notes-panel-body");
      let F = new TextDecoder(), x = 0, W = `${B.etag || ""}`, X = Number.isFinite(Number(B.totalBytes)) ? Number(B.totalBytes) : null, K = "", j = !1;
      const G = 4, te = 4e3;
      let re = 0;
      const oe = () => {
        for (const y of h.current) y();
        h.current = [], L(), C.current = /* @__PURE__ */ new Map(), m([]);
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
        const ke = ae(ie, C.current);
        ke.length && m((ee) => [...ee, ...ke]), r();
        const $e = be(Oe, {
          root: R,
          protectedBaseUrl: P || l.ownerDocument.baseURI,
          fetchImage: fe,
          signal: i.signal,
          onObjectUrl: (ee) => E.current.push(ee),
          onProgress: ({ failed: ee }) => {
            !n && ee > 0 && w(`正文已加载 · ${ee} 张图片不可用`);
          }
        });
        h.current.push($e);
      }, de = async () => {
        q.current || !R || n || l.scrollHeight <= R.clientHeight * 2 || (S(!0), w("已加载部分 · 滚动或点击继续加载"), await new Promise((y) => {
          let H = !1, Q = null;
          const Z = (he) => {
            H || (H = !0, R.removeEventListener("scroll", ne), Q && (clearTimeout(Q), Q = null), M.current = null, n || (S(!1), he && (re = 0)), y());
          }, ne = () => {
            (l.scrollHeight <= R.clientHeight * 2 || R.scrollTop + R.clientHeight >= l.scrollHeight - 800) && Z(!0);
          };
          M.current = () => Z(!0), R.addEventListener("scroll", ne, { passive: !0 }), re < G && (re += 1, Q = setTimeout(() => Z(!1), te));
        }));
      };
      try {
        for (; !j && !n; ) {
          const y = await f.loadMarkdownRange(
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
        n || ($(), k.current = !0, I(!0), r(), w(""), c.current.trim() && ((J = o.current) == null || J.call(o)));
      } catch (y) {
        if (n || i.signal.aborted) return;
        w(y instanceof Error ? y.message : "Markdown 加载失败");
      }
    }
    return A(), () => {
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
    outlineCompleteRef: k,
    pendingResume: O,
    rebuildOutline: $,
    renderAllRef: q,
    pendingAnchorRef: u,
    resumeCleanupRef: M
  };
}
const Ee = 40, Ce = { resolveAssetUrl: se };
function je(t, e, s, c) {
  const [o, a] = z(""), [d, w] = z([]), E = T(/* @__PURE__ */ new Map()), [p, C] = z(0);
  return Y(() => {
    const h = t.current;
    if (!c || !h) return;
    let M = !1;
    const q = new AbortController(), k = [], u = [], v = /* @__PURE__ */ new Map();
    E.current = v, h.replaceChildren(), a("正在排版…");
    const m = h.closest(".reader-notes-panel-body"), V = async (O, S) => {
      const { text: L, slots: N } = me(O, { bareLatex: !0 }), $ = S(L);
      return N.length > 0 ? we($, N) : $;
    }, I = async (O, S, L, N) => {
      if (S.kind === "figure") {
        const r = S.assetUrls.map((n) => `<img src="${Xe(n)}" alt="">`).join("");
        return le(O, r, "", Ce);
      }
      let $ = await V(Te(S, L), N);
      return S.kind === "formula" && S.label && ($ += `<span class="reader-md-formula-label">${Ge(S.label)}</span>`), le(O, $, "", Ce);
    };
    return (async () => {
      try {
        const { marked: O } = await ge(), S = (L) => String(O.parse(L, { async: !1 }));
        for (let L = 0; L < e.length; L += Ee) {
          if (M) return;
          const N = h.ownerDocument.createDocumentFragment(), $ = [];
          for (const r of e.slice(L, L + Ee)) {
            const n = h.ownerDocument.createElement("div");
            n.className = `reader-md-block is-${r.kind}`, n.dataset.mdBlock = r.key, n.dataset.mdPage = `${r.page}`, n.tabIndex = 0, n.setAttribute("role", "button"), n.setAttribute("aria-label", `跳到第 ${r.page} 页的这一块`);
            const i = s === "bilingual" && r.hasTranslation, f = i ? ["source", "translated"] : [s === "source" ? "source" : "translated"];
            for (const A of f) {
              const U = h.ownerDocument.createElement("div");
              if (U.className = i ? `reader-md-block-${A}` : "reader-md-block-body", $.push(...await I(U, r, A, S)), M) return;
              n.appendChild(U);
            }
            for (const A of r.itemIds) v.set(A, n);
            N.appendChild(n);
          }
          h.appendChild(N), h.classList.remove("hidden"), u.push(be($, {
            root: m,
            // 受保护的判断要以 API 地址为准（它可能是局域网 IP，和静态页不同源）。
            protectedBaseUrl: se("", "/api/v1/"),
            fetchImage: fe,
            signal: q.signal,
            onObjectUrl: (r) => k.push(r)
          })), await new Promise((r) => setTimeout(r, 0));
        }
        if (M) return;
        w(ae(h).filter((L) => {
          var N;
          return !((N = h.querySelector(`#${CSS.escape(L.id)}`)) != null && N.closest(".reader-md-block-source"));
        })), a(`${e.length} 块`), C((L) => L + 1);
      } catch (O) {
        M || a(O instanceof Error ? O.message : "Markdown 排版失败");
      }
    })(), () => {
      M = !0, q.abort();
      for (const O of u) O();
      for (const O of k)
        try {
          URL.revokeObjectURL(O);
        } catch {
        }
    };
  }, [e, s, c, t]), { status: o, outline: d, elementsRef: E, renderedRevision: p };
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
  const d = T(null), w = e.some((r) => r.hasTranslation), [E, p] = z(w ? "translated" : "source"), { status: C, outline: h, elementsRef: M, renderedRevision: q } = je(d, e, E, t), [k, u] = z(!1), [v, m] = z(""), V = T([]), [I, O] = z(0), [S, L] = z(-1);
  Y(() => {
    if (!c) return;
    let r = null;
    const n = () => {
      const { itemId: f, origin: A } = c.get(), U = f ? M.current.get(f) ?? null : null;
      U !== r && (r == null || r.classList.remove("is-linked"), r = U, U && (U.classList.add("is-linked"), A === "pdf" && typeof U.scrollIntoView == "function" && U.scrollIntoView({ block: "nearest", behavior: "smooth" })));
    };
    n();
    const i = c.subscribe(n);
    return () => {
      i(), r == null || r.classList.remove("is-linked");
    };
  }, [c, M, q]), Y(() => {
    const r = d.current;
    if (!r) return;
    const n = (l) => l instanceof Element ? l.closest("[data-md-block]") : null, i = (l) => {
      const g = n(l.target);
      c == null || c.set((g == null ? void 0 : g.dataset.mdBlock) ?? null, "markdown");
    }, f = () => c == null ? void 0 : c.set(null, "markdown"), A = (l) => {
      const g = l == null ? void 0 : l.dataset.mdBlock;
      g && (o == null || o(g));
    }, U = (l) => {
      var g;
      (g = r.ownerDocument.getSelection()) != null && g.toString() || l.target instanceof Element && l.target.closest("a[href]") || A(n(l.target));
    }, B = (l) => {
      if (l.key !== "Enter" && l.key !== " ") return;
      const g = n(l.target);
      !g || g !== l.target || (l.preventDefault(), A(g));
    };
    return r.addEventListener("mouseover", i), r.addEventListener("mouseleave", f), r.addEventListener("click", U), r.addEventListener("keydown", B), () => {
      r.removeEventListener("mouseover", i), r.removeEventListener("mouseleave", f), r.removeEventListener("click", U), r.removeEventListener("keydown", B);
    };
  }, [c, o]);
  const N = (r, n = !0) => {
    const i = V.current;
    if (i.forEach((U) => U.classList.remove("reader-markdown-search-hit-active")), i.length === 0) {
      L(-1);
      return;
    }
    const f = (r + i.length) % i.length, A = i[f];
    A.classList.add("reader-markdown-search-hit-active"), L(f), n && typeof A.scrollIntoView == "function" && A.scrollIntoView({ block: "center", behavior: "smooth" });
  }, $ = (r, n = !1) => {
    const i = d.current;
    if (!i) return;
    r.trim() || Ne(i);
    const f = r.trim() ? Re(i, r) : [];
    V.current = f, O(f.length), N(f.length > 0 ? 0 : -1, n);
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
      toolbar: /* @__PURE__ */ b("span", { className: "reader-notes-count", children: C || "已加载" }),
      children: [
        /* @__PURE__ */ _("div", { className: "reader-markdown-nav", "aria-label": "Markdown 导航与搜索", children: [
          w ? /* @__PURE__ */ b("div", { className: "reader-md-view-switch", role: "tablist", "aria-label": "显示原文还是译文", children: Je.map((r) => /* @__PURE__ */ b(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": E === r.value,
              className: E === r.value ? "is-active" : void 0,
              onClick: () => p(r.value),
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
              "aria-expanded": k,
              disabled: h.length === 0,
              onClick: () => u((r) => !r),
              children: [
                /* @__PURE__ */ b(Se, { size: 13, "aria-hidden": !0 }),
                "目录",
                h.length > 0 ? ` ${h.length}` : ""
              ]
            }
          )
        ] }),
        k && h.length > 0 ? /* @__PURE__ */ b("nav", { className: "reader-markdown-outline", "aria-label": "Markdown 目录", children: h.map((r) => /* @__PURE__ */ b(
          "button",
          {
            type: "button",
            style: { "--reader-md-outline-level": r.level - 1 },
            onClick: () => {
              var f, A, U;
              const n = (f = d.current) == null ? void 0 : f.querySelector(`#${CSS.escape(r.id)}`);
              (A = n == null ? void 0 : n.scrollIntoView) == null || A.call(n, { block: "start", behavior: "smooth" });
              const i = (U = n == null ? void 0 : n.closest("[data-md-block]")) == null ? void 0 : U.dataset.mdBlock;
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
  var U, B;
  const a = T([]), d = T(""), w = T(() => {
  }), [E, p] = z(!1), [C, h] = z(""), [M, q] = z(0), [k, u] = z(-1), {
    contentRef: v,
    status: m,
    setStatus: V,
    outline: I,
    outlineComplete: O,
    setOutlineComplete: S,
    outlineCompleteRef: L,
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
  }), f = (l, g = !0) => {
    const D = a.current;
    if (D.forEach((F) => F.classList.remove("reader-markdown-search-hit-active")), D.length === 0) {
      u(-1);
      return;
    }
    const P = (l + D.length) % D.length, R = D[P];
    R.classList.add("reader-markdown-search-hit-active"), u(P), g && typeof R.scrollIntoView == "function" && R.scrollIntoView({ block: "center", behavior: "smooth" });
  }, A = (l, g = !1) => {
    var R;
    const D = `${l || ""}`.trim();
    if (r.current = D.length > 0, r.current && ((R = i.current) == null || R.call(i)), !v.current) return;
    const P = Re(v.current, l);
    a.current = P, q(P.length), f(P.length > 0 ? 0 : -1, g);
  };
  return w.current = () => A(d.current), /* @__PURE__ */ _(
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
                value: C,
                placeholder: "搜索正文",
                "aria-label": "搜索 Markdown 正文",
                onChange: (l) => {
                  const g = l.target.value;
                  d.current = g, h(g), A(g, !1);
                },
                onKeyDown: (l) => {
                  l.key !== "Enter" || M === 0 || (l.preventDefault(), f(k + (l.shiftKey ? -1 : 1)));
                }
              }
            ),
            C ? /* @__PURE__ */ b("span", { className: "reader-markdown-search-count", "aria-live": "polite", children: M > 0 ? `${k + 1}/${M}` : "0/0" }) : null,
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "上一个搜索结果",
                disabled: M === 0,
                onClick: () => f(k - 1),
                children: /* @__PURE__ */ b(Ae, { size: 13, "aria-hidden": !0 })
              }
            ),
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "下一个搜索结果",
                disabled: M === 0,
                onClick: () => f(k + 1),
                children: /* @__PURE__ */ b(Ue, { size: 13, "aria-hidden": !0 })
              }
            )
          ] }),
          /* @__PURE__ */ _(
            "button",
            {
              type: "button",
              className: "reader-markdown-outline-toggle",
              "aria-expanded": E,
              disabled: I.length === 0,
              onClick: () => {
                $(), S(L.current), p((l) => !l);
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
        E && I.length > 0 ? /* @__PURE__ */ _("nav", { className: "reader-markdown-outline", "aria-label": "Markdown 目录", children: [
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
        m && !((B = (U = v.current) == null ? void 0 : U.childNodes) != null && B.length) ? /* @__PURE__ */ b("p", { className: "reader-notes-empty", children: m }) : null,
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
//# sourceMappingURL=ReaderMarkdownPanel-cDcXuWqb.js.map
