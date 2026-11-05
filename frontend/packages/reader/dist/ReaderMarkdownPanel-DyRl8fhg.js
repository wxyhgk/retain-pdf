import { jsxs as K, jsx as b } from "react/jsx-runtime";
import { useEffect as Y, useRef as z, useState as T, useMemo as xe } from "react";
import { Search as Le, ChevronUp as Ue, ChevronDown as Ae, ListTree as Ie } from "lucide-react";
import { d as pe, r as se, f as he, u as De } from "./ReaderApp-CnKvQILx.js";
import { extractMarkdownMath as me, materializeMarkdownMathFallbackHtml as Te, materializeMarkdownMathHtml as ge } from "./runtime/content.js";
import { n as _e } from "./markdown-payload-kK3ewW_I.js";
const ve = "h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre";
function Re(t) {
  t.querySelectorAll(".reader-markdown-search-hit, .reader-markdown-search-hit-active").forEach((e) => {
    e.classList.remove("reader-markdown-search-hit", "reader-markdown-search-hit-active");
  });
}
function Se(t, e) {
  Re(t);
  const a = e.trim().toLocaleLowerCase();
  if (!a) return [];
  const c = [...t.querySelectorAll(ve)].filter((r) => [...r.children].some((i) => i.matches(ve)) ? !1 : (r.textContent || "").toLocaleLowerCase().includes(a));
  return c.forEach((r) => r.classList.add("reader-markdown-search-hit")), c;
}
function Ne({
  id: t,
  open: e,
  ariaLabel: a,
  className: o = "",
  keepMounted: c = !1,
  onClose: r,
  toolbar: i,
  children: h
}) {
  return Y(() => {
    if (!e) return;
    const y = (k) => {
      var f;
      if (k.key !== "Escape") return;
      const g = k.target;
      (f = g == null ? void 0 : g.closest) != null && f.call(g, "textarea, input, select, [contenteditable='true']") || (k.preventDefault(), r());
    };
    return window.addEventListener("keydown", y), () => window.removeEventListener("keydown", y);
  }, [e, r]), !e && !c ? null : /* @__PURE__ */ K(
    "aside",
    {
      id: t,
      className: `reader-notes-panel reader-notes-panel--workspace${i ? " has-panel-toolbar" : ""} ${o}`.trim(),
      "aria-label": a,
      role: "dialog",
      "aria-modal": "false",
      "data-hidden": e ? void 0 : "",
      inert: e ? void 0 : !0,
      "aria-hidden": e ? void 0 : !0,
      children: [
        i ? /* @__PURE__ */ b("div", { className: "reader-notes-panel-toolbar", children: i }) : null,
        /* @__PURE__ */ b("div", { className: "reader-notes-panel-body", children: h })
      ]
    }
  );
}
function ze(t) {
  return t.normalize("NFKC").trim().toLocaleLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "") || "section";
}
function ae(t, e = /* @__PURE__ */ new Map()) {
  return [...t.querySelectorAll("h1, h2, h3, h4, h5, h6")].flatMap((a) => {
    const o = (a.textContent || "").replace(/\s+/g, " ").trim();
    if (!o) return [];
    const c = ze(o), r = (e.get(c) || 0) + 1;
    e.set(c, r);
    const i = r === 1 ? `reader-md-${c}` : `reader-md-${c}-${r}`;
    return a.id = i, [{ id: i, level: Number(a.tagName.slice(1)), text: o }];
  });
}
function Pe(t, e = "http://localhost/") {
  var a;
  if (/^mock:\/\//i.test(t)) return !0;
  try {
    const o = ((a = globalThis.location) == null ? void 0 : a.href) || "http://localhost/", c = new URL(e, o), r = new URL(t, c);
    if (!/\/api\/v1\/jobs\/[^/]+\/(?:markdown|files\/output\/ocr)\/images\//.test(r.pathname)) return !1;
    if (!/^[a-z][a-z\d+.-]*:/i.test(t)) return !0;
    const i = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(r.hostname);
    return r.origin === c.origin || i;
  } catch {
    return !1;
  }
}
function Be(t, e) {
  if (/^data:image\//i.test(t) || /^blob:/i.test(t)) return !0;
  try {
    const a = new URL(t, e);
    return a.protocol === "http:" || a.protocol === "https:";
  } catch {
    return !1;
  }
}
function we(t, e) {
  let a = !1, o = 0, c = 0, r = 0;
  const i = [], h = [], y = /* @__PURE__ */ new Set(), k = (d, E) => {
    const w = d.ownerDocument.createElement("span");
    w.className = "reader-markdown-image-missing", w.textContent = E, w.title = d.getAttribute("data-reader-md-src") || "", d.replaceWith(w);
  };
  for (const d of t) {
    const E = d.getAttribute("data-reader-md-src") || "", w = d.ownerDocument.baseURI || "http://localhost/";
    Pe(E, e.protectedBaseUrl || w) ? h.push(d) : Be(E, w) ? d.src = E : k(d, "[图片地址不可用]");
  }
  const g = () => {
    var d;
    return (d = e.onProgress) == null ? void 0 : d.call(e, { failed: r, loaded: c, total: h.length });
  }, f = () => {
    if (!a)
      for (; o < 4 && i.length > 0; ) {
        const d = i.shift();
        if (!(d != null && d.isConnected)) continue;
        o += 1;
        const E = d.getAttribute("data-reader-md-src") || "";
        e.fetchImage(E, e.signal ? { signal: e.signal } : void 0).then(async (w) => {
          if (!(w != null && w.ok)) throw new Error(`HTTP ${(w == null ? void 0 : w.status) || 0}`);
          const q = URL.createObjectURL(await w.blob());
          if (a || !d.isConnected) {
            try {
              URL.revokeObjectURL(q);
            } catch {
            }
            return;
          }
          e.onObjectUrl(q), d.src = q, c += 1;
        }).catch(() => {
          a || !d.isConnected || (r += 1, k(d, "[图片暂不可用]"));
        }).finally(() => {
          o -= 1, a || (g(), f());
        });
      }
  }, p = (d) => {
    a || y.has(d) || (y.add(d), i.push(d), f());
  }, P = globalThis.IntersectionObserver;
  let M = null;
  return P && h.length > 0 ? (M = new P((d) => {
    d.forEach((E) => {
      if (!E.isIntersecting) return;
      const w = E.target;
      M == null || M.unobserve(w), p(w);
    });
  }, { root: e.root || null, rootMargin: "600px 0px" }), h.forEach((d) => M == null ? void 0 : M.observe(d))) : h.forEach(p), g(), () => {
    a = !0, i.length = 0, M == null || M.disconnect();
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
    for (const a of [...e.attributes])
      /^on/i.test(a.name) && e.removeAttribute(a.name);
  }), t.querySelectorAll("a[href]").forEach((e) => {
    const a = e;
    /^\s*javascript:/i.test(a.getAttribute("href") || "") && a.removeAttribute("href"), a.setAttribute("target", "_blank"), a.setAttribute("rel", "noopener noreferrer");
  });
}
function oe(t, e, a, o = {}) {
  const c = t.ownerDocument.createElement("template");
  return c.innerHTML = e, qe(c.content), c.content.querySelectorAll("img[src]").forEach((r) => {
    var y;
    const i = r.getAttribute("src") || "", h = ((y = o.resolveAssetUrl) == null ? void 0 : y.call(o, a, i)) || i;
    r.setAttribute("data-reader-md-src", h), r.setAttribute("loading", "lazy"), r.setAttribute("decoding", "async"), r.removeAttribute("src");
  }), t.replaceChildren(c.content), t.classList.remove("hidden"), [...t.querySelectorAll("img[data-reader-md-src]")];
}
function Ve(t, e) {
  let a = e;
  for (; a < t.length; ) {
    const o = t.indexOf(`
`, a), c = o === -1 ? t.length : o, r = t.slice(a, c).trim();
    if (r !== "") return r;
    if (o === -1) return null;
    a = o + 1;
  }
  return null;
}
const Ke = /^\s{0,3}\[[^\]]+\]:/;
function ye(t) {
  const e = t.match(/^(?:([-*+])|(\d+)([.)]))\s+/);
  return e ? e[1] ? `ul:${e[1]}` : `ol:${e[3]}` : null;
}
function Fe(t, e, a) {
  const o = Ve(t, e);
  if (!o) return !1;
  if (Ke.test(o)) return !0;
  const c = a ? ye(a) : null, r = ye(o);
  return c != null && c === r;
}
function Me(t, { minChars: e = 16384 } = {}) {
  if (!t) return null;
  let a = "", o = null, c = 0;
  const r = t.length;
  for (; c < r; ) {
    const i = t.indexOf(`
`, c), h = i === -1 ? r : i, k = t.slice(c, h).trim(), g = k.match(/^(`{3,}|~{3,})/);
    if (g) {
      const f = g[1][0];
      a ? a === f && (a = "") : a = f;
    }
    if (!a && k === "") {
      const f = i === -1 ? r : i + 1;
      if (f >= e && !Fe(t, f, o))
        return { complete: t.slice(0, f), rest: t.slice(f) };
    } else k !== "" && (o = k);
    if (i === -1) break;
    c = i + 1;
  }
  return null;
}
function We({
  open: t,
  jobId: e,
  sourceOnly: a,
  searchQueryRef: o,
  reapplySearchRef: c
}) {
  const r = z(null), [i, h] = T("尚未加载"), y = z([]), k = z(null), g = z(/* @__PURE__ */ new Map()), f = z([]), p = z(null), P = z(!1), M = z(!1), d = z(null), [E, w] = T([]), [q, N] = T(!1), [$, I] = T(!1), L = () => {
    for (const s of y.current)
      try {
        URL.revokeObjectURL(s);
      } catch {
      }
    y.current = [];
  }, R = () => {
    var s, u;
    (s = k.current) == null || s.call(k), k.current = null;
    for (const m of f.current) m();
    f.current = [], (u = p.current) == null || u.call(p), p.current = null, L();
  }, O = () => {
    const s = r.current;
    s && (g.current = /* @__PURE__ */ new Map(), w(ae(s, g.current)));
  }, n = () => {
    const s = d.current, u = r.current;
    if (!s || !u) return;
    const m = [...u.querySelectorAll("h1, h2, h3, h4, h5, h6")].find((U) => U.id === s);
    m && (d.current = null, typeof m.scrollIntoView == "function" && m.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  return Y(() => () => {
    var s;
    (s = k.current) == null || s.call(k), L();
  }, []), Y(() => {
    if (!t) {
      R(), w([]), M.current = !1, N(!1);
      return;
    }
    let s = !1;
    R(), g.current = /* @__PURE__ */ new Map(), M.current = !1, N(!1), w([]), P.current = !1, d.current = null, I(!1);
    const u = new AbortController(), m = pe;
    async function U() {
      var l, v, x, _, S, F;
      const B = e.startsWith("doc:");
      if (!e || B) {
        h(!e && a ? "源文档阅读不提供 Markdown 产物" : "该任务暂无 Markdown 产物"), r.current && (r.current.replaceChildren(), r.current.classList.add("hidden"));
        return;
      }
      h("正在加载 Markdown…"), (l = r.current) == null || l.replaceChildren(), (v = r.current) == null || v.classList.add("hidden");
      try {
        if (typeof (m == null ? void 0 : m.loadMarkdownSource) == "function" && typeof (m == null ? void 0 : m.loadMarkdownRange) == "function") {
          const D = await m.loadMarkdownSource(e, u.signal);
          if (s) return;
          if (D != null && D.rawUrl) {
            await A(D);
            return;
          }
        }
      } catch {
      }
      try {
        const D = await pe.loadMarkdownPayload(e);
        if (s) return;
        const { content: W, imagesBaseUrl: G } = _e(D);
        if (!W.trim()) {
          h("该任务暂无 Markdown 产物"), (x = r.current) == null || x.replaceChildren(), (_ = r.current) == null || _.classList.add("hidden");
          return;
        }
        const { marked: V } = await be();
        if (s || !r.current) return;
        const { text: Q, slots: X } = me(W, { bareLatex: !0 }), te = String(V.parse(Q, { async: !1 })), re = Te(te, X);
        oe(r.current, re, G, {
          resolveAssetUrl: se
        }), w(ae(r.current)), (S = c.current) == null || S.call(c), h(X.length > 0 ? `正文已显示 · 正在渲染 ${X.length} 个公式…` : "");
        const le = X.length > 0 ? await ge(te, X) : te;
        if (s || !r.current) return;
        const ce = oe(r.current, le, G, {
          resolveAssetUrl: se
        });
        w(ae(r.current)), M.current = !0, N(!0), (F = c.current) == null || F.call(c), h("");
        const de = r.current.closest(".reader-notes-panel-body");
        k.current = we(ce, {
          root: de,
          protectedBaseUrl: G || r.current.ownerDocument.baseURI,
          fetchImage: he,
          signal: u.signal,
          onObjectUrl: (J) => y.current.push(J),
          onProgress: ({ failed: J }) => {
            !s && J > 0 && h(`正文已加载 · ${J} 张图片不可用`);
          }
        });
      } catch (D) {
        if (s) return;
        h(D instanceof Error ? D.message : "Markdown 加载失败");
      }
    }
    async function A(B) {
      var J;
      const l = r.current;
      if (!l) return;
      const v = 262144, x = 8192, _ = `${B.imagesBaseUrl || ""}`, S = l.closest(".reader-notes-panel-body");
      let F = new TextDecoder(), D = 0, W = `${B.etag || ""}`, G = Number.isFinite(Number(B.totalBytes)) ? Number(B.totalBytes) : null, V = "", Q = !1;
      const X = 4, te = 4e3;
      let re = 0;
      const le = () => {
        for (const C of f.current) C();
        f.current = [], L(), g.current = /* @__PURE__ */ new Map(), w([]);
      }, ce = async (C) => {
        const { marked: H } = await be();
        if (s || !r.current) return;
        const { text: j, slots: Z } = me(C, { bareLatex: !0 }), ne = String(H.parse(j, { async: !1 })), fe = Z.length > 0 ? await ge(ne, Z) : ne;
        if (s || !r.current) return;
        const ie = l.ownerDocument.createElement("section");
        ie.className = "reader-markdown-chunk";
        const $e = oe(ie, fe, _, {
          resolveAssetUrl: se
        });
        l.appendChild(ie), l.classList.remove("hidden");
        const ke = ae(ie, g.current);
        ke.length && w((ee) => [...ee, ...ke]), n();
        const Oe = we($e, {
          root: S,
          protectedBaseUrl: _ || l.ownerDocument.baseURI,
          fetchImage: he,
          signal: u.signal,
          onObjectUrl: (ee) => y.current.push(ee),
          onProgress: ({ failed: ee }) => {
            !s && ee > 0 && h(`正文已加载 · ${ee} 张图片不可用`);
          }
        });
        f.current.push(Oe);
      }, de = async () => {
        P.current || !S || s || l.scrollHeight <= S.clientHeight * 2 || (I(!0), h("已加载部分 · 滚动或点击继续加载"), await new Promise((C) => {
          let H = !1, j = null;
          const Z = (fe) => {
            H || (H = !0, S.removeEventListener("scroll", ne), j && (clearTimeout(j), j = null), p.current = null, s || (I(!1), fe && (re = 0)), C());
          }, ne = () => {
            (l.scrollHeight <= S.clientHeight * 2 || S.scrollTop + S.clientHeight >= l.scrollHeight - 800) && Z(!0);
          };
          p.current = () => Z(!0), S.addEventListener("scroll", ne, { passive: !0 }), re < X && (re += 1, j = setTimeout(() => Z(!1), te));
        }));
      };
      try {
        for (; !Q && !s; ) {
          const C = await m.loadMarkdownRange(
            B.rawUrl,
            D,
            D + v - 1,
            W || void 0,
            u.signal
          );
          if (s) return;
          if (C.status === 404) {
            h("该任务暂无 Markdown 产物"), l.replaceChildren(), l.classList.add("hidden");
            return;
          }
          if (C.status === 200)
            l.replaceChildren(), le(), F = new TextDecoder(), V = F.decode(C.bytes, { stream: !1 }), Q = !0;
          else if (C.status === 206) {
            if (W && C.etag && C.etag !== W) {
              l.replaceChildren(), le(), F = new TextDecoder(), V = "", D = 0, Q = !1, W = C.etag;
              continue;
            }
            !W && C.etag && (W = C.etag), C.totalBytes != null && (G = C.totalBytes);
            const j = C.rangeEnd != null ? C.rangeEnd + 1 : D + C.bytes.length;
            Q = G != null ? j >= G : C.bytes.length < v, V += F.decode(C.bytes, { stream: !Q }), D = j;
          } else
            throw new Error(`读取 Markdown 失败，请稍后重试。(${C.status})`);
          let H = Me(V, { minChars: x });
          for (; H && !s; ) {
            if (V = H.rest, await ce(H.complete), s) return;
            await de(), H = Me(V, { minChars: x });
          }
          Q && V.trim() && (await ce(V), V = "");
        }
        s || (O(), M.current = !0, N(!0), n(), h(""), o.current.trim() && ((J = c.current) == null || J.call(c)));
      } catch (C) {
        if (s || u.signal.aborted) return;
        h(C instanceof Error ? C.message : "Markdown 加载失败");
      }
    }
    return U(), () => {
      s = !0, u.abort(), R();
    };
  }, [t, e, a]), {
    contentRef: r,
    status: i,
    setStatus: h,
    outline: E,
    setOutline: w,
    outlineComplete: q,
    setOutlineComplete: N,
    outlineCompleteRef: M,
    pendingResume: $,
    rebuildOutline: O,
    renderAllRef: P,
    pendingAnchorRef: d,
    resumeCleanupRef: p
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
  const e = [], a = /* @__PURE__ */ new Map();
  for (const o of t) {
    const c = `${o.subType || ""}`.toLowerCase(), r = o.source.text.trim();
    if (c === "formula_number") {
      const p = e[e.length - 1];
      (p == null ? void 0 : p.kind) === "formula" && !p.label && (p.label = r);
      continue;
    }
    const i = je(o);
    if (!i) continue;
    const h = o.translated.text.trim(), y = !!h && h !== r, k = o.continuationGroupId, g = k ? a.get(k) : void 0;
    if (g) {
      g.itemIds.push(o.itemId), g.source = `${g.source} ${r}`.trim(), !g.hasTranslation && y ? (g.translated = h, g.hasTranslation = !0) : g.hasTranslation || (g.translated = g.source);
      continue;
    }
    const f = {
      key: o.itemId,
      itemIds: [o.itemId],
      page: o.source.page,
      kind: i,
      level: i === "heading" ? o.headingLevel || (c === "title" || c === "doc_title" ? 1 : 2) : 0,
      source: r,
      translated: y ? h : r,
      hasTranslation: y,
      assetUrls: o.assetUrls,
      label: ""
    };
    k && a.set(k, f), !(!r && i !== "figure") && e.push(f);
  }
  return e;
}
function Xe(t, e) {
  const a = e === "translated" ? t.translated : t.source;
  if (t.kind === "heading") {
    const o = Math.min(Math.max(t.level, 1), 6);
    return `${"#".repeat(o)} ${a.replace(/\s*\n\s*/g, " ")}`;
  }
  return a;
}
const Ee = 40, Ce = { resolveAssetUrl: se };
function Je(t, e, a, o) {
  const [c, r] = T(""), [i, h] = T([]), y = z(/* @__PURE__ */ new Map()), [k, g] = T(0);
  return Y(() => {
    const f = t.current;
    if (!o || !f) return;
    let p = !1;
    const P = new AbortController(), M = [], d = [], E = /* @__PURE__ */ new Map();
    y.current = E, f.replaceChildren(), r("正在排版…");
    const w = f.closest(".reader-notes-panel-body"), q = async ($, I) => {
      const { text: L, slots: R } = me($, { bareLatex: !0 }), O = I(L);
      return R.length > 0 ? ge(O, R) : O;
    }, N = async ($, I, L, R) => {
      if (I.kind === "figure") {
        const n = I.assetUrls.map((s) => `<img src="${Ye(s)}" alt="">`).join("");
        return oe($, n, "", Ce);
      }
      let O = await q(Xe(I, L), R);
      return I.kind === "formula" && I.label && (O += `<span class="reader-md-formula-label">${Ze(I.label)}</span>`), oe($, O, "", Ce);
    };
    return (async () => {
      try {
        const { marked: $ } = await be(), I = (L) => String($.parse(L, { async: !1 }));
        for (let L = 0; L < e.length; L += Ee) {
          if (p) return;
          const R = f.ownerDocument.createDocumentFragment(), O = [];
          for (const n of e.slice(L, L + Ee)) {
            const s = f.ownerDocument.createElement("div");
            s.className = `reader-md-block is-${n.kind}`, s.dataset.mdBlock = n.key, s.dataset.mdPage = `${n.page}`, s.tabIndex = 0, s.setAttribute("role", "button"), s.setAttribute("aria-label", `跳到第 ${n.page} 页的这一块`);
            const u = a === "bilingual" && n.hasTranslation, m = u ? ["source", "translated"] : [a === "source" ? "source" : "translated"];
            for (const U of m) {
              const A = f.ownerDocument.createElement("div");
              if (A.className = u ? `reader-md-block-${U}` : "reader-md-block-body", O.push(...await N(A, n, U, I)), p) return;
              s.appendChild(A);
            }
            for (const U of n.itemIds) E.set(U, s);
            R.appendChild(s);
          }
          f.appendChild(R), f.classList.remove("hidden"), d.push(we(O, {
            root: w,
            // 受保护的判断要以 API 地址为准（它可能是局域网 IP，和静态页不同源）。
            protectedBaseUrl: se("", "/api/v1/"),
            fetchImage: he,
            signal: P.signal,
            onObjectUrl: (n) => M.push(n)
          })), await new Promise((n) => setTimeout(n, 0));
        }
        if (p) return;
        h(ae(f).filter((L) => {
          var R;
          return !((R = f.querySelector(`#${CSS.escape(L.id)}`)) != null && R.closest(".reader-md-block-source"));
        })), r(`${e.length} 块`), g((L) => L + 1);
      } catch ($) {
        p || r($ instanceof Error ? $.message : "Markdown 排版失败");
      }
    })(), () => {
      p = !0, P.abort();
      for (const $ of d) $();
      for (const $ of M)
        try {
          URL.revokeObjectURL($);
        } catch {
        }
    };
  }, [e, a, o, t]), { status: c, outline: i, elementsRef: y, renderedRevision: k };
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
  side: a = "right",
  regionHover: o,
  jumpToBlock: c,
  onClose: r
}) {
  const i = z(null), h = e.some((n) => n.hasTranslation), [y, k] = T(h ? "translated" : "source"), { status: g, outline: f, elementsRef: p, renderedRevision: P } = Je(i, e, y, t), [M, d] = T(!1), [E, w] = T(""), q = z([]), [N, $] = T(0), [I, L] = T(-1);
  Y(() => {
    if (!o) return;
    let n = null;
    const s = () => {
      const { itemId: m, origin: U } = o.get(), A = m ? p.current.get(m) ?? null : null;
      A !== n && (n == null || n.classList.remove("is-linked"), n = A, A && (A.classList.add("is-linked"), U === "pdf" && typeof A.scrollIntoView == "function" && A.scrollIntoView({ block: "nearest", behavior: "smooth" })));
    };
    s();
    const u = o.subscribe(s);
    return () => {
      u(), n == null || n.classList.remove("is-linked");
    };
  }, [o, p, P]), Y(() => {
    const n = i.current;
    if (!n) return;
    const s = (l) => l instanceof Element ? l.closest("[data-md-block]") : null, u = (l) => {
      const v = s(l.target);
      o == null || o.set((v == null ? void 0 : v.dataset.mdBlock) ?? null, "markdown");
    }, m = () => o == null ? void 0 : o.set(null, "markdown"), U = (l) => {
      const v = l == null ? void 0 : l.dataset.mdBlock;
      v && (c == null || c(v));
    }, A = (l) => {
      var v;
      (v = n.ownerDocument.getSelection()) != null && v.toString() || l.target instanceof Element && l.target.closest("a[href]") || U(s(l.target));
    }, B = (l) => {
      if (l.key !== "Enter" && l.key !== " ") return;
      const v = s(l.target);
      !v || v !== l.target || (l.preventDefault(), U(v));
    };
    return n.addEventListener("mouseover", u), n.addEventListener("mouseleave", m), n.addEventListener("click", A), n.addEventListener("keydown", B), () => {
      n.removeEventListener("mouseover", u), n.removeEventListener("mouseleave", m), n.removeEventListener("click", A), n.removeEventListener("keydown", B);
    };
  }, [o, c]);
  const R = (n, s = !0) => {
    const u = q.current;
    if (u.forEach((A) => A.classList.remove("reader-markdown-search-hit-active")), u.length === 0) {
      L(-1);
      return;
    }
    const m = (n + u.length) % u.length, U = u[m];
    U.classList.add("reader-markdown-search-hit-active"), L(m), s && typeof U.scrollIntoView == "function" && U.scrollIntoView({ block: "center", behavior: "smooth" });
  }, O = (n, s = !1) => {
    const u = i.current;
    if (!u) return;
    n.trim() || Re(u);
    const m = n.trim() ? Se(u, n) : [];
    q.current = m, $(m.length), R(m.length > 0 ? 0 : -1, s);
  };
  return Y(() => {
    E.trim() && O(E);
  }, [P]), /* @__PURE__ */ K(
    Ne,
    {
      id: "reader-markdown-panel",
      open: t,
      ariaLabel: "Markdown 预览",
      className: `is-pane-${a}`,
      onClose: r,
      toolbar: /* @__PURE__ */ b("span", { className: "reader-notes-count", children: g || "已加载" }),
      children: [
        /* @__PURE__ */ K("div", { className: "reader-markdown-nav", "aria-label": "Markdown 导航与搜索", children: [
          h ? /* @__PURE__ */ b("div", { className: "reader-md-view-switch", role: "tablist", "aria-label": "显示原文还是译文", children: et.map((n) => /* @__PURE__ */ b(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": y === n.value,
              className: y === n.value ? "is-active" : void 0,
              onClick: () => k(n.value),
              children: n.label
            },
            n.value
          )) }) : null,
          /* @__PURE__ */ K("label", { className: "reader-markdown-search", children: [
            /* @__PURE__ */ b(Le, { size: 13, "aria-hidden": !0 }),
            /* @__PURE__ */ b(
              "input",
              {
                type: "search",
                value: E,
                placeholder: "搜索正文",
                "aria-label": "搜索 Markdown 正文",
                onChange: (n) => {
                  w(n.target.value), O(n.target.value, !1);
                },
                onKeyDown: (n) => {
                  n.key !== "Enter" || N === 0 || (n.preventDefault(), R(I + (n.shiftKey ? -1 : 1)));
                }
              }
            ),
            E ? /* @__PURE__ */ b("span", { className: "reader-markdown-search-count", "aria-live": "polite", children: N > 0 ? `${I + 1}/${N}` : "0/0" }) : null,
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "上一个搜索结果",
                disabled: N === 0,
                onClick: () => R(I - 1),
                children: /* @__PURE__ */ b(Ue, { size: 13, "aria-hidden": !0 })
              }
            ),
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "下一个搜索结果",
                disabled: N === 0,
                onClick: () => R(I + 1),
                children: /* @__PURE__ */ b(Ae, { size: 13, "aria-hidden": !0 })
              }
            )
          ] }),
          /* @__PURE__ */ K(
            "button",
            {
              type: "button",
              className: "reader-markdown-outline-toggle",
              "aria-expanded": M,
              disabled: f.length === 0,
              onClick: () => d((n) => !n),
              children: [
                /* @__PURE__ */ b(Ie, { size: 13, "aria-hidden": !0 }),
                "目录",
                f.length > 0 ? ` ${f.length}` : ""
              ]
            }
          )
        ] }),
        M && f.length > 0 ? /* @__PURE__ */ b("nav", { className: "reader-markdown-outline", "aria-label": "Markdown 目录", children: f.map((n) => /* @__PURE__ */ b(
          "button",
          {
            type: "button",
            style: { "--reader-md-outline-level": n.level - 1 },
            onClick: () => {
              var m, U, A;
              const s = (m = i.current) == null ? void 0 : m.querySelector(`#${CSS.escape(n.id)}`);
              (U = s == null ? void 0 : s.scrollIntoView) == null || U.call(s, { block: "start", behavior: "smooth" });
              const u = (A = s == null ? void 0 : s.closest("[data-md-block]")) == null ? void 0 : A.dataset.mdBlock;
              u && (c == null || c(u));
            },
            children: n.text
          },
          n.id
        )) }) : null,
        /* @__PURE__ */ b(
          "article",
          {
            ref: i,
            id: "reader-markdown-content",
            className: "reader-markdown-content reader-float-markdown-content is-blocks"
          }
        )
      ]
    }
  );
}
function it(t) {
  const e = De(), a = e == null ? void 0 : e.regions, o = xe(() => a ? Ge(a) : null, [a]);
  return o && o.length > 0 ? /* @__PURE__ */ b(
    tt,
    {
      open: t.open,
      blocks: o,
      side: t.side,
      regionHover: e == null ? void 0 : e.regionHover,
      jumpToBlock: e == null ? void 0 : e.jumpToBlock,
      onClose: t.onClose
    }
  ) : /* @__PURE__ */ b(rt, { ...t });
}
function rt({
  open: t,
  jobId: e,
  sourceOnly: a,
  side: o = "right",
  onClose: c
}) {
  var A, B;
  const r = z([]), i = z(""), h = z(() => {
  }), [y, k] = T(!1), [g, f] = T(""), [p, P] = T(0), [M, d] = T(-1), {
    contentRef: E,
    status: w,
    setStatus: q,
    outline: N,
    outlineComplete: $,
    setOutlineComplete: I,
    outlineCompleteRef: L,
    pendingResume: R,
    rebuildOutline: O,
    renderAllRef: n,
    pendingAnchorRef: s,
    resumeCleanupRef: u
  } = We({
    open: t,
    jobId: e,
    sourceOnly: a,
    searchQueryRef: i,
    reapplySearchRef: h
  }), m = (l, v = !0) => {
    const x = r.current;
    if (x.forEach((F) => F.classList.remove("reader-markdown-search-hit-active")), x.length === 0) {
      d(-1);
      return;
    }
    const _ = (l + x.length) % x.length, S = x[_];
    S.classList.add("reader-markdown-search-hit-active"), d(_), v && typeof S.scrollIntoView == "function" && S.scrollIntoView({ block: "center", behavior: "smooth" });
  }, U = (l, v = !1) => {
    var S;
    const x = `${l || ""}`.trim();
    if (n.current = x.length > 0, n.current && ((S = u.current) == null || S.call(u)), !E.current) return;
    const _ = Se(E.current, l);
    r.current = _, P(_.length), m(_.length > 0 ? 0 : -1, v);
  };
  return h.current = () => U(i.current), /* @__PURE__ */ K(
    Ne,
    {
      id: "reader-markdown-panel",
      open: t,
      ariaLabel: "Markdown 预览",
      className: `is-pane-${o}`,
      onClose: c,
      toolbar: /* @__PURE__ */ b("span", { className: "reader-notes-count", children: w || "已加载" }),
      children: [
        /* @__PURE__ */ K("div", { className: "reader-markdown-nav", "aria-label": "Markdown 导航与搜索", children: [
          /* @__PURE__ */ K("label", { className: "reader-markdown-search", children: [
            /* @__PURE__ */ b(Le, { size: 13, "aria-hidden": !0 }),
            /* @__PURE__ */ b(
              "input",
              {
                type: "search",
                value: g,
                placeholder: "搜索正文",
                "aria-label": "搜索 Markdown 正文",
                onChange: (l) => {
                  const v = l.target.value;
                  i.current = v, f(v), U(v, !1);
                },
                onKeyDown: (l) => {
                  l.key !== "Enter" || p === 0 || (l.preventDefault(), m(M + (l.shiftKey ? -1 : 1)));
                }
              }
            ),
            g ? /* @__PURE__ */ b("span", { className: "reader-markdown-search-count", "aria-live": "polite", children: p > 0 ? `${M + 1}/${p}` : "0/0" }) : null,
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "上一个搜索结果",
                disabled: p === 0,
                onClick: () => m(M - 1),
                children: /* @__PURE__ */ b(Ue, { size: 13, "aria-hidden": !0 })
              }
            ),
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "下一个搜索结果",
                disabled: p === 0,
                onClick: () => m(M + 1),
                children: /* @__PURE__ */ b(Ae, { size: 13, "aria-hidden": !0 })
              }
            )
          ] }),
          /* @__PURE__ */ K(
            "button",
            {
              type: "button",
              className: "reader-markdown-outline-toggle",
              "aria-expanded": y,
              disabled: N.length === 0,
              onClick: () => {
                O(), I(L.current), k((l) => !l);
              },
              children: [
                /* @__PURE__ */ b(Ie, { size: 13, "aria-hidden": !0 }),
                "目录",
                N.length > 0 ? ` ${N.length}` : ""
              ]
            }
          ),
          R ? /* @__PURE__ */ b(
            "button",
            {
              type: "button",
              className: "reader-markdown-resume",
              onClick: () => {
                var l;
                return (l = u.current) == null ? void 0 : l.call(u);
              },
              children: "继续加载"
            }
          ) : null
        ] }),
        y && N.length > 0 ? /* @__PURE__ */ K("nav", { className: "reader-markdown-outline", "aria-label": "Markdown 目录", children: [
          $ ? null : /* @__PURE__ */ b("p", { className: "reader-markdown-outline-note", children: "仅显示已加载内容，滚动可加载更多" }),
          N.map((l) => /* @__PURE__ */ b(
            "button",
            {
              type: "button",
              style: { "--reader-md-outline-level": l.level - 1 },
              onClick: () => {
                var x, _;
                const v = [...((x = E.current) == null ? void 0 : x.querySelectorAll("h1, h2, h3, h4, h5, h6")) || []].find((S) => S.id === l.id);
                if (v && typeof v.scrollIntoView == "function") {
                  v.scrollIntoView({ block: "start", behavior: "smooth" });
                  return;
                }
                s.current = l.id, n.current = !0, (_ = u.current) == null || _.call(u), q("正在加载目标章节…");
              },
              children: l.text
            },
            l.id
          ))
        ] }) : null,
        w && !((B = (A = E.current) == null ? void 0 : A.childNodes) != null && B.length) ? /* @__PURE__ */ b("p", { className: "reader-notes-empty", children: w }) : null,
        /* @__PURE__ */ b(
          "article",
          {
            ref: E,
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
  Re as clearMarkdownSearchHighlights,
  Se as findMarkdownSearchTargets,
  Pe as isProtectedMarkdownAssetUrl,
  we as startMarkdownImageLoading
};
//# sourceMappingURL=ReaderMarkdownPanel-DyRl8fhg.js.map
