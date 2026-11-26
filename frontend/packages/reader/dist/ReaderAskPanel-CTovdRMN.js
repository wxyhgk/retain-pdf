import { jsx as t, jsxs as c, Fragment as w } from "react/jsx-runtime";
import { useState as f, useCallback as k, useEffect as z, useMemo as M } from "react";
import I from "@retainpdf/ask/window";
import { Check as E, X as P, Pencil as B, Trash2 as O, BookmarkCheck as D, Archive as R, Loader2 as F, ChevronRight as U } from "lucide-react";
import { Sheet as L, Checkbox as q, SegmentedControl as j, Input as _, Button as v } from "@retainpdf/ui";
import { b as Q, r as G } from "./ReaderApp-WIfbLXhv.js";
const K = 4e3;
function A(e, i = K) {
  const s = `${e || ""}`.trim();
  return s.length > i ? `${s.slice(0, i)}…` : s;
}
function W(e, i, s = "") {
  const a = [], n = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return a.push(`我在读${s ? `《${s}》` : "一本书"}，${n}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && a.push("", "我选中的这段：", A(e.selection)), e.sourceText && a.push("", "这一块的原文：", A(e.sourceText)), e.translatedText && a.push("", "这一块的译文：", A(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && a.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), a.push("", `（RetainPDF 任务 ${i}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), a.join(`
`);
}
function X(e, i, s = "", a) {
  return {
    page: e.page,
    label: [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: W(e, i, s),
    ...a ? { meta: { retainpdf: { selection: a } } } : {}
  };
}
function Y(e, i, s) {
  const a = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (n, m) => e.openSession({ ...n, jobId: i, ...s ? { conversationId: s.id } : {} }, m),
    ...s && a ? { conversationPreamble: () => a.contextText(s.id, s.documentId) } : {}
  };
}
const H = {
  preference: "偏好",
  background: "背景",
  style: "回答风格",
  progress: "读到哪",
  term: "术语",
  conclusion: "结论",
  other: "其他"
};
function V({ memory: e, port: i, onChanged: s }) {
  const [a, n] = f(!1), [m, o] = f(e.text), [b, l] = f(!1), x = async (u) => {
    l(!0);
    try {
      await u(), s();
    } finally {
      l(!1);
    }
  };
  return /* @__PURE__ */ t("li", { className: "reader-memory-row", "data-origin": e.origin, children: a ? /* @__PURE__ */ c(
    "form",
    {
      className: "reader-memory-edit",
      onSubmit: (u) => {
        u.preventDefault(), m.trim() && x(() => i.update(e.memory_id, { text: m.trim() })).then(() => n(!1));
      },
      children: [
        /* @__PURE__ */ t(_, { size: "sm", value: m, maxLength: 500, onChange: (u) => o(u.target.value), "aria-label": "改这条记忆", autoFocus: !0 }),
        /* @__PURE__ */ t(v, { className: "reader-memory-icon", type: "submit", "aria-label": "存", title: "存", disabled: b || !m.trim(), children: /* @__PURE__ */ t(E, { size: 13, "aria-hidden": !0 }) }),
        /* @__PURE__ */ t(v, { className: "reader-memory-icon", type: "button", "aria-label": "不改了", title: "不改了", onClick: () => {
          o(e.text), n(!1);
        }, children: /* @__PURE__ */ t(P, { size: 13, "aria-hidden": !0 }) })
      ]
    }
  ) : /* @__PURE__ */ c(w, { children: [
    /* @__PURE__ */ t("p", { className: "reader-memory-text", children: e.text }),
    /* @__PURE__ */ c("div", { className: "reader-memory-meta", children: [
      /* @__PURE__ */ t("span", { children: H[e.category] || e.category }),
      /* @__PURE__ */ t("span", { children: e.origin === "agent" ? "AI 记的" : "你加的" }),
      /* @__PURE__ */ t("span", { children: e.updated_at.slice(0, 10) }),
      e.source_page ? /* @__PURE__ */ c("span", { children: [
        "第 ",
        e.source_page,
        " 页"
      ] }) : null,
      /* @__PURE__ */ t("span", { className: "reader-memory-gap" }),
      /* @__PURE__ */ t(v, { className: "reader-memory-icon", "aria-label": "改", title: "改", onClick: () => n(!0), children: /* @__PURE__ */ t(B, { size: 12, "aria-hidden": !0 }) }),
      /* @__PURE__ */ t(v, { className: "reader-memory-icon", "aria-label": "删", title: "删（它替代的旧条会恢复）", disabled: b, onClick: () => void x(() => i.remove(e.memory_id)), children: /* @__PURE__ */ t(O, { size: 12, "aria-hidden": !0 }) })
    ] })
  ] }) });
}
function Z({ port: e, documentId: i, open: s, onOpenChange: a }) {
  const [n, m] = f("user"), [o, b] = f(""), [l, x] = f(null), [u, h] = f(null), [p, N] = f(""), [y, S] = f(""), $ = n === "book" && i, C = k(async () => {
    if (n === "book" && !i) return x([]);
    try {
      const r = await e.list({ scope: n, ...$ ? { document_id: i } : {}, ...o.trim() ? { q: o.trim() } : {}, limit: 200 });
      x(r), S("");
    } catch (r) {
      S(r instanceof Error ? r.message : String(r));
    }
  }, [e, n, $, i, o]);
  z(() => {
    if (!s) return;
    const r = setTimeout(() => void C(), o ? 250 : 0);
    return () => clearTimeout(r);
  }, [s, C, o]), z(() => {
    s && e.settings().then((r) => h(r.memory_enabled), () => h(null));
  }, [s, e]);
  const T = async () => {
    const r = p.trim();
    if (r)
      try {
        await e.create({ scope: n, text: r, ...$ ? { document_id: i } : {} }), N(""), await C();
      } catch (d) {
        S(d instanceof Error ? d.message : String(d));
      }
  };
  return /* @__PURE__ */ t(L, { open: s, onOpenChange: a, title: "记忆", description: "AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。", className: "reader-memory-sheet", children: /* @__PURE__ */ c("div", { className: "reader-memory", children: [
    /* @__PURE__ */ t(
      q,
      {
        label: "让 AI 使用记忆",
        checked: u ?? !0,
        disabled: u === null,
        onChange: (r) => {
          const d = r.target.checked;
          h(d), e.setEnabled(d).then((g) => h(g.memory_enabled), () => h(!d));
        }
      }
    ),
    u === !1 ? /* @__PURE__ */ t("p", { className: "reader-memory-note", children: "关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。" }) : null,
    /* @__PURE__ */ t(
      j,
      {
        label: "哪一层",
        size: "sm",
        value: n,
        onChange: (r) => m(r),
        options: [
          { value: "user", label: "关于你" },
          { value: "book", label: "这本书", disabled: !i }
        ]
      }
    ),
    /* @__PURE__ */ t(_, { size: "sm", type: "search", placeholder: "搜记忆", value: o, onChange: (r) => b(r.target.value), "aria-label": "搜记忆" }),
    /* @__PURE__ */ c("form", { className: "reader-memory-add", onSubmit: (r) => {
      r.preventDefault(), T();
    }, children: [
      /* @__PURE__ */ t(_, { size: "sm", placeholder: n === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译", value: p, maxLength: 500, onChange: (r) => N(r.target.value), "aria-label": "加一条记忆" }),
      /* @__PURE__ */ t(v, { type: "submit", variant: "secondary", size: "sm", disabled: !p.trim(), children: "记下" })
    ] }),
    y ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "error", children: y }) : null,
    l === null ? null : l.length ? /* @__PURE__ */ t("ul", { className: "reader-memory-list", children: l.map((r) => /* @__PURE__ */ t(V, { memory: r, port: e, onChanged: () => void C() }, `${r.memory_id}:${r.updated_at}`)) }) : /* @__PURE__ */ t("p", { className: "reader-memory-note", children: o ? "没搜到。" : n === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。" })
  ] }) });
}
function J({ ask: e }) {
  const i = e.view.conversation;
  return (i == null ? void 0 : i.kind) !== "side" ? null : i.status !== "open" ? /* @__PURE__ */ t("p", { className: "ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ c("div", { className: "ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ t("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ c(v, { className: "ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ t(F, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function ee({ ask: e }) {
  const i = e.view.conversation;
  return (i == null ? void 0 : i.kind) !== "side" ? /* @__PURE__ */ t("span", { className: "ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: "主对话" }) : /* @__PURE__ */ c("span", { className: "ask-crumbs", children: [
    /* @__PURE__ */ t(v, { className: "ask-crumb-link", title: "回主对话（副对话留着，之后能回来）", onClick: () => void e.backToMain(), children: "主对话" }),
    /* @__PURE__ */ t(U, { size: 11, "aria-hidden": !0 }),
    /* @__PURE__ */ t("span", { className: "ask-crumb", title: i.title, children: i.title || "副对话" })
  ] });
}
function le({ port: e, jobId: i, bookTitle: s, book: a, ask: n, onShowSelection: m, onJumpToPage: o, pageCount: b, legacy: l }) {
  const [x, u] = f(!1), h = n.view.conversation, p = l ? null : h ? { id: h.conversation_id, documentId: a.documentId } : null, N = M(() => Y(e, i, p), [e, i, p == null ? void 0 : p.id, p == null ? void 0 : p.documentId]), y = l ? null : n.pending, S = M(() => y ? X(y, i, s, Q(y, a)) : null, [y, i, s, a]), $ = m ? (d) => {
    const g = d.data;
    !(g != null && g.page) || g.document_id && a.documentId && g.document_id !== a.documentId || m({ page: g.page, pane: g.pane === "source" ? "source" : "translated" });
  } : void 0, C = G() || void 0;
  if (l)
    return /* @__PURE__ */ t(
      I,
      {
        port: N,
        context: null,
        title: /* @__PURE__ */ c("span", { className: "ask-crumb", title: "2026-11-26 以前按书存的提问，只能看；新的问题都在主对话里", children: [
          "以前的提问 · 第 ",
          l.anchor.page,
          " 页"
        ] }),
        initialMessages: l.messages,
        readOnly: !0,
        onClose: l.onClose,
        onDelete: l.onDelete,
        onJumpToPage: o,
        pageCount: b,
        katexStylesheetUrl: C
      },
      `legacy:${l.anchor.page}:${l.messages.length}`
    );
  const T = (h == null ? void 0 : h.kind) === "main", r = e.memories ?? null;
  return /* @__PURE__ */ c(w, { children: [
    /* @__PURE__ */ t(
      I,
      {
        port: N,
        context: S,
        onContextUsed: () => n.setPending(null),
        onContextClear: () => n.setPending(null),
        onClose: n.close,
        title: /* @__PURE__ */ t(ee, { ask: n }),
        headerActions: /* @__PURE__ */ c(w, { children: [
          r ? /* @__PURE__ */ t(v, { className: "ask-icon", "aria-label": "记忆", title: "记忆：AI 记下的、你自己加的（能关掉）", onClick: () => u(!0), children: /* @__PURE__ */ t(D, { size: 14, "aria-hidden": !0 }) }) : null,
          T && n.persistent ? /* @__PURE__ */ t(v, { className: "ask-icon", "aria-label": "归档主对话", title: "归档这个主对话，开一个新的（归档的还在，记忆不受影响）", onClick: () => void n.archiveMain(), children: /* @__PURE__ */ t(R, { size: 14, "aria-hidden": !0 }) }) : null
        ] }),
        footer: /* @__PURE__ */ c(w, { children: [
          n.error ? /* @__PURE__ */ t("p", { className: "ask-error", children: n.error }) : null,
          /* @__PURE__ */ t(J, { ask: n })
        ] }),
        onShowContext: $,
        initialMessages: n.view.initial,
        earlier: n.view.hasMore ? { loading: n.loading, load: () => void n.loadEarlier() } : null,
        onTurn: n.persistent ? n.onTurn : void 0,
        onFork: T && n.persistent ? (d) => void n.fork(d) : void 0,
        onOpenSide: n.persistent ? (d) => void n.openSide(d) : void 0,
        onForgetMemory: n.forgetMemory,
        onJumpToPage: o,
        pageCount: b,
        katexStylesheetUrl: C
      },
      n.view.key
    ),
    r ? /* @__PURE__ */ t(Z, { port: r, documentId: a.documentId, open: x, onOpenChange: u }) : null
  ] });
}
export {
  le as default
};
//# sourceMappingURL=ReaderAskPanel-CTovdRMN.js.map
