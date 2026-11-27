import { jsx as t, jsxs as c, Fragment as M } from "react/jsx-runtime";
import { useState as m, useCallback as Y, useEffect as B, useMemo as O } from "react";
import G from "@retainpdf/ask/window";
import { Check as K, X as q, BookPlus as X, Pencil as H, Trash2 as V, BookmarkCheck as Z, Archive as J, Loader2 as ee, ChevronRight as te } from "lucide-react";
import { Sheet as ne, Checkbox as re, SegmentedControl as ie, Input as z, Button as x, Select as se } from "@retainpdf/ui";
import { b as ae, c as L, s as le, r as oe, d as ce, e as de } from "./ReaderApp-CNjz7-Fe.js";
const ue = 4e3;
function P(e, r = ue) {
  const i = `${e || ""}`.trim();
  return i.length > r ? `${i.slice(0, r)}…` : i;
}
function me(e, r, i = "") {
  const s = [], n = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return s.push(`我在读${i ? `《${i}》` : "一本书"}，${n}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && s.push("", "我选中的这段：", P(e.selection)), e.sourceText && s.push("", "这一块的原文：", P(e.sourceText)), e.translatedText && s.push("", "这一块的译文：", P(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && s.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), s.push("", `（RetainPDF 任务 ${r}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), s.join(`
`);
}
function W(e, r, i = "", s) {
  return {
    page: e.page,
    label: [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: me(e, r, i),
    ...s ? { meta: { retainpdf: { selection: s } } } : {}
  };
}
function he(e, r, i) {
  const s = e.conversations;
  return {
    listAgents: () => e.listAgents(),
    openSession: (n, o) => e.openSession({ ...n, jobId: r, ...i ? { conversationId: i.id } : {} }, o),
    ...i && s ? { conversationPreamble: () => s.contextText(i.id, i.documentId) } : {}
  };
}
const pe = /\s*(?:定译为|定译成|统一译为|统一译成|译为|译成|译作|翻译为|翻译成|→|->|=>|=)\s*/, ge = /\s*[：:]\s*/, fe = /^[「『“"'《〈（(\s]+|[」』”"'》〉）)\s。．.，,；;！!]+$/g;
function R(e) {
  return e.replace(fe, "").trim();
}
function Q(e) {
  const r = `${e || ""}`.trim(), i = r.split(pe), [s, ...n] = i.length > 1 ? i : r.split(ge);
  if (!n.length) return { source: R(r), target: "" };
  const o = n.join(" ").split(/[，,；;（(]/)[0] ?? "";
  return { source: R(s ?? ""), target: R(o) };
}
function ve(e) {
  return e.category === "term" || e.scope === "book" && !!Q(e.text).target;
}
const k = "阅读时定的术语", I = "__new__";
function ye({ memory: e, port: r, onDone: i }) {
  const s = Q(e.text), [n, o] = m(s.source), [N, p] = m(s.target), [d, y] = m(null), [g, v] = m(I), [b, C] = m(!1), [_, u] = m("");
  B(() => {
    let a = !1;
    return r.list().then(
      (h) => {
        var w;
        a || (y(h), v(((w = h.find((l) => l.name === k)) == null ? void 0 : w.id) || I));
      },
      () => !a && y([])
    ), () => {
      a = !0;
    };
  }, [r]);
  const S = async (a) => {
    if (a.preventDefault(), !(!n.trim() || !N.trim())) {
      C(!0), u("");
      try {
        const h = await r.addEntry(g === I ? { name: k } : { id: g }, { source: n.trim(), target: N.trim(), note: "阅读页提问时定的" });
        i(`${h.replaced ? "换掉了" : "加进了"}「${h.name}」。以后翻译时选这张表才用得上。`);
      } catch (h) {
        u(h instanceof Error ? h.message : String(h));
      } finally {
        C(!1);
      }
    }
  };
  return /* @__PURE__ */ c("form", { className: "reader-memory-glossary", onSubmit: (a) => void S(a), children: [
    /* @__PURE__ */ c("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ t(z, { size: "sm", value: n, onChange: (a) => o(a.target.value), "aria-label": "原文", placeholder: "原文", autoFocus: !0 }),
      /* @__PURE__ */ t(z, { size: "sm", value: N, onChange: (a) => p(a.target.value), "aria-label": "译法", placeholder: "译法" })
    ] }),
    /* @__PURE__ */ c("div", { className: "reader-memory-glossary-pair", children: [
      /* @__PURE__ */ c(se, { size: "sm", value: g, onChange: (a) => v(a.target.value), "aria-label": "加进哪张术语表", disabled: d === null, children: [
        /* @__PURE__ */ c("option", { value: I, children: [
          "新建一张「",
          k,
          "」"
        ] }),
        (d || []).map((a) => /* @__PURE__ */ c("option", { value: a.id, children: [
          a.name,
          "（",
          a.entryCount,
          " 条）"
        ] }, a.id))
      ] }),
      /* @__PURE__ */ t(x, { type: "submit", variant: "secondary", size: "sm", disabled: b || !n.trim() || !N.trim() || d === null, children: "加进去" }),
      /* @__PURE__ */ t(x, { className: "reader-memory-icon", type: "button", "aria-label": "不加了", title: "不加了", onClick: () => i(""), children: /* @__PURE__ */ t(q, { size: 13, "aria-hidden": !0 }) })
    ] }),
    _ ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "error", children: _ }) : null
  ] });
}
const be = {
  preference: "偏好",
  background: "背景",
  style: "回答风格",
  progress: "读到哪",
  term: "术语",
  conclusion: "结论",
  other: "其他"
};
function xe({ memory: e, port: r, glossaries: i, onChanged: s }) {
  const [n, o] = m(!1), [N, p] = m(!1), [d, y] = m(""), [g, v] = m(e.text), [b, C] = m(!1), _ = async (u) => {
    C(!0);
    try {
      await u(), s();
    } finally {
      C(!1);
    }
  };
  return /* @__PURE__ */ t("li", { className: "reader-memory-row", "data-origin": e.origin, children: n ? /* @__PURE__ */ c(
    "form",
    {
      className: "reader-memory-edit",
      onSubmit: (u) => {
        u.preventDefault(), g.trim() && _(() => r.update(e.memory_id, { text: g.trim() })).then(() => o(!1));
      },
      children: [
        /* @__PURE__ */ t(z, { size: "sm", value: g, maxLength: 500, onChange: (u) => v(u.target.value), "aria-label": "改这条记忆", autoFocus: !0 }),
        /* @__PURE__ */ t(x, { className: "reader-memory-icon", type: "submit", "aria-label": "存", title: "存", disabled: b || !g.trim(), children: /* @__PURE__ */ t(K, { size: 13, "aria-hidden": !0 }) }),
        /* @__PURE__ */ t(x, { className: "reader-memory-icon", type: "button", "aria-label": "不改了", title: "不改了", onClick: () => {
          v(e.text), o(!1);
        }, children: /* @__PURE__ */ t(q, { size: 13, "aria-hidden": !0 }) })
      ]
    }
  ) : /* @__PURE__ */ c(M, { children: [
    /* @__PURE__ */ t("p", { className: "reader-memory-text", children: e.text }),
    /* @__PURE__ */ c("div", { className: "reader-memory-meta", children: [
      /* @__PURE__ */ t("span", { children: be[e.category] || e.category }),
      /* @__PURE__ */ t("span", { children: e.origin === "agent" ? "AI 记的" : "你加的" }),
      /* @__PURE__ */ t("span", { children: e.updated_at.slice(0, 10) }),
      e.source_page ? /* @__PURE__ */ c("span", { children: [
        "第 ",
        e.source_page,
        " 页"
      ] }) : null,
      /* @__PURE__ */ t("span", { className: "reader-memory-gap" }),
      i && ve(e) ? /* @__PURE__ */ t(x, { className: "reader-memory-icon", "aria-label": "加进术语表", title: "加进术语表：以后翻译选这张表，就按这个译法译", onClick: () => {
        y(""), p((u) => !u);
      }, children: /* @__PURE__ */ t(X, { size: 12, "aria-hidden": !0 }) }) : null,
      /* @__PURE__ */ t(x, { className: "reader-memory-icon", "aria-label": "改", title: "改", onClick: () => o(!0), children: /* @__PURE__ */ t(H, { size: 12, "aria-hidden": !0 }) }),
      /* @__PURE__ */ t(x, { className: "reader-memory-icon", "aria-label": "删", title: "删（它替代的旧条会恢复）", disabled: b, onClick: () => void _(() => r.remove(e.memory_id)), children: /* @__PURE__ */ t(V, { size: 12, "aria-hidden": !0 }) })
    ] }),
    N && i ? /* @__PURE__ */ t(ye, { memory: e, port: i, onDone: (u) => {
      p(!1), y(u);
    } }) : null,
    d ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "ok", children: d }) : null
  ] }) });
}
function Ne({ port: e, glossaries: r, documentId: i, open: s, onOpenChange: n }) {
  const [o, N] = m("user"), [p, d] = m(""), [y, g] = m(null), [v, b] = m(null), [C, _] = m(""), [u, S] = m(""), a = o === "book" && i, h = Y(async () => {
    if (o === "book" && !i) return g([]);
    try {
      const l = await e.list({ scope: o, ...a ? { document_id: i } : {}, ...p.trim() ? { q: p.trim() } : {}, limit: 200 });
      g(l), S("");
    } catch (l) {
      S(l instanceof Error ? l.message : String(l));
    }
  }, [e, o, a, i, p]);
  B(() => {
    if (!s) return;
    const l = setTimeout(() => void h(), p ? 250 : 0);
    return () => clearTimeout(l);
  }, [s, h, p]), B(() => {
    s && e.settings().then((l) => b(l.memory_enabled), () => b(null));
  }, [s, e]);
  const w = async () => {
    const l = C.trim();
    if (l)
      try {
        await e.create({ scope: o, text: l, ...a ? { document_id: i } : {} }), _(""), await h();
      } catch (A) {
        S(A instanceof Error ? A.message : String(A));
      }
  };
  return /* @__PURE__ */ t(ne, { open: s, onOpenChange: n, title: "记忆", description: "AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。", className: "reader-memory-sheet", children: /* @__PURE__ */ c("div", { className: "reader-memory", children: [
    /* @__PURE__ */ t(
      re,
      {
        label: "让 AI 使用记忆",
        checked: v ?? !0,
        disabled: v === null,
        onChange: (l) => {
          const A = l.target.checked;
          b(A), e.setEnabled(A).then(($) => b($.memory_enabled), () => b(!A));
        }
      }
    ),
    v === !1 ? /* @__PURE__ */ t("p", { className: "reader-memory-note", children: "关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。" }) : null,
    /* @__PURE__ */ t(
      ie,
      {
        label: "哪一层",
        size: "sm",
        value: o,
        onChange: (l) => N(l),
        options: [
          { value: "user", label: "关于你" },
          { value: "book", label: "这本书", disabled: !i }
        ]
      }
    ),
    /* @__PURE__ */ t(z, { size: "sm", type: "search", placeholder: "搜记忆", value: p, onChange: (l) => d(l.target.value), "aria-label": "搜记忆" }),
    /* @__PURE__ */ c("form", { className: "reader-memory-add", onSubmit: (l) => {
      l.preventDefault(), w();
    }, children: [
      /* @__PURE__ */ t(z, { size: "sm", placeholder: o === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译", value: C, maxLength: 500, onChange: (l) => _(l.target.value), "aria-label": "加一条记忆" }),
      /* @__PURE__ */ t(x, { type: "submit", variant: "secondary", size: "sm", disabled: !C.trim(), children: "记下" })
    ] }),
    u ? /* @__PURE__ */ t("p", { className: "reader-memory-note", "data-tone": "error", children: u }) : null,
    y === null ? null : y.length ? /* @__PURE__ */ t("ul", { className: "reader-memory-list", children: y.map((l) => /* @__PURE__ */ t(xe, { memory: l, port: e, glossaries: r, onChanged: () => void h() }, `${l.memory_id}:${l.updated_at}`)) }) : /* @__PURE__ */ t("p", { className: "reader-memory-note", children: p ? "没搜到。" : o === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。" })
  ] }) });
}
function Ce({ ask: e }) {
  const r = e.view.conversation;
  return (r == null ? void 0 : r.kind) !== "side" ? null : r.status !== "open" ? /* @__PURE__ */ t("p", { className: "ask-side-bar", "data-state": "closed", children: "这个副对话已经结束，结论在主对话里；接着问会重新打开它。" }) : /* @__PURE__ */ c("div", { className: "ask-side-bar", "data-state": e.closingSide, children: [
    /* @__PURE__ */ t("span", { children: e.closingSide === "busy" ? "正在把这段来回总结成结论……" : e.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。" }),
    /* @__PURE__ */ c(x, { className: "ask-side-close", onClick: () => void e.closeSide(), disabled: e.closingSide === "busy", children: [
      e.closingSide === "busy" ? /* @__PURE__ */ t(ee, { size: 12, className: "ask-spin", "aria-hidden": !0 }) : null,
      e.closingSide === "failed" ? "再试一次" : "结束，带回结论"
    ] })
  ] });
}
function Se({ ask: e }) {
  const r = e.view.conversation;
  return (r == null ? void 0 : r.kind) !== "side" ? /* @__PURE__ */ t("span", { className: "ask-crumb", title: "一直延续的主对话：换书、换 agent 都接着聊", children: "主对话" }) : /* @__PURE__ */ c("span", { className: "ask-crumbs", children: [
    /* @__PURE__ */ t(x, { className: "ask-crumb-link", title: "回主对话（副对话留着，之后能回来）", onClick: () => void e.backToMain(), children: "主对话" }),
    /* @__PURE__ */ t(te, { size: 11, "aria-hidden": !0 }),
    /* @__PURE__ */ t("span", { className: "ask-crumb", title: r.title, children: r.title || "副对话" })
  ] });
}
function Ie({ port: e, jobId: r, bookTitle: i, book: s, ask: n, onShowSelection: o, onJumpToPage: N, pageCount: p, legacy: d, onLayout: y, onEditBlock: g, canEditBlock: v, attachTools: b, attachRequest: C }) {
  const [_, u] = m(!1), S = n.view.conversation, a = d ? null : S ? { id: S.conversation_id, documentId: s.documentId } : null, h = O(() => he(e, r, a), [e, r, a == null ? void 0 : a.id, a == null ? void 0 : a.documentId]), w = d ? null : n.pending, l = O(() => w ? W(w, r, i, ae(w, s)) : null, [w, r, i, s]), A = o ? (T) => {
    const f = de(T);
    !f || f.document_id && s.documentId && f.document_id !== s.documentId || o({ page: f.page, pane: f.pane === "source" ? "source" : "translated" });
  } : void 0, $ = s.documentId, j = O(() => g ? {
    label: "改这段译文",
    title: "改问的这段译文：回答里选着一段字就先填进去（不然填回答里的 ```译文 代码块），存之前还能改",
    available: (T) => {
      const f = L(T, $);
      return !!(f && (!v || v(f)));
    },
    run: (T, f) => {
      const U = L(T, $);
      U && g(U, le(f));
    }
  } : void 0, [g, v, $]), D = oe() || void 0;
  if (d)
    return /* @__PURE__ */ t(
      G,
      {
        port: h,
        context: null,
        title: /* @__PURE__ */ c("span", { className: "ask-crumb", title: "2026-11-26 以前按书存的提问，只能看；新的问题都在主对话里", children: [
          "以前的提问 · 第 ",
          d.anchor.page,
          " 页"
        ] }),
        initialMessages: d.messages,
        readOnly: !0,
        onClose: d.onClose,
        onDelete: d.onDelete,
        onJumpToPage: N,
        pageCount: p,
        katexStylesheetUrl: D,
        onLayout: y
      },
      `legacy:${d.anchor.page}:${d.messages.length}`
    );
  const F = (S == null ? void 0 : S.kind) === "main", E = e.memories ?? null;
  return /* @__PURE__ */ c(M, { children: [
    /* @__PURE__ */ t(
      G,
      {
        port: h,
        context: l,
        onContextUsed: () => n.setPending(null),
        onContextClear: () => n.setPending(null),
        onClose: n.close,
        title: /* @__PURE__ */ t(Se, { ask: n }),
        headerActions: /* @__PURE__ */ c(M, { children: [
          E ? /* @__PURE__ */ t(x, { className: "ask-icon", "aria-label": "记忆", title: "记忆：AI 记下的、你自己加的（能关掉）", onClick: () => u(!0), children: /* @__PURE__ */ t(Z, { size: 14, "aria-hidden": !0 }) }) : null,
          F && n.persistent ? /* @__PURE__ */ t(x, { className: "ask-icon", "aria-label": "归档主对话", title: "归档这个主对话，开一个新的（归档的还在，记忆不受影响）", onClick: () => void n.archiveMain(), children: /* @__PURE__ */ t(J, { size: 14, "aria-hidden": !0 }) }) : null
        ] }),
        footer: /* @__PURE__ */ c(M, { children: [
          n.error ? /* @__PURE__ */ t("p", { className: "ask-error", children: n.error }) : null,
          /* @__PURE__ */ t(Ce, { ask: n })
        ] }),
        onShowContext: A,
        initialMessages: n.view.initial,
        earlier: n.view.hasMore ? { loading: n.loading, load: () => void n.loadEarlier() } : null,
        onTurn: n.persistent ? n.onTurn : void 0,
        onFork: F && n.persistent ? (T) => void n.fork(T) : void 0,
        onOpenSide: n.persistent ? (T) => void n.openSide(T) : void 0,
        onForgetMemory: n.forgetMemory,
        onRewrite: n.persistent ? async (T) => {
          const f = await n.rewrite(T);
          return f ? W(ce(f), r, i, { ...f, item_ids: f.item_ids || [] }) : null;
        } : void 0,
        memories: n.notices,
        onJumpToPage: N,
        pageCount: p,
        katexStylesheetUrl: D,
        onLayout: y,
        answerAction: j,
        attachTools: b,
        attachRequest: C
      },
      n.view.key
    ),
    E ? /* @__PURE__ */ t(Ne, { port: E, glossaries: e.glossaries, documentId: s.documentId, open: _, onOpenChange: u }) : null
  ] });
}
export {
  Ie as default
};
//# sourceMappingURL=ReaderAskPanel-D5JWA5rv.js.map
