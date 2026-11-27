import { jsx as t, jsxs as o, Fragment as A } from "react/jsx-runtime";
import { useState as h, useEffect as E, useCallback as ee, useMemo as B } from "react";
import G, { AskHeadMenu as te } from "@retainpdf/ask/window";
import { CornerUpLeft as ne, ChevronDown as se, SquarePen as ie, Loader2 as Q, History as re, Check as ae, X as H, BookPlus as le, Pencil as oe, Trash2 as de, BookmarkCheck as ce } from "lucide-react";
import { Button as N, Sheet as ue, Checkbox as me, SegmentedControl as he, Input as z, Select as pe } from "@retainpdf/ui";
import { b as fe, c as q, s as ge, r as ve, d as ye, e as be } from "./ReaderApp-D2Ok_Qvi.js";
const Ne = 4e3;
function k(e, n = Ne) {
  const r = `${e || ""}`.trim();
  return r.length > n ? `${r.slice(0, n)}…` : r;
}
function xe(e, n, r = "") {
  const i = [], s = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return i.push(`我在读${r ? `《${r}》` : "一本书"}，${s}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && i.push("", "我选中的这段：", k(e.selection)), e.sourceText && i.push("", "这一块的原文：", k(e.sourceText)), e.translatedText && i.push("", "这一块的译文：", k(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && i.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), i.push("", `（RetainPDF 任务 ${n}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), i.join(`
`);
}
function Ce(e) {
  return e.map((n, r) => {
    const i = [`另外一处（${r + 2}）：第 ${n.page} 页${n.section ? `，「${n.section}」` : ""}（${n.pane === "source" ? "原文" : "译文"}栏）。`];
    return n.selection ? i.push("选中的这段：", k(n.selection)) : (n.sourceText || n.translatedText) && (n.sourceText && i.push("这一块的原文：", k(n.sourceText)), n.translatedText && i.push("这一块的译文：", k(n.translatedText))), n.itemId && i.push(`（块 ${n.itemId}）`), i.join(`
`);
  }).join(`

`);
}
function W(e, n, r = "", i, s = []) {
  const a = [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · ");
  return {
    page: e.page,
    label: [a, ...s.map((p) => p.page === e.page ? "同页另一段" : `第 ${p.page} 页`)].join(" + "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: xe(e, n, r),
    ...i ? { meta: { retainpdf: { selection: i } } } : {},
    ...s.length ? { extra: Ce(s) } : {}
  };
}
function Se(e, n, r) {
  const i = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (s, a) => e.openSession({ ...s, jobId: n, ...r ? { conversationId: r.id } : {} }, a),
    ...r && i ? { conversationPreamble: () => i.contextText(r.id, r.documentId) } : {}
  };
}
function Y(e) {
  return `${e.title && e.title !== "主对话" ? `${e.title} · ` : ""}${e.updated_at.slice(0, 10)}`;
}
function $e(e) {
  return (e == null ? void 0 : e.kind) === "main" && e.status === "archived" ? `以前的对话 · ${Y(e)}` : (e == null ? void 0 : e.kind) === "side" ? `副对话 · ${e.title || "未命名"}` : "主对话";
}
function we({ onArchive: e, close: n }) {
  const [r, i] = h(!1), [s, a] = h(!1);
  return r ? /* @__PURE__ */ o("div", { className: "reader-ask-confirm", role: "group", "aria-label": "确认开新对话", children: [
    /* @__PURE__ */ t("span", { children: "现在这段收起来，开个新的？" }),
    /* @__PURE__ */ o(
      N,
      {
        className: "reader-ask-confirm-yes",
        disabled: s,
        onClick: async () => {
          a(!0);
          try {
            await e(), n();
          } finally {
            a(!1), i(!1);
          }
        },
        children: [
          s ? /* @__PURE__ */ t(Q, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
          "开新的"
        ]
      }
    ),
    /* @__PURE__ */ t(N, { className: "reader-ask-confirm-no", onClick: () => i(!1), children: "算了" })
  ] }) : /* @__PURE__ */ o(N, { className: "ask-head-menu-item", onClick: () => i(!0), children: [
    /* @__PURE__ */ t("span", { className: "ask-head-menu-icon", children: /* @__PURE__ */ t(ie, { size: 14, "aria-hidden": !0 }) }),
    /* @__PURE__ */ o("span", { className: "ask-head-menu-text", children: [
      /* @__PURE__ */ t("span", { children: "开个新对话" }),
      /* @__PURE__ */ t("small", { children: "现在这段收进下面「以前的对话」，还能看；AI 记住的不受影响" })
    ] })
  ] });
}
function Te({ ask: e, open: n, close: r }) {
  var m;
  const [i, s] = h(null), [a, p] = h("");
  E(() => {
    if (!n) return;
    let d = !1;
    return p(""), e.listArchived().then(
      (g) => !d && s(g),
      (g) => !d && p(g instanceof Error ? g.message : String(g))
    ), () => {
      d = !0;
    };
  }, [n]);
  const f = (m = e.view.conversation) == null ? void 0 : m.conversation_id;
  return /* @__PURE__ */ o("section", { className: "reader-ask-history", "aria-label": "以前的对话", children: [
    /* @__PURE__ */ o("p", { className: "reader-ask-history-head", children: [
      /* @__PURE__ */ t(re, { size: 12, "aria-hidden": !0 }),
      " 以前的对话"
    ] }),
    a ? /* @__PURE__ */ t("p", { className: "reader-ask-history-note", children: a }) : i === null ? /* @__PURE__ */ t("p", { className: "reader-ask-history-note", children: "在读……" }) : i.length ? i.map((d) => /* @__PURE__ */ o(
      N,
      {
        className: "ask-head-menu-item reader-ask-history-item",
        "data-current": d.conversation_id === f ? "true" : void 0,
        onClick: () => {
          r(), e.viewArchived(d);
        },
        children: [
          /* @__PURE__ */ t("span", { className: "ask-head-menu-text", children: /* @__PURE__ */ t("span", { children: Y(d) }) }),
          /* @__PURE__ */ o("small", { children: [
            d.message_count,
            " 条"
          ] })
        ]
      },
      d.conversation_id
    )) : /* @__PURE__ */ t("p", { className: "reader-ask-history-note", children: "这本书还没有以前的对话。" })
  ] });
}
function _e({ ask: e, canArchive: n, canList: r }) {
  const [i, s] = h(!1), a = e.view.conversation, p = $e(a), f = !!(a && (a.kind === "side" || a.status === "archived")), m = (a == null ? void 0 : a.kind) === "main" && a.status !== "archived";
  return !e.persistent || !n && !r && !f ? /* @__PURE__ */ t("span", { className: "ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: p }) : /* @__PURE__ */ t(
    te,
    {
      className: "reader-ask-conversations",
      title: `${p}：开个新对话、看以前的对话`,
      onOpenChange: s,
      label: /* @__PURE__ */ o(A, { children: [
        /* @__PURE__ */ t("span", { className: "ask-crumb", children: p }),
        /* @__PURE__ */ t(se, { size: 12, "aria-hidden": !0 })
      ] }),
      children: (d) => /* @__PURE__ */ o(A, { children: [
        f ? /* @__PURE__ */ o(N, { className: "ask-head-menu-item", onClick: () => {
          d(), e.backToMain();
        }, children: [
          /* @__PURE__ */ t("span", { className: "ask-head-menu-icon", children: /* @__PURE__ */ t(ne, { size: 14, "aria-hidden": !0 }) }),
          /* @__PURE__ */ o("span", { className: "ask-head-menu-text", children: [
            /* @__PURE__ */ t("span", { children: "回主对话" }),
            /* @__PURE__ */ t("small", { children: (a == null ? void 0 : a.kind) === "side" ? "这个副对话留着，之后能回来" : "回到这本书现在的这段" })
          ] })
        ] }) : null,
        m && n ? /* @__PURE__ */ t(we, { onArchive: e.archiveMain, close: d }) : null,
        r ? /* @__PURE__ */ t(Te, { ask: e, open: i, close: d }) : null
      ] })
    }
  );
}
const ke = /\s*(?:定译为|定译成|统一译为|统一译成|译为|译成|译作|翻译为|翻译成|→|->|=>|=)\s*/, Ae = /\s*[：:]\s*/, ze = /^[「『“"'《〈（(\s]+|[」』”"'》〉）)\s。．.，,；;！!]+$/g;
function R(e) {
  return e.replace(ze, "").trim();
}
function K(e) {
  const n = `${e || ""}`.trim(), r = n.split(ke), [i, ...s] = r.length > 1 ? r : n.split(Ae);
  if (!s.length) return { source: R(n), target: "" };
  const a = s.join(" ").split(/[，,；;（(]/)[0] ?? "";
  return { source: R(i ?? ""), target: R(a) };
}
function Me(e) {
  return e.category === "term" || e.scope === "book" && !!K(e.text).target;
}
const L = "阅读时定的术语", I = "__new__";
function Ie({ memory: e, port: n, onDone: r }) {
  const i = K(e.text), [s, a] = h(i.source), [p, f] = h(i.target), [m, d] = h(null), [g, x] = h(I), [b, $] = h(!1), [T, v] = h("");
  E(() => {
    let c = !1;
    return n.list().then(
      (u) => {
        var C;
        c || (d(u), x(((C = u.find((l) => l.name === L)) == null ? void 0 : C.id) || I));
      },
      () => !c && d([])
    ), () => {
      c = !0;
    };
  }, [n]);
  const _ = async (c) => {
    if (c.preventDefault(), !(!s.trim() || !p.trim())) {
      $(!0), v("");
      try {
        const u = await n.addEntry(g === I ? { name: L } : { id: g }, { source: s.trim(), target: p.trim(), note: "阅读页提问时定的" });
        r(`${u.replaced ? "换掉了" : "加进了"}「${u.name}」。以后翻译时选这张表才用得上。`);
      } catch (u) {
        v(u instanceof Error ? u.message : String(u));
      } finally {
        $(!1);
      }
    }
  };
  return /* @__PURE__ */ o("form", { className: "reader-memory-glossary", onSubmit: (c) => void _(c), children: [
    /* @__PURE__ */ o("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ t(z, { size: "sm", value: s, onChange: (c) => a(c.target.value), "aria-label": "原文", placeholder: "原文", autoFocus: !0 }),
      /* @__PURE__ */ t(z, { size: "sm", value: p, onChange: (c) => f(c.target.value), "aria-label": "译法", placeholder: "译法" })
    ] }),
    /* @__PURE__ */ o("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ o(pe, { size: "sm", value: g, onChange: (c) => x(c.target.value), "aria-label": "加进哪张术语表", disabled: m === null, children: [
        /* @__PURE__ */ o("option", { value: I, children: [
          "新建一张「",
          L,
          "」"
        ] }),
        (m || []).map((c) => /* @__PURE__ */ o("option", { value: c.id, children: [
          c.name,
          "（",
          c.entryCount,
          " 条）"
        ] }, c.id))
      ] }),
      /* @__PURE__ */ t(N, { type: "submit", variant: "secondary", size: "sm", disabled: b || !s.trim() || !p.trim() || m === null, children: "加进去" }),
      /* @__PURE__ */ t(N, { className: "reader-memory-icon", type: "button", "aria-label": "不加了", title: "不加了", onClick: () => r(""), children: /* @__PURE__ */ t(H, { size: 13, "aria-hidden": !0 }) })
    ] }),
    T ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "error", children: T }) : null
  ] });
}
const Ee = {
  preference: "偏好",
  background: "背景",
  style: "回答风格",
  progress: "读到哪",
  term: "术语",
  conclusion: "结论",
  other: "其他"
};
function Oe({ memory: e, port: n, glossaries: r, onChanged: i }) {
  const [s, a] = h(!1), [p, f] = h(!1), [m, d] = h(""), [g, x] = h(e.text), [b, $] = h(!1), T = async (v) => {
    $(!0);
    try {
      await v(), i();
    } finally {
      $(!1);
    }
  };
  return /* @__PURE__ */ t("li", { className: "reader-memory-row", "data-origin": e.origin, children: s ? /* @__PURE__ */ o(
    "form",
    {
      className: "reader-memory-edit",
      onSubmit: (v) => {
        v.preventDefault(), g.trim() && T(() => n.update(e.memory_id, { text: g.trim() })).then(() => a(!1));
      },
      children: [
        /* @__PURE__ */ t(z, { size: "sm", value: g, maxLength: 500, onChange: (v) => x(v.target.value), "aria-label": "改这条记忆", autoFocus: !0 }),
        /* @__PURE__ */ t(N, { className: "reader-memory-icon", type: "submit", "aria-label": "存", title: "存", disabled: b || !g.trim(), children: /* @__PURE__ */ t(ae, { size: 13, "aria-hidden": !0 }) }),
        /* @__PURE__ */ t(N, { className: "reader-memory-icon", type: "button", "aria-label": "不改了", title: "不改了", onClick: () => {
          x(e.text), a(!1);
        }, children: /* @__PURE__ */ t(H, { size: 13, "aria-hidden": !0 }) })
      ]
    }
  ) : /* @__PURE__ */ o(A, { children: [
    /* @__PURE__ */ t("p", { className: "reader-memory-text", children: e.text }),
    /* @__PURE__ */ o("div", { className: "reader-memory-meta", children: [
      /* @__PURE__ */ t("span", { children: Ee[e.category] || e.category }),
      /* @__PURE__ */ t("span", { children: e.origin === "agent" ? "AI 记的" : "你加的" }),
      /* @__PURE__ */ t("span", { children: e.updated_at.slice(0, 10) }),
      e.source_page ? /* @__PURE__ */ o("span", { children: [
        "第 ",
        e.source_page,
        " 页"
      ] }) : null,
      /* @__PURE__ */ t("span", { className: "reader-memory-gap" }),
      r && Me(e) ? /* @__PURE__ */ t(N, { className: "reader-memory-icon", "aria-label": "加进术语表", title: "加进术语表：以后翻译选这张表，就按这个译法译", onClick: () => {
        d(""), f((v) => !v);
      }, children: /* @__PURE__ */ t(le, { size: 12, "aria-hidden": !0 }) }) : null,
      /* @__PURE__ */ t(N, { className: "reader-memory-icon", "aria-label": "改", title: "改", onClick: () => a(!0), children: /* @__PURE__ */ t(oe, { size: 12, "aria-hidden": !0 }) }),
      /* @__PURE__ */ t(N, { className: "reader-memory-icon", "aria-label": "删", title: "删（它替代的旧条会恢复）", disabled: b, onClick: () => void T(() => n.remove(e.memory_id)), children: /* @__PURE__ */ t(de, { size: 12, "aria-hidden": !0 }) })
    ] }),
    p && r ? /* @__PURE__ */ t(Ie, { memory: e, port: r, onDone: (v) => {
      f(!1), d(v);
    } }) : null,
    m ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "ok", children: m }) : null
  ] }) });
}
function Pe({ port: e, glossaries: n, documentId: r, open: i, onOpenChange: s }) {
  const [a, p] = h("user"), [f, m] = h(""), [d, g] = h(null), [x, b] = h(null), [$, T] = h(""), [v, _] = h(""), c = a === "book" && r, u = ee(async () => {
    if (a === "book" && !r) return g([]);
    try {
      const l = await e.list({ scope: a, ...c ? { document_id: r } : {}, ...f.trim() ? { q: f.trim() } : {}, limit: 200 });
      g(l), _("");
    } catch (l) {
      _(l instanceof Error ? l.message : String(l));
    }
  }, [e, a, c, r, f]);
  E(() => {
    if (!i) return;
    const l = setTimeout(() => void u(), f ? 250 : 0);
    return () => clearTimeout(l);
  }, [i, u, f]), E(() => {
    i && e.settings().then((l) => b(l.memory_enabled), () => b(null));
  }, [i, e]);
  const C = async () => {
    const l = $.trim();
    if (l)
      try {
        await e.create({ scope: a, text: l, ...c ? { document_id: r } : {} }), T(""), await u();
      } catch (S) {
        _(S instanceof Error ? S.message : String(S));
      }
  };
  return /* @__PURE__ */ t(ue, { open: i, onOpenChange: s, title: "记忆", description: "AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。", className: "reader-memory-sheet", children: /* @__PURE__ */ o("div", { className: "reader-memory", children: [
    /* @__PURE__ */ t(
      me,
      {
        label: "让 AI 使用记忆",
        checked: x ?? !0,
        disabled: x === null,
        onChange: (l) => {
          const S = l.target.checked;
          b(S), e.setEnabled(S).then((M) => b(M.memory_enabled), () => b(!S));
        }
      }
    ),
    x === !1 ? /* @__PURE__ */ t("p", { className: "reader-memory-note", children: "关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。" }) : null,
    /* @__PURE__ */ t(
      he,
      {
        label: "哪一层",
        size: "sm",
        value: a,
        onChange: (l) => p(l),
        options: [
          { value: "user", label: "关于你" },
          { value: "book", label: "这本书", disabled: !r }
        ]
      }
    ),
    /* @__PURE__ */ t(z, { size: "sm", type: "search", placeholder: "搜记忆", value: f, onChange: (l) => m(l.target.value), "aria-label": "搜记忆" }),
    /* @__PURE__ */ o("form", { className: "reader-memory-add", onSubmit: (l) => {
      l.preventDefault(), C();
    }, children: [
      /* @__PURE__ */ t(z, { size: "sm", placeholder: a === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译", value: $, maxLength: 500, onChange: (l) => T(l.target.value), "aria-label": "加一条记忆" }),
      /* @__PURE__ */ t(N, { type: "submit", variant: "secondary", size: "sm", disabled: !$.trim(), children: "记下" })
    ] }),
    v ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "error", children: v }) : null,
    d === null ? null : d.length ? /* @__PURE__ */ t("ul", { className: "reader-memory-list", children: d.map((l) => /* @__PURE__ */ t(Oe, { memory: l, port: e, glossaries: n, onChanged: () => void u() }, `${l.memory_id}:${l.updated_at}`)) }) : /* @__PURE__ */ t("p", { className: "reader-memory-note", children: f ? "没搜到。" : a === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。" })
  ] }) });
}
function Be({ ask: e }) {
  const n = e.view.conversation;
  return (n == null ? void 0 : n.kind) !== "side" ? null : n.status !== "open" ? /* @__PURE__ */ t("p", { className: "ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ o("div", { className: "ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ t("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ o(N, { className: "ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ t(Q, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function Ge({ port: e, jobId: n, bookTitle: r, book: i, ask: s, onShowSelection: a, onJumpToPage: p, pageCount: f, legacy: m, onLayout: d, dockTaken: g, onEditBlock: x, canEditBlock: b, attachTools: $, attachRequest: T, contextOffer: v }) {
  var F;
  const [_, c] = h(!1), u = s.view.conversation, C = m ? null : u ? { id: u.conversation_id, documentId: i.documentId } : null, l = B(() => Se(e, n, C), [e, n, C == null ? void 0 : C.id, C == null ? void 0 : C.documentId]), S = m ? null : s.pending, M = s.extras, X = B(() => S ? W(S, n, r, fe(S, i), M) : null, [S, n, r, i, M]), V = a ? (w) => {
    const y = be(w);
    !y || y.document_id && i.documentId && y.document_id !== i.documentId || a({ page: y.page, pane: y.pane === "source" ? "source" : "translated" });
  } : void 0, O = i.documentId, Z = B(() => x ? {
    label: "改这段译文",
    title: "改问的这段译文：回答里选着一段字就先填进去（不然填回答里的 ```译文 代码块），存之前还能改",
    available: (w) => {
      const y = q(w, O);
      return !!(y && (!b || b(y)));
    },
    run: (w, y) => {
      const j = q(w, O);
      j && x(j, ge(y));
    }
  } : void 0, [x, b, O]), D = ve() || void 0;
  if (m)
    return /* @__PURE__ */ t(
      G,
      {
        port: l,
        context: null,
        title: /* @__PURE__ */ o("span", { className: "ask-crumb", title: "2026-11-26 以前按书存的提问，只能看；新的问题都在主对话里", children: [
          "以前的提问 · 第 ",
          m.anchor.page,
          " 页"
        ] }),
        initialMessages: m.messages,
        readOnly: !0,
        onClose: m.onClose,
        onDelete: m.onDelete,
        onJumpToPage: p,
        pageCount: f,
        katexStylesheetUrl: D,
        onLayout: d,
        dockTaken: g
      },
      `legacy:${m.anchor.page}:${m.messages.length}`
    );
  const U = (u == null ? void 0 : u.kind) === "main" && u.status !== "archived", J = (u == null ? void 0 : u.kind) === "main" && u.status === "archived", P = e.memories ?? null;
  return /* @__PURE__ */ o(A, { children: [
    /* @__PURE__ */ t(
      G,
      {
        port: l,
        context: X,
        onContextUsed: () => s.setPending(null),
        onContextClear: () => s.setPending(null),
        onClose: s.close,
        readOnly: J,
        title: /* @__PURE__ */ t(_e, { ask: s, canArchive: U, canList: !!((F = e.conversations) != null && F.archived) }),
        headerMenu: P ? [{
          key: "memory",
          label: "记忆",
          hint: "AI 记住的关于你和这本书的事，能改、删、关掉",
          icon: /* @__PURE__ */ t(ce, { size: 14, "aria-hidden": !0 }),
          onSelect: () => c(!0)
        }] : void 0,
        footer: /* @__PURE__ */ o(A, { children: [
          s.error ? /* @__PURE__ */ t("p", { className: "ask-error", children: s.error }) : null,
          /* @__PURE__ */ t(Be, { ask: s })
        ] }),
        onShowContext: V,
        initialMessages: s.view.initial,
        earlier: s.view.hasMore ? { loading: s.loading, load: () => void s.loadEarlier() } : null,
        onTurn: s.persistent ? s.onTurn : void 0,
        onFork: U && s.persistent ? (w) => void s.fork(w) : void 0,
        onOpenSide: s.persistent ? (w) => void s.openSide(w) : void 0,
        onForgetMemory: s.forgetMemory,
        onRewrite: s.persistent ? async (w) => {
          const y = await s.rewrite(w);
          return y ? W(ye(y), n, r, { ...y, item_ids: y.item_ids || [] }) : null;
        } : void 0,
        memories: s.notices,
        onJumpToPage: p,
        pageCount: f,
        katexStylesheetUrl: D,
        onLayout: d,
        dockTaken: g,
        answerAction: Z,
        attachTools: $,
        attachRequest: T,
        contextOffer: v
      },
      s.view.key
    ),
    P ? /* @__PURE__ */ t(Pe, { port: P, glossaries: e.glossaries, documentId: i.documentId, open: _, onOpenChange: c }) : null
  ] });
}
export {
  Ge as default
};
//# sourceMappingURL=ReaderAskPanel-D9ZqQLFa.js.map
