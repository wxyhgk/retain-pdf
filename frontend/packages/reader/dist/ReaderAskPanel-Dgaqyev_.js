import { jsx as r, jsxs as u, Fragment as M } from "react/jsx-runtime";
import { useMemo as C } from "react";
import N from "@retainpdf/ask/window";
import { Archive as b, Loader2 as A, ChevronRight as I } from "lucide-react";
import { Button as v } from "@retainpdf/ui";
import { b as P, r as B } from "./ReaderApp-DMyvMgeZ.js";
const U = 4e3;
function f(e, n = U) {
  const s = `${e || ""}`.trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
function F(e, n, s = "") {
  const i = [], t = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return i.push(`我在读${s ? `《${s}》` : "一本书"}，${t}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && i.push("", "我选中的这段：", f(e.selection)), e.sourceText && i.push("", "这一块的原文：", f(e.sourceText)), e.translatedText && i.push("", "这一块的译文：", f(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && i.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), i.push("", `（RetainPDF 任务 ${n}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), i.join(`
`);
}
function _(e, n, s = "", i) {
  return {
    page: e.page,
    label: [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: F(e, n, s),
    ...i ? { meta: { retainpdf: { selection: i } } } : {}
  };
}
function y(e, n, s) {
  const i = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (t, m) => e.openSession({ ...t, jobId: n, ...s ? { conversationId: s.id } : {} }, m),
    ...s && i ? { conversationPreamble: () => i.contextText(s.id, s.documentId) } : {}
  };
}
function z({ ask: e }) {
  const n = e.view.conversation;
  return (n == null ? void 0 : n.kind) !== "side" ? null : n.status !== "open" ? /* @__PURE__ */ r("p", { className: "ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ u("div", { className: "ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ r("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ u(v, { className: "ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ r(A, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function D({ ask: e }) {
  const n = e.view.conversation;
  return (n == null ? void 0 : n.kind) !== "side" ? /* @__PURE__ */ r("span", { className: "ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: "主对话" }) : /* @__PURE__ */ u("span", { className: "ask-crumbs", children: [
    /* @__PURE__ */ r(v, { className: "ask-crumb-link", title: "回主对话（副对话留着，之后能回来）", onClick: () => void e.backToMain(), children: "主对话" }),
    /* @__PURE__ */ r(I, { size: 11, "aria-hidden": !0 }),
    /* @__PURE__ */ r("span", { className: "ask-crumb", title: n.title, children: n.title || "副对话" })
  ] });
}
function K({ port: e, jobId: n, bookTitle: s, book: i, ask: t, onShowSelection: m, onJumpToPage: g, pageCount: x, legacy: l }) {
  const a = t.view.conversation, o = l ? null : a ? { id: a.conversation_id, documentId: i.documentId } : null, h = C(() => y(e, n, o), [e, n, o == null ? void 0 : o.id, o == null ? void 0 : o.documentId]), p = l ? null : t.pending, T = C(() => p ? _(p, n, s, P(p, i)) : null, [p, n, s, i]), w = m ? (c) => {
    const d = c.data;
    !(d != null && d.page) || d.document_id && i.documentId && d.document_id !== i.documentId || m({ page: d.page, pane: d.pane === "source" ? "source" : "translated" });
  } : void 0, S = B() || void 0;
  if (l)
    return /* @__PURE__ */ r(
      N,
      {
        port: h,
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
        onJumpToPage: g,
        pageCount: x,
        katexStylesheetUrl: S
      },
      `legacy:${l.anchor.page}:${l.messages.length}`
    );
  const $ = (a == null ? void 0 : a.kind) === "main";
  return /* @__PURE__ */ r(
    N,
    {
      port: h,
      context: T,
      onContextUsed: () => t.setPending(null),
      onContextClear: () => t.setPending(null),
      onClose: t.close,
      title: /* @__PURE__ */ r(D, { ask: t }),
      headerActions: $ && t.persistent ? /* @__PURE__ */ r(v, { className: "ask-icon", "aria-label": "归档主对话", title: "归档这个主对话，开一个新的（归档的还在，记忆不受影响）", onClick: () => void t.archiveMain(), children: /* @__PURE__ */ r(b, { size: 14, "aria-hidden": !0 }) }) : null,
      footer: /* @__PURE__ */ u(M, { children: [
        t.error ? /* @__PURE__ */ r("p", { className: "ask-error", children: t.error }) : null,
        /* @__PURE__ */ r(z, { ask: t })
      ] }),
      onShowContext: w,
      initialMessages: t.view.initial,
      earlier: t.view.hasMore ? { loading: t.loading, load: () => void t.loadEarlier() } : null,
      onTurn: t.persistent ? t.onTurn : void 0,
      onFork: $ && t.persistent ? (c) => void t.fork(c) : void 0,
      onOpenSide: t.persistent ? (c) => void t.openSide(c) : void 0,
      onForgetMemory: t.forgetMemory,
      onJumpToPage: g,
      pageCount: x,
      katexStylesheetUrl: S
    },
    t.view.key
  );
}
export {
  K as default
};
//# sourceMappingURL=ReaderAskPanel-Dgaqyev_.js.map
