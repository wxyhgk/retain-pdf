import { jsx as n, jsxs as d, Fragment as M } from "react/jsx-runtime";
import { useState as m, useCallback as X, useEffect as D, useMemo as R } from "react";
import G from "@retainpdf/ask/window";
import { Check as H, X as q, BookPlus as V, Pencil as Z, Trash2 as J, BookmarkCheck as ee, Archive as te, Loader2 as ne, ChevronRight as ie } from "lucide-react";
import { Sheet as re, Checkbox as se, SegmentedControl as ae, Input as z, Button as N, Select as le } from "@retainpdf/ui";
import { b as oe, c as L, s as ce, r as de, d as ue, e as me } from "./ReaderApp-Cm0fjd1Y.js";
const pe = 4e3;
function A(e, t = pe) {
  const s = `${e || ""}`.trim();
  return s.length > t ? `${s.slice(0, t)}…` : s;
}
function ge(e, t, s = "") {
  const r = [], i = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return r.push(`我在读${s ? `《${s}》` : "一本书"}，${i}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && r.push("", "我选中的这段：", A(e.selection)), e.sourceText && r.push("", "这一块的原文：", A(e.sourceText)), e.translatedText && r.push("", "这一块的译文：", A(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && r.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), r.push("", `（RetainPDF 任务 ${t}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), r.join(`
`);
}
function fe(e) {
  return e.map((t, s) => {
    const r = [`另外一处（${s + 2}）：第 ${t.page} 页${t.section ? `，「${t.section}」` : ""}（${t.pane === "source" ? "原文" : "译文"}栏）。`];
    return t.selection ? r.push("选中的这段：", A(t.selection)) : (t.sourceText || t.translatedText) && (t.sourceText && r.push("这一块的原文：", A(t.sourceText)), t.translatedText && r.push("这一块的译文：", A(t.translatedText))), t.itemId && r.push(`（块 ${t.itemId}）`), r.join(`
`);
  }).join(`

`);
}
function W(e, t, s = "", r, i = []) {
  const o = [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · ");
  return {
    page: e.page,
    label: [o, ...i.map((v) => v.page === e.page ? "同页另一段" : `第 ${v.page} 页`)].join(" + "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: ge(e, t, s),
    ...r ? { meta: { retainpdf: { selection: r } } } : {},
    ...i.length ? { extra: fe(i) } : {}
  };
}
function he(e, t, s) {
  const r = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (i, o) => e.openSession({ ...i, jobId: t, ...s ? { conversationId: s.id } : {} }, o),
    ...s && r ? { conversationPreamble: () => r.contextText(s.id, s.documentId) } : {}
  };
}
const ve = /\s*(?:定译为|定译成|统一译为|统一译成|译为|译成|译作|翻译为|翻译成|→|->|=>|=)\s*/, ye = /\s*[：:]\s*/, be = /^[「『“"'《〈（(\s]+|[」』”"'》〉）)\s。．.，,；;！!]+$/g;
function B(e) {
  return e.replace(be, "").trim();
}
function Q(e) {
  const t = `${e || ""}`.trim(), s = t.split(ve), [r, ...i] = s.length > 1 ? s : t.split(ye);
  if (!i.length) return { source: B(t), target: "" };
  const o = i.join(" ").split(/[，,；;（(]/)[0] ?? "";
  return { source: B(r ?? ""), target: B(o) };
}
function xe(e) {
  return e.category === "term" || e.scope === "book" && !!Q(e.text).target;
}
const k = "阅读时定的术语", I = "__new__";
function Ne({ memory: e, port: t, onDone: s }) {
  const r = Q(e.text), [i, o] = m(r.source), [v, g] = m(r.target), [u, b] = m(null), [f, y] = m(I), [x, C] = m(!1), [T, p] = m("");
  D(() => {
    let l = !1;
    return t.list().then(
      (c) => {
        var w;
        l || (b(c), y(((w = c.find((a) => a.name === k)) == null ? void 0 : w.id) || I));
      },
      () => !l && b([])
    ), () => {
      l = !0;
    };
  }, [t]);
  const _ = async (l) => {
    if (l.preventDefault(), !(!i.trim() || !v.trim())) {
      C(!0), p("");
      try {
        const c = await t.addEntry(f === I ? { name: k } : { id: f }, { source: i.trim(), target: v.trim(), note: "阅读页提问时定的" });
        s(`${c.replaced ? "换掉了" : "加进了"}「${c.name}」。以后翻译时选这张表才用得上。`);
      } catch (c) {
        p(c instanceof Error ? c.message : String(c));
      } finally {
        C(!1);
      }
    }
  };
  return /* @__PURE__ */ d("form", { className: "reader-memory-glossary", onSubmit: (l) => void _(l), children: [
    /* @__PURE__ */ d("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ n(z, { size: "sm", value: i, onChange: (l) => o(l.target.value), "aria-label": "原文", placeholder: "原文", autoFocus: !0 }),
      /* @__PURE__ */ n(z, { size: "sm", value: v, onChange: (l) => g(l.target.value), "aria-label": "译法", placeholder: "译法" })
    ] }),
    /* @__PURE__ */ d("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ d(le, { size: "sm", value: f, onChange: (l) => y(l.target.value), "aria-label": "加进哪张术语表", disabled: u === null, children: [
        /* @__PURE__ */ d("option", { value: I, children: [
          "新建一张「",
          k,
          "」"
        ] }),
        (u || []).map((l) => /* @__PURE__ */ d("option", { value: l.id, children: [
          l.name,
          "（",
          l.entryCount,
          " 条）"
        ] }, l.id))
      ] }),
      /* @__PURE__ */ n(N, { type: "submit", variant: "secondary", size: "sm", disabled: x || !i.trim() || !v.trim() || u === null, children: "加进去" }),
      /* @__PURE__ */ n(N, { className: "reader-memory-icon", type: "button", "aria-label": "不加了", title: "不加了", onClick: () => s(""), children: /* @__PURE__ */ n(q, { size: 13, "aria-hidden": !0 }) })
    ] }),
    T ? /* @__PURE__ */ n("p", { className: "reader-memory-note", "data-tone": "error", children: T }) : null
  ] });
}
const Ce = {
  preference: "偏好",
  background: "背景",
  style: "回答风格",
  progress: "读到哪",
  term: "术语",
  conclusion: "结论",
  other: "其他"
};
function Se({ memory: e, port: t, glossaries: s, onChanged: r }) {
  const [i, o] = m(!1), [v, g] = m(!1), [u, b] = m(""), [f, y] = m(e.text), [x, C] = m(!1), T = async (p) => {
    C(!0);
    try {
      await p(), r();
    } finally {
      C(!1);
    }
  };
  return /* @__PURE__ */ n("li", { className: "reader-memory-row", "data-origin": e.origin, children: i ? /* @__PURE__ */ d(
    "form",
    {
      className: "reader-memory-edit",
      onSubmit: (p) => {
        p.preventDefault(), f.trim() && T(() => t.update(e.memory_id, { text: f.trim() })).then(() => o(!1));
      },
      children: [
        /* @__PURE__ */ n(z, { size: "sm", value: f, maxLength: 500, onChange: (p) => y(p.target.value), "aria-label": "改这条记忆", autoFocus: !0 }),
        /* @__PURE__ */ n(N, { className: "reader-memory-icon", type: "submit", "aria-label": "存", title: "存", disabled: x || !f.trim(), children: /* @__PURE__ */ n(H, { size: 13, "aria-hidden": !0 }) }),
        /* @__PURE__ */ n(N, { className: "reader-memory-icon", type: "button", "aria-label": "不改了", title: "不改了", onClick: () => {
          y(e.text), o(!1);
        }, children: /* @__PURE__ */ n(q, { size: 13, "aria-hidden": !0 }) })
      ]
    }
  ) : /* @__PURE__ */ d(M, { children: [
    /* @__PURE__ */ n("p", { className: "reader-memory-text", children: e.text }),
    /* @__PURE__ */ d("div", { className: "reader-memory-meta", children: [
      /* @__PURE__ */ n("span", { children: Ce[e.category] || e.category }),
      /* @__PURE__ */ n("span", { children: e.origin === "agent" ? "AI 记的" : "你加的" }),
      /* @__PURE__ */ n("span", { children: e.updated_at.slice(0, 10) }),
      e.source_page ? /* @__PURE__ */ d("span", { children: [
        "第 ",
        e.source_page,
        " 页"
      ] }) : null,
      /* @__PURE__ */ n("span", { className: "reader-memory-gap" }),
      s && xe(e) ? /* @__PURE__ */ n(N, { className: "reader-memory-icon", "aria-label": "加进术语表", title: "加进术语表：以后翻译选这张表，就按这个译法译", onClick: () => {
        b(""), g((p) => !p);
      }, children: /* @__PURE__ */ n(V, { size: 12, "aria-hidden": !0 }) }) : null,
      /* @__PURE__ */ n(N, { className: "reader-memory-icon", "aria-label": "改", title: "改", onClick: () => o(!0), children: /* @__PURE__ */ n(Z, { size: 12, "aria-hidden": !0 }) }),
      /* @__PURE__ */ n(N, { className: "reader-memory-icon", "aria-label": "删", title: "删（它替代的旧条会恢复）", disabled: x, onClick: () => void T(() => t.remove(e.memory_id)), children: /* @__PURE__ */ n(J, { size: 12, "aria-hidden": !0 }) })
    ] }),
    v && s ? /* @__PURE__ */ n(Ne, { memory: e, port: s, onDone: (p) => {
      g(!1), b(p);
    } }) : null,
    u ? /* @__PURE__ */ n("p", { className: "reader-memory-note", "data-tone": "ok", children: u }) : null
  ] }) });
}
function Te({ port: e, glossaries: t, documentId: s, open: r, onOpenChange: i }) {
  const [o, v] = m("user"), [g, u] = m(""), [b, f] = m(null), [y, x] = m(null), [C, T] = m(""), [p, _] = m(""), l = o === "book" && s, c = X(async () => {
    if (o === "book" && !s) return f([]);
    try {
      const a = await e.list({ scope: o, ...l ? { document_id: s } : {}, ...g.trim() ? { q: g.trim() } : {}, limit: 200 });
      f(a), _("");
    } catch (a) {
      _(a instanceof Error ? a.message : String(a));
    }
  }, [e, o, l, s, g]);
  D(() => {
    if (!r) return;
    const a = setTimeout(() => void c(), g ? 250 : 0);
    return () => clearTimeout(a);
  }, [r, c, g]), D(() => {
    r && e.settings().then((a) => x(a.memory_enabled), () => x(null));
  }, [r, e]);
  const w = async () => {
    const a = C.trim();
    if (a)
      try {
        await e.create({ scope: o, text: a, ...l ? { document_id: s } : {} }), T(""), await c();
      } catch ($) {
        _($ instanceof Error ? $.message : String($));
      }
  };
  return /* @__PURE__ */ n(re, { open: r, onOpenChange: i, title: "记忆", description: "AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。", className: "reader-memory-sheet", children: /* @__PURE__ */ d("div", { className: "reader-memory", children: [
    /* @__PURE__ */ n(
      se,
      {
        label: "让 AI 使用记忆",
        checked: y ?? !0,
        disabled: y === null,
        onChange: (a) => {
          const $ = a.target.checked;
          x($), e.setEnabled($).then((E) => x(E.memory_enabled), () => x(!$));
        }
      }
    ),
    y === !1 ? /* @__PURE__ */ n("p", { className: "reader-memory-note", children: "关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。" }) : null,
    /* @__PURE__ */ n(
      ae,
      {
        label: "哪一层",
        size: "sm",
        value: o,
        onChange: (a) => v(a),
        options: [
          { value: "user", label: "关于你" },
          { value: "book", label: "这本书", disabled: !s }
        ]
      }
    ),
    /* @__PURE__ */ n(z, { size: "sm", type: "search", placeholder: "搜记忆", value: g, onChange: (a) => u(a.target.value), "aria-label": "搜记忆" }),
    /* @__PURE__ */ d("form", { className: "reader-memory-add", onSubmit: (a) => {
      a.preventDefault(), w();
    }, children: [
      /* @__PURE__ */ n(z, { size: "sm", placeholder: o === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译", value: C, maxLength: 500, onChange: (a) => T(a.target.value), "aria-label": "加一条记忆" }),
      /* @__PURE__ */ n(N, { type: "submit", variant: "secondary", size: "sm", disabled: !C.trim(), children: "记下" })
    ] }),
    p ? /* @__PURE__ */ n("p", { className: "reader-memory-note", "data-tone": "error", children: p }) : null,
    b === null ? null : b.length ? /* @__PURE__ */ n("ul", { className: "reader-memory-list", children: b.map((a) => /* @__PURE__ */ n(Se, { memory: a, port: e, glossaries: t, onChanged: () => void c() }, `${a.memory_id}:${a.updated_at}`)) }) : /* @__PURE__ */ n("p", { className: "reader-memory-note", children: g ? "没搜到。" : o === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。" })
  ] }) });
}
function $e({ ask: e }) {
  const t = e.view.conversation;
  return (t == null ? void 0 : t.kind) !== "side" ? null : t.status !== "open" ? /* @__PURE__ */ n("p", { className: "ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ d("div", { className: "ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ n("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ d(N, { className: "ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ n(ne, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function _e({ ask: e }) {
  const t = e.view.conversation;
  return (t == null ? void 0 : t.kind) !== "side" ? /* @__PURE__ */ n("span", { className: "ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: "主对话" }) : /* @__PURE__ */ d("span", { className: "ask-crumbs", children: [
    /* @__PURE__ */ n(N, { className: "ask-crumb-link", title: "回主对话（副对话留着，之后能回来）", onClick: () => void e.backToMain(), children: "主对话" }),
    /* @__PURE__ */ n(ie, { size: 11, "aria-hidden": !0 }),
    /* @__PURE__ */ n("span", { className: "ask-crumb", title: t.title, children: t.title || "副对话" })
  ] });
}
function Oe({ port: e, jobId: t, bookTitle: s, book: r, ask: i, onShowSelection: o, onJumpToPage: v, pageCount: g, legacy: u, onLayout: b, onEditBlock: f, canEditBlock: y, attachTools: x, attachRequest: C, contextOffer: T }) {
  const [p, _] = m(!1), l = i.view.conversation, c = u ? null : l ? { id: l.conversation_id, documentId: r.documentId } : null, w = R(() => he(e, t, c), [e, t, c == null ? void 0 : c.id, c == null ? void 0 : c.documentId]), a = u ? null : i.pending, $ = i.extras, E = R(() => a ? W(a, t, s, oe(a, r), $) : null, [a, t, s, r, $]), Y = o ? (S) => {
    const h = me(S);
    !h || h.document_id && r.documentId && h.document_id !== r.documentId || o({ page: h.page, pane: h.pane === "source" ? "source" : "translated" });
  } : void 0, O = r.documentId, K = R(() => f ? {
    label: "改这段译文",
    title: "改问的这段译文：回答里选着一段字就先填进去（不然填回答里的 ```译文 代码块），存之前还能改",
    available: (S) => {
      const h = L(S, O);
      return !!(h && (!y || y(h)));
    },
    run: (S, h) => {
      const j = L(S, O);
      j && f(j, ce(h));
    }
  } : void 0, [f, y, O]), F = de() || void 0;
  if (u)
    return /* @__PURE__ */ n(
      G,
      {
        port: w,
        context: null,
        title: /* @__PURE__ */ d("span", { className: "ask-crumb", title: "2026-11-26 以前按书存的提问，只能看；新的问题都在主对话里", children: [
          "以前的提问 · 第 ",
          u.anchor.page,
          " 页"
        ] }),
        initialMessages: u.messages,
        readOnly: !0,
        onClose: u.onClose,
        onDelete: u.onDelete,
        onJumpToPage: v,
        pageCount: g,
        katexStylesheetUrl: F,
        onLayout: b
      },
      `legacy:${u.anchor.page}:${u.messages.length}`
    );
  const U = (l == null ? void 0 : l.kind) === "main", P = e.memories ?? null;
  return /* @__PURE__ */ d(M, { children: [
    /* @__PURE__ */ n(
      G,
      {
        port: w,
        context: E,
        onContextUsed: () => i.setPending(null),
        onContextClear: () => i.setPending(null),
        onClose: i.close,
        title: /* @__PURE__ */ n(_e, { ask: i }),
        headerActions: /* @__PURE__ */ d(M, { children: [
          P ? /* @__PURE__ */ n(N, { className: "ask-icon", "aria-label": "记忆", title: "记忆：AI 记下的、你自己加的（能关掉）", onClick: () => _(!0), children: /* @__PURE__ */ n(ee, { size: 14, "aria-hidden": !0 }) }) : null,
          U && i.persistent ? /* @__PURE__ */ n(N, { className: "ask-icon", "aria-label": "归档主对话", title: "归档这个主对话，开一个新的（归档的还在，记忆不受影响）", onClick: () => void i.archiveMain(), children: /* @__PURE__ */ n(te, { size: 14, "aria-hidden": !0 }) }) : null
        ] }),
        footer: /* @__PURE__ */ d(M, { children: [
          i.error ? /* @__PURE__ */ n("p", { className: "ask-error", children: i.error }) : null,
          /* @__PURE__ */ n($e, { ask: i })
        ] }),
        onShowContext: Y,
        initialMessages: i.view.initial,
        earlier: i.view.hasMore ? { loading: i.loading, load: () => void i.loadEarlier() } : null,
        onTurn: i.persistent ? i.onTurn : void 0,
        onFork: U && i.persistent ? (S) => void i.fork(S) : void 0,
        onOpenSide: i.persistent ? (S) => void i.openSide(S) : void 0,
        onForgetMemory: i.forgetMemory,
        onRewrite: i.persistent ? async (S) => {
          const h = await i.rewrite(S);
          return h ? W(ue(h), t, s, { ...h, item_ids: h.item_ids || [] }) : null;
        } : void 0,
        memories: i.notices,
        onJumpToPage: v,
        pageCount: g,
        katexStylesheetUrl: F,
        onLayout: b,
        answerAction: K,
        attachTools: x,
        attachRequest: C,
        contextOffer: T
      },
      i.view.key
    ),
    P ? /* @__PURE__ */ n(Te, { port: P, glossaries: e.glossaries, documentId: r.documentId, open: p, onOpenChange: _ }) : null
  ] });
}
export {
  Oe as default
};
//# sourceMappingURL=ReaderAskPanel-DdA1HOUk.js.map
