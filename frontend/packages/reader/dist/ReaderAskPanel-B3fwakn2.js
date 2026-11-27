import { jsx as n, jsxs as o, Fragment as E } from "react/jsx-runtime";
import { useState as m, useCallback as te, useEffect as k, useMemo as B } from "react";
import G from "@retainpdf/ask/window";
import { Check as ne, X as Y, BookPlus as ie, Pencil as se, Trash2 as re, BookmarkCheck as ae, Loader2 as H, History as le, Archive as oe, ChevronRight as W } from "lucide-react";
import { Sheet as ce, Checkbox as de, SegmentedControl as ue, Input as z, Button as y, Select as me } from "@retainpdf/ui";
import { b as he, c as q, s as pe, r as fe, d as ge, e as ve } from "./ReaderApp-BPgzkOcT.js";
const ye = 4e3;
function w(e, t = ye) {
  const r = `${e || ""}`.trim();
  return r.length > t ? `${r.slice(0, t)}…` : r;
}
function be(e, t, r = "") {
  const s = [], i = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return s.push(`我在读${r ? `《${r}》` : "一本书"}，${i}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && s.push("", "我选中的这段：", w(e.selection)), e.sourceText && s.push("", "这一块的原文：", w(e.sourceText)), e.translatedText && s.push("", "这一块的译文：", w(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && s.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), s.push("", `（RetainPDF 任务 ${t}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), s.join(`
`);
}
function Ne(e) {
  return e.map((t, r) => {
    const s = [`另外一处（${r + 2}）：第 ${t.page} 页${t.section ? `，「${t.section}」` : ""}（${t.pane === "source" ? "原文" : "译文"}栏）。`];
    return t.selection ? s.push("选中的这段：", w(t.selection)) : (t.sourceText || t.translatedText) && (t.sourceText && s.push("这一块的原文：", w(t.sourceText)), t.translatedText && s.push("这一块的译文：", w(t.translatedText))), t.itemId && s.push(`（块 ${t.itemId}）`), s.join(`
`);
  }).join(`

`);
}
function Q(e, t, r = "", s, i = []) {
  const l = [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · ");
  return {
    page: e.page,
    label: [l, ...i.map((f) => f.page === e.page ? "同页另一段" : `第 ${f.page} 页`)].join(" + "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: be(e, t, r),
    ...s ? { meta: { retainpdf: { selection: s } } } : {},
    ...i.length ? { extra: Ne(i) } : {}
  };
}
function xe(e, t, r) {
  const s = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (i, l) => e.openSession({ ...i, jobId: t, ...r ? { conversationId: r.id } : {} }, l),
    ...r && s ? { conversationPreamble: () => s.contextText(r.id, r.documentId) } : {}
  };
}
const Ce = /\s*(?:定译为|定译成|统一译为|统一译成|译为|译成|译作|翻译为|翻译成|→|->|=>|=)\s*/, Se = /\s*[：:]\s*/, Te = /^[「『“"'《〈（(\s]+|[」』”"'》〉）)\s。．.，,；;！!]+$/g;
function R(e) {
  return e.replace(Te, "").trim();
}
function K(e) {
  const t = `${e || ""}`.trim(), r = t.split(Ce), [s, ...i] = r.length > 1 ? r : t.split(Se);
  if (!i.length) return { source: R(t), target: "" };
  const l = i.join(" ").split(/[，,；;（(]/)[0] ?? "";
  return { source: R(s ?? ""), target: R(l) };
}
function $e(e) {
  return e.category === "term" || e.scope === "book" && !!K(e.text).target;
}
const D = "阅读时定的术语", M = "__new__";
function _e({ memory: e, port: t, onDone: r }) {
  const s = K(e.text), [i, l] = m(s.source), [f, g] = m(s.target), [h, u] = m(null), [p, x] = m(M), [N, T] = m(!1), [_, v] = m("");
  k(() => {
    let c = !1;
    return t.list().then(
      (d) => {
        var C;
        c || (u(d), x(((C = d.find((a) => a.name === D)) == null ? void 0 : C.id) || M));
      },
      () => !c && u([])
    ), () => {
      c = !0;
    };
  }, [t]);
  const A = async (c) => {
    if (c.preventDefault(), !(!i.trim() || !f.trim())) {
      T(!0), v("");
      try {
        const d = await t.addEntry(p === M ? { name: D } : { id: p }, { source: i.trim(), target: f.trim(), note: "阅读页提问时定的" });
        r(`${d.replaced ? "换掉了" : "加进了"}「${d.name}」。以后翻译时选这张表才用得上。`);
      } catch (d) {
        v(d instanceof Error ? d.message : String(d));
      } finally {
        T(!1);
      }
    }
  };
  return /* @__PURE__ */ o("form", { className: "reader-memory-glossary", onSubmit: (c) => void A(c), children: [
    /* @__PURE__ */ o("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ n(z, { size: "sm", value: i, onChange: (c) => l(c.target.value), "aria-label": "原文", placeholder: "原文", autoFocus: !0 }),
      /* @__PURE__ */ n(z, { size: "sm", value: f, onChange: (c) => g(c.target.value), "aria-label": "译法", placeholder: "译法" })
    ] }),
    /* @__PURE__ */ o("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ o(me, { size: "sm", value: p, onChange: (c) => x(c.target.value), "aria-label": "加进哪张术语表", disabled: h === null, children: [
        /* @__PURE__ */ o("option", { value: M, children: [
          "新建一张「",
          D,
          "」"
        ] }),
        (h || []).map((c) => /* @__PURE__ */ o("option", { value: c.id, children: [
          c.name,
          "（",
          c.entryCount,
          " 条）"
        ] }, c.id))
      ] }),
      /* @__PURE__ */ n(y, { type: "submit", variant: "secondary", size: "sm", disabled: N || !i.trim() || !f.trim() || h === null, children: "加进去" }),
      /* @__PURE__ */ n(y, { className: "reader-memory-icon", type: "button", "aria-label": "不加了", title: "不加了", onClick: () => r(""), children: /* @__PURE__ */ n(Y, { size: 13, "aria-hidden": !0 }) })
    ] }),
    _ ? /* @__PURE__ */ n("p", { className: "reader-memory-note", "data-tone": "error", children: _ }) : null
  ] });
}
const Ae = {
  preference: "偏好",
  background: "背景",
  style: "回答风格",
  progress: "读到哪",
  term: "术语",
  conclusion: "结论",
  other: "其他"
};
function we({ memory: e, port: t, glossaries: r, onChanged: s }) {
  const [i, l] = m(!1), [f, g] = m(!1), [h, u] = m(""), [p, x] = m(e.text), [N, T] = m(!1), _ = async (v) => {
    T(!0);
    try {
      await v(), s();
    } finally {
      T(!1);
    }
  };
  return /* @__PURE__ */ n("li", { className: "reader-memory-row", "data-origin": e.origin, children: i ? /* @__PURE__ */ o(
    "form",
    {
      className: "reader-memory-edit",
      onSubmit: (v) => {
        v.preventDefault(), p.trim() && _(() => t.update(e.memory_id, { text: p.trim() })).then(() => l(!1));
      },
      children: [
        /* @__PURE__ */ n(z, { size: "sm", value: p, maxLength: 500, onChange: (v) => x(v.target.value), "aria-label": "改这条记忆", autoFocus: !0 }),
        /* @__PURE__ */ n(y, { className: "reader-memory-icon", type: "submit", "aria-label": "存", title: "存", disabled: N || !p.trim(), children: /* @__PURE__ */ n(ne, { size: 13, "aria-hidden": !0 }) }),
        /* @__PURE__ */ n(y, { className: "reader-memory-icon", type: "button", "aria-label": "不改了", title: "不改了", onClick: () => {
          x(e.text), l(!1);
        }, children: /* @__PURE__ */ n(Y, { size: 13, "aria-hidden": !0 }) })
      ]
    }
  ) : /* @__PURE__ */ o(E, { children: [
    /* @__PURE__ */ n("p", { className: "reader-memory-text", children: e.text }),
    /* @__PURE__ */ o("div", { className: "reader-memory-meta", children: [
      /* @__PURE__ */ n("span", { children: Ae[e.category] || e.category }),
      /* @__PURE__ */ n("span", { children: e.origin === "agent" ? "AI 记的" : "你加的" }),
      /* @__PURE__ */ n("span", { children: e.updated_at.slice(0, 10) }),
      e.source_page ? /* @__PURE__ */ o("span", { children: [
        "第 ",
        e.source_page,
        " 页"
      ] }) : null,
      /* @__PURE__ */ n("span", { className: "reader-memory-gap" }),
      r && $e(e) ? /* @__PURE__ */ n(y, { className: "reader-memory-icon", "aria-label": "加进术语表", title: "加进术语表：以后翻译选这张表，就按这个译法译", onClick: () => {
        u(""), g((v) => !v);
      }, children: /* @__PURE__ */ n(ie, { size: 12, "aria-hidden": !0 }) }) : null,
      /* @__PURE__ */ n(y, { className: "reader-memory-icon", "aria-label": "改", title: "改", onClick: () => l(!0), children: /* @__PURE__ */ n(se, { size: 12, "aria-hidden": !0 }) }),
      /* @__PURE__ */ n(y, { className: "reader-memory-icon", "aria-label": "删", title: "删（它替代的旧条会恢复）", disabled: N, onClick: () => void _(() => t.remove(e.memory_id)), children: /* @__PURE__ */ n(re, { size: 12, "aria-hidden": !0 }) })
    ] }),
    f && r ? /* @__PURE__ */ n(_e, { memory: e, port: r, onDone: (v) => {
      g(!1), u(v);
    } }) : null,
    h ? /* @__PURE__ */ n("p", { className: "reader-memory-note", "data-tone": "ok", children: h }) : null
  ] }) });
}
function ke({ port: e, glossaries: t, documentId: r, open: s, onOpenChange: i }) {
  const [l, f] = m("user"), [g, h] = m(""), [u, p] = m(null), [x, N] = m(null), [T, _] = m(""), [v, A] = m(""), c = l === "book" && r, d = te(async () => {
    if (l === "book" && !r) return p([]);
    try {
      const a = await e.list({ scope: l, ...c ? { document_id: r } : {}, ...g.trim() ? { q: g.trim() } : {}, limit: 200 });
      p(a), A("");
    } catch (a) {
      A(a instanceof Error ? a.message : String(a));
    }
  }, [e, l, c, r, g]);
  k(() => {
    if (!s) return;
    const a = setTimeout(() => void d(), g ? 250 : 0);
    return () => clearTimeout(a);
  }, [s, d, g]), k(() => {
    s && e.settings().then((a) => N(a.memory_enabled), () => N(null));
  }, [s, e]);
  const C = async () => {
    const a = T.trim();
    if (a)
      try {
        await e.create({ scope: l, text: a, ...c ? { document_id: r } : {} }), _(""), await d();
      } catch (S) {
        A(S instanceof Error ? S.message : String(S));
      }
  };
  return /* @__PURE__ */ n(ce, { open: s, onOpenChange: i, title: "记忆", description: "AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。", className: "reader-memory-sheet", children: /* @__PURE__ */ o("div", { className: "reader-memory", children: [
    /* @__PURE__ */ n(
      de,
      {
        label: "让 AI 使用记忆",
        checked: x ?? !0,
        disabled: x === null,
        onChange: (a) => {
          const S = a.target.checked;
          N(S), e.setEnabled(S).then((I) => N(I.memory_enabled), () => N(!S));
        }
      }
    ),
    x === !1 ? /* @__PURE__ */ n("p", { className: "reader-memory-note", children: "关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。" }) : null,
    /* @__PURE__ */ n(
      ue,
      {
        label: "哪一层",
        size: "sm",
        value: l,
        onChange: (a) => f(a),
        options: [
          { value: "user", label: "关于你" },
          { value: "book", label: "这本书", disabled: !r }
        ]
      }
    ),
    /* @__PURE__ */ n(z, { size: "sm", type: "search", placeholder: "搜记忆", value: g, onChange: (a) => h(a.target.value), "aria-label": "搜记忆" }),
    /* @__PURE__ */ o("form", { className: "reader-memory-add", onSubmit: (a) => {
      a.preventDefault(), C();
    }, children: [
      /* @__PURE__ */ n(z, { size: "sm", placeholder: l === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译", value: T, maxLength: 500, onChange: (a) => _(a.target.value), "aria-label": "加一条记忆" }),
      /* @__PURE__ */ n(y, { type: "submit", variant: "secondary", size: "sm", disabled: !T.trim(), children: "记下" })
    ] }),
    v ? /* @__PURE__ */ n("p", { className: "reader-memory-note", "data-tone": "error", children: v }) : null,
    u === null ? null : u.length ? /* @__PURE__ */ n("ul", { className: "reader-memory-list", children: u.map((a) => /* @__PURE__ */ n(we, { memory: a, port: e, glossaries: t, onChanged: () => void d() }, `${a.memory_id}:${a.updated_at}`)) }) : /* @__PURE__ */ n("p", { className: "reader-memory-note", children: g ? "没搜到。" : l === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。" })
  ] }) });
}
function ze({ ask: e }) {
  const t = e.view.conversation;
  return (t == null ? void 0 : t.kind) !== "side" ? null : t.status !== "open" ? /* @__PURE__ */ n("p", { className: "ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ o("div", { className: "ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ n("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ o(y, { className: "ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ n(H, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function X(e) {
  return `${e.title && e.title !== "主对话" ? `${e.title} · ` : ""}${e.updated_at.slice(0, 10)}`;
}
function Ie({ ask: e }) {
  const t = e.view.conversation;
  return (t == null ? void 0 : t.kind) === "main" && t.status === "archived" ? /* @__PURE__ */ o("span", { className: "ask-crumbs", children: [
    /* @__PURE__ */ n(y, { className: "ask-crumb-link", title: "回这本书现在的主对话", onClick: () => void e.backToMain(), children: "主对话" }),
    /* @__PURE__ */ n(W, { size: 11, "aria-hidden": !0 }),
    /* @__PURE__ */ o("span", { className: "ask-crumb", title: `归档了的主对话，只能看（${t.message_count} 条）`, children: [
      "以前的对话 · ",
      X(t)
    ] })
  ] }) : (t == null ? void 0 : t.kind) !== "side" ? /* @__PURE__ */ n("span", { className: "ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: "主对话" }) : /* @__PURE__ */ o("span", { className: "ask-crumbs", children: [
    /* @__PURE__ */ n(y, { className: "ask-crumb-link", title: "回主对话（副对话留着，之后能回来）", onClick: () => void e.backToMain(), children: "主对话" }),
    /* @__PURE__ */ n(W, { size: 11, "aria-hidden": !0 }),
    /* @__PURE__ */ n("span", { className: "ask-crumb", title: t.title, children: t.title || "副对话" })
  ] });
}
function Me({ onArchive: e }) {
  const [t, r] = m(!1), [s, i] = m(!1);
  return k(() => {
    if (!t) return;
    const l = setTimeout(() => r(!1), 6e3);
    return () => clearTimeout(l);
  }, [t]), t ? /* @__PURE__ */ o("span", { className: "reader-ask-confirm", role: "group", "aria-label": "确认归档", children: [
    /* @__PURE__ */ n("span", { children: "归档并开新的？" }),
    /* @__PURE__ */ o(
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
  ] }) : /* @__PURE__ */ n(y, { className: "ask-icon", "aria-label": "归档主对话", title: "归档这个主对话，开一个新的（归档的在「以前的对话」里还能看，记忆不受影响）", onClick: () => r(!0), children: /* @__PURE__ */ n(oe, { size: 14, "aria-hidden": !0 }) });
}
function Ee({ ask: e }) {
  var h;
  const [t, r] = m(!1), [s, i] = m(null), [l, f] = m("");
  k(() => {
    if (!t) return;
    let u = !1;
    return f(""), e.listArchived().then(
      (p) => !u && i(p),
      (p) => !u && f(p instanceof Error ? p.message : String(p))
    ), () => {
      u = !0;
    };
  }, [t]);
  const g = (h = e.view.conversation) == null ? void 0 : h.conversation_id;
  return /* @__PURE__ */ o("details", { className: "ask-install reader-ask-history", open: t, onToggle: (u) => r(u.currentTarget.open), children: [
    /* @__PURE__ */ n("summary", { className: "ask-icon", "aria-label": "以前的对话", title: "以前的对话：这本书归档了的主对话", children: /* @__PURE__ */ n(le, { size: 14, "aria-hidden": !0 }) }),
    /* @__PURE__ */ n("ul", { children: l ? /* @__PURE__ */ n("li", { className: "reader-ask-history-note", children: l }) : s === null ? /* @__PURE__ */ n("li", { className: "reader-ask-history-note", children: "在读……" }) : s.length ? s.map((u) => /* @__PURE__ */ n("li", { children: /* @__PURE__ */ o(
      y,
      {
        className: "reader-ask-history-item",
        "data-current": u.conversation_id === g ? "true" : void 0,
        onClick: () => {
          r(!1), e.viewArchived(u);
        },
        children: [
          /* @__PURE__ */ n("span", { children: X(u) }),
          /* @__PURE__ */ o("small", { children: [
            u.message_count,
            " 条"
          ] })
        ]
      }
    ) }, u.conversation_id)) : /* @__PURE__ */ n("li", { className: "reader-ask-history-note", children: "这本书还没有归档过的对话。" }) })
  ] });
}
function Fe({ port: e, jobId: t, bookTitle: r, book: s, ask: i, onShowSelection: l, onJumpToPage: f, pageCount: g, legacy: h, onLayout: u, dockTaken: p, onEditBlock: x, canEditBlock: N, attachTools: T, attachRequest: _, contextOffer: v }) {
  var U;
  const [A, c] = m(!1), d = i.view.conversation, C = h ? null : d ? { id: d.conversation_id, documentId: s.documentId } : null, a = B(() => xe(e, t, C), [e, t, C == null ? void 0 : C.id, C == null ? void 0 : C.documentId]), S = h ? null : i.pending, I = i.extras, V = B(() => S ? Q(S, t, r, he(S, s), I) : null, [S, t, r, s, I]), Z = l ? ($) => {
    const b = ve($);
    !b || b.document_id && s.documentId && b.document_id !== s.documentId || l({ page: b.page, pane: b.pane === "source" ? "source" : "translated" });
  } : void 0, O = s.documentId, J = B(() => x ? {
    label: "改这段译文",
    title: "改问的这段译文：回答里选着一段字就先填进去（不然填回答里的 ```译文 代码块），存之前还能改",
    available: ($) => {
      const b = q($, O);
      return !!(b && (!N || N(b)));
    },
    run: ($, b) => {
      const j = q($, O);
      j && x(j, pe(b));
    }
  } : void 0, [x, N, O]), L = fe() || void 0;
  if (h)
    return /* @__PURE__ */ n(
      G,
      {
        port: a,
        context: null,
        title: /* @__PURE__ */ o("span", { className: "ask-crumb", title: "2026-11-26 以前按书存的提问，只能看；新的问题都在主对话里", children: [
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
        onLayout: u,
        dockTaken: p
      },
      `legacy:${h.anchor.page}:${h.messages.length}`
    );
  const F = (d == null ? void 0 : d.kind) === "main" && d.status !== "archived", ee = (d == null ? void 0 : d.kind) === "main" && d.status === "archived", P = e.memories ?? null;
  return /* @__PURE__ */ o(E, { children: [
    /* @__PURE__ */ n(
      G,
      {
        port: a,
        context: V,
        onContextUsed: () => i.setPending(null),
        onContextClear: () => i.setPending(null),
        onClose: i.close,
        readOnly: ee,
        title: /* @__PURE__ */ n(Ie, { ask: i }),
        headerActions: /* @__PURE__ */ o(E, { children: [
          P ? /* @__PURE__ */ n(y, { className: "ask-icon", "aria-label": "记忆", title: "记忆：AI 记下的、你自己加的（能关掉）", onClick: () => c(!0), children: /* @__PURE__ */ n(ae, { size: 14, "aria-hidden": !0 }) }) : null,
          i.persistent && ((U = e.conversations) != null && U.archived) ? /* @__PURE__ */ n(Ee, { ask: i }) : null,
          F && i.persistent ? /* @__PURE__ */ n(Me, { onArchive: i.archiveMain }) : null
        ] }),
        footer: /* @__PURE__ */ o(E, { children: [
          i.error ? /* @__PURE__ */ n("p", { className: "ask-error", children: i.error }) : null,
          /* @__PURE__ */ n(ze, { ask: i })
        ] }),
        onShowContext: Z,
        initialMessages: i.view.initial,
        earlier: i.view.hasMore ? { loading: i.loading, load: () => void i.loadEarlier() } : null,
        onTurn: i.persistent ? i.onTurn : void 0,
        onFork: F && i.persistent ? ($) => void i.fork($) : void 0,
        onOpenSide: i.persistent ? ($) => void i.openSide($) : void 0,
        onForgetMemory: i.forgetMemory,
        onRewrite: i.persistent ? async ($) => {
          const b = await i.rewrite($);
          return b ? Q(ge(b), t, r, { ...b, item_ids: b.item_ids || [] }) : null;
        } : void 0,
        memories: i.notices,
        onJumpToPage: f,
        pageCount: g,
        katexStylesheetUrl: L,
        onLayout: u,
        dockTaken: p,
        answerAction: J,
        attachTools: T,
        attachRequest: _,
        contextOffer: v
      },
      i.view.key
    ),
    P ? /* @__PURE__ */ n(ke, { port: P, glossaries: e.glossaries, documentId: s.documentId, open: A, onOpenChange: c }) : null
  ] });
}
export {
  Fe as default
};
//# sourceMappingURL=ReaderAskPanel-B3fwakn2.js.map
