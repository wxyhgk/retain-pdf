import { jsx as u, jsxs as P } from "react/jsx-runtime";
import { createContext as x, useContext as M, useRef as $, useCallback as j, useEffect as I, useId as E, useMemo as A } from "react";
import { a as L, b as D, f as S, c as k, h as W, i as O, d as U, e as B } from "./answer-enhance-W8TBaAUL.js";
import F, { setCustomComponents as H, MathInlineNode as z } from "markstream-react";
const T = "retainpdf-ai-answer", C = 320, K = 2, v = x({
  final: !1,
  jobId: "",
  citations: []
});
function q(e) {
  const r = Number(e.naturalWidth) || 0, t = e.closest(".reader-ai-image-jump"), o = t || e, i = r > 0 && r < C;
  if (e.classList.toggle("is-low-resolution", i), t == null || t.classList.toggle("is-low-resolution", i), i) {
    const l = Math.min(
      C,
      Math.max(r, r * K)
    );
    o.style.setProperty("--reader-ai-image-width", `${l}px`);
  } else
    o.style.removeProperty("--reader-ai-image-width");
}
function G({ node: e }) {
  const { final: r, jobId: t, citations: o, onJumpCitation: i } = M(v), l = $(null), n = $(null), d = `${e.alt || ""}`.trim(), g = D(e.src, t), f = S(e.src, o, t), m = L(f), N = j((s) => {
    var w;
    const h = l.current;
    if (h === s || ((w = n.current) == null || w.abort(), n.current = null, h && k(h), l.current = s, !s || !g)) return;
    const b = new AbortController();
    n.current = b, (async () => {
      for (const y of [0, 250, 750, 1500]) {
        if (y && await new Promise((c) => globalThis.setTimeout(c, y)), b.signal.aborted) return;
        const a = l.current;
        if (!a || a !== s || a.classList.contains("is-hydrated") && a.src.startsWith("blob:")) return;
        await W(a, { signal: b.signal });
      }
    })();
  }, [g]);
  if (I(() => () => {
    var s;
    (s = n.current) == null || s.abort(), n.current = null, k(l.current), l.current = null;
  }, []), !g)
    return r ? /* @__PURE__ */ u("span", { className: "aui-image-blocked", children: d ? `[图片不可用：${d}]` : "[图片不可用]" }) : /* @__PURE__ */ u("span", { className: "aui-image-pending", "aria-label": d || "图片加载中", children: d ? `[图片：${d}]` : "[图片加载中]" });
  const p = /* @__PURE__ */ u(
    "img",
    {
      ref: N,
      alt: d,
      "data-ai-src": g,
      decoding: "async",
      loading: "lazy",
      onLoad: (s) => q(s.currentTarget),
      title: e.title || void 0
    }
  );
  return !f || !i ? p : /* @__PURE__ */ P(
    "button",
    {
      type: "button",
      className: "reader-ai-image-jump",
      "data-page": m ?? void 0,
      title: m ? `定位到 PDF 第 ${m} 页` : "定位到图片来源",
      onClick: (s) => {
        s.preventDefault(), s.stopPropagation(), i({ ...f, image_url: g });
      },
      children: [
        p,
        /* @__PURE__ */ u("span", { className: "reader-ai-image-jump-label", "aria-hidden": "true", children: m ? `定位 p.${m}` : "定位来源" })
      ]
    }
  );
}
function X({ node: e }) {
  const { citations: r, onJumpCitation: t } = M(v), o = `${e.href || ""}`.match(/^#retainpdf-citation-(\d+)$/), i = o ? r.find((n) => `${n.ref}` === o[1]) : null;
  if (i) {
    const n = L(i);
    return /* @__PURE__ */ P(
      "button",
      {
        type: "button",
        className: "reader-ai-citation-ref",
        "data-page": n ?? void 0,
        title: n ? `跳到第 ${n} 页` : "定位来源",
        onClick: (d) => {
          d.preventDefault(), d.stopPropagation(), t == null || t(i);
        },
        children: [
          "[",
          o == null ? void 0 : o[1],
          "]"
        ]
      }
    );
  }
  const l = `${e.text || e.href || ""}`.trim();
  return /* @__PURE__ */ u(
    "span",
    {
      className: "aui-md-extlink",
      "data-href": `${e.href || ""}`.trim() || void 0,
      title: l || void 0,
      children: l
    }
  );
}
function Q({ node: e }) {
  return /* @__PURE__ */ u(
    z,
    {
      node: e.markup === "$$" ? { ...e, markup: "$" } : e
    }
  );
}
H(T, {
  image: G,
  link: X,
  math_inline: Q
});
function V({
  content: e,
  final: r,
  indexKey: t,
  jobId: o,
  citations: i = [],
  onJumpCitation: l,
  onClickCapture: n
}) {
  return /* @__PURE__ */ u(v.Provider, { value: { final: r, jobId: o, citations: i, onJumpCitation: l }, children: /* @__PURE__ */ u(
    "div",
    {
      className: "retain-markstream-shell",
      "data-markdown-renderer": "markstream-react",
      onClickCapture: n,
      children: /* @__PURE__ */ u(
        F,
        {
          batchRendering: !r,
          content: e,
          customId: T,
          fade: !1,
          final: r,
          htmlPolicy: "escape",
          indexKey: t,
          maxLiveNodes: 0,
          renderCodeBlocksAsPre: !0,
          showTooltips: !1,
          smoothStreaming: !1,
          typewriter: !1
        }
      )
    }
  ) });
}
function te({
  content: e,
  streaming: r = !1,
  citations: t = [],
  jobId: o = "",
  className: i = "",
  streamingClassName: l = "",
  pendingClassName: n = "",
  finalClassName: d = "",
  citationFooterMax: g = 5,
  onJumpCitation: f
}) {
  var y;
  const m = $(null), N = E(), p = r ? `${e || ""}` : `${e || ""}`.trim(), s = `${o || ((y = t.find((a) => a.job_id)) == null ? void 0 : y.job_id) || ""}`.trim(), h = A(() => {
    const a = /* @__PURE__ */ new Map();
    for (const c of t)
      O(c) && a.set(`${c.ref}`, c);
    return a;
  }, [t]), b = A(
    () => U(p, h),
    [p, h]
  );
  return I(() => {
    var R;
    const a = m.current;
    if (!a || !p) return;
    const c = a.parentElement;
    if (c instanceof HTMLElement) {
      if (r) {
        (R = c.querySelector(".reader-ai-citations")) == null || R.remove();
        return;
      }
      B(c, t, {
        onJump: (_) => f == null ? void 0 : f(_),
        answerText: p,
        max: g
      });
    }
  }, [r, s, h, t, f, p, g]), I(() => () => k(m.current), []), p.trim() ? /* @__PURE__ */ u("div", { ref: m, className: `${i} ${r ? l : d || n}`.trim(), children: /* @__PURE__ */ u(
    V,
    {
      content: b,
      final: !r,
      indexKey: N,
      jobId: s,
      citations: t,
      onJumpCitation: f,
      onClickCapture: (a) => {
        const c = a.target;
        c instanceof Element && c.closest("a[href]") && (a.preventDefault(), a.stopPropagation());
      }
    }
  ) }) : null;
}
export {
  te as A
};
//# sourceMappingURL=AiMarkdownAnswer-DET_KlrE.js.map
