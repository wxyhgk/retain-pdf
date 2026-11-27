import { jsx as n, jsxs as u, Fragment as $ } from "react/jsx-runtime";
import { useState as g, useCallback as P, useEffect as z, useMemo as M } from "react";
import I from "@retainpdf/ask/window";
import { Check as k, X as B, Pencil as O, Trash2 as R, BookmarkCheck as D, Archive as F, Loader2 as U, ChevronRight as L } from "lucide-react";
import { Sheet as q, Checkbox as Q, SegmentedControl as j, Input as T, Button as v } from "@retainpdf/ui";
import { b as G, r as K, s as W } from "./ReaderApp-BbWWAI4d.js";
const X = 4e3;
function A(e, i = X) {
  const s = `${e || ""}`.trim();
  return s.length > i ? `${s.slice(0, i)}…` : s;
}
function Y(e, i, s = "") {
  const a = [], t = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return a.push(`我在读${s ? `《${s}》` : "一本书"}，${t}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && a.push("", "我选中的这段：", A(e.selection)), e.sourceText && a.push("", "这一块的原文：", A(e.sourceText)), e.translatedText && a.push("", "这一块的译文：", A(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && a.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), a.push("", `（RetainPDF 任务 ${i}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), a.join(`
`);
}
function E(e, i, s = "", a) {
  return {
    page: e.page,
    label: [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: Y(e, i, s),
    ...a ? { meta: { retainpdf: { selection: a } } } : {}
  };
}
function H(e, i, s) {
  const a = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (t, h) => e.openSession({ ...t, jobId: i, ...s ? { conversationId: s.id } : {} }, h),
    ...s && a ? { conversationPreamble: () => a.contextText(s.id, s.documentId) } : {}
  };
}
const V = {
  preference: "偏好",
  background: "背景",
  style: "回答风格",
  progress: "读到哪",
  term: "术语",
  conclusion: "结论",
  other: "其他"
};
function Z({ memory: e, port: i, onChanged: s }) {
  const [a, t] = g(!1), [h, c] = g(e.text), [b, l] = g(!1), x = async (m) => {
    l(!0);
    try {
      await m(), s();
    } finally {
      l(!1);
    }
  };
  return /* @__PURE__ */ n("li", { className: "reader-memory-row", "data-origin": e.origin, children: a ? /* @__PURE__ */ u(
    "form",
    {
      className: "reader-memory-edit",
      onSubmit: (m) => {
        m.preventDefault(), h.trim() && x(() => i.update(e.memory_id, { text: h.trim() })).then(() => t(!1));
      },
      children: [
        /* @__PURE__ */ n(T, { size: "sm", value: h, maxLength: 500, onChange: (m) => c(m.target.value), "aria-label": "改这条记忆", autoFocus: !0 }),
        /* @__PURE__ */ n(v, { className: "reader-memory-icon", type: "submit", "aria-label": "存", title: "存", disabled: b || !h.trim(), children: /* @__PURE__ */ n(k, { size: 13, "aria-hidden": !0 }) }),
        /* @__PURE__ */ n(v, { className: "reader-memory-icon", type: "button", "aria-label": "不改了", title: "不改了", onClick: () => {
          c(e.text), t(!1);
        }, children: /* @__PURE__ */ n(B, { size: 13, "aria-hidden": !0 }) })
      ]
    }
  ) : /* @__PURE__ */ u($, { children: [
    /* @__PURE__ */ n("p", { className: "reader-memory-text", children: e.text }),
    /* @__PURE__ */ u("div", { className: "reader-memory-meta", children: [
      /* @__PURE__ */ n("span", { children: V[e.category] || e.category }),
      /* @__PURE__ */ n("span", { children: e.origin === "agent" ? "AI 记的" : "你加的" }),
      /* @__PURE__ */ n("span", { children: e.updated_at.slice(0, 10) }),
      e.source_page ? /* @__PURE__ */ u("span", { children: [
        "第 ",
        e.source_page,
        " 页"
      ] }) : null,
      /* @__PURE__ */ n("span", { className: "reader-memory-gap" }),
      /* @__PURE__ */ n(v, { className: "reader-memory-icon", "aria-label": "改", title: "改", onClick: () => t(!0), children: /* @__PURE__ */ n(O, { size: 12, "aria-hidden": !0 }) }),
      /* @__PURE__ */ n(v, { className: "reader-memory-icon", "aria-label": "删", title: "删（它替代的旧条会恢复）", disabled: b, onClick: () => void x(() => i.remove(e.memory_id)), children: /* @__PURE__ */ n(R, { size: 12, "aria-hidden": !0 }) })
    ] })
  ] }) });
}
function J({ port: e, documentId: i, open: s, onOpenChange: a }) {
  const [t, h] = g("user"), [c, b] = g(""), [l, x] = g(null), [m, p] = g(null), [f, N] = g(""), [y, S] = g(""), w = t === "book" && i, C = P(async () => {
    if (t === "book" && !i) return x([]);
    try {
      const r = await e.list({ scope: t, ...w ? { document_id: i } : {}, ...c.trim() ? { q: c.trim() } : {}, limit: 200 });
      x(r), S("");
    } catch (r) {
      S(r instanceof Error ? r.message : String(r));
    }
  }, [e, t, w, i, c]);
  z(() => {
    if (!s) return;
    const r = setTimeout(() => void C(), c ? 250 : 0);
    return () => clearTimeout(r);
  }, [s, C, c]), z(() => {
    s && e.settings().then((r) => p(r.memory_enabled), () => p(null));
  }, [s, e]);
  const _ = async () => {
    const r = f.trim();
    if (r)
      try {
        await e.create({ scope: t, text: r, ...w ? { document_id: i } : {} }), N(""), await C();
      } catch (o) {
        S(o instanceof Error ? o.message : String(o));
      }
  };
  return /* @__PURE__ */ n(q, { open: s, onOpenChange: a, title: "记忆", description: "AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。", className: "reader-memory-sheet", children: /* @__PURE__ */ u("div", { className: "reader-memory", children: [
    /* @__PURE__ */ n(
      Q,
      {
        label: "让 AI 使用记忆",
        checked: m ?? !0,
        disabled: m === null,
        onChange: (r) => {
          const o = r.target.checked;
          p(o), e.setEnabled(o).then((d) => p(d.memory_enabled), () => p(!o));
        }
      }
    ),
    m === !1 ? /* @__PURE__ */ n("p", { className: "reader-memory-note", children: "关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。" }) : null,
    /* @__PURE__ */ n(
      j,
      {
        label: "哪一层",
        size: "sm",
        value: t,
        onChange: (r) => h(r),
        options: [
          { value: "user", label: "关于你" },
          { value: "book", label: "这本书", disabled: !i }
        ]
      }
    ),
    /* @__PURE__ */ n(T, { size: "sm", type: "search", placeholder: "搜记忆", value: c, onChange: (r) => b(r.target.value), "aria-label": "搜记忆" }),
    /* @__PURE__ */ u("form", { className: "reader-memory-add", onSubmit: (r) => {
      r.preventDefault(), _();
    }, children: [
      /* @__PURE__ */ n(T, { size: "sm", placeholder: t === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译", value: f, maxLength: 500, onChange: (r) => N(r.target.value), "aria-label": "加一条记忆" }),
      /* @__PURE__ */ n(v, { type: "submit", variant: "secondary", size: "sm", disabled: !f.trim(), children: "记下" })
    ] }),
    y ? /* @__PURE__ */ n("p", { className: "reader-memory-note", "data-tone": "error", children: y }) : null,
    l === null ? null : l.length ? /* @__PURE__ */ n("ul", { className: "reader-memory-list", children: l.map((r) => /* @__PURE__ */ n(Z, { memory: r, port: e, onChanged: () => void C() }, `${r.memory_id}:${r.updated_at}`)) }) : /* @__PURE__ */ n("p", { className: "reader-memory-note", children: c ? "没搜到。" : t === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。" })
  ] }) });
}
function ee({ ask: e }) {
  const i = e.view.conversation;
  return (i == null ? void 0 : i.kind) !== "side" ? null : i.status !== "open" ? /* @__PURE__ */ n("p", { className: "ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ u("div", { className: "ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ n("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ u(v, { className: "ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ n(U, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function te({ ask: e }) {
  const i = e.view.conversation;
  return (i == null ? void 0 : i.kind) !== "side" ? /* @__PURE__ */ n("span", { className: "ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: "主对话" }) : /* @__PURE__ */ u("span", { className: "ask-crumbs", children: [
    /* @__PURE__ */ n(v, { className: "ask-crumb-link", title: "回主对话（副对话留着，之后能回来）", onClick: () => void e.backToMain(), children: "主对话" }),
    /* @__PURE__ */ n(L, { size: 11, "aria-hidden": !0 }),
    /* @__PURE__ */ n("span", { className: "ask-crumb", title: i.title, children: i.title || "副对话" })
  ] });
}
function oe({ port: e, jobId: i, bookTitle: s, book: a, ask: t, onShowSelection: h, onJumpToPage: c, pageCount: b, legacy: l }) {
  const [x, m] = g(!1), p = t.view.conversation, f = l ? null : p ? { id: p.conversation_id, documentId: a.documentId } : null, N = M(() => H(e, i, f), [e, i, f == null ? void 0 : f.id, f == null ? void 0 : f.documentId]), y = l ? null : t.pending, S = M(() => y ? E(y, i, s, G(y, a)) : null, [y, i, s, a]), w = h ? (o) => {
    const d = o.data;
    !(d != null && d.page) || d.document_id && a.documentId && d.document_id !== a.documentId || h({ page: d.page, pane: d.pane === "source" ? "source" : "translated" });
  } : void 0, C = K() || void 0;
  if (l)
    return /* @__PURE__ */ n(
      I,
      {
        port: N,
        context: null,
        title: /* @__PURE__ */ u("span", { className: "ask-crumb", title: "2026-11-26 以前按书存的提问，只能看；新的问题都在主对话里", children: [
          "以前的提问 · 第 ",
          l.anchor.page,
          " 页"
        ] }),
        initialMessages: l.messages,
        readOnly: !0,
        onClose: l.onClose,
        onDelete: l.onDelete,
        onJumpToPage: c,
        pageCount: b,
        katexStylesheetUrl: C
      },
      `legacy:${l.anchor.page}:${l.messages.length}`
    );
  const _ = (p == null ? void 0 : p.kind) === "main", r = e.memories ?? null;
  return /* @__PURE__ */ u($, { children: [
    /* @__PURE__ */ n(
      I,
      {
        port: N,
        context: S,
        onContextUsed: () => t.setPending(null),
        onContextClear: () => t.setPending(null),
        onClose: t.close,
        title: /* @__PURE__ */ n(te, { ask: t }),
        headerActions: /* @__PURE__ */ u($, { children: [
          r ? /* @__PURE__ */ n(v, { className: "ask-icon", "aria-label": "记忆", title: "记忆：AI 记下的、你自己加的（能关掉）", onClick: () => m(!0), children: /* @__PURE__ */ n(D, { size: 14, "aria-hidden": !0 }) }) : null,
          _ && t.persistent ? /* @__PURE__ */ n(v, { className: "ask-icon", "aria-label": "归档主对话", title: "归档这个主对话，开一个新的（归档的还在，记忆不受影响）", onClick: () => void t.archiveMain(), children: /* @__PURE__ */ n(F, { size: 14, "aria-hidden": !0 }) }) : null
        ] }),
        footer: /* @__PURE__ */ u($, { children: [
          t.error ? /* @__PURE__ */ n("p", { className: "ask-error", children: t.error }) : null,
          /* @__PURE__ */ n(ee, { ask: t })
        ] }),
        onShowContext: w,
        initialMessages: t.view.initial,
        earlier: t.view.hasMore ? { loading: t.loading, load: () => void t.loadEarlier() } : null,
        onTurn: t.persistent ? t.onTurn : void 0,
        onFork: _ && t.persistent ? (o) => void t.fork(o) : void 0,
        onOpenSide: t.persistent ? (o) => void t.openSide(o) : void 0,
        onForgetMemory: t.forgetMemory,
        onRewrite: t.persistent ? async (o) => {
          const d = await t.rewrite(o);
          return d ? E(W(d), i, s, { ...d, item_ids: d.item_ids || [] }) : null;
        } : void 0,
        memories: t.notices,
        onJumpToPage: c,
        pageCount: b,
        katexStylesheetUrl: C
      },
      t.view.key
    ),
    r ? /* @__PURE__ */ n(J, { port: r, documentId: a.documentId, open: x, onOpenChange: m }) : null
  ] });
}
export {
  oe as default
};
//# sourceMappingURL=ReaderAskPanel-DuJ8sOEn.js.map
