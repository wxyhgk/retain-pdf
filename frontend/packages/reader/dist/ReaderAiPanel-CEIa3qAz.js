import { jsx as r, jsxs as E, Fragment as $e } from "react/jsx-runtime";
import { useState as Q, useRef as H, useEffect as Z, useMemo as ae, useCallback as X, useId as yt } from "react";
import { Square as wt, ArrowUp as vt, Copy as It, GitBranch as bt, RefreshCw as _t, Sigma as Qe, Table2 as Nt, Image as Rt, Type as kt, X as Te, BookOpen as Je, Sparkles as be, Loader2 as Ee, FileText as qe, ArrowDown as Xe, ListTree as Mt, FlaskConical as Ct, ShieldCheck as At, Bot as St, ChevronUp as $t, ChevronDown as Ze, TriangleAlert as et, ExternalLink as Tt, Check as tt, Circle as Et, Plus as xt, Pencil as Pt, Trash2 as Ot } from "lucide-react";
import { R as Dt } from "./ReaderFloatShell-DTFWp_bv.js";
import { ThreadPrimitive as pe, ComposerPrimitive as Me, MessagePrimitive as nt, ActionBarPrimitive as xe, useExternalStoreRuntime as Ft, AssistantRuntimeProvider as qt } from "@assistant-ui/react";
import { A as zt } from "./AiMarkdownAnswer-DET_KlrE.js";
import { e as rt, g as Lt, d as Bt } from "./ReaderApp-BgACXe1b.js";
import { M as jt, C as Be, h as Wt } from "./config-CgaWliJ_.js";
import { k as ye, q as me, v as Kt } from "./answer-enhance-W8TBaAUL.js";
import { Chat as Ut, useChat as Gt } from "@ai-sdk/react";
import { s as Ht, l as je, c as ve, b as Pe, a as Vt } from "./thread-branch-store-Jy9wH_F1.js";
import { l as Yt } from "./ask-answerer-GNQdzitl.js";
import { listConversations as Qt, getConversation as Ce, messagesToBranchItems as Ae, nextForkConversationTitle as Jt, forkConversationFromPath as Xt, deleteConversation as Zt, patchConversation as en } from "@retainpdf/api/conversations";
import { getAgentOperation as tn, listAgentOperations as nn, runAgentOperation as rn, cancelAgentOperation as sn, commitAgentOperation as an, retryAgentOperation as on, fetchAgentOperationCandidate as cn } from "@retainpdf/api/document-operations";
import { fetchAgentRuntimeConfig as dn } from "@retainpdf/api/agent-runtime-settings";
function st(t) {
  return t.content.filter((e) => e.type === "text").map((e) => e.text).join(`
`).trim();
}
function We({ label: t }) {
  return /* @__PURE__ */ E("div", { className: "aui-thinking", role: "status", "aria-live": "polite", children: [
    /* @__PURE__ */ r(Ee, { className: "aui-spin", size: 14, strokeWidth: 2.4, "aria-hidden": !0 }),
    /* @__PURE__ */ r("span", { children: t || "思考中…" })
  ] });
}
function ln({ message: t }) {
  return /* @__PURE__ */ r(nt.Root, { className: "aui-msg aui-msg-user", "data-role": "user", children: /* @__PURE__ */ r("div", { className: "aui-msg-bubble", children: /* @__PURE__ */ r("div", { className: "aui-md-plain", children: st(t) }) }) });
}
function un({
  jobId: t,
  message: e,
  citations: n,
  progress: s,
  streaming: i,
  branchBusy: a,
  onJumpCitation: o,
  onBranchFromAnswer: c
}) {
  const m = st(e);
  return /* @__PURE__ */ r(nt.Root, { className: "aui-msg aui-msg-assistant", "data-role": "assistant", children: /* @__PURE__ */ E("div", { className: "aui-msg-stack", children: [
    i && s ? /* @__PURE__ */ r(We, { label: s }) : null,
    i && !s && !m ? /* @__PURE__ */ r(We, { label: "思考中…" }) : null,
    m ? /* @__PURE__ */ r("div", { className: "aui-msg-bubble", children: /* @__PURE__ */ r(
      zt,
      {
        content: m,
        streaming: i,
        citations: n,
        jobId: t,
        className: "aui-md",
        streamingClassName: "aui-md-streaming",
        pendingClassName: "aui-md-pending",
        finalClassName: "aui-md-final",
        onJumpCitation: o
      }
    ) }) : null,
    /* @__PURE__ */ E(
      xe.Root,
      {
        className: "aui-msg-actions",
        "data-reader-ai-actions": "",
        hideWhenRunning: !0,
        autohide: "not-last",
        children: [
          /* @__PURE__ */ r(xe.Copy, { className: "aui-action-btn", "aria-label": "复制答案", title: "复制答案", children: /* @__PURE__ */ r(It, { size: 14, strokeWidth: 2.1, "aria-hidden": !0 }) }),
          c ? /* @__PURE__ */ r(
            "button",
            {
              type: "button",
              className: "aui-action-btn aui-action-btn-branch",
              "aria-label": "从这里开新对话",
              title: "从这里开新对话",
              disabled: a,
              onClick: async () => {
                ye(1200, { overlayDelayMs: 0 }), me(1200), await c(e.id);
              },
              children: /* @__PURE__ */ r(bt, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
            }
          ) : null,
          /* @__PURE__ */ r(xe.Reload, { className: "aui-action-btn", "aria-label": "重新生成", title: "重新生成", children: /* @__PURE__ */ r(_t, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }) })
        ]
      }
    )
  ] }) });
}
function at({
  jobId: t,
  citationsByMessageId: e,
  progressByMessageId: n,
  streamingAssistantId: s,
  isRunning: i,
  branchBusy: a,
  onJumpCitation: o,
  onBranchFromAnswer: c
}) {
  return /* @__PURE__ */ r("div", { className: "aui-message-group", "data-slot": "aui_message-group", children: /* @__PURE__ */ r(pe.Messages, { children: ({ message: m }) => {
    var M;
    if (m.role === "user") return /* @__PURE__ */ r(ln, { message: m });
    if (m.role !== "assistant") return null;
    const y = ((M = m.status) == null ? void 0 : M.type) === "running" || i && s === m.id;
    return /* @__PURE__ */ r(
      un,
      {
        jobId: t,
        message: m,
        citations: e[m.id] || [],
        progress: n[m.id] || "",
        streaming: y,
        branchBusy: a,
        onJumpCitation: o,
        onBranchFromAnswer: c
      }
    );
  } }) });
}
function pn({
  mode: t,
  disabled: e,
  onChange: n
}) {
  return /* @__PURE__ */ E("div", { className: "aui-assistant-mode", role: "group", "aria-label": "AI 模式", children: [
    /* @__PURE__ */ E(
      "button",
      {
        type: "button",
        className: t !== "operations" ? "is-active" : "",
        "aria-pressed": t !== "operations",
        disabled: e,
        onClick: () => n == null ? void 0 : n("reading"),
        children: [
          /* @__PURE__ */ r(Je, { size: 12, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ r("span", { children: "阅读问答" })
        ]
      }
    ),
    /* @__PURE__ */ E(
      "button",
      {
        type: "button",
        className: t === "operations" ? "is-active" : "",
        "aria-pressed": t === "operations",
        disabled: e,
        onClick: () => n == null ? void 0 : n("operations"),
        children: [
          /* @__PURE__ */ r(be, { size: 12, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ r("span", { children: "PDF Agent" })
        ]
      }
    )
  ] });
}
function mn({
  selectionContext: t,
  onClear: e
}) {
  if (!t) return null;
  const n = t.selectionType === "text" ? "text" : t.kind, s = t.selectionType === "text" ? t.quote : rt(t.region, t.pane), i = n === "formula" ? "公式" : n === "table" ? "表格" : n === "figure" ? "图片" : "文字";
  return /* @__PURE__ */ E("div", { className: "aui-selection-context", "data-reader-ai-selection-context": "", children: [
    /* @__PURE__ */ r(n === "formula" ? Qe : n === "table" ? Nt : n === "figure" ? Rt : kt, { size: 14, strokeWidth: 2.1, "aria-hidden": !0 }),
    /* @__PURE__ */ E("span", { className: "aui-selection-context-meta", children: [
      t.pane === "translated" ? "译文" : "原文",
      " · ",
      t.page,
      " 页 · ",
      i
    ] }),
    /* @__PURE__ */ r("span", { className: "aui-selection-context-text", children: s || "已选择此区域" }),
    /* @__PURE__ */ r(
      "button",
      {
        type: "button",
        className: "aui-selection-context-remove",
        "aria-label": "移除选区上下文",
        title: "移除选区",
        onClick: e,
        children: /* @__PURE__ */ r(Te, { size: 13, strokeWidth: 2.4, "aria-hidden": !0 })
      }
    )
  ] });
}
function it({
  isRunning: t,
  branchBusy: e,
  mode: n,
  onModeChange: s,
  selectionContext: i,
  onClearSelectionContext: a
}) {
  return /* @__PURE__ */ E(Me.Root, { className: "aui-composer", "data-reader-ai-composer": "", children: [
    /* @__PURE__ */ E("div", { className: "aui-composer-shell", children: [
      n !== "operations" ? /* @__PURE__ */ r(mn, { selectionContext: i, onClear: a }) : null,
      /* @__PURE__ */ r(
        Me.Input,
        {
          className: "aui-input",
          rows: 1,
          placeholder: n === "operations" ? "描述要执行的 PDF 操作…" : "询问当前文档…",
          "aria-label": n === "operations" ? "描述 PDF 操作" : "向文档 AI 提问",
          autoFocus: !0,
          enterKeyHint: "send",
          disabled: e,
          submitMode: "enter"
        }
      ),
      /* @__PURE__ */ E("div", { className: "aui-composer-toolbar", children: [
        /* @__PURE__ */ r(pn, { mode: n, disabled: t || e, onChange: s }),
        /* @__PURE__ */ r("div", { className: "aui-composer-actions", children: t ? /* @__PURE__ */ r(Me.Cancel, { className: "aui-send aui-send-stop", "aria-label": "停止生成", children: /* @__PURE__ */ r(wt, { size: 12, strokeWidth: 2.6, "aria-hidden": !0 }) }) : /* @__PURE__ */ r(Me.Send, { className: "aui-send", "aria-label": "发送", children: /* @__PURE__ */ r(vt, { size: 16, strokeWidth: 2.5, "aria-hidden": !0 }) }) })
      ] })
    ] }),
    /* @__PURE__ */ r("p", { className: "aui-hint", children: "AI 可能会出错，请核对原文与引用" })
  ] });
}
function ot() {
  return /* @__PURE__ */ E("div", { className: "aui-composer aui-composer-locked", role: "alert", children: [
    /* @__PURE__ */ r("p", { className: "aui-llm-lock-msg", children: jt }),
    /* @__PURE__ */ r("p", { className: "aui-hint", children: "请到首页「设置 → API 设置」填写模型 Key 后即可提问" })
  ] });
}
const fn = [
  { prompt: "把第 1 页旋转 90 度。", label: "旋转页面", icon: qe },
  { prompt: "删除最后一页。", label: "删除页面", icon: qe }
];
function hn({
  jobId: t,
  empty: e,
  citationsByMessageId: n,
  progressByMessageId: s,
  streamingAssistantId: i,
  isRunning: a,
  missingLlmKey: o,
  branchBusy: c,
  agentRequestBlocked: m = !1,
  agentOperationPanel: y,
  onModeChange: M,
  onJumpCitation: A,
  onBranchFromAnswer: v
}) {
  const I = c || m;
  return /* @__PURE__ */ E($e, { children: [
    e ? /* @__PURE__ */ E("div", { className: "aui-empty", children: [
      /* @__PURE__ */ r("div", { className: "aui-empty-mascot", "aria-hidden": !0, children: /* @__PURE__ */ r("span", { className: "aui-empty-mascot-face", children: /* @__PURE__ */ r(be, { size: 21, strokeWidth: 1.9 }) }) }),
      /* @__PURE__ */ r("h2", { className: "aui-empty-title", children: "想怎样处理 PDF？" }),
      /* @__PURE__ */ r("p", { className: "aui-empty-sub", children: "创建候选版本后由你预览和确认" }),
      /* @__PURE__ */ r("div", { className: "aui-suggestions", role: "group", "aria-label": "推荐问题", children: fn.map((l) => {
        const T = l.icon;
        return /* @__PURE__ */ E(
          pe.Suggestion,
          {
            prompt: l.prompt,
            send: !0,
            type: "button",
            className: "aui-suggestion",
            disabled: I || o,
            children: [
              /* @__PURE__ */ r(T, { size: 14, strokeWidth: 2, "aria-hidden": !0, className: "aui-suggestion-icon" }),
              /* @__PURE__ */ r("span", { className: "aui-suggestion-label", children: l.label })
            ]
          },
          l.prompt
        );
      }) })
    ] }) : null,
    /* @__PURE__ */ r(
      at,
      {
        jobId: t,
        citationsByMessageId: n,
        progressByMessageId: s,
        streamingAssistantId: i,
        isRunning: a,
        branchBusy: c,
        onJumpCitation: A,
        onBranchFromAnswer: v
      }
    ),
    y,
    /* @__PURE__ */ E(pe.ViewportFooter, { className: "aui-thread-viewport-footer", children: [
      !e && !c ? /* @__PURE__ */ r(
        pe.ScrollToBottom,
        {
          className: "aui-scroll-bottom-btn aui-scroll-bottom",
          "aria-label": "滚到最新",
          children: /* @__PURE__ */ r(Xe, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
        }
      ) : null,
      o ? /* @__PURE__ */ r(ot, {}) : /* @__PURE__ */ r(
        it,
        {
          isRunning: a,
          branchBusy: I,
          mode: "operations",
          onModeChange: M,
          selectionContext: null,
          onClearSelectionContext: void 0
        }
      )
    ] })
  ] });
}
const gn = [
  { prompt: "用几句话总结这篇文献的核心内容。", label: "总结本文", icon: Je },
  { prompt: "这篇文献的主要结论是什么？", label: "提炼主要结论", icon: Mt },
  { prompt: "作者用了什么方法或模型？", label: "梳理方法与模型", icon: Ct },
  { prompt: "解释文中的关键公式。", label: "解释关键公式", icon: Qe }
];
function yn({
  jobId: t,
  empty: e,
  citationsByMessageId: n,
  progressByMessageId: s,
  streamingAssistantId: i,
  isRunning: a,
  missingLlmKey: o,
  branchBusy: c,
  composerDisabled: m = !1,
  onModeChange: y,
  onJumpCitation: M,
  onBranchFromAnswer: A,
  selectionContext: v = null,
  onClearSelectionContext: I,
  footerExtra: l = null
}) {
  return /* @__PURE__ */ E($e, { children: [
    e ? /* @__PURE__ */ E("div", { className: "aui-empty", children: [
      /* @__PURE__ */ r("div", { className: "aui-empty-mascot", "aria-hidden": !0, children: /* @__PURE__ */ r("span", { className: "aui-empty-mascot-face", children: /* @__PURE__ */ r(be, { size: 21, strokeWidth: 1.9 }) }) }),
      /* @__PURE__ */ r("h2", { className: "aui-empty-title", children: "一起读懂这篇文档" }),
      /* @__PURE__ */ r("p", { className: "aui-empty-sub", children: "总结、解释、检索与计算，不修改 PDF" }),
      /* @__PURE__ */ r("div", { className: "aui-suggestions", role: "group", "aria-label": "推荐问题", children: gn.map((T) => {
        const B = T.icon;
        return /* @__PURE__ */ E(
          pe.Suggestion,
          {
            prompt: T.prompt,
            send: !0,
            type: "button",
            className: "aui-suggestion",
            disabled: c || m || o,
            children: [
              /* @__PURE__ */ r(B, { size: 14, strokeWidth: 2, "aria-hidden": !0, className: "aui-suggestion-icon" }),
              /* @__PURE__ */ r("span", { className: "aui-suggestion-label", children: T.label })
            ]
          },
          T.prompt
        );
      }) })
    ] }) : null,
    /* @__PURE__ */ r(
      at,
      {
        jobId: t,
        citationsByMessageId: n,
        progressByMessageId: s,
        streamingAssistantId: i,
        isRunning: a,
        branchBusy: c,
        onJumpCitation: M,
        onBranchFromAnswer: A
      }
    ),
    l,
    /* @__PURE__ */ E(pe.ViewportFooter, { className: "aui-thread-viewport-footer", children: [
      !e && !c ? /* @__PURE__ */ r(
        pe.ScrollToBottom,
        {
          className: "aui-scroll-bottom-btn aui-scroll-bottom",
          "aria-label": "滚到最新",
          children: /* @__PURE__ */ r(Xe, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
        }
      ) : null,
      o ? /* @__PURE__ */ r(ot, {}) : /* @__PURE__ */ r(
        it,
        {
          isRunning: a,
          branchBusy: c || m,
          mode: "reading",
          onModeChange: y,
          selectionContext: v,
          onClearSelectionContext: I
        }
      )
    ] })
  ] });
}
function wn({
  jobId: t,
  messages: e,
  citationsByMessageId: n,
  progressByMessageId: s,
  streamingAssistantId: i,
  isRunning: a,
  missingLlmKey: o,
  branchBusy: c,
  agentRequestBlocked: m = !1,
  agentOperationPanel: y,
  assistantMode: M = "reading",
  onAssistantModeChange: A,
  onJumpCitation: v,
  onBranchFromAnswer: I,
  selectionContext: l = null,
  onClearSelectionContext: T
}) {
  const B = e.length === 0, b = M === "operations";
  return /* @__PURE__ */ r(
    pe.Root,
    {
      className: `aui-thread aui-thread-root${o ? " is-llm-locked" : ""}`,
      "data-chat-ui": "assistant-ui-official-thread",
      children: /* @__PURE__ */ r(
        pe.Viewport,
        {
          className: "aui-viewport",
          "data-slot": "aui_thread-viewport",
          "data-reader-ai-viewport": "true",
          turnAnchor: "top",
          autoScroll: !0,
          children: /* @__PURE__ */ r("div", { className: `aui-thread-inner${B ? " is-empty" : ""}`, children: b ? /* @__PURE__ */ r(
            hn,
            {
              jobId: t,
              empty: B,
              citationsByMessageId: n,
              progressByMessageId: s,
              streamingAssistantId: i,
              isRunning: a,
              missingLlmKey: o,
              branchBusy: c,
              agentRequestBlocked: m,
              agentOperationPanel: y,
              onModeChange: A,
              onJumpCitation: v,
              onBranchFromAnswer: I
            }
          ) : /* @__PURE__ */ r(
            yn,
            {
              jobId: t,
              empty: B,
              citationsByMessageId: n,
              progressByMessageId: s,
              streamingAssistantId: i,
              isRunning: a,
              missingLlmKey: o,
              branchBusy: c,
              composerDisabled: m,
              onModeChange: A,
              onJumpCitation: v,
              onBranchFromAnswer: I,
              selectionContext: l,
              onClearSelectionContext: T
            }
          ) })
        }
      )
    }
  );
}
const ct = "retainpdf.reader-agent-operation.dismissed.v1", vn = /* @__PURE__ */ new Set(["failed", "cancelled"]);
function Ke(t) {
  return [
    `${t.operation_id || ""}`.trim(),
    Number(t.current_attempt) || 0,
    `${t.status || ""}`
  ].join(":");
}
function In() {
  var t;
  try {
    const e = JSON.parse(((t = globalThis.localStorage) == null ? void 0 : t.getItem(ct)) || "[]");
    return new Set(Array.isArray(e) ? e.filter((n) => typeof n == "string") : []);
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function bn(t) {
  var e;
  try {
    (e = globalThis.localStorage) == null || e.setItem(
      ct,
      JSON.stringify(Array.from(t).slice(-100))
    );
  } catch {
  }
}
function dt(t, e) {
  switch (t) {
    case "draft":
    case "awaiting_confirmation":
      return e === "green_light" ? "等待自动执行" : "等待确认";
    case "queued":
      return "等待执行";
    case "running":
      return "正在执行";
    case "validating":
      return "正在验证";
    case "result_ready":
      return e === "green_light" ? "等待自动应用" : "候选已就绪";
    case "committed":
      return e === "green_light" ? "AI 已直接应用" : "已应用";
    case "failed":
      return "执行失败";
    case "cancelled":
      return "已取消";
    case "ambiguous":
      return "结果不确定";
    default:
      return `${t}`;
  }
}
function _n(t) {
  switch (t) {
    case "draft":
    case "awaiting_confirmation":
      return [
        { action: "cancel", label: "拒绝" },
        { action: "run", label: "确认执行", primary: !0 }
      ];
    case "queued":
    case "running":
    case "validating":
      return [{ action: "cancel", label: "取消 PDF 操作", danger: !0 }];
    case "result_ready":
      return [
        { action: "cancel", label: "拒绝候选" },
        { action: "commit", label: "接受并应用", primary: !0 }
      ];
    case "failed":
      return [{ action: "retry", label: "重试", primary: !0 }];
    case "ambiguous":
      return [{ action: "retry", label: "确认风险并重试", danger: !0, risk: !0 }];
    default:
      return [];
  }
}
function Nn(t) {
  return t === "failed" || t === "ambiguous" ? et : t === "cancelled" ? Te : t === "committed" || t === "result_ready" ? tt : ["queued", "running", "validating"].includes(t) ? Ee : Et;
}
function Rn({ events: t, mode: e }) {
  return /* @__PURE__ */ r("ol", { className: "reader-agent-operation-timeline", "aria-label": "PDF 操作步骤", children: t.map((n) => {
    const s = Nn(n.status), i = ["queued", "running", "validating"].includes(n.status);
    return /* @__PURE__ */ E("li", { children: [
      /* @__PURE__ */ r(s, { className: i ? "is-spinning" : "", size: 12, "aria-hidden": !0 }),
      /* @__PURE__ */ r("span", { children: n.summary || n.event || dt(n.status, e) }),
      /* @__PURE__ */ r("time", { children: n.ts ? new Date(n.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "" })
    ] }, `${n.attempt}:${n.seq}`);
  }) });
}
function kn({
  operation: t,
  loadCandidate: e
}) {
  const [n, s] = Q(!1), [i, a] = Q(""), [o, c] = Q(""), m = H("");
  return Z(() => {
    let y = !1;
    return c(""), e(t).then((M) => {
      if (y) return;
      const A = URL.createObjectURL(M);
      m.current && URL.revokeObjectURL(m.current), m.current = A, a(A);
    }).catch(() => {
      y || c("候选 PDF 加载失败，请重试。");
    }), () => {
      y = !0;
    };
  }, [e, t.operation_id, t.current_attempt]), Z(() => () => {
    m.current && URL.revokeObjectURL(m.current);
  }, []), /* @__PURE__ */ E($e, { children: [
    /* @__PURE__ */ E("div", { className: "reader-agent-operation-candidate", children: [
      /* @__PURE__ */ E("div", { children: [
        /* @__PURE__ */ r(qe, { size: 13, "aria-hidden": !0 }),
        /* @__PURE__ */ r("span", { children: "候选 PDF" })
      ] }),
      /* @__PURE__ */ r("button", { type: "button", disabled: !i, onClick: () => s((y) => !y), children: i ? n ? "收起" : "预览" : "加载中…" }),
      /* @__PURE__ */ r(
        "button",
        {
          type: "button",
          disabled: !i,
          "aria-label": "新窗口打开候选 PDF",
          onClick: () => window.open(i, "_blank", "noopener,noreferrer"),
          children: /* @__PURE__ */ r(Tt, { size: 12, "aria-hidden": !0 })
        }
      )
    ] }),
    n ? /* @__PURE__ */ r("iframe", { className: "reader-agent-operation-preview", src: i, title: "候选 PDF 预览" }) : null,
    o ? /* @__PURE__ */ r("p", { className: "reader-agent-operation-error", role: "alert", children: o }) : null
  ] });
}
function Mn({
  entry: t,
  mode: e,
  loadCandidate: n,
  onAction: s,
  onDismiss: i
}) {
  var B;
  const { operation: a, pendingAction: o, error: c } = t, [m, y] = Q(!1), [M, A] = Q(!1), v = a.events || [], I = _n(a.status), l = !!((a.status === "result_ready" || a.status === "committed") && a.candidate_available), T = vn.has(a.status);
  return /* @__PURE__ */ E("article", { className: `reader-agent-operation-card is-${a.status}`, "data-operation-id": a.operation_id, children: [
    /* @__PURE__ */ E("header", { children: [
      /* @__PURE__ */ r("span", { className: "reader-agent-operation-icon", "aria-hidden": !0, children: /* @__PURE__ */ r(St, { size: 15 }) }),
      /* @__PURE__ */ E("div", { className: "reader-agent-operation-title", children: [
        /* @__PURE__ */ r("span", { children: "PDF 操作" }),
        /* @__PURE__ */ r("strong", { children: a.intent_summary || "处理当前 PDF" })
      ] }),
      /* @__PURE__ */ E("div", { className: "reader-agent-operation-head-actions", children: [
        /* @__PURE__ */ r("span", { className: "reader-agent-operation-status", children: dt(a.status, e) }),
        T ? /* @__PURE__ */ r(
          "button",
          {
            type: "button",
            className: "reader-agent-operation-dismiss",
            "aria-label": a.status === "failed" ? "隐藏这条失败提示" : "隐藏这条已取消提示",
            title: "隐藏",
            onClick: () => i(a),
            children: /* @__PURE__ */ r(Te, { size: 13, "aria-hidden": !0 })
          }
        ) : null
      ] })
    ] }),
    (B = a.affected_pages) != null && B.length ? /* @__PURE__ */ E("p", { className: "reader-agent-operation-scope", children: [
      "影响页码：",
      a.affected_pages.join("、")
    ] }) : null,
    v.length ? /* @__PURE__ */ E("div", { className: "reader-agent-operation-details", children: [
      /* @__PURE__ */ E("button", { type: "button", onClick: () => y((b) => !b), children: [
        m ? /* @__PURE__ */ r($t, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ r(Ze, { size: 12, "aria-hidden": !0 }),
        m ? "收起步骤" : `执行步骤 ${v.length}`
      ] }),
      m ? /* @__PURE__ */ r(Rn, { events: v, mode: e }) : null
    ] }) : null,
    l ? /* @__PURE__ */ r(kn, { operation: a, loadCandidate: n }) : null,
    c ? /* @__PURE__ */ r("p", { className: "reader-agent-operation-error", role: "alert", children: c }) : null,
    M ? /* @__PURE__ */ E("div", { className: "reader-agent-operation-risk", role: "alertdialog", "aria-label": "确认重复执行风险", children: [
      /* @__PURE__ */ r(et, { size: 14, "aria-hidden": !0 }),
      /* @__PURE__ */ r("p", { children: "上一次执行结果不确定，重试可能重复操作。确认接受风险后再继续。" }),
      /* @__PURE__ */ E("div", { children: [
        /* @__PURE__ */ r("button", { type: "button", onClick: () => A(!1), disabled: !!o, children: "返回" }),
        /* @__PURE__ */ r(
          "button",
          {
            type: "button",
            className: "is-danger",
            disabled: !!o,
            onClick: async () => {
              await s("retry", a, { acceptDuplicateRisk: !0 }), A(!1);
            },
            children: o === "retry" ? "处理中…" : "接受风险并重试"
          }
        )
      ] })
    ] }) : I.length ? /* @__PURE__ */ r("div", { className: "reader-agent-operation-actions", children: I.map((b) => /* @__PURE__ */ r(
      "button",
      {
        type: "button",
        className: b.primary ? "is-primary" : b.danger ? "is-danger" : "",
        disabled: !!o,
        onClick: () => {
          b.risk ? A(!0) : s(b.action, a);
        },
        children: o === b.action ? "处理中…" : b.label
      },
      b.action
    )) }) : null
  ] });
}
function Cn({
  entries: t,
  confirmationMode: e,
  runtimeRestarting: n,
  loadCandidate: s,
  onAction: i
}) {
  const [a, o] = Q(In), c = t.filter((y) => !a.has(Ke(y.operation)));
  function m(y) {
    const M = Ke(y);
    o((A) => {
      const v = new Set(A);
      return v.add(M), bn(v), v;
    });
  }
  return /* @__PURE__ */ E("section", { className: `reader-agent-operations${c.length ? " has-operations" : ""}`, "aria-label": "AI PDF 操作", children: [
    /* @__PURE__ */ E("div", { className: `reader-agent-mode${e === "green_light" ? " is-green" : ""}`, children: [
      /* @__PURE__ */ r(At, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ r("span", { children: e === "green_light" ? "绿灯模式 · 自动执行并应用" : "需要确认 · 操作前等待授权" })
    ] }),
    n ? /* @__PURE__ */ E("div", { className: "reader-agent-restarting", role: "status", children: [
      /* @__PURE__ */ r(Ee, { className: "is-spinning", size: 13, "aria-hidden": !0 }),
      "正在重启 Agent，新请求暂不可用"
    ] }) : null,
    c.map((y) => /* @__PURE__ */ r(
      Mn,
      {
        entry: y,
        mode: e,
        loadCandidate: s,
        onAction: i,
        onDismiss: m
      },
      y.operation.operation_id
    ))
  ] });
}
const An = (t) => t, Sn = Object.freeze([]), $n = Object.freeze({}), Ue = Object.freeze({}), Tn = Object.freeze({
  entries: [],
  confirmationMode: "explicit",
  runtimeRestarting: !1,
  runtimeCredentialConfigured: !1,
  perform: async () => {
  },
  loadCandidate: async () => new Blob()
});
function En(t) {
  return t.content.filter((e) => e.type === "text").map((e) => e.text).join(`
`).trim();
}
function xn(t, e, n) {
  var s, i, a, o;
  return ((s = t.status) == null ? void 0 : s.type) === "running" || n && e === t.id ? { type: "running" } : ((i = t.status) == null ? void 0 : i.type) === "incomplete" || ((a = t.status) == null ? void 0 : a.type) === "error" ? {
    type: "incomplete",
    reason: ((o = t.status) == null ? void 0 : o.reason) === "cancelled" ? "cancelled" : "error"
  } : { type: "complete", reason: "stop" };
}
function Pn({
  jobId: t = "",
  messages: e = Sn,
  citationsByMessageId: n = $n,
  progressByMessageId: s = Ue,
  contentByMessageId: i = Ue,
  streamingAssistantId: a = "",
  isRunning: o = !1,
  onSubmit: c,
  onRetry: m,
  onCancel: y,
  onJumpCitation: M,
  onBranchFromAnswer: A,
  branchBusy: v = !1,
  agentOperations: I = Tn,
  assistantMode: l = "reading",
  onAssistantModeChange: T,
  selectionContext: B = null,
  onClearSelectionContext: b
}) {
  const [, z] = Q(0);
  Z(() => {
    const u = () => z((f) => f + 1);
    return window.addEventListener("focus", u), window.addEventListener("storage", u), document.addEventListener(Be, u), () => {
      window.removeEventListener("focus", u), window.removeEventListener("storage", u), document.removeEventListener(Be, u);
    };
  }, []);
  const j = !Wt() && !I.runtimeCredentialConfigured, S = ae(() => e.map((u) => ({
    id: u.id,
    role: u.role,
    content: i[u.id] || u.content || "",
    ...u.role === "assistant" ? { status: xn(u, a, o) } : {}
  })), [i, o, e, a]), D = X(async (u) => {
    const f = u ? Math.max(0, e.findIndex((g) => g.id === u) + 1) : 0, p = e.slice(f).find((g) => g.role === "assistant");
    p && await m(p.id);
  }, [e, m]), O = X(async (u) => {
    const f = En(u);
    !f || o || v || I.runtimeRestarting || j || await c(f);
  }, [I.runtimeRestarting, v, o, j, c]), N = X(async () => {
    await y();
  }, [y]), k = ae(() => ({
    messages: S,
    isRunning: o,
    isDisabled: v || I.runtimeRestarting || j,
    convertMessage: An,
    onNew: O,
    onReload: D,
    onCancel: N
  }), [
    I.runtimeRestarting,
    v,
    N,
    O,
    o,
    j,
    D,
    S
  ]), h = Ft(k);
  return /* @__PURE__ */ r(qt, { runtime: h, children: /* @__PURE__ */ r(
    wn,
    {
      jobId: t,
      messages: e,
      citationsByMessageId: n,
      progressByMessageId: s,
      streamingAssistantId: a,
      isRunning: o,
      missingLlmKey: j,
      branchBusy: v,
      agentRequestBlocked: I.runtimeRestarting,
      assistantMode: l,
      onAssistantModeChange: T,
      selectionContext: B,
      onClearSelectionContext: b,
      agentOperationPanel: I.entries.length > 0 || I.runtimeRestarting ? /* @__PURE__ */ r(
        Cn,
        {
          entries: I.entries,
          confirmationMode: I.confirmationMode,
          runtimeRestarting: I.runtimeRestarting,
          loadCandidate: I.loadCandidate,
          onAction: I.perform
        }
      ) : null,
      onJumpCitation: M,
      onBranchFromAnswer: A
    }
  ) });
}
function Se(t = 900, e = 0) {
  ye(t, { overlayDelayMs: e }), me(t);
}
function On({
  sessions: t,
  activeId: e,
  busy: n = !1,
  disabled: s = !1,
  errorText: i = "",
  onSwitch: a,
  onNew: o,
  onDelete: c,
  onRename: m
}) {
  const y = t.length > 0, M = n || s, [A, v] = Q(!1), [I, l] = Q(""), [T, B] = Q(""), b = H(null), z = yt();
  function j(g) {
    const x = `${g || ""}`.match(/^fork-(\d+)-(.*)$/i);
    if (!x) return g;
    const W = x[2].trim();
    return W ? `${W} · 分支${x[1]}` : `分支${x[1]}`;
  }
  const S = H(!1), D = H(null), O = t.find((g) => g.id === e) || null, N = O ? O.messageCount ? j(O.title) : `${j(O.title)}（空）` : y ? "选择以往对话" : "新对话";
  Z(() => {
    if (!A) {
      l("");
      return;
    }
    const g = (C) => {
      if (S.current) return;
      const P = b.current;
      P && (C.target instanceof Node && P.contains(C.target) || (v(!1), l("")));
    }, x = (C) => {
      C.key === "Escape" && (v(!1), l(""));
    }, W = window.setTimeout(() => {
      document.addEventListener("pointerdown", g, !0);
    }, 0);
    return document.addEventListener("keydown", x), () => {
      window.clearTimeout(W), document.removeEventListener("pointerdown", g, !0), document.removeEventListener("keydown", x);
    };
  }, [A]), Z(() => {
    if (!I) return;
    const g = D.current;
    g && (g.focus(), g.select());
  }, [I]);
  const k = (g) => {
    const x = `${g || ""}`.trim();
    !x || M || S.current || I || (S.current = !0, Se(1e3, 0), requestAnimationFrame(() => {
      v(!1), window.setTimeout(() => {
        (async () => {
          try {
            await a(x);
          } finally {
            Se(400, 0), S.current = !1;
          }
        })();
      }, 40);
    }));
  }, h = (g) => {
    M || (l(g.id), B(g.title || ""));
  }, u = () => {
    const g = I, x = T;
    l(""), g && m(g, x);
  }, f = () => {
    l(""), B("");
  }, p = (g) => {
    var C;
    if (M || S.current) return;
    const x = g.title || "未命名对话";
    (C = globalThis.confirm) != null && C.call(globalThis, `确定删除对话「${x}」？此操作不可恢复。`) && (S.current = !0, Se(800, 0), (async () => {
      try {
        await c(g.id);
      } finally {
        S.current = !1;
      }
    })());
  };
  return /* @__PURE__ */ E(
    "div",
    {
      className: "aui-session-bar",
      "data-reader-ai-sessions": "",
      ref: b,
      onPointerDown: (g) => {
        g.stopPropagation();
      },
      onClick: (g) => {
        g.stopPropagation();
      },
      children: [
        /* @__PURE__ */ E("div", { className: "aui-session-row", children: [
          /* @__PURE__ */ E(
            "button",
            {
              type: "button",
              className: `aui-session-trigger${A ? " is-open" : ""}`,
              "aria-label": "切换对话窗口",
              "aria-haspopup": "listbox",
              "aria-expanded": A,
              "aria-controls": z,
              disabled: M || !y,
              title: N,
              onClick: () => {
                M || !y || v((g) => !g);
              },
              children: [
                /* @__PURE__ */ r("span", { className: "aui-session-trigger-label", children: N }),
                /* @__PURE__ */ r(Ze, { size: 14, strokeWidth: 2.4, "aria-hidden": !0 })
              ]
            }
          ),
          /* @__PURE__ */ E(
            "button",
            {
              type: "button",
              className: "aui-session-btn",
              disabled: M,
              title: "新对话窗口",
              "aria-label": "新对话",
              onClick: () => {
                M || S.current || (S.current = !0, Se(800), v(!1), l(""), window.setTimeout(() => {
                  (async () => {
                    try {
                      await o();
                    } finally {
                      S.current = !1;
                    }
                  })();
                }, 40));
              },
              children: [
                n ? /* @__PURE__ */ r(Ee, { className: "aui-spin", size: 14, strokeWidth: 2.4, "aria-hidden": !0 }) : /* @__PURE__ */ r(xt, { size: 14, strokeWidth: 2.4, "aria-hidden": !0 }),
                /* @__PURE__ */ r("span", { children: "新对话" })
              ]
            }
          )
        ] }),
        A && y ? /* @__PURE__ */ r(
          "ul",
          {
            id: z,
            className: "aui-session-list",
            role: "listbox",
            "aria-label": "以往对话",
            children: t.map((g) => {
              const x = g.messageCount ? j(g.title) : `${j(g.title)}（空）`, W = g.id === e, C = I === g.id;
              return /* @__PURE__ */ r("li", { className: "aui-session-row-item", role: "presentation", children: C ? /* @__PURE__ */ E("div", { className: "aui-session-edit", children: [
                /* @__PURE__ */ r(
                  "input",
                  {
                    ref: D,
                    className: "aui-session-edit-input",
                    value: T,
                    maxLength: 80,
                    "aria-label": "对话标题",
                    disabled: M,
                    onChange: (P) => B(P.target.value),
                    onKeyDown: (P) => {
                      P.key === "Enter" ? (P.preventDefault(), u()) : P.key === "Escape" && (P.preventDefault(), f());
                    },
                    onClick: (P) => P.stopPropagation()
                  }
                ),
                /* @__PURE__ */ r(
                  "button",
                  {
                    type: "button",
                    className: "aui-session-icon-btn",
                    "aria-label": "保存标题",
                    title: "保存",
                    disabled: M || !T.trim(),
                    onClick: (P) => {
                      P.stopPropagation(), u();
                    },
                    children: /* @__PURE__ */ r(tt, { size: 13, strokeWidth: 2.5, "aria-hidden": !0 })
                  }
                ),
                /* @__PURE__ */ r(
                  "button",
                  {
                    type: "button",
                    className: "aui-session-icon-btn",
                    "aria-label": "取消重命名",
                    title: "取消",
                    disabled: M,
                    onClick: (P) => {
                      P.stopPropagation(), f();
                    },
                    children: /* @__PURE__ */ r(Te, { size: 13, strokeWidth: 2.5, "aria-hidden": !0 })
                  }
                )
              ] }) : /* @__PURE__ */ E($e, { children: [
                /* @__PURE__ */ E(
                  "button",
                  {
                    type: "button",
                    role: "option",
                    "aria-selected": W,
                    className: `aui-session-item${W ? " is-active" : ""}`,
                    disabled: M,
                    title: x,
                    onPointerDown: (P) => {
                      P.stopPropagation(), !W && !M && me(1e3);
                    },
                    onClick: (P) => {
                      if (P.preventDefault(), P.stopPropagation(), W) {
                        v(!1);
                        return;
                      }
                      k(g.id);
                    },
                    children: [
                      /* @__PURE__ */ r("span", { className: "aui-session-item-title", children: x }),
                      W ? /* @__PURE__ */ r("span", { className: "aui-session-item-badge", children: "当前" }) : null
                    ]
                  }
                ),
                /* @__PURE__ */ r(
                  "button",
                  {
                    type: "button",
                    className: "aui-session-icon-btn",
                    "aria-label": `重命名 ${x}`,
                    title: "重命名",
                    disabled: M,
                    onClick: (P) => {
                      P.preventDefault(), P.stopPropagation(), h(g);
                    },
                    children: /* @__PURE__ */ r(Pt, { size: 13, strokeWidth: 2.4, "aria-hidden": !0 })
                  }
                ),
                /* @__PURE__ */ r(
                  "button",
                  {
                    type: "button",
                    className: "aui-session-icon-btn is-danger",
                    "aria-label": `删除 ${x}`,
                    title: "删除",
                    disabled: M,
                    onClick: (P) => {
                      P.preventDefault(), P.stopPropagation(), p(g);
                    },
                    children: /* @__PURE__ */ r(Ot, { size: 13, strokeWidth: 2.4, "aria-hidden": !0 })
                  }
                )
              ] }) }, g.id);
            })
          }
        ) : null,
        i ? /* @__PURE__ */ r("div", { className: "aui-session-error", role: "alert", children: i }) : null
      ]
    }
  );
}
const Dn = {
  search_markdown: "检索 Markdown",
  read_markdown_chunk: "阅读 Markdown 片段",
  list_documents: "确认文档信息",
  read_blocks: "阅读相关段落",
  search_favorites: "查找收藏",
  search_fulltext: "检索文档内容"
};
function Fn(t) {
  const e = typeof t == "string" ? t : t.tool || t.event || t.type || "";
  return Dn[e] || (e ? `执行 ${e}` : "处理中");
}
function lt(t) {
  return ((t == null ? void 0 : t.parts) || []).filter((e) => e.type === "text").map((e) => e.text).join("").trim();
}
function qn(t, e) {
  const n = `${e.question || ""}`.trim();
  if (n) return n;
  for (let s = t.length - 1; s >= 0; s -= 1) {
    const i = t[s];
    if (i.role !== "user") continue;
    const a = lt(i);
    if (a) return a;
  }
  return "";
}
function zn(t) {
  const e = Number(t == null ? void 0 : t.status) || 0, n = `${(t == null ? void 0 : t.message) || ""}`;
  return e === 502 || /\b502\b/.test(n);
}
class Ln {
  constructor(e) {
    this.options = e;
  }
  async sendMessages({
    abortSignal: e,
    body: n,
    messages: s,
    trigger: i
  }) {
    var l, T, B, b;
    const a = n || {}, o = qn(s, a);
    if (!o) throw new Error("请输入问题。");
    const c = a.assistantMode || ((T = (l = this.options).getAssistantMode) == null ? void 0 : T.call(l)) || "reading", m = a.scope || "document", y = a.context ? { ...a.context } : null, M = `${a.assistantMessageId || ""}`.trim() || `a-${Date.now().toString(36)}`, A = `${M}-text`, v = this.options.getRemoteAnswerer(), I = ((b = (B = this.options).getLocalAnswerer) == null ? void 0 : b.call(B)) || null;
    if (!v && !I)
      throw new Error("问答暂不可用：请确认已打开任务阅读器。");
    return new ReadableStream({
      start: (z) => {
        let j = !1, S = "", D = {
          citations: [],
          progress: i === "regenerate-message" ? "正在重新生成…" : "正在检索文档…",
          status: "running"
        };
        const O = (k) => {
          j || z.enqueue(k);
        }, N = (k) => {
          D = { ...D, ...k }, O({ type: "message-metadata", messageMetadata: D });
        };
        O({ type: "start", messageId: M, messageMetadata: D }), O({ type: "start-step" }), O({ type: "text-start", id: A }), (async () => {
          var k, h, u, f, p, g;
          try {
            if (await ((k = v == null ? void 0 : v.ensureLoaded) == null ? void 0 : k.call(v, this.options.jobId)), e != null && e.aborted) throw new Error("aborted");
            let x = v || I, W = !1, C;
            try {
              C = await x.answer({
                question: o,
                assistantMode: c,
                scope: m,
                context: y,
                parentId: `${a.parentId || ""}`.trim(),
                regenerate: a.regenerate ?? i === "regenerate-message",
                userMessageId: `${a.userMessageId || ""}`.trim(),
                assistantMessageId: M,
                onAgentSessionEvent: ($) => {
                  var oe, ce, _e;
                  const K = (oe = $ == null ? void 0 : $.capabilities) == null ? void 0 : oe.document_operation_confirmation_mode;
                  (K === "explicit" || K === "green_light") && ((_e = (ce = this.options).onConfirmationMode) == null || _e.call(ce, K));
                },
                onAgentOperationEvent: ($) => {
                  var oe, ce;
                  const K = `${($ == null ? void 0 : $.operation_id) || ""}`.trim();
                  K && ((ce = (oe = this.options).onAgentOperationSignal) == null || ce.call(oe, {
                    operationId: K,
                    conversationId: `${($ == null ? void 0 : $.conversation_id) || ""}`.trim() || void 0
                  }));
                },
                onAgentConfirmationRequiredEvent: ($) => {
                  var oe, ce;
                  const K = `${($ == null ? void 0 : $.operation_id) || ""}`.trim();
                  K && ((ce = (oe = this.options).onAgentOperationSignal) == null || ce.call(oe, { operationId: K }));
                },
                onToolEvent: ($) => {
                  if (S || e != null && e.aborted) return;
                  const K = Fn($);
                  K && N({ progress: K });
                },
                onProgressEvent: ($) => {
                  if (S || e != null && e.aborted) return;
                  const K = `${($ == null ? void 0 : $.message) || ""}`.trim();
                  K && N({ progress: K });
                },
                onAnswerDelta: ($, K) => {
                  !K || e != null && e.aborted || (S += K, D.progress && N({ progress: "" }), O({ type: "text-delta", id: A, delta: K }));
                },
                onCompress: ($) => {
                  if (S || e != null && e.aborted) return;
                  const K = Number($ == null ? void 0 : $.dropped_turns) || 0;
                  K && N({ progress: `已压缩 ${K} 轮早期对话` });
                },
                signal: e
              });
            } catch ($) {
              if (e != null && e.aborted || c === "operations" || !v || !I || !zn($)) throw $;
              if (W = !0, N({ progress: "在线服务暂不可用，改用本地检索…" }), await ((h = I.ensureLoaded) == null ? void 0 : h.call(I, this.options.jobId)), e != null && e.aborted) throw new Error("aborted");
              x = I, C = await x.answer({
                question: o,
                assistantMode: c,
                scope: m,
                context: y,
                signal: e
              });
            }
            if (e != null && e.aborted) {
              N({ progress: "", status: "cancelled" }), O({ type: "abort", reason: "cancelled" });
              return;
            }
            const P = C == null ? void 0 : C.confirmationMode;
            (P === "explicit" || P === "green_light") && ((f = (u = this.options).onConfirmationMode) == null || f.call(u, P));
            const se = `${(C == null ? void 0 : C.conversationId) || ""}`.trim() || void 0, U = /* @__PURE__ */ new Set();
            for (const $ of (C == null ? void 0 : C.operationRefs) || []) {
              const K = typeof $ == "string" ? $ : `${($ == null ? void 0 : $.operation_id) || ""}`;
              K.trim() && U.add(K.trim());
            }
            for (const $ of (C == null ? void 0 : C.confirmationRequests) || []) {
              const K = `${($ == null ? void 0 : $.operation_id) || ""}`.trim();
              K && U.add(K);
            }
            for (const $ of U)
              (g = (p = this.options).onAgentOperationSignal) == null || g.call(p, {
                operationId: $,
                conversationId: se,
                confirmationMode: P || void 0
              });
            const ne = Kt(C == null ? void 0 : C.citations);
            let le = Ht(
              `${(C == null ? void 0 : C.answer) || S || ""}`.trim() || "没有找到可用回答。",
              ne
            );
            if (W && (le += `

_在线服务暂不可用，以上来自本地文档检索。_`), (C == null ? void 0 : C.persisted) === !1 && (le += `

_⚠️ 本轮回答未能写入历史记录（存储暂时不可用），刷新后可能丢失。_`), !S)
              O({ type: "text-delta", id: A, delta: le });
            else if (le.startsWith(S)) {
              const $ = le.slice(S.length);
              $ && O({ type: "text-delta", id: A, delta: $ });
            }
            O({ type: "text-end", id: A }), N({
              citations: ne,
              persisted: (C == null ? void 0 : C.persisted) !== !1,
              progress: "",
              status: "complete"
            }), O({ type: "finish-step" }), O({ type: "finish", finishReason: "stop", messageMetadata: D });
          } catch (x) {
            e != null && e.aborted ? (N({ progress: "", status: "cancelled" }), O({ type: "abort", reason: "cancelled" })) : (N({ progress: "", status: "error" }), O({
              type: "error",
              errorText: x instanceof Error ? x.message : "生成回答失败，请重试。"
            }));
          } finally {
            j || (j = !0, z.close());
          }
        })();
      }
    });
  }
  async reconnectToStream() {
    return null;
  }
}
function Bn(t) {
  return lt(t);
}
function ut(t) {
  return t.map((e) => {
    var n, s;
    return {
      id: e.id,
      role: e.role,
      metadata: e.role === "assistant" ? {
        citations: e.citations || [],
        progress: e.progress || "",
        status: ((n = e.status) == null ? void 0 : n.type) === "running" ? "running" : ((s = e.status) == null ? void 0 : s.type) === "incomplete" ? e.status.reason === "cancelled" ? "cancelled" : "error" : "complete"
      } : void 0,
      parts: [{ type: "text", text: e.content || "" }]
    };
  });
}
function jn(t) {
  const e = t.metadata || {}, n = e.status === "running", s = e.status === "cancelled" || e.status === "error";
  return {
    id: t.id,
    role: t.role,
    content: Bn(t),
    ...t.role === "assistant" ? {
      citations: e.citations || [],
      progress: e.progress || "",
      status: n ? { type: "running" } : s ? {
        type: "incomplete",
        reason: e.status === "cancelled" ? "cancelled" : "error"
      } : { type: "complete", reason: "stop" }
    } : {}
  };
}
function Wn(t) {
  const e = H(t.remoteAnswerer), n = H(t.localAnswerer), s = H(t.onAgentOperationSignal), i = H(t.onConfirmationMode), a = H(t.assistantMode);
  e.current = t.remoteAnswerer, n.current = t.localAnswerer, s.current = t.onAgentOperationSignal, i.current = t.onConfirmationMode, a.current = t.assistantMode;
  const o = ae(() => new Ut({
    id: `reader-${t.jobId || "idle"}`,
    transport: new Ln({
      jobId: t.jobId,
      getRemoteAnswerer: () => e.current,
      getLocalAnswerer: () => n.current,
      getAssistantMode: () => a.current,
      onAgentOperationSignal: (c) => {
        var m;
        return (m = s.current) == null ? void 0 : m.call(s, c);
      },
      onConfirmationMode: (c) => {
        var m;
        return (m = i.current) == null ? void 0 : m.call(i, c);
      }
    })
  }), [t.jobId]);
  return Z(() => {
    t.enabled || o.stop();
  }, [o, t.enabled]), Z(() => () => {
    o.stop();
  }, [o]), Gt({ chat: o, experimental_throttle: 16 });
}
function Kn(t) {
  for (let e = t.length - 1; e >= 0; e -= 1)
    if (t[e].role === "assistant") return t[e];
}
function Oe(t, e) {
  return {
    version: 1,
    headId: e,
    items: t.map((n) => {
      var s;
      return {
        parentId: n.parentId,
        message: {
          id: n.message.id,
          role: n.message.role,
          content: n.message.content,
          ...n.message.progress ? { progress: n.message.progress } : {},
          ...(s = n.message.citations) != null && s.length ? { citations: n.message.citations } : {},
          ...n.message.status ? {
            status: {
              type: n.message.status.type,
              ...n.message.status.reason ? { reason: `${n.message.status.reason}` } : {}
            }
          } : {}
        }
      };
    })
  };
}
function Ge(t) {
  return {
    items: t.items.map((e) => ({
      parentId: e.parentId,
      message: {
        ...e.message,
        citations: e.message.citations || [],
        status: e.message.status
      }
    })),
    headId: t.headId
  };
}
function fe(t, e) {
  if (!t.length) return [];
  const n = new Map(t.map((c) => [c.message.id, c])), s = e && n.get(e) || t.at(-1);
  if (!s) return [];
  const i = [];
  let a = s;
  const o = /* @__PURE__ */ new Set();
  for (; a && !o.has(a.message.id); )
    o.add(a.message.id), i.push(a.message), a = a.parentId ? n.get(a.parentId) : void 0;
  return i.reverse();
}
function Un(t, e) {
  var n;
  return e ? ((n = t.find((s) => s.message.id === e)) == null ? void 0 : n.message) ?? null : null;
}
function Gn(t, e) {
  const n = new Map(t.map((o) => [o.message.id, o]));
  let s = n.get(e);
  if (!s) return [];
  const i = [], a = /* @__PURE__ */ new Set();
  for (; s && !a.has(s.message.id); )
    a.add(s.message.id), i.push(s), s = s.parentId ? n.get(s.parentId) : void 0;
  return i.reverse();
}
function Hn(t, e, n) {
  var M, A, v, I;
  const s = `${e || ""}`.trim();
  if (!s || !t.length) return [];
  let i = s;
  t.some((l) => l.message.id === i) || (n && t.some((l) => l.message.id === n) ? i = n : i = ((M = [...t].reverse().find((l) => l.message.role === "assistant")) == null ? void 0 : M.message.id) || "");
  let a = Gn(t, i);
  if (a.length >= 2 && ((A = a.at(-1)) == null ? void 0 : A.message.role) === "assistant") return a;
  a.length === 1 && ((v = a[0]) == null ? void 0 : v.message.role) === "user" && (a = []);
  const o = fe(t, n || i);
  let c = o.findIndex((l) => l.id === i);
  if (c < 0 && (c = o.length - 1), c < 0) return a;
  const m = new Map(t.map((l) => [l.message.id, l])), y = o.slice(0, c + 1).map((l) => m.get(l.id)).filter((l) => !!l);
  for (; y.length && ((I = y.at(-1)) == null ? void 0 : I.message.role) !== "assistant"; ) y.pop();
  return y.length ? y : a;
}
function De(t) {
  return t.map((e) => ({
    parentId: e.parentId,
    message: {
      ...e.message,
      citations: e.message.citations || [],
      status: e.message.status
    }
  }));
}
const Vn = {
  stopStream: () => Promise.resolve(),
  clearMessages: () => {
  },
  showMessages: () => {
  }
};
function Yn(t) {
  var ze;
  const {
    jobId: e,
    documentId: n = "",
    enabled: s,
    remoteAnswerer: i = null,
    stream: a = Vn
  } = t, [o, c] = Q([]), [m, y] = Q(null), [M, A] = Q([]), [v, I] = Q(""), [l, T] = Q(!1), [B, b] = Q(""), z = H(o), j = H(m), S = H(v), D = H(!1), O = H(""), N = H(""), k = H(0), h = H(0), u = H(a);
  u.current = a;
  const f = H(i);
  f.current = i, z.current = o, j.current = m, S.current = v;
  const p = X(async (R = "", w) => {
    const d = `${R || N.current || ""}`.trim(), _ = ++h.current;
    if (!d)
      return _ === h.current && (w === void 0 || w === k.current) && A([]), [];
    try {
      const ee = (await Qt({ document_id: d, limit: 50 })).conversations || [];
      return _ === h.current && d === `${N.current || ""}`.trim() && (w === void 0 || w === k.current) ? (A(ee), ee) : null;
    } catch {
      return null;
    }
  }, []), g = X((R, w) => {
    var F;
    const d = De(R), _ = `${w || ""}`.trim() || ((F = d[d.length - 1]) == null ? void 0 : F.message.id) || null;
    c(d), y(_), u.current.showMessages(fe(d, _));
  }, []), x = X(() => `${n || N.current || e}`.trim(), [n, e]);
  Z(() => {
    const R = f.current;
    if (!e) {
      h.current += 1, k.current += 1, c([]), y(null), A([]), I(""), u.current.clearMessages(), S.current = "", O.current = "", N.current = "", D.current = !1;
      return;
    }
    const w = O.current !== e;
    if (w && (h.current += 1, k.current += 1, O.current = e, D.current = !1, c([]), y(null), u.current.clearMessages(), A([]), I(""), S.current = "", N.current = "", T(!1)), !s || !R) {
      h.current += 1;
      return;
    }
    let d = !1;
    return (async () => {
      var J, ue, G, V;
      let _ = `${n || N.current || ""}`.trim();
      if (!_) {
        try {
          _ = `${await ((J = R.getDocumentId) == null ? void 0 : J.call(R)) || ""}`.trim();
        } catch {
          _ = "";
        }
        if (d) return;
      }
      _ && (N.current = _);
      let F = null;
      if (!d && _ && (F = await p(_)), !(w || !z.current.length) || d) {
        d || (D.current = !0);
        return;
      }
      const re = Yt({ jobId: e, documentId: _ }) || `${((ue = R.getConversationId) == null ? void 0 : ue.call(R)) || ""}`.trim();
      if (re) {
        I(re), S.current = re, (G = R.setConversationId) == null || G.call(R, re, _);
        try {
          const L = await Ce(re);
          if (d) return;
          const Y = Ae(L.messages || []);
          if (Y.length) {
            g(Y, L.head_id), requestAnimationFrame(() => {
              d || (D.current = !0);
            });
            return;
          }
        } catch {
        }
      }
      if (!d && _)
        try {
          const L = F ?? await p(_);
          if (d || !L) return;
          const Y = L[0];
          if (Y != null && Y.conversation_id) {
            const te = Y.conversation_id;
            I(te), S.current = te, (V = R.setConversationId) == null || V.call(R, te, _);
            try {
              const de = await Ce(te);
              if (d) return;
              g(
                Ae(de.messages || []),
                de.head_id
              ), requestAnimationFrame(() => {
                d || (D.current = !0);
              });
              return;
            } catch {
            }
          }
        } catch {
        }
      if (d) return;
      const q = je({ jobId: e, documentId: _ }, re);
      if (q != null && q.items.length) {
        const L = Ge(q);
        c(L.items), y(L.headId), u.current.showMessages(fe(L.items, L.headId));
      } else
        c([]), y(null), u.current.clearMessages();
      requestAnimationFrame(() => {
        d || (D.current = !0);
      });
    })(), () => {
      d = !0, h.current += 1;
    };
  }, [e, n, s, p, g]), Z(() => {
    if (!e || !D.current) return;
    const R = v, w = { jobId: e, documentId: n || N.current }, d = window.setTimeout(() => {
      if (!o.length) {
        ve(w, R);
        return;
      }
      Pe(w, Oe(o, m), R);
    }, 280);
    return () => window.clearTimeout(d);
  }, [e, n, o, m, v]);
  const W = ae(
    () => fe(o, m),
    [o, m]
  ), C = ae(() => {
    var w;
    const R = {};
    for (const d of o) {
      const _ = d.message;
      _.role === "assistant" && ((w = _.citations) != null && w.length) && (R[_.id] = _.citations);
    }
    return R;
  }, [o]), P = ae(() => {
    const R = {};
    for (const w of o) {
      const d = w.message;
      d.role === "assistant" && d.progress && (R[d.id] = d.progress);
    }
    return R;
  }, [o]), se = ae(() => {
    const R = {};
    for (const w of o) {
      const d = w.message;
      d.content && (R[d.id] = d.content);
    }
    return R;
  }, [o]), U = ae(() => ({
    readItems: () => z.current,
    readHeadId: () => j.current,
    appendExchange: ({ parentId: R, userId: w, assistantId: d, question: _, progress: F }) => {
      c((ee) => [
        ...ee,
        { parentId: R, message: { id: w, role: "user", content: _ } },
        {
          parentId: w,
          message: {
            id: d,
            role: "assistant",
            content: "",
            progress: F,
            status: { type: "running" },
            citations: []
          }
        }
      ]), y(d);
    },
    appendRetryTurn: ({ assistantId: R, branchParent: w }) => {
      c((d) => [
        ...d,
        {
          parentId: w,
          message: {
            id: R,
            role: "assistant",
            content: "",
            progress: "正在重新生成…",
            status: { type: "running" },
            citations: []
          }
        }
      ]), y(R);
    },
    markRunningCancelled: () => {
      c(
        (R) => R.map(
          (w) => {
            var d;
            return ((d = w.message.status) == null ? void 0 : d.type) === "running" ? {
              ...w,
              message: {
                ...w.message,
                status: { type: "incomplete", reason: "cancelled" },
                progress: "",
                content: w.message.content.trim() || "已取消"
              }
            } : w;
          }
        )
      );
    },
    markRunningAsError: (R) => {
      const w = `${R || ""}`.trim() || "生成回答失败，请重试。";
      c((d) => d.map((_) => {
        var F;
        return ((F = _.message.status) == null ? void 0 : F.type) === "running" ? {
          ..._,
          message: {
            ..._.message,
            content: _.message.content.trim() || w,
            progress: "",
            citations: [],
            status: { type: "incomplete", reason: "error" }
          }
        } : _;
      }));
    },
    mergeChatMirror: (R) => {
      R.size && c((w) => w.map((d) => {
        const _ = R.get(d.message.id);
        return _ ? { ...d, message: { ...d.message, ..._ } } : d;
      }));
    }
  }), []), ne = X(() => {
    var w, d;
    const R = `${((d = (w = f.current) == null ? void 0 : w.getConversationId) == null ? void 0 : d.call(w)) || ""}`.trim();
    R && I(R);
  }, []), le = X(async () => {
    var w, d;
    if (l) return;
    await u.current.stopStream(), ye(900), me(900), T(!0), b("");
    const R = ++k.current;
    try {
      if (await new Promise((ee) => {
        window.setTimeout(ee, 40);
      }), R !== k.current) return;
      const _ = f.current, F = N.current || `${await ((w = _ == null ? void 0 : _.getDocumentId) == null ? void 0 : w.call(_)) || ""}`.trim();
      if (R !== k.current) return;
      N.current = F, (d = _ == null ? void 0 : _.clearConversationId) == null || d.call(_, F), I(""), S.current = "", c([]), y(null), u.current.clearMessages(), ve({ jobId: e, documentId: F }), F && await p(F, R);
    } catch (_) {
      console.warn("[reader-ai] new session failed", _), b("无法创建新对话，请重试。");
    } finally {
      R === k.current && T(!1);
    }
  }, [e, p, l]), $ = X(async (R) => {
    var F, ee, re, q, J, ue, G, V;
    const w = `${R || ""}`.trim(), d = S.current || ((ee = (F = f.current) == null ? void 0 : F.getConversationId) == null ? void 0 : ee.call(F)) || "";
    if (!w || w === d || l) return;
    await u.current.stopStream(), ye(1200), me(1200), T(!0), b("");
    const _ = ++k.current;
    D.current = !1, I(w), S.current = w, c([]), y(null), u.current.clearMessages();
    try {
      if (await new Promise((we) => {
        window.setTimeout(we, 80);
      }), _ !== k.current) return;
      try {
        (J = (q = (re = globalThis.document) == null ? void 0 : re.activeElement) == null ? void 0 : q.blur) == null || J.call(q);
      } catch {
      }
      const L = f.current, Y = N.current || `${await ((ue = L == null ? void 0 : L.getDocumentId) == null ? void 0 : ue.call(L)) || ""}`.trim();
      if (_ !== k.current) return;
      N.current = Y;
      const te = await Ce(w);
      if (_ !== k.current) return;
      ye(800), me(800);
      const de = Ae(te.messages || []);
      if (g(de, te.head_id), (G = L == null ? void 0 : L.setConversationId) == null || G.call(L, w, Y), D.current = !0, de.length) {
        const we = De(de);
        Pe(
          { jobId: e, documentId: Y },
          Oe(
            we,
            `${te.head_id || ""}`.trim() || ((V = we.at(-1)) == null ? void 0 : V.message.id) || null
          ),
          w
        );
      } else
        ve({ jobId: e, documentId: Y }, w);
      Y && await p(Y, _), ye(350), me(350);
    } catch (L) {
      if (console.warn("[reader-ai] switch session failed", L), _ === k.current) {
        b("加载该对话失败，请检查网络后重试。");
        const Y = je(
          { jobId: e, documentId: n || N.current },
          w
        );
        if (Y != null && Y.items.length) {
          const te = Ge(Y);
          c(te.items), y(te.headId), u.current.showMessages(fe(te.items, te.headId));
        } else
          c([]), y(null);
        D.current = !0;
      }
    } finally {
      _ === k.current && T(!1);
    }
  }, [
    g,
    e,
    n,
    p,
    l
  ]), K = X(async (R) => {
    var ee, re, q, J, ue;
    const w = `${R || ""}`.trim();
    if (!w)
      return b("无法分支：消息 id 无效。"), !1;
    if (l)
      return b("请稍候，当前有会话操作进行中。"), !1;
    await u.current.stopStream();
    const d = Hn(z.current, w, j.current);
    if (!d.length)
      return b("无法分支：找不到到此答案的对话路径。"), !1;
    if (d[d.length - 1].message.role !== "assistant")
      return b("只能从助手答案处开新对话。"), !1;
    T(!0), b("");
    const F = ++k.current;
    try {
      if (await new Promise((ie) => {
        window.setTimeout(ie, 40);
      }), F !== k.current) return !1;
      const G = f.current;
      let V = N.current || `${await ((ee = G == null ? void 0 : G.getDocumentId) == null ? void 0 : ee.call(G)) || ""}`.trim();
      if (F !== k.current) return !1;
      if (N.current = V, !V)
        try {
          if (V = `${await ((re = G == null ? void 0 : G.getDocumentId) == null ? void 0 : re.call(G)) || ""}`.trim(), F !== k.current) return !1;
          N.current = V;
        } catch {
          V = "";
        }
      if (!V)
        return b("无法分支：文档未就绪，请稍后重试。"), !1;
      const L = d.map((ie, ke) => ({
        id: ie.message.id,
        role: ie.message.role,
        content: ie.message.content,
        citations: ie.message.citations,
        parentId: ke === 0 ? null : d[ke - 1].message.id
      })), Y = S.current || ((q = G == null ? void 0 : G.getConversationId) == null ? void 0 : q.call(G)) || "", te = (M || []).find((ie) => ie.conversation_id === Y), de = L.find((ie) => ie.role === "user"), we = `${(te == null ? void 0 : te.title) || ""}`.trim() || `${(de == null ? void 0 : de.content) || ""}`.replace(/\s+/g, " ").trim() || "未命名对话", ft = (M || []).map((ie) => ie.title || ""), Le = Jt(we, ft), Ne = await Xt({
        documentId: V,
        title: Le,
        path: L
      });
      if (F !== k.current) return !1;
      const he = De(Ne.items), Re = ((J = he[he.length - 1]) == null ? void 0 : J.message.id) || null, ge = Ne.conversation.conversation_id;
      if (!ge || !he.length)
        throw new Error("fork returned empty conversation");
      return ye(600), me(600), c(he), y(Re), u.current.showMessages(fe(he, Re)), I(ge), S.current = ge, (ue = G == null ? void 0 : G.setConversationId) == null || ue.call(G, ge, V), A((ie) => {
        const ke = {
          conversation_id: ge,
          title: Le,
          document_id: V,
          created_at: Ne.conversation.created_at || (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: Ne.conversation.updated_at || (/* @__PURE__ */ new Date()).toISOString(),
          message_count: he.length,
          head_id: Re || ""
        }, ht = ie.filter((gt) => gt.conversation_id !== ge);
        return [ke, ...ht];
      }), Pe(
        { jobId: e, documentId: V },
        Oe(he, Re),
        ge
      ), await p(V, F), !0;
    } catch (G) {
      return console.warn("[reader-ai] branch from answer failed", G), F === k.current && b("分支失败：未能复制上文到新对话。请检查网络后重试。"), !1;
    } finally {
      F === k.current && T(!1);
    }
  }, [e, p, l, M]), oe = X(async (R) => {
    var _, F, ee, re;
    const w = `${R || ""}`.trim();
    if (!w || l) return;
    await u.current.stopStream(), T(!0), b("");
    const d = ++k.current;
    try {
      const q = f.current, J = N.current || `${await ((_ = q == null ? void 0 : q.getDocumentId) == null ? void 0 : _.call(q)) || ""}`.trim();
      if (d !== k.current) return;
      N.current = J;
      try {
        await Zt(w);
      } catch (V) {
        if ((Number(V == null ? void 0 : V.status) || 0) !== 404) throw V;
      }
      ve({ jobId: e, documentId: J }, w);
      const G = (S.current || ((F = q == null ? void 0 : q.getConversationId) == null ? void 0 : F.call(q)) || "") === w;
      if (A((V) => V.filter((L) => L.conversation_id !== w)), G) {
        (ee = q == null ? void 0 : q.clearConversationId) == null || ee.call(q, J), I(""), S.current = "", c([]), y(null), u.current.clearMessages(), ve({ jobId: e, documentId: J });
        const V = J ? await p(J, d) : [];
        if (d !== k.current || !V) return;
        const L = V[0];
        if (L != null && L.conversation_id) {
          const Y = L.conversation_id;
          I(Y), S.current = Y;
          try {
            const te = await Ce(Y);
            if (d !== k.current) return;
            g(
              Ae(te.messages || []),
              te.head_id
            ), (re = q == null ? void 0 : q.setConversationId) == null || re.call(q, Y, J);
          } catch {
            c([]), y(null);
          }
        }
      } else J && await p(J, d);
    } catch (q) {
      console.warn("[reader-ai] delete session failed", q), b("删除对话失败，请重试。");
    } finally {
      d === k.current && T(!1);
    }
  }, [g, e, p, l]), ce = X(async (R, w) => {
    const d = `${R || ""}`.trim(), _ = `${w || ""}`.replace(/\s+/g, " ").trim();
    if (!d || !_ || l) return;
    T(!0), b("");
    const F = ++k.current;
    try {
      const ee = _.slice(0, 80);
      if (await en(d, { title: ee }), F !== k.current) return;
      A(
        (q) => q.map(
          (J) => J.conversation_id === d ? { ...J, title: ee } : J
        )
      );
      const re = N.current;
      re && await p(re, F);
    } catch (ee) {
      console.warn("[reader-ai] rename session failed", ee), b("重命名失败，请重试。");
    } finally {
      F === k.current && T(!1);
    }
  }, [p, l]), _e = ae(() => {
    var w;
    const R = v || ((w = i == null ? void 0 : i.getConversationId) == null ? void 0 : w.call(i)) || "";
    return (M || []).map((d) => ({
      id: d.conversation_id,
      title: `${d.title || ""}`.trim() || "未命名对话",
      updatedAt: d.updated_at || "",
      messageCount: Number(d.message_count) || 0,
      active: d.conversation_id === R
    }));
  }, [M, v, i]), mt = ae(() => ({
    refreshSessions: p,
    adoptRemoteConversationId: ne,
    newSession: le,
    switchSession: $,
    removeSession: oe,
    renameSession: ce,
    branchFromAnswer: K
  }), [
    p,
    ne,
    le,
    $,
    oe,
    ce,
    K
  ]);
  return {
    items: o,
    headId: m,
    messages: W,
    citationsByMessageId: C,
    progressByMessageId: P,
    contentByMessageId: se,
    sessions: _e,
    activeConversationId: v || ((ze = i == null ? void 0 : i.getConversationId) == null ? void 0 : ze.call(i)) || "",
    sessionBusy: l,
    sessionError: B,
    resolveRequestScopeKey: x,
    tree: U,
    sessionCommands: mt
  };
}
const Qn = "retainpdf.reader.ai.request.v1:", Jn = Object.freeze({
  assistantMode: "reading",
  scope: "document",
  context: null
});
function pt(t, e) {
  return `${Qn}${`${t || ""}`.trim()}:${`${e || ""}`.trim()}`;
}
function Xn(t) {
  if (!t || typeof t != "object" || Array.isArray(t)) return null;
  const e = t, n = e.assistantMode === "operations" ? "operations" : e.assistantMode === "reading" ? "reading" : null, s = e.scope === "selection" || e.scope === "page" || e.scope === "document" ? e.scope : null;
  if (!n || !s) return null;
  const i = e.context && typeof e.context == "object" && !Array.isArray(e.context) ? { ...e.context } : null;
  return { assistantMode: n, scope: s, context: i };
}
function He(t, e, n) {
  var a;
  const s = `${t || ""}`.trim(), i = `${e || ""}`.trim();
  if (!(!s || !i))
    try {
      (a = globalThis.localStorage) == null || a.setItem(
        pt(s, i),
        JSON.stringify(n)
      );
    } catch {
    }
}
function Ve(t, e) {
  var i;
  const n = `${t || ""}`.trim(), s = `${e || ""}`.trim();
  if (!n || !s) return null;
  try {
    const a = (i = globalThis.localStorage) == null ? void 0 : i.getItem(pt(n, s));
    return a ? Xn(JSON.parse(a)) : null;
  } catch {
    return null;
  }
}
function Zn(t) {
  const e = `${t.scopeKey || ""}`.trim(), n = `${t.jobId || ""}`.trim(), s = `${t.assistantMessageId || ""}`.trim();
  return Ve(e, s) || (e !== n ? Ve(n, s) : null) || Jn;
}
function er(t) {
  const { assistantMode: e, selectionContext: n } = t;
  return e === "operations" ? { assistantMode: e, scope: "document", context: null } : n ? { assistantMode: e, scope: "selection", context: { ...n } } : { assistantMode: e, scope: "document", context: null };
}
function Fe(t) {
  return `${t}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function tr(t) {
  var D;
  const { jobId: e, assistantMode: n, selectionContext: s = null, tree: i, chat: a, getScopeKey: o } = t, c = H(i);
  c.current = i;
  const m = H(a);
  m.current = a;
  const y = H(n);
  y.current = n;
  const M = H(s);
  M.current = s;
  const A = H(o);
  A.current = o;
  const v = a.status, I = v === "submitted" || v === "streaming", l = H(I);
  l.current = I;
  const T = I ? `${((D = Kn(a.messages)) == null ? void 0 : D.id) || ""}` : "", B = a.messages, b = a.error;
  Z(() => {
    if (!B.length) return;
    const O = new Map(B.map((k) => [k.id, k])), N = /* @__PURE__ */ new Map();
    for (const [k, h] of O)
      N.set(k, jn(h));
    c.current.mergeChatMirror(N);
  }, [B]), Z(() => {
    !b || v !== "error" || c.current.markRunningAsError(b.message);
  }, [b, v]);
  const z = X(async (O) => {
    if (l.current) return;
    const N = `${O || ""}`.trim();
    if (!N) return;
    const k = c.current, h = m.current, u = y.current, f = M.current, p = A.current(), g = k.readHeadId(), x = Fe("u"), W = Fe("a"), C = er({
      assistantMode: u,
      selectionContext: (f == null ? void 0 : f.selectionType) === "text" ? {
        page: f.page,
        page_idx: Math.max(0, f.page - 1),
        pane: f.pane,
        kind: "text",
        block_id: "",
        quoteText: f.quote
      } : f ? {
        page: f.page,
        page_idx: Math.max(0, f.page - 1),
        pane: f.pane,
        kind: f.kind,
        block_id: f.selectionType === "region" ? f.region.itemId : "",
        quoteText: rt(f.region, f.pane)
      } : null
    });
    He(p, W, C), k.appendExchange({
      parentId: g,
      userId: x,
      assistantId: W,
      question: N,
      progress: C.assistantMode === "operations" ? "正在规划 PDF 操作…" : "正在理解文档…"
    }), await h.sendUserMessage(
      { id: x, role: "user", parts: [{ type: "text", text: N }] },
      {
        body: {
          assistantMessageId: W,
          assistantMode: C.assistantMode,
          parentId: g,
          question: N,
          regenerate: !1,
          userMessageId: x,
          scope: C.scope,
          context: C.context
        }
      }
    );
  }, []), j = X(async (O) => {
    if (l.current) return;
    const N = c.current, k = m.current, h = N.readItems(), u = h.find(
      (U) => U.message.id === O && U.message.role === "assistant"
    ), f = (u == null ? void 0 : u.parentId) ?? null, p = f ? Un(h, f) : null;
    let g = "", x = f;
    if ((p == null ? void 0 : p.role) === "user")
      g = p.content.trim();
    else {
      const U = fe(h, f ?? N.readHeadId());
      for (let ne = U.length - 1; ne >= 0; ne -= 1)
        if (U[ne].role === "user") {
          g = U[ne].content.trim(), x = U[ne].id;
          break;
        }
    }
    if (!g) return;
    const W = Fe("a"), C = x || f, P = A.current(), se = Zn({
      scopeKey: P,
      jobId: e,
      assistantMessageId: O
    });
    He(P, W, se), N.appendRetryTurn({ assistantId: W, branchParent: C }), k.replaceVisible(ut(fe(h, O))), await k.regenerateFrom({
      messageId: O,
      body: {
        assistantMessageId: W,
        assistantMode: se.assistantMode,
        parentId: C,
        question: g,
        regenerate: !0,
        userMessageId: x || "",
        scope: se.scope,
        context: se.context
      }
    });
  }, [e]), S = X(async () => {
    await m.current.stopStream(), c.current.markRunningCancelled();
  }, []);
  return {
    isRunning: I,
    streamingAssistantId: T,
    submitQuestion: z,
    retryAnswer: j,
    cancelAnswer: S
  };
}
const nr = "retainpdf.reader-agent-operation.action-key.v1:", rr = /* @__PURE__ */ new Set(["queued", "running", "validating"]), sr = /* @__PURE__ */ new Set(["draft", "awaiting_confirmation", "result_ready"]);
function Ye(t, e) {
  return rr.has(t) || e === "green_light" && sr.has(t);
}
function Ie(t) {
  return Number(t.latest_event_seq) || Math.max(0, ...(t.events || []).map((e) => Number(e.seq) || 0));
}
function ar(t, e) {
  return t ? e.current_attempt !== t.current_attempt ? e.current_attempt > t.current_attempt : Ie(e) !== Ie(t) ? Ie(e) > Ie(t) : `${e.updated_at || ""}` > `${t.updated_at || ""}` : !0;
}
function ir(t, e) {
  var s, i;
  const n = ((i = (s = globalThis.crypto) == null ? void 0 : s.randomUUID) == null ? void 0 : i.call(s)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `reader-${e}-${t}-${n}`.slice(0, 128);
}
function or(t) {
  return Number(t == null ? void 0 : t.status) || 0;
}
function cr(t) {
  return t instanceof Error && t.message.trim() ? t.message.trim() : "操作请求失败，请重试。";
}
function dr({
  conversationId: t,
  enabled: e,
  discovering: n,
  signal: s,
  confirmationModeHint: i,
  onDocumentCommitted: a
}) {
  const [o, c] = Q({}), [m, y] = Q("explicit"), [M, A] = Q(!1), [v, I] = Q(!1), l = H(/* @__PURE__ */ new Set()), T = H(/* @__PURE__ */ new Map()), B = H(/* @__PURE__ */ new Set()), b = H(/* @__PURE__ */ new Set()), z = X((h, u = !1) => {
    h != null && h.operation_id && c((f) => {
      const p = f[h.operation_id];
      return ar(p == null ? void 0 : p.operation, h) ? {
        ...f,
        [h.operation_id]: {
          ...p,
          operation: h,
          pendingAction: void 0,
          error: void 0
        }
      } : !u || !(p != null && p.pendingAction) ? f : {
        ...f,
        [h.operation_id]: { ...p, pendingAction: void 0 }
      };
    });
  }, []), j = X(async (h, u = !1) => {
    const f = `${h || ""}`.trim(), p = `refresh:${f}`;
    if (!(!f || l.current.has(p))) {
      l.current.add(p);
      try {
        z(await tn(f), u);
      } catch {
      } finally {
        l.current.delete(p);
      }
    }
  }, [z]), S = X(async () => {
    const h = `${t || ""}`.trim(), u = `recover:${h}`;
    if (!(!e || !h || l.current.has(u))) {
      l.current.add(u);
      try {
        const f = await nn({ conversationId: h, limit: 50 });
        if (!b.current.has(h)) {
          for (const p of f.operations || [])
            p.status === "committed" && B.current.add(p.operation_id);
          b.current.add(h);
        }
        for (const p of f.operations || []) z(p);
      } catch {
      } finally {
        l.current.delete(u);
      }
    }
  }, [t, e, z]);
  Z(() => {
    if (!e) return;
    let h = !1;
    const u = async () => {
      try {
        const p = await dn();
        if (h) return;
        y(p.agent_confirmation_mode || "explicit"), I(!!p.llm_api_key_configured), A(
          p.restart_required || p.restart_state === "pending" || p.active_revision !== p.configured_revision
        );
      } catch {
        h || (A(!1), I(!1));
      }
    };
    u();
    const f = window.setInterval(u, 3e3);
    return () => {
      h = !0, window.clearInterval(f);
    };
  }, [e]), Z(() => {
    i && y(i);
  }, [i]), Z(() => {
    s != null && s.confirmationMode && y(s.confirmationMode), s != null && s.operationId && j(s.operationId);
  }, [j, s]), Z(() => {
    S();
  }, [S]), Z(() => {
    n || S();
  }, [n, S]);
  const D = ae(
    () => Object.values(o).filter((h) => !!t && h.operation.conversation_id === t).sort((h, u) => `${h.operation.created_at || ""}`.localeCompare(`${u.operation.created_at || ""}`)),
    [t, o]
  );
  Z(() => {
    var h;
    for (const u of D) {
      const f = u.operation;
      f.status !== "committed" || B.current.has(f.operation_id) || (B.current.add(f.operation_id), a == null || a({
        documentId: f.document_id,
        revision: ((h = f.candidate) == null ? void 0 : h.version_id) || `${f.updated_at || ""}` || `${f.operation_id}:${Ie(f)}`
      }));
    }
  }, [D, a]);
  const O = D.some((h) => Ye(h.operation.status, m));
  Z(() => {
    if (!e || !t || !n && !O) return;
    const h = window.setInterval(() => {
      S();
      for (const u of D)
        Ye(u.operation.status, m) && j(u.operation.operation_id);
    }, 1400);
    return () => window.clearInterval(h);
  }, [m, t, n, e, D, O, S, j]), Z(() => {
    if (!e) return;
    const h = () => void S(), u = () => {
      document.visibilityState === "visible" && h();
    };
    return window.addEventListener("online", h), document.addEventListener("visibilitychange", u), () => {
      window.removeEventListener("online", h), document.removeEventListener("visibilitychange", u);
    };
  }, [e, S]);
  const N = X(async (h, u, f = {}) => {
    const p = `${u.operation_id || ""}`.trim(), g = `action:${p}`;
    if (!p || l.current.has(g)) return;
    if (h === "retry" && u.status === "ambiguous" && f.acceptDuplicateRisk !== !0) {
      c((U) => ({
        ...U,
        [p]: {
          ...U[p],
          error: "请先确认重复执行风险，再重新执行操作。"
        }
      }));
      return;
    }
    const x = `${p}:${h}`, W = `${nr}${x}`;
    let C = "";
    try {
      C = `${sessionStorage.getItem(W) || ""}`.trim();
    } catch {
    }
    const P = T.current.get(x) || C || ir(p, h);
    T.current.set(x, P);
    try {
      sessionStorage.setItem(W, P);
    } catch {
    }
    l.current.add(g), c((U) => ({
      ...U,
      [p]: { ...U[p], pendingAction: h, error: void 0 }
    }));
    const se = {
      idempotency_key: P,
      expected_status: u.status,
      expected_attempt: u.current_attempt,
      expected_program_sha256: u.program_sha256 || ""
    };
    try {
      let U;
      h === "run" ? U = await rn(p, se) : h === "cancel" ? U = await sn(p, { ...se, reason: "user_rejected" }) : h === "commit" ? U = await an(p, se) : U = await on(p, f.acceptDuplicateRisk ? { ...se, accept_duplicate_risk: !0 } : se), T.current.delete(x);
      try {
        sessionStorage.removeItem(W);
      } catch {
      }
      z(U, !0);
    } catch (U) {
      if (or(U) === 409) {
        T.current.delete(x);
        try {
          sessionStorage.removeItem(W);
        } catch {
        }
        await j(p, !0);
      } else
        c((ne) => ({
          ...ne,
          [p]: {
            ...ne[p],
            pendingAction: void 0,
            error: cr(U)
          }
        }));
    } finally {
      l.current.delete(g);
    }
  }, [j, z]), k = X((h) => cn(h.operation_id), []);
  return {
    entries: D,
    confirmationMode: m,
    runtimeRestarting: M,
    runtimeCredentialConfigured: v,
    perform: N,
    loadCandidate: k
  };
}
function lr(t) {
  var O;
  const { jobId: e, documentId: n = "", enabled: s, selectionContext: i = null, onDocumentCommitted: a } = t, [o, c] = Q("reading"), [m, y] = Q(null), [M, A] = Q();
  Z(() => {
    c("reading"), y(null), A(void 0);
  }, [e]);
  const v = ae(() => !s || !e ? null : Lt({ jobId: e, documentId: n }), [n, s, e]), I = ae(() => !s || !e ? null : Vt({
    loadMarkdownPayload: Bt.loadMarkdownPayload
  }), [s, e]), l = Wn({
    jobId: e,
    enabled: s,
    remoteAnswerer: v,
    localAnswerer: I,
    assistantMode: o,
    onAgentOperationSignal: (N) => {
      y({ ...N, nonce: Date.now() + Math.random() });
    },
    onConfirmationMode: A
  }), T = ae(() => ({
    messages: l.messages,
    status: l.status,
    error: l.error,
    sendUserMessage: (N, k) => l.sendMessage(
      N,
      k
    ),
    regenerateFrom: (N) => l.regenerate(
      N
    ),
    stopStream: () => l.stop(),
    replaceVisible: (N) => l.setMessages([...N])
  }), [l]), B = ae(() => ({
    stopStream: () => T.stopStream(),
    clearMessages: () => T.replaceVisible([]),
    showMessages: (N) => T.replaceVisible(ut(N))
  }), [T]), b = Yn({
    jobId: e,
    documentId: n,
    enabled: s,
    remoteAnswerer: v,
    stream: B
  }), z = tr({
    jobId: e,
    assistantMode: o,
    selectionContext: i,
    tree: b.tree,
    chat: T,
    getScopeKey: () => b.resolveRequestScopeKey()
  }), j = b.activeConversationId || (m == null ? void 0 : m.conversationId) || `${((O = v == null ? void 0 : v.getConversationId) == null ? void 0 : O.call(v)) || ""}`.trim(), S = dr({
    conversationId: j,
    enabled: s,
    discovering: z.isRunning,
    signal: m,
    confirmationModeHint: M,
    onDocumentCommitted: a
  }), D = H(!1);
  return Z(() => {
    D.current = !1;
  }, [e]), Z(() => {
    D.current && !z.isRunning && (b.sessionCommands.refreshSessions(), b.sessionCommands.adoptRemoteConversationId()), D.current = z.isRunning;
  }, [b, z.isRunning]), {
    citationsByMessageId: b.citationsByMessageId,
    progressByMessageId: b.progressByMessageId,
    contentByMessageId: b.contentByMessageId,
    streamingAssistantId: z.streamingAssistantId,
    isRunning: z.isRunning,
    messages: b.messages,
    sessions: b.sessions,
    activeConversationId: b.activeConversationId,
    sessionBusy: b.sessionBusy,
    sessionError: b.sessionError,
    submitQuestion: z.submitQuestion,
    retryAnswer: z.retryAnswer,
    cancelAnswer: z.cancelAnswer,
    newSession: b.sessionCommands.newSession,
    switchSession: b.sessionCommands.switchSession,
    removeSession: b.sessionCommands.removeSession,
    renameSession: b.sessionCommands.renameSession,
    branchFromAnswer: b.sessionCommands.branchFromAnswer,
    agentOperations: S,
    assistantMode: o,
    setAssistantMode: c
  };
}
function Mr({
  open: t,
  jobId: e,
  documentId: n = "",
  onClose: s,
  onJumpCitation: i,
  onDocumentCommitted: a,
  layout: o = "floating",
  side: c = "right",
  selectionContext: m = null,
  onClearSelectionContext: y
}) {
  const M = t && !!e, {
    citationsByMessageId: A,
    progressByMessageId: v,
    contentByMessageId: I,
    streamingAssistantId: l,
    isRunning: T,
    sessions: B,
    activeConversationId: b,
    sessionBusy: z,
    sessionError: j,
    messages: S,
    submitQuestion: D,
    retryAnswer: O,
    cancelAnswer: N,
    newSession: k,
    switchSession: h,
    removeSession: u,
    renameSession: f,
    branchFromAnswer: p,
    agentOperations: g,
    assistantMode: x,
    setAssistantMode: W
  } = lr({
    jobId: e,
    documentId: n,
    enabled: M,
    selectionContext: m,
    onDocumentCommitted: a
  }), [C, P] = Q(""), se = X(async (ne) => {
    P(""), await p(ne) && (P(
      "已保存新对话（fork-n-原名）：复制了到此答案的上文，原对话不变。顶部列表可切换。"
    ), window.setTimeout(() => P(""), 6e3));
  }, [p]), U = X((ne) => {
    i(ne);
  }, [i]);
  return /* @__PURE__ */ r(
    Dt,
    {
      id: "reader-ai-panel",
      open: t,
      title: "RetainPDF AI",
      titleIcon: /* @__PURE__ */ r(be, { size: 14, strokeWidth: 2.1, "aria-hidden": !0 }),
      storageKey: "retainpdf.reader.ai-float.pos.v2",
      ariaLabel: "阅读问答",
      width: 420,
      placement: o === "workspace" ? "workspace" : o === "docked" ? "dock-right" : "floating",
      showHeader: o !== "workspace",
      className: `reader-float-ai is-${o}${o === "workspace" ? ` is-pane-${c}` : ""}${z ? " is-session-busy" : ""}`,
      onClose: s,
      children: e ? /* @__PURE__ */ E("div", { className: "reader-float-ai-body", children: [
        /* @__PURE__ */ r(
          On,
          {
            sessions: B,
            activeId: b,
            busy: z,
            errorText: j,
            onSwitch: h,
            onNew: k,
            onDelete: u,
            onRename: f
          }
        ),
        C ? /* @__PURE__ */ r("div", { className: "aui-session-banner", role: "status", children: C }) : null,
        /* @__PURE__ */ r("div", { className: "reader-float-ai-thread-wrap", "aria-busy": z || void 0, children: /* @__PURE__ */ r(
          Pn,
          {
            jobId: e,
            messages: S,
            citationsByMessageId: A,
            progressByMessageId: v,
            contentByMessageId: I,
            streamingAssistantId: l,
            isRunning: T,
            onSubmit: D,
            onRetry: O,
            onCancel: N,
            onJumpCitation: U,
            onBranchFromAnswer: se,
            branchBusy: z,
            agentOperations: g,
            assistantMode: x,
            onAssistantModeChange: W,
            selectionContext: m,
            onClearSelectionContext: y
          }
        ) })
      ] }) : /* @__PURE__ */ E("div", { className: "reader-float-ai-empty", children: [
        /* @__PURE__ */ r(be, { size: 22, strokeWidth: 1.75, "aria-hidden": !0 }),
        /* @__PURE__ */ r("p", { children: "当前文档还没有可用于 AI 的解析产物" }),
        /* @__PURE__ */ r("span", { children: "请先完成 OCR 文档解析" })
      ] })
    }
  );
}
export {
  Mr as ReaderAiPanel
};
//# sourceMappingURL=ReaderAiPanel-CEIa3qAz.js.map
