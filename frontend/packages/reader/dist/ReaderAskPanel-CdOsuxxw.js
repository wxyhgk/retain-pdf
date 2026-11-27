import { jsx as n, jsxs as u, Fragment as _ } from "react/jsx-runtime";
import { useState as g, useCallback as k, useEffect as E, useMemo as z } from "react";
import B from "@retainpdf/ask/window";
import { Check as q, X as L, Pencil as Q, Trash2 as j, BookmarkCheck as G, Archive as K, Loader2 as W, ChevronRight as X } from "lucide-react";
import { Sheet as Y, Checkbox as H, SegmentedControl as V, Input as P, Button as x } from "@retainpdf/ui";
import { b as Z, c as F, s as J, r as ee, d as te, e as ne } from "./ReaderApp-xMiGCGmE.js";
const ie = 4e3;
function M(e, i = ie) {
  const s = `${e || ""}`.trim();
  return s.length > i ? `${s.slice(0, i)}…` : s;
}
function re(e, i, s = "") {
  const a = [], t = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return a.push(`我在读${s ? `《${s}》` : "一本书"}，${t}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && a.push("", "我选中的这段：", M(e.selection)), e.sourceText && a.push("", "这一块的原文：", M(e.sourceText)), e.translatedText && a.push("", "这一块的译文：", M(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && a.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), a.push("", `（RetainPDF 任务 ${i}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), a.join(`
`);
}
function U(e, i, s = "", a) {
  return {
    page: e.page,
    label: [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: re(e, i, s),
    ...a ? { meta: { retainpdf: { selection: a } } } : {}
  };
}
function se(e, i, s) {
  const a = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (t, m) => e.openSession({ ...t, jobId: i, ...s ? { conversationId: s.id } : {} }, m),
    ...s && a ? { conversationPreamble: () => a.contextText(s.id, s.documentId) } : {}
  };
}
const ae = {
  preference: "偏好",
  background: "背景",
  style: "回答风格",
  progress: "读到哪",
  term: "术语",
  conclusion: "结论",
  other: "其他"
};
function le({ memory: e, port: i, onChanged: s }) {
  const [a, t] = g(!1), [m, d] = g(e.text), [N, l] = g(!1), y = async (c) => {
    l(!0);
    try {
      await c(), s();
    } finally {
      l(!1);
    }
  };
  return /* @__PURE__ */ n("li", { className: "reader-memory-row", "data-origin": e.origin, children: a ? /* @__PURE__ */ u(
    "form",
    {
      className: "reader-memory-edit",
      onSubmit: (c) => {
        c.preventDefault(), m.trim() && y(() => i.update(e.memory_id, { text: m.trim() })).then(() => t(!1));
      },
      children: [
        /* @__PURE__ */ n(P, { size: "sm", value: m, maxLength: 500, onChange: (c) => d(c.target.value), "aria-label": "改这条记忆", autoFocus: !0 }),
        /* @__PURE__ */ n(x, { className: "reader-memory-icon", type: "submit", "aria-label": "存", title: "存", disabled: N || !m.trim(), children: /* @__PURE__ */ n(q, { size: 13, "aria-hidden": !0 }) }),
        /* @__PURE__ */ n(x, { className: "reader-memory-icon", type: "button", "aria-label": "不改了", title: "不改了", onClick: () => {
          d(e.text), t(!1);
        }, children: /* @__PURE__ */ n(L, { size: 13, "aria-hidden": !0 }) })
      ]
    }
  ) : /* @__PURE__ */ u(_, { children: [
    /* @__PURE__ */ n("p", { className: "reader-memory-text", children: e.text }),
    /* @__PURE__ */ u("div", { className: "reader-memory-meta", children: [
      /* @__PURE__ */ n("span", { children: ae[e.category] || e.category }),
      /* @__PURE__ */ n("span", { children: e.origin === "agent" ? "AI 记的" : "你加的" }),
      /* @__PURE__ */ n("span", { children: e.updated_at.slice(0, 10) }),
      e.source_page ? /* @__PURE__ */ u("span", { children: [
        "第 ",
        e.source_page,
        " 页"
      ] }) : null,
      /* @__PURE__ */ n("span", { className: "reader-memory-gap" }),
      /* @__PURE__ */ n(x, { className: "reader-memory-icon", "aria-label": "改", title: "改", onClick: () => t(!0), children: /* @__PURE__ */ n(Q, { size: 12, "aria-hidden": !0 }) }),
      /* @__PURE__ */ n(x, { className: "reader-memory-icon", "aria-label": "删", title: "删（它替代的旧条会恢复）", disabled: N, onClick: () => void y(() => i.remove(e.memory_id)), children: /* @__PURE__ */ n(j, { size: 12, "aria-hidden": !0 }) })
    ] })
  ] }) });
}
function oe({ port: e, documentId: i, open: s, onOpenChange: a }) {
  const [t, m] = g("user"), [d, N] = g(""), [l, y] = g(null), [c, v] = g(null), [w, A] = g(""), [C, h] = g(""), S = t === "book" && i, b = k(async () => {
    if (t === "book" && !i) return y([]);
    try {
      const r = await e.list({ scope: t, ...S ? { document_id: i } : {}, ...d.trim() ? { q: d.trim() } : {}, limit: 200 });
      y(r), h("");
    } catch (r) {
      h(r instanceof Error ? r.message : String(r));
    }
  }, [e, t, S, i, d]);
  E(() => {
    if (!s) return;
    const r = setTimeout(() => void b(), d ? 250 : 0);
    return () => clearTimeout(r);
  }, [s, b, d]), E(() => {
    s && e.settings().then((r) => v(r.memory_enabled), () => v(null));
  }, [s, e]);
  const $ = async () => {
    const r = w.trim();
    if (r)
      try {
        await e.create({ scope: t, text: r, ...S ? { document_id: i } : {} }), A(""), await b();
      } catch (p) {
        h(p instanceof Error ? p.message : String(p));
      }
  };
  return /* @__PURE__ */ n(Y, { open: s, onOpenChange: a, title: "记忆", description: "AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。", className: "reader-memory-sheet", children: /* @__PURE__ */ u("div", { className: "reader-memory", children: [
    /* @__PURE__ */ n(
      H,
      {
        label: "让 AI 使用记忆",
        checked: c ?? !0,
        disabled: c === null,
        onChange: (r) => {
          const p = r.target.checked;
          v(p), e.setEnabled(p).then((T) => v(T.memory_enabled), () => v(!p));
        }
      }
    ),
    c === !1 ? /* @__PURE__ */ n("p", { className: "reader-memory-note", children: "关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。" }) : null,
    /* @__PURE__ */ n(
      V,
      {
        label: "哪一层",
        size: "sm",
        value: t,
        onChange: (r) => m(r),
        options: [
          { value: "user", label: "关于你" },
          { value: "book", label: "这本书", disabled: !i }
        ]
      }
    ),
    /* @__PURE__ */ n(P, { size: "sm", type: "search", placeholder: "搜记忆", value: d, onChange: (r) => N(r.target.value), "aria-label": "搜记忆" }),
    /* @__PURE__ */ u("form", { className: "reader-memory-add", onSubmit: (r) => {
      r.preventDefault(), $();
    }, children: [
      /* @__PURE__ */ n(P, { size: "sm", placeholder: t === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译", value: w, maxLength: 500, onChange: (r) => A(r.target.value), "aria-label": "加一条记忆" }),
      /* @__PURE__ */ n(x, { type: "submit", variant: "secondary", size: "sm", disabled: !w.trim(), children: "记下" })
    ] }),
    C ? /* @__PURE__ */ n("p", { className: "reader-memory-note", "data-tone": "error", children: C }) : null,
    l === null ? null : l.length ? /* @__PURE__ */ n("ul", { className: "reader-memory-list", children: l.map((r) => /* @__PURE__ */ n(le, { memory: r, port: e, onChanged: () => void b() }, `${r.memory_id}:${r.updated_at}`)) }) : /* @__PURE__ */ n("p", { className: "reader-memory-note", children: d ? "没搜到。" : t === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。" })
  ] }) });
}
function de({ ask: e }) {
  const i = e.view.conversation;
  return (i == null ? void 0 : i.kind) !== "side" ? null : i.status !== "open" ? /* @__PURE__ */ n("p", { className: "ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ u("div", { className: "ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ n("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ u(x, { className: "ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ n(W, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function ce({ ask: e }) {
  const i = e.view.conversation;
  return (i == null ? void 0 : i.kind) !== "side" ? /* @__PURE__ */ n("span", { className: "ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: "主对话" }) : /* @__PURE__ */ u("span", { className: "ask-crumbs", children: [
    /* @__PURE__ */ n(x, { className: "ask-crumb-link", title: "回主对话（副对话留着，之后能回来）", onClick: () => void e.backToMain(), children: "主对话" }),
    /* @__PURE__ */ n(X, { size: 11, "aria-hidden": !0 }),
    /* @__PURE__ */ n("span", { className: "ask-crumb", title: i.title, children: i.title || "副对话" })
  ] });
}
function ve({ port: e, jobId: i, bookTitle: s, book: a, ask: t, onShowSelection: m, onJumpToPage: d, pageCount: N, legacy: l, onLayout: y, onEditBlock: c, canEditBlock: v }) {
  const [w, A] = g(!1), C = t.view.conversation, h = l ? null : C ? { id: C.conversation_id, documentId: a.documentId } : null, S = z(() => se(e, i, h), [e, i, h == null ? void 0 : h.id, h == null ? void 0 : h.documentId]), b = l ? null : t.pending, $ = z(() => b ? U(b, i, s, Z(b, a)) : null, [b, i, s, a]), r = m ? (f) => {
    const o = ne(f);
    !o || o.document_id && a.documentId && o.document_id !== a.documentId || m({ page: o.page, pane: o.pane === "source" ? "source" : "translated" });
  } : void 0, p = a.documentId, T = z(() => c ? {
    label: "改这段译文",
    title: "改问的这段译文：回答里选着一段字就先填进去（不然填回答里的 ```译文 代码块），存之前还能改",
    available: (f) => {
      const o = F(f, p);
      return !!(o && (!v || v(o)));
    },
    run: (f, o) => {
      const D = F(f, p);
      D && c(D, J(o));
    }
  } : void 0, [c, v, p]), O = ee() || void 0;
  if (l)
    return /* @__PURE__ */ n(
      B,
      {
        port: S,
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
        onJumpToPage: d,
        pageCount: N,
        katexStylesheetUrl: O,
        onLayout: y
      },
      `legacy:${l.anchor.page}:${l.messages.length}`
    );
  const R = (C == null ? void 0 : C.kind) === "main", I = e.memories ?? null;
  return /* @__PURE__ */ u(_, { children: [
    /* @__PURE__ */ n(
      B,
      {
        port: S,
        context: $,
        onContextUsed: () => t.setPending(null),
        onContextClear: () => t.setPending(null),
        onClose: t.close,
        title: /* @__PURE__ */ n(ce, { ask: t }),
        headerActions: /* @__PURE__ */ u(_, { children: [
          I ? /* @__PURE__ */ n(x, { className: "ask-icon", "aria-label": "记忆", title: "记忆：AI 记下的、你自己加的（能关掉）", onClick: () => A(!0), children: /* @__PURE__ */ n(G, { size: 14, "aria-hidden": !0 }) }) : null,
          R && t.persistent ? /* @__PURE__ */ n(x, { className: "ask-icon", "aria-label": "归档主对话", title: "归档这个主对话，开一个新的（归档的还在，记忆不受影响）", onClick: () => void t.archiveMain(), children: /* @__PURE__ */ n(K, { size: 14, "aria-hidden": !0 }) }) : null
        ] }),
        footer: /* @__PURE__ */ u(_, { children: [
          t.error ? /* @__PURE__ */ n("p", { className: "ask-error", children: t.error }) : null,
          /* @__PURE__ */ n(de, { ask: t })
        ] }),
        onShowContext: r,
        initialMessages: t.view.initial,
        earlier: t.view.hasMore ? { loading: t.loading, load: () => void t.loadEarlier() } : null,
        onTurn: t.persistent ? t.onTurn : void 0,
        onFork: R && t.persistent ? (f) => void t.fork(f) : void 0,
        onOpenSide: t.persistent ? (f) => void t.openSide(f) : void 0,
        onForgetMemory: t.forgetMemory,
        onRewrite: t.persistent ? async (f) => {
          const o = await t.rewrite(f);
          return o ? U(te(o), i, s, { ...o, item_ids: o.item_ids || [] }) : null;
        } : void 0,
        memories: t.notices,
        onJumpToPage: d,
        pageCount: N,
        katexStylesheetUrl: O,
        onLayout: y,
        answerAction: T
      },
      t.view.key
    ),
    I ? /* @__PURE__ */ n(oe, { port: I, documentId: a.documentId, open: w, onOpenChange: A }) : null
  ] });
}
export {
  ve as default
};
//# sourceMappingURL=ReaderAskPanel-CdOsuxxw.js.map
