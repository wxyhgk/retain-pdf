import { jsxs as j, jsx as k } from "react/jsx-runtime";
import { useRef as z, useState as T, useEffect as ee, useMemo as xe } from "react";
import { Search as Le, ChevronUp as Ue, ChevronDown as Ae, ListTree as Ie } from "lucide-react";
import { d as pe, r as se, f as he, b as Re, u as De } from "./ReaderApp-DPkthTao.js";
import { e as me, m as Te, a as ge } from "./markdown-math-XkF5urpn.js";
import { n as _e } from "./markdown-payload-kK3ewW_I.js";
const ve = "h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre";
function Se(t) {
  t.querySelectorAll(".reader-markdown-search-hit, .reader-markdown-search-hit-active").forEach((e) => {
    e.classList.remove("reader-markdown-search-hit", "reader-markdown-search-hit-active");
  });
}
function Ne(t, e) {
  Se(t);
  const s = e.trim().toLocaleLowerCase();
  if (!s) return [];
  const c = [...t.querySelectorAll(ve)].filter((r) => [...r.children].some((d) => d.matches(ve)) ? !1 : (r.textContent || "").toLocaleLowerCase().includes(s));
  return c.forEach((r) => r.classList.add("reader-markdown-search-hit")), c;
}
function ze(t) {
  return t.normalize("NFKC").trim().toLocaleLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "") || "section";
}
function ae(t, e = /* @__PURE__ */ new Map()) {
  return [...t.querySelectorAll("h1, h2, h3, h4, h5, h6")].flatMap((s) => {
    const o = (s.textContent || "").replace(/\s+/g, " ").trim();
    if (!o) return [];
    const c = ze(o), r = (e.get(c) || 0) + 1;
    e.set(c, r);
    const d = r === 1 ? `reader-md-${c}` : `reader-md-${c}-${r}`;
    return s.id = d, [{ id: d, level: Number(s.tagName.slice(1)), text: o }];
  });
}
function Pe(t, e = "http://localhost/") {
  var s;
  if (/^mock:\/\//i.test(t)) return !0;
  try {
    const o = ((s = globalThis.location) == null ? void 0 : s.href) || "http://localhost/", c = new URL(e, o), r = new URL(t, c);
    if (!/\/api\/v1\/jobs\/[^/]+\/markdown\/images\//.test(r.pathname)) return !1;
    if (!/^[a-z][a-z\d+.-]*:/i.test(t)) return !0;
    const d = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(r.hostname);
    return r.origin === c.origin || d;
  } catch {
    return !1;
  }
}
function Be(t, e) {
  if (/^data:image\//i.test(t) || /^blob:/i.test(t)) return !0;
  try {
    const s = new URL(t, e);
    return s.protocol === "http:" || s.protocol === "https:";
  } catch {
    return !1;
  }
}
function we(t, e) {
  let s = !1, o = 0, c = 0, r = 0;
  const d = [], m = [], E = /* @__PURE__ */ new Set(), v = (u, M) => {
    const g = u.ownerDocument.createElement("span");
    g.className = "reader-markdown-image-missing", g.textContent = M, g.title = u.getAttribute("data-reader-md-src") || "", u.replaceWith(g);
  };
  for (const u of t) {
    const M = u.getAttribute("data-reader-md-src") || "", g = u.ownerDocument.baseURI || "http://localhost/";
    Pe(M, e.protectedBaseUrl || g) ? m.push(u) : Be(M, g) ? u.src = M : v(u, "[图片地址不可用]");
  }
  const p = () => {
    var u;
    return (u = e.onProgress) == null ? void 0 : u.call(e, { failed: r, loaded: c, total: m.length });
  }, f = () => {
    if (!s)
      for (; o < 4 && d.length > 0; ) {
        const u = d.shift();
        if (!(u != null && u.isConnected)) continue;
        o += 1;
        const M = u.getAttribute("data-reader-md-src") || "";
        e.fetchImage(M, e.signal ? { signal: e.signal } : void 0).then(async (g) => {
          if (!(g != null && g.ok)) throw new Error(`HTTP ${(g == null ? void 0 : g.status) || 0}`);
          const q = URL.createObjectURL(await g.blob());
          if (s || !u.isConnected) {
            try {
              URL.revokeObjectURL(q);
            } catch {
            }
            return;
          }
          e.onObjectUrl(q), u.src = q, c += 1;
        }).catch(() => {
          s || !u.isConnected || (r += 1, v(u, "[图片暂不可用]"));
        }).finally(() => {
          o -= 1, s || (p(), f());
        });
      }
  }, w = (u) => {
    s || E.has(u) || (E.add(u), d.push(u), f());
  }, P = globalThis.IntersectionObserver;
  let y = null;
  return P && m.length > 0 ? (y = new P((u) => {
    u.forEach((M) => {
      if (!M.isIntersecting) return;
      const g = M.target;
      y == null || y.unobserve(g), w(g);
    });
  }, { root: e.root || null, rootMargin: "600px 0px" }), m.forEach((u) => y == null ? void 0 : y.observe(u))) : m.forEach(w), p(), () => {
    s = !0, d.length = 0, y == null || y.disconnect();
  };
}
let ue = null;
function be() {
  return ue || (ue = import("marked").catch((t) => {
    throw ue = null, t;
  })), ue;
}
function qe(t) {
  t.querySelectorAll("script, iframe, object, embed, style, link, meta, base, form, input, button, textarea, select").forEach((e) => e.remove()), t.querySelectorAll("*").forEach((e) => {
    for (const s of [...e.attributes])
      /^on/i.test(s.name) && e.removeAttribute(s.name);
  }), t.querySelectorAll("a[href]").forEach((e) => {
    const s = e;
    /^\s*javascript:/i.test(s.getAttribute("href") || "") && s.removeAttribute("href"), s.setAttribute("target", "_blank"), s.setAttribute("rel", "noopener noreferrer");
  });
}
function oe(t, e, s, o = {}) {
  const c = t.ownerDocument.createElement("template");
  return c.innerHTML = e, qe(c.content), c.content.querySelectorAll("img[src]").forEach((r) => {
    var E;
    const d = r.getAttribute("src") || "", m = ((E = o.resolveAssetUrl) == null ? void 0 : E.call(o, s, d)) || d;
    r.setAttribute("data-reader-md-src", m), r.setAttribute("loading", "lazy"), r.setAttribute("decoding", "async"), r.removeAttribute("src");
  }), t.replaceChildren(c.content), t.classList.remove("hidden"), [...t.querySelectorAll("img[data-reader-md-src]")];
}
function Ve(t, e) {
  let s = e;
  for (; s < t.length; ) {
    const o = t.indexOf(`
`, s), c = o === -1 ? t.length : o, r = t.slice(s, c).trim();
    if (r !== "") return r;
    if (o === -1) return null;
    s = o + 1;
  }
  return null;
}
const Fe = /^\s{0,3}\[[^\]]+\]:/;
function ye(t) {
  const e = t.match(/^(?:([-*+])|(\d+)([.)]))\s+/);
  return e ? e[1] ? `ul:${e[1]}` : `ol:${e[3]}` : null;
}
function Ke(t, e, s) {
  const o = Ve(t, e);
  if (!o) return !1;
  if (Fe.test(o)) return !0;
  const c = s ? ye(s) : null, r = ye(o);
  return c != null && c === r;
}
function Me(t, { minChars: e = 16384 } = {}) {
  if (!t) return null;
  let s = "", o = null, c = 0;
  const r = t.length;
  for (; c < r; ) {
    const d = t.indexOf(`
`, c), m = d === -1 ? r : d, v = t.slice(c, m).trim(), p = v.match(/^(`{3,}|~{3,})/);
    if (p) {
      const f = p[1][0];
      s ? s === f && (s = "") : s = f;
    }
    if (!s && v === "") {
      const f = d === -1 ? r : d + 1;
      if (f >= e && !Ke(t, f, o))
        return { complete: t.slice(0, f), rest: t.slice(f) };
    } else v !== "" && (o = v);
    if (d === -1) break;
    c = d + 1;
  }
  return null;
}
function We({
  open: t,
  jobId: e,
  sourceOnly: s,
  searchQueryRef: o,
  reapplySearchRef: c
}) {
  const r = z(null), [d, m] = T("尚未加载"), E = z([]), v = z(null), p = z(/* @__PURE__ */ new Map()), f = z([]), w = z(null), P = z(!1), y = z(!1), u = z(null), [M, g] = T([]), [q, N] = T(!1), [$, I] = T(!1), L = () => {
    for (const a of E.current)
      try {
        URL.revokeObjectURL(a);
      } catch {
      }
    E.current = [];
  }, R = () => {
    var a, i;
    (a = v.current) == null || a.call(v), v.current = null;
    for (const h of f.current) h();
    f.current = [], (i = w.current) == null || i.call(w), w.current = null, L();
  }, O = () => {
    const a = r.current;
    a && (p.current = /* @__PURE__ */ new Map(), g(ae(a, p.current)));
  }, n = () => {
    const a = u.current, i = r.current;
    if (!a || !i) return;
    const h = [...i.querySelectorAll("h1, h2, h3, h4, h5, h6")].find((U) => U.id === a);
    h && (u.current = null, typeof h.scrollIntoView == "function" && h.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  return ee(() => () => {
    var a;
    (a = v.current) == null || a.call(v), L();
  }, []), ee(() => {
    if (!t) {
      R(), g([]), y.current = !1, N(!1);
      return;
    }
    let a = !1;
    R(), p.current = /* @__PURE__ */ new Map(), y.current = !1, N(!1), g([]), P.current = !1, u.current = null, I(!1);
    const i = new AbortController(), h = pe;
    async function U() {
      var l, b, x, _, S, F;
      const B = e.startsWith("doc:");
      if (!e || B) {
        m(!e && s ? "源文档阅读不提供 Markdown 产物" : "该任务暂无 Markdown 产物"), r.current && (r.current.replaceChildren(), r.current.classList.add("hidden"));
        return;
      }
      m("正在加载 Markdown…"), (l = r.current) == null || l.replaceChildren(), (b = r.current) == null || b.classList.add("hidden");
      try {
        if (typeof (h == null ? void 0 : h.loadMarkdownSource) == "function" && typeof (h == null ? void 0 : h.loadMarkdownRange) == "function") {
          const D = await h.loadMarkdownSource(e, i.signal);
          if (a) return;
          if (D != null && D.rawUrl) {
            await A(D);
            return;
          }
        }
      } catch {
      }
      try {
        const D = await pe.loadMarkdownPayload(e);
        if (a) return;
        const { content: K, imagesBaseUrl: G } = _e(D);
        if (!K.trim()) {
          m("该任务暂无 Markdown 产物"), (x = r.current) == null || x.replaceChildren(), (_ = r.current) == null || _.classList.add("hidden");
          return;
        }
        const { marked: V } = await be();
        if (a || !r.current) return;
        const { text: Q, slots: X } = me(K, { bareLatex: !0 }), te = String(V.parse(Q, { async: !1 })), re = Te(te, X);
        oe(r.current, re, G, {
          resolveAssetUrl: se
        }), g(ae(r.current)), (S = c.current) == null || S.call(c), m(X.length > 0 ? `正文已显示 · 正在渲染 ${X.length} 个公式…` : "");
        const le = X.length > 0 ? await ge(te, X) : te;
        if (a || !r.current) return;
        const ce = oe(r.current, le, G, {
          resolveAssetUrl: se
        });
        g(ae(r.current)), y.current = !0, N(!0), (F = c.current) == null || F.call(c), m("");
        const de = r.current.closest(".reader-notes-panel-body");
        v.current = we(ce, {
          root: de,
          protectedBaseUrl: G || r.current.ownerDocument.baseURI,
          fetchImage: he,
          signal: i.signal,
          onObjectUrl: (J) => E.current.push(J),
          onProgress: ({ failed: J }) => {
            !a && J > 0 && m(`正文已加载 · ${J} 张图片不可用`);
          }
        });
      } catch (D) {
        if (a) return;
        m(D instanceof Error ? D.message : "Markdown 加载失败");
      }
    }
    async function A(B) {
      var J;
      const l = r.current;
      if (!l) return;
      const b = 262144, x = 8192, _ = `${B.imagesBaseUrl || ""}`, S = l.closest(".reader-notes-panel-body");
      let F = new TextDecoder(), D = 0, K = `${B.etag || ""}`, G = Number.isFinite(Number(B.totalBytes)) ? Number(B.totalBytes) : null, V = "", Q = !1;
      const X = 4, te = 4e3;
      let re = 0;
      const le = () => {
        for (const C of f.current) C();
        f.current = [], L(), p.current = /* @__PURE__ */ new Map(), g([]);
      }, ce = async (C) => {
        const { marked: W } = await be();
        if (a || !r.current) return;
        const { text: H, slots: Y } = me(C, { bareLatex: !0 }), ne = String(W.parse(H, { async: !1 })), fe = Y.length > 0 ? await ge(ne, Y) : ne;
        if (a || !r.current) return;
        const ie = l.ownerDocument.createElement("section");
        ie.className = "reader-markdown-chunk";
        const $e = oe(ie, fe, _, {
          resolveAssetUrl: se
        });
        l.appendChild(ie), l.classList.remove("hidden");
        const ke = ae(ie, p.current);
        ke.length && g((Z) => [...Z, ...ke]), n();
        const Oe = we($e, {
          root: S,
          protectedBaseUrl: _ || l.ownerDocument.baseURI,
          fetchImage: he,
          signal: i.signal,
          onObjectUrl: (Z) => E.current.push(Z),
          onProgress: ({ failed: Z }) => {
            !a && Z > 0 && m(`正文已加载 · ${Z} 张图片不可用`);
          }
        });
        f.current.push(Oe);
      }, de = async () => {
        P.current || !S || a || l.scrollHeight <= S.clientHeight * 2 || (I(!0), m("已加载部分 · 滚动或点击继续加载"), await new Promise((C) => {
          let W = !1, H = null;
          const Y = (fe) => {
            W || (W = !0, S.removeEventListener("scroll", ne), H && (clearTimeout(H), H = null), w.current = null, a || (I(!1), fe && (re = 0)), C());
          }, ne = () => {
            (l.scrollHeight <= S.clientHeight * 2 || S.scrollTop + S.clientHeight >= l.scrollHeight - 800) && Y(!0);
          };
          w.current = () => Y(!0), S.addEventListener("scroll", ne, { passive: !0 }), re < X && (re += 1, H = setTimeout(() => Y(!1), te));
        }));
      };
      try {
        for (; !Q && !a; ) {
          const C = await h.loadMarkdownRange(
            B.rawUrl,
            D,
            D + b - 1,
            K || void 0,
            i.signal
          );
          if (a) return;
          if (C.status === 404) {
            m("该任务暂无 Markdown 产物"), l.replaceChildren(), l.classList.add("hidden");
            return;
          }
          if (C.status === 200)
            l.replaceChildren(), le(), F = new TextDecoder(), V = F.decode(C.bytes, { stream: !1 }), Q = !0;
          else if (C.status === 206) {
            if (K && C.etag && C.etag !== K) {
              l.replaceChildren(), le(), F = new TextDecoder(), V = "", D = 0, Q = !1, K = C.etag;
              continue;
            }
            !K && C.etag && (K = C.etag), C.totalBytes != null && (G = C.totalBytes);
            const H = C.rangeEnd != null ? C.rangeEnd + 1 : D + C.bytes.length;
            Q = G != null ? H >= G : C.bytes.length < b, V += F.decode(C.bytes, { stream: !Q }), D = H;
          } else
            throw new Error(`读取 Markdown 失败，请稍后重试。(${C.status})`);
          let W = Me(V, { minChars: x });
          for (; W && !a; ) {
            if (V = W.rest, await ce(W.complete), a) return;
            await de(), W = Me(V, { minChars: x });
          }
          Q && V.trim() && (await ce(V), V = "");
        }
        a || (O(), y.current = !0, N(!0), n(), m(""), o.current.trim() && ((J = c.current) == null || J.call(c)));
      } catch (C) {
        if (a || i.signal.aborted) return;
        m(C instanceof Error ? C.message : "Markdown 加载失败");
      }
    }
    return U(), () => {
      a = !0, i.abort(), R();
    };
  }, [t, e, s]), {
    contentRef: r,
    status: d,
    setStatus: m,
    outline: M,
    setOutline: g,
    outlineComplete: q,
    setOutlineComplete: N,
    outlineCompleteRef: y,
    pendingResume: $,
    rebuildOutline: O,
    renderAllRef: P,
    pendingAnchorRef: u,
    resumeCleanupRef: w
  };
}
function He(t) {
  return t === "page_number" || t === "header" || t === "footer" || t === "page_header" || t === "page_footer" || t === "aside_text";
}
function je(t) {
  const e = `${t.subType || ""}`.toLowerCase();
  return He(e) ? null : e === "title" || e === "heading" || e === "doc_title" || e === "paragraph_title" ? "heading" : e === "display_formula" || t.regionType === "formula" ? "formula" : e === "image_body" || e === "figure" || e === "image" || e === "chart" || t.regionType === "image" ? "figure" : e === "table_html" || e === "table_body" || t.regionType === "table" ? "table" : e.endsWith("caption") || e === "figure_title" || e === "table_footnote" ? "caption" : e === "reference_entry" ? "reference" : e === "footnote" || e === "page_footnote" ? "footnote" : e === "metadata" ? "meta" : "paragraph";
}
function Qe(t) {
  return t.length > 0 && t.every((e) => typeof e.readingOrder == "number");
}
function Ge(t) {
  if (!Qe(t)) return null;
  const e = [], s = /* @__PURE__ */ new Map();
  for (const o of t) {
    const c = `${o.subType || ""}`.toLowerCase(), r = o.source.text.trim();
    if (c === "formula_number") {
      const w = e[e.length - 1];
      (w == null ? void 0 : w.kind) === "formula" && !w.label && (w.label = r);
      continue;
    }
    const d = je(o);
    if (!d) continue;
    const m = o.translated.text.trim(), E = !!m && m !== r, v = o.continuationGroupId, p = v ? s.get(v) : void 0;
    if (p) {
      p.itemIds.push(o.itemId), p.source = `${p.source} ${r}`.trim(), !p.hasTranslation && E ? (p.translated = m, p.hasTranslation = !0) : p.hasTranslation || (p.translated = p.source);
      continue;
    }
    const f = {
      key: o.itemId,
      itemIds: [o.itemId],
      page: o.source.page,
      kind: d,
      level: d === "heading" ? o.headingLevel || (c === "title" || c === "doc_title" ? 1 : 2) : 0,
      source: r,
      translated: E ? m : r,
      hasTranslation: E,
      assetUrls: o.assetUrls,
      label: ""
    };
    v && s.set(v, f), !(!r && d !== "figure") && e.push(f);
  }
  return e;
}
function Xe(t, e) {
  const s = e === "translated" ? t.translated : t.source;
  if (t.kind === "heading") {
    const o = Math.min(Math.max(t.level, 1), 6);
    return `${"#".repeat(o)} ${s.replace(/\s*\n\s*/g, " ")}`;
  }
  return s;
}
const Ce = 40, Ee = { resolveAssetUrl: se };
function Je(t, e, s, o) {
  const [c, r] = T(""), [d, m] = T([]), E = z(/* @__PURE__ */ new Map()), [v, p] = T(0);
  return ee(() => {
    const f = t.current;
    if (!o || !f) return;
    let w = !1;
    const P = new AbortController(), y = [], u = [], M = /* @__PURE__ */ new Map();
    E.current = M, f.replaceChildren(), r("正在排版…");
    const g = f.closest(".reader-notes-panel-body"), q = async ($, I) => {
      const { text: L, slots: R } = me($, { bareLatex: !0 }), O = I(L);
      return R.length > 0 ? ge(O, R) : O;
    }, N = async ($, I, L, R) => {
      if (I.kind === "figure") {
        const n = I.assetUrls.map((a) => `<img src="${Ye(a)}" alt="">`).join("");
        return oe($, n, "", Ee);
      }
      let O = await q(Xe(I, L), R);
      return I.kind === "formula" && I.label && (O += `<span class="reader-md-formula-label">${Ze(I.label)}</span>`), oe($, O, "", Ee);
    };
    return (async () => {
      try {
        const { marked: $ } = await be(), I = (L) => String($.parse(L, { async: !1 }));
        for (let L = 0; L < e.length; L += Ce) {
          if (w) return;
          const R = f.ownerDocument.createDocumentFragment(), O = [];
          for (const n of e.slice(L, L + Ce)) {
            const a = f.ownerDocument.createElement("div");
            a.className = `reader-md-block is-${n.kind}`, a.dataset.mdBlock = n.key, a.dataset.mdPage = `${n.page}`, a.tabIndex = 0, a.setAttribute("role", "button"), a.setAttribute("aria-label", `跳到第 ${n.page} 页的这一块`);
            const i = s === "bilingual" && n.hasTranslation, h = i ? ["source", "translated"] : [s === "source" ? "source" : "translated"];
            for (const U of h) {
              const A = f.ownerDocument.createElement("div");
              if (A.className = i ? `reader-md-block-${U}` : "reader-md-block-body", O.push(...await N(A, n, U, I)), w) return;
              a.appendChild(A);
            }
            for (const U of n.itemIds) M.set(U, a);
            R.appendChild(a);
          }
          f.appendChild(R), f.classList.remove("hidden"), u.push(we(O, {
            root: g,
            // 受保护的判断要以 API 地址为准（它可能是局域网 IP，和静态页不同源）。
            protectedBaseUrl: se("", "/api/v1/"),
            fetchImage: he,
            signal: P.signal,
            onObjectUrl: (n) => y.push(n)
          })), await new Promise((n) => setTimeout(n, 0));
        }
        if (w) return;
        m(ae(f).filter((L) => {
          var R;
          return !((R = f.querySelector(`#${CSS.escape(L.id)}`)) != null && R.closest(".reader-md-block-source"));
        })), r(`${e.length} 块`), p((L) => L + 1);
      } catch ($) {
        w || r($ instanceof Error ? $.message : "Markdown 排版失败");
      }
    })(), () => {
      w = !0, P.abort();
      for (const $ of u) $();
      for (const $ of y)
        try {
          URL.revokeObjectURL($);
        } catch {
        }
    };
  }, [e, s, o, t]), { status: c, outline: d, elementsRef: E, renderedRevision: v };
}
function Ye(t) {
  return t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function Ze(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const et = [
  { value: "translated", label: "译文" },
  { value: "source", label: "原文" },
  { value: "bilingual", label: "双语" }
];
function tt({
  open: t,
  blocks: e,
  side: s = "right",
  regionHover: o,
  jumpToBlock: c,
  onClose: r
}) {
  const d = z(null), m = e.some((n) => n.hasTranslation), [E, v] = T(m ? "translated" : "source"), { status: p, outline: f, elementsRef: w, renderedRevision: P } = Je(d, e, E, t), [y, u] = T(!1), [M, g] = T(""), q = z([]), [N, $] = T(0), [I, L] = T(-1);
  ee(() => {
    if (!o) return;
    let n = null;
    const a = () => {
      const { itemId: h, origin: U } = o.get(), A = h ? w.current.get(h) ?? null : null;
      A !== n && (n == null || n.classList.remove("is-linked"), n = A, A && (A.classList.add("is-linked"), U === "pdf" && typeof A.scrollIntoView == "function" && A.scrollIntoView({ block: "nearest", behavior: "smooth" })));
    };
    a();
    const i = o.subscribe(a);
    return () => {
      i(), n == null || n.classList.remove("is-linked");
    };
  }, [o, w, P]), ee(() => {
    const n = d.current;
    if (!n) return;
    const a = (l) => l instanceof Element ? l.closest("[data-md-block]") : null, i = (l) => {
      const b = a(l.target);
      o == null || o.set((b == null ? void 0 : b.dataset.mdBlock) ?? null, "markdown");
    }, h = () => o == null ? void 0 : o.set(null, "markdown"), U = (l) => {
      const b = l == null ? void 0 : l.dataset.mdBlock;
      b && (c == null || c(b));
    }, A = (l) => {
      var b;
      (b = n.ownerDocument.getSelection()) != null && b.toString() || l.target instanceof Element && l.target.closest("a[href]") || U(a(l.target));
    }, B = (l) => {
      if (l.key !== "Enter" && l.key !== " ") return;
      const b = a(l.target);
      !b || b !== l.target || (l.preventDefault(), U(b));
    };
    return n.addEventListener("mouseover", i), n.addEventListener("mouseleave", h), n.addEventListener("click", A), n.addEventListener("keydown", B), () => {
      n.removeEventListener("mouseover", i), n.removeEventListener("mouseleave", h), n.removeEventListener("click", A), n.removeEventListener("keydown", B);
    };
  }, [o, c]);
  const R = (n, a = !0) => {
    const i = q.current;
    if (i.forEach((A) => A.classList.remove("reader-markdown-search-hit-active")), i.length === 0) {
      L(-1);
      return;
    }
    const h = (n + i.length) % i.length, U = i[h];
    U.classList.add("reader-markdown-search-hit-active"), L(h), a && typeof U.scrollIntoView == "function" && U.scrollIntoView({ block: "center", behavior: "smooth" });
  }, O = (n, a = !1) => {
    const i = d.current;
    if (!i) return;
    n.trim() || Se(i);
    const h = n.trim() ? Ne(i, n) : [];
    q.current = h, $(h.length), R(h.length > 0 ? 0 : -1, a);
  };
  return ee(() => {
    M.trim() && O(M);
  }, [P]), /* @__PURE__ */ j(
    Re,
    {
      id: "reader-markdown-panel",
      open: t,
      ariaLabel: "Markdown 预览",
      className: `is-pane-${s}`,
      onClose: r,
      toolbar: /* @__PURE__ */ k("span", { className: "reader-notes-count", children: p || "已加载" }),
      children: [
        /* @__PURE__ */ j("div", { className: "reader-markdown-nav", "aria-label": "Markdown 导航与搜索", children: [
          m ? /* @__PURE__ */ k("div", { className: "reader-md-view-switch", role: "tablist", "aria-label": "显示原文还是译文", children: et.map((n) => /* @__PURE__ */ k(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": E === n.value,
              className: E === n.value ? "is-active" : void 0,
              onClick: () => v(n.value),
              children: n.label
            },
            n.value
          )) }) : null,
          /* @__PURE__ */ j("label", { className: "reader-markdown-search", children: [
            /* @__PURE__ */ k(Le, { size: 13, "aria-hidden": !0 }),
            /* @__PURE__ */ k(
              "input",
              {
                type: "search",
                value: M,
                placeholder: "搜索正文",
                "aria-label": "搜索 Markdown 正文",
                onChange: (n) => {
                  g(n.target.value), O(n.target.value, !1);
                },
                onKeyDown: (n) => {
                  n.key !== "Enter" || N === 0 || (n.preventDefault(), R(I + (n.shiftKey ? -1 : 1)));
                }
              }
            ),
            M ? /* @__PURE__ */ k("span", { className: "reader-markdown-search-count", "aria-live": "polite", children: N > 0 ? `${I + 1}/${N}` : "0/0" }) : null,
            /* @__PURE__ */ k(
              "button",
              {
                type: "button",
                "aria-label": "上一个搜索结果",
                disabled: N === 0,
                onClick: () => R(I - 1),
                children: /* @__PURE__ */ k(Ue, { size: 13, "aria-hidden": !0 })
              }
            ),
            /* @__PURE__ */ k(
              "button",
              {
                type: "button",
                "aria-label": "下一个搜索结果",
                disabled: N === 0,
                onClick: () => R(I + 1),
                children: /* @__PURE__ */ k(Ae, { size: 13, "aria-hidden": !0 })
              }
            )
          ] }),
          /* @__PURE__ */ j(
            "button",
            {
              type: "button",
              className: "reader-markdown-outline-toggle",
              "aria-expanded": y,
              disabled: f.length === 0,
              onClick: () => u((n) => !n),
              children: [
                /* @__PURE__ */ k(Ie, { size: 13, "aria-hidden": !0 }),
                "目录",
                f.length > 0 ? ` ${f.length}` : ""
              ]
            }
          )
        ] }),
        y && f.length > 0 ? /* @__PURE__ */ k("nav", { className: "reader-markdown-outline", "aria-label": "Markdown 目录", children: f.map((n) => /* @__PURE__ */ k(
          "button",
          {
            type: "button",
            style: { "--reader-md-outline-level": n.level - 1 },
            onClick: () => {
              var h, U, A;
              const a = (h = d.current) == null ? void 0 : h.querySelector(`#${CSS.escape(n.id)}`);
              (U = a == null ? void 0 : a.scrollIntoView) == null || U.call(a, { block: "start", behavior: "smooth" });
              const i = (A = a == null ? void 0 : a.closest("[data-md-block]")) == null ? void 0 : A.dataset.mdBlock;
              i && (c == null || c(i));
            },
            children: n.text
          },
          n.id
        )) }) : null,
        /* @__PURE__ */ k(
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
function it(t) {
  const e = De(), s = e == null ? void 0 : e.regions, o = xe(() => s ? Ge(s) : null, [s]);
  return o && o.length > 0 ? /* @__PURE__ */ k(
    tt,
    {
      open: t.open,
      blocks: o,
      side: t.side,
      regionHover: e == null ? void 0 : e.regionHover,
      jumpToBlock: e == null ? void 0 : e.jumpToBlock,
      onClose: t.onClose
    }
  ) : /* @__PURE__ */ k(rt, { ...t });
}
function rt({
  open: t,
  jobId: e,
  sourceOnly: s,
  side: o = "right",
  onClose: c
}) {
  var A, B;
  const r = z([]), d = z(""), m = z(() => {
  }), [E, v] = T(!1), [p, f] = T(""), [w, P] = T(0), [y, u] = T(-1), {
    contentRef: M,
    status: g,
    setStatus: q,
    outline: N,
    outlineComplete: $,
    setOutlineComplete: I,
    outlineCompleteRef: L,
    pendingResume: R,
    rebuildOutline: O,
    renderAllRef: n,
    pendingAnchorRef: a,
    resumeCleanupRef: i
  } = We({
    open: t,
    jobId: e,
    sourceOnly: s,
    searchQueryRef: d,
    reapplySearchRef: m
  }), h = (l, b = !0) => {
    const x = r.current;
    if (x.forEach((F) => F.classList.remove("reader-markdown-search-hit-active")), x.length === 0) {
      u(-1);
      return;
    }
    const _ = (l + x.length) % x.length, S = x[_];
    S.classList.add("reader-markdown-search-hit-active"), u(_), b && typeof S.scrollIntoView == "function" && S.scrollIntoView({ block: "center", behavior: "smooth" });
  }, U = (l, b = !1) => {
    var S;
    const x = `${l || ""}`.trim();
    if (n.current = x.length > 0, n.current && ((S = i.current) == null || S.call(i)), !M.current) return;
    const _ = Ne(M.current, l);
    r.current = _, P(_.length), h(_.length > 0 ? 0 : -1, b);
  };
  return m.current = () => U(d.current), /* @__PURE__ */ j(
    Re,
    {
      id: "reader-markdown-panel",
      open: t,
      ariaLabel: "Markdown 预览",
      className: `is-pane-${o}`,
      onClose: c,
      toolbar: /* @__PURE__ */ k("span", { className: "reader-notes-count", children: g || "已加载" }),
      children: [
        /* @__PURE__ */ j("div", { className: "reader-markdown-nav", "aria-label": "Markdown 导航与搜索", children: [
          /* @__PURE__ */ j("label", { className: "reader-markdown-search", children: [
            /* @__PURE__ */ k(Le, { size: 13, "aria-hidden": !0 }),
            /* @__PURE__ */ k(
              "input",
              {
                type: "search",
                value: p,
                placeholder: "搜索正文",
                "aria-label": "搜索 Markdown 正文",
                onChange: (l) => {
                  const b = l.target.value;
                  d.current = b, f(b), U(b, !1);
                },
                onKeyDown: (l) => {
                  l.key !== "Enter" || w === 0 || (l.preventDefault(), h(y + (l.shiftKey ? -1 : 1)));
                }
              }
            ),
            p ? /* @__PURE__ */ k("span", { className: "reader-markdown-search-count", "aria-live": "polite", children: w > 0 ? `${y + 1}/${w}` : "0/0" }) : null,
            /* @__PURE__ */ k(
              "button",
              {
                type: "button",
                "aria-label": "上一个搜索结果",
                disabled: w === 0,
                onClick: () => h(y - 1),
                children: /* @__PURE__ */ k(Ue, { size: 13, "aria-hidden": !0 })
              }
            ),
            /* @__PURE__ */ k(
              "button",
              {
                type: "button",
                "aria-label": "下一个搜索结果",
                disabled: w === 0,
                onClick: () => h(y + 1),
                children: /* @__PURE__ */ k(Ae, { size: 13, "aria-hidden": !0 })
              }
            )
          ] }),
          /* @__PURE__ */ j(
            "button",
            {
              type: "button",
              className: "reader-markdown-outline-toggle",
              "aria-expanded": E,
              disabled: N.length === 0,
              onClick: () => {
                O(), I(L.current), v((l) => !l);
              },
              children: [
                /* @__PURE__ */ k(Ie, { size: 13, "aria-hidden": !0 }),
                "目录",
                N.length > 0 ? ` ${N.length}` : ""
              ]
            }
          ),
          R ? /* @__PURE__ */ k(
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
        E && N.length > 0 ? /* @__PURE__ */ j("nav", { className: "reader-markdown-outline", "aria-label": "Markdown 目录", children: [
          $ ? null : /* @__PURE__ */ k("p", { className: "reader-markdown-outline-note", children: "仅显示已加载内容，滚动可加载更多" }),
          N.map((l) => /* @__PURE__ */ k(
            "button",
            {
              type: "button",
              style: { "--reader-md-outline-level": l.level - 1 },
              onClick: () => {
                var x, _;
                const b = [...((x = M.current) == null ? void 0 : x.querySelectorAll("h1, h2, h3, h4, h5, h6")) || []].find((S) => S.id === l.id);
                if (b && typeof b.scrollIntoView == "function") {
                  b.scrollIntoView({ block: "start", behavior: "smooth" });
                  return;
                }
                a.current = l.id, n.current = !0, (_ = i.current) == null || _.call(i), q("正在加载目标章节…");
              },
              children: l.text
            },
            l.id
          ))
        ] }) : null,
        g && !((B = (A = M.current) == null ? void 0 : A.childNodes) != null && B.length) ? /* @__PURE__ */ k("p", { className: "reader-notes-empty", children: g }) : null,
        /* @__PURE__ */ k(
          "article",
          {
            ref: M,
            id: "reader-markdown-content",
            className: "reader-markdown-content reader-float-markdown-content"
          }
        )
      ]
    }
  );
}
export {
  it as ReaderMarkdownPanel,
  ae as buildMarkdownOutline,
  Se as clearMarkdownSearchHighlights,
  Ne as findMarkdownSearchTargets,
  Pe as isProtectedMarkdownAssetUrl,
  we as startMarkdownImageLoading
};
//# sourceMappingURL=ReaderMarkdownPanel-B3aNNku7.js.map
