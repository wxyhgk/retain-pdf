import { jsxs as Q, jsx as b } from "react/jsx-runtime";
import { useRef as T, useState as z, useEffect as ee, useMemo as De } from "react";
import { Search as Le, ChevronUp as Ae, ChevronDown as Ue, ListTree as Se } from "lucide-react";
import { d as pe, r as se, f as fe, b as Re, u as xe } from "./ReaderApp-CiCYEYqe.js";
import { e as me, m as ze, a as we } from "./markdown-math-XkF5urpn.js";
import { n as Pe } from "./markdown-payload-kK3ewW_I.js";
import { r as Te, b as qe } from "./reader-blocks-BxElLvLX.js";
const ve = "h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre";
function Ie(t) {
  t.querySelectorAll(".reader-markdown-search-hit, .reader-markdown-search-hit-active").forEach((r) => {
    r.classList.remove("reader-markdown-search-hit", "reader-markdown-search-hit-active");
  });
}
function Ne(t, r) {
  Ie(t);
  const s = r.trim().toLocaleLowerCase();
  if (!s) return [];
  const l = [...t.querySelectorAll(ve)].filter((a) => [...a.children].some((h) => h.matches(ve)) ? !1 : (a.textContent || "").toLocaleLowerCase().includes(s));
  return l.forEach((a) => a.classList.add("reader-markdown-search-hit")), l;
}
function Be(t) {
  return t.normalize("NFKC").trim().toLocaleLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "") || "section";
}
function ae(t, r = /* @__PURE__ */ new Map()) {
  return [...t.querySelectorAll("h1, h2, h3, h4, h5, h6")].flatMap((s) => {
    const c = (s.textContent || "").replace(/\s+/g, " ").trim();
    if (!c) return [];
    const l = Be(c), a = (r.get(l) || 0) + 1;
    r.set(l, a);
    const h = a === 1 ? `reader-md-${l}` : `reader-md-${l}-${a}`;
    return s.id = h, [{ id: h, level: Number(s.tagName.slice(1)), text: c }];
  });
}
function Ve(t, r = "http://localhost/") {
  var s;
  if (/^mock:\/\//i.test(t)) return !0;
  try {
    const c = ((s = globalThis.location) == null ? void 0 : s.href) || "http://localhost/", l = new URL(r, c), a = new URL(t, l);
    if (!/\/api\/v1\/jobs\/[^/]+\/(?:markdown|files\/output\/ocr)\/images\//.test(a.pathname)) return !1;
    if (!/^[a-z][a-z\d+.-]*:/i.test(t)) return !0;
    const h = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(a.hostname);
    return a.origin === l.origin || h;
  } catch {
    return !1;
  }
}
function _e(t, r) {
  if (/^data:image\//i.test(t) || /^blob:/i.test(t)) return !0;
  try {
    const s = new URL(t, r);
    return s.protocol === "http:" || s.protocol === "https:";
  } catch {
    return !1;
  }
}
function ge(t, r) {
  let s = !1, c = 0, l = 0, a = 0;
  const h = [], w = [], A = /* @__PURE__ */ new Set(), L = (u, p) => {
    const m = u.ownerDocument.createElement("span");
    m.className = "reader-markdown-image-missing", m.textContent = p, m.title = u.getAttribute("data-reader-md-src") || "", u.replaceWith(m);
  };
  for (const u of t) {
    const p = u.getAttribute("data-reader-md-src") || "", m = u.ownerDocument.baseURI || "http://localhost/";
    Ve(p, r.protectedBaseUrl || m) ? w.push(u) : _e(p, m) ? u.src = p : L(u, "[图片地址不可用]");
  }
  const O = () => {
    var u;
    return (u = r.onProgress) == null ? void 0 : u.call(r, { failed: a, loaded: l, total: w.length });
  }, f = () => {
    if (!s)
      for (; c < 4 && h.length > 0; ) {
        const u = h.shift();
        if (!(u != null && u.isConnected)) continue;
        c += 1;
        const p = u.getAttribute("data-reader-md-src") || "";
        r.fetchImage(p, r.signal ? { signal: r.signal } : void 0).then(async (m) => {
          if (!(m != null && m.ok)) throw new Error(`HTTP ${(m == null ? void 0 : m.status) || 0}`);
          const V = URL.createObjectURL(await m.blob());
          if (s || !u.isConnected) {
            try {
              URL.revokeObjectURL(V);
            } catch {
            }
            return;
          }
          r.onObjectUrl(V), u.src = V, l += 1;
        }).catch(() => {
          s || !u.isConnected || (a += 1, L(u, "[图片暂不可用]"));
        }).finally(() => {
          c -= 1, s || (O(), f());
        });
      }
  }, y = (u) => {
    s || A.has(u) || (A.add(u), h.push(u), f());
  }, q = globalThis.IntersectionObserver;
  let k = null;
  return q && w.length > 0 ? (k = new q((u) => {
    u.forEach((p) => {
      if (!p.isIntersecting) return;
      const m = p.target;
      k == null || k.unobserve(m), y(m);
    });
  }, { root: r.root || null, rootMargin: "600px 0px" }), w.forEach((u) => k == null ? void 0 : k.observe(u))) : w.forEach(y), O(), () => {
    s = !0, h.length = 0, k == null || k.disconnect();
  };
}
let ue = null;
function be() {
  return ue || (ue = import("marked").catch((t) => {
    throw ue = null, t;
  })), ue;
}
function Ke(t) {
  t.querySelectorAll("script, iframe, object, embed, style, link, meta, base, form, input, button, textarea, select").forEach((r) => r.remove()), t.querySelectorAll("*").forEach((r) => {
    for (const s of [...r.attributes])
      /^on/i.test(s.name) && r.removeAttribute(s.name);
  }), t.querySelectorAll("a[href]").forEach((r) => {
    const s = r;
    /^\s*javascript:/i.test(s.getAttribute("href") || "") && s.removeAttribute("href"), s.setAttribute("target", "_blank"), s.setAttribute("rel", "noopener noreferrer");
  });
}
function oe(t, r, s, c = {}) {
  const l = t.ownerDocument.createElement("template");
  return l.innerHTML = r, Ke(l.content), l.content.querySelectorAll("img[src]").forEach((a) => {
    var A;
    const h = a.getAttribute("src") || "", w = ((A = c.resolveAssetUrl) == null ? void 0 : A.call(c, s, h)) || h;
    a.setAttribute("data-reader-md-src", w), a.setAttribute("loading", "lazy"), a.setAttribute("decoding", "async"), a.removeAttribute("src");
  }), t.replaceChildren(l.content), t.classList.remove("hidden"), [...t.querySelectorAll("img[data-reader-md-src]")];
}
function Fe(t, r) {
  let s = r;
  for (; s < t.length; ) {
    const c = t.indexOf(`
`, s), l = c === -1 ? t.length : c, a = t.slice(s, l).trim();
    if (a !== "") return a;
    if (c === -1) return null;
    s = c + 1;
  }
  return null;
}
const We = /^\s{0,3}\[[^\]]+\]:/;
function ye(t) {
  const r = t.match(/^(?:([-*+])|(\d+)([.)]))\s+/);
  return r ? r[1] ? `ul:${r[1]}` : `ol:${r[3]}` : null;
}
function He(t, r, s) {
  const c = Fe(t, r);
  if (!c) return !1;
  if (We.test(c)) return !0;
  const l = s ? ye(s) : null, a = ye(c);
  return l != null && l === a;
}
function Me(t, { minChars: r = 16384 } = {}) {
  if (!t) return null;
  let s = "", c = null, l = 0;
  const a = t.length;
  for (; l < a; ) {
    const h = t.indexOf(`
`, l), w = h === -1 ? a : h, L = t.slice(l, w).trim(), O = L.match(/^(`{3,}|~{3,})/);
    if (O) {
      const f = O[1][0];
      s ? s === f && (s = "") : s = f;
    }
    if (!s && L === "") {
      const f = h === -1 ? a : h + 1;
      if (f >= r && !He(t, f, c))
        return { complete: t.slice(0, f), rest: t.slice(f) };
    } else L !== "" && (c = L);
    if (h === -1) break;
    l = h + 1;
  }
  return null;
}
function Qe({
  open: t,
  jobId: r,
  sourceOnly: s,
  searchQueryRef: c,
  reapplySearchRef: l
}) {
  const a = T(null), [h, w] = z("尚未加载"), A = T([]), L = T(null), O = T(/* @__PURE__ */ new Map()), f = T([]), y = T(null), q = T(!1), k = T(!1), u = T(null), [p, m] = z([]), [V, I] = z(!1), [N, U] = z(!1), M = () => {
    for (const n of A.current)
      try {
        URL.revokeObjectURL(n);
      } catch {
      }
    A.current = [];
  }, S = () => {
    var n, i;
    (n = L.current) == null || n.call(L), L.current = null;
    for (const d of f.current) d();
    f.current = [], (i = y.current) == null || i.call(y), y.current = null, M();
  }, $ = () => {
    const n = a.current;
    n && (O.current = /* @__PURE__ */ new Map(), m(ae(n, O.current)));
  }, e = () => {
    const n = u.current, i = a.current;
    if (!n || !i) return;
    const d = [...i.querySelectorAll("h1, h2, h3, h4, h5, h6")].find((C) => C.id === n);
    d && (u.current = null, typeof d.scrollIntoView == "function" && d.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  return ee(() => () => {
    var n;
    (n = L.current) == null || n.call(L), M();
  }, []), ee(() => {
    if (!t) {
      S(), m([]), k.current = !1, I(!1);
      return;
    }
    let n = !1;
    S(), O.current = /* @__PURE__ */ new Map(), k.current = !1, I(!1), m([]), q.current = !1, u.current = null, U(!1);
    const i = new AbortController(), d = pe;
    async function C() {
      var o, g, D, P, R, K;
      const B = r.startsWith("doc:");
      if (!r || B) {
        w(!r && s ? "源文档阅读不提供 Markdown 产物" : "该任务暂无 Markdown 产物"), a.current && (a.current.replaceChildren(), a.current.classList.add("hidden"));
        return;
      }
      w("正在加载 Markdown…"), (o = a.current) == null || o.replaceChildren(), (g = a.current) == null || g.classList.add("hidden");
      try {
        if (typeof (d == null ? void 0 : d.loadMarkdownSource) == "function" && typeof (d == null ? void 0 : d.loadMarkdownRange) == "function") {
          const x = await d.loadMarkdownSource(r, i.signal);
          if (n) return;
          if (x != null && x.rawUrl) {
            await E(x);
            return;
          }
        }
      } catch {
      }
      try {
        const x = await pe.loadMarkdownPayload(r);
        if (n) return;
        const { content: F, imagesBaseUrl: X } = Pe(x);
        if (!F.trim()) {
          w("该任务暂无 Markdown 产物"), (D = a.current) == null || D.replaceChildren(), (P = a.current) == null || P.classList.add("hidden");
          return;
        }
        const { marked: _ } = await be();
        if (n || !a.current) return;
        const { text: j, slots: G } = me(F, { bareLatex: !0 }), te = String(_.parse(j, { async: !1 })), re = ze(te, G);
        oe(a.current, re, X, {
          resolveAssetUrl: se
        }), m(ae(a.current)), (R = l.current) == null || R.call(l), w(G.length > 0 ? `正文已显示 · 正在渲染 ${G.length} 个公式…` : "");
        const le = G.length > 0 ? await we(te, G) : te;
        if (n || !a.current) return;
        const ce = oe(a.current, le, X, {
          resolveAssetUrl: se
        });
        m(ae(a.current)), k.current = !0, I(!0), (K = l.current) == null || K.call(l), w("");
        const de = a.current.closest(".reader-notes-panel-body");
        L.current = ge(ce, {
          root: de,
          protectedBaseUrl: X || a.current.ownerDocument.baseURI,
          fetchImage: fe,
          signal: i.signal,
          onObjectUrl: (J) => A.current.push(J),
          onProgress: ({ failed: J }) => {
            !n && J > 0 && w(`正文已加载 · ${J} 张图片不可用`);
          }
        });
      } catch (x) {
        if (n) return;
        w(x instanceof Error ? x.message : "Markdown 加载失败");
      }
    }
    async function E(B) {
      var J;
      const o = a.current;
      if (!o) return;
      const g = 262144, D = 8192, P = `${B.imagesBaseUrl || ""}`, R = o.closest(".reader-notes-panel-body");
      let K = new TextDecoder(), x = 0, F = `${B.etag || ""}`, X = Number.isFinite(Number(B.totalBytes)) ? Number(B.totalBytes) : null, _ = "", j = !1;
      const G = 4, te = 4e3;
      let re = 0;
      const le = () => {
        for (const v of f.current) v();
        f.current = [], M(), O.current = /* @__PURE__ */ new Map(), m([]);
      }, ce = async (v) => {
        const { marked: W } = await be();
        if (n || !a.current) return;
        const { text: H, slots: Y } = me(v, { bareLatex: !0 }), ne = String(W.parse(H, { async: !1 })), he = Y.length > 0 ? await we(ne, Y) : ne;
        if (n || !a.current) return;
        const ie = o.ownerDocument.createElement("section");
        ie.className = "reader-markdown-chunk";
        const Oe = oe(ie, he, P, {
          resolveAssetUrl: se
        });
        o.appendChild(ie), o.classList.remove("hidden");
        const ke = ae(ie, O.current);
        ke.length && m((Z) => [...Z, ...ke]), e();
        const $e = ge(Oe, {
          root: R,
          protectedBaseUrl: P || o.ownerDocument.baseURI,
          fetchImage: fe,
          signal: i.signal,
          onObjectUrl: (Z) => A.current.push(Z),
          onProgress: ({ failed: Z }) => {
            !n && Z > 0 && w(`正文已加载 · ${Z} 张图片不可用`);
          }
        });
        f.current.push($e);
      }, de = async () => {
        q.current || !R || n || o.scrollHeight <= R.clientHeight * 2 || (U(!0), w("已加载部分 · 滚动或点击继续加载"), await new Promise((v) => {
          let W = !1, H = null;
          const Y = (he) => {
            W || (W = !0, R.removeEventListener("scroll", ne), H && (clearTimeout(H), H = null), y.current = null, n || (U(!1), he && (re = 0)), v());
          }, ne = () => {
            (o.scrollHeight <= R.clientHeight * 2 || R.scrollTop + R.clientHeight >= o.scrollHeight - 800) && Y(!0);
          };
          y.current = () => Y(!0), R.addEventListener("scroll", ne, { passive: !0 }), re < G && (re += 1, H = setTimeout(() => Y(!1), te));
        }));
      };
      try {
        for (; !j && !n; ) {
          const v = await d.loadMarkdownRange(
            B.rawUrl,
            x,
            x + g - 1,
            F || void 0,
            i.signal
          );
          if (n) return;
          if (v.status === 404) {
            w("该任务暂无 Markdown 产物"), o.replaceChildren(), o.classList.add("hidden");
            return;
          }
          if (v.status === 200)
            o.replaceChildren(), le(), K = new TextDecoder(), _ = K.decode(v.bytes, { stream: !1 }), j = !0;
          else if (v.status === 206) {
            if (F && v.etag && v.etag !== F) {
              o.replaceChildren(), le(), K = new TextDecoder(), _ = "", x = 0, j = !1, F = v.etag;
              continue;
            }
            !F && v.etag && (F = v.etag), v.totalBytes != null && (X = v.totalBytes);
            const H = v.rangeEnd != null ? v.rangeEnd + 1 : x + v.bytes.length;
            j = X != null ? H >= X : v.bytes.length < g, _ += K.decode(v.bytes, { stream: !j }), x = H;
          } else
            throw new Error(`读取 Markdown 失败，请稍后重试。(${v.status})`);
          let W = Me(_, { minChars: D });
          for (; W && !n; ) {
            if (_ = W.rest, await ce(W.complete), n) return;
            await de(), W = Me(_, { minChars: D });
          }
          j && _.trim() && (await ce(_), _ = "");
        }
        n || ($(), k.current = !0, I(!0), e(), w(""), c.current.trim() && ((J = l.current) == null || J.call(l)));
      } catch (v) {
        if (n || i.signal.aborted) return;
        w(v instanceof Error ? v.message : "Markdown 加载失败");
      }
    }
    return C(), () => {
      n = !0, i.abort(), S();
    };
  }, [t, r, s]), {
    contentRef: a,
    status: h,
    setStatus: w,
    outline: p,
    setOutline: m,
    outlineComplete: V,
    setOutlineComplete: I,
    outlineCompleteRef: k,
    pendingResume: N,
    rebuildOutline: $,
    renderAllRef: q,
    pendingAnchorRef: u,
    resumeCleanupRef: y
  };
}
const Ce = 40, Ee = { resolveAssetUrl: se };
function je(t, r, s, c) {
  const [l, a] = z(""), [h, w] = z([]), A = T(/* @__PURE__ */ new Map()), [L, O] = z(0);
  return ee(() => {
    const f = t.current;
    if (!c || !f) return;
    let y = !1;
    const q = new AbortController(), k = [], u = [], p = /* @__PURE__ */ new Map();
    A.current = p, f.replaceChildren(), a("正在排版…");
    const m = f.closest(".reader-notes-panel-body"), V = async (N, U) => {
      const { text: M, slots: S } = me(N, { bareLatex: !0 }), $ = U(M);
      return S.length > 0 ? we($, S) : $;
    }, I = async (N, U, M, S) => {
      if (U.kind === "figure") {
        const e = U.assetUrls.map((n) => `<img src="${Xe(n)}" alt="">`).join("");
        return oe(N, e, "", Ee);
      }
      let $ = await V(Te(U, M), S);
      return U.kind === "formula" && U.label && ($ += `<span class="reader-md-formula-label">${Ge(U.label)}</span>`), oe(N, $, "", Ee);
    };
    return (async () => {
      try {
        const { marked: N } = await be(), U = (M) => String(N.parse(M, { async: !1 }));
        for (let M = 0; M < r.length; M += Ce) {
          if (y) return;
          const S = f.ownerDocument.createDocumentFragment(), $ = [];
          for (const e of r.slice(M, M + Ce)) {
            const n = f.ownerDocument.createElement("div");
            n.className = `reader-md-block is-${e.kind}`, n.dataset.mdBlock = e.key, n.dataset.mdPage = `${e.page}`, n.tabIndex = 0, n.setAttribute("role", "button"), n.setAttribute("aria-label", `跳到第 ${e.page} 页的这一块`);
            const i = s === "bilingual" && e.hasTranslation, d = i ? ["source", "translated"] : [s === "source" ? "source" : "translated"];
            for (const C of d) {
              const E = f.ownerDocument.createElement("div");
              if (E.className = i ? `reader-md-block-${C}` : "reader-md-block-body", $.push(...await I(E, e, C, U)), y) return;
              n.appendChild(E);
            }
            for (const C of e.itemIds) p.set(C, n);
            S.appendChild(n);
          }
          f.appendChild(S), f.classList.remove("hidden"), u.push(ge($, {
            root: m,
            // 受保护的判断要以 API 地址为准（它可能是局域网 IP，和静态页不同源）。
            protectedBaseUrl: se("", "/api/v1/"),
            fetchImage: fe,
            signal: q.signal,
            onObjectUrl: (e) => k.push(e)
          })), await new Promise((e) => setTimeout(e, 0));
        }
        if (y) return;
        w(ae(f).filter((M) => {
          var S;
          return !((S = f.querySelector(`#${CSS.escape(M.id)}`)) != null && S.closest(".reader-md-block-source"));
        })), a(`${r.length} 块`), O((M) => M + 1);
      } catch (N) {
        y || a(N instanceof Error ? N.message : "Markdown 排版失败");
      }
    })(), () => {
      y = !0, q.abort();
      for (const N of u) N();
      for (const N of k)
        try {
          URL.revokeObjectURL(N);
        } catch {
        }
    };
  }, [r, s, c, t]), { status: l, outline: h, elementsRef: A, renderedRevision: L };
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
  blocks: r,
  side: s = "right",
  regionHover: c,
  jumpToBlock: l,
  onClose: a
}) {
  const h = T(null), w = r.some((e) => e.hasTranslation), [A, L] = z(w ? "translated" : "source"), { status: O, outline: f, elementsRef: y, renderedRevision: q } = je(h, r, A, t), [k, u] = z(!1), [p, m] = z(""), V = T([]), [I, N] = z(0), [U, M] = z(-1);
  ee(() => {
    if (!c) return;
    let e = null;
    const n = () => {
      const { itemId: d, origin: C } = c.get(), E = d ? y.current.get(d) ?? null : null;
      E !== e && (e == null || e.classList.remove("is-linked"), e = E, E && (E.classList.add("is-linked"), C === "pdf" && typeof E.scrollIntoView == "function" && E.scrollIntoView({ block: "nearest", behavior: "smooth" })));
    };
    n();
    const i = c.subscribe(n);
    return () => {
      i(), e == null || e.classList.remove("is-linked");
    };
  }, [c, y, q]), ee(() => {
    const e = h.current;
    if (!e) return;
    const n = (o) => o instanceof Element ? o.closest("[data-md-block]") : null, i = (o) => {
      const g = n(o.target);
      c == null || c.set((g == null ? void 0 : g.dataset.mdBlock) ?? null, "markdown");
    }, d = () => c == null ? void 0 : c.set(null, "markdown"), C = (o) => {
      const g = o == null ? void 0 : o.dataset.mdBlock;
      g && (l == null || l(g));
    }, E = (o) => {
      var g;
      (g = e.ownerDocument.getSelection()) != null && g.toString() || o.target instanceof Element && o.target.closest("a[href]") || C(n(o.target));
    }, B = (o) => {
      if (o.key !== "Enter" && o.key !== " ") return;
      const g = n(o.target);
      !g || g !== o.target || (o.preventDefault(), C(g));
    };
    return e.addEventListener("mouseover", i), e.addEventListener("mouseleave", d), e.addEventListener("click", E), e.addEventListener("keydown", B), () => {
      e.removeEventListener("mouseover", i), e.removeEventListener("mouseleave", d), e.removeEventListener("click", E), e.removeEventListener("keydown", B);
    };
  }, [c, l]);
  const S = (e, n = !0) => {
    const i = V.current;
    if (i.forEach((E) => E.classList.remove("reader-markdown-search-hit-active")), i.length === 0) {
      M(-1);
      return;
    }
    const d = (e + i.length) % i.length, C = i[d];
    C.classList.add("reader-markdown-search-hit-active"), M(d), n && typeof C.scrollIntoView == "function" && C.scrollIntoView({ block: "center", behavior: "smooth" });
  }, $ = (e, n = !1) => {
    const i = h.current;
    if (!i) return;
    e.trim() || Ie(i);
    const d = e.trim() ? Ne(i, e) : [];
    V.current = d, N(d.length), S(d.length > 0 ? 0 : -1, n);
  };
  return ee(() => {
    p.trim() && $(p);
  }, [q]), /* @__PURE__ */ Q(
    Re,
    {
      id: "reader-markdown-panel",
      open: t,
      ariaLabel: "Markdown 预览",
      className: `is-pane-${s}`,
      onClose: a,
      toolbar: /* @__PURE__ */ b("span", { className: "reader-notes-count", children: O || "已加载" }),
      children: [
        /* @__PURE__ */ Q("div", { className: "reader-markdown-nav", "aria-label": "Markdown 导航与搜索", children: [
          w ? /* @__PURE__ */ b("div", { className: "reader-md-view-switch", role: "tablist", "aria-label": "显示原文还是译文", children: Je.map((e) => /* @__PURE__ */ b(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": A === e.value,
              className: A === e.value ? "is-active" : void 0,
              onClick: () => L(e.value),
              children: e.label
            },
            e.value
          )) }) : null,
          /* @__PURE__ */ Q("label", { className: "reader-markdown-search", children: [
            /* @__PURE__ */ b(Le, { size: 13, "aria-hidden": !0 }),
            /* @__PURE__ */ b(
              "input",
              {
                type: "search",
                value: p,
                placeholder: "搜索正文",
                "aria-label": "搜索 Markdown 正文",
                onChange: (e) => {
                  m(e.target.value), $(e.target.value, !1);
                },
                onKeyDown: (e) => {
                  e.key !== "Enter" || I === 0 || (e.preventDefault(), S(U + (e.shiftKey ? -1 : 1)));
                }
              }
            ),
            p ? /* @__PURE__ */ b("span", { className: "reader-markdown-search-count", "aria-live": "polite", children: I > 0 ? `${U + 1}/${I}` : "0/0" }) : null,
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "上一个搜索结果",
                disabled: I === 0,
                onClick: () => S(U - 1),
                children: /* @__PURE__ */ b(Ae, { size: 13, "aria-hidden": !0 })
              }
            ),
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "下一个搜索结果",
                disabled: I === 0,
                onClick: () => S(U + 1),
                children: /* @__PURE__ */ b(Ue, { size: 13, "aria-hidden": !0 })
              }
            )
          ] }),
          /* @__PURE__ */ Q(
            "button",
            {
              type: "button",
              className: "reader-markdown-outline-toggle",
              "aria-expanded": k,
              disabled: f.length === 0,
              onClick: () => u((e) => !e),
              children: [
                /* @__PURE__ */ b(Se, { size: 13, "aria-hidden": !0 }),
                "目录",
                f.length > 0 ? ` ${f.length}` : ""
              ]
            }
          )
        ] }),
        k && f.length > 0 ? /* @__PURE__ */ b("nav", { className: "reader-markdown-outline", "aria-label": "Markdown 目录", children: f.map((e) => /* @__PURE__ */ b(
          "button",
          {
            type: "button",
            style: { "--reader-md-outline-level": e.level - 1 },
            onClick: () => {
              var d, C, E;
              const n = (d = h.current) == null ? void 0 : d.querySelector(`#${CSS.escape(e.id)}`);
              (C = n == null ? void 0 : n.scrollIntoView) == null || C.call(n, { block: "start", behavior: "smooth" });
              const i = (E = n == null ? void 0 : n.closest("[data-md-block]")) == null ? void 0 : E.dataset.mdBlock;
              i && (l == null || l(i));
            },
            children: e.text
          },
          e.id
        )) }) : null,
        /* @__PURE__ */ b(
          "article",
          {
            ref: h,
            id: "reader-markdown-content",
            className: "reader-markdown-content reader-float-markdown-content is-blocks"
          }
        )
      ]
    }
  );
}
function lt(t) {
  const r = xe(), s = r == null ? void 0 : r.regions, c = De(() => s ? qe(s) : null, [s]);
  return c && c.length > 0 ? /* @__PURE__ */ b(
    Ye,
    {
      open: t.open,
      blocks: c,
      side: t.side,
      regionHover: r == null ? void 0 : r.regionHover,
      jumpToBlock: r == null ? void 0 : r.jumpToBlock,
      onClose: t.onClose
    }
  ) : /* @__PURE__ */ b(Ze, { ...t });
}
function Ze({
  open: t,
  jobId: r,
  sourceOnly: s,
  side: c = "right",
  onClose: l
}) {
  var E, B;
  const a = T([]), h = T(""), w = T(() => {
  }), [A, L] = z(!1), [O, f] = z(""), [y, q] = z(0), [k, u] = z(-1), {
    contentRef: p,
    status: m,
    setStatus: V,
    outline: I,
    outlineComplete: N,
    setOutlineComplete: U,
    outlineCompleteRef: M,
    pendingResume: S,
    rebuildOutline: $,
    renderAllRef: e,
    pendingAnchorRef: n,
    resumeCleanupRef: i
  } = Qe({
    open: t,
    jobId: r,
    sourceOnly: s,
    searchQueryRef: h,
    reapplySearchRef: w
  }), d = (o, g = !0) => {
    const D = a.current;
    if (D.forEach((K) => K.classList.remove("reader-markdown-search-hit-active")), D.length === 0) {
      u(-1);
      return;
    }
    const P = (o + D.length) % D.length, R = D[P];
    R.classList.add("reader-markdown-search-hit-active"), u(P), g && typeof R.scrollIntoView == "function" && R.scrollIntoView({ block: "center", behavior: "smooth" });
  }, C = (o, g = !1) => {
    var R;
    const D = `${o || ""}`.trim();
    if (e.current = D.length > 0, e.current && ((R = i.current) == null || R.call(i)), !p.current) return;
    const P = Ne(p.current, o);
    a.current = P, q(P.length), d(P.length > 0 ? 0 : -1, g);
  };
  return w.current = () => C(h.current), /* @__PURE__ */ Q(
    Re,
    {
      id: "reader-markdown-panel",
      open: t,
      ariaLabel: "Markdown 预览",
      className: `is-pane-${c}`,
      onClose: l,
      toolbar: /* @__PURE__ */ b("span", { className: "reader-notes-count", children: m || "已加载" }),
      children: [
        /* @__PURE__ */ Q("div", { className: "reader-markdown-nav", "aria-label": "Markdown 导航与搜索", children: [
          /* @__PURE__ */ Q("label", { className: "reader-markdown-search", children: [
            /* @__PURE__ */ b(Le, { size: 13, "aria-hidden": !0 }),
            /* @__PURE__ */ b(
              "input",
              {
                type: "search",
                value: O,
                placeholder: "搜索正文",
                "aria-label": "搜索 Markdown 正文",
                onChange: (o) => {
                  const g = o.target.value;
                  h.current = g, f(g), C(g, !1);
                },
                onKeyDown: (o) => {
                  o.key !== "Enter" || y === 0 || (o.preventDefault(), d(k + (o.shiftKey ? -1 : 1)));
                }
              }
            ),
            O ? /* @__PURE__ */ b("span", { className: "reader-markdown-search-count", "aria-live": "polite", children: y > 0 ? `${k + 1}/${y}` : "0/0" }) : null,
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "上一个搜索结果",
                disabled: y === 0,
                onClick: () => d(k - 1),
                children: /* @__PURE__ */ b(Ae, { size: 13, "aria-hidden": !0 })
              }
            ),
            /* @__PURE__ */ b(
              "button",
              {
                type: "button",
                "aria-label": "下一个搜索结果",
                disabled: y === 0,
                onClick: () => d(k + 1),
                children: /* @__PURE__ */ b(Ue, { size: 13, "aria-hidden": !0 })
              }
            )
          ] }),
          /* @__PURE__ */ Q(
            "button",
            {
              type: "button",
              className: "reader-markdown-outline-toggle",
              "aria-expanded": A,
              disabled: I.length === 0,
              onClick: () => {
                $(), U(M.current), L((o) => !o);
              },
              children: [
                /* @__PURE__ */ b(Se, { size: 13, "aria-hidden": !0 }),
                "目录",
                I.length > 0 ? ` ${I.length}` : ""
              ]
            }
          ),
          S ? /* @__PURE__ */ b(
            "button",
            {
              type: "button",
              className: "reader-markdown-resume",
              onClick: () => {
                var o;
                return (o = i.current) == null ? void 0 : o.call(i);
              },
              children: "继续加载"
            }
          ) : null
        ] }),
        A && I.length > 0 ? /* @__PURE__ */ Q("nav", { className: "reader-markdown-outline", "aria-label": "Markdown 目录", children: [
          N ? null : /* @__PURE__ */ b("p", { className: "reader-markdown-outline-note", children: "仅显示已加载内容，滚动可加载更多" }),
          I.map((o) => /* @__PURE__ */ b(
            "button",
            {
              type: "button",
              style: { "--reader-md-outline-level": o.level - 1 },
              onClick: () => {
                var D, P;
                const g = [...((D = p.current) == null ? void 0 : D.querySelectorAll("h1, h2, h3, h4, h5, h6")) || []].find((R) => R.id === o.id);
                if (g && typeof g.scrollIntoView == "function") {
                  g.scrollIntoView({ block: "start", behavior: "smooth" });
                  return;
                }
                n.current = o.id, e.current = !0, (P = i.current) == null || P.call(i), V("正在加载目标章节…");
              },
              children: o.text
            },
            o.id
          ))
        ] }) : null,
        m && !((B = (E = p.current) == null ? void 0 : E.childNodes) != null && B.length) ? /* @__PURE__ */ b("p", { className: "reader-notes-empty", children: m }) : null,
        /* @__PURE__ */ b(
          "article",
          {
            ref: p,
            id: "reader-markdown-content",
            className: "reader-markdown-content reader-float-markdown-content"
          }
        )
      ]
    }
  );
}
export {
  lt as ReaderMarkdownPanel,
  ae as buildMarkdownOutline,
  Ie as clearMarkdownSearchHighlights,
  Ne as findMarkdownSearchTargets,
  Ve as isProtectedMarkdownAssetUrl,
  ge as startMarkdownImageLoading
};
//# sourceMappingURL=ReaderMarkdownPanel-DTacxOUx.js.map
