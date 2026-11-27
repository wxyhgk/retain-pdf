import { jsx as t, jsxs as m, Fragment as I } from "react/jsx-runtime";
import { useState as h, useEffect as k, useCallback as ne, useMemo as P } from "react";
import j, { AskHeadMenu as re, AskHeadMenuItem as L, AskSpinner as K } from "@retainpdf/ask/window";
import { CornerUpLeft as se, ChevronDown as ie, SquarePen as ae, History as le, Check as oe, X as Y, BookPlus as de, Pencil as ce, Trash2 as ue, BookmarkCheck as me } from "lucide-react";
import { Button as T, Sheet as he, Checkbox as pe, SegmentedControl as fe, Input as E, Select as ge } from "@retainpdf/ui";
import { b as ve, c as q, s as ye, r as be, d as xe, e as Ne } from "./ReaderApp-Cz-__yte.js";
const Ce = 4e3;
function w(e, n = Ce) {
  const i = `${e || ""}`.trim();
  return i.length > n ? `${i.slice(0, n)}…` : i;
}
function Se(e, n, i = "") {
  const s = [], r = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return s.push(`我在读${i ? `《${i}》` : "一本书"}，${r}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && s.push("", "我选中的这段：", w(e.selection)), e.sourceText && s.push("", "这一块的原文：", w(e.sourceText)), e.translatedText && s.push("", "这一块的译文：", w(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && s.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), s.push("", `（RetainPDF 任务 ${n}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), s.join(`
`);
}
function $e(e) {
  return e.map((n, i) => {
    const s = [`另外一处（${i + 2}）：第 ${n.page} 页${n.section ? `，「${n.section}」` : ""}（${n.pane === "source" ? "原文" : "译文"}栏）。`];
    return n.selection ? s.push("选中的这段：", w(n.selection)) : (n.sourceText || n.translatedText) && (n.sourceText && s.push("这一块的原文：", w(n.sourceText)), n.translatedText && s.push("这一块的译文：", w(n.translatedText))), n.itemId && s.push(`（块 ${n.itemId}）`), s.join(`
`);
  }).join(`

`);
}
function W(e, n, i = "", s, r = []) {
  const a = [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · ");
  return {
    page: e.page,
    label: [a, ...r.map((p) => p.page === e.page ? "同页另一段" : `第 ${p.page} 页`)].join(" + "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: Se(e, n, i),
    ...s ? { meta: { retainpdf: { selection: s } } } : {},
    ...r.length ? { extra: $e(r) } : {}
  };
}
function Te(e, n, i) {
  const s = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (r, a) => e.openSession({ ...r, jobId: n, ...i ? { conversationId: i.id } : {} }, a),
    ...i && s ? { conversationPreamble: () => s.contextText(i.id, i.documentId) } : {}
  };
}
const _e = 54, Ae = 36, Q = { top: _e, bottom: Ae };
function X(e) {
  return `${e.title && e.title !== "主对话" ? `${e.title} · ` : ""}${e.updated_at.slice(0, 10)}`;
}
function we(e) {
  return (e == null ? void 0 : e.kind) === "main" && e.status === "archived" ? `以前的对话 · ${X(e)}` : (e == null ? void 0 : e.kind) === "side" ? `副对话 · ${e.title || "未命名"}` : "主对话";
}
function Ie({ onArchive: e, close: n }) {
  const [i, s] = h(!1), [r, a] = h(!1);
  return i ? /* @__PURE__ */ m("div", { className: "reader-ask-confirm", role: "group", "aria-label": "确认开新对话", children: [
    /* @__PURE__ */ t("span", { children: "现在这段收起来，开个新的？" }),
    /* @__PURE__ */ m(
      T,
      {
        className: "reader-ask-confirm-yes",
        disabled: r,
        onClick: async () => {
          a(!0);
          try {
            await e(), n();
          } finally {
            a(!1), s(!1);
          }
        },
        children: [
          r ? /* @__PURE__ */ t(K, {}) : null,
          "开新的"
        ]
      }
    ),
    /* @__PURE__ */ t(T, { className: "reader-ask-confirm-no", onClick: () => s(!1), children: "算了" })
  ] }) : /* @__PURE__ */ t(
    L,
    {
      icon: /* @__PURE__ */ t(ae, { size: 14, "aria-hidden": !0 }),
      label: "开个新对话",
      hint: "现在这段收进下面「以前的对话」，还能看；AI 记住的不受影响",
      onClick: () => s(!0)
    }
  );
}
function Ee({ ask: e, open: n, close: i }) {
  var u;
  const [s, r] = h(null), [a, p] = h("");
  k(() => {
    if (!n) return;
    let o = !1;
    return p(""), e.listArchived().then(
      (g) => !o && r(g),
      (g) => !o && p(g instanceof Error ? g.message : String(g))
    ), () => {
      o = !0;
    };
  }, [n]);
  const f = (u = e.view.conversation) == null ? void 0 : u.conversation_id;
  return /* @__PURE__ */ m("section", { className: "reader-ask-history", "aria-label": "以前的对话", children: [
    /* @__PURE__ */ m("p", { className: "reader-ask-history-head", children: [
      /* @__PURE__ */ t(le, { size: 12, "aria-hidden": !0 }),
      " 以前的对话"
    ] }),
    a ? /* @__PURE__ */ t("p", { className: "reader-ask-history-note", children: a }) : s === null ? /* @__PURE__ */ t("p", { className: "reader-ask-history-note", children: "在读……" }) : s.length ? s.map((o) => /* @__PURE__ */ t(
      L,
      {
        label: X(o),
        trailing: `${o.message_count} 条`,
        current: o.conversation_id === f,
        onClick: () => {
          i(), e.viewArchived(o);
        }
      },
      o.conversation_id
    )) : /* @__PURE__ */ t("p", { className: "reader-ask-history-note", children: "这本书还没有以前的对话。" })
  ] });
}
function Me({ ask: e, canArchive: n, canList: i }) {
  const [s, r] = h(!1), a = e.view.conversation, p = we(a), f = !!(a && (a.kind === "side" || a.status === "archived")), u = (a == null ? void 0 : a.kind) === "main" && a.status !== "archived";
  return !e.persistent || !n && !i && !f ? /* @__PURE__ */ t("span", { className: "reader-ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: p }) : /* @__PURE__ */ t(
    re,
    {
      className: "reader-ask-conversations",
      title: `${p}：开个新对话、看以前的对话`,
      onOpenChange: r,
      label: /* @__PURE__ */ m(I, { children: [
        /* @__PURE__ */ t("span", { className: "reader-ask-crumb", children: p }),
        /* @__PURE__ */ t(ie, { size: 12, "aria-hidden": !0 })
      ] }),
      children: (o) => /* @__PURE__ */ m(I, { children: [
        f ? /* @__PURE__ */ t(
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
        u && n ? /* @__PURE__ */ t(Ie, { onArchive: e.archiveMain, close: o }) : null,
        i ? /* @__PURE__ */ t(Ee, { ask: e, open: s, close: o }) : null
      ] })
    }
  );
}
const ze = /\s*(?:定译为|定译成|统一译为|统一译成|译为|译成|译作|翻译为|翻译成|→|->|=>|=)\s*/, ke = /\s*[：:]\s*/, Oe = /^[「『“"'《〈（(\s]+|[」』”"'》〉）)\s。．.，,；;！!]+$/g;
function B(e) {
  return e.replace(Oe, "").trim();
}
function V(e) {
  const n = `${e || ""}`.trim(), i = n.split(ze), [s, ...r] = i.length > 1 ? i : n.split(ke);
  if (!r.length) return { source: B(n), target: "" };
  const a = r.join(" ").split(/[，,；;（(]/)[0] ?? "";
  return { source: B(s ?? ""), target: B(a) };
}
function Re(e) {
  return e.category === "term" || e.scope === "book" && !!V(e.text).target;
}
const D = "阅读时定的术语", z = "__new__";
function Pe({ memory: e, port: n, onDone: i }) {
  const s = V(e.text), [r, a] = h(s.source), [p, f] = h(s.target), [u, o] = h(null), [g, x] = h(z), [b, S] = h(!1), [_, v] = h("");
  k(() => {
    let d = !1;
    return n.list().then(
      (c) => {
        var N;
        d || (o(c), x(((N = c.find((l) => l.name === D)) == null ? void 0 : N.id) || z));
      },
      () => !d && o([])
    ), () => {
      d = !0;
    };
  }, [n]);
  const A = async (d) => {
    if (d.preventDefault(), !(!r.trim() || !p.trim())) {
      S(!0), v("");
      try {
        const c = await n.addEntry(g === z ? { name: D } : { id: g }, { source: r.trim(), target: p.trim(), note: "阅读页提问时定的" });
        i(`${c.replaced ? "换掉了" : "加进了"}「${c.name}」。以后翻译时选这张表才用得上。`);
      } catch (c) {
        v(c instanceof Error ? c.message : String(c));
      } finally {
        S(!1);
      }
    }
  };
  return /* @__PURE__ */ m("form", { className: "reader-memory-glossary", onSubmit: (d) => void A(d), children: [
    /* @__PURE__ */ m("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ t(E, { size: "sm", value: r, onChange: (d) => a(d.target.value), "aria-label": "原文", placeholder: "原文", autoFocus: !0 }),
      /* @__PURE__ */ t(E, { size: "sm", value: p, onChange: (d) => f(d.target.value), "aria-label": "译法", placeholder: "译法" })
    ] }),
    /* @__PURE__ */ m("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ m(ge, { size: "sm", value: g, onChange: (d) => x(d.target.value), "aria-label": "加进哪张术语表", disabled: u === null, children: [
        /* @__PURE__ */ m("option", { value: z, children: [
          "新建一张「",
          D,
          "」"
        ] }),
        (u || []).map((d) => /* @__PURE__ */ m("option", { value: d.id, children: [
          d.name,
          "（",
          d.entryCount,
          " 条）"
        ] }, d.id))
      ] }),
      /* @__PURE__ */ t(T, { type: "submit", variant: "secondary", size: "sm", disabled: b || !r.trim() || !p.trim() || u === null, children: "加进去" }),
      /* @__PURE__ */ t(T, { className: "reader-memory-icon", type: "button", "aria-label": "不加了", title: "不加了", onClick: () => i(""), children: /* @__PURE__ */ t(Y, { size: 13, "aria-hidden": !0 }) })
    ] }),
    _ ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "error", children: _ }) : null
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
function De({ memory: e, port: n, glossaries: i, onChanged: s }) {
  const [r, a] = h(!1), [p, f] = h(!1), [u, o] = h(""), [g, x] = h(e.text), [b, S] = h(!1), _ = async (v) => {
    S(!0);
    try {
      await v(), s();
    } finally {
      S(!1);
    }
  };
  return /* @__PURE__ */ t("li", { className: "reader-memory-row", "data-origin": e.origin, children: r ? /* @__PURE__ */ m(
    "form",
    {
      className: "reader-memory-edit",
      onSubmit: (v) => {
        v.preventDefault(), g.trim() && _(() => n.update(e.memory_id, { text: g.trim() })).then(() => a(!1));
      },
      children: [
        /* @__PURE__ */ t(E, { size: "sm", value: g, maxLength: 500, onChange: (v) => x(v.target.value), "aria-label": "改这条记忆", autoFocus: !0 }),
        /* @__PURE__ */ t(T, { className: "reader-memory-icon", type: "submit", "aria-label": "存", title: "存", disabled: b || !g.trim(), children: /* @__PURE__ */ t(oe, { size: 13, "aria-hidden": !0 }) }),
        /* @__PURE__ */ t(T, { className: "reader-memory-icon", type: "button", "aria-label": "不改了", title: "不改了", onClick: () => {
          x(e.text), a(!1);
        }, children: /* @__PURE__ */ t(Y, { size: 13, "aria-hidden": !0 }) })
      ]
    }
  ) : /* @__PURE__ */ m(I, { children: [
    /* @__PURE__ */ t("p", { className: "reader-memory-text", children: e.text }),
    /* @__PURE__ */ m("div", { className: "reader-memory-meta", children: [
      /* @__PURE__ */ t("span", { children: Be[e.category] || e.category }),
      /* @__PURE__ */ t("span", { children: e.origin === "agent" ? "AI 记的" : "你加的" }),
      /* @__PURE__ */ t("span", { children: e.updated_at.slice(0, 10) }),
      e.source_page ? /* @__PURE__ */ m("span", { children: [
        "第 ",
        e.source_page,
        " 页"
      ] }) : null,
      /* @__PURE__ */ t("span", { className: "reader-memory-gap" }),
      i && Re(e) ? /* @__PURE__ */ t(T, { className: "reader-memory-icon", "aria-label": "加进术语表", title: "加进术语表：以后翻译选这张表，就按这个译法译", onClick: () => {
        o(""), f((v) => !v);
      }, children: /* @__PURE__ */ t(de, { size: 12, "aria-hidden": !0 }) }) : null,
      /* @__PURE__ */ t(T, { className: "reader-memory-icon", "aria-label": "改", title: "改", onClick: () => a(!0), children: /* @__PURE__ */ t(ce, { size: 12, "aria-hidden": !0 }) }),
      /* @__PURE__ */ t(T, { className: "reader-memory-icon", "aria-label": "删", title: "删（它替代的旧条会恢复）", disabled: b, onClick: () => void _(() => n.remove(e.memory_id)), children: /* @__PURE__ */ t(ue, { size: 12, "aria-hidden": !0 }) })
    ] }),
    p && i ? /* @__PURE__ */ t(Pe, { memory: e, port: i, onDone: (v) => {
      f(!1), o(v);
    } }) : null,
    u ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "ok", children: u }) : null
  ] }) });
}
function Le({ port: e, glossaries: n, documentId: i, open: s, onOpenChange: r }) {
  const [a, p] = h("user"), [f, u] = h(""), [o, g] = h(null), [x, b] = h(null), [S, _] = h(""), [v, A] = h(""), d = a === "book" && i, c = ne(async () => {
    if (a === "book" && !i) return g([]);
    try {
      const l = await e.list({ scope: a, ...d ? { document_id: i } : {}, ...f.trim() ? { q: f.trim() } : {}, limit: 200 });
      g(l), A("");
    } catch (l) {
      A(l instanceof Error ? l.message : String(l));
    }
  }, [e, a, d, i, f]);
  k(() => {
    if (!s) return;
    const l = setTimeout(() => void c(), f ? 250 : 0);
    return () => clearTimeout(l);
  }, [s, c, f]), k(() => {
    s && e.settings().then((l) => b(l.memory_enabled), () => b(null));
  }, [s, e]);
  const N = async () => {
    const l = S.trim();
    if (l)
      try {
        await e.create({ scope: a, text: l, ...d ? { document_id: i } : {} }), _(""), await c();
      } catch (C) {
        A(C instanceof Error ? C.message : String(C));
      }
  };
  return /* @__PURE__ */ t(he, { open: s, onOpenChange: r, title: "记忆", description: "AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。", className: "reader-memory-sheet", children: /* @__PURE__ */ m("div", { className: "reader-memory", children: [
    /* @__PURE__ */ t(
      pe,
      {
        label: "让 AI 使用记忆",
        checked: x ?? !0,
        disabled: x === null,
        onChange: (l) => {
          const C = l.target.checked;
          b(C), e.setEnabled(C).then((M) => b(M.memory_enabled), () => b(!C));
        }
      }
    ),
    x === !1 ? /* @__PURE__ */ t("p", { className: "reader-memory-note", children: "关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。" }) : null,
    /* @__PURE__ */ t(
      fe,
      {
        label: "哪一层",
        size: "sm",
        value: a,
        onChange: (l) => p(l),
        options: [
          { value: "user", label: "关于你" },
          { value: "book", label: "这本书", disabled: !i }
        ]
      }
    ),
    /* @__PURE__ */ t(E, { size: "sm", type: "search", placeholder: "搜记忆", value: f, onChange: (l) => u(l.target.value), "aria-label": "搜记忆" }),
    /* @__PURE__ */ m("form", { className: "reader-memory-add", onSubmit: (l) => {
      l.preventDefault(), N();
    }, children: [
      /* @__PURE__ */ t(E, { size: "sm", placeholder: a === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译", value: S, maxLength: 500, onChange: (l) => _(l.target.value), "aria-label": "加一条记忆" }),
      /* @__PURE__ */ t(T, { type: "submit", variant: "secondary", size: "sm", disabled: !S.trim(), children: "记下" })
    ] }),
    v ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "error", children: v }) : null,
    o === null ? null : o.length ? /* @__PURE__ */ t("ul", { className: "reader-memory-list", children: o.map((l) => /* @__PURE__ */ t(De, { memory: l, port: e, glossaries: n, onChanged: () => void c() }, `${l.memory_id}:${l.updated_at}`)) }) : /* @__PURE__ */ t("p", { className: "reader-memory-note", children: f ? "没搜到。" : a === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。" })
  ] }) });
}
function Ge({ ask: e }) {
  const n = e.view.conversation;
  return (n == null ? void 0 : n.kind) !== "side" ? null : n.status !== "open" ? /* @__PURE__ */ t("p", { className: "reader-ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ m("div", { className: "reader-ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ t("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ m(T, { className: "reader-ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ t(K, {}) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function Qe({ port: e, jobId: n, bookTitle: i, book: s, ask: r, onShowSelection: a, onJumpToPage: p, pageCount: f, legacy: u, onLayout: o, dockTaken: g, onEditBlock: x, canEditBlock: b, attachTools: S, attachRequest: _, contextOffer: v }) {
  var U;
  const [A, d] = h(!1), c = r.view.conversation, N = u ? null : c ? { id: c.conversation_id, documentId: s.documentId } : null, l = P(() => Te(e, n, N), [e, n, N == null ? void 0 : N.id, N == null ? void 0 : N.documentId]), C = u ? null : r.pending, M = r.extras, Z = P(() => C ? W(C, n, i, ve(C, s), M) : null, [C, n, i, s, M]), J = a ? ($) => {
    const y = Ne($);
    !y || y.document_id && s.documentId && y.document_id !== s.documentId || a({ page: y.page, pane: y.pane === "source" ? "source" : "translated" });
  } : void 0, O = s.documentId, ee = P(() => x ? {
    label: "改这段译文",
    title: "改问的这段译文：回答里选着一段字就先填进去（不然填回答里的 ```译文 代码块），存之前还能改",
    available: ($) => {
      const y = q($, O);
      return !!(y && (!b || b(y)));
    },
    run: ($, y) => {
      const F = q($, O);
      F && x(F, ye(y));
    }
  } : void 0, [x, b, O]), G = be() || void 0;
  if (u)
    return /* @__PURE__ */ t(
      j,
      {
        port: l,
        context: null,
        title: /* @__PURE__ */ m("span", { className: "reader-ask-crumb", title: "2026-11-26 以前按书存的提问，只能看；新的问题都在主对话里", children: [
          "以前的提问 · 第 ",
          u.anchor.page,
          " 页"
        ] }),
        initialMessages: u.messages,
        readOnly: !0,
        onClose: u.onClose,
        onDelete: u.onDelete,
        onJumpToPage: p,
        pageCount: f,
        katexStylesheetUrl: G,
        onLayout: o,
        dockTaken: g,
        dockInsets: Q
      },
      `legacy:${u.anchor.page}:${u.messages.length}`
    );
  const H = (c == null ? void 0 : c.kind) === "main" && c.status !== "archived", te = (c == null ? void 0 : c.kind) === "main" && c.status === "archived", R = e.memories ?? null;
  return /* @__PURE__ */ m(I, { children: [
    /* @__PURE__ */ t(
      j,
      {
        port: l,
        context: Z,
        onContextUsed: () => r.setPending(null),
        onContextClear: () => r.setPending(null),
        onClose: r.close,
        readOnly: te,
        title: /* @__PURE__ */ t(Me, { ask: r, canArchive: H, canList: !!((U = e.conversations) != null && U.archived) }),
        headerMenu: R ? [{
          key: "memory",
          label: "记忆",
          hint: "AI 记住的关于你和这本书的事，能改、删、关掉",
          icon: /* @__PURE__ */ t(me, { size: 14, "aria-hidden": !0 }),
          onSelect: () => d(!0)
        }] : void 0,
        footer: /* @__PURE__ */ m(I, { children: [
          r.error ? /* @__PURE__ */ t("p", { className: "reader-ask-error", children: r.error }) : null,
          /* @__PURE__ */ t(Ge, { ask: r })
        ] }),
        onShowContext: J,
        initialMessages: r.view.initial,
        earlier: r.view.hasMore ? { loading: r.loading, load: () => void r.loadEarlier() } : null,
        onTurn: r.persistent ? r.onTurn : void 0,
        onFork: H && r.persistent ? ($) => void r.fork($) : void 0,
        onOpenSide: r.persistent ? ($) => void r.openSide($) : void 0,
        onForgetMemory: r.forgetMemory,
        onRewrite: r.persistent ? async ($) => {
          const y = await r.rewrite($);
          return y ? W(xe(y), n, i, { ...y, item_ids: y.item_ids || [] }) : null;
        } : void 0,
        memories: r.notices,
        onJumpToPage: p,
        pageCount: f,
        katexStylesheetUrl: G,
        onLayout: o,
        dockTaken: g,
        dockInsets: Q,
        answerAction: ee,
        attachTools: S,
        attachRequest: _,
        contextOffer: v
      },
      r.view.key
    ),
    R ? /* @__PURE__ */ t(Le, { port: R, glossaries: e.glossaries, documentId: s.documentId, open: A, onOpenChange: d }) : null
  ] });
}
export {
  Qe as default
};
//# sourceMappingURL=ReaderAskPanel-xdxsmWgS.js.map
