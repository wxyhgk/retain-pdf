import { jsx as t, jsxs as u, Fragment as M } from "react/jsx-runtime";
import { useState as m, useEffect as k, useCallback as re, useMemo as P } from "react";
import H, { AskHeadMenu as ie, AskHeadMenuItem as L, AskSpinner as Y } from "@retainpdf/ask/window";
import { CornerUpLeft as se, ChevronDown as ae, SquarePen as le, History as oe, Check as de, X, BookPlus as ce, Pencil as ue, Trash2 as me, BookmarkCheck as he } from "lucide-react";
import { Button as $, Sheet as pe, Checkbox as fe, SegmentedControl as ge, Input as E, Select as ve } from "@retainpdf/ui";
import { b as ye, c as W, s as be, r as xe, d as Ne, e as Ce } from "./ReaderApp-dnpKozWm.js";
const Se = 4e3;
function I(e, n = Se) {
  const s = `${e || ""}`.trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
function $e(e, n, s = "") {
  const i = [], r = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return i.push(`我在读${s ? `《${s}》` : "一本书"}，${r}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && i.push("", "我选中的这段：", I(e.selection)), e.sourceText && i.push("", "这一块的原文：", I(e.sourceText)), e.translatedText && i.push("", "这一块的译文：", I(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && i.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), i.push("", `（RetainPDF 任务 ${n}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), i.join(`
`);
}
function Te(e) {
  return e.map((n, s) => {
    const i = [`另外一处（${s + 2}）：第 ${n.page} 页${n.section ? `，「${n.section}」` : ""}（${n.pane === "source" ? "原文" : "译文"}栏）。`];
    return n.selection ? i.push("选中的这段：", I(n.selection)) : (n.sourceText || n.translatedText) && (n.sourceText && i.push("这一块的原文：", I(n.sourceText)), n.translatedText && i.push("这一块的译文：", I(n.translatedText))), n.itemId && i.push(`（块 ${n.itemId}）`), i.join(`
`);
  }).join(`

`);
}
function Q(e, n, s = "", i, r = []) {
  const a = [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · ");
  return {
    page: e.page,
    label: [a, ...r.map((h) => h.page === e.page ? "同页另一段" : `第 ${h.page} 页`)].join(" + "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: $e(e, n, s),
    ...i ? { meta: { retainpdf: { selection: i } } } : {},
    ...r.length ? { extra: Te(r) } : {}
  };
}
function _e(e, n, s) {
  const i = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (r, a) => e.openSession({ ...r, jobId: n, ...s ? { conversationId: s.id } : {} }, a),
    ...s && i ? { conversationPreamble: () => i.contextText(s.id, s.documentId) } : {}
  };
}
const Ae = 36, K = { top: 0, bottom: Ae };
function V(e) {
  return `${e.title && e.title !== "主对话" ? `${e.title} · ` : ""}${e.updated_at.slice(0, 10)}`;
}
function we(e) {
  return (e == null ? void 0 : e.kind) === "main" && e.status === "archived" ? `以前的对话 · ${V(e)}` : (e == null ? void 0 : e.kind) === "side" ? `副对话 · ${e.title || "未命名"}` : "主对话";
}
function Ie({ onArchive: e, close: n }) {
  const [s, i] = m(!1), [r, a] = m(!1);
  return s ? /* @__PURE__ */ u("div", { className: "reader-ask-confirm", role: "group", "aria-label": "确认开新对话", children: [
    /* @__PURE__ */ t("span", { children: "现在这段收起来，开个新的？" }),
    /* @__PURE__ */ u(
      $,
      {
        className: "reader-ask-confirm-yes",
        disabled: r,
        onClick: async () => {
          a(!0);
          try {
            await e(), n();
          } finally {
            a(!1), i(!1);
          }
        },
        children: [
          r ? /* @__PURE__ */ t(Y, {}) : null,
          "开新的"
        ]
      }
    ),
    /* @__PURE__ */ t($, { className: "reader-ask-confirm-no", onClick: () => i(!1), children: "算了" })
  ] }) : /* @__PURE__ */ t(
    L,
    {
      icon: /* @__PURE__ */ t(le, { size: 14, "aria-hidden": !0 }),
      label: "开个新对话",
      hint: "现在这段收进下面「以前的对话」，还能看；AI 记住的不受影响",
      onClick: () => i(!0)
    }
  );
}
function Me({ ask: e, open: n, close: s }) {
  var c;
  const [i, r] = m(null), [a, h] = m("");
  k(() => {
    if (!n) return;
    let o = !1;
    return h(""), e.listArchived().then(
      (f) => !o && r(f),
      (f) => !o && h(f instanceof Error ? f.message : String(f))
    ), () => {
      o = !0;
    };
  }, [n]);
  const p = (c = e.view.conversation) == null ? void 0 : c.conversation_id;
  return /* @__PURE__ */ u("section", { className: "reader-ask-history", "aria-label": "以前的对话", children: [
    /* @__PURE__ */ u("p", { className: "reader-ask-history-head", children: [
      /* @__PURE__ */ t(oe, { size: 12, "aria-hidden": !0 }),
      " 以前的对话"
    ] }),
    a ? /* @__PURE__ */ t("p", { className: "reader-ask-history-note", children: a }) : i === null ? /* @__PURE__ */ t("p", { className: "reader-ask-history-note", children: "在读……" }) : i.length ? i.map((o) => /* @__PURE__ */ t(
      L,
      {
        label: V(o),
        trailing: `${o.message_count} 条`,
        current: o.conversation_id === p,
        onClick: () => {
          s(), e.viewArchived(o);
        }
      },
      o.conversation_id
    )) : /* @__PURE__ */ t("p", { className: "reader-ask-history-note", children: "这本书还没有以前的对话。" })
  ] });
}
function Ee({ ask: e, canArchive: n, canList: s }) {
  const [i, r] = m(!1), a = e.view.conversation, h = we(a), p = !!(a && (a.kind === "side" || a.status === "archived")), c = (a == null ? void 0 : a.kind) === "main" && a.status !== "archived";
  return !e.persistent || !n && !s && !p ? /* @__PURE__ */ t("span", { className: "reader-ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: h }) : /* @__PURE__ */ t(
    ie,
    {
      className: "reader-ask-conversations",
      title: `${h}：开个新对话、看以前的对话`,
      onOpenChange: r,
      label: /* @__PURE__ */ u(M, { children: [
        /* @__PURE__ */ t("span", { className: "reader-ask-crumb", children: h }),
        /* @__PURE__ */ t(ae, { size: 12, "aria-hidden": !0 })
      ] }),
      children: (o) => /* @__PURE__ */ u(M, { children: [
        p ? /* @__PURE__ */ t(
          L,
          {
            icon: /* @__PURE__ */ t(se, { size: 14, "aria-hidden": !0 }),
            label: "回主对话",
            hint: (a == null ? void 0 : a.kind) === "side" ? "这个副对话留着，之后能回来" : "回到这本书现在的这段",
            onClick: () => {
              o(), e.backToMain();
            }
          }
        ) : null,
        c && n ? /* @__PURE__ */ t(Ie, { onArchive: e.archiveMain, close: o }) : null,
        s ? /* @__PURE__ */ t(Me, { ask: e, open: i, close: o }) : null
      ] })
    }
  );
}
const ze = /\s*(?:定译为|定译成|统一译为|统一译成|译为|译成|译作|翻译为|翻译成|→|->|=>|=)\s*/, ke = /\s*[：:]\s*/, Oe = /^[「『“"'《〈（(\s]+|[」』”"'》〉）)\s。．.，,；;！!]+$/g;
function B(e) {
  return e.replace(Oe, "").trim();
}
function Z(e) {
  const n = `${e || ""}`.trim(), s = n.split(ze), [i, ...r] = s.length > 1 ? s : n.split(ke);
  if (!r.length) return { source: B(n), target: "" };
  const a = r.join(" ").split(/[，,；;（(]/)[0] ?? "";
  return { source: B(i ?? ""), target: B(a) };
}
function Re(e) {
  return e.category === "term" || e.scope === "book" && !!Z(e.text).target;
}
const D = "阅读时定的术语", z = "__new__";
function Pe({ memory: e, port: n, onDone: s }) {
  const i = Z(e.text), [r, a] = m(i.source), [h, p] = m(i.target), [c, o] = m(null), [f, C] = m(z), [x, N] = m(!1), [T, g] = m("");
  k(() => {
    let d = !1;
    return n.list().then(
      (v) => {
        var y;
        d || (o(v), C(((y = v.find((l) => l.name === D)) == null ? void 0 : y.id) || z));
      },
      () => !d && o([])
    ), () => {
      d = !0;
    };
  }, [n]);
  const A = async (d) => {
    if (d.preventDefault(), !(!r.trim() || !h.trim())) {
      N(!0), g("");
      try {
        const v = await n.addEntry(f === z ? { name: D } : { id: f }, { source: r.trim(), target: h.trim(), note: "阅读页提问时定的" });
        s(`${v.replaced ? "换掉了" : "加进了"}「${v.name}」。以后翻译时选这张表才用得上。`);
      } catch (v) {
        g(v instanceof Error ? v.message : String(v));
      } finally {
        N(!1);
      }
    }
  };
  return /* @__PURE__ */ u("form", { className: "reader-memory-glossary", onSubmit: (d) => void A(d), children: [
    /* @__PURE__ */ u("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ t(E, { size: "sm", value: r, onChange: (d) => a(d.target.value), "aria-label": "原文", placeholder: "原文", autoFocus: !0 }),
      /* @__PURE__ */ t(E, { size: "sm", value: h, onChange: (d) => p(d.target.value), "aria-label": "译法", placeholder: "译法" })
    ] }),
    /* @__PURE__ */ u("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ u(ve, { size: "sm", value: f, onChange: (d) => C(d.target.value), "aria-label": "加进哪张术语表", disabled: c === null, children: [
        /* @__PURE__ */ u("option", { value: z, children: [
          "新建一张「",
          D,
          "」"
        ] }),
        (c || []).map((d) => /* @__PURE__ */ u("option", { value: d.id, children: [
          d.name,
          "（",
          d.entryCount,
          " 条）"
        ] }, d.id))
      ] }),
      /* @__PURE__ */ t($, { type: "submit", variant: "secondary", size: "sm", disabled: x || !r.trim() || !h.trim() || c === null, children: "加进去" }),
      /* @__PURE__ */ t($, { className: "reader-memory-icon", type: "button", "aria-label": "不加了", title: "不加了", onClick: () => s(""), children: /* @__PURE__ */ t(X, { size: 13, "aria-hidden": !0 }) })
    ] }),
    T ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "error", children: T }) : null
  ] });
}
const Be = {
  preference: "偏好",
  background: "背景",
  style: "回答风格",
  progress: "读到哪",
  term: "术语",
  conclusion: "结论",
  other: "其他"
};
function De({ memory: e, port: n, glossaries: s, onChanged: i }) {
  const [r, a] = m(!1), [h, p] = m(!1), [c, o] = m(""), [f, C] = m(e.text), [x, N] = m(!1), T = async (g) => {
    N(!0);
    try {
      await g(), i();
    } finally {
      N(!1);
    }
  };
  return /* @__PURE__ */ t("li", { className: "reader-memory-row", "data-origin": e.origin, children: r ? /* @__PURE__ */ u(
    "form",
    {
      className: "reader-memory-edit",
      onSubmit: (g) => {
        g.preventDefault(), f.trim() && T(() => n.update(e.memory_id, { text: f.trim() })).then(() => a(!1));
      },
      children: [
        /* @__PURE__ */ t(E, { size: "sm", value: f, maxLength: 500, onChange: (g) => C(g.target.value), "aria-label": "改这条记忆", autoFocus: !0 }),
        /* @__PURE__ */ t($, { className: "reader-memory-icon", type: "submit", "aria-label": "存", title: "存", disabled: x || !f.trim(), children: /* @__PURE__ */ t(de, { size: 13, "aria-hidden": !0 }) }),
        /* @__PURE__ */ t($, { className: "reader-memory-icon", type: "button", "aria-label": "不改了", title: "不改了", onClick: () => {
          C(e.text), a(!1);
        }, children: /* @__PURE__ */ t(X, { size: 13, "aria-hidden": !0 }) })
      ]
    }
  ) : /* @__PURE__ */ u(M, { children: [
    /* @__PURE__ */ t("p", { className: "reader-memory-text", children: e.text }),
    /* @__PURE__ */ u("div", { className: "reader-memory-meta", children: [
      /* @__PURE__ */ t("span", { children: Be[e.category] || e.category }),
      /* @__PURE__ */ t("span", { children: e.origin === "agent" ? "AI 记的" : "你加的" }),
      /* @__PURE__ */ t("span", { children: e.updated_at.slice(0, 10) }),
      e.source_page ? /* @__PURE__ */ u("span", { children: [
        "第 ",
        e.source_page,
        " 页"
      ] }) : null,
      /* @__PURE__ */ t("span", { className: "reader-memory-gap" }),
      s && Re(e) ? /* @__PURE__ */ t($, { className: "reader-memory-icon", "aria-label": "加进术语表", title: "加进术语表：以后翻译选这张表，就按这个译法译", onClick: () => {
        o(""), p((g) => !g);
      }, children: /* @__PURE__ */ t(ce, { size: 12, "aria-hidden": !0 }) }) : null,
      /* @__PURE__ */ t($, { className: "reader-memory-icon", "aria-label": "改", title: "改", onClick: () => a(!0), children: /* @__PURE__ */ t(ue, { size: 12, "aria-hidden": !0 }) }),
      /* @__PURE__ */ t($, { className: "reader-memory-icon", "aria-label": "删", title: "删（它替代的旧条会恢复）", disabled: x, onClick: () => void T(() => n.remove(e.memory_id)), children: /* @__PURE__ */ t(me, { size: 12, "aria-hidden": !0 }) })
    ] }),
    h && s ? /* @__PURE__ */ t(Pe, { memory: e, port: s, onDone: (g) => {
      p(!1), o(g);
    } }) : null,
    c ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "ok", children: c }) : null
  ] }) });
}
function Le({ port: e, glossaries: n, documentId: s, open: i, onOpenChange: r }) {
  const [a, h] = m("user"), [p, c] = m(""), [o, f] = m(null), [C, x] = m(null), [N, T] = m(""), [g, A] = m(""), d = a === "book" && s, v = re(async () => {
    if (a === "book" && !s) return f([]);
    try {
      const l = await e.list({ scope: a, ...d ? { document_id: s } : {}, ...p.trim() ? { q: p.trim() } : {}, limit: 200 });
      f(l), A("");
    } catch (l) {
      A(l instanceof Error ? l.message : String(l));
    }
  }, [e, a, d, s, p]);
  k(() => {
    if (!i) return;
    const l = setTimeout(() => void v(), p ? 250 : 0);
    return () => clearTimeout(l);
  }, [i, v, p]), k(() => {
    i && e.settings().then((l) => x(l.memory_enabled), () => x(null));
  }, [i, e]);
  const y = async () => {
    const l = N.trim();
    if (l)
      try {
        await e.create({ scope: a, text: l, ...d ? { document_id: s } : {} }), T(""), await v();
      } catch (_) {
        A(_ instanceof Error ? _.message : String(_));
      }
  };
  return /* @__PURE__ */ t(pe, { open: i, onOpenChange: r, title: "记忆", description: "AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。", className: "reader-memory-sheet", children: /* @__PURE__ */ u("div", { className: "reader-memory", children: [
    /* @__PURE__ */ t(
      fe,
      {
        label: "让 AI 使用记忆",
        checked: C ?? !0,
        disabled: C === null,
        onChange: (l) => {
          const _ = l.target.checked;
          x(_), e.setEnabled(_).then((w) => x(w.memory_enabled), () => x(!_));
        }
      }
    ),
    C === !1 ? /* @__PURE__ */ t("p", { className: "reader-memory-note", children: "关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。" }) : null,
    /* @__PURE__ */ t(
      ge,
      {
        label: "哪一层",
        size: "sm",
        value: a,
        onChange: (l) => h(l),
        options: [
          { value: "user", label: "关于你" },
          { value: "book", label: "这本书", disabled: !s }
        ]
      }
    ),
    /* @__PURE__ */ t(E, { size: "sm", type: "search", placeholder: "搜记忆", value: p, onChange: (l) => c(l.target.value), "aria-label": "搜记忆" }),
    /* @__PURE__ */ u("form", { className: "reader-memory-add", onSubmit: (l) => {
      l.preventDefault(), y();
    }, children: [
      /* @__PURE__ */ t(E, { size: "sm", placeholder: a === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译", value: N, maxLength: 500, onChange: (l) => T(l.target.value), "aria-label": "加一条记忆" }),
      /* @__PURE__ */ t($, { type: "submit", variant: "secondary", size: "sm", disabled: !N.trim(), children: "记下" })
    ] }),
    g ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "error", children: g }) : null,
    o === null ? null : o.length ? /* @__PURE__ */ t("ul", { className: "reader-memory-list", children: o.map((l) => /* @__PURE__ */ t(De, { memory: l, port: e, glossaries: n, onChanged: () => void v() }, `${l.memory_id}:${l.updated_at}`)) }) : /* @__PURE__ */ t("p", { className: "reader-memory-note", children: p ? "没搜到。" : a === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。" })
  ] }) });
}
function Ue({ ask: e }) {
  const n = e.view.conversation;
  return (n == null ? void 0 : n.kind) !== "side" ? null : n.status !== "open" ? /* @__PURE__ */ t("p", { className: "reader-ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ u("div", { className: "reader-ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ t("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ u($, { className: "reader-ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ t(Y, {}) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function Qe({ port: e, jobId: n, bookTitle: s, book: i, ask: r, onShowSelection: a, onJumpToPage: h, pageCount: p, legacy: c, onLayout: o, dockTaken: f, dockHost: C, onEditBlock: x, canEditBlock: N, attachTools: T, attachRequest: g, contextOffer: A }) {
  var j;
  const [d, v] = m(!1), y = r.view.conversation, l = c ? null : y ? { id: y.conversation_id, documentId: i.documentId } : null, _ = P(() => _e(e, n, l), [e, n, l == null ? void 0 : l.id, l == null ? void 0 : l.documentId]), w = c ? null : r.pending, U = r.extras, J = P(() => w ? Q(w, n, s, ye(w, i), U) : null, [w, n, s, i, U]), ee = a ? (S) => {
    const b = Ce(S);
    !b || b.document_id && i.documentId && b.document_id !== i.documentId || a({ page: b.page, pane: b.pane === "source" ? "source" : "translated" });
  } : void 0, O = i.documentId, te = P(() => x ? {
    label: "改这段译文",
    title: "改问的这段译文：回答里选着一段字就先填进去（不然填回答里的 ```译文 代码块），存之前还能改",
    available: (S) => {
      const b = W(S, O);
      return !!(b && (!N || N(b)));
    },
    run: (S, b) => {
      const q = W(S, O);
      q && x(q, be(b));
    }
  } : void 0, [x, N, O]), F = xe() || void 0;
  if (c)
    return /* @__PURE__ */ t(
      H,
      {
        port: _,
        context: null,
        title: /* @__PURE__ */ u("span", { className: "reader-ask-crumb", title: "2026-11-26 以前按书存的提问，只能看；新的问题都在主对话里", children: [
          "以前的提问 · 第 ",
          c.anchor.page,
          " 页"
        ] }),
        initialMessages: c.messages,
        readOnly: !0,
        onClose: c.onClose,
        onDelete: c.onDelete,
        onJumpToPage: h,
        pageCount: p,
        katexStylesheetUrl: F,
        onLayout: o,
        dockTaken: f,
        dockInsets: K,
        dockHost: C
      },
      `legacy:${c.anchor.page}:${c.messages.length}`
    );
  const G = (y == null ? void 0 : y.kind) === "main" && y.status !== "archived", ne = (y == null ? void 0 : y.kind) === "main" && y.status === "archived", R = e.memories ?? null;
  return /* @__PURE__ */ u(M, { children: [
    /* @__PURE__ */ t(
      H,
      {
        port: _,
        context: J,
        onContextUsed: () => r.setPending(null),
        onContextClear: () => r.setPending(null),
        onClose: r.close,
        readOnly: ne,
        title: /* @__PURE__ */ t(Ee, { ask: r, canArchive: G, canList: !!((j = e.conversations) != null && j.archived) }),
        headerMenu: R ? [{
          key: "memory",
          label: "记忆",
          hint: "AI 记住的关于你和这本书的事，能改、删、关掉",
          icon: /* @__PURE__ */ t(he, { size: 14, "aria-hidden": !0 }),
          onSelect: () => v(!0)
        }] : void 0,
        footer: /* @__PURE__ */ u(M, { children: [
          r.error ? /* @__PURE__ */ t("p", { className: "reader-ask-error", children: r.error }) : null,
          /* @__PURE__ */ t(Ue, { ask: r })
        ] }),
        onShowContext: ee,
        initialMessages: r.view.initial,
        earlier: r.view.hasMore ? { loading: r.loading, load: () => void r.loadEarlier() } : null,
        onTurn: r.persistent ? r.onTurn : void 0,
        onFork: G && r.persistent ? (S) => void r.fork(S) : void 0,
        onOpenSide: r.persistent ? (S) => void r.openSide(S) : void 0,
        onForgetMemory: r.forgetMemory,
        onRewrite: r.persistent ? async (S) => {
          const b = await r.rewrite(S);
          return b ? Q(Ne(b), n, s, { ...b, item_ids: b.item_ids || [] }) : null;
        } : void 0,
        memories: r.notices,
        onJumpToPage: h,
        pageCount: p,
        katexStylesheetUrl: F,
        onLayout: o,
        dockTaken: f,
        dockInsets: K,
        dockHost: C,
        answerAction: te,
        attachTools: T,
        attachRequest: g,
        contextOffer: A
      },
      r.view.key
    ),
    R ? /* @__PURE__ */ t(Le, { port: R, glossaries: e.glossaries, documentId: i.documentId, open: d, onOpenChange: v }) : null
  ] });
}
export {
  Qe as default
};
//# sourceMappingURL=ReaderAskPanel-BdIF494L.js.map
