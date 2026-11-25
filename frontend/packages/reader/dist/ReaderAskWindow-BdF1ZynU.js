var Wn = Object.defineProperty;
var Hn = (e, t, o) => t in e ? Wn(e, t, { enumerable: !0, configurable: !0, writable: !0, value: o }) : e[t] = o;
var oe = (e, t, o) => Hn(e, typeof t != "symbol" ? t + "" : t, o);
import { jsx as n, jsxs as u, Fragment as Ze } from "react/jsx-runtime";
import { forwardRef as xe, useState as T, useEffect as L, isValidElement as Gn, useLayoutEffect as me, useRef as A, memo as ie, useCallback as X, useMemo as he, useContext as se, createContext as et, useImperativeHandle as Kn, useId as Vn, useSyncExternalStore as qn } from "react";
import { Rnd as Xn } from "react-rnd";
import { useAuiState as E, useAui as Yn, ComposerPrimitive as U, MessagePrimitive as Q, AttachmentPrimitive as He, AuiIf as D, ThreadPrimitive as ee, useScrollLock as tt, useToolCallElapsed as Jn, toolApprovalAcceptsText as Qn, SuggestionPrimitive as Ue, groupPartByType as Zn, ErrorPrimitive as wt, ActionBarPrimitive as B, BranchPickerPrimitive as pe, ActionBarMorePrimitive as Te, useLocalRuntime as eo, AssistantRuntimeProvider as to, SimpleImageAttachmentAdapter as no, makeAssistantDataUI as Dt } from "@assistant-ui/react";
import { XIcon as ve, Loader2Icon as Ae, AlertCircleIcon as Ut, PlusIcon as oo, FileText as ao, PauseIcon as Ot, PlayIcon as Re, DownloadIcon as nt, FileIcon as Bt, ImageIcon as Wt, FileTextIcon as Tt, BracesIcon as ro, MusicIcon as io, VideoIcon as so, ShieldAlertIcon as lo, ImageOffIcon as co, CopyIcon as Se, RefreshCwIcon as ot, CheckIcon as le, BrainIcon as uo, ChevronDownIcon as at, XCircleIcon as Ht, LoaderIcon as Gt, CircleMinusIcon as mo, ArrowDownIcon as fo, PhoneIcon as go, MicIcon as Kt, AudioLinesIcon as po, SquareIcon as Ct, ArrowUpIcon as ho, TriangleAlertIcon as bo, ChevronLeftIcon as xo, ChevronRightIcon as vo, ThumbsUpIcon as yo, ThumbsDownIcon as ko, MoreHorizontalIcon as No, PencilIcon as wo, MinusIcon as To, RotateCcwIcon as Co, Trash2 as Io, X as zo, Copy as Ao } from "lucide-react";
import { Button as Ce, Select as Ro } from "@retainpdf/ui";
import { b as So, c as _o } from "./ReaderApp-BAj91NT9.js";
import { clsx as Eo } from "clsx";
import { twMerge as Po } from "tailwind-merge";
import { Tooltip as fe, Slot as Vt, Dialog as re, Avatar as rt, Collapsible as it } from "radix-ui";
import { cva as ye } from "class-variance-authority";
import { useShallow as $o } from "zustand/react/shallow";
import { flushSync as Mo, createPortal as Fo } from "react-dom";
import { memoizeMarkdownComponents as qt, MarkdownTextPrimitive as Lo, normalizeMathDelimiters as jo, useIsMarkdownCodeBlock as Do } from "@assistant-ui/react-markdown";
import Uo from "remark-gfm";
import Oo from "remark-math";
import Bo from "rehype-katex";
function Xt(e) {
  return { parts: [], usage: {}, startedAt: e, firstTokenAt: null, lastTokenAt: null, chars: 0, chunks: 0 };
}
function Yt(e) {
  return e.type === "text" ? e.text : e.type === "resource_link" ? e.title || e.name || e.uri : "";
}
function Wo(e) {
  return (e || []).map((t) => t.type === "content" ? Yt(t.content) : t.type === "diff" ? `改了 ${t.path}` : "").filter(Boolean).join(`
`);
}
function Ho(e) {
  return (e || []).map((t) => t.line != null ? `${t.path}:${t.line}` : t.path);
}
function Go(e) {
  return typeof e == "number" && Number.isFinite(e) ? e : void 0;
}
function Ge(e) {
  var g;
  const t = e, o = typeof (t == null ? void 0 : t["_claude/model"]) == "string" ? t["_claude/model"] : "", a = ((g = t == null ? void 0 : t.retainpdf) == null ? void 0 : g.usage) ?? (t == null ? void 0 : t.usage);
  if (!a || typeof a != "object") return o ? { model: o } : {};
  const r = (...x) => {
    for (const h of x) {
      const p = Go(a[h]);
      if (p !== void 0) return p;
    }
  }, c = {}, i = r("inputTokens", "input_tokens", "promptTokens", "prompt_tokens"), s = r("outputTokens", "output_tokens", "completionTokens", "completion_tokens"), l = r("cachedInputTokens", "cachedReadTokens", "cache_read_tokens", "cache_read_input_tokens", "cached_tokens"), d = r("cacheWriteTokens", "cachedWriteTokens", "cache_write_tokens", "cache_creation_input_tokens"), m = r("reasoningTokens", "reasoning_tokens", "thoughtTokens");
  return i !== void 0 && (c.inputTokens = i), s !== void 0 && (c.outputTokens = s), l !== void 0 && (c.cachedInputTokens = l), m !== void 0 && (c.reasoningTokens = m), d !== void 0 && (c.cacheWriteTokens = d), typeof a.model == "string" && a.model ? c.model = a.model : o && (c.model = o), c;
}
function st(e, t) {
  return e.map((o) => o.type === "reasoning" && o.timing && o.timing.completedAt === void 0 ? { ...o, timing: { ...o.timing, completedAt: t } } : o);
}
function Ko(e, t, o, a) {
  const r = e[e.length - 1];
  return r && r.type === t ? [...e.slice(0, -1), { ...r, text: r.text + o }] : t === "reasoning" ? [...e, { type: t, text: o, timing: { startedAt: a } }] : [...st(e, a), { type: t, text: o }];
}
function Vo(e, t, o, a = Date.now()) {
  var r, c, i;
  switch (t.sessionUpdate) {
    case "agent_message_chunk":
    case "agent_thought_chunk": {
      const s = Yt(t.content);
      if (!s) return e;
      const l = t.sessionUpdate === "agent_message_chunk" ? "text" : "reasoning";
      return {
        ...e,
        parts: Ko(e.parts, l, s, a),
        chars: e.chars + s.length,
        chunks: (e.chunks || 0) + 1,
        firstTokenAt: e.firstTokenAt ?? o,
        lastTokenAt: o
      };
    }
    case "tool_call":
    case "tool_call_update": {
      const s = e.parts.findIndex((k) => k.type === "tool-call" && k.toolCallId === t.toolCallId), l = s >= 0 ? e.parts[s] : null, d = t.status || (l == null ? void 0 : l.artifact.status) || "pending", m = t.rawInput !== void 0 ? t.rawInput : l == null ? void 0 : l.args, g = m && typeof m == "object" ? m : {}, x = t.content != null ? Wo(t.content) : (l == null ? void 0 : l.artifact.output) || "", h = d === "completed" || d === "failed", p = {
        type: "tool-call",
        timing: { startedAt: ((r = l == null ? void 0 : l.timing) == null ? void 0 : r.startedAt) ?? a, ...h ? { completedAt: ((c = l == null ? void 0 : l.timing) == null ? void 0 : c.completedAt) ?? a } : {} },
        toolCallId: t.toolCallId,
        toolName: t.name || (l == null ? void 0 : l.toolName) || t.kind || "tool",
        args: g,
        argsText: JSON.stringify(g),
        result: t.rawOutput !== void 0 ? t.rawOutput : l == null ? void 0 : l.result,
        isError: d === "failed",
        artifact: {
          title: t.title || (l == null ? void 0 : l.artifact.title) || t.name || "工具",
          kind: t.kind || (l == null ? void 0 : l.artifact.kind) || "other",
          status: d,
          locations: t.locations != null ? Ho(t.locations) : (l == null ? void 0 : l.artifact.locations) || [],
          output: x
        }
      }, b = s >= 0 ? e.parts.map((k, w) => w === s ? p : k) : [...st(e.parts, a), p];
      return { ...e, parts: b };
    }
    case "plan": {
      const s = e.parts.findIndex((d) => d.type === "data" && d.name === "plan"), l = { type: "data", name: "plan", data: { entries: t.entries } };
      return { ...e, parts: s >= 0 ? e.parts.map((d, m) => m === s ? l : d) : [...e.parts, l] };
    }
    case "subagent_update": {
      const s = e.parts.findIndex((g) => g.type === "data" && g.name === "subagent" && g.data.id === t.sessionId), l = s >= 0 ? e.parts[s].data : null, d = ((i = t.state) == null ? void 0 : i.state) || (l == null ? void 0 : l.state) || "running", m = {
        type: "data",
        name: "subagent",
        data: {
          id: t.sessionId,
          title: t.title || (l == null ? void 0 : l.title) || "子 agent",
          description: t.description || (l == null ? void 0 : l.description) || "",
          state: d
        }
      };
      return { ...e, parts: s >= 0 ? e.parts.map((g, x) => x === s ? m : g) : [...e.parts, m] };
    }
    case "usage_update": {
      const s = { ...e.usage, contextUsed: t.used, contextSize: t.size, ...Ge(t._meta) };
      return t.cost && (s.cost = { amount: t.cost.amount, currency: t.cost.currency }), { ...e, usage: s };
    }
    default:
      return e;
  }
}
const It = 5;
function Jt(e) {
  if (e.firstTokenAt == null || e.lastTokenAt == null || (e.chunks ?? It) < It) return null;
  const t = (e.lastTokenAt - e.firstTokenAt) / 1e3;
  return t < 0.3 ? null : e.usage.outputTokens ? { value: e.usage.outputTokens / t, unit: "token/s" } : e.chars ? { value: e.chars / t, unit: "字/s" } : null;
}
function qo(e, t, o = "") {
  const a = [], { usage: r } = e;
  o ? a.push(r.model ? `${o}（${r.model}）` : o) : r.model && a.push(r.model), (r.inputTokens !== void 0 || r.outputTokens !== void 0) && a.push(`输入 ${r.inputTokens ?? "?"} · 输出 ${r.outputTokens ?? "?"} token`), r.cachedInputTokens && a.push(`缓存命中 ${r.cachedInputTokens}`), r.cacheWriteTokens && a.push(`写入缓存 ${r.cacheWriteTokens}`), r.contextUsed !== void 0 && r.contextSize && a.push(`上下文 ${Math.round(r.contextUsed / r.contextSize * 100)}%`), r.cost && a.push(`${r.cost.amount.toFixed(4)} ${r.cost.currency}`);
  const c = Jt(e);
  return c && a.push(`${c.value.toFixed(c.value >= 10 ? 0 : 1)} ${c.unit}`), e.firstTokenAt != null && a.push(`首字 ${((e.firstTokenAt - e.startedAt) / 1e3).toFixed(1)}s`), t != null && a.push(`用时 ${((t - e.startedAt) / 1e3).toFixed(1)}s`), a.join(" · ");
}
const zt = 8e3;
function Oe(e, t) {
  return e.filter((o) => o.type === t).map((o) => o.text || "").join("").trim();
}
function Xo(e, t) {
  if (!e) return null;
  const o = { ...e.usage };
  return t != null && (o.elapsedMs = Math.round(t - e.startedAt)), e.firstTokenAt != null && (o.firstTokenMs = Math.round(e.firstTokenAt - e.startedAt)), Object.keys(o).length ? o : null;
}
function Qt(e) {
  var o;
  const t = [];
  for (const a of e)
    if (a.role === "user") {
      const r = Oe(a.content, "text");
      r && t.push({ role: "user", text: r });
    } else if (a.role === "assistant") {
      const r = (o = a.metadata) == null ? void 0 : o.custom, c = Oe(a.content, "text"), i = Oe(a.content, "reasoning");
      if (!c && !i) continue;
      t.push({ role: "assistant", text: c, thought: i || null, usage: Xo(r == null ? void 0 : r.turn, r == null ? void 0 : r.endedAt) });
    }
  return t;
}
function Yo(e) {
  return e.map((t) => {
    if (t.role === "user") return { role: "user", content: t.text };
    const o = t.usage || {}, a = { ...Xt(0), usage: o, firstTokenAt: o.firstTokenMs ?? null };
    return {
      role: "assistant",
      content: [
        ...t.thought ? [{ type: "reasoning", text: t.thought }] : [],
        { type: "text", text: t.text }
      ],
      status: { type: "complete", reason: "stop" },
      metadata: { custom: { turn: a, endedAt: o.elapsedMs ?? void 0 } }
    };
  });
}
function Jo(e) {
  const t = Qt(e).slice(-12);
  if (!t.length) return "";
  let o = t.map((a) => `${a.role === "user" ? "我" : "你"}：${a.text}`).join(`

`);
  return o.length > zt && (o = `…${o.slice(-zt)}`), `之前我们在这一处聊过（接着聊）：

${o}`;
}
const Qo = 4e3;
function Be(e, t = Qo) {
  const o = `${e || ""}`.trim();
  return o.length > t ? `${o.slice(0, t)}…` : o;
}
function Zo(e, t, o = "") {
  const a = [], r = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return a.push(`我在读${o ? `《${o}》` : "一本书"}，${r}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && a.push("", "我选中的这段：", Be(e.selection)), e.sourceText && a.push("", "这一块的原文：", Be(e.sourceText)), e.translatedText && a.push("", "这一块的译文：", Be(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && a.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), a.push("", `（RetainPDF 任务 ${t}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), [{ type: "text", text: a.join(`
`) }];
}
class ea {
  constructor() {
    oe(this, "pending", /* @__PURE__ */ new Map());
    oe(this, "listeners", /* @__PURE__ */ new Set());
    oe(this, "version", 0);
    oe(this, "subscribe", (t) => (this.listeners.add(t), () => this.listeners.delete(t)));
    oe(this, "snapshot", () => this.version);
  }
  add(t) {
    return new Promise((o) => {
      const a = t.toolCall.toolCallId;
      this.pending.set(a, {
        request: t,
        resolve: (r) => {
          this.pending.delete(a), this.bump(), o(r);
        }
      }), this.bump();
    });
  }
  get(t) {
    return this.pending.get(t);
  }
  all() {
    return [...this.pending.values()];
  }
  /** 关窗 / 停下时，没回的都按取消回掉，agent 不会一直等。 */
  cancelAll() {
    for (const t of [...this.pending.values()]) t.resolve({ outcome: { outcome: "cancelled" } });
  }
  bump() {
    this.version += 1;
    for (const t of this.listeners) t();
  }
}
function We(e) {
  return e.map((t) => t.type === "tool-call" ? { ...t, args: t.args } : t);
}
function ta(e) {
  if (!e) return [];
  const t = [...e.content, ...(e.attachments || []).flatMap((a) => a.content || [])], o = [];
  for (const a of t) {
    if (a.type !== "image" || !a.image) continue;
    const r = /^data:([^;,]+);base64,(.+)$/.exec(a.image);
    r && o.push({ type: "image", mimeType: r[1], data: r[2] });
  }
  return o;
}
function na(e) {
  const t = e.now ?? (() => performance.now());
  let o = null, a = "", r = null, c = !1, i = 0;
  const s = async () => {
    const d = e.getAgentId();
    return o && a === d || (o == null || o.close(), o = await e.port.openSession(
      { agentId: d, jobId: e.jobId },
      {
        onUpdate: (m) => r == null ? void 0 : r(m),
        onPermission: (m) => e.permissions.add(m)
      }
    ), a = d, c = !1, i = 0), o;
  };
  return {
    adapter: {
      async *run({ messages: d, abortSignal: m }) {
        const g = d.map((N) => N.role).lastIndexOf("user"), x = g >= 0 ? d[g] : void 0;
        o && g !== i && (o.close(), o = null);
        const h = ((x == null ? void 0 : x.content) || []).map((N) => N.type === "text" && N.text || "").join(`
`).trim();
        let p;
        try {
          p = await s();
        } catch (N) {
          o = null;
          const $ = N instanceof Error ? N.message : String(N);
          yield {
            content: [{ type: "text", text: `（连不上这个 agent：${$}）` }],
            status: { type: "incomplete", reason: "error", error: $ }
          };
          return;
        }
        const b = e.getAnchor(), k = [];
        !c && b && k.push(...Zo(b, e.jobId, e.bookTitle));
        const w = !c && g > 0 ? Jo(d.slice(0, g)) : "";
        w && k.push({ type: "text", text: w }), k.push({ type: "text", text: h || "（看图）" }), k.push(...ta(x)), c = !0;
        let v = Xt(t()), z = null, S = !1;
        r = (N) => {
          v = Vo(v, N, t()), S = !0, z == null || z();
        };
        const R = () => {
          e.permissions.cancelAll(), p.cancel();
        };
        m.addEventListener("abort", R);
        let C = !1, _ = null, j = "end_turn";
        p.prompt(k).then(
          (N) => {
            j = N.stopReason;
            const $ = { ...Ge(N.meta), ...Ge(N.usage ? { usage: N.usage } : null) };
            Object.keys($).length && (v = { ...v, usage: { ...v.usage, ...$ } }, S = !0), C = !0, z == null || z();
          },
          (N) => {
            _ = N, C = !0, z == null || z();
          }
        );
        try {
          for (; !C || S; )
            S || await new Promise((N) => z = N), z = null, S && (S = !1, yield { content: We(v.parts), metadata: { custom: { turn: v } } });
        } finally {
          m.removeEventListener("abort", R), r = null;
        }
        const V = t();
        v = { ...v, parts: st(v.parts, Date.now()) }, _ || (i = g + 2);
        const q = Jt(v), I = {
          streamStartTime: v.startedAt,
          firstTokenTime: v.firstTokenAt ?? void 0,
          totalStreamTime: V - v.startedAt,
          tokenCount: v.usage.outputTokens,
          tokensPerSecond: (q == null ? void 0 : q.unit) === "token/s" ? q.value : void 0,
          totalChunks: 0,
          toolCallCount: v.parts.filter((N) => N.type === "tool-call").length
        };
        if (_) {
          const N = _ instanceof Error ? _.message : String(_);
          /close|closed|1011|disconnect|断/i.test(N) && (o == null || o.close(), o = null), yield {
            content: We([...v.parts, { type: "text", text: `

（出错了：${N}）` }]),
            status: { type: "incomplete", reason: "error", error: N },
            metadata: { custom: { turn: v, endedAt: V }, timing: I }
          };
          return;
        }
        yield {
          content: We(v.parts),
          status: j === "cancelled" ? { type: "incomplete", reason: "cancelled" } : j === "max_tokens" ? { type: "incomplete", reason: "length" } : { type: "complete", reason: "stop" },
          metadata: { custom: { turn: v, endedAt: V }, timing: I }
        };
      }
    },
    close() {
      e.permissions.cancelAll(), o == null || o.close(), o = null;
    }
  };
}
function f(...e) {
  return Po(Eo(e));
}
function Zt({
  delayDuration: e = 0,
  ...t
}) {
  return /* @__PURE__ */ n(
    fe.Provider,
    {
      "data-slot": "tooltip-provider",
      delayDuration: e,
      ...t
    }
  );
}
function en({
  ...e
}) {
  return /* @__PURE__ */ n(fe.Root, { "data-slot": "tooltip", ...e });
}
function tn({
  ...e
}) {
  return /* @__PURE__ */ n(fe.Trigger, { "data-slot": "tooltip-trigger", ...e });
}
function nn({
  className: e,
  sideOffset: t = 0,
  children: o,
  ...a
}) {
  return /* @__PURE__ */ n(fe.Portal, { children: /* @__PURE__ */ u(
    fe.Content,
    {
      "data-slot": "tooltip-content",
      sideOffset: t,
      className: f(
        "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        e
      ),
      ...a,
      children: [
        o,
        /* @__PURE__ */ n(fe.Arrow, { className: "z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" })
      ]
    }
  ) });
}
const oa = ye(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
function M({
  className: e,
  variant: t = "default",
  size: o = "default",
  asChild: a = !1,
  ...r
}) {
  const c = a ? Vt.Root : "button";
  return /* @__PURE__ */ n(
    c,
    {
      "data-slot": "button",
      "data-variant": t,
      "data-size": o,
      className: f(oa({ variant: t, size: o, className: e })),
      ...r
    }
  );
}
function aa({
  ...e
}) {
  return /* @__PURE__ */ n(re.Root, { "data-slot": "dialog", ...e });
}
function ra({
  ...e
}) {
  return /* @__PURE__ */ n(re.Trigger, { "data-slot": "dialog-trigger", ...e });
}
function ia({
  ...e
}) {
  return /* @__PURE__ */ n(re.Portal, { "data-slot": "dialog-portal", ...e });
}
function sa({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ n(
    re.Overlay,
    {
      "data-slot": "dialog-overlay",
      className: f(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        e
      ),
      ...t
    }
  );
}
function la({
  className: e,
  children: t,
  showCloseButton: o = !0,
  ...a
}) {
  return /* @__PURE__ */ u(ia, { "data-slot": "dialog-portal", children: [
    /* @__PURE__ */ n(sa, {}),
    /* @__PURE__ */ u(
      re.Content,
      {
        "data-slot": "dialog-content",
        className: f(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          e
        ),
        ...a,
        children: [
          t,
          o && /* @__PURE__ */ u(
            re.Close,
            {
              "data-slot": "dialog-close",
              className: "absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
              children: [
                /* @__PURE__ */ n(ve, {}),
                /* @__PURE__ */ n("span", { className: "sr-only", children: "关掉" })
              ]
            }
          )
        ]
      }
    )
  ] });
}
function ca({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ n(
    re.Title,
    {
      "data-slot": "dialog-title",
      className: f("text-lg leading-none font-semibold", e),
      ...t
    }
  );
}
function da({
  className: e,
  size: t = "default",
  ...o
}) {
  return /* @__PURE__ */ n(
    rt.Root,
    {
      "data-slot": "avatar",
      "data-size": t,
      className: f(
        "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
        e
      ),
      ...o
    }
  );
}
function ua({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ n(
    rt.Image,
    {
      "data-slot": "avatar-image",
      className: f("aspect-square size-full", e),
      ...t
    }
  );
}
function ma({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ n(
    rt.Fallback,
    {
      "data-slot": "avatar-fallback",
      className: f(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        e
      ),
      ...t
    }
  );
}
const F = xe(({ children: e, tooltip: t, side: o = "bottom", className: a, ...r }, c) => /* @__PURE__ */ n(Zt, { delayDuration: 0, children: /* @__PURE__ */ u(en, { children: [
  /* @__PURE__ */ n(tn, { asChild: !0, children: /* @__PURE__ */ u(
    M,
    {
      variant: "ghost",
      size: "icon",
      ...r,
      className: f(
        "aui-button-icon size-6 p-1 active:scale-90",
        a
      ),
      ref: c,
      children: [
        /* @__PURE__ */ n(Vt.Slottable, { children: e }),
        /* @__PURE__ */ n("span", { className: "aui-sr-only sr-only", children: t })
      ]
    }
  ) }),
  /* @__PURE__ */ n(nn, { side: o, children: t })
] }) }));
F.displayName = "TooltipIconButton";
const fa = (e) => {
  const [t, o] = T(
    void 0
  );
  return L(() => {
    if (!e) {
      o(void 0);
      return;
    }
    const a = URL.createObjectURL(e);
    return o({ file: e, url: a }), () => {
      URL.revokeObjectURL(a);
    };
  }, [e]), t !== void 0 && t.file === e ? t.url : void 0;
}, ga = () => {
  const { file: e, src: t } = E(
    $o((o) => {
      var r, c;
      if (o.attachment.type !== "image") return {};
      if (o.attachment.file) return { file: o.attachment.file };
      const a = (c = (r = o.attachment.content) == null ? void 0 : r.filter((i) => i.type === "image")[0]) == null ? void 0 : c.image;
      return a ? { src: a } : {};
    })
  );
  return fa(e) ?? t;
};
function pa() {
  const t = Yn().attachment.source !== "message", o = ga(), a = E((m) => m.attachment.type === "image"), r = E((m) => m.attachment.name), c = E((m) => {
    const g = m.attachment.type;
    switch (g) {
      case "image":
        return "Image";
      case "document":
        return "Document";
      case "file":
        return "File";
      default:
        return g;
    }
  }), i = E(
    (m) => {
      var g;
      return m.attachment.status.type === "incomplete" && m.attachment.status.reason === "error" ? "error" : m.attachment.status.type === "running" || ((g = m.optional.message) == null ? void 0 : g.submission) !== void 0 && m.attachment.status.type !== "complete" ? "uploading" : void 0;
    }
  ), s = i === "uploading", l = i === "error", d = E(
    (m) => m.attachment.status.type === "incomplete" && m.attachment.status.reason === "error" ? m.attachment.status.message ?? "Upload failed" : void 0
  );
  return {
    isComposer: t,
    src: o,
    isImage: a,
    name: r,
    typeLabel: c,
    isUploading: s,
    isError: l,
    errorMessage: d
  };
}
const ha = ({ src: e, name: t }) => {
  const [o, a] = T(!1);
  return (
    // A picture wrapper marks a deliberate native img for the Next.js lint, because
    // next/image needs per-host config for runtime URLs and only exists in Next.js.
    /* @__PURE__ */ n("picture", { className: "contents", children: /* @__PURE__ */ n(
      "img",
      {
        src: e,
        alt: `Preview of ${t}`,
        className: f(
          "block h-auto max-h-[80vh] w-auto max-w-full rounded-sm object-contain transition-opacity duration-300 motion-reduce:transition-none",
          o ? "aui-attachment-preview-image-loaded opacity-100" : "aui-attachment-preview-image-loading opacity-0"
        ),
        onLoad: () => a(!0)
      }
    ) })
  );
}, ba = ({
  children: e,
  src: t,
  name: o
}) => t ? /* @__PURE__ */ u(aa, { children: [
  /* @__PURE__ */ n(
    ra,
    {
      className: "aui-attachment-preview-trigger cursor-zoom-in",
      asChild: !0,
      children: Gn(e) ? e : /* @__PURE__ */ n("button", { type: "button", children: e })
    }
  ),
  /* @__PURE__ */ u(la, { className: "aui-attachment-preview-dialog-content [&>button]:bg-foreground/60 [&>button]:hover:bg-foreground/80 [&_svg]:text-background p-2 sm:max-w-3xl [&>button]:rounded-full [&>button]:p-1 [&>button]:opacity-100 [&>button]:ring-0!", children: [
    /* @__PURE__ */ u(ca, { className: "aui-sr-only sr-only", children: [
      "Preview ",
      o
    ] }),
    /* @__PURE__ */ n("div", { className: "aui-attachment-preview bg-background relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden rounded-sm", children: /* @__PURE__ */ n(ha, { src: t, name: o }) })
  ] })
] }) : e, xa = ({ src: e }) => /* @__PURE__ */ u(da, { className: "aui-attachment-tile-avatar h-full w-full rounded-none", children: [
  /* @__PURE__ */ n(
    ua,
    {
      src: e,
      alt: "",
      className: "aui-attachment-tile-image rounded-none object-cover"
    }
  ),
  /* @__PURE__ */ n(ma, { children: /* @__PURE__ */ n(ao, { className: "aui-attachment-tile-fallback-icon text-muted-foreground/80 size-6 stroke-[1.5]" }) })
] }), on = () => {
  const {
    isComposer: e,
    src: t,
    isImage: o,
    name: a,
    typeLabel: r,
    isUploading: c,
    isError: i,
    errorMessage: s
  } = pa();
  return /* @__PURE__ */ n(Zt, { children: /* @__PURE__ */ u(en, { children: [
    /* @__PURE__ */ u(
      He.Root,
      {
        className: f(
          "aui-attachment-root relative",
          e && "animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none",
          o && !e && "aui-attachment-root-message only:*:first:size-24"
        ),
        children: [
          /* @__PURE__ */ n(ba, { src: t, name: a, children: /* @__PURE__ */ n(tn, { asChild: !0, children: /* @__PURE__ */ u(
            "div",
            {
              className: f(
                "aui-attachment-tile bg-muted hover:after:bg-foreground/10 focus-visible:ring-ring/50 relative size-14 overflow-hidden rounded-[calc(var(--composer-radius,1rem)-var(--composer-padding,8px))] transition-transform outline-none after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-black/10 after:transition-colors after:ring-inset focus-visible:ring-1 motion-reduce:transition-none dark:after:ring-white/10",
                t ? "cursor-zoom-in active:scale-[0.96]" : "cursor-default",
                i && "after:ring-destructive/60 dark:after:ring-destructive/60"
              ),
              role: t ? "button" : "group",
              tabIndex: 0,
              onKeyDown: t ? (l) => {
                l.key === "Enter" ? (l.preventDefault(), l.currentTarget.click()) : l.key === " " && l.preventDefault();
              } : void 0,
              onKeyUp: t ? (l) => {
                l.key === " " && l.currentTarget.click();
              } : void 0,
              "aria-label": `${t ? `Preview ${a}` : `${r} attachment ${a}`}${i ? ", upload failed" : c ? ", uploading" : ""}`,
              children: [
                /* @__PURE__ */ n(xa, { src: t }),
                c && /* @__PURE__ */ n(
                  "div",
                  {
                    "aria-hidden": "true",
                    className: "aui-attachment-tile-uploading bg-background/60 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none",
                    children: /* @__PURE__ */ n(Ae, { className: "text-muted-foreground size-4 animate-spin" })
                  }
                ),
                i && /* @__PURE__ */ n(
                  "div",
                  {
                    "aria-hidden": "true",
                    className: "aui-attachment-tile-error bg-background/70 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none",
                    children: /* @__PURE__ */ n(Ut, { className: "text-destructive size-4" })
                  }
                )
              ]
            }
          ) }) }),
          e && /* @__PURE__ */ n(va, { name: a })
        ]
      }
    ),
    /* @__PURE__ */ u(nn, { side: "top", children: [
      /* @__PURE__ */ n(He.Name, {}),
      s && /* @__PURE__ */ n("p", { className: "aui-attachment-error-message", children: s })
    ] })
  ] }) });
}, va = ({ name: e }) => /* @__PURE__ */ n(He.Remove, { asChild: !0, children: /* @__PURE__ */ n(
  F,
  {
    tooltip: `去掉 ${e}`,
    className: "aui-attachment-tile-remove absolute end-1 top-1 size-5 rounded-full bg-black/50! text-white after:absolute after:-inset-1.5 hover:bg-black/70! hover:text-white! active:scale-[0.96] motion-reduce:transition-none",
    side: "top",
    children: /* @__PURE__ */ n(ve, { className: "aui-attachment-remove-icon size-3 stroke-[2.5]" })
  }
) }), ya = () => /* @__PURE__ */ n("div", { className: "aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2 empty:hidden", children: /* @__PURE__ */ n(Q.Attachments, { children: () => /* @__PURE__ */ n(on, {}) }) }), ka = () => /* @__PURE__ */ n("div", { className: "aui-composer-attachments flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden", children: /* @__PURE__ */ n(U.Attachments, { children: () => /* @__PURE__ */ n(on, {}) }) }), At = () => /* @__PURE__ */ n(U.AddAttachment, { asChild: !0, children: /* @__PURE__ */ n(
  F,
  {
    tooltip: "加图片",
    side: "bottom",
    variant: "ghost",
    size: "icon",
    className: "aui-composer-add-attachment text-muted-foreground hover:text-foreground hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30 size-7 rounded-full active:scale-[0.96] motion-reduce:transition-none",
    "aria-label": "加图片",
    children: /* @__PURE__ */ n(oo, { className: "aui-attachment-add-icon size-4" })
  }
) }), Na = typeof globalThis.window < "u", wa = Na ? me : L, an = "bg-background border border-border/60 dark:bg-popover", Ta = "bg-foreground/[0.04] forced-colors:border dark:bg-foreground/[0.06]", Ca = "flex items-center justify-center rounded-full text-muted-foreground outline-hidden transition-[background-color,color,scale] duration-150 hover:bg-foreground/[0.06] hover:text-foreground/90 active:scale-[0.96] focus-visible:ring-1 focus-visible:ring-foreground/20 motion-reduce:transition-none dark:hover:bg-foreground/[0.09]", rn = "bg-foreground text-background transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-90 active:scale-[0.96] motion-reduce:transition-none forced-colors:border", _e = "font-mono text-[11px] tracking-tight", Ia = /^(?:[/?#]|\.{1,2}\/)/, za = /* @__PURE__ */ new Set(["http:", "https:", "mailto:"]), sn = (e) => {
  try {
    return new URL(e);
  } catch {
    return;
  }
};
function ln(e) {
  if (typeof e != "string") return;
  const t = e.trim();
  if (t === "") return;
  const o = sn(t);
  return o ? za.has(o.protocol) ? t : void 0 : Ia.test(t) ? t : void 0;
}
function Aa(e) {
  var a;
  const t = ln(e);
  return (t === void 0 ? "" : ((a = sn(t)) == null ? void 0 : a.hostname) ?? "").replace(/^www\./, "") || void 0;
}
const Ra = /^(?:data:image\/|data:audio\/|data:video\/|blob:)/i;
function lt(e, t) {
  if (typeof e != "string") return !1;
  const o = e.trim();
  if (o === "") return !1;
  if (Ra.test(o)) return !0;
  if (/^[a-z][a-z\d+.-]*:/i.test(o)) {
    let a;
    try {
      a = new URL(o);
    } catch {
      return !1;
    }
    return Rt(a, t);
  }
  return ["http:", "https:"].every((a) => {
    const r = `${a}//relative.invalid`;
    try {
      const c = new URL(o, `${r}/`);
      return c.origin === r || Rt(c, t);
    } catch {
      return !1;
    }
  });
}
function Rt(e, t) {
  return e.protocol !== "http:" && e.protocol !== "https:" ? !1 : (t ?? []).some((o) => {
    if (o === "*") return !0;
    try {
      return new URL(o).origin === e.origin;
    } catch {
      return !1;
    }
  });
}
function Ie(e) {
  const t = Math.max(0, Math.floor(e)), o = Math.floor(t / 60), a = t % 60;
  return `${o}:${a.toString().padStart(2, "0")}`;
}
function cn(e, t, o) {
  const a = lt(t, o), [r, c] = T(void 0);
  r !== void 0 && r !== t && c(void 0);
  const i = a || r === t, s = A(i);
  return L(() => {
    const l = e.current;
    l && !i && (s.current || l.hasAttribute("src")) && (l.removeAttribute("src"), l.load()), s.current = i;
  }, [e, t, i]), {
    preload: a,
    armed: i,
    arm: () => {
      const l = e.current;
      !l || i || (l.src = t, c(t));
    }
  };
}
function dn(e, t, o) {
  const [a, r] = T({
    src: t
  });
  L(() => {
    const i = e.current;
    !i || i.readyState < HTMLMediaElement.HAVE_METADATA || Number.isFinite(i.duration) && i.duration >= 0 && r({ src: t, duration: i.duration });
  }, [e, t]);
  const c = o !== void 0 && Number.isFinite(o) ? Math.max(0, o / 1e3) : void 0;
  return {
    duration: a.src === t ? a.duration ?? c : c,
    setDurationFromMetadata: (i) => {
      Number.isFinite(i) && i >= 0 && r({ src: t, duration: i });
    }
  };
}
function Sa({
  src: e,
  title: t,
  artwork: o,
  durationMs: a,
  mediaOrigins: r,
  className: c,
  ...i
}) {
  const s = A(null), l = cn(s, e, r), [d, m] = T({
    src: e,
    currentTime: 0,
    playing: !1,
    hasError: !1
  }), { duration: g, setDurationFromMetadata: x } = dn(
    s,
    e,
    a
  ), h = d.src === e ? d : { currentTime: 0, playing: !1, hasError: !1 }, { currentTime: p, playing: b, hasError: k } = h, w = (C) => m((_) => ({
    ..._.src === e ? _ : { src: e, currentTime: 0, playing: !1, hasError: !1 },
    ...C
  })), v = t ?? "Audio", z = t ? ` ${t}` : " audio", S = g === void 0 ? "--:--" : Ie(g);
  L(() => {
    var C;
    (C = s.current) != null && C.error && m({ src: e, currentTime: 0, playing: !1, hasError: !0 });
  }, [e]);
  const R = () => {
    const C = s.current;
    if (!(!C || k)) {
      if (b) {
        C.pause(), w({ playing: !1 });
        return;
      }
      l.arm(), C.play().then(
        () => w({ playing: !0 }),
        () => w(
          C.error ? { hasError: !0, playing: !1 } : { playing: !1 }
        )
      );
    }
  };
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "audio-player",
      className: f(
        an,
        "flex w-full max-w-md items-center gap-3 rounded-2xl p-3",
        c
      ),
      ...i,
      children: [
        lt(o, r) ? (
          // A picture wrapper marks a deliberate native img for the Next.js lint, because
          // next/image needs per-host config for runtime URLs and only exists in Next.js.
          /* @__PURE__ */ n("picture", { className: "contents", children: /* @__PURE__ */ n(
            "img",
            {
              src: o,
              alt: "",
              className: "size-10 shrink-0 rounded-lg object-cover"
            }
          ) })
        ) : null,
        /* @__PURE__ */ n(
          "button",
          {
            type: "button",
            "aria-label": `${b ? "Pause" : "Play"}${z}`,
            disabled: k,
            onClick: R,
            className: f(
              rn,
              "flex size-9 shrink-0 items-center justify-center rounded-full disabled:cursor-default disabled:opacity-40"
            ),
            children: b ? /* @__PURE__ */ n(Ot, { "aria-hidden": !0, className: "size-4" }) : /* @__PURE__ */ n(Re, { "aria-hidden": !0, className: "ml-0.5 size-4" })
          }
        ),
        /* @__PURE__ */ u("div", { className: "flex min-w-0 grow basis-16 flex-col gap-1.5", children: [
          /* @__PURE__ */ n("span", { className: "truncate text-[13.5px] font-medium", children: v }),
          /* @__PURE__ */ n(
            "input",
            {
              type: "range",
              min: 0,
              max: g ?? 0,
              step: 0.1,
              value: Math.min(p, g ?? 0),
              "aria-label": "拖动进度",
              "aria-valuetext": `${Ie(p)} of ${S}`,
              disabled: k,
              onChange: (C) => {
                const _ = Number(C.currentTarget.value);
                if (!Number.isFinite(_)) return;
                const j = Math.min(_, g ?? _);
                s.current && (s.current.currentTime = j), w({ currentTime: j });
              },
              className: "accent-foreground w-full"
            }
          )
        ] }),
        /* @__PURE__ */ u("span", { className: f(_e, "text-muted-foreground tabular-nums"), children: [
          Ie(p),
          " / ",
          S
        ] }),
        /* @__PURE__ */ n(
          "audio",
          {
            ref: s,
            src: l.preload ? e : void 0,
            preload: l.preload ? "metadata" : "none",
            className: "hidden",
            onLoadedMetadata: (C) => {
              x(C.currentTarget.duration);
            },
            onTimeUpdate: (C) => w({ currentTime: C.currentTarget.currentTime }),
            onPlay: () => w({ playing: !0 }),
            onPause: () => w({ playing: !1 }),
            onError: () => w({ hasError: !0, playing: !1 })
          }
        ),
        k ? /* @__PURE__ */ n("span", { role: "alert", className: "text-muted-foreground text-xs", children: "Can't play this audio" }) : null
      ]
    }
  );
}
function _a({
  src: e,
  poster: t,
  title: o,
  ratio: a = "16:9",
  durationMs: r,
  mediaOrigins: c,
  className: i,
  ...s
}) {
  const l = A(null), d = cn(l, e, c), { duration: m, setDurationFromMetadata: g } = dn(
    l,
    e,
    r
  ), x = a === "1:1" ? "aspect-square" : a === "4:3" ? "aspect-[4/3]" : a === "16:9" ? "aspect-video" : a === "9:16" ? "aspect-[9/16]" : void 0;
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "video-player",
      className: f("flex w-full max-w-xl flex-col gap-2", i),
      ...s,
      children: [
        /* @__PURE__ */ u(
          "div",
          {
            className: f(
              Ta,
              "relative overflow-hidden rounded-xl",
              x
            ),
            children: [
              /* @__PURE__ */ n(
                "video",
                {
                  ref: l,
                  src: d.preload ? e : void 0,
                  poster: lt(t, c) ? t : void 0,
                  controls: d.armed,
                  playsInline: !0,
                  preload: d.preload ? "metadata" : "none",
                  "aria-label": o ?? "Video",
                  className: f(
                    "block max-w-full",
                    a !== "auto" && "h-full w-full object-contain"
                  ),
                  onLoadedMetadata: (h) => {
                    g(h.currentTarget.duration);
                  }
                }
              ),
              d.armed ? null : /* @__PURE__ */ n(
                "button",
                {
                  type: "button",
                  "aria-label": `Play ${o ?? "video"}`,
                  onClick: () => {
                    var h, p;
                    Mo(() => d.arm()), (h = l.current) == null || h.focus(), (p = l.current) == null || p.play().catch(() => {
                    });
                  },
                  className: "absolute inset-0 flex items-center justify-center",
                  children: /* @__PURE__ */ n(
                    "span",
                    {
                      className: f(
                        rn,
                        "flex size-11 items-center justify-center rounded-full"
                      ),
                      children: /* @__PURE__ */ n(Re, { "aria-hidden": !0, className: "ml-0.5 size-5" })
                    }
                  )
                }
              )
            ]
          }
        ),
        (o || m !== void 0) && /* @__PURE__ */ u("div", { className: "flex min-w-0 items-center gap-2 px-1", children: [
          o ? /* @__PURE__ */ n("span", { className: "min-w-0 flex-1 truncate text-[13.5px] font-medium", children: o }) : null,
          m !== void 0 ? /* @__PURE__ */ n(
            "span",
            {
              className: f(
                _e,
                "text-muted-foreground shrink-0 tabular-nums"
              ),
              children: Ie(m)
            }
          ) : null
        ] })
      ]
    }
  );
}
const Ea = ye(
  "aui-file-root inline-flex items-center gap-3 rounded-lg transition-colors",
  {
    variants: {
      variant: {
        outline: "border-border hover:bg-muted/50 border",
        ghost: "hover:bg-muted/50",
        muted: "bg-muted/50 hover:bg-muted/70"
      },
      size: {
        sm: "px-2.5 py-1.5 text-xs",
        default: "px-3 py-2 text-sm",
        lg: "px-4 py-3 text-base"
      }
    },
    defaultVariants: {
      variant: "outline",
      size: "default"
    }
  }
);
function Pa(e) {
  const t = e.toLowerCase();
  return t.startsWith("image/") ? Wt : t === "application/pdf" ? Tt : t === "application/json" ? ro : t.startsWith("text/") ? Tt : t.startsWith("audio/") ? io : t.startsWith("video/") ? so : Bt;
}
function ct(e, t) {
  return t === "url" && /^data:/i.test(e) ? "data-uri" : t === "url" || t === "id" ? t : /^data:/i.test(e) ? "data-uri" : /^(https?:\/\/|blob:)/i.test(e) ? "url" : "base64";
}
function $a(e) {
  return /^[a-z][a-z\d+.-]*:/i.test(e) && !/^(data:|https?:\/\/|blob:)/i.test(e);
}
function Ee(e, t, o) {
  if ($a(e)) return null;
  const a = ct(e, o);
  return a === "id" ? null : a === "data-uri" ? /^data:[^,]*,/i.test(e) ? e : null : a === "url" ? /^(https?:\/\/|blob:)/i.test(e) ? e : null : `data:${t};base64,${e}`;
}
function un(e) {
  const t = e.endsWith("==") ? 2 : e.endsWith("=") ? 1 : 0, o = e.search(/[^A-Za-z\d+/]/);
  return o !== -1 && o !== e.length - t || e.length % 4 === 1 || t > 0 && e.length % 4 !== 0 ? 0 : Math.floor(e.length * 3 / 4) - t;
}
function Ma(e) {
  const t = /[\t\n\f\r ]/.test(e) ? e.replace(/[\t\n\f\r ]/g, "") : e;
  return un(t);
}
function Fa(e) {
  const t = e.indexOf("#"), o = t < 0 ? e.length : t, a = e.indexOf(",");
  if (a < 0 || a >= o)
    return 0;
  let r = e.slice(a + 1, o);
  return /;base64$/i.test(e.slice(0, a)) ? (/[%\t\n\f\r ]/.test(r) && (r = r.replace(
    /%([\da-f]{2})/gi,
    (c, i) => String.fromCharCode(Number.parseInt(i, 16))
  ).replace(/[\t\n\f\r ]/g, "")), un(r)) : new TextEncoder().encode(r.replace(/%[\da-f]{2}/gi, "_")).byteLength;
}
function La(e) {
  var o;
  const t = (o = /^[^/;]+\/(?:x-)?(?:[^;+]*\.)?([^;+.\s]+)/.exec(
    e.toLowerCase()
  )) == null ? void 0 : o[1];
  return !t || t === "octet-stream" ? "文件" : t === "plain" ? "文本文件" : `${t.toUpperCase()} file`;
}
function ja(e) {
  return e < 1024 ? `${e} B` : e < 1024 * 1024 ? `${(e / 1024).toFixed(1)} KB` : `${(e / (1024 * 1024)).toFixed(1)} MB`;
}
function mn({
  className: e,
  variant: t,
  size: o,
  children: a,
  ...r
}) {
  return /* @__PURE__ */ n(
    "div",
    {
      "data-slot": "file-root",
      "data-variant": t,
      "data-size": o,
      className: f(Ea({ variant: t, size: o, className: e })),
      ...r,
      children: a
    }
  );
}
function fn({
  mimeType: e,
  className: t,
  children: o,
  ...a
}) {
  const r = e ? Pa(e) : Bt;
  return /* @__PURE__ */ n(
    "span",
    {
      "data-slot": "file-icon",
      className: f("text-muted-foreground shrink-0", t),
      ...a,
      children: o ?? /* @__PURE__ */ n(r, { className: "size-5" })
    }
  );
}
function gn({
  className: e,
  children: t,
  ...o
}) {
  return /* @__PURE__ */ n(
    "span",
    {
      "data-slot": "file-name",
      className: f("min-w-0 flex-1 truncate font-medium", e),
      ...o,
      children: t || "没名字的文件"
    }
  );
}
function Ke({ bytes: e, className: t, ...o }) {
  return /* @__PURE__ */ n(
    "span",
    {
      "data-slot": "file-size",
      className: f("text-muted-foreground shrink-0", t),
      ...o,
      children: ja(e)
    }
  );
}
function Ve({
  data: e,
  mimeType: t,
  filename: o,
  sourceType: a,
  className: r,
  children: c,
  ...i
}) {
  if (typeof e != "string") return null;
  const s = ct(e, a), l = Ee(e, t, a);
  return l ? /* @__PURE__ */ n(
    "a",
    {
      "data-slot": "file-download",
      href: l,
      download: o || "download",
      ...s === "url" && { target: "_blank", rel: "noopener noreferrer" },
      className: f(
        "text-muted-foreground hover:bg-accent hover:text-accent-foreground shrink-0 rounded-md p-1 transition-colors",
        r
      ),
      "aria-label": c ? void 0 : `Download ${o || "file"}`,
      ...i,
      children: c || /* @__PURE__ */ n(nt, { className: "size-4" })
    }
  ) : null;
}
function pn({
  data: e,
  mimeType: t,
  filename: o,
  sourceType: a,
  className: r,
  ...c
}) {
  const i = Ee(e, t, a), s = t.toLowerCase();
  return !i || !s.startsWith("audio/") && !s.startsWith("video/") ? null : /* @__PURE__ */ n("div", { "data-slot": "file-player", className: f("w-full", r), ...c, children: s.startsWith("audio/") ? /* @__PURE__ */ n(Sa, { src: i, title: o }) : /* @__PURE__ */ n(_a, { src: i, title: o }) });
}
const Da = (e) => {
  const t = typeof e.data == "string" ? e.data : void 0, o = typeof e.mimeType == "string" ? e.mimeType : "application/octet-stream", a = typeof e.filename == "string" ? e.filename : void 0, r = e.sourceType === "url" || e.sourceType === "id" ? e.sourceType : void 0, c = t === void 0 ? void 0 : ct(t, r), i = t === void 0 ? void 0 : c === "data-uri" ? Fa(t) : c === "base64" ? Ma(t) : void 0, s = t === void 0 ? null : Ee(t, o, r), l = o.toLowerCase().startsWith("audio/") || o.toLowerCase().startsWith("video/");
  return t !== void 0 && s && l ? /* @__PURE__ */ u("div", { className: "flex w-full max-w-xl flex-col gap-2", children: [
    /* @__PURE__ */ n(
      pn,
      {
        data: t,
        mimeType: o,
        ...a !== void 0 && { filename: a },
        ...r !== void 0 && { sourceType: r }
      }
    ),
    /* @__PURE__ */ u("div", { className: "flex min-w-0 items-center justify-end gap-2 px-1", children: [
      i !== void 0 && /* @__PURE__ */ n(
        Ke,
        {
          bytes: i,
          className: "text-muted-foreground text-[11px]"
        }
      ),
      /* @__PURE__ */ n(
        Ve,
        {
          data: t,
          mimeType: o,
          ...a !== void 0 && { filename: a },
          ...r !== void 0 && { sourceType: r }
        }
      )
    ] })
  ] }) : /* @__PURE__ */ u(mn, { children: [
    /* @__PURE__ */ n(fn, { mimeType: o }),
    /* @__PURE__ */ u("div", { className: "flex min-w-0 flex-1 flex-col gap-0.5", children: [
      /* @__PURE__ */ n(gn, { children: a || La(o) }),
      i !== void 0 && /* @__PURE__ */ n(Ke, { bytes: i, className: "text-xs" })
    ] }),
    t !== void 0 && /* @__PURE__ */ n(
      Ve,
      {
        data: t,
        mimeType: o,
        ...a !== void 0 && { filename: a },
        ...r !== void 0 && { sourceType: r }
      }
    )
  ] });
}, te = ie(Da);
te.displayName = "File";
te.Root = mn;
te.Icon = fn;
te.Name = gn;
te.Size = Ke;
te.Download = Ve;
te.Player = pn;
const Ua = () => {
  const e = E((s) => s.thread.suggestions), t = A(null), o = A(null), [a, r] = T({ left: !1, right: !1 }), c = X(() => {
    const s = t.current;
    if (!s) return;
    const l = s.scrollWidth - s.clientWidth, d = Math.abs(s.scrollLeft), m = o.current ?? (o.current = getComputedStyle(s).direction === "rtl"), [g, x] = m ? [l - d, d] : [d, l - d];
    r((h) => {
      const p = { left: g > 1, right: x > 1 };
      return h.left === p.left && h.right === p.right ? h : p;
    });
  }, []);
  L(() => {
    c();
    const s = t.current;
    if (!(s != null && s.firstElementChild)) return;
    const l = new ResizeObserver(c);
    return l.observe(s), l.observe(s.firstElementChild), () => l.disconnect();
  }, [c]);
  const i = `linear-gradient(to right, ${a.left ? "transparent, black 2rem" : "black"}, ${a.right ? "black calc(100% - 2rem), transparent" : "black"})`;
  return /* @__PURE__ */ n(
    "div",
    {
      ref: t,
      onScroll: c,
      className: "aui-thread-followup-suggestions -my-1 w-full [scrollbar-width:none] overflow-x-auto py-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
      style: { maskImage: i, WebkitMaskImage: i },
      children: /* @__PURE__ */ n("div", { className: "mx-auto flex min-h-8 w-max items-center gap-2 px-0.5", children: e.map((s, l) => /* @__PURE__ */ u(
        ee.Suggestion,
        {
          className: "aui-thread-followup-suggestion border-foreground/10 hover:bg-foreground/[0.03] hover:border-foreground/25 rounded-md border px-2.5 py-1 text-sm whitespace-nowrap transition-colors ease-in motion-reduce:transition-none",
          prompt: s.prompt,
          send: !0,
          children: [
            s.title ?? s.prompt,
            s.label && /* @__PURE__ */ n("span", { className: "aui-thread-followup-suggestion-label text-muted-foreground ms-1", children: s.label })
          ]
        },
        l
      )) })
    }
  );
}, Oa = () => /* @__PURE__ */ n(
  D,
  {
    condition: (e) => !e.thread.isEmpty && !e.thread.isRunning && e.thread.suggestions.length > 0,
    children: /* @__PURE__ */ n(Ua, {})
  }
), Ba = (e) => {
  switch (e) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
}, hn = (e) => {
  var s, l;
  const t = e.indexOf(","), o = t >= 0 ? e.slice(0, t) : e, a = t >= 0 ? e.slice(t + 1) : "", r = ((l = (s = o.match(/data:([^;]+)/i)) == null ? void 0 : s[1]) == null ? void 0 : l.toLowerCase()) ?? "application/octet-stream";
  if (!/;base64/i.test(o)) {
    const d = [];
    let m = 0;
    for (const g of a.matchAll(/(?:%[\da-f]{2})+/gi)) {
      g.index > m && d.push(a.slice(m, g.index));
      const x = g[0], h = new Uint8Array(x.length / 3);
      for (let p = 0; p < h.length; p++)
        h[p] = Number.parseInt(
          x.slice(p * 3 + 1, p * 3 + 3),
          16
        );
      d.push(h), m = g.index + x.length;
    }
    return d.push(a.slice(m)), new Blob(d, { type: r });
  }
  let c;
  try {
    const d = a.replace(
      /%([\da-f]{2})/gi,
      (m, g) => String.fromCharCode(Number.parseInt(g, 16))
    );
    c = atob(d);
  } catch {
    return null;
  }
  const i = new Uint8Array(c.length);
  for (let d = 0; d < c.length; d++) i[d] = c.charCodeAt(d);
  return new Blob([i], { type: r });
}, bn = (e) => {
  var t, o;
  return (o = (t = e.match(/^data:([^;,]+)/i)) == null ? void 0 : t[1]) == null ? void 0 : o.toLowerCase();
}, Wa = (e) => {
  const t = bn(e);
  if (t) return `image.${Ba(t)}`;
  try {
    const a = new URL(e, document.baseURI).pathname.split("/").pop() ?? "";
    let r = a;
    try {
      r = decodeURIComponent(a);
    } catch {
    }
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(r)) return r;
  } catch {
  }
  return "image.png";
}, Ha = (e) => {
  try {
    const t = new URL(e, document.baseURI);
    return t.protocol === "http:" || t.protocol === "https:" || t.protocol === "blob:" ? e : null;
  } catch {
    return null;
  }
}, Ga = (e) => {
  if (typeof document > "u") return;
  const t = e.filename ?? Wa(e.image), o = /^data:/i.test(e.image), a = o ? hn(e.image) : null;
  if (o && !a) return;
  const r = a ? URL.createObjectURL(a) : null, c = r ?? Ha(e.image);
  if (!c) return;
  const i = document.createElement("a");
  i.href = c, i.download = t, i.rel = "noopener", document.body.appendChild(i), i.click(), document.body.removeChild(i), r && setTimeout(() => URL.revokeObjectURL(r), 4e4);
}, Ka = async (e) => {
  if (typeof navigator > "u" || !navigator.clipboard || typeof ClipboardItem > "u")
    throw new Error("Clipboard API is not available in this environment.");
  const t = /^data:/i.test(e.image) ? hn(e.image) : await fetch(e.image).then((a) => a.blob());
  if (!t) return;
  const o = bn(e.image) ?? t.type ?? "image/png";
  await navigator.clipboard.write([new ClipboardItem({ [o]: t })]);
}, Va = ye(
  "aui-image-root relative overflow-hidden rounded-lg",
  {
    variants: {
      variant: {
        outline: "border-border border",
        ghost: "",
        muted: "bg-muted/50"
      },
      size: {
        sm: "max-w-64",
        default: "max-w-96",
        lg: "max-w-[512px]",
        full: "w-full"
      }
    },
    defaultVariants: {
      variant: "outline",
      size: "default"
    }
  }
);
function ze({
  className: e,
  variant: t,
  size: o,
  children: a,
  ...r
}) {
  return /* @__PURE__ */ n(
    "div",
    {
      "data-slot": "image-root",
      "data-variant": t,
      "data-size": o,
      className: f(Va({ variant: t, size: o, className: e })),
      ...r,
      children: a
    }
  );
}
function xn({
  className: e,
  containerClassName: t,
  ratio: o = "auto",
  fit: a = "contain",
  onLoad: r,
  onError: c,
  alt: i = "图片",
  src: s,
  ...l
}) {
  const d = A(null), [m, g] = T(void 0), [x, h] = T(void 0), p = m === s, b = x === s, k = o !== "auto", w = o === "1:1" ? "aspect-square" : o === "4:3" ? "aspect-[4/3]" : o === "16:9" ? "aspect-video" : o === "9:16" ? "aspect-[9/16]" : void 0;
  return L(() => {
    const v = d.current;
    typeof s != "string" || !(v != null && v.complete) || (v.naturalWidth > 0 ? g(s) : h(s));
  }, [s]), /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "image-preview",
      className: f(
        "relative",
        k ? w : "min-h-32",
        t
      ),
      children: [
        !p && !b && /* @__PURE__ */ n(
          "div",
          {
            "data-slot": "image-preview-loading",
            className: "bg-muted/50 absolute inset-0 flex items-center justify-center",
            children: /* @__PURE__ */ n(Wt, { className: "text-muted-foreground size-8 animate-pulse" })
          }
        ),
        b ? /* @__PURE__ */ n(
          "div",
          {
            "data-slot": "image-preview-error",
            className: f(
              "bg-muted/50 flex min-h-32 items-center justify-center p-4",
              k && "absolute inset-0"
            ),
            children: /* @__PURE__ */ n(co, { className: "text-muted-foreground size-8" })
          }
        ) : (
          // A picture wrapper marks a deliberate native img for the Next.js lint, because
          // next/image needs per-host config for runtime URLs and only exists in Next.js.
          /* @__PURE__ */ n("picture", { className: "contents", children: /* @__PURE__ */ n(
            "img",
            {
              ref: d,
              src: s,
              alt: i,
              className: f(
                k ? f("block h-full w-full", {
                  "object-cover": a === "cover",
                  "object-contain": a === "contain"
                }) : "block h-auto w-full object-contain",
                !p && "invisible",
                e
              ),
              onLoad: (v) => {
                typeof s == "string" && g(s), r == null || r(v);
              },
              onError: (v) => {
                typeof s == "string" && h(s), c == null || c(v);
              },
              ...l
            }
          ) })
        )
      ]
    }
  );
}
function qa({
  className: e,
  label: t,
  url: o,
  iconUrl: a,
  ...r
}) {
  const c = ln(o), i = Aa(o), s = t || i, [l, d] = T();
  if (!s) return null;
  const m = a !== void 0 && l !== a;
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "image-source",
      className: f(
        "text-muted-foreground flex items-center gap-2 border-t px-2 py-1.5 text-xs",
        e
      ),
      ...r,
      children: [
        m ? /* @__PURE__ */ n("picture", { className: "contents", children: /* @__PURE__ */ n(
          "img",
          {
            "data-slot": "image-source-icon",
            src: a,
            alt: "",
            className: "size-4 shrink-0 rounded-sm",
            onError: () => d(a)
          }
        ) }) : /* @__PURE__ */ n(
          "span",
          {
            "data-slot": "image-source-icon-fallback",
            "aria-hidden": "true",
            className: "bg-muted flex size-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-medium",
            children: s.charAt(0).toUpperCase()
          }
        ),
        c ? /* @__PURE__ */ u(
          "a",
          {
            "data-slot": "image-source-label",
            href: c,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "hover:text-foreground truncate",
            children: [
              s,
              /* @__PURE__ */ n("span", { className: "sr-only", children: " (opens in a new tab)" })
            ]
          }
        ) : /* @__PURE__ */ n("span", { "data-slot": "image-source-label", className: "truncate", children: s })
      ]
    }
  );
}
function qe({
  className: e,
  children: t,
  ...o
}) {
  return t ? /* @__PURE__ */ n(
    "span",
    {
      "data-slot": "image-filename",
      className: f(
        "text-muted-foreground block truncate px-2 py-1.5 text-xs",
        e
      ),
      ...o,
      children: t
    }
  ) : null;
}
function vn({ src: e, alt: t = "图片预览", children: o }) {
  const [a, r] = T(!1), c = A(null), i = A(null), s = A(null), l = X(() => r(!0), []), d = X(() => {
    var m;
    r(!1), (m = c.current) == null || m.focus();
  }, []);
  return L(() => {
    if (!a) return;
    const m = (g) => {
      var b;
      if (g.key === "Escape") {
        d();
        return;
      }
      if (g.key !== "Tab") return;
      const x = (b = s.current) == null ? void 0 : b.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ), h = x == null ? void 0 : x[0], p = x == null ? void 0 : x[x.length - 1];
      !h || !p || (g.shiftKey && document.activeElement === h ? (g.preventDefault(), p.focus()) : !g.shiftKey && document.activeElement === p && (g.preventDefault(), h.focus()));
    };
    return document.addEventListener("keydown", m), () => document.removeEventListener("keydown", m);
  }, [a, d]), L(() => {
    if (!a) return;
    const m = document.body.style.overflow;
    return document.body.style.overflow = "hidden", () => {
      document.body.style.overflow = m;
    };
  }, [a]), L(() => {
    var m;
    a && ((m = i.current) == null || m.focus());
  }, [a]), /* @__PURE__ */ u(Ze, { children: [
    /* @__PURE__ */ n(
      "div",
      {
        ref: c,
        onClick: l,
        onKeyDown: (m) => {
          m.key === "Enter" ? (m.preventDefault(), m.currentTarget.click()) : m.key === " " && m.preventDefault();
        },
        onKeyUp: (m) => {
          m.key === " " && m.currentTarget.click();
        },
        role: "button",
        tabIndex: 0,
        className: "aui-image-zoom-trigger cursor-zoom-in",
        "aria-label": "点开放大",
        children: o
      }
    ),
    a && Fo(
      /* @__PURE__ */ u(
        "div",
        {
          ref: s,
          "data-slot": "image-zoom-overlay",
          role: "dialog",
          "aria-modal": "true",
          className: "aui-image-zoom-overlay fade-in animate-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 duration-200",
          onClick: d,
          "aria-label": "放大的图",
          children: [
            /* @__PURE__ */ n("picture", { className: "contents", children: /* @__PURE__ */ n(
              "img",
              {
                "data-slot": "image-zoom-content",
                src: e,
                alt: t,
                className: "aui-image-zoom-content fade-in zoom-in-95 animate-in max-h-[90%] max-w-[90%] cursor-zoom-out object-contain duration-200",
                onClick: (m) => {
                  m.stopPropagation(), d();
                }
              }
            ) }),
            /* @__PURE__ */ n(
              "button",
              {
                ref: i,
                type: "button",
                "aria-label": "关掉放大",
                onClick: (m) => {
                  m.stopPropagation(), d();
                },
                className: "text-muted-foreground hover:text-foreground bg-background/80 absolute end-4 top-4 rounded-md p-2",
                children: /* @__PURE__ */ n(ve, { className: "size-5" })
              }
            )
          ]
        }
      ),
      document.body
    )
  ] });
}
function yn({ className: e }) {
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "image-generating",
      className: f(
        "bg-muted/50 flex min-h-32 items-center justify-center p-4",
        e
      ),
      children: [
        /* @__PURE__ */ n(Ae, { className: "text-muted-foreground size-8 animate-spin" }),
        /* @__PURE__ */ n("span", { className: "sr-only", children: "Generating image…" })
      ]
    }
  );
}
function kn({
  className: e,
  reason: t
}) {
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "image-content-filter-error",
      className: f(
        "bg-muted/50 flex min-h-32 flex-col items-center justify-center gap-2 p-4 text-center",
        e
      ),
      children: [
        /* @__PURE__ */ n(lo, { className: "text-muted-foreground size-8" }),
        /* @__PURE__ */ n("p", { className: "text-sm font-medium", children: "Image could not be generated" }),
        t && /* @__PURE__ */ n("p", { className: "text-muted-foreground text-xs", children: t })
      ]
    }
  );
}
function Xa({
  onRegenerate: e
}) {
  const [t, o] = T(!1);
  return /* @__PURE__ */ n(
    "button",
    {
      type: "button",
      onClick: async () => {
        o(!0);
        try {
          await e();
        } catch {
        } finally {
          o(!1);
        }
      },
      disabled: t,
      "data-slot": "image-regenerate",
      "aria-label": "重新生成图片",
      className: "hover:bg-muted inline-flex size-7 items-center justify-center rounded disabled:opacity-50",
      children: /* @__PURE__ */ n(
        ot,
        {
          className: f("size-4", t && "animate-spin")
        }
      )
    }
  );
}
function Ya({ part: e, onRegenerate: t, className: o }) {
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "image-actions",
      className: f("flex items-center gap-1 p-1", o),
      children: [
        /* @__PURE__ */ n(
          "button",
          {
            type: "button",
            onClick: () => Ga(e),
            "data-slot": "image-download",
            "aria-label": "下载图片",
            className: "hover:bg-muted inline-flex size-7 items-center justify-center rounded",
            children: /* @__PURE__ */ n(nt, { className: "size-4" })
          }
        ),
        /* @__PURE__ */ n(
          "button",
          {
            type: "button",
            onClick: () => {
              Ka(e).catch(() => {
              });
            },
            "data-slot": "image-copy",
            "aria-label": "复制图片",
            className: "hover:bg-muted inline-flex size-7 items-center justify-center rounded",
            children: /* @__PURE__ */ n(Se, { className: "size-4" })
          }
        ),
        t && /* @__PURE__ */ n(Xa, { onRegenerate: t })
      ]
    }
  );
}
const Ja = (e) => {
  const { image: t, filename: o, status: a } = e;
  return (a == null ? void 0 : a.type) === "running" ? /* @__PURE__ */ u(ze, { children: [
    /* @__PURE__ */ n(yn, {}),
    /* @__PURE__ */ n(qe, { children: o })
  ] }) : (a == null ? void 0 : a.type) === "incomplete" && a.reason === "content-filter" ? /* @__PURE__ */ n(ze, { children: /* @__PURE__ */ n(kn, { reason: "服务商拦了这张图。" }) }) : /* @__PURE__ */ u(ze, { children: [
    /* @__PURE__ */ n(vn, { src: t, alt: o || "图片", children: /* @__PURE__ */ n(xn, { src: t, alt: o || "图片" }) }),
    /* @__PURE__ */ n(qe, { children: o })
  ] });
}, W = ie(Ja);
W.displayName = "Image";
W.Root = ze;
W.Preview = xn;
W.Source = qa;
W.Filename = qe;
W.Zoom = vn;
W.Actions = Ya;
W.Generating = yn;
W.ContentFilterError = kn;
const Qa = ({
  copiedDuration: e = 3e3
} = {}) => {
  const [t, o] = T(!1), a = A(
    void 0
  ), r = A(0);
  return L(
    () => () => {
      r.current += 1, a.current !== void 0 && (clearTimeout(a.current), a.current = void 0, o(!1));
    },
    []
  ), { isCopied: t, copyToClipboard: (i) => {
    if (!i || typeof navigator > "u" || !navigator.clipboard)
      return;
    const s = r.current;
    navigator.clipboard.writeText(i).then(
      () => {
        s === r.current && (a.current !== void 0 && clearTimeout(a.current), o(!0), a.current = setTimeout(() => {
          a.current = void 0, o(!1);
        }, e));
      },
      () => {
      }
    );
  } };
}, Za = (e, t) => e !== void 0 && t !== void 0 && Object.keys(e).length === Object.keys(t).length && Object.keys(t).every((o) => e[o] === t[o]), St = (e) => {
  const [t, o] = T(e);
  return e !== t && !Za(t, e) ? (o(e), e) : t;
}, er = ({
  components: e,
  componentsByLanguage: t
}) => {
  const o = St(e), a = St(t), r = he(() => o ? {
    ..._t,
    ...qt(o)
  } : _t, [o]);
  return /* @__PURE__ */ n(
    Lo,
    {
      remarkPlugins: [Uo, Oo],
      rehypePlugins: [Bo],
      preprocess: jo,
      className: "aui-md",
      components: r,
      componentsByLanguage: a,
      defer: !0
    }
  );
}, Nn = ie(er), tr = ({ language: e, code: t }) => {
  const { isCopied: o, copyToClipboard: a } = Qa();
  return /* @__PURE__ */ u("div", { className: "aui-code-header-root border-border/50 bg-muted/50 mt-3 flex items-center justify-between rounded-t-xl border border-b-0 px-3.5 py-1.5 text-xs", children: [
    /* @__PURE__ */ n("span", { className: "aui-code-header-language text-muted-foreground font-medium lowercase", children: e }),
    /* @__PURE__ */ u(F, { tooltip: "复制", onClick: () => {
      !t || o || a(t);
    }, children: [
      !o && /* @__PURE__ */ n(Se, { className: "animate-in zoom-in-75 fade-in duration-150" }),
      o && /* @__PURE__ */ n(le, { className: "animate-in zoom-in-50 fade-in duration-200 ease-out" })
    ] })
  ] });
}, _t = qt({
  h1: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "h1",
    {
      className: f(
        "aui-md-h1 mt-5 mb-2 scroll-m-20 text-xl font-semibold first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  h2: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "h2",
    {
      className: f(
        "aui-md-h2 mt-5 mb-2 scroll-m-20 text-lg font-semibold first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  h3: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "h3",
    {
      className: f(
        "aui-md-h3 mt-4 mb-1.5 scroll-m-20 text-base font-semibold first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  h4: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "h4",
    {
      className: f(
        "aui-md-h4 mt-3.5 mb-1 scroll-m-20 text-base font-medium first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  h5: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "h5",
    {
      className: f(
        "aui-md-h5 mt-3 mb-1 text-sm font-semibold first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  h6: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "h6",
    {
      className: f(
        "aui-md-h6 mt-3 mb-1 text-sm font-medium first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  p: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "p",
    {
      className: f(
        "aui-md-p my-3 leading-relaxed first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  a: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "a",
    {
      className: f(
        "aui-md-a text-primary hover:text-primary/80 underline underline-offset-2",
        e
      ),
      ...t
    }
  ),
  blockquote: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "blockquote",
    {
      className: f(
        "aui-md-blockquote border-muted-foreground/30 text-muted-foreground my-3 border-s-2 ps-4",
        e
      ),
      ...t
    }
  ),
  ul: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "ul",
    {
      className: f(
        "aui-md-ul marker:text-muted-foreground my-3 ms-5 list-disc [&>li]:mt-1",
        e
      ),
      ...t
    }
  ),
  ol: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "ol",
    {
      className: f(
        "aui-md-ol marker:text-muted-foreground my-3 ms-5 list-decimal [&>li]:mt-1",
        e
      ),
      ...t
    }
  ),
  hr: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "hr",
    {
      className: f("aui-md-hr border-muted-foreground/20 my-3", e),
      ...t
    }
  ),
  table: ({ className: e, ...t }) => /* @__PURE__ */ n("div", { className: "aui-md-table-wrapper my-3 overflow-x-auto", children: /* @__PURE__ */ n(
    "table",
    {
      className: f(
        "aui-md-table w-full border-separate border-spacing-0",
        e
      ),
      ...t
    }
  ) }),
  th: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "th",
    {
      className: f(
        "aui-md-th bg-muted px-3 py-1.5 text-start font-medium first:rounded-ss-lg last:rounded-se-lg [[align=center]]:text-center [[align=right]]:text-right",
        e
      ),
      ...t
    }
  ),
  td: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "td",
    {
      className: f(
        "aui-md-td border-muted-foreground/20 border-s border-b px-3 py-1.5 text-start last:border-e [[align=center]]:text-center [[align=right]]:text-right",
        e
      ),
      ...t
    }
  ),
  tr: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "tr",
    {
      className: f(
        "aui-md-tr m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-es-lg [&:last-child>td:last-child]:rounded-ee-lg",
        e
      ),
      ...t
    }
  ),
  li: ({ className: e, ...t }) => /* @__PURE__ */ n("li", { className: f("aui-md-li leading-relaxed", e), ...t }),
  strong: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "strong",
    {
      className: f("aui-md-strong font-semibold", e),
      ...t
    }
  ),
  sup: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "sup",
    {
      className: f("aui-md-sup [&>a]:text-xs [&>a]:no-underline", e),
      ...t
    }
  ),
  pre: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "pre",
    {
      className: f(
        "aui-md-pre border-border/50 bg-muted/30 overflow-x-auto rounded-t-none rounded-b-xl border border-t-0 p-3.5 text-[13px] leading-relaxed",
        e
      ),
      ...t
    }
  ),
  code: function({ className: t, ...o }) {
    const a = Do();
    return /* @__PURE__ */ n(
      "code",
      {
        className: f(
          !a && "aui-md-inline-code bg-muted rounded-md px-1.5 py-0.5 font-mono text-[0.85em]",
          t
        ),
        ...o
      }
    );
  },
  CodeHeader: tr
}), dt = xe(function(t, o) {
  return /* @__PURE__ */ n(it.Root, { ref: o, "data-slot": "collapsible", ...t });
});
function ut({
  ...e
}) {
  return /* @__PURE__ */ n(
    it.CollapsibleTrigger,
    {
      "data-slot": "collapsible-trigger",
      ...e
    }
  );
}
function mt({
  ...e
}) {
  return /* @__PURE__ */ n(
    it.CollapsibleContent,
    {
      "data-slot": "collapsible-content",
      ...e
    }
  );
}
const wn = 200, ft = et(!1), nr = ye("aui-reasoning-root mb-4 w-full", {
  variants: {
    variant: {
      outline: "rounded-lg border px-3 py-2",
      ghost: "",
      muted: "bg-muted/50 rounded-lg px-3 py-2"
    }
  },
  defaultVariants: {
    variant: "outline"
  }
}), or = xe(function({
  className: t,
  variant: o,
  open: a,
  onOpenChange: r,
  defaultOpen: c = !1,
  streaming: i,
  onAnimationStart: s,
  children: l,
  ...d
}, m) {
  const [g] = T(c), [x, h] = T(null), p = a !== void 0, b = p ? a : x ?? (i || g), k = i === !0 && b, w = A(i);
  wa(() => {
    w.current !== i && (w.current = i, !p && x === null && !g && (s == null || s()));
  }, [i, p, x, g, s]);
  const v = X(
    (z) => {
      s == null || s(), p || h(z), r == null || r(z);
    },
    [s, p, r]
  );
  return /* @__PURE__ */ n(
    dt,
    {
      ref: m,
      "data-slot": "reasoning-root",
      "data-variant": o,
      open: b,
      onOpenChange: v,
      className: f(
        "group/reasoning-root",
        nr({ variant: o, className: t })
      ),
      style: {
        "--animation-duration": `${wn}ms`
      },
      ...d,
      children: /* @__PURE__ */ n(ft.Provider, { value: k, children: l })
    }
  );
});
function Xe({
  side: e = "bottom",
  className: t,
  ...o
}) {
  return e === "top" ? /* @__PURE__ */ n(
    "div",
    {
      "data-slot": "reasoning-fade",
      className: f(
        "aui-reasoning-fade pointer-events-none absolute inset-x-0 top-0 z-10 h-8",
        "bg-[linear-gradient(to_bottom,var(--color-background),transparent)]",
        "group-data-[variant=muted]/reasoning-root:bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--color-muted)_50%,var(--color-background)),transparent)]",
        "fade-in-0 animate-in",
        "animation-duration-(--animation-duration)",
        t
      ),
      ...o
    }
  ) : /* @__PURE__ */ n(
    "div",
    {
      "data-slot": "reasoning-fade",
      className: f(
        "aui-reasoning-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8",
        "bg-[linear-gradient(to_top,var(--color-background),transparent)]",
        "group-data-[variant=muted]/reasoning-root:bg-[linear-gradient(to_top,color-mix(in_oklab,var(--color-muted)_50%,var(--color-background)),transparent)]",
        "fade-in-0 animate-in",
        "animation-duration-(--animation-duration)",
        t
      ),
      ...o
    }
  );
}
function gt({
  active: e,
  duration: t,
  label: o = "思考",
  className: a,
  ...r
}) {
  const c = t ? `（${t} 秒）` : "";
  return /* @__PURE__ */ u(
    ut,
    {
      "data-slot": "reasoning-trigger",
      className: f(
        "aui-reasoning-trigger group/trigger text-muted-foreground hover:text-foreground flex max-w-[75%] origin-left items-center gap-2 py-1.5 text-sm transition-[color,scale] active:scale-[0.98]",
        a
      ),
      ...r,
      children: [
        /* @__PURE__ */ n(
          uo,
          {
            "data-slot": "reasoning-trigger-icon",
            className: "aui-reasoning-trigger-icon size-4 shrink-0"
          }
        ),
        /* @__PURE__ */ u(
          "span",
          {
            "data-slot": "reasoning-trigger-label",
            className: f(
              "aui-reasoning-trigger-label-wrapper inline-block leading-none tabular-nums",
              e && "shimmer motion-reduce:animate-none"
            ),
            children: [
              o,
              c
            ]
          }
        ),
        /* @__PURE__ */ n(
          at,
          {
            "data-slot": "reasoning-trigger-chevron",
            className: f(
              "aui-reasoning-trigger-chevron mt-0.5 size-4 shrink-0",
              "transition-transform duration-(--animation-duration) ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              "-rotate-90",
              "group-data-open/trigger:rotate-0",
              "group-data-panel-open/trigger:rotate-0"
            )
          }
        )
      ]
    }
  );
}
function pt({
  className: e,
  children: t,
  ...o
}) {
  const a = se(ft);
  return /* @__PURE__ */ u(
    mt,
    {
      "data-slot": "reasoning-content",
      className: f(
        "aui-reasoning-content text-muted-foreground relative overflow-hidden text-sm outline-none",
        "group/collapsible-content ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none",
        "data-closed:animate-collapsible-up",
        "data-open:animate-collapsible-down",
        "data-closed:fill-mode-forwards",
        "data-closed:pointer-events-none",
        "[--tw-duration:var(--animation-duration)]",
        e
      ),
      ...o,
      children: [
        /* @__PURE__ */ n(Xe, { side: "top" }),
        t,
        a ? /* @__PURE__ */ n(Xe, {}) : null
      ]
    }
  );
}
function ht({
  className: e,
  children: t,
  ...o
}) {
  const a = se(ft), r = A(null), c = A(null);
  return L(() => {
    if (!a) return;
    const i = r.current, s = c.current;
    if (!i || !s) return;
    let l = !0, d = i.scrollTop, m = i.scrollHeight;
    const g = () => Math.abs(
      i.scrollHeight - i.scrollTop - i.clientHeight
    ) <= 1 || i.scrollHeight <= i.clientHeight, x = () => {
      l && (i.scrollTop = i.scrollHeight);
    }, h = () => {
      g() ? l = !0 : i.scrollTop < d && i.scrollHeight === m && (l = !1), d = i.scrollTop, m = i.scrollHeight;
    };
    x(), i.addEventListener("scroll", h);
    const p = new ResizeObserver(x);
    return p.observe(s), () => {
      i.removeEventListener("scroll", h), p.disconnect();
    };
  }, [a]), /* @__PURE__ */ n(
    "div",
    {
      ref: r,
      "data-slot": "reasoning-text",
      className: f(
        "aui-reasoning-text relative z-0 max-h-64 overflow-y-auto ps-6 pt-2 pb-2 leading-relaxed text-pretty",
        "transform-gpu transition-[transform,opacity] ease-[cubic-bezier(0.32,0.72,0,1)]",
        "motion-reduce:animate-none",
        "group-data-open/collapsible-content:animate-in",
        "group-data-closed/collapsible-content:animate-out",
        "group-data-open/collapsible-content:fade-in-0",
        "group-data-closed/collapsible-content:fade-out-0",
        "group-data-open/collapsible-content:slide-in-from-top-4",
        "group-data-closed/collapsible-content:slide-out-to-top-4",
        "group-data-open/collapsible-content:blur-in-[2px]",
        "group-data-closed/collapsible-content:blur-out-[2px]",
        "group-data-open/collapsible-content:animation-duration-(--animation-duration)",
        "group-data-closed/collapsible-content:animation-duration-(--animation-duration)",
        e
      ),
      ...o,
      children: /* @__PURE__ */ n("div", { ref: c, className: "aui-reasoning-text-content space-y-4", children: t })
    }
  );
}
const bt = xe(function({ onAnimationStart: t, ...o }, a) {
  const r = A(null), c = tt(r, wn), i = X(() => {
    c(), t == null || t();
  }, [c, t]), s = X(
    (l) => {
      if (r.current = l, typeof a == "function") {
        const d = a(l);
        if (typeof d == "function")
          return () => {
            r.current = null, d();
          };
      } else a && (a.current = l);
    },
    [a]
  );
  return /* @__PURE__ */ n(
    or,
    {
      ref: s,
      onAnimationStart: i,
      ...o
    }
  );
}), ar = () => /* @__PURE__ */ n(Nn, {}), rr = ({
  children: e,
  startIndex: t,
  endIndex: o
}) => {
  const a = E((r) => {
    var c, i;
    if (((c = r.message.status) == null ? void 0 : c.type) !== "running") return !1;
    for (let s = t; s <= o; s++)
      if (((i = r.message.parts[s]) == null ? void 0 : i.status.type) === "running") return !0;
    return !1;
  });
  return /* @__PURE__ */ u(bt, { streaming: a, children: [
    /* @__PURE__ */ n(gt, { active: a }),
    /* @__PURE__ */ n(pt, { "aria-busy": a, children: /* @__PURE__ */ n(ht, { children: e }) })
  ] });
}, ce = ie(
  ar
);
ce.displayName = "Reasoning";
ce.Root = bt;
ce.Trigger = gt;
ce.Content = pt;
ce.Text = ht;
ce.Fade = Xe;
const ir = ie(rr);
ir.displayName = "ReasoningGroup";
function Tn({ className: e, ...t }) {
  return /* @__PURE__ */ n(
    "textarea",
    {
      "data-slot": "textarea",
      className: f(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        e
      ),
      ...t
    }
  );
}
const Et = 200, K = "active:scale-[0.98]";
function Cn({
  className: e,
  open: t,
  onOpenChange: o,
  defaultOpen: a = !1,
  children: r,
  ...c
}) {
  const i = A(null), [s, l] = T(a), d = tt(i, Et), m = t !== void 0, g = m ? t : s, x = X(
    (h) => {
      d(), m || l(h), o == null || o(h);
    },
    [d, m, o]
  );
  return /* @__PURE__ */ n(
    dt,
    {
      ref: i,
      "data-slot": "tool-fallback-root",
      open: g,
      onOpenChange: x,
      className: f(
        "aui-tool-fallback-root group/tool-fallback-root w-full",
        e
      ),
      style: {
        "--animation-duration": `${Et}ms`
      },
      ...c,
      children: r
    }
  );
}
const sr = {
  running: Gt,
  complete: le,
  incomplete: Ht,
  "requires-action": Ut
}, lr = (e) => {
  if (e < 1e3) return "<1s";
  const t = e / 1e3;
  return t < 10 ? `${(Math.floor(t * 10) / 10).toFixed(1)}s` : t < 60 ? `${Math.floor(t)}s` : `${Math.floor(t / 60)}m ${Math.floor(t % 60)}s`;
};
function cr({
  className: e,
  ...t
}) {
  const o = Jn();
  return o === void 0 ? null : /* @__PURE__ */ n(
    "span",
    {
      "data-slot": "tool-fallback-duration",
      className: f(
        "aui-tool-fallback-duration text-muted-foreground text-xs tabular-nums",
        e
      ),
      ...t,
      children: lr(o)
    }
  );
}
function In({
  toolName: e,
  status: t,
  isError: o,
  responseDeliveryStatus: a,
  className: r,
  ...c
}) {
  const i = (t == null ? void 0 : t.type) ?? "complete", s = i === "complete" && o ? "incomplete" : i, l = s === "running", d = (t == null ? void 0 : t.type) === "incomplete" && t.reason === "cancelled", m = sr[s], g = a === "queued" ? "回复排着，还没发出" : s === "running" ? "正在用工具" : s === "requires-action" ? "等你决定" : s === "incomplete" ? `${d ? "取消了的" : "失败的"}工具` : "用了工具";
  return /* @__PURE__ */ u(
    ut,
    {
      "data-slot": "tool-fallback-trigger",
      className: f(
        "aui-tool-fallback-trigger group/trigger text-muted-foreground hover:text-foreground flex w-fit max-w-full origin-left items-center gap-2 py-1.5 text-sm transition-[color,scale] active:scale-[0.98]",
        r
      ),
      ...c,
      children: [
        /* @__PURE__ */ n(
          m,
          {
            "data-slot": "tool-fallback-trigger-icon",
            className: f(
              "aui-tool-fallback-trigger-icon size-4 shrink-0",
              d && "text-muted-foreground",
              l && "animate-spin [animation-duration:0.6s]"
            )
          }
        ),
        /* @__PURE__ */ u(
          "span",
          {
            "data-slot": "tool-fallback-trigger-label",
            className: f(
              "aui-tool-fallback-trigger-label-wrapper inline-block min-w-0 text-start leading-none wrap-anywhere",
              d && "text-muted-foreground line-through",
              l && "shimmer motion-reduce:animate-none"
            ),
            children: [
              g,
              ": ",
              /* @__PURE__ */ n("b", { children: e })
            ]
          }
        ),
        /* @__PURE__ */ n(cr, {}),
        /* @__PURE__ */ n(
          at,
          {
            "data-slot": "tool-fallback-trigger-chevron",
            className: f(
              "aui-tool-fallback-trigger-chevron size-4 shrink-0",
              "transition-transform duration-(--animation-duration) ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              "-rotate-90",
              "group-data-open/trigger:rotate-0",
              "group-data-panel-open/trigger:rotate-0"
            )
          }
        )
      ]
    }
  );
}
function zn({
  className: e,
  children: t,
  ...o
}) {
  return /* @__PURE__ */ n(
    mt,
    {
      "data-slot": "tool-fallback-content",
      className: f(
        "aui-tool-fallback-content relative overflow-hidden text-sm outline-none",
        "group/collapsible-content ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none",
        "data-closed:animate-collapsible-up",
        "data-open:animate-collapsible-down",
        "data-closed:fill-mode-forwards",
        "data-closed:pointer-events-none",
        "[--tw-duration:var(--animation-duration)]",
        e
      ),
      ...o,
      children: /* @__PURE__ */ n(
        "div",
        {
          className: f(
            "flex flex-col gap-2 ps-6 pt-1 pb-2 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none",
            "group-data-open/collapsible-content:animate-in group-data-open/collapsible-content:fade-in-0 group-data-open/collapsible-content:blur-in-[2px] group-data-open/collapsible-content:slide-in-from-top-1",
            "group-data-closed/collapsible-content:animate-out group-data-closed/collapsible-content:fade-out-0 group-data-closed/collapsible-content:blur-out-[2px] group-data-closed/collapsible-content:slide-out-to-top-1",
            "group-data-closed/collapsible-content:animation-duration-(--animation-duration) group-data-open/collapsible-content:animation-duration-(--animation-duration)"
          ),
          children: t
        }
      )
    }
  );
}
function An({
  argsText: e,
  className: t,
  ...o
}) {
  return e ? /* @__PURE__ */ n(
    "div",
    {
      "data-slot": "tool-fallback-args",
      className: f("aui-tool-fallback-args", t),
      ...o,
      children: /* @__PURE__ */ n("pre", { className: "aui-tool-fallback-args-value bg-muted/50 text-foreground/90 rounded-md p-2.5 text-xs break-words whitespace-pre-wrap", children: e })
    }
  ) : null;
}
const Rn = (e, t) => {
  if (typeof e == "string") return e;
  try {
    if (e instanceof Error) return String(e);
    const o = JSON.stringify(e, null, t);
    if (o !== void 0) return o;
  } catch {
  }
  try {
    return String(e);
  } catch {
    return "[Unserializable value]";
  }
};
function Sn({
  result: e,
  className: t,
  ...o
}) {
  return e === void 0 ? null : /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "tool-fallback-result",
      className: f("aui-tool-fallback-result", t),
      ...o,
      children: [
        /* @__PURE__ */ n("p", { className: "aui-tool-fallback-result-header text-muted-foreground text-xs font-medium", children: "结果：" }),
        /* @__PURE__ */ n("pre", { className: "aui-tool-fallback-result-content bg-muted/50 text-foreground/90 mt-1 rounded-md p-2.5 text-xs break-words whitespace-pre-wrap", children: Rn(e, 2) })
      ]
    }
  );
}
function _n({
  status: e,
  className: t,
  ...o
}) {
  if ((e == null ? void 0 : e.type) !== "incomplete") return null;
  const a = e.error, r = a == null ? null : Rn(a);
  if (!r) return null;
  const i = e.reason === "cancelled" ? "取消原因：" : "出错：";
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "tool-fallback-error",
      className: f("aui-tool-fallback-error", t),
      ...o,
      children: [
        /* @__PURE__ */ n("p", { className: "aui-tool-fallback-error-header text-muted-foreground font-semibold", children: i }),
        /* @__PURE__ */ n("p", { className: "aui-tool-fallback-error-reason text-muted-foreground break-words whitespace-pre-line", children: r })
      ]
    }
  );
}
const dr = "用户同意了", ur = "用户没同意", En = {
  "allow-once": "允许",
  "allow-always": "总是允许",
  "reject-once": "不允许",
  "reject-always": "总是不允许"
}, be = (e) => Object.hasOwn(En, e), Pt = (e) => e === "allow-once" || e === "allow-always", Ye = (e) => e.label ?? (be(e.kind) ? En[e.kind] : void 0) ?? e.id, Pn = (e) => (e == null ? void 0 : e.display) === "select" || (e == null ? void 0 : e.display) === "text" || (e == null ? void 0 : e.display) === "questions", mr = (e) => {
  var t;
  return !((t = e.options) != null && t.length) || e.allowFreeform === !0;
}, fr = (e, t) => {
  var o;
  return [
    ...((t == null ? void 0 : t.optionIds) ?? []).map(
      (a) => {
        var r, c;
        return ((c = (r = e.options) == null ? void 0 : r.find((i) => i.id === a)) == null ? void 0 : c.label) ?? a;
      }
    ),
    ...(o = t == null ? void 0 : t.text) != null && o.trim() ? [t.text] : []
  ];
}, Je = (e) => e != null && (e.approved !== void 0 || e.resolution !== void 0), gr = (e) => {
  var c;
  if (e.resolution !== void 0)
    return {
      outcome: "closed",
      label: e.resolution === "cancelled" ? "没决定就取消了" : "没决定就过期了"
    };
  const t = e.optionId === void 0 || (c = e.options) == null ? void 0 : c.find((i) => i.id === e.optionId), o = t !== void 0 ? Ye(t) : e.optionId === void 0 ? void 0 : e.optionId, a = Pn(e) || t !== void 0 && !be(t.kind), r = e.isAutomatic ? "自动" : "";
  return e.approved ? {
    outcome: "allowed",
    label: `${r}${a ? "回答了" : "允许了"}`,
    option: o
  } : {
    outcome: "refused",
    label: `${r}${a ? "跳过了" : "没允许"}`,
    option: o
  };
}, pr = {
  allowed: le,
  refused: Ht,
  closed: mo
};
function hr({
  approval: e,
  className: t,
  receiptRef: o,
  ...a
}) {
  var s;
  const r = gr(e), c = pr[r.outcome], i = [
    ...new Set(
      [e.text, e.reason].filter(
        (l) => typeof l == "string" && l !== ""
      )
    )
  ];
  return /* @__PURE__ */ u(
    "div",
    {
      ref: o,
      "data-slot": "tool-fallback-approval-receipt",
      "data-outcome": r.outcome,
      tabIndex: -1,
      className: f(
        "aui-tool-fallback-approval-receipt flex flex-col gap-1.5 pt-1",
        t
      ),
      ...a,
      children: [
        e.prompt ? /* @__PURE__ */ n("p", { className: "aui-tool-fallback-approval-prompt text-muted-foreground whitespace-pre-line", children: e.prompt }) : null,
        /* @__PURE__ */ u("p", { className: "aui-tool-fallback-approval-receipt-label flex items-center gap-1.5", children: [
          /* @__PURE__ */ n(c, { "aria-hidden": !0, className: "text-muted-foreground size-3.5 shrink-0" }),
          /* @__PURE__ */ n("span", { className: "font-medium", children: r.label }),
          r.option !== void 0 ? /* @__PURE__ */ u("span", { className: "text-muted-foreground", children: [
            "· ",
            r.option
          ] }) : null
        ] }),
        e.answers && ((s = e.questions) == null ? void 0 : s.map((l) => {
          const d = fr(
            l,
            e.answers && Object.hasOwn(e.answers, l.id) ? e.answers[l.id] : void 0
          );
          return d.length === 0 ? null : /* @__PURE__ */ u(
            "p",
            {
              className: "aui-tool-fallback-approval-receipt-answer whitespace-pre-line",
              children: [
                /* @__PURE__ */ n("span", { className: "text-muted-foreground", children: l.header ?? l.prompt }),
                " ",
                "· ",
                d.join(", ")
              ]
            },
            l.id
          );
        })),
        i.map((l) => /* @__PURE__ */ n(
          "p",
          {
            className: "aui-tool-fallback-approval-receipt-note text-muted-foreground whitespace-pre-line",
            children: l
          },
          l
        ))
      ]
    }
  );
}
function br({
  questions: e,
  dismissible: t,
  locked: o,
  onSend: a,
  onDismiss: r
}) {
  const [c, i] = T(() => /* @__PURE__ */ new Map()), [s, l] = T(
    () => /* @__PURE__ */ new Map()
  ), d = (h, p) => i((b) => {
    const k = b.get(h.id) ?? [], w = k.includes(p) ? k.filter((v) => v !== p) : h.multiple ? [...k, p] : [p];
    return new Map(b).set(h.id, w);
  }), m = (h) => {
    const p = c.get(h.id) ?? [], b = s.get(h.id), k = b != null && b.trim() ? b : void 0;
    return {
      ...p.length > 0 && { optionIds: p },
      ...k !== void 0 && { text: k }
    };
  }, g = e.length > 0 && e.every((h) => {
    const p = m(h);
    return p.optionIds !== void 0 || p.text !== void 0;
  }), x = () => {
    o || !g || a(
      Object.fromEntries(
        e.map((h) => [h.id, m(h)])
      )
    );
  };
  return /* @__PURE__ */ u(Ze, { children: [
    e.map((h) => {
      var k, w;
      const p = c.get(h.id) ?? [], b = ((k = h.options) == null ? void 0 : k.some((v) => v.description)) ?? !1;
      return /* @__PURE__ */ u(
        "div",
        {
          role: "group",
          "aria-label": h.prompt,
          "data-slot": "tool-fallback-approval-question",
          className: "aui-tool-fallback-approval-question flex flex-col gap-2",
          children: [
            /* @__PURE__ */ u("p", { className: "aui-tool-fallback-approval-question-prompt text-foreground whitespace-pre-line", children: [
              h.header ? /* @__PURE__ */ n("span", { className: "text-muted-foreground me-1.5 text-xs font-medium uppercase", children: h.header }) : null,
              h.prompt
            ] }),
            h.options && h.options.length > 0 ? /* @__PURE__ */ n(
              "div",
              {
                className: f(
                  "flex gap-2",
                  b ? "flex-col items-stretch" : "flex-wrap items-center"
                ),
                children: h.options.map((v) => {
                  const z = p.includes(v.id);
                  return /* @__PURE__ */ u(
                    M,
                    {
                      size: "sm",
                      variant: z ? "default" : "outline",
                      className: f(
                        K,
                        b && "h-auto flex-col items-start gap-0.5 py-2 text-start whitespace-normal"
                      ),
                      "aria-pressed": z,
                      onClick: () => d(h, v.id),
                      disabled: o,
                      children: [
                        /* @__PURE__ */ n("span", { children: v.label }),
                        v.description ? /* @__PURE__ */ n("span", { className: "text-xs font-normal opacity-80", children: v.description }) : null
                      ]
                    },
                    v.id
                  );
                })
              }
            ) : null,
            mr(h) ? /* @__PURE__ */ n(
              Tn,
              {
                value: s.get(h.id) ?? "",
                onChange: (v) => l(
                  (z) => new Map(z).set(h.id, v.target.value)
                ),
                disabled: o,
                "aria-label": h.prompt,
                placeholder: (w = h.options) != null && w.length ? "或者自己写" : "写下你的回答"
              }
            ) : null
          ]
        },
        h.id
      );
    }),
    /* @__PURE__ */ u("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ n(
        M,
        {
          size: "sm",
          className: K,
          onClick: x,
          disabled: o || !g,
          children: "发送"
        }
      ),
      t ? /* @__PURE__ */ n(
        M,
        {
          size: "sm",
          variant: "outline",
          className: K,
          onClick: r,
          disabled: o,
          children: "跳过"
        }
      ) : null
    ] })
  ] });
}
const $n = (e, t, o) => (e == null ? void 0 : e.type) !== "requires-action" || e.reason !== "interrupt" || t != null || o != null, Mn = xe(function(t, o) {
  var r;
  const a = A(!1);
  return /* @__PURE__ */ n(
    xr,
    {
      carryFocusRef: a,
      forwardedRef: o,
      ...t
    },
    (r = t.approval) == null ? void 0 : r.id
  );
});
function xr({
  className: e,
  forwardedRef: t,
  carryFocusRef: o,
  addResult: a,
  resume: r,
  interrupt: c,
  approval: i,
  respondToApproval: s,
  status: l,
  ...d
}) {
  const [m, g] = T(!1), x = E((y) => y.thread.voice !== void 0), h = E((y) => y.thread.capabilities.answerToolCall), p = m || x, [b, k] = T(null), [w, v] = T(""), [z, S] = T(null), R = (l == null ? void 0 : l.type) === "requires-action", [C, _] = T(R), [j, V] = T(0), q = A(j);
  me(() => {
    q.current = j;
  }, [j]), R !== C && (_(R), R && (g(!1), k(null), v(""), S(null), V(j + 1)));
  const I = A(null), N = A(null), $ = A(null);
  me(() => {
    var y;
    return o.current && (o.current = !1, (y = I.current) == null || y.focus({ preventScroll: !0 })), () => {
      const P = I.current ?? N.current;
      o.current = (P == null ? void 0 : P.contains(P.ownerDocument.activeElement)) ?? !1;
    };
  }, [o]), Kn(
    t,
    () => I.current ?? N.current
  );
  const O = X(
    (y) => {
      if (N.current = y, !y) return;
      const P = $.current === (i == null ? void 0 : i.id);
      $.current = null, P && y.focus({ preventScroll: !0 });
    },
    [i == null ? void 0 : i.id]
  ), H = X(
    (y) => {
      const P = I.current;
      $.current = !y && (P != null && P.contains(P.ownerDocument.activeElement)) ? i == null ? void 0 : i.id : null, I.current = y;
    },
    [i == null ? void 0 : i.id]
  ), $e = i != null && !Je(i) && l !== void 0 && l.type !== "requires-action" && !(m && l.type === "running");
  me(() => {
    $e && ($.current = null);
  }, [$e]);
  const Me = () => {
    const y = I.current;
    y != null && y.contains(y.ownerDocument.activeElement) && y.focus({ preventScroll: !0 });
  };
  if (i != null && Je(i))
    return /* @__PURE__ */ n(
      hr,
      {
        approval: i,
        receiptRef: O,
        className: e,
        ...d
      }
    );
  if ($e || !$n(l, i, c))
    return null;
  const de = i != null && i.prompt ? /* @__PURE__ */ n("p", { className: "aui-tool-fallback-approval-prompt text-foreground whitespace-pre-line", children: i.prompt }) : null;
  if (!h)
    return de && /* @__PURE__ */ n(
      "div",
      {
        "data-slot": "tool-fallback-approval",
        tabIndex: -1,
        className: f(
          "aui-tool-fallback-approval flex flex-col gap-2 pt-1",
          e
        ),
        ...d,
        ref: H,
        children: de
      }
    );
  const Z = s ? i == null ? void 0 : i.options : void 0, Fe = i != null && s != null && Qn(i), ne = (y) => {
    Me(), g(!0), k(null), S(null), (async () => {
      try {
        await y();
      } catch (P) {
        if (q.current !== j) return;
        g(!1), S(
          P instanceof Error ? P.message : String(P)
        );
      }
    })();
  }, Le = (y) => {
    if (!p)
      if (i != null && i.approved === void 0 && s)
        ne(() => s({ approved: y, ...je() }));
      else if (c)
        ne(() => r == null ? void 0 : r({ approved: y }));
      else {
        if ((l == null ? void 0 : l.type) === "requires-action" && l.reason === "interrupt")
          return;
        ne(() => a == null ? void 0 : a(y ? dr : ur));
      }
  }, kt = (y) => {
    p || ne(
      () => s == null ? void 0 : s(
        be(y.kind) ? { optionId: y.id, ...je() } : { optionId: y.id, approved: !0, ...je() }
      )
    );
  }, je = () => w.trim() ? { text: w } : {}, On = () => {
    p || ne(() => s == null ? void 0 : s({ text: w }));
  }, Nt = () => {
    p || ne(() => s == null ? void 0 : s({ approved: !1 }));
  }, Bn = (y) => {
    y.confirm ? (Me(), k(y.id)) : kt(y);
  }, J = b != null ? Z == null ? void 0 : Z.find((y) => y.id === b) : void 0, ue = Pn(i), Ne = ue && s != null && (i == null ? void 0 : i.dismissible) === !0 ? /* @__PURE__ */ n(
    M,
    {
      size: "sm",
      variant: "outline",
      className: K,
      onClick: Nt,
      disabled: p,
      children: "跳过"
    }
  ) : null, we = z ? /* @__PURE__ */ n(
    "p",
    {
      role: "alert",
      className: "aui-tool-fallback-approval-error text-destructive text-xs whitespace-pre-line",
      children: z
    }
  ) : null, De = Fe ? /* @__PURE__ */ u("div", { className: "aui-tool-fallback-approval-answer flex flex-col items-start gap-2", children: [
    /* @__PURE__ */ n(
      Tn,
      {
        value: w,
        onChange: (y) => v(y.target.value),
        disabled: p,
        "aria-label": ue ? (i == null ? void 0 : i.prompt) ?? "回答" : "备注",
        placeholder: ue ? "写下你的回答" : "给这个决定加一句备注"
      }
    ),
    ue && /* @__PURE__ */ u("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ n(
        M,
        {
          size: "sm",
          className: K,
          onClick: On,
          disabled: p,
          children: "发送"
        }
      ),
      Ne
    ] })
  ] }) : null;
  if ((i == null ? void 0 : i.display) === "questions" && s)
    return /* @__PURE__ */ u(
      "div",
      {
        "data-slot": "tool-fallback-approval",
        tabIndex: -1,
        className: f(
          "aui-tool-fallback-approval flex flex-col gap-3 pt-1",
          e
        ),
        ...d,
        ref: H,
        children: [
          de,
          /* @__PURE__ */ n(
            br,
            {
              questions: i.questions ?? [],
              dismissible: i.dismissible === !0,
              locked: p,
              onSend: (y) => ne(() => s({ answers: y })),
              onDismiss: Nt
            }
          ),
          we
        ]
      }
    );
  if (J) {
    const y = typeof J.confirm == "object" ? J.confirm : void 0, P = (y == null ? void 0 : y.description) ?? J.description;
    return /* @__PURE__ */ u(
      "div",
      {
        "data-slot": "tool-fallback-approval-confirm",
        tabIndex: -1,
        className: f(
          "aui-tool-fallback-approval-confirm flex flex-col gap-2 pt-1",
          e
        ),
        ...d,
        ref: H,
        children: [
          /* @__PURE__ */ n("p", { className: "aui-tool-fallback-approval-confirm-title font-semibold", children: (y == null ? void 0 : y.title) ?? `${Ye(J)}?` }),
          P && /* @__PURE__ */ n("p", { className: "aui-tool-fallback-approval-confirm-description text-muted-foreground whitespace-pre-line", children: P }),
          J.grants && J.grants.length > 0 && /* @__PURE__ */ n("ul", { className: "aui-tool-fallback-approval-confirm-grants flex flex-col gap-1", children: J.grants.map((ge) => /* @__PURE__ */ n("li", { children: /* @__PURE__ */ n("code", { className: "aui-tool-fallback-approval-confirm-grant bg-muted rounded px-1.5 py-0.5 text-xs", children: ge }) }, ge)) }),
          /* @__PURE__ */ u("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ n(
              M,
              {
                size: "sm",
                className: K,
                onClick: () => kt(J),
                disabled: p,
                children: "确定"
              }
            ),
            /* @__PURE__ */ n(
              M,
              {
                size: "sm",
                variant: "outline",
                className: K,
                onClick: () => {
                  Me(), k(null);
                },
                disabled: p,
                children: "返回"
              }
            )
          ] })
        ]
      }
    );
  }
  if (Z && Z.length > 0) {
    const y = Z.filter((G) => Pt(G.kind)), P = Z.filter((G) => !be(G.kind)), ge = Z.filter(
      (G) => be(G.kind) && !Pt(G.kind)
    );
    return /* @__PURE__ */ u(
      "div",
      {
        "data-slot": "tool-fallback-approval",
        tabIndex: -1,
        className: f(
          "aui-tool-fallback-approval flex flex-col gap-2 pt-1",
          e
        ),
        ...d,
        ref: H,
        children: [
          de,
          /* @__PURE__ */ u("div", { className: "flex flex-wrap items-center gap-2", children: [
            [...y, ...P, ...ge].map(
              (G) => /* @__PURE__ */ n(
                M,
                {
                  size: "sm",
                  variant: G === y[0] ? "default" : "outline",
                  className: K,
                  onClick: () => Bn(G),
                  disabled: p,
                  children: Ye(G)
                },
                G.id
              )
            ),
            ge.length === 0 && !ue && /* @__PURE__ */ n(
              M,
              {
                size: "sm",
                variant: "outline",
                className: K,
                onClick: () => Le(!1),
                disabled: p,
                children: "不允许"
              }
            ),
            !Fe && Ne
          ] }),
          De,
          we
        ]
      }
    );
  }
  return ue ? /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "tool-fallback-approval",
      tabIndex: -1,
      className: f(
        "aui-tool-fallback-approval flex flex-col gap-2 pt-1",
        e
      ),
      ...d,
      ref: H,
      children: [
        de,
        De,
        !Fe && Ne && /* @__PURE__ */ n("div", { className: "flex items-center gap-2", children: Ne }),
        we
      ]
    }
  ) : /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "tool-fallback-approval",
      tabIndex: -1,
      className: f(
        "aui-tool-fallback-approval flex flex-col gap-2 pt-1",
        e
      ),
      ...d,
      ref: H,
      children: [
        de,
        /* @__PURE__ */ u("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ n(
            M,
            {
              size: "sm",
              className: K,
              onClick: () => Le(!0),
              disabled: p,
              children: "允许"
            }
          ),
          /* @__PURE__ */ n(
            M,
            {
              size: "sm",
              variant: "outline",
              className: K,
              onClick: () => Le(!1),
              disabled: p,
              children: "不允许"
            }
          )
        ] }),
        De,
        we
      ]
    }
  );
}
const vr = ({
  toolName: e,
  argsText: t,
  result: o,
  isError: a,
  status: r,
  responseDeliveryStatus: c,
  addResult: i,
  resume: s,
  interrupt: l,
  approval: d,
  respondToApproval: m
}) => {
  const g = (r == null ? void 0 : r.type) === "incomplete" && r.reason === "cancelled", x = (r == null ? void 0 : r.type) === "requires-action", h = d != null || x && $n(r, d, l), [p, b] = T(x), [k, w] = T(x);
  x !== k && (w(x), x && b(!0));
  const v = A(!1), z = A(null), S = A(null);
  return me(() => {
    var V;
    const R = z.current;
    if (!R || R.isConnected || x || !v.current)
      return;
    const C = d == null || !Je(d);
    v.current = !1;
    const { activeElement: _, body: j } = R.ownerDocument;
    C && (_ == null || _ === j) && ((V = S.current) == null || V.focus({ preventScroll: !0 }));
  }, [d, x, r == null ? void 0 : r.type]), /* @__PURE__ */ u(Cn, { open: p, onOpenChange: b, children: [
    /* @__PURE__ */ n(
      In,
      {
        toolName: e,
        status: r,
        isError: a,
        responseDeliveryStatus: c
      }
    ),
    /* @__PURE__ */ u(zn, { children: [
      /* @__PURE__ */ n(_n, { status: r }),
      /* @__PURE__ */ n(
        An,
        {
          argsText: t,
          className: f(g && "opacity-60")
        }
      ),
      h && /* @__PURE__ */ n(
        Mn,
        {
          addResult: i,
          resume: s,
          interrupt: l,
          approval: d,
          respondToApproval: m,
          status: r,
          onFocusCapture: (R) => {
            const C = R.currentTarget.closest(
              '[data-slot="tool-fallback-root"]'
            );
            S.current = (C == null ? void 0 : C.querySelector(
              '[data-slot="tool-fallback-trigger"]'
            )) ?? null, z.current = R.currentTarget, v.current = !0;
          },
          onBlurCapture: (R) => {
            const C = R.relatedTarget;
            (C ? R.currentTarget.contains(C) : R.currentTarget.contains(
              R.currentTarget.ownerDocument.activeElement
            )) || (v.current = !1);
          }
        }
      ),
      /* @__PURE__ */ n(Sn, { result: o })
    ] })
  ] });
}, Y = ie(
  vr
);
Y.displayName = "ToolFallback";
Y.Root = Cn;
Y.Trigger = In;
Y.Content = zn;
Y.Args = An;
Y.Result = Sn;
Y.Error = _n;
Y.Approval = Mn;
const $t = 200, yr = ye("aui-tool-group-root group/tool-group w-full", {
  variants: {
    variant: {
      outline: "rounded-lg border py-3",
      ghost: "",
      muted: "border-muted-foreground/30 bg-muted/30 rounded-lg border py-3"
    }
  },
  defaultVariants: { variant: "outline" }
});
function xt({
  className: e,
  variant: t,
  open: o,
  onOpenChange: a,
  defaultOpen: r = !1,
  children: c,
  ...i
}) {
  const s = A(null), [l, d] = T(r), m = tt(s, $t), g = o !== void 0, x = g ? o : l, h = X(
    (p) => {
      m(), g || d(p), a == null || a(p);
    },
    [m, g, a]
  );
  return /* @__PURE__ */ n(
    dt,
    {
      ref: s,
      "data-slot": "tool-group-root",
      "data-variant": t ?? "outline",
      open: x,
      onOpenChange: h,
      className: f(
        yr({ variant: t }),
        "group/tool-group-root",
        e
      ),
      style: {
        "--animation-duration": `${$t}ms`
      },
      ...i,
      children: c
    }
  );
}
function vt({
  count: e,
  active: t = !1,
  label: o = `用了 ${e} 个工具`,
  className: a,
  ...r
}) {
  return /* @__PURE__ */ u(
    ut,
    {
      "data-slot": "tool-group-trigger",
      className: f(
        "aui-tool-group-trigger group/trigger flex origin-left items-center gap-2 text-sm transition-[color,scale] active:scale-[0.98]",
        "group-data-[variant=ghost]/tool-group-root:text-muted-foreground group-data-[variant=ghost]/tool-group-root:hover:text-foreground group-data-[variant=ghost]/tool-group-root:py-1.5",
        "group-data-[variant=outline]/tool-group-root:w-full group-data-[variant=outline]/tool-group-root:px-4",
        "group-data-[variant=muted]/tool-group-root:w-full group-data-[variant=muted]/tool-group-root:px-4",
        a
      ),
      ...r,
      children: [
        t && /* @__PURE__ */ n(
          Gt,
          {
            "data-slot": "tool-group-trigger-loader",
            className: "aui-tool-group-trigger-loader size-3 shrink-0 animate-spin [animation-duration:0.6s]"
          }
        ),
        /* @__PURE__ */ n(
          "span",
          {
            "data-slot": "tool-group-trigger-label",
            className: f(
              "aui-tool-group-trigger-label-wrapper inline-block text-start text-xs leading-none font-medium",
              "group-data-[variant=ghost]/tool-group-root:font-normal",
              "group-data-[variant=outline]/tool-group-root:grow",
              "group-data-[variant=muted]/tool-group-root:grow",
              t && "shimmer motion-reduce:animate-none"
            ),
            children: o
          }
        ),
        /* @__PURE__ */ n(
          at,
          {
            "data-slot": "tool-group-trigger-chevron",
            className: f(
              "aui-tool-group-trigger-chevron size-3 shrink-0",
              "transition-transform duration-(--animation-duration) ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              "-rotate-90",
              "group-data-open/trigger:rotate-0",
              "group-data-panel-open/trigger:rotate-0"
            )
          }
        )
      ]
    }
  );
}
function yt({
  className: e,
  children: t,
  ...o
}) {
  return /* @__PURE__ */ n(
    mt,
    {
      "data-slot": "tool-group-content",
      className: f(
        "aui-tool-group-content relative overflow-hidden text-sm outline-none",
        "group/collapsible-content ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none",
        "data-closed:animate-collapsible-up",
        "data-open:animate-collapsible-down",
        "data-closed:fill-mode-forwards",
        "data-closed:pointer-events-none",
        "[--tw-duration:var(--animation-duration)]",
        e
      ),
      ...o,
      children: /* @__PURE__ */ n(
        "div",
        {
          className: f(
            "mt-2 flex flex-col gap-2",
            "group-data-[variant=ghost]/tool-group-root:mt-1 group-data-[variant=ghost]/tool-group-root:gap-1",
            "group-data-[variant=outline]/tool-group-root:mt-3 group-data-[variant=outline]/tool-group-root:border-t group-data-[variant=outline]/tool-group-root:px-4 group-data-[variant=outline]/tool-group-root:pt-3",
            "group-data-[variant=muted]/tool-group-root:mt-3 group-data-[variant=muted]/tool-group-root:border-t group-data-[variant=muted]/tool-group-root:px-4 group-data-[variant=muted]/tool-group-root:pt-3",
            "[&>*]:animate-in [&>*]:fade-in-0 [&>*]:blur-in-[2px] [&>*]:slide-in-from-top-1 [&>*]:animation-duration-(--animation-duration) [&>*]:ease-[cubic-bezier(0.32,0.72,0,1)]",
            "[&>*]:motion-reduce:animate-none",
            "[&>*:nth-child(2)]:[animation-delay:40ms]",
            "[&>*:nth-child(3)]:[animation-delay:80ms]",
            "[&>*:nth-child(4)]:[animation-delay:120ms]",
            "[&>*:nth-child(n+5)]:[animation-delay:160ms]"
          ),
          children: t
        }
      )
    }
  );
}
const kr = ({ children: e, startIndex: t, endIndex: o }) => {
  const a = o - t + 1;
  return /* @__PURE__ */ u(xt, { children: [
    /* @__PURE__ */ n(vt, { count: a }),
    /* @__PURE__ */ n(yt, { children: e })
  ] });
}, Pe = ie(kr);
Pe.displayName = "ToolGroup";
Pe.Root = xt;
Pe.Trigger = vt;
Pe.Content = yt;
function ae({ className: e, ...t }) {
  return /* @__PURE__ */ n(
    "div",
    {
      "data-slot": "skeleton",
      className: f("animate-pulse rounded-md bg-accent", e),
      ...t
    }
  );
}
const Nr = ({
  group: e,
  children: t
}) => {
  const [o, a] = T(!1);
  return /* @__PURE__ */ u(
    xt,
    {
      variant: "ghost",
      open: o || e.counts.requiresAction > 0,
      onOpenChange: a,
      children: [
        /* @__PURE__ */ n(
          vt,
          {
            count: e.indices.length,
            active: e.status.type === "running"
          }
        ),
        /* @__PURE__ */ n(yt, { children: t })
      ]
    }
  );
}, Mt = (e) => !!e.thread.canResume && e.composer.type === "thread" && e.composer.isEmpty, wr = (e) => (e == null ? void 0 : e.completedAt) === void 0 ? void 0 : Math.round((e.completedAt - e.startedAt) / 1e3), Fn = Zn({
  reasoning: ["group-chainOfThought", "group-reasoning"],
  "tool-call": ["group-chainOfThought", "group-tool"],
  "standalone-tool-call": []
}), Tr = [
  "group-chainOfThought",
  "group-task"
], Cr = (e, t) => {
  var a, r;
  const o = Fn(e, t);
  return e.type === "tool-call" && e.messages !== void 0 && o.length > 0 && !((r = (a = t == null ? void 0 : t.toolUIs) == null ? void 0 : a[e.toolName]) != null && r.length) ? Tr : o;
}, Ln = {}, ke = et(Ln), Qe = (e) => e.thread.messages.length === 0 && (!e.thread.isLoading || e.threads.isLoading), Ir = (e) => e.thread.messages.length === 0 && e.thread.isLoading && !e.thread.isDisabled && !e.threads.isLoading, zr = () => /* @__PURE__ */ u(
  "div",
  {
    "data-slot": "aui_thread-history-skeleton",
    role: "status",
    className: "animate-in fade-in fill-mode-both flex flex-col gap-y-6 [animation-delay:150ms] [animation-duration:200ms]",
    children: [
      /* @__PURE__ */ n("span", { className: "sr-only", children: "Loading conversation" }),
      /* @__PURE__ */ n(ae, { className: "ml-auto h-9 w-2/5 rounded-xl motion-reduce:animate-none" }),
      /* @__PURE__ */ u("div", { className: "flex flex-col gap-y-2", children: [
        /* @__PURE__ */ n(ae, { className: "h-4 w-11/12 motion-reduce:animate-none" }),
        /* @__PURE__ */ n(ae, { className: "h-4 w-4/5 motion-reduce:animate-none" }),
        /* @__PURE__ */ n(ae, { className: "h-4 w-3/5 motion-reduce:animate-none" })
      ] }),
      /* @__PURE__ */ n(ae, { className: "ml-auto h-9 w-1/3 rounded-xl motion-reduce:animate-none" }),
      /* @__PURE__ */ u("div", { className: "flex flex-col gap-y-2", children: [
        /* @__PURE__ */ n(ae, { className: "h-4 w-10/12 motion-reduce:animate-none" }),
        /* @__PURE__ */ n(ae, { className: "h-4 w-2/3 motion-reduce:animate-none" })
      ] })
    ]
  }
), Ar = ({
  components: e = Ln,
  autoFocus: t = !0
}) => {
  const o = E(Qe);
  return /* @__PURE__ */ n(ke.Provider, { value: e, children: /* @__PURE__ */ n(Rr, { isEmpty: o, autoFocus: t }) });
}, Rr = ({
  isEmpty: e,
  autoFocus: t
}) => {
  const { Welcome: o = jr } = se(ke);
  return /* @__PURE__ */ n(
    ee.Root,
    {
      className: "aui-root aui-thread-root bg-background @container flex h-full flex-col",
      style: {
        "--thread-max-width": "44rem",
        "--composer-bg": "color-mix(in oklab, var(--color-muted) 30%, transparent)",
        "--composer-radius": "1rem",
        "--composer-padding": "8px"
      },
      children: /* @__PURE__ */ n(
        ee.Viewport,
        {
          turnAnchor: "top",
          "data-slot": "aui_thread-viewport",
          className: "relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth",
          children: /* @__PURE__ */ u(
            "div",
            {
              className: f(
                "mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4",
                e && "justify-center"
              ),
              children: [
                /* @__PURE__ */ n(D, { condition: Qe, children: /* @__PURE__ */ n(o, {}) }),
                /* @__PURE__ */ n(D, { condition: Ir, children: /* @__PURE__ */ n(zr, {}) }),
                /* @__PURE__ */ n(Fr, {}),
                /* @__PURE__ */ n(
                  "div",
                  {
                    "data-slot": "aui_message-group",
                    className: "mb-14 flex flex-col gap-y-6 empty:hidden",
                    children: /* @__PURE__ */ n(ee.Messages, { children: () => /* @__PURE__ */ n(Sr, {}) })
                  }
                ),
                /* @__PURE__ */ u(
                  ee.ViewportFooter,
                  {
                    className: f(
                      "aui-thread-viewport-footer bg-background flex flex-col gap-4 overflow-visible pb-4 md:pb-6",
                      !e && "sticky bottom-0 mt-auto rounded-t-(--composer-radius)"
                    ),
                    children: [
                      /* @__PURE__ */ n(Lr, {}),
                      /* @__PURE__ */ n(Oa, {}),
                      /* @__PURE__ */ n(Or, { autoFocus: t }),
                      /* @__PURE__ */ n(D, { condition: (a) => Qe(a) && a.composer.isEmpty, children: /* @__PURE__ */ n(Dr, {}) })
                    ]
                  }
                )
              ]
            }
          )
        }
      )
    }
  );
}, Sr = () => {
  const { AssistantMessage: e = Hr } = se(ke), t = E((r) => r.message.role), o = E((r) => r.message.composer.isEditing), a = E((r) => r.message.metadata.modality === "voice");
  return o ? /* @__PURE__ */ n(Yr, {}) : a ? /* @__PURE__ */ n(Pr, {}) : t === "user" ? /* @__PURE__ */ n(qr, {}) : /* @__PURE__ */ n(e, {});
}, _r = () => E((e) => {
  var a, r;
  const t = ((a = e.thread.messages[e.message.index - 1]) == null ? void 0 : a.metadata.modality) === "voice", o = ((r = e.thread.messages[e.message.index + 1]) == null ? void 0 : r.metadata.modality) === "voice";
  return t ? o ? "middle" : "end" : o ? "start" : "single";
}), Er = ({ text: e }) => /* @__PURE__ */ n("p", { className: "aui-spoken-message-text m-0", children: e }), Pr = () => {
  const e = E((r) => r.message.role), t = _r(), o = E(
    (r) => {
      var c;
      return r.message.role === "assistant" && ((c = r.message.status) == null ? void 0 : c.type) === "running";
    }
  ), a = t === "start" || t === "single";
  return /* @__PURE__ */ u(
    Q.Root,
    {
      "data-slot": "aui_spoken-message-root",
      "data-role": e,
      "data-voice-run": t,
      className: f(
        "aui-spoken-message bg-muted/40 mx-2 px-3 py-1.5 [contain-intrinsic-size:auto_48px] [content-visibility:auto]",
        t === "single" && "rounded-xl py-2",
        t === "start" && "rounded-t-xl pt-2",
        t === "middle" && "-mt-6",
        t === "end" && "-mt-6 rounded-b-xl pb-2"
      ),
      children: [
        a && /* @__PURE__ */ u(
          "div",
          {
            "data-slot": "aui_spoken-exchange-header",
            className: "text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs",
            children: [
              /* @__PURE__ */ n(go, { className: "size-3", "aria-hidden": !0 }),
              /* @__PURE__ */ n("span", { children: "语音对话" })
            ]
          }
        ),
        /* @__PURE__ */ u(
          "div",
          {
            "data-slot": "aui_spoken-message-content",
            className: "text-foreground flex items-start gap-2 text-sm leading-relaxed",
            children: [
              /* @__PURE__ */ n("span", { className: "text-muted-foreground mt-1 shrink-0", "aria-hidden": !0, children: e === "user" ? /* @__PURE__ */ n(Kt, { className: "size-3.5" }) : /* @__PURE__ */ n(po, { className: "size-3.5" }) }),
              /* @__PURE__ */ n("span", { className: "sr-only", children: e === "user" ? "你说" : "助手说" }),
              /* @__PURE__ */ u("div", { className: "min-w-0 flex-1 wrap-break-word", children: [
                /* @__PURE__ */ n(Q.Parts, { components: { Text: Er } }),
                o && /* @__PURE__ */ n(
                  "span",
                  {
                    "data-slot": "aui_spoken-message-indicator",
                    role: "status",
                    className: "text-muted-foreground ms-1 animate-pulse font-sans",
                    "aria-label": "助手在说",
                    children: "●"
                  }
                )
              ] }),
              /* @__PURE__ */ n($r, {})
            ]
          }
        )
      ]
    }
  );
}, $r = () => /* @__PURE__ */ n(
  B.Root,
  {
    hideWhenRunning: !0,
    autohide: "always",
    className: "aui-spoken-action-bar text-muted-foreground flex shrink-0 gap-1",
    children: /* @__PURE__ */ n(B.Copy, { asChild: !0, children: /* @__PURE__ */ u(F, { tooltip: "复制", className: "size-6", children: [
      /* @__PURE__ */ n(D, { condition: (e) => e.message.isCopied, children: /* @__PURE__ */ n(le, { className: "animate-in zoom-in-50 fade-in duration-200 ease-out" }) }),
      /* @__PURE__ */ n(D, { condition: (e) => !e.message.isCopied, children: /* @__PURE__ */ n(Se, { className: "animate-in zoom-in-75 fade-in duration-150" }) })
    ] }) })
  }
), Ft = "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1']):not([disabled])", Mr = (e) => {
  for (let t = e.nextElementSibling; t; t = t.nextElementSibling) {
    const o = t.matches(Ft) ? t : t.querySelector(Ft);
    if (o instanceof HTMLElement) return o;
  }
  return null;
}, Fr = () => {
  const e = E(
    (r) => r.thread.hasEarlier || r.thread.isLoadingEarlier
  ), t = E((r) => r.thread.isLoadingEarlier), o = A(null), a = A(null);
  return me(() => {
    var s;
    const r = a.current, c = o.current;
    if (e || !r || r.isConnected || !c) return;
    a.current = null;
    const i = document.activeElement;
    i && i !== document.body || (s = Mr(c)) == null || s.focus();
  }, [e]), /* @__PURE__ */ u(
    "div",
    {
      ref: o,
      className: "contents",
      onFocus: (r) => {
        a.current = r.target;
      },
      children: [
        /* @__PURE__ */ n("span", { role: "status", className: "sr-only", children: t ? "在读更早的对话" : "" }),
        e && /* @__PURE__ */ n(ee.LoadEarlier, { asChild: !0, children: /* @__PURE__ */ n(
          M,
          {
            variant: "ghost",
            size: "sm",
            "data-slot": "aui_thread-load-earlier",
            className: "aui-thread-load-earlier text-muted-foreground mb-6 self-center rounded-full",
            children: /* @__PURE__ */ n(
              "span",
              {
                className: f(t && "shimmer motion-reduce:animate-none"),
                children: t ? "在读更早的对话" : "读更早的对话"
              }
            )
          }
        ) })
      ]
    }
  );
}, Lr = () => /* @__PURE__ */ n(ee.ScrollToBottom, { asChild: !0, children: /* @__PURE__ */ n(
  F,
  {
    tooltip: "回到最下面",
    variant: "outline",
    className: "aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible",
    children: /* @__PURE__ */ n(fo, {})
  }
) }), jr = () => /* @__PURE__ */ n("div", { className: "aui-thread-welcome-root mb-6 flex flex-col px-2", children: /* @__PURE__ */ n("p", { className: "aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-medium tracking-tight duration-200", children: "这一处哪里看不懂？" }) }), Dr = () => /* @__PURE__ */ n("div", { className: "aui-thread-welcome-suggestions flex w-full flex-col", children: /* @__PURE__ */ n(ee.Suggestions, { children: () => /* @__PURE__ */ n(Ur, {}) }) }), Ur = () => /* @__PURE__ */ n("div", { className: "aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200", children: /* @__PURE__ */ n(Ue.Trigger, { send: !0, asChild: !0, children: /* @__PURE__ */ u(
  "button",
  {
    type: "button",
    className: "aui-thread-welcome-suggestion group hover:bg-foreground/[0.03] focus-visible:ring-ring/50 flex w-full items-baseline gap-2.5 rounded-md px-2 py-2 text-start text-sm transition-colors outline-none focus-visible:ring-1 motion-reduce:transition-none",
    children: [
      /* @__PURE__ */ n(
        "span",
        {
          "aria-hidden": !0,
          className: "text-muted-foreground/60 group-hover:text-foreground font-mono text-xs transition-colors motion-reduce:transition-none",
          children: ">"
        }
      ),
      /* @__PURE__ */ u("span", { className: "min-w-0 flex-1 truncate", children: [
        /* @__PURE__ */ n(Ue.Title, { className: "aui-thread-welcome-suggestion-text-1 text-foreground" }),
        " ",
        /* @__PURE__ */ n(Ue.Description, { className: "aui-thread-welcome-suggestion-text-2 text-muted-foreground empty:hidden" })
      ] })
    ]
  }
) }) }), Or = ({ autoFocus: e }) => /* @__PURE__ */ n(U.Root, { className: "aui-composer-root relative flex w-full flex-col", children: /* @__PURE__ */ n(U.AttachmentDropzone, { asChild: !0, children: /* @__PURE__ */ u(
  "div",
  {
    "data-slot": "aui_composer-shell",
    className: "border-foreground/10 focus-within:border-foreground/25 data-[dragging=true]:border-ring flex w-full cursor-text flex-col gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) transition-[border-color] data-[dragging=true]:border-dashed data-[dragging=true]:bg-[color-mix(in_oklab,var(--color-accent)_50%,var(--color-background))]",
    children: [
      /* @__PURE__ */ n(ka, {}),
      /* @__PURE__ */ n(
        U.Input,
        {
          placeholder: "问点什么（Enter 发送，Shift+Enter 换行）",
          className: "aui-composer-input caret-primary placeholder:text-muted-foreground/60 max-h-48 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base leading-6 outline-none",
          rows: 1,
          autoFocus: e,
          enterKeyHint: "send",
          "aria-label": "输入问题"
        }
      ),
      /* @__PURE__ */ n(Br, {})
    ]
  }
) }) }), Br = () => {
  const { ComposerExtra: e } = se(ke), t = E(
    (o) => o.composer.submission !== void 0 && !(o.thread.isRunning && o.thread.capabilities.cancel)
  );
  return /* @__PURE__ */ u("div", { className: "aui-composer-action-wrapper relative flex items-center justify-between", children: [
    e ? /* @__PURE__ */ u("div", { className: "aui-composer-action-start flex items-center gap-1.5", children: [
      /* @__PURE__ */ n(At, {}),
      /* @__PURE__ */ n(e, {})
    ] }) : /* @__PURE__ */ n(At, {}),
    /* @__PURE__ */ u("div", { className: "flex items-center gap-1.5", children: [
      /* @__PURE__ */ u(D, { condition: (o) => o.thread.capabilities.dictation, children: [
        /* @__PURE__ */ n(D, { condition: (o) => o.composer.dictation == null, children: /* @__PURE__ */ n(U.Dictate, { asChild: !0, children: /* @__PURE__ */ n(
          F,
          {
            tooltip: "语音输入",
            side: "bottom",
            type: "button",
            variant: "ghost",
            size: "icon",
            className: "aui-composer-dictate text-muted-foreground hover:text-foreground size-7 rounded-full",
            "aria-label": "开始语音输入",
            children: /* @__PURE__ */ n(Kt, { className: "aui-composer-dictate-icon size-4" })
          }
        ) }) }),
        /* @__PURE__ */ n(D, { condition: (o) => o.composer.dictation != null, children: /* @__PURE__ */ n(U.StopDictation, { asChild: !0, children: /* @__PURE__ */ n(
          F,
          {
            tooltip: "停止听写",
            side: "bottom",
            type: "button",
            variant: "ghost",
            size: "icon",
            className: "aui-composer-stop-dictation text-destructive size-7 rounded-full",
            "aria-label": "停止语音输入",
            children: /* @__PURE__ */ n(Ct, { className: "aui-composer-stop-dictation-icon size-3.5 animate-pulse fill-current" })
          }
        ) }) })
      ] }),
      /* @__PURE__ */ n(
        D,
        {
          condition: (o) => (!o.composer.canCancel || o.thread.voice !== void 0 && o.composer.submission === void 0) && !Mt(o),
          children: /* @__PURE__ */ n(U.Send, { asChild: !0, children: /* @__PURE__ */ n(
            F,
            {
              tooltip: "发送",
              side: "bottom",
              type: "button",
              variant: "default",
              size: "icon",
              className: "aui-composer-send size-7 rounded-full",
              "aria-label": "发送",
              children: /* @__PURE__ */ n(ho, { className: "aui-composer-send-icon size-4" })
            }
          ) })
        }
      ),
      /* @__PURE__ */ n(D, { condition: Mt, children: /* @__PURE__ */ n(U.Resume, { asChild: !0, children: /* @__PURE__ */ n(
        F,
        {
          tooltip: "接着生成",
          side: "bottom",
          type: "button",
          variant: "default",
          size: "icon",
          className: "aui-composer-resume size-7 rounded-full",
          "aria-label": "接着生成",
          children: /* @__PURE__ */ n(Re, { className: "aui-composer-resume-icon size-4" })
        }
      ) }) }),
      /* @__PURE__ */ n(
        D,
        {
          condition: (o) => o.composer.canCancel && (o.thread.voice === void 0 || o.composer.submission !== void 0),
          children: /* @__PURE__ */ n(U.Cancel, { asChild: !0, children: /* @__PURE__ */ n(
            M,
            {
              type: "button",
              variant: "default",
              size: "icon",
              className: "aui-composer-cancel size-7 rounded-full",
              "aria-label": t ? "取消发送" : "停下",
              children: /* @__PURE__ */ n(Ct, { className: "aui-composer-cancel-icon size-3.5 fill-current" })
            }
          ) })
        }
      )
    ] })
  ] });
}, Wr = () => /* @__PURE__ */ n(Q.Error, { children: /* @__PURE__ */ u(wt.Root, { className: "aui-message-error-root group/error border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 data-[run-state=in-progress]:border-border data-[run-state=in-progress]:bg-muted/40 data-[run-state=in-progress]:text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-3 text-sm data-[run-state=stale]:border-amber-500/40 data-[run-state=stale]:bg-amber-500/10 data-[run-state=stale]:text-amber-800 dark:text-red-200 dark:data-[run-state=stale]:bg-amber-500/5 dark:data-[run-state=stale]:text-amber-200", children: [
  /* @__PURE__ */ n(bo, { className: "hidden size-4 shrink-0 group-data-[run-state=stale]/error:block" }),
  /* @__PURE__ */ n(Ae, { className: "hidden size-4 shrink-0 animate-spin group-data-[run-state=in-progress]/error:block motion-reduce:animate-none" }),
  /* @__PURE__ */ n(wt.Message, { className: "aui-message-error-message line-clamp-2 min-w-0 flex-1" }),
  /* @__PURE__ */ n(B.Resume, { asChild: !0, children: /* @__PURE__ */ u(
    M,
    {
      variant: "outline",
      size: "sm",
      className: "h-7 gap-1.5 border-amber-500/40 bg-transparent hover:bg-amber-500/15 disabled:hidden dark:border-amber-400/30",
      children: [
        /* @__PURE__ */ n(Re, { className: "size-3.5" }),
        "接着生成"
      ]
    }
  ) }),
  /* @__PURE__ */ n(B.RefreshRun, { asChild: !0, children: /* @__PURE__ */ u(
    M,
    {
      variant: "ghost",
      size: "sm",
      className: "h-7 gap-1.5 disabled:hidden",
      children: [
        /* @__PURE__ */ n(ot, { className: "size-3.5" }),
        "重新回答"
      ]
    }
  ) })
] }) }), Hr = () => {
  const {
    Indicator: e,
    ToolFallback: t = Y,
    ToolGroup: o,
    ReasoningGroup: a,
    TaskGroup: r,
    MessageFooter: c
  } = se(ke), i = r ? Cr : Fn;
  return /* @__PURE__ */ u(
    Q.Root,
    {
      "data-slot": "aui_assistant-message-root",
      "data-role": "assistant",
      className: "fade-in slide-in-from-bottom-1 animate-in relative -mb-7.5 pb-7.5 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]",
      children: [
        /* @__PURE__ */ u(
          "div",
          {
            "data-slot": "aui_assistant-message-content",
            className: "text-foreground px-2 leading-relaxed wrap-break-word",
            children: [
              /* @__PURE__ */ n(Q.GroupedParts, { groupBy: i, children: ({ part: d, children: m }) => {
                switch (d.type) {
                  case "group-chainOfThought":
                    return /* @__PURE__ */ n("div", { "data-slot": "aui_chain-of-thought", children: m });
                  case "group-task":
                    return r ? /* @__PURE__ */ n(r, { group: d }) : null;
                  case "group-tool":
                    return o ? /* @__PURE__ */ n(o, { group: d, children: m }) : /* @__PURE__ */ n(Nr, { group: d, children: m });
                  case "group-reasoning": {
                    if (a)
                      return /* @__PURE__ */ n(a, { group: d, children: m });
                    const g = d.status.type === "running";
                    return /* @__PURE__ */ u(bt, { streaming: g, children: [
                      /* @__PURE__ */ n(
                        gt,
                        {
                          active: g,
                          duration: wr(d.timing)
                        }
                      ),
                      /* @__PURE__ */ n(pt, { "aria-busy": g, children: /* @__PURE__ */ n(ht, { children: m }) })
                    ] });
                  }
                  case "text":
                    return /* @__PURE__ */ n(Nn, {});
                  case "reasoning":
                    return /* @__PURE__ */ n(ce, { ...d });
                  case "tool-call":
                    return d.toolUI ?? /* @__PURE__ */ n(t, { ...d });
                  case "data":
                    return d.dataRendererUI;
                  case "file":
                    return /* @__PURE__ */ n("div", { "data-slot": "aui_assistant-message-file", className: "py-1", children: /* @__PURE__ */ n(jn, { ...d }) });
                  case "image":
                    return /* @__PURE__ */ n("div", { "data-slot": "aui_assistant-message-image", className: "py-1", children: /* @__PURE__ */ n(W, { ...d }) });
                  case "indicator":
                    return e ? /* @__PURE__ */ n(e, {}) : /* @__PURE__ */ n(
                      "span",
                      {
                        "data-slot": "aui_assistant-message-indicator",
                        className: "animate-pulse font-sans",
                        "aria-label": "正在回答",
                        children: "●"
                      }
                    );
                  default:
                    return null;
                }
              } }),
              /* @__PURE__ */ n(Wr, {})
            ]
          }
        ),
        /* @__PURE__ */ u(
          "div",
          {
            "data-slot": "aui_assistant-message-footer",
            className: f("ms-2 flex items-center", "min-h-7.5 pt-1.5"),
            children: [
              /* @__PURE__ */ n(Dn, {}),
              /* @__PURE__ */ n(Gr, {})
            ]
          }
        ),
        c ? /* @__PURE__ */ n(c, {}) : null
      ]
    }
  );
}, Gr = () => /* @__PURE__ */ u(
  B.Root,
  {
    hideWhenRunning: !0,
    autohide: "not-last",
    className: "aui-assistant-action-bar-root text-muted-foreground animate-in fade-in col-start-3 row-start-2 -ms-1 flex gap-1 duration-200",
    children: [
      /* @__PURE__ */ n(B.Copy, { asChild: !0, children: /* @__PURE__ */ u(F, { tooltip: "复制", children: [
        /* @__PURE__ */ n(D, { condition: (e) => e.message.isCopied, children: /* @__PURE__ */ n(le, { className: "animate-in zoom-in-50 fade-in duration-200 ease-out" }) }),
        /* @__PURE__ */ n(D, { condition: (e) => !e.message.isCopied, children: /* @__PURE__ */ n(Se, { className: "animate-in zoom-in-75 fade-in duration-150" }) })
      ] }) }),
      /* @__PURE__ */ u(D, { condition: (e) => e.thread.capabilities.feedback, children: [
        /* @__PURE__ */ n(B.FeedbackPositive, { asChild: !0, children: /* @__PURE__ */ n(
          F,
          {
            tooltip: "有用",
            className: "data-[submitted=true]:bg-accent data-[submitted=true]:text-accent-foreground",
            children: /* @__PURE__ */ n(yo, {})
          }
        ) }),
        /* @__PURE__ */ n(B.FeedbackNegative, { asChild: !0, children: /* @__PURE__ */ n(
          F,
          {
            tooltip: "没用",
            className: "data-[submitted=true]:bg-accent data-[submitted=true]:text-accent-foreground",
            children: /* @__PURE__ */ n(ko, {})
          }
        ) })
      ] }),
      /* @__PURE__ */ n(B.Reload, { asChild: !0, children: /* @__PURE__ */ n(F, { tooltip: "重新回答", children: /* @__PURE__ */ n(ot, {}) }) }),
      /* @__PURE__ */ u(Te.Root, { children: [
        /* @__PURE__ */ n(Te.Trigger, { asChild: !0, children: /* @__PURE__ */ n(
          F,
          {
            tooltip: "更多",
            className: "data-[state=open]:bg-accent",
            children: /* @__PURE__ */ n(No, {})
          }
        ) }),
        /* @__PURE__ */ n(
          Te.Content,
          {
            side: "bottom",
            align: "start",
            sideOffset: 6,
            className: "aui-action-bar-more-content bg-popover text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1.5",
            children: /* @__PURE__ */ n(B.ExportMarkdown, { asChild: !0, children: /* @__PURE__ */ u(Te.Item, { className: "aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none", children: [
              /* @__PURE__ */ n(nt, { className: "size-4" }),
              "导出成 Markdown"
            ] }) })
          }
        )
      ] })
    ]
  }
), jn = (e) => {
  const t = typeof e.mimeType == "string" && typeof e.data == "string" && e.mimeType.toLowerCase().startsWith("image/") ? Ee(e.data, e.mimeType, e.sourceType) : null;
  return t ? /* @__PURE__ */ n(
    W,
    {
      type: "image",
      image: t,
      status: e.status,
      ...typeof e.filename == "string" && { filename: e.filename }
    }
  ) : /* @__PURE__ */ n(te, { ...e });
}, Kr = (e) => /* @__PURE__ */ n("div", { "data-slot": "aui_user-message-file", className: "py-1", children: /* @__PURE__ */ n(jn, { ...e }) }), Vr = (e) => /* @__PURE__ */ n("div", { "data-slot": "aui_user-message-image", className: "py-1", children: /* @__PURE__ */ n(W, { ...e }) }), qr = () => /* @__PURE__ */ u(
  Q.Root,
  {
    "data-slot": "aui_user-message-root",
    className: "fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto] [&:where(>*)]:col-start-2",
    "data-role": "user",
    children: [
      /* @__PURE__ */ n(ya, {}),
      /* @__PURE__ */ u("div", { className: "aui-user-message-content-wrapper relative col-start-2 min-w-0", children: [
        /* @__PURE__ */ n("div", { className: "aui-user-message-content peer bg-muted text-foreground rounded-(--composer-radius) px-4 py-2 wrap-break-word empty:hidden", children: /* @__PURE__ */ n(
          Q.Parts,
          {
            components: { File: Kr, Image: Vr }
          }
        ) }),
        /* @__PURE__ */ n("div", { className: "aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full", children: /* @__PURE__ */ n(Xr, {}) })
      ] }),
      /* @__PURE__ */ n(
        Dn,
        {
          "data-slot": "aui_user-branch-picker",
          className: "col-span-full col-start-1 -me-1 justify-end"
        }
      )
    ]
  }
), Xr = () => /* @__PURE__ */ n(
  B.Root,
  {
    hideWhenRunning: !0,
    autohide: "not-last",
    className: "aui-user-action-bar-root flex flex-col items-end",
    children: /* @__PURE__ */ n(B.Edit, { asChild: !0, children: /* @__PURE__ */ n(F, { tooltip: "改这个问题", className: "aui-user-action-edit", children: /* @__PURE__ */ n(wo, {}) }) })
  }
), Yr = () => /* @__PURE__ */ n(
  Q.Root,
  {
    "data-slot": "aui_edit-composer-wrapper",
    className: "flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]",
    children: /* @__PURE__ */ u(U.Root, { className: "aui-edit-composer-root border-foreground/10 focus-within:border-foreground/25 ms-auto flex w-full max-w-[85%] cursor-text flex-col rounded-(--composer-radius) border bg-(--composer-bg) transition-[border-color]", children: [
      /* @__PURE__ */ n(
        U.Input,
        {
          className: "aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none",
          autoFocus: !0
        }
      ),
      /* @__PURE__ */ u("div", { className: "aui-edit-composer-footer mx-2.5 mb-2.5 flex items-center gap-1.5 self-end", children: [
        /* @__PURE__ */ n(U.Cancel, { asChild: !0, children: /* @__PURE__ */ n(M, { variant: "ghost", size: "sm", className: "h-8 px-3", children: "取消" }) }),
        /* @__PURE__ */ n(U.Send, { asChild: !0, children: /* @__PURE__ */ n(M, { size: "sm", className: "h-8 px-3", children: "重新问" }) })
      ] })
    ] })
  }
), Dn = ({
  className: e,
  ...t
}) => /* @__PURE__ */ u(
  pe.Root,
  {
    hideWhenSingleBranch: !0,
    className: f(
      "aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs",
      e
    ),
    ...t,
    children: [
      /* @__PURE__ */ n(pe.Previous, { asChild: !0, children: /* @__PURE__ */ n(F, { tooltip: "上一个版本", children: /* @__PURE__ */ n(xo, {}) }) }),
      /* @__PURE__ */ u("span", { className: "aui-branch-picker-state font-medium", children: [
        /* @__PURE__ */ n(pe.Number, {}),
        " / ",
        /* @__PURE__ */ n(pe.Count, {})
      ] }),
      /* @__PURE__ */ n(pe.Next, { asChild: !0, children: /* @__PURE__ */ n(F, { tooltip: "下一个版本", children: /* @__PURE__ */ n(vo, {}) }) })
    ]
  }
);
function Jr(e, t, o) {
  return Number.isNaN(e) ? t : Math.min(o, Math.max(t, e));
}
function Qr({
  items: e,
  revision: t,
  title: o = "计划",
  description: a,
  maxVisible: r,
  className: c,
  ...i
}) {
  const s = e.filter((b) => b.status === "done").length, l = e.filter((b) => b.status !== "cancelled").length, d = Math.floor(
    Jr(r ?? e.length, 0, e.length)
  ), [m, g] = T(!1), x = Vn(), h = e.filter(
    (b, k) => k >= d && b.status !== "active" && b.status !== "failed"
  ), p = r !== void 0 && h.length > 0;
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "todo-list",
      className: f("flex w-full max-w-sm flex-col gap-3", c),
      ...i,
      children: [
        /* @__PURE__ */ u("div", { className: "flex items-start justify-between gap-3", children: [
          /* @__PURE__ */ u("div", { className: "min-w-0", children: [
            /* @__PURE__ */ n("span", { className: "text-[13.5px] font-medium", children: o }),
            a ? /* @__PURE__ */ n("p", { className: "text-muted-foreground text-xs leading-4 break-words", children: a }) : null
          ] }),
          /* @__PURE__ */ n(
            "span",
            {
              className: f(
                _e,
                "text-muted-foreground shrink-0 whitespace-nowrap tabular-nums"
              ),
              children: t === void 0 ? `${s}/${l}` : `${s}/${l} · 第 ${t} 版`
            }
          )
        ] }),
        /* @__PURE__ */ n("ul", { id: x, className: "flex flex-col gap-1", children: e.map((b, k) => {
          const w = p && k >= d && b.status !== "active" && b.status !== "failed", v = "fade-in slide-in-from-bottom-1 animate-in fill-mode-both flex items-start gap-2.5 py-0.5 text-[13.5px] duration-300 motion-reduce:animate-none", z = /* @__PURE__ */ u(Ze, { children: [
            /* @__PURE__ */ n(
              "span",
              {
                "aria-hidden": !0,
                className: "flex size-4 h-5 shrink-0 items-center justify-center",
                children: b.status === "done" ? /* @__PURE__ */ n("span", { className: "border-foreground/20 bg-foreground/[0.06] flex size-3.5 items-center justify-center rounded-[5px] border", children: /* @__PURE__ */ n(le, { className: "text-muted-foreground size-2.5" }) }) : b.status === "failed" ? /* @__PURE__ */ n("span", { className: "flex size-3.5 items-center justify-center rounded-[5px] border border-red-600/25 bg-red-600/[0.08] dark:border-red-400/25 dark:bg-red-400/[0.08]", children: /* @__PURE__ */ n(ve, { className: "size-2.5 text-red-600 dark:text-red-400" }) }) : b.status === "cancelled" ? /* @__PURE__ */ n("span", { className: "border-foreground/15 text-muted-foreground flex size-3.5 items-center justify-center rounded-[5px] border", children: /* @__PURE__ */ n(To, { className: "size-2.5" }) }) : b.status === "active" ? /* @__PURE__ */ n(Ae, { className: "size-3.5 animate-spin text-blue-500 motion-reduce:animate-none dark:text-blue-400" }) : /* @__PURE__ */ n("span", { className: "border-foreground/15 size-3.5 rounded-[5px] border" })
              }
            ),
            /* @__PURE__ */ n("span", { className: "sr-only", children: b.status }),
            /* @__PURE__ */ u("div", { className: "min-w-0 flex-1 leading-5 break-words", children: [
              /* @__PURE__ */ n(
                "span",
                {
                  className: f(
                    b.status === "done" && "text-muted-foreground line-through decoration-[1.5px]",
                    b.status === "active" && "text-foreground/90",
                    b.status === "pending" && "text-muted-foreground",
                    b.status === "failed" && "text-red-600 dark:text-red-400",
                    b.status === "cancelled" && "text-muted-foreground line-through decoration-[1.5px]"
                  ),
                  children: b.text
                }
              ),
              b.status === "failed" ? b.reason ? /* @__PURE__ */ n("p", { className: "text-muted-foreground text-xs leading-4 break-words", children: b.reason }) : null : b.status !== "cancelled" && b.description ? /* @__PURE__ */ n("p", { className: "text-muted-foreground text-xs leading-4 break-words", children: b.description }) : null
            ] })
          ] });
          return w && !m ? null : /* @__PURE__ */ n(
            "li",
            {
              "data-status": b.status,
              className: v,
              children: z
            },
            b.id
          );
        }) }),
        p ? /* @__PURE__ */ n(
          "button",
          {
            type: "button",
            "aria-expanded": m,
            "aria-controls": x,
            onClick: () => g((b) => !b),
            className: f(
              Ca,
              "self-start px-2 py-1 text-xs font-medium"
            ),
            children: m ? "收起" : `还有 ${h.length} 项`
          }
        ) : null
      ]
    }
  );
}
function Zr({
  state: e,
  label: t,
  elapsed: o,
  trailing: a,
  className: r,
  ...c
}) {
  return /* @__PURE__ */ u(
    "span",
    {
      "data-slot": "agent-status",
      className: f(
        an,
        "flex items-center gap-2.5 rounded-full py-1.5 ps-3.5 pe-1.5",
        r
      ),
      ...c,
      children: [
        e === "done" ? /* @__PURE__ */ n(le, { "aria-hidden": !0, className: "size-3 shrink-0 text-emerald-500" }) : e === "failed" ? /* @__PURE__ */ n(ve, { "aria-hidden": !0, className: "text-destructive size-3 shrink-0" }) : /* @__PURE__ */ n(
          "span",
          {
            "aria-hidden": !0,
            className: f(
              "size-1.5 shrink-0 rounded-full motion-reduce:animate-none",
              e === "working" ? "animate-pulse bg-blue-500 dark:bg-blue-400" : "border-foreground/35 border"
            )
          }
        ),
        /* @__PURE__ */ n("span", { className: "sr-only", children: { working: "进行中", waiting: "等着", done: "完成", failed: "失败" }[e] }),
        /* @__PURE__ */ n(
          "span",
          {
            className: "fade-in blur-in-[2px] animate-in max-w-44 truncate text-xs duration-300 motion-reduce:animate-none",
            children: t
          },
          t
        ),
        o !== void 0 && e !== "done" && e !== "failed" && /* @__PURE__ */ n("span", { className: f(_e, "text-muted-foreground tabular-nums"), children: o }),
        /* @__PURE__ */ n(
          "span",
          {
            "aria-hidden": !0,
            "data-slot": "agent-status-trailing",
            className: "text-muted-foreground flex size-6 items-center justify-center rounded-full",
            children: a !== void 0 ? a : e === "done" || e === "failed" ? /* @__PURE__ */ n(Co, { className: "size-3" }) : /* @__PURE__ */ n(Ot, { className: "size-3" })
          }
        )
      ]
    }
  );
}
const Lt = "retainpdf-katex-css";
function ei() {
  L(() => {
    if (typeof document > "u" || document.getElementById(Lt)) return;
    const e = So();
    if (!e) return;
    const t = document.createElement("link");
    t.id = Lt, t.rel = "stylesheet", t.href = e, document.head.appendChild(t);
  }, []);
}
const Un = et(null), ti = {
  allow_once: "allow-once",
  allow_always: "allow-always",
  reject_once: "reject-once",
  reject_always: "reject-always"
};
function ni(e) {
  var l;
  const t = e.artifact || {}, o = se(Un);
  qn((o == null ? void 0 : o.subscribe) ?? (() => () => {
  }), (o == null ? void 0 : o.snapshot) ?? (() => 0));
  const a = o == null ? void 0 : o.get(e.toolCallId), r = a ? { type: "requires-action", reason: "interrupt" } : t.status === "failed" ? { type: "incomplete", reason: "error" } : t.status === "completed" ? { type: "complete" } : { type: "running" }, c = a ? {
    id: e.toolCallId,
    prompt: t.title || e.toolName,
    options: a.request.options.map((d) => ({ id: d.optionId, kind: ti[d.kind] || d.kind, label: d.name }))
  } : void 0, i = a ? async (d) => {
    const m = a.request.options, g = d.optionId ? m.find((x) => x.optionId === d.optionId) : m.find((x) => d.approved ? x.kind.startsWith("allow") : x.kind.startsWith("reject"));
    a.resolve(g ? { outcome: { outcome: "selected", optionId: g.optionId } } : { outcome: { outcome: "cancelled" } });
  } : void 0, s = (l = t.locations) != null && l.length ? `
（${t.locations.join("、")}）` : "";
  return /* @__PURE__ */ n(
    Y,
    {
      ...e,
      toolName: t.title || e.toolName,
      status: r,
      isError: t.status === "failed",
      argsText: e.argsText && e.argsText !== "{}" ? e.argsText : "",
      result: t.output ? `${t.output}${s}` : e.result,
      approval: c,
      respondToApproval: i
    }
  );
}
const oi = { pending: "pending", in_progress: "active", completed: "done" };
function ai({ data: e }) {
  const t = e.entries.map((o, a) => ({ id: `${a}`, text: o.content, status: oi[o.status] || "pending" }));
  return /* @__PURE__ */ n(Qr, { className: "reader-ask-plan", items: t, title: "计划", maxVisible: 6 });
}
function ri({ data: e }) {
  const t = e.state === "idle" || e.state === "done" || e.state === "completed" ? "done" : e.state === "failed" || e.state === "error" ? "failed" : e.state === "waiting" || e.state === "paused" ? "waiting" : "working";
  return /* @__PURE__ */ n("div", { className: "reader-ask-subagent", children: /* @__PURE__ */ n(Zr, { state: t, trailing: null, label: e.description ? `${e.title} · ${e.description}` : e.title }) });
}
const ii = Dt({ name: "plan", render: ai }), si = Dt({ name: "subagent", render: ri }), li = 1e4;
function ci() {
  const [e, t] = T(!1);
  return L(() => {
    const o = window.setTimeout(() => t(!0), li);
    return () => window.clearTimeout(o);
  }, []), /* @__PURE__ */ u("div", { className: "reader-ask-waiting", role: "status", children: [
    /* @__PURE__ */ n("span", { className: "reader-ask-dot", "aria-hidden": !0 }),
    e ? "还在等 agent 回应……" : "在想…"
  ] });
}
const jt = "image/png,image/jpeg,image/webp,image/gif", di = 4 * 1024 * 1024;
class ui extends no {
  constructor() {
    super(...arguments);
    oe(this, "accept", jt);
  }
  async add(o) {
    if (!jt.split(",").includes(o.file.type)) throw new Error("只能贴 PNG、JPEG、WebP、GIF 图片");
    if (o.file.size > di) throw new Error("图片太大（超过 4MB），先压一下再贴");
    return super.add(o);
  }
}
function mi(e) {
  return function() {
    const o = E((r) => {
      var c;
      return (c = r.message.metadata) == null ? void 0 : c.custom;
    });
    if (!(o != null && o.turn)) return null;
    const a = qo(o.turn, o.endedAt ?? null, e());
    return a ? /* @__PURE__ */ n("div", { className: "reader-ask-footer", children: a }) : null;
  };
}
function fi() {
  return /* @__PURE__ */ n("p", { className: "reader-ask-empty", children: "问这一处的问题：哪里看不懂、这个式子怎么来的、这个词什么意思……" });
}
function gi({ agents: e }) {
  const t = (e || []).filter((r) => r.available === !1 && r.install), [o, a] = T("");
  return t.length ? /* @__PURE__ */ u("details", { className: "reader-ask-install", children: [
    /* @__PURE__ */ u("summary", { children: [
      "还能接本机的 ",
      t.map((r) => r.name).join("、"),
      "（要先装）"
    ] }),
    /* @__PURE__ */ n("ul", { children: t.map((r) => /* @__PURE__ */ u("li", { children: [
      /* @__PURE__ */ n("span", { children: r.name }),
      /* @__PURE__ */ n("code", { children: r.install }),
      /* @__PURE__ */ n(
        Ce,
        {
          className: "reader-ask-close",
          "aria-label": `复制「${r.name}」的安装命令`,
          title: o === r.id ? "已复制" : "复制安装命令，在终端里跑一次",
          onClick: async () => {
            await _o(r.install || "") && a(r.id);
          },
          children: /* @__PURE__ */ n(Ao, { size: 13, "aria-hidden": !0 })
        }
      )
    ] }, r.id)) })
  ] }) : null;
}
function pi(e) {
  return [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · ");
}
function Mi({ port: e, jobId: t, bookTitle: o, anchor: a, onClose: r, onShowAnchor: c, initialMessages: i, onTurnDone: s, onDelete: l }) {
  ei();
  const [d, m] = T(null), [g, x] = T(""), [h, p] = T(""), b = A({ agentId: g, anchor: a });
  b.current = { agentId: g, anchor: a }, L(() => {
    let I = !1;
    return e.listAgents().then(
      (N) => {
        I || (m(N), x(($) => {
          var O;
          return $ || ((O = N.find((H) => H.available !== !1)) == null ? void 0 : O.id) || "";
        }));
      },
      (N) => !I && p(N instanceof Error ? N.message : String(N))
    ), () => {
      I = !0;
    };
  }, [e]);
  const k = he(() => new ea(), []), w = he(
    () => na({
      port: e,
      jobId: t,
      bookTitle: o,
      permissions: k,
      getAgentId: () => b.current.agentId,
      getAnchor: () => b.current.anchor
    }),
    [e, t, o, k]
  );
  L(() => () => w.close(), [w]);
  const [v] = T(() => Yo(i || [])), z = he(() => new ui(), []), S = eo(w.adapter, { initialMessages: v, adapters: { attachments: z } }), R = A(s);
  R.current = s, L(() => {
    let I = !1;
    return S.thread.subscribe(() => {
      var $;
      const N = S.thread.getState();
      if (I && !N.isRunning) {
        const O = Qt(N.messages);
        O.length && (($ = R.current) == null || $.call(R, O, b.current.agentId));
      }
      I = N.isRunning;
    });
  }, [S]);
  const C = () => {
    var I;
    return ((I = d == null ? void 0 : d.find((N) => N.id === b.current.agentId)) == null ? void 0 : I.name) || "";
  }, _ = he(
    () => ({ ToolFallback: ni, Indicator: ci, Welcome: fi, MessageFooter: mi(C) }),
    [d]
    // eslint-disable-line react-hooks/exhaustive-deps
  );
  L(() => {
    const I = (N) => {
      var O, H;
      if (N.key !== "Escape") return;
      const $ = (H = (O = N.target) == null ? void 0 : O.closest) == null ? void 0 : H.call(O, "textarea, input, select");
      $ && `${$.value || ""}`.trim() || (N.preventDefault(), r());
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [r]);
  const j = Math.min(460, (globalThis.innerWidth || 1200) - 32), V = Math.min(620, (globalThis.innerHeight || 800) - 120), q = a.selection || a.sourceText || a.translatedText;
  return /* @__PURE__ */ n(
    Xn,
    {
      className: "reader-ask-window",
      default: { x: Math.max(16, (globalThis.innerWidth || 1200) - j - 24), y: 72, width: j, height: V },
      minWidth: 320,
      minHeight: 280,
      bounds: "window",
      dragHandleClassName: "reader-ask-head",
      cancel: ".reader-ask-head button, .reader-ask-head select, .reader-ask-head .ui-select",
      children: /* @__PURE__ */ u("section", { className: "reader-ask", role: "dialog", "aria-label": "提问", children: [
        /* @__PURE__ */ u("header", { className: "reader-ask-head", children: [
          /* @__PURE__ */ n("span", { className: "reader-ask-title", children: "提问" }),
          /* @__PURE__ */ n(Ce, { className: "reader-ask-where", title: "回到问的那一处", onClick: c, children: pi(a) }),
          /* @__PURE__ */ n(
            Ro,
            {
              size: "sm",
              className: "reader-ask-agent",
              "aria-label": "用哪个 agent",
              value: g,
              onChange: (I) => x(I.target.value),
              disabled: !(d != null && d.length),
              children: (d || []).map((I) => /* @__PURE__ */ u("option", { value: I.id, disabled: I.available === !1, title: I.reason || I.description || "", children: [
                I.name,
                I.available === !1 ? "（用不了）" : ""
              ] }, I.id))
            }
          ),
          l ? /* @__PURE__ */ n(Ce, { className: "reader-ask-close", "aria-label": "删掉这次提问", title: "删掉这次提问（书页上的「?」也去掉）", onClick: l, children: /* @__PURE__ */ n(Io, { size: 14, "aria-hidden": !0 }) }) : null,
          /* @__PURE__ */ n(Ce, { className: "reader-ask-close", "aria-label": "关掉", title: "关掉（Esc）", onClick: r, children: /* @__PURE__ */ n(zo, { size: 15, "aria-hidden": !0 }) })
        ] }),
        q ? /* @__PURE__ */ n("blockquote", { className: "reader-ask-quote", children: q }) : null,
        h ? /* @__PURE__ */ u("p", { className: "reader-ask-error", children: [
          "列不出能用的 agent：",
          h
        ] }) : null,
        /* @__PURE__ */ n(gi, { agents: d }),
        /* @__PURE__ */ n(Un.Provider, { value: k, children: /* @__PURE__ */ u(to, { runtime: S, children: [
          /* @__PURE__ */ n(ii, {}),
          /* @__PURE__ */ n(si, {}),
          /* @__PURE__ */ n("div", { className: "reader-ask-thread", children: /* @__PURE__ */ n(Ar, { components: _, autoFocus: !0 }) })
        ] }) })
      ] })
    }
  );
}
export {
  di as ASK_IMAGE_MAX_BYTES,
  jt as ASK_IMAGE_TYPES,
  li as ASK_SLOW_HINT_MS,
  Mi as default
};
//# sourceMappingURL=ReaderAskWindow-BdF1ZynU.js.map
