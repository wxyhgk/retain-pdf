import { jsx as t, jsxs as d, Fragment as M } from "react/jsx-runtime";
import { useState as m, useCallback as Q, useEffect as B, useMemo as O } from "react";
import U from "@retainpdf/ask/window";
import { Check as j, X as W, BookPlus as Y, Pencil as K, Trash2 as X, BookmarkCheck as H, Archive as V, Loader2 as Z, ChevronRight as J } from "lucide-react";
import { Sheet as ee, Checkbox as te, SegmentedControl as ne, Input as $, Button as C, Select as re } from "@retainpdf/ui";
import { b as ie, c as G, s as se, r as ae, d as le, e as oe } from "./ReaderApp-B6H7B-za.js";
const ce = 4e3;
function P(e, r = ce) {
  const i = `${e || ""}`.trim();
  return i.length > r ? `${i.slice(0, r)}…` : i;
}
function de(e, r, i = "") {
  const s = [], n = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return s.push(`我在读${i ? `《${i}》` : "一本书"}，${n}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && s.push("", "我选中的这段：", P(e.selection)), e.sourceText && s.push("", "这一块的原文：", P(e.sourceText)), e.translatedText && s.push("", "这一块的译文：", P(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && s.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), s.push("", `（RetainPDF 任务 ${r}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), s.join(`
`);
}
function L(e, r, i = "", s) {
  return {
    page: e.page,
    label: [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: de(e, r, i),
    ...s ? { meta: { retainpdf: { selection: s } } } : {}
  };
}
function ue(e, r, i) {
  const s = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (n, c) => e.openSession({ ...n, jobId: r, ...i ? { conversationId: i.id } : {} }, c),
    ...i && s ? { conversationPreamble: () => s.contextText(i.id, i.documentId) } : {}
  };
}
const me = /\s*(?:定译为|定译成|统一译为|统一译成|译为|译成|译作|翻译为|翻译成|→|->|=>|=)\s*/, he = /\s*[：:]\s*/, pe = /^[「『“"'《〈（(\s]+|[」』”"'》〉）)\s。．.，,；;！!]+$/g;
function R(e) {
  return e.replace(pe, "").trim();
}
function q(e) {
  const r = `${e || ""}`.trim(), i = r.split(me), [s, ...n] = i.length > 1 ? i : r.split(he);
  if (!n.length) return { source: R(r), target: "" };
  const c = n.join(" ").split(/[，,；;（(]/)[0] ?? "";
  return { source: R(s ?? ""), target: R(c) };
}
function ge(e) {
  return e.category === "term" || e.scope === "book" && !!q(e.text).target;
}
const k = "阅读时定的术语", I = "__new__";
function fe({ memory: e, port: r, onDone: i }) {
  const s = q(e.text), [n, c] = m(s.source), [S, p] = m(s.target), [u, b] = m(null), [g, y] = m(I), [x, N] = m(!1), [v, o] = m("");
  B(() => {
    let l = !1;
    return r.list().then(
      (h) => {
        var A;
        l || (b(h), y(((A = h.find((a) => a.name === k)) == null ? void 0 : A.id) || I));
      },
      () => !l && b([])
    ), () => {
      l = !0;
    };
  }, [r]);
  const w = async (l) => {
    if (l.preventDefault(), !(!n.trim() || !S.trim())) {
      N(!0), o("");
      try {
        const h = await r.addEntry(g === I ? { name: k } : { id: g }, { source: n.trim(), target: S.trim(), note: "阅读页提问时定的" });
        i(`${h.replaced ? "换掉了" : "加进了"}「${h.name}」。以后翻译时选这张表才用得上。`);
      } catch (h) {
        o(h instanceof Error ? h.message : String(h));
      } finally {
        N(!1);
      }
    }
  };
  return /* @__PURE__ */ d("form", { className: "reader-memory-glossary", onSubmit: (l) => void w(l), children: [
    /* @__PURE__ */ d("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ t($, { size: "sm", value: n, onChange: (l) => c(l.target.value), "aria-label": "原文", placeholder: "原文", autoFocus: !0 }),
      /* @__PURE__ */ t($, { size: "sm", value: S, onChange: (l) => p(l.target.value), "aria-label": "译法", placeholder: "译法" })
    ] }),
    /* @__PURE__ */ d("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ d(re, { size: "sm", value: g, onChange: (l) => y(l.target.value), "aria-label": "加进哪张术语表", disabled: u === null, children: [
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
      /* @__PURE__ */ t(C, { type: "submit", variant: "secondary", size: "sm", disabled: x || !n.trim() || !S.trim() || u === null, children: "加进去" }),
      /* @__PURE__ */ t(C, { className: "reader-memory-icon", type: "button", "aria-label": "不加了", title: "不加了", onClick: () => i(""), children: /* @__PURE__ */ t(W, { size: 13, "aria-hidden": !0 }) })
    ] }),
    v ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "error", children: v }) : null
  ] });
}
const ve = {
  preference: "偏好",
  background: "背景",
  style: "回答风格",
  progress: "读到哪",
  term: "术语",
  conclusion: "结论",
  other: "其他"
};
function ye({ memory: e, port: r, glossaries: i, onChanged: s }) {
  const [n, c] = m(!1), [S, p] = m(!1), [u, b] = m(""), [g, y] = m(e.text), [x, N] = m(!1), v = async (o) => {
    N(!0);
    try {
      await o(), s();
    } finally {
      N(!1);
    }
  };
  return /* @__PURE__ */ t("li", { className: "reader-memory-row", "data-origin": e.origin, children: n ? /* @__PURE__ */ d(
    "form",
    {
      className: "reader-memory-edit",
      onSubmit: (o) => {
        o.preventDefault(), g.trim() && v(() => r.update(e.memory_id, { text: g.trim() })).then(() => c(!1));
      },
      children: [
        /* @__PURE__ */ t($, { size: "sm", value: g, maxLength: 500, onChange: (o) => y(o.target.value), "aria-label": "改这条记忆", autoFocus: !0 }),
        /* @__PURE__ */ t(C, { className: "reader-memory-icon", type: "submit", "aria-label": "存", title: "存", disabled: x || !g.trim(), children: /* @__PURE__ */ t(j, { size: 13, "aria-hidden": !0 }) }),
        /* @__PURE__ */ t(C, { className: "reader-memory-icon", type: "button", "aria-label": "不改了", title: "不改了", onClick: () => {
          y(e.text), c(!1);
        }, children: /* @__PURE__ */ t(W, { size: 13, "aria-hidden": !0 }) })
      ]
    }
  ) : /* @__PURE__ */ d(M, { children: [
    /* @__PURE__ */ t("p", { className: "reader-memory-text", children: e.text }),
    /* @__PURE__ */ d("div", { className: "reader-memory-meta", children: [
      /* @__PURE__ */ t("span", { children: ve[e.category] || e.category }),
      /* @__PURE__ */ t("span", { children: e.origin === "agent" ? "AI 记的" : "你加的" }),
      /* @__PURE__ */ t("span", { children: e.updated_at.slice(0, 10) }),
      e.source_page ? /* @__PURE__ */ d("span", { children: [
        "第 ",
        e.source_page,
        " 页"
      ] }) : null,
      /* @__PURE__ */ t("span", { className: "reader-memory-gap" }),
      i && ge(e) ? /* @__PURE__ */ t(C, { className: "reader-memory-icon", "aria-label": "加进术语表", title: "加进术语表：以后翻译选这张表，就按这个译法译", onClick: () => {
        b(""), p((o) => !o);
      }, children: /* @__PURE__ */ t(Y, { size: 12, "aria-hidden": !0 }) }) : null,
      /* @__PURE__ */ t(C, { className: "reader-memory-icon", "aria-label": "改", title: "改", onClick: () => c(!0), children: /* @__PURE__ */ t(K, { size: 12, "aria-hidden": !0 }) }),
      /* @__PURE__ */ t(C, { className: "reader-memory-icon", "aria-label": "删", title: "删（它替代的旧条会恢复）", disabled: x, onClick: () => void v(() => r.remove(e.memory_id)), children: /* @__PURE__ */ t(X, { size: 12, "aria-hidden": !0 }) })
    ] }),
    S && i ? /* @__PURE__ */ t(fe, { memory: e, port: i, onDone: (o) => {
      p(!1), b(o);
    } }) : null,
    u ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "ok", children: u }) : null
  ] }) });
}
function be({ port: e, glossaries: r, documentId: i, open: s, onOpenChange: n }) {
  const [c, S] = m("user"), [p, u] = m(""), [b, g] = m(null), [y, x] = m(null), [N, v] = m(""), [o, w] = m(""), l = c === "book" && i, h = Q(async () => {
    if (c === "book" && !i) return g([]);
    try {
      const a = await e.list({ scope: c, ...l ? { document_id: i } : {}, ...p.trim() ? { q: p.trim() } : {}, limit: 200 });
      g(a), w("");
    } catch (a) {
      w(a instanceof Error ? a.message : String(a));
    }
  }, [e, c, l, i, p]);
  B(() => {
    if (!s) return;
    const a = setTimeout(() => void h(), p ? 250 : 0);
    return () => clearTimeout(a);
  }, [s, h, p]), B(() => {
    s && e.settings().then((a) => x(a.memory_enabled), () => x(null));
  }, [s, e]);
  const A = async () => {
    const a = N.trim();
    if (a)
      try {
        await e.create({ scope: c, text: a, ...l ? { document_id: i } : {} }), v(""), await h();
      } catch (_) {
        w(_ instanceof Error ? _.message : String(_));
      }
  };
  return /* @__PURE__ */ t(ee, { open: s, onOpenChange: n, title: "记忆", description: "AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。", className: "reader-memory-sheet", children: /* @__PURE__ */ d("div", { className: "reader-memory", children: [
    /* @__PURE__ */ t(
      te,
      {
        label: "让 AI 使用记忆",
        checked: y ?? !0,
        disabled: y === null,
        onChange: (a) => {
          const _ = a.target.checked;
          x(_), e.setEnabled(_).then((z) => x(z.memory_enabled), () => x(!_));
        }
      }
    ),
    y === !1 ? /* @__PURE__ */ t("p", { className: "reader-memory-note", children: "关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。" }) : null,
    /* @__PURE__ */ t(
      ne,
      {
        label: "哪一层",
        size: "sm",
        value: c,
        onChange: (a) => S(a),
        options: [
          { value: "user", label: "关于你" },
          { value: "book", label: "这本书", disabled: !i }
        ]
      }
    ),
    /* @__PURE__ */ t($, { size: "sm", type: "search", placeholder: "搜记忆", value: p, onChange: (a) => u(a.target.value), "aria-label": "搜记忆" }),
    /* @__PURE__ */ d("form", { className: "reader-memory-add", onSubmit: (a) => {
      a.preventDefault(), A();
    }, children: [
      /* @__PURE__ */ t($, { size: "sm", placeholder: c === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译", value: N, maxLength: 500, onChange: (a) => v(a.target.value), "aria-label": "加一条记忆" }),
      /* @__PURE__ */ t(C, { type: "submit", variant: "secondary", size: "sm", disabled: !N.trim(), children: "记下" })
    ] }),
    o ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "error", children: o }) : null,
    b === null ? null : b.length ? /* @__PURE__ */ t("ul", { className: "reader-memory-list", children: b.map((a) => /* @__PURE__ */ t(ye, { memory: a, port: e, glossaries: r, onChanged: () => void h() }, `${a.memory_id}:${a.updated_at}`)) }) : /* @__PURE__ */ t("p", { className: "reader-memory-note", children: p ? "没搜到。" : c === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。" })
  ] }) });
}
function xe({ ask: e }) {
  const r = e.view.conversation;
  return (r == null ? void 0 : r.kind) !== "side" ? null : r.status !== "open" ? /* @__PURE__ */ t("p", { className: "ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ d("div", { className: "ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ t("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ d(C, { className: "ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ t(Z, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function Ne({ ask: e }) {
  const r = e.view.conversation;
  return (r == null ? void 0 : r.kind) !== "side" ? /* @__PURE__ */ t("span", { className: "ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: "主对话" }) : /* @__PURE__ */ d("span", { className: "ask-crumbs", children: [
    /* @__PURE__ */ t(C, { className: "ask-crumb-link", title: "回主对话（副对话留着，之后能回来）", onClick: () => void e.backToMain(), children: "主对话" }),
    /* @__PURE__ */ t(J, { size: 11, "aria-hidden": !0 }),
    /* @__PURE__ */ t("span", { className: "ask-crumb", title: r.title, children: r.title || "副对话" })
  ] });
}
function $e({ port: e, jobId: r, bookTitle: i, book: s, ask: n, onShowSelection: c, onJumpToPage: S, pageCount: p, legacy: u, onLayout: b, onEditBlock: g, canEditBlock: y }) {
  const [x, N] = m(!1), v = n.view.conversation, o = u ? null : v ? { id: v.conversation_id, documentId: s.documentId } : null, w = O(() => ue(e, r, o), [e, r, o == null ? void 0 : o.id, o == null ? void 0 : o.documentId]), l = u ? null : n.pending, h = O(() => l ? L(l, r, i, ie(l, s)) : null, [l, r, i, s]), A = c ? (T) => {
    const f = oe(T);
    !f || f.document_id && s.documentId && f.document_id !== s.documentId || c({ page: f.page, pane: f.pane === "source" ? "source" : "translated" });
  } : void 0, a = s.documentId, _ = O(() => g ? {
    label: "改这段译文",
    title: "改问的这段译文：回答里选着一段字就先填进去（不然填回答里的 ```译文 代码块），存之前还能改",
    available: (T) => {
      const f = G(T, a);
      return !!(f && (!y || y(f)));
    },
    run: (T, f) => {
      const F = G(T, a);
      F && g(F, se(f));
    }
  } : void 0, [g, y, a]), z = ae() || void 0;
  if (u)
    return /* @__PURE__ */ t(
      U,
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
        onJumpToPage: S,
        pageCount: p,
        katexStylesheetUrl: z,
        onLayout: b
      },
      `legacy:${u.anchor.page}:${u.messages.length}`
    );
  const D = (v == null ? void 0 : v.kind) === "main", E = e.memories ?? null;
  return /* @__PURE__ */ d(M, { children: [
    /* @__PURE__ */ t(
      U,
      {
        port: w,
        context: h,
        onContextUsed: () => n.setPending(null),
        onContextClear: () => n.setPending(null),
        onClose: n.close,
        title: /* @__PURE__ */ t(Ne, { ask: n }),
        headerActions: /* @__PURE__ */ d(M, { children: [
          E ? /* @__PURE__ */ t(C, { className: "ask-icon", "aria-label": "记忆", title: "记忆：AI 记下的、你自己加的（能关掉）", onClick: () => N(!0), children: /* @__PURE__ */ t(H, { size: 14, "aria-hidden": !0 }) }) : null,
          D && n.persistent ? /* @__PURE__ */ t(C, { className: "ask-icon", "aria-label": "归档主对话", title: "归档这个主对话，开一个新的（归档的还在，记忆不受影响）", onClick: () => void n.archiveMain(), children: /* @__PURE__ */ t(V, { size: 14, "aria-hidden": !0 }) }) : null
        ] }),
        footer: /* @__PURE__ */ d(M, { children: [
          n.error ? /* @__PURE__ */ t("p", { className: "ask-error", children: n.error }) : null,
          /* @__PURE__ */ t(xe, { ask: n })
        ] }),
        onShowContext: A,
        initialMessages: n.view.initial,
        earlier: n.view.hasMore ? { loading: n.loading, load: () => void n.loadEarlier() } : null,
        onTurn: n.persistent ? n.onTurn : void 0,
        onFork: D && n.persistent ? (T) => void n.fork(T) : void 0,
        onOpenSide: n.persistent ? (T) => void n.openSide(T) : void 0,
        onForgetMemory: n.forgetMemory,
        onRewrite: n.persistent ? async (T) => {
          const f = await n.rewrite(T);
          return f ? L(le(f), r, i, { ...f, item_ids: f.item_ids || [] }) : null;
        } : void 0,
        memories: n.notices,
        onJumpToPage: S,
        pageCount: p,
        katexStylesheetUrl: z,
        onLayout: b,
        answerAction: _
      },
      n.view.key
    ),
    E ? /* @__PURE__ */ t(be, { port: E, glossaries: e.glossaries, documentId: s.documentId, open: x, onOpenChange: N }) : null
  ] });
}
export {
  $e as default
};
//# sourceMappingURL=ReaderAskPanel-CrEvLXpy.js.map
