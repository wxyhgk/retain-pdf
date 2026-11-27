import { jsx as n, jsxs as c, Fragment as M } from "react/jsx-runtime";
import { useState as u, useCallback as ee, useEffect as k, useMemo as B } from "react";
import G from "@retainpdf/ask/window";
import { Check as te, X as Y, BookPlus as ne, Pencil as ie, Trash2 as se, BookmarkCheck as re, Loader2 as H, History as ae, Archive as le, ChevronRight as W } from "lucide-react";
import { Sheet as oe, Checkbox as ce, SegmentedControl as de, Input as z, Button as y, Select as ue } from "@retainpdf/ui";
import { b as me, c as q, s as he, r as pe, d as fe, e as ge } from "./ReaderApp-B9ihuFsK.js";
const ve = 4e3;
function w(e, t = ve) {
  const r = `${e || ""}`.trim();
  return r.length > t ? `${r.slice(0, t)}…` : r;
}
function ye(e, t, r = "") {
  const s = [], i = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return s.push(`我在读${r ? `《${r}》` : "一本书"}，${i}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && s.push("", "我选中的这段：", w(e.selection)), e.sourceText && s.push("", "这一块的原文：", w(e.sourceText)), e.translatedText && s.push("", "这一块的译文：", w(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && s.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), s.push("", `（RetainPDF 任务 ${t}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), s.join(`
`);
}
function be(e) {
  return e.map((t, r) => {
    const s = [`另外一处（${r + 2}）：第 ${t.page} 页${t.section ? `，「${t.section}」` : ""}（${t.pane === "source" ? "原文" : "译文"}栏）。`];
    return t.selection ? s.push("选中的这段：", w(t.selection)) : (t.sourceText || t.translatedText) && (t.sourceText && s.push("这一块的原文：", w(t.sourceText)), t.translatedText && s.push("这一块的译文：", w(t.translatedText))), t.itemId && s.push(`（块 ${t.itemId}）`), s.join(`
`);
  }).join(`

`);
}
function Q(e, t, r = "", s, i = []) {
  const o = [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · ");
  return {
    page: e.page,
    label: [o, ...i.map((f) => f.page === e.page ? "同页另一段" : `第 ${f.page} 页`)].join(" + "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: ye(e, t, r),
    ...s ? { meta: { retainpdf: { selection: s } } } : {},
    ...i.length ? { extra: be(i) } : {}
  };
}
function Ne(e, t, r) {
  const s = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (i, o) => e.openSession({ ...i, jobId: t, ...r ? { conversationId: r.id } : {} }, o),
    ...r && s ? { conversationPreamble: () => s.contextText(r.id, r.documentId) } : {}
  };
}
const xe = /\s*(?:定译为|定译成|统一译为|统一译成|译为|译成|译作|翻译为|翻译成|→|->|=>|=)\s*/, Ce = /\s*[：:]\s*/, Se = /^[「『“"'《〈（(\s]+|[」』”"'》〉）)\s。．.，,；;！!]+$/g;
function R(e) {
  return e.replace(Se, "").trim();
}
function K(e) {
  const t = `${e || ""}`.trim(), r = t.split(xe), [s, ...i] = r.length > 1 ? r : t.split(Ce);
  if (!i.length) return { source: R(t), target: "" };
  const o = i.join(" ").split(/[，,；;（(]/)[0] ?? "";
  return { source: R(s ?? ""), target: R(o) };
}
function Te(e) {
  return e.category === "term" || e.scope === "book" && !!K(e.text).target;
}
const D = "阅读时定的术语", I = "__new__";
function $e({ memory: e, port: t, onDone: r }) {
  const s = K(e.text), [i, o] = u(s.source), [f, g] = u(s.target), [h, d] = u(null), [p, N] = u(I), [x, C] = u(!1), [T, v] = u("");
  k(() => {
    let a = !1;
    return t.list().then(
      (m) => {
        var A;
        a || (d(m), N(((A = m.find((l) => l.name === D)) == null ? void 0 : A.id) || I));
      },
      () => !a && d([])
    ), () => {
      a = !0;
    };
  }, [t]);
  const _ = async (a) => {
    if (a.preventDefault(), !(!i.trim() || !f.trim())) {
      C(!0), v("");
      try {
        const m = await t.addEntry(p === I ? { name: D } : { id: p }, { source: i.trim(), target: f.trim(), note: "阅读页提问时定的" });
        r(`${m.replaced ? "换掉了" : "加进了"}「${m.name}」。以后翻译时选这张表才用得上。`);
      } catch (m) {
        v(m instanceof Error ? m.message : String(m));
      } finally {
        C(!1);
      }
    }
  };
  return /* @__PURE__ */ c("form", { className: "reader-memory-glossary", onSubmit: (a) => void _(a), children: [
    /* @__PURE__ */ c("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ n(z, { size: "sm", value: i, onChange: (a) => o(a.target.value), "aria-label": "原文", placeholder: "原文", autoFocus: !0 }),
      /* @__PURE__ */ n(z, { size: "sm", value: f, onChange: (a) => g(a.target.value), "aria-label": "译法", placeholder: "译法" })
    ] }),
    /* @__PURE__ */ c("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ c(ue, { size: "sm", value: p, onChange: (a) => N(a.target.value), "aria-label": "加进哪张术语表", disabled: h === null, children: [
        /* @__PURE__ */ c("option", { value: I, children: [
          "新建一张「",
          D,
          "」"
        ] }),
        (h || []).map((a) => /* @__PURE__ */ c("option", { value: a.id, children: [
          a.name,
          "（",
          a.entryCount,
          " 条）"
        ] }, a.id))
      ] }),
      /* @__PURE__ */ n(y, { type: "submit", variant: "secondary", size: "sm", disabled: x || !i.trim() || !f.trim() || h === null, children: "加进去" }),
      /* @__PURE__ */ n(y, { className: "reader-memory-icon", type: "button", "aria-label": "不加了", title: "不加了", onClick: () => r(""), children: /* @__PURE__ */ n(Y, { size: 13, "aria-hidden": !0 }) })
    ] }),
    T ? /* @__PURE__ */ n("p", { className: "reader-memory-note", "data-tone": "error", children: T }) : null
  ] });
}
const _e = {
  preference: "偏好",
  background: "背景",
  style: "回答风格",
  progress: "读到哪",
  term: "术语",
  conclusion: "结论",
  other: "其他"
};
function Ae({ memory: e, port: t, glossaries: r, onChanged: s }) {
  const [i, o] = u(!1), [f, g] = u(!1), [h, d] = u(""), [p, N] = u(e.text), [x, C] = u(!1), T = async (v) => {
    C(!0);
    try {
      await v(), s();
    } finally {
      C(!1);
    }
  };
  return /* @__PURE__ */ n("li", { className: "reader-memory-row", "data-origin": e.origin, children: i ? /* @__PURE__ */ c(
    "form",
    {
      className: "reader-memory-edit",
      onSubmit: (v) => {
        v.preventDefault(), p.trim() && T(() => t.update(e.memory_id, { text: p.trim() })).then(() => o(!1));
      },
      children: [
        /* @__PURE__ */ n(z, { size: "sm", value: p, maxLength: 500, onChange: (v) => N(v.target.value), "aria-label": "改这条记忆", autoFocus: !0 }),
        /* @__PURE__ */ n(y, { className: "reader-memory-icon", type: "submit", "aria-label": "存", title: "存", disabled: x || !p.trim(), children: /* @__PURE__ */ n(te, { size: 13, "aria-hidden": !0 }) }),
        /* @__PURE__ */ n(y, { className: "reader-memory-icon", type: "button", "aria-label": "不改了", title: "不改了", onClick: () => {
          N(e.text), o(!1);
        }, children: /* @__PURE__ */ n(Y, { size: 13, "aria-hidden": !0 }) })
      ]
    }
  ) : /* @__PURE__ */ c(M, { children: [
    /* @__PURE__ */ n("p", { className: "reader-memory-text", children: e.text }),
    /* @__PURE__ */ c("div", { className: "reader-memory-meta", children: [
      /* @__PURE__ */ n("span", { children: _e[e.category] || e.category }),
      /* @__PURE__ */ n("span", { children: e.origin === "agent" ? "AI 记的" : "你加的" }),
      /* @__PURE__ */ n("span", { children: e.updated_at.slice(0, 10) }),
      e.source_page ? /* @__PURE__ */ c("span", { children: [
        "第 ",
        e.source_page,
        " 页"
      ] }) : null,
      /* @__PURE__ */ n("span", { className: "reader-memory-gap" }),
      r && Te(e) ? /* @__PURE__ */ n(y, { className: "reader-memory-icon", "aria-label": "加进术语表", title: "加进术语表：以后翻译选这张表，就按这个译法译", onClick: () => {
        d(""), g((v) => !v);
      }, children: /* @__PURE__ */ n(ne, { size: 12, "aria-hidden": !0 }) }) : null,
      /* @__PURE__ */ n(y, { className: "reader-memory-icon", "aria-label": "改", title: "改", onClick: () => o(!0), children: /* @__PURE__ */ n(ie, { size: 12, "aria-hidden": !0 }) }),
      /* @__PURE__ */ n(y, { className: "reader-memory-icon", "aria-label": "删", title: "删（它替代的旧条会恢复）", disabled: x, onClick: () => void T(() => t.remove(e.memory_id)), children: /* @__PURE__ */ n(se, { size: 12, "aria-hidden": !0 }) })
    ] }),
    f && r ? /* @__PURE__ */ n($e, { memory: e, port: r, onDone: (v) => {
      g(!1), d(v);
    } }) : null,
    h ? /* @__PURE__ */ n("p", { className: "reader-memory-note", "data-tone": "ok", children: h }) : null
  ] }) });
}
function we({ port: e, glossaries: t, documentId: r, open: s, onOpenChange: i }) {
  const [o, f] = u("user"), [g, h] = u(""), [d, p] = u(null), [N, x] = u(null), [C, T] = u(""), [v, _] = u(""), a = o === "book" && r, m = ee(async () => {
    if (o === "book" && !r) return p([]);
    try {
      const l = await e.list({ scope: o, ...a ? { document_id: r } : {}, ...g.trim() ? { q: g.trim() } : {}, limit: 200 });
      p(l), _("");
    } catch (l) {
      _(l instanceof Error ? l.message : String(l));
    }
  }, [e, o, a, r, g]);
  k(() => {
    if (!s) return;
    const l = setTimeout(() => void m(), g ? 250 : 0);
    return () => clearTimeout(l);
  }, [s, m, g]), k(() => {
    s && e.settings().then((l) => x(l.memory_enabled), () => x(null));
  }, [s, e]);
  const A = async () => {
    const l = C.trim();
    if (l)
      try {
        await e.create({ scope: o, text: l, ...a ? { document_id: r } : {} }), T(""), await m();
      } catch ($) {
        _($ instanceof Error ? $.message : String($));
      }
  };
  return /* @__PURE__ */ n(oe, { open: s, onOpenChange: i, title: "记忆", description: "AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。", className: "reader-memory-sheet", children: /* @__PURE__ */ c("div", { className: "reader-memory", children: [
    /* @__PURE__ */ n(
      ce,
      {
        label: "让 AI 使用记忆",
        checked: N ?? !0,
        disabled: N === null,
        onChange: (l) => {
          const $ = l.target.checked;
          x($), e.setEnabled($).then((E) => x(E.memory_enabled), () => x(!$));
        }
      }
    ),
    N === !1 ? /* @__PURE__ */ n("p", { className: "reader-memory-note", children: "关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。" }) : null,
    /* @__PURE__ */ n(
      de,
      {
        label: "哪一层",
        size: "sm",
        value: o,
        onChange: (l) => f(l),
        options: [
          { value: "user", label: "关于你" },
          { value: "book", label: "这本书", disabled: !r }
        ]
      }
    ),
    /* @__PURE__ */ n(z, { size: "sm", type: "search", placeholder: "搜记忆", value: g, onChange: (l) => h(l.target.value), "aria-label": "搜记忆" }),
    /* @__PURE__ */ c("form", { className: "reader-memory-add", onSubmit: (l) => {
      l.preventDefault(), A();
    }, children: [
      /* @__PURE__ */ n(z, { size: "sm", placeholder: o === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译", value: C, maxLength: 500, onChange: (l) => T(l.target.value), "aria-label": "加一条记忆" }),
      /* @__PURE__ */ n(y, { type: "submit", variant: "secondary", size: "sm", disabled: !C.trim(), children: "记下" })
    ] }),
    v ? /* @__PURE__ */ n("p", { className: "reader-memory-note", "data-tone": "error", children: v }) : null,
    d === null ? null : d.length ? /* @__PURE__ */ n("ul", { className: "reader-memory-list", children: d.map((l) => /* @__PURE__ */ n(Ae, { memory: l, port: e, glossaries: t, onChanged: () => void m() }, `${l.memory_id}:${l.updated_at}`)) }) : /* @__PURE__ */ n("p", { className: "reader-memory-note", children: g ? "没搜到。" : o === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。" })
  ] }) });
}
function ke({ ask: e }) {
  const t = e.view.conversation;
  return (t == null ? void 0 : t.kind) !== "side" ? null : t.status !== "open" ? /* @__PURE__ */ n("p", { className: "ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ c("div", { className: "ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ n("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ c(y, { className: "ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ n(H, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function X(e) {
  return `${e.title && e.title !== "主对话" ? `${e.title} · ` : ""}${e.updated_at.slice(0, 10)}`;
}
function ze({ ask: e }) {
  const t = e.view.conversation;
  return (t == null ? void 0 : t.kind) === "main" && t.status === "archived" ? /* @__PURE__ */ c("span", { className: "ask-crumbs", children: [
    /* @__PURE__ */ n(y, { className: "ask-crumb-link", title: "回这本书现在的主对话", onClick: () => void e.backToMain(), children: "主对话" }),
    /* @__PURE__ */ n(W, { size: 11, "aria-hidden": !0 }),
    /* @__PURE__ */ c("span", { className: "ask-crumb", title: `归档了的主对话，只能看（${t.message_count} 条）`, children: [
      "以前的对话 · ",
      X(t)
    ] })
  ] }) : (t == null ? void 0 : t.kind) !== "side" ? /* @__PURE__ */ n("span", { className: "ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: "主对话" }) : /* @__PURE__ */ c("span", { className: "ask-crumbs", children: [
    /* @__PURE__ */ n(y, { className: "ask-crumb-link", title: "回主对话（副对话留着，之后能回来）", onClick: () => void e.backToMain(), children: "主对话" }),
    /* @__PURE__ */ n(W, { size: 11, "aria-hidden": !0 }),
    /* @__PURE__ */ n("span", { className: "ask-crumb", title: t.title, children: t.title || "副对话" })
  ] });
}
function Ie({ onArchive: e }) {
  const [t, r] = u(!1), [s, i] = u(!1);
  return k(() => {
    if (!t) return;
    const o = setTimeout(() => r(!1), 6e3);
    return () => clearTimeout(o);
  }, [t]), t ? /* @__PURE__ */ c("span", { className: "reader-ask-confirm", role: "group", "aria-label": "确认归档", children: [
    /* @__PURE__ */ n("span", { children: "归档并开新的？" }),
    /* @__PURE__ */ c(
      y,
      {
        className: "reader-ask-confirm-yes",
        disabled: s,
        onClick: async () => {
          i(!0);
          try {
            await e();
          } finally {
            i(!1), r(!1);
          }
        },
        children: [
          s ? /* @__PURE__ */ n(H, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
          "归档"
        ]
      }
    ),
    /* @__PURE__ */ n(y, { className: "reader-ask-confirm-no", onClick: () => r(!1), children: "取消" })
  ] }) : /* @__PURE__ */ n(y, { className: "ask-icon", "aria-label": "归档主对话", title: "归档这个主对话，开一个新的（归档的在「以前的对话」里还能看，记忆不受影响）", onClick: () => r(!0), children: /* @__PURE__ */ n(le, { size: 14, "aria-hidden": !0 }) });
}
function Me({ ask: e }) {
  var h;
  const [t, r] = u(!1), [s, i] = u(null), [o, f] = u("");
  k(() => {
    if (!t) return;
    let d = !1;
    return f(""), e.listArchived().then(
      (p) => !d && i(p),
      (p) => !d && f(p instanceof Error ? p.message : String(p))
    ), () => {
      d = !0;
    };
  }, [t]);
  const g = (h = e.view.conversation) == null ? void 0 : h.conversation_id;
  return /* @__PURE__ */ c("details", { className: "ask-install reader-ask-history", open: t, onToggle: (d) => r(d.currentTarget.open), children: [
    /* @__PURE__ */ n("summary", { className: "ask-icon", "aria-label": "以前的对话", title: "以前的对话：这本书归档了的主对话", children: /* @__PURE__ */ n(ae, { size: 14, "aria-hidden": !0 }) }),
    /* @__PURE__ */ n("ul", { children: o ? /* @__PURE__ */ n("li", { className: "reader-ask-history-note", children: o }) : s === null ? /* @__PURE__ */ n("li", { className: "reader-ask-history-note", children: "在读……" }) : s.length ? s.map((d) => /* @__PURE__ */ n("li", { children: /* @__PURE__ */ c(
      y,
      {
        className: "reader-ask-history-item",
        "data-current": d.conversation_id === g ? "true" : void 0,
        onClick: () => {
          r(!1), e.viewArchived(d);
        },
        children: [
          /* @__PURE__ */ n("span", { children: X(d) }),
          /* @__PURE__ */ c("small", { children: [
            d.message_count,
            " 条"
          ] })
        ]
      }
    ) }, d.conversation_id)) : /* @__PURE__ */ n("li", { className: "reader-ask-history-note", children: "这本书还没有归档过的对话。" }) })
  ] });
}
function Le({ port: e, jobId: t, bookTitle: r, book: s, ask: i, onShowSelection: o, onJumpToPage: f, pageCount: g, legacy: h, onLayout: d, onEditBlock: p, canEditBlock: N, attachTools: x, attachRequest: C, contextOffer: T }) {
  var U;
  const [v, _] = u(!1), a = i.view.conversation, m = h ? null : a ? { id: a.conversation_id, documentId: s.documentId } : null, A = B(() => Ne(e, t, m), [e, t, m == null ? void 0 : m.id, m == null ? void 0 : m.documentId]), l = h ? null : i.pending, $ = i.extras, E = B(() => l ? Q(l, t, r, me(l, s), $) : null, [l, t, r, s, $]), V = o ? (S) => {
    const b = ge(S);
    !b || b.document_id && s.documentId && b.document_id !== s.documentId || o({ page: b.page, pane: b.pane === "source" ? "source" : "translated" });
  } : void 0, O = s.documentId, Z = B(() => p ? {
    label: "改这段译文",
    title: "改问的这段译文：回答里选着一段字就先填进去（不然填回答里的 ```译文 代码块），存之前还能改",
    available: (S) => {
      const b = q(S, O);
      return !!(b && (!N || N(b)));
    },
    run: (S, b) => {
      const j = q(S, O);
      j && p(j, he(b));
    }
  } : void 0, [p, N, O]), L = pe() || void 0;
  if (h)
    return /* @__PURE__ */ n(
      G,
      {
        port: A,
        context: null,
        title: /* @__PURE__ */ c("span", { className: "ask-crumb", title: "2026-11-26 以前按书存的提问，只能看；新的问题都在主对话里", children: [
          "以前的提问 · 第 ",
          h.anchor.page,
          " 页"
        ] }),
        initialMessages: h.messages,
        readOnly: !0,
        onClose: h.onClose,
        onDelete: h.onDelete,
        onJumpToPage: f,
        pageCount: g,
        katexStylesheetUrl: L,
        onLayout: d
      },
      `legacy:${h.anchor.page}:${h.messages.length}`
    );
  const F = (a == null ? void 0 : a.kind) === "main" && a.status !== "archived", J = (a == null ? void 0 : a.kind) === "main" && a.status === "archived", P = e.memories ?? null;
  return /* @__PURE__ */ c(M, { children: [
    /* @__PURE__ */ n(
      G,
      {
        port: A,
        context: E,
        onContextUsed: () => i.setPending(null),
        onContextClear: () => i.setPending(null),
        onClose: i.close,
        readOnly: J,
        title: /* @__PURE__ */ n(ze, { ask: i }),
        headerActions: /* @__PURE__ */ c(M, { children: [
          P ? /* @__PURE__ */ n(y, { className: "ask-icon", "aria-label": "记忆", title: "记忆：AI 记下的、你自己加的（能关掉）", onClick: () => _(!0), children: /* @__PURE__ */ n(re, { size: 14, "aria-hidden": !0 }) }) : null,
          i.persistent && ((U = e.conversations) != null && U.archived) ? /* @__PURE__ */ n(Me, { ask: i }) : null,
          F && i.persistent ? /* @__PURE__ */ n(Ie, { onArchive: i.archiveMain }) : null
        ] }),
        footer: /* @__PURE__ */ c(M, { children: [
          i.error ? /* @__PURE__ */ n("p", { className: "ask-error", children: i.error }) : null,
          /* @__PURE__ */ n(ke, { ask: i })
        ] }),
        onShowContext: V,
        initialMessages: i.view.initial,
        earlier: i.view.hasMore ? { loading: i.loading, load: () => void i.loadEarlier() } : null,
        onTurn: i.persistent ? i.onTurn : void 0,
        onFork: F && i.persistent ? (S) => void i.fork(S) : void 0,
        onOpenSide: i.persistent ? (S) => void i.openSide(S) : void 0,
        onForgetMemory: i.forgetMemory,
        onRewrite: i.persistent ? async (S) => {
          const b = await i.rewrite(S);
          return b ? Q(fe(b), t, r, { ...b, item_ids: b.item_ids || [] }) : null;
        } : void 0,
        memories: i.notices,
        onJumpToPage: f,
        pageCount: g,
        katexStylesheetUrl: L,
        onLayout: d,
        answerAction: Z,
        attachTools: x,
        attachRequest: C,
        contextOffer: T
      },
      i.view.key
    ),
    P ? /* @__PURE__ */ n(we, { port: P, glossaries: e.glossaries, documentId: s.documentId, open: v, onOpenChange: _ }) : null
  ] });
}
export {
  Le as default
};
//# sourceMappingURL=ReaderAskPanel-Dd49SUS2.js.map
