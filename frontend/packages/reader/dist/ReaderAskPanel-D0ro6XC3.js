import { jsx as n, jsxs as d, Fragment as A } from "react/jsx-runtime";
import { useState as f, useCallback as k, useEffect as M, useMemo as I } from "react";
import E from "@retainpdf/ask/window";
import { Check as B, X as O, Pencil as R, Trash2 as D, BookmarkCheck as F, Archive as U, Loader2 as q, ChevronRight as L } from "lucide-react";
import { Sheet as Q, Checkbox as j, SegmentedControl as G, Input as z, Button as b } from "@retainpdf/ui";
import { b as K, r as W, s as X } from "./ReaderApp-BT29bMM_.js";
const Y = 4e3;
function T(e, i = Y) {
  const s = `${e || ""}`.trim();
  return s.length > i ? `${s.slice(0, i)}…` : s;
}
function H(e, i, s = "") {
  const a = [], t = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return a.push(`我在读${s ? `《${s}》` : "一本书"}，${t}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && a.push("", "我选中的这段：", T(e.selection)), e.sourceText && a.push("", "这一块的原文：", T(e.sourceText)), e.translatedText && a.push("", "这一块的译文：", T(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && a.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), a.push("", `（RetainPDF 任务 ${i}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), a.join(`
`);
}
function P(e, i, s = "", a) {
  return {
    page: e.page,
    label: [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: H(e, i, s),
    ...a ? { meta: { retainpdf: { selection: a } } } : {}
  };
}
function V(e, i, s) {
  const a = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (t, u) => e.openSession({ ...t, jobId: i, ...s ? { conversationId: s.id } : {} }, u),
    ...s && a ? { conversationPreamble: () => a.contextText(s.id, s.documentId) } : {}
  };
}
const Z = {
  preference: "偏好",
  background: "背景",
  style: "回答风格",
  progress: "读到哪",
  term: "术语",
  conclusion: "结论",
  other: "其他"
};
function J({ memory: e, port: i, onChanged: s }) {
  const [a, t] = f(!1), [u, o] = f(e.text), [N, l] = f(!1), x = async (m) => {
    l(!0);
    try {
      await m(), s();
    } finally {
      l(!1);
    }
  };
  return /* @__PURE__ */ n("li", { className: "reader-memory-row", "data-origin": e.origin, children: a ? /* @__PURE__ */ d(
    "form",
    {
      className: "reader-memory-edit",
      onSubmit: (m) => {
        m.preventDefault(), u.trim() && x(() => i.update(e.memory_id, { text: u.trim() })).then(() => t(!1));
      },
      children: [
        /* @__PURE__ */ n(z, { size: "sm", value: u, maxLength: 500, onChange: (m) => o(m.target.value), "aria-label": "改这条记忆", autoFocus: !0 }),
        /* @__PURE__ */ n(b, { className: "reader-memory-icon", type: "submit", "aria-label": "存", title: "存", disabled: N || !u.trim(), children: /* @__PURE__ */ n(B, { size: 13, "aria-hidden": !0 }) }),
        /* @__PURE__ */ n(b, { className: "reader-memory-icon", type: "button", "aria-label": "不改了", title: "不改了", onClick: () => {
          o(e.text), t(!1);
        }, children: /* @__PURE__ */ n(O, { size: 13, "aria-hidden": !0 }) })
      ]
    }
  ) : /* @__PURE__ */ d(A, { children: [
    /* @__PURE__ */ n("p", { className: "reader-memory-text", children: e.text }),
    /* @__PURE__ */ d("div", { className: "reader-memory-meta", children: [
      /* @__PURE__ */ n("span", { children: Z[e.category] || e.category }),
      /* @__PURE__ */ n("span", { children: e.origin === "agent" ? "AI 记的" : "你加的" }),
      /* @__PURE__ */ n("span", { children: e.updated_at.slice(0, 10) }),
      e.source_page ? /* @__PURE__ */ d("span", { children: [
        "第 ",
        e.source_page,
        " 页"
      ] }) : null,
      /* @__PURE__ */ n("span", { className: "reader-memory-gap" }),
      /* @__PURE__ */ n(b, { className: "reader-memory-icon", "aria-label": "改", title: "改", onClick: () => t(!0), children: /* @__PURE__ */ n(R, { size: 12, "aria-hidden": !0 }) }),
      /* @__PURE__ */ n(b, { className: "reader-memory-icon", "aria-label": "删", title: "删（它替代的旧条会恢复）", disabled: N, onClick: () => void x(() => i.remove(e.memory_id)), children: /* @__PURE__ */ n(D, { size: 12, "aria-hidden": !0 }) })
    ] })
  ] }) });
}
function ee({ port: e, documentId: i, open: s, onOpenChange: a }) {
  const [t, u] = f("user"), [o, N] = f(""), [l, x] = f(null), [m, y] = f(null), [g, p] = f(""), [w, C] = f(""), _ = t === "book" && i, S = k(async () => {
    if (t === "book" && !i) return x([]);
    try {
      const r = await e.list({ scope: t, ..._ ? { document_id: i } : {}, ...o.trim() ? { q: o.trim() } : {}, limit: 200 });
      x(r), C("");
    } catch (r) {
      C(r instanceof Error ? r.message : String(r));
    }
  }, [e, t, _, i, o]);
  M(() => {
    if (!s) return;
    const r = setTimeout(() => void S(), o ? 250 : 0);
    return () => clearTimeout(r);
  }, [s, S, o]), M(() => {
    s && e.settings().then((r) => y(r.memory_enabled), () => y(null));
  }, [s, e]);
  const $ = async () => {
    const r = g.trim();
    if (r)
      try {
        await e.create({ scope: t, text: r, ..._ ? { document_id: i } : {} }), p(""), await S();
      } catch (h) {
        C(h instanceof Error ? h.message : String(h));
      }
  };
  return /* @__PURE__ */ n(Q, { open: s, onOpenChange: a, title: "记忆", description: "AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。", className: "reader-memory-sheet", children: /* @__PURE__ */ d("div", { className: "reader-memory", children: [
    /* @__PURE__ */ n(
      j,
      {
        label: "让 AI 使用记忆",
        checked: m ?? !0,
        disabled: m === null,
        onChange: (r) => {
          const h = r.target.checked;
          y(h), e.setEnabled(h).then((v) => y(v.memory_enabled), () => y(!h));
        }
      }
    ),
    m === !1 ? /* @__PURE__ */ n("p", { className: "reader-memory-note", children: "关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。" }) : null,
    /* @__PURE__ */ n(
      G,
      {
        label: "哪一层",
        size: "sm",
        value: t,
        onChange: (r) => u(r),
        options: [
          { value: "user", label: "关于你" },
          { value: "book", label: "这本书", disabled: !i }
        ]
      }
    ),
    /* @__PURE__ */ n(z, { size: "sm", type: "search", placeholder: "搜记忆", value: o, onChange: (r) => N(r.target.value), "aria-label": "搜记忆" }),
    /* @__PURE__ */ d("form", { className: "reader-memory-add", onSubmit: (r) => {
      r.preventDefault(), $();
    }, children: [
      /* @__PURE__ */ n(z, { size: "sm", placeholder: t === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译", value: g, maxLength: 500, onChange: (r) => p(r.target.value), "aria-label": "加一条记忆" }),
      /* @__PURE__ */ n(b, { type: "submit", variant: "secondary", size: "sm", disabled: !g.trim(), children: "记下" })
    ] }),
    w ? /* @__PURE__ */ n("p", { className: "reader-memory-note", "data-tone": "error", children: w }) : null,
    l === null ? null : l.length ? /* @__PURE__ */ n("ul", { className: "reader-memory-list", children: l.map((r) => /* @__PURE__ */ n(J, { memory: r, port: e, onChanged: () => void S() }, `${r.memory_id}:${r.updated_at}`)) }) : /* @__PURE__ */ n("p", { className: "reader-memory-note", children: o ? "没搜到。" : t === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。" })
  ] }) });
}
function te({ ask: e }) {
  const i = e.view.conversation;
  return (i == null ? void 0 : i.kind) !== "side" ? null : i.status !== "open" ? /* @__PURE__ */ n("p", { className: "ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ d("div", { className: "ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ n("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ d(b, { className: "ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ n(q, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function ne({ ask: e }) {
  const i = e.view.conversation;
  return (i == null ? void 0 : i.kind) !== "side" ? /* @__PURE__ */ n("span", { className: "ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: "主对话" }) : /* @__PURE__ */ d("span", { className: "ask-crumbs", children: [
    /* @__PURE__ */ n(b, { className: "ask-crumb-link", title: "回主对话（副对话留着，之后能回来）", onClick: () => void e.backToMain(), children: "主对话" }),
    /* @__PURE__ */ n(L, { size: 11, "aria-hidden": !0 }),
    /* @__PURE__ */ n("span", { className: "ask-crumb", title: i.title, children: i.title || "副对话" })
  ] });
}
function de({ port: e, jobId: i, bookTitle: s, book: a, ask: t, onShowSelection: u, onJumpToPage: o, pageCount: N, legacy: l, onLayout: x }) {
  const [m, y] = f(!1), g = t.view.conversation, p = l ? null : g ? { id: g.conversation_id, documentId: a.documentId } : null, w = I(() => V(e, i, p), [e, i, p == null ? void 0 : p.id, p == null ? void 0 : p.documentId]), C = l ? null : t.pending, _ = I(() => C ? P(C, i, s, K(C, a)) : null, [C, i, s, a]), S = u ? (v) => {
    const c = v.data;
    !(c != null && c.page) || c.document_id && a.documentId && c.document_id !== a.documentId || u({ page: c.page, pane: c.pane === "source" ? "source" : "translated" });
  } : void 0, $ = W() || void 0;
  if (l)
    return /* @__PURE__ */ n(
      E,
      {
        port: w,
        context: null,
        title: /* @__PURE__ */ d("span", { className: "ask-crumb", title: "2026-11-26 以前按书存的提问，只能看；新的问题都在主对话里", children: [
          "以前的提问 · 第 ",
          l.anchor.page,
          " 页"
        ] }),
        initialMessages: l.messages,
        readOnly: !0,
        onClose: l.onClose,
        onDelete: l.onDelete,
        onJumpToPage: o,
        pageCount: N,
        katexStylesheetUrl: $,
        onLayout: x
      },
      `legacy:${l.anchor.page}:${l.messages.length}`
    );
  const r = (g == null ? void 0 : g.kind) === "main", h = e.memories ?? null;
  return /* @__PURE__ */ d(A, { children: [
    /* @__PURE__ */ n(
      E,
      {
        port: w,
        context: _,
        onContextUsed: () => t.setPending(null),
        onContextClear: () => t.setPending(null),
        onClose: t.close,
        title: /* @__PURE__ */ n(ne, { ask: t }),
        headerActions: /* @__PURE__ */ d(A, { children: [
          h ? /* @__PURE__ */ n(b, { className: "ask-icon", "aria-label": "记忆", title: "记忆：AI 记下的、你自己加的（能关掉）", onClick: () => y(!0), children: /* @__PURE__ */ n(F, { size: 14, "aria-hidden": !0 }) }) : null,
          r && t.persistent ? /* @__PURE__ */ n(b, { className: "ask-icon", "aria-label": "归档主对话", title: "归档这个主对话，开一个新的（归档的还在，记忆不受影响）", onClick: () => void t.archiveMain(), children: /* @__PURE__ */ n(U, { size: 14, "aria-hidden": !0 }) }) : null
        ] }),
        footer: /* @__PURE__ */ d(A, { children: [
          t.error ? /* @__PURE__ */ n("p", { className: "ask-error", children: t.error }) : null,
          /* @__PURE__ */ n(te, { ask: t })
        ] }),
        onShowContext: S,
        initialMessages: t.view.initial,
        earlier: t.view.hasMore ? { loading: t.loading, load: () => void t.loadEarlier() } : null,
        onTurn: t.persistent ? t.onTurn : void 0,
        onFork: r && t.persistent ? (v) => void t.fork(v) : void 0,
        onOpenSide: t.persistent ? (v) => void t.openSide(v) : void 0,
        onForgetMemory: t.forgetMemory,
        onRewrite: t.persistent ? async (v) => {
          const c = await t.rewrite(v);
          return c ? P(X(c), i, s, { ...c, item_ids: c.item_ids || [] }) : null;
        } : void 0,
        memories: t.notices,
        onJumpToPage: o,
        pageCount: N,
        katexStylesheetUrl: $,
        onLayout: x
      },
      t.view.key
    ),
    h ? /* @__PURE__ */ n(ee, { port: h, documentId: a.documentId, open: m, onOpenChange: y }) : null
  ] });
}
export {
  de as default
};
//# sourceMappingURL=ReaderAskPanel-D0ro6XC3.js.map
