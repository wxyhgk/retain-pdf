import { jsxs as O, jsx as f } from "react/jsx-runtime";
import { useRef as R, useState as A, useEffect as Q } from "react";
import { Search as ae, ChevronUp as ce, ChevronDown as oe, ListTree as se, FileCode2 as le } from "lucide-react";
import { d as ie, b as de, r as ue } from "./ReaderApp-BgACXe1b.js";
import { e as he, m as fe, a as me } from "./markdown-math-Cb17EyYs.js";
import { n as we } from "./markdown-payload-kK3ewW_I.js";
import { R as ke } from "./ReaderFloatShell-DTFWp_bv.js";
let I = null;
function be() {
  return I || (I = import("marked").catch((t) => {
    throw I = null, t;
  })), I;
}
function pe(t) {
  t.querySelectorAll("script, iframe, object, embed, style, link, meta, base, form, input, button, textarea, select").forEach((r) => r.remove()), t.querySelectorAll("*").forEach((r) => {
    for (const n of [...r.attributes])
      /^on/i.test(n.name) && r.removeAttribute(n.name);
  }), t.querySelectorAll("a[href]").forEach((r) => {
    const n = r;
    /^\s*javascript:/i.test(n.getAttribute("href") || "") && n.removeAttribute("href"), n.setAttribute("target", "_blank"), n.setAttribute("rel", "noopener noreferrer");
  });
}
function _(t, r, n) {
  const o = t.ownerDocument.createElement("template");
  return o.innerHTML = r, pe(o.content), o.content.querySelectorAll("img[src]").forEach((s) => {
    const i = s.getAttribute("src") || "", e = ue(n, i) || i;
    s.setAttribute("data-reader-md-src", e), s.setAttribute("loading", "lazy"), s.setAttribute("decoding", "async"), s.removeAttribute("src");
  }), t.replaceChildren(o.content), t.classList.remove("hidden"), [...t.querySelectorAll("img[data-reader-md-src]")];
}
function ge(t, r = "http://localhost/") {
  var n;
  if (/^mock:\/\//i.test(t)) return !0;
  try {
    const o = ((n = globalThis.location) == null ? void 0 : n.href) || "http://localhost/", s = new URL(r, o), i = new URL(t, s);
    if (!/\/api\/v1\/jobs\/[^/]+\/markdown\/images\//.test(i.pathname)) return !1;
    if (!/^[a-z][a-z\d+.-]*:/i.test(t)) return !0;
    const e = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(i.hostname);
    return i.origin === s.origin || e;
  } catch {
    return !1;
  }
}
function Me(t) {
  return t.normalize("NFKC").trim().toLocaleLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "") || "section";
}
function G(t) {
  const r = /* @__PURE__ */ new Map();
  return [...t.querySelectorAll("h1, h2, h3, h4, h5, h6")].flatMap((n) => {
    const o = (n.textContent || "").replace(/\s+/g, " ").trim();
    if (!o) return [];
    const s = Me(o), i = (r.get(s) || 0) + 1;
    r.set(s, i);
    const e = i === 1 ? `reader-md-${s}` : `reader-md-${s}-${i}`;
    return n.id = e, [{ id: e, level: Number(n.tagName.slice(1)), text: o }];
  });
}
const J = "h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre";
function ye(t) {
  t.querySelectorAll(".reader-markdown-search-hit, .reader-markdown-search-hit-active").forEach((r) => {
    r.classList.remove("reader-markdown-search-hit", "reader-markdown-search-hit-active");
  });
}
function ve(t, r) {
  ye(t);
  const n = r.trim().toLocaleLowerCase();
  if (!n) return [];
  const s = [...t.querySelectorAll(J)].filter((i) => [...i.children].some((e) => e.matches(J)) ? !1 : (i.textContent || "").toLocaleLowerCase().includes(n));
  return s.forEach((i) => i.classList.add("reader-markdown-search-hit")), s;
}
function Ae(t, r) {
  let n = !1, o = 0, s = 0, i = 0;
  const e = [], b = [], k = /* @__PURE__ */ new Set(), y = (a, w) => {
    const l = a.ownerDocument.createElement("span");
    l.className = "reader-markdown-image-missing", l.textContent = w, l.title = a.getAttribute("data-reader-md-src") || "", a.replaceWith(l);
  };
  for (const a of t) {
    const w = a.getAttribute("data-reader-md-src") || "", l = a.ownerDocument.baseURI || "http://localhost/";
    ge(w, r.protectedBaseUrl || l) ? b.push(a) : Se(w, l) ? a.src = w : y(a, "[图片地址不可用]");
  }
  const d = () => {
    var a;
    return (a = r.onProgress) == null ? void 0 : a.call(r, { failed: i, loaded: s, total: b.length });
  }, S = () => {
    if (!n)
      for (; o < 4 && e.length > 0; ) {
        const a = e.shift();
        if (!(a != null && a.isConnected)) continue;
        o += 1;
        const w = a.getAttribute("data-reader-md-src") || "";
        r.fetchImage(w).then(async (l) => {
          if (!(l != null && l.ok)) throw new Error(`HTTP ${(l == null ? void 0 : l.status) || 0}`);
          const L = URL.createObjectURL(await l.blob());
          if (n || !a.isConnected) {
            try {
              URL.revokeObjectURL(L);
            } catch {
            }
            return;
          }
          r.onObjectUrl(L), a.src = L, s += 1;
        }).catch(() => {
          n || !a.isConnected || (i += 1, y(a, "[图片暂不可用]"));
        }).finally(() => {
          o -= 1, n || (d(), S());
        });
      }
  }, v = (a) => {
    n || k.has(a) || (k.add(a), e.push(a), S());
  }, p = globalThis.IntersectionObserver;
  let h = null;
  return p && b.length > 0 ? (h = new p((a) => {
    a.forEach((w) => {
      if (!w.isIntersecting) return;
      const l = w.target;
      h == null || h.unobserve(l), v(l);
    });
  }, { root: r.root || null, rootMargin: "600px 0px" }), b.forEach((a) => h == null ? void 0 : h.observe(a))) : b.forEach(v), d(), () => {
    n = !0, e.length = 0, h == null || h.disconnect();
  };
}
function Se(t, r) {
  if (/^data:image\//i.test(t) || /^blob:/i.test(t)) return !0;
  try {
    const n = new URL(t, r);
    return n.protocol === "http:" || n.protocol === "https:";
  } catch {
    return !1;
  }
}
function qe({
  open: t,
  jobId: r,
  sourceOnly: n,
  layout: o = "floating",
  side: s = "right",
  onClose: i
}) {
  var T, B;
  const e = R(null), [b, k] = A("尚未加载"), y = R([]), d = R(null), S = R([]), v = R(""), [p, h] = A([]), [a, w] = A(!1), [l, L] = A(""), [U, X] = A(0), [x, j] = A(-1), D = () => {
    for (const c of y.current)
      try {
        URL.revokeObjectURL(c);
      } catch {
      }
    y.current = [];
  }, N = (c, m = !0) => {
    const u = S.current;
    if (u.forEach((q) => q.classList.remove("reader-markdown-search-hit-active")), u.length === 0) {
      j(-1);
      return;
    }
    const M = (c + u.length) % u.length, g = u[M];
    g.classList.add("reader-markdown-search-hit-active"), j(M), m && typeof g.scrollIntoView == "function" && g.scrollIntoView({ block: "center", behavior: "smooth" });
  }, P = (c, m = !1) => {
    if (!e.current) return;
    const u = ve(e.current, c);
    S.current = u, X(u.length), N(u.length > 0 ? 0 : -1, m);
  };
  return Q(() => () => {
    var c;
    (c = d.current) == null || c.call(d), D();
  }, []), Q(() => {
    var u, M;
    if (!t) {
      (u = d.current) == null || u.call(d), d.current = null, D(), h([]);
      return;
    }
    let c = !1;
    D(), (M = d.current) == null || M.call(d), d.current = null;
    async function m() {
      var q, F, K, W;
      const g = r.startsWith("doc:");
      if (!r || g) {
        k(!r && n ? "源文档阅读不提供 Markdown 产物" : "该任务暂无 Markdown 产物"), e.current && (e.current.replaceChildren(), e.current.classList.add("hidden"));
        return;
      }
      k("正在加载 Markdown…"), (q = e.current) == null || q.replaceChildren(), (F = e.current) == null || F.classList.add("hidden");
      try {
        const C = await ie.loadMarkdownPayload(r);
        if (c) return;
        const { content: V, imagesBaseUrl: $ } = we(C);
        if (!V.trim()) {
          k("该任务暂无 Markdown 产物"), (K = e.current) == null || K.replaceChildren(), (W = e.current) == null || W.classList.add("hidden");
          return;
        }
        const { marked: Y } = await be();
        if (c || !e.current) return;
        const { text: Z, slots: E } = he(V), H = String(Y.parse(Z, { async: !1 })), ee = fe(H, E);
        _(e.current, ee, $), h(G(e.current)), P(v.current), k(E.length > 0 ? `正文已显示 · 正在渲染 ${E.length} 个公式…` : "");
        const te = E.length > 0 ? await me(H, E) : H;
        if (c || !e.current) return;
        const re = _(e.current, te, $);
        h(G(e.current)), P(v.current), k("");
        const ne = e.current.closest(".reader-notes-panel-body");
        d.current = Ae(re, {
          root: ne,
          protectedBaseUrl: $ || e.current.ownerDocument.baseURI,
          fetchImage: de,
          onObjectUrl: (z) => y.current.push(z),
          onProgress: ({ failed: z }) => {
            !c && z > 0 && k(`正文已加载 · ${z} 张图片不可用`);
          }
        });
      } catch (C) {
        if (c) return;
        k(C instanceof Error ? C.message : "Markdown 加载失败");
      }
    }
    return m(), () => {
      var g;
      c = !0, (g = d.current) == null || g.call(d), d.current = null;
    };
  }, [t, r, n]), /* @__PURE__ */ O(
    ke,
    {
      id: "reader-markdown-panel",
      open: t,
      title: "Markdown",
      subtitle: o === "docked" ? "识别与翻译产出 · PDF / Markdown 分栏" : "识别与翻译产出 · 拖动可移动",
      titleIcon: /* @__PURE__ */ f(le, { size: 14, strokeWidth: 2.25, "aria-hidden": !0 }),
      storageKey: "retainpdf.reader.markdown-float.pos.v1",
      ariaLabel: "Markdown 预览",
      width: 420,
      placement: o === "workspace" ? "workspace" : o === "docked" ? "dock-right" : "floating",
      showHeader: o !== "workspace",
      className: o === "workspace" ? `is-pane-${s}` : void 0,
      onClose: i,
      toolbar: /* @__PURE__ */ f("span", { className: "reader-notes-count", children: b || "已加载" }),
      children: [
        /* @__PURE__ */ O("div", { className: "reader-markdown-nav", "aria-label": "Markdown 导航与搜索", children: [
          /* @__PURE__ */ O("label", { className: "reader-markdown-search", children: [
            /* @__PURE__ */ f(ae, { size: 13, "aria-hidden": !0 }),
            /* @__PURE__ */ f(
              "input",
              {
                type: "search",
                value: l,
                placeholder: "搜索正文",
                "aria-label": "搜索 Markdown 正文",
                onChange: (c) => {
                  const m = c.target.value;
                  v.current = m, L(m), P(m, !1);
                },
                onKeyDown: (c) => {
                  c.key !== "Enter" || U === 0 || (c.preventDefault(), N(x + (c.shiftKey ? -1 : 1)));
                }
              }
            ),
            l ? /* @__PURE__ */ f("span", { className: "reader-markdown-search-count", "aria-live": "polite", children: U > 0 ? `${x + 1}/${U}` : "0/0" }) : null,
            /* @__PURE__ */ f(
              "button",
              {
                type: "button",
                "aria-label": "上一个搜索结果",
                disabled: U === 0,
                onClick: () => N(x - 1),
                children: /* @__PURE__ */ f(ce, { size: 13, "aria-hidden": !0 })
              }
            ),
            /* @__PURE__ */ f(
              "button",
              {
                type: "button",
                "aria-label": "下一个搜索结果",
                disabled: U === 0,
                onClick: () => N(x + 1),
                children: /* @__PURE__ */ f(oe, { size: 13, "aria-hidden": !0 })
              }
            )
          ] }),
          /* @__PURE__ */ O(
            "button",
            {
              type: "button",
              className: "reader-markdown-outline-toggle",
              "aria-expanded": a,
              disabled: p.length === 0,
              onClick: () => w((c) => !c),
              children: [
                /* @__PURE__ */ f(se, { size: 13, "aria-hidden": !0 }),
                "目录",
                p.length > 0 ? ` ${p.length}` : ""
              ]
            }
          )
        ] }),
        a && p.length > 0 ? /* @__PURE__ */ f("nav", { className: "reader-markdown-outline", "aria-label": "Markdown 目录", children: p.map((c) => /* @__PURE__ */ f(
          "button",
          {
            type: "button",
            style: { "--reader-md-outline-level": c.level - 1 },
            onClick: () => {
              var u;
              const m = [...((u = e.current) == null ? void 0 : u.querySelectorAll("h1, h2, h3, h4, h5, h6")) || []].find((M) => M.id === c.id);
              m && typeof m.scrollIntoView == "function" && m.scrollIntoView({ block: "start", behavior: "smooth" });
            },
            children: c.text
          },
          c.id
        )) }) : null,
        b && !((B = (T = e.current) == null ? void 0 : T.childNodes) != null && B.length) ? /* @__PURE__ */ f("p", { className: "reader-notes-empty", children: b }) : null,
        /* @__PURE__ */ f(
          "article",
          {
            ref: e,
            id: "reader-markdown-content",
            className: "reader-markdown-content reader-float-markdown-content"
          }
        )
      ]
    }
  );
}
export {
  qe as ReaderMarkdownPanel,
  G as buildMarkdownOutline,
  ye as clearMarkdownSearchHighlights,
  ve as findMarkdownSearchTargets,
  ge as isProtectedMarkdownAssetUrl,
  Ae as startMarkdownImageLoading
};
//# sourceMappingURL=ReaderMarkdownPanel-CwLJig2X.js.map
