var ao = Object.defineProperty;
var ro = (e, t, o) => t in e ? ao(e, t, { enumerable: !0, configurable: !0, writable: !0, value: o }) : e[t] = o;
var ce = (e, t, o) => ro(e, typeof t != "symbol" ? t + "" : t, o);
import { jsx as n, jsxs as u, Fragment as fe } from "react/jsx-runtime";
import { forwardRef as Ce, useState as N, useEffect as M, isValidElement as io, useLayoutEffect as xe, useRef as A, memo as ge, useCallback as J, createContext as Pe, useContext as re, useMemo as ue, useImperativeHandle as so, useId as lo, useSyncExternalStore as co } from "react";
import { Rnd as uo } from "react-rnd";
import { useAuiState as E, useAui as mo, ComposerPrimitive as B, MessagePrimitive as ae, AttachmentPrimitive as Ye, AuiIf as O, ThreadPrimitive as se, useScrollLock as st, useToolCallElapsed as fo, toolApprovalAcceptsText as go, SuggestionPrimitive as Ve, groupPartByType as po, ErrorPrimitive as zt, ActionBarPrimitive as G, BranchPickerPrimitive as we, ActionBarMorePrimitive as _e, SimpleImageAttachmentAdapter as ho, useLocalRuntime as bo, AssistantRuntimeProvider as xo, makeAssistantDataUI as Gt } from "@assistant-ui/react";
import { c as vo, b as ko } from "./ReaderApp-CDxuf1bY.js";
import { XIcon as ze, Loader2Icon as Fe, AlertCircleIcon as Kt, PlusIcon as yo, FileText as No, PauseIcon as Vt, PlayIcon as Le, DownloadIcon as lt, FileIcon as qt, ImageIcon as Xt, FileTextIcon as It, BracesIcon as wo, MusicIcon as To, VideoIcon as Co, ShieldAlertIcon as zo, ImageOffIcon as Io, CopyIcon as De, RefreshCwIcon as ct, CheckIcon as pe, BrainIcon as Ao, ChevronDownIcon as dt, XCircleIcon as Qt, LoaderIcon as Yt, CircleMinusIcon as Ro, ArrowDownIcon as So, PhoneIcon as _o, MicIcon as Zt, AudioLinesIcon as Eo, SquareIcon as At, ArrowUpIcon as $o, TriangleAlertIcon as Mo, ChevronLeftIcon as Po, ChevronRightIcon as Fo, ThumbsUpIcon as Lo, ThumbsDownIcon as Do, MoreHorizontalIcon as jo, PencilIcon as Oo, MinusIcon as Uo, RotateCcwIcon as Bo, X as Jt, Check as Wo, Loader2 as Ho, Clock as Go, Timer as Ko, Gauge as Vo, Coins as qo, PieChart as Xo, HardDriveUpload as Qo, DatabaseZap as Yo, ArrowDown as Zo, ArrowUp as Jo, Cpu as ea, BookOpen as en, Sigma as ta, Languages as tn, Wrench as na, Sparkles as oa, Terminal as aa, Pencil as ra, Eye as ia, Globe as sa, Search as la, MessageCircleQuestion as ca, MapPin as da, PanelRightClose as ua, PanelRight as ma, Minimize2 as fa, Maximize2 as ga, Trash2 as pa, Plug as ha, Copy as ba, ChevronDown as xa } from "lucide-react";
import { clsx as va } from "clsx";
import { twMerge as ka } from "tailwind-merge";
import { Tooltip as ve, Slot as nn, Dialog as me, Avatar as ut, Collapsible as mt } from "radix-ui";
import { cva as Ie } from "class-variance-authority";
import { useShallow as ya } from "zustand/react/shallow";
import { flushSync as Na, createPortal as wa } from "react-dom";
import { memoizeMarkdownComponents as on, MarkdownTextPrimitive as Ta, normalizeMathDelimiters as Ca, useIsMarkdownCodeBlock as za } from "@assistant-ui/react-markdown";
import Ia from "remark-gfm";
import Aa from "remark-math";
import Ra from "rehype-katex";
import { Button as Z, Select as Sa } from "@retainpdf/ui";
import _a from "katex";
function an(e) {
  return { parts: [], usage: {}, startedAt: e, firstTokenAt: null, lastTokenAt: null, chars: 0, chunks: 0 };
}
function rn(e) {
  return e.type === "text" ? e.text : e.type === "resource_link" ? e.title || e.name || e.uri : "";
}
function Ea(e) {
  return (e || []).map((t) => t.type === "content" ? rn(t.content) : t.type === "diff" ? `改了 ${t.path}` : "").filter(Boolean).join(`
`);
}
function $a(e) {
  return (e || []).map((t) => t.line != null ? `${t.path}:${t.line}` : t.path);
}
function Ma(e) {
  return typeof e == "number" && Number.isFinite(e) ? e : void 0;
}
function Ze(e) {
  var f;
  const t = e, o = typeof (t == null ? void 0 : t["_claude/model"]) == "string" ? t["_claude/model"] : "", a = ((f = t == null ? void 0 : t.retainpdf) == null ? void 0 : f.usage) ?? (t == null ? void 0 : t.usage);
  if (!a || typeof a != "object") return o ? { model: o } : {};
  const r = (...b) => {
    for (const h of b) {
      const p = Ma(a[h]);
      if (p !== void 0) return p;
    }
  }, l = {}, i = r("inputTokens", "input_tokens", "promptTokens", "prompt_tokens"), s = r("outputTokens", "output_tokens", "completionTokens", "completion_tokens"), c = r("cachedInputTokens", "cachedReadTokens", "cache_read_tokens", "cache_read_input_tokens", "cached_tokens"), d = r("cacheWriteTokens", "cachedWriteTokens", "cache_write_tokens", "cache_creation_input_tokens"), m = r("reasoningTokens", "reasoning_tokens", "thoughtTokens");
  return i !== void 0 && (l.inputTokens = i), s !== void 0 && (l.outputTokens = s), c !== void 0 && (l.cachedInputTokens = c), m !== void 0 && (l.reasoningTokens = m), d !== void 0 && (l.cacheWriteTokens = d), typeof a.model == "string" && a.model ? l.model = a.model : o && (l.model = o), l;
}
function ft(e, t) {
  return e.map((o) => o.type === "reasoning" && o.timing && o.timing.completedAt === void 0 ? { ...o, timing: { ...o.timing, completedAt: t } } : o);
}
function Pa(e, t, o, a) {
  const r = e[e.length - 1];
  return r && r.type === t ? [...e.slice(0, -1), { ...r, text: r.text + o }] : t === "reasoning" ? [...e, { type: t, text: o, timing: { startedAt: a } }] : [...ft(e, a), { type: t, text: o }];
}
function Fa(e, t, o, a = Date.now()) {
  var r, l, i;
  switch (t.sessionUpdate) {
    case "agent_message_chunk":
    case "agent_thought_chunk": {
      const s = rn(t.content);
      if (!s) return e;
      const c = t.sessionUpdate === "agent_message_chunk" ? "text" : "reasoning";
      return {
        ...e,
        parts: Pa(e.parts, c, s, a),
        chars: e.chars + s.length,
        chunks: (e.chunks || 0) + 1,
        firstTokenAt: e.firstTokenAt ?? o,
        lastTokenAt: o
      };
    }
    case "tool_call":
    case "tool_call_update": {
      const s = e.parts.findIndex((k) => k.type === "tool-call" && k.toolCallId === t.toolCallId), c = s >= 0 ? e.parts[s] : null, d = t.status || (c == null ? void 0 : c.artifact.status) || "pending", m = t.rawInput !== void 0 ? t.rawInput : c == null ? void 0 : c.args, f = m && typeof m == "object" ? m : {}, b = t.content != null ? Ea(t.content) : (c == null ? void 0 : c.artifact.output) || "", h = d === "completed" || d === "failed", p = {
        type: "tool-call",
        timing: { startedAt: ((r = c == null ? void 0 : c.timing) == null ? void 0 : r.startedAt) ?? a, ...h ? { completedAt: ((l = c == null ? void 0 : c.timing) == null ? void 0 : l.completedAt) ?? a } : {} },
        toolCallId: t.toolCallId,
        toolName: t.name || (c == null ? void 0 : c.toolName) || t.kind || "tool",
        args: f,
        argsText: JSON.stringify(f),
        result: t.rawOutput !== void 0 ? t.rawOutput : c == null ? void 0 : c.result,
        isError: d === "failed",
        artifact: {
          title: t.title || (c == null ? void 0 : c.artifact.title) || t.name || "工具",
          kind: t.kind || (c == null ? void 0 : c.artifact.kind) || "other",
          status: d,
          locations: t.locations != null ? $a(t.locations) : (c == null ? void 0 : c.artifact.locations) || [],
          output: b
        }
      }, x = s >= 0 ? e.parts.map((k, w) => w === s ? p : k) : [...ft(e.parts, a), p];
      return { ...e, parts: x };
    }
    case "plan": {
      const s = e.parts.findIndex((d) => d.type === "data" && d.name === "plan"), c = { type: "data", name: "plan", data: { entries: t.entries } };
      return { ...e, parts: s >= 0 ? e.parts.map((d, m) => m === s ? c : d) : [...e.parts, c] };
    }
    case "subagent_update": {
      const s = e.parts.findIndex((f) => f.type === "data" && f.name === "subagent" && f.data.id === t.sessionId), c = s >= 0 ? e.parts[s].data : null, d = ((i = t.state) == null ? void 0 : i.state) || (c == null ? void 0 : c.state) || "running", m = {
        type: "data",
        name: "subagent",
        data: {
          id: t.sessionId,
          title: t.title || (c == null ? void 0 : c.title) || "子 agent",
          description: t.description || (c == null ? void 0 : c.description) || "",
          state: d
        }
      };
      return { ...e, parts: s >= 0 ? e.parts.map((f, b) => b === s ? m : f) : [...e.parts, m] };
    }
    case "usage_update": {
      const s = { ...e.usage, contextUsed: t.used, contextSize: t.size, ...Ze(t._meta) };
      return t.cost && (s.cost = { amount: t.cost.amount, currency: t.cost.currency }), { ...e, usage: s };
    }
    default:
      return e;
  }
}
const Rt = 5;
function sn(e) {
  if (e.firstTokenAt == null || e.lastTokenAt == null || (e.chunks ?? Rt) < Rt) return null;
  const t = (e.lastTokenAt - e.firstTokenAt) / 1e3;
  return t < 0.3 ? null : e.usage.outputTokens ? { value: e.usage.outputTokens / t, unit: "token/s" } : e.chars ? { value: e.chars / t, unit: "字/s" } : null;
}
function Ee(e) {
  return e < 1e3 ? String(Math.round(e)) : e < 1e6 ? `${(e / 1e3).toFixed(e < 1e4 ? 1 : 0)}k` : `${(e / 1e6).toFixed(1)}M`;
}
function La(e, t, o = "") {
  const a = [], { usage: r } = e, l = r.model || "";
  if ((l || o) && a.push({ key: "model", text: l || o, title: l && o ? `${o}（${l}）` : l || o }), r.inputTokens !== void 0 && a.push({ key: "input", text: Ee(r.inputTokens), title: `输入 ${r.inputTokens} token` }), r.outputTokens !== void 0 && a.push({ key: "output", text: Ee(r.outputTokens), title: `输出 ${r.outputTokens} token` }), r.cachedInputTokens && a.push({ key: "cacheRead", text: Ee(r.cachedInputTokens), title: `缓存命中 ${r.cachedInputTokens} token` }), r.cacheWriteTokens && a.push({ key: "cacheWrite", text: Ee(r.cacheWriteTokens), title: `写入缓存 ${r.cacheWriteTokens} token` }), r.contextUsed !== void 0 && r.contextSize) {
    const s = Math.round(r.contextUsed / r.contextSize * 100);
    a.push({ key: "context", text: `${s}%`, title: `上下文用了 ${s}%（${r.contextUsed} / ${r.contextSize} token）` });
  }
  r.cost && a.push({ key: "cost", text: `${r.cost.currency === "USD" ? "$" : ""}${r.cost.amount.toFixed(r.cost.amount < 0.1 ? 4 : 2)}`, title: `花费 ${r.cost.amount} ${r.cost.currency}` });
  const i = sn(e);
  if (i) {
    const s = i.value.toFixed(i.value >= 10 ? 0 : 1);
    a.push({ key: "speed", text: `${s}/s`, title: `出字速度 ${s} ${i.unit}` });
  }
  if (e.firstTokenAt != null) {
    const s = ((e.firstTokenAt - e.startedAt) / 1e3).toFixed(1);
    a.push({ key: "firstToken", text: `${s}s`, title: `首字 ${s} 秒` });
  }
  if (t != null) {
    const s = ((t - e.startedAt) / 1e3).toFixed(1);
    a.push({ key: "elapsed", text: `${s}s`, title: `用时 ${s} 秒` });
  }
  return a;
}
const St = 8e3;
function qe(e, t) {
  return e.filter((o) => o.type === t).map((o) => o.text || "").join("").trim();
}
function Da(e, t) {
  if (!e) return null;
  const o = { ...e.usage };
  return t != null && (o.elapsedMs = Math.round(t - e.startedAt)), e.firstTokenAt != null && (o.firstTokenMs = Math.round(e.firstTokenAt - e.startedAt)), Object.keys(o).length ? o : null;
}
function ja(e) {
  var a;
  let t = 0, o = !1;
  for (const r of e)
    r.type !== "reasoning" || ((a = r.timing) == null ? void 0 : a.startedAt) == null || r.timing.completedAt == null || (t += r.timing.completedAt - r.timing.startedAt, o = !0);
  return o ? Math.round(t) : null;
}
function ln(e) {
  var o;
  const t = [];
  for (const a of e)
    if (a.role === "user") {
      const r = qe(a.content, "text");
      r && t.push({ role: "user", text: r });
    } else if (a.role === "assistant") {
      const r = (o = a.metadata) == null ? void 0 : o.custom, l = qe(a.content, "text"), i = qe(a.content, "reasoning");
      if (!l && !i) continue;
      const s = Da(r == null ? void 0 : r.turn, r == null ? void 0 : r.endedAt), c = ja(a.content);
      t.push({ role: "assistant", text: l, thought: i || null, usage: c != null ? { ...s, thoughtMs: c } : s });
    }
  return t;
}
function Oa(e) {
  return e.map((t) => {
    if (t.role === "user") return { role: "user", content: t.text };
    const o = t.usage || {}, a = typeof o.thoughtMs == "number" ? { timing: { startedAt: 0, completedAt: o.thoughtMs } } : {}, r = { ...an(0), usage: o, firstTokenAt: o.firstTokenMs ?? null };
    return {
      role: "assistant",
      content: [
        ...t.thought ? [{ type: "reasoning", text: t.thought, ...a }] : [],
        { type: "text", text: t.text }
      ],
      status: { type: "complete", reason: "stop" },
      metadata: { custom: { turn: r, endedAt: o.elapsedMs ?? void 0 } }
    };
  });
}
function Ua(e) {
  const t = ln(e).slice(-12);
  if (!t.length) return "";
  let o = t.map((a) => `${a.role === "user" ? "我" : "你"}：${a.text}`).join(`

`);
  return o.length > St && (o = `…${o.slice(-St)}`), `之前我们在这一处聊过（接着聊）：

${o}`;
}
const Ba = 4e3;
function Xe(e, t = Ba) {
  const o = `${e || ""}`.trim();
  return o.length > t ? `${o.slice(0, t)}…` : o;
}
function Wa(e, t, o = "") {
  const a = [], r = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return a.push(`我在读${o ? `《${o}》` : "一本书"}，${r}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && a.push("", "我选中的这段：", Xe(e.selection)), e.sourceText && a.push("", "这一块的原文：", Xe(e.sourceText)), e.translatedText && a.push("", "这一块的译文：", Xe(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && a.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), a.push("", `（RetainPDF 任务 ${t}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), [{ type: "text", text: a.join(`
`) }];
}
class Ha {
  constructor() {
    ce(this, "pending", /* @__PURE__ */ new Map());
    ce(this, "listeners", /* @__PURE__ */ new Set());
    ce(this, "version", 0);
    ce(this, "subscribe", (t) => (this.listeners.add(t), () => this.listeners.delete(t)));
    ce(this, "snapshot", () => this.version);
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
function Qe(e) {
  return e.map((t) => t.type === "tool-call" ? { ...t, args: t.args } : t);
}
function Ga(e) {
  if (!e) return [];
  const t = [...e.content, ...(e.attachments || []).flatMap((a) => a.content || [])], o = [];
  for (const a of t) {
    if (a.type !== "image" || !a.image) continue;
    const r = /^data:([^;,]+);base64,(.+)$/.exec(a.image);
    r && o.push({ type: "image", mimeType: r[1], data: r[2] });
  }
  return o;
}
function Ka(e) {
  const t = e.now ?? (() => performance.now());
  let o = null, a = "", r = null, l = !1, i = 0;
  const s = async () => {
    const d = e.getAgentId();
    return o && a === d || (o == null || o.close(), o = await e.port.openSession(
      { agentId: d, jobId: e.jobId },
      {
        onUpdate: (m) => r == null ? void 0 : r(m),
        onPermission: (m) => e.permissions.add(m)
      }
    ), a = d, l = !1, i = 0), o;
  };
  return {
    adapter: {
      async *run({ messages: d, abortSignal: m }) {
        const f = d.map((z) => z.role).lastIndexOf("user"), b = f >= 0 ? d[f] : void 0;
        o && f !== i && (o.close(), o = null);
        const h = ((b == null ? void 0 : b.content) || []).map((z) => z.type === "text" && z.text || "").join(`
`).trim();
        let p;
        try {
          p = await s();
        } catch (z) {
          o = null;
          const H = z instanceof Error ? z.message : String(z);
          yield {
            content: [{ type: "text", text: `（连不上这个 agent：${H}）` }],
            status: { type: "incomplete", reason: "error", error: H }
          };
          return;
        }
        const x = e.getAnchor(), k = [];
        !l && x && k.push(...Wa(x, e.jobId, e.bookTitle));
        const w = !l && f > 0 ? Ua(d.slice(0, f)) : "";
        w && k.push({ type: "text", text: w }), k.push({ type: "text", text: h || "（看图）" }), k.push(...Ga(b)), l = !0;
        let v = an(t()), T = null, P = !1;
        r = (z) => {
          v = Fa(v, z, t()), P = !0, T == null || T();
        };
        const S = () => {
          e.permissions.cancelAll(), p.cancel();
        };
        m.addEventListener("abort", S);
        let C = !1, R = null, j = "end_turn";
        p.prompt(k).then(
          (z) => {
            j = z.stopReason;
            const H = { ...Ze(z.meta), ...Ze(z.usage ? { usage: z.usage } : null) };
            Object.keys(H).length && (v = { ...v, usage: { ...v.usage, ...H } }, P = !0), C = !0, T == null || T();
          },
          (z) => {
            R = z, C = !0, T == null || T();
          }
        );
        try {
          for (; !C || P; )
            P || await new Promise((z) => T = z), T = null, P && (P = !1, yield { content: Qe(v.parts), metadata: { custom: { turn: v } } });
        } finally {
          m.removeEventListener("abort", S), r = null;
        }
        const Y = t();
        v = { ...v, parts: ft(v.parts, Date.now()) }, R || (i = f + 2);
        const te = sn(v), V = {
          streamStartTime: v.startedAt,
          firstTokenTime: v.firstTokenAt ?? void 0,
          totalStreamTime: Y - v.startedAt,
          tokenCount: v.usage.outputTokens,
          tokensPerSecond: (te == null ? void 0 : te.unit) === "token/s" ? te.value : void 0,
          totalChunks: 0,
          toolCallCount: v.parts.filter((z) => z.type === "tool-call").length
        };
        if (R) {
          const z = R instanceof Error ? R.message : String(R);
          /close|closed|1011|disconnect|断/i.test(z) && (o == null || o.close(), o = null), yield {
            content: Qe([...v.parts, { type: "text", text: `

（出错了：${z}）` }]),
            status: { type: "incomplete", reason: "error", error: z },
            metadata: { custom: { turn: v, endedAt: Y }, timing: V }
          };
          return;
        }
        yield {
          content: Qe(v.parts),
          status: j === "cancelled" ? { type: "incomplete", reason: "cancelled" } : j === "max_tokens" ? { type: "incomplete", reason: "length" } : { type: "complete", reason: "stop" },
          metadata: { custom: { turn: v, endedAt: Y }, timing: V }
        };
      }
    },
    close() {
      e.permissions.cancelAll(), o == null || o.close(), o = null;
    }
  };
}
function g(...e) {
  return ka(va(e));
}
function cn({
  delayDuration: e = 0,
  ...t
}) {
  return /* @__PURE__ */ n(
    ve.Provider,
    {
      "data-slot": "tooltip-provider",
      delayDuration: e,
      ...t
    }
  );
}
function dn({
  ...e
}) {
  return /* @__PURE__ */ n(ve.Root, { "data-slot": "tooltip", ...e });
}
function un({
  ...e
}) {
  return /* @__PURE__ */ n(ve.Trigger, { "data-slot": "tooltip-trigger", ...e });
}
function mn({
  className: e,
  sideOffset: t = 0,
  children: o,
  ...a
}) {
  return /* @__PURE__ */ n(ve.Portal, { children: /* @__PURE__ */ u(
    ve.Content,
    {
      "data-slot": "tooltip-content",
      sideOffset: t,
      className: g(
        "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        e
      ),
      ...a,
      children: [
        o,
        /* @__PURE__ */ n(ve.Arrow, { className: "z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" })
      ]
    }
  ) });
}
const Va = Ie(
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
function F({
  className: e,
  variant: t = "default",
  size: o = "default",
  asChild: a = !1,
  ...r
}) {
  const l = a ? nn.Root : "button";
  return /* @__PURE__ */ n(
    l,
    {
      "data-slot": "button",
      "data-variant": t,
      "data-size": o,
      className: g(Va({ variant: t, size: o, className: e })),
      ...r
    }
  );
}
function qa({
  ...e
}) {
  return /* @__PURE__ */ n(me.Root, { "data-slot": "dialog", ...e });
}
function Xa({
  ...e
}) {
  return /* @__PURE__ */ n(me.Trigger, { "data-slot": "dialog-trigger", ...e });
}
function Qa({
  ...e
}) {
  return /* @__PURE__ */ n(me.Portal, { "data-slot": "dialog-portal", ...e });
}
function Ya({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ n(
    me.Overlay,
    {
      "data-slot": "dialog-overlay",
      className: g(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        e
      ),
      ...t
    }
  );
}
function Za({
  className: e,
  children: t,
  showCloseButton: o = !0,
  ...a
}) {
  return /* @__PURE__ */ u(Qa, { "data-slot": "dialog-portal", children: [
    /* @__PURE__ */ n(Ya, {}),
    /* @__PURE__ */ u(
      me.Content,
      {
        "data-slot": "dialog-content",
        className: g(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          e
        ),
        ...a,
        children: [
          t,
          o && /* @__PURE__ */ u(
            me.Close,
            {
              "data-slot": "dialog-close",
              className: "absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
              children: [
                /* @__PURE__ */ n(ze, {}),
                /* @__PURE__ */ n("span", { className: "sr-only", children: "关掉" })
              ]
            }
          )
        ]
      }
    )
  ] });
}
function Ja({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ n(
    me.Title,
    {
      "data-slot": "dialog-title",
      className: g("text-lg leading-none font-semibold", e),
      ...t
    }
  );
}
function er({
  className: e,
  size: t = "default",
  ...o
}) {
  return /* @__PURE__ */ n(
    ut.Root,
    {
      "data-slot": "avatar",
      "data-size": t,
      className: g(
        "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
        e
      ),
      ...o
    }
  );
}
function tr({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ n(
    ut.Image,
    {
      "data-slot": "avatar-image",
      className: g("aspect-square size-full", e),
      ...t
    }
  );
}
function nr({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ n(
    ut.Fallback,
    {
      "data-slot": "avatar-fallback",
      className: g(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        e
      ),
      ...t
    }
  );
}
const L = Ce(({ children: e, tooltip: t, side: o = "bottom", className: a, ...r }, l) => /* @__PURE__ */ n(cn, { delayDuration: 0, children: /* @__PURE__ */ u(dn, { children: [
  /* @__PURE__ */ n(un, { asChild: !0, children: /* @__PURE__ */ u(
    F,
    {
      variant: "ghost",
      size: "icon",
      ...r,
      className: g(
        "aui-button-icon size-6 p-1 active:scale-90",
        a
      ),
      ref: l,
      children: [
        /* @__PURE__ */ n(nn.Slottable, { children: e }),
        /* @__PURE__ */ n("span", { className: "aui-sr-only sr-only", children: t })
      ]
    }
  ) }),
  /* @__PURE__ */ n(mn, { side: o, children: t })
] }) }));
L.displayName = "TooltipIconButton";
const or = (e) => {
  const [t, o] = N(
    void 0
  );
  return M(() => {
    if (!e) {
      o(void 0);
      return;
    }
    const a = URL.createObjectURL(e);
    return o({ file: e, url: a }), () => {
      URL.revokeObjectURL(a);
    };
  }, [e]), t !== void 0 && t.file === e ? t.url : void 0;
}, ar = () => {
  const { file: e, src: t } = E(
    ya((o) => {
      var r, l;
      if (o.attachment.type !== "image") return {};
      if (o.attachment.file) return { file: o.attachment.file };
      const a = (l = (r = o.attachment.content) == null ? void 0 : r.filter((i) => i.type === "image")[0]) == null ? void 0 : l.image;
      return a ? { src: a } : {};
    })
  );
  return or(e) ?? t;
};
function rr() {
  const t = mo().attachment.source !== "message", o = ar(), a = E((m) => m.attachment.type === "image"), r = E((m) => m.attachment.name), l = E((m) => {
    const f = m.attachment.type;
    switch (f) {
      case "image":
        return "Image";
      case "document":
        return "Document";
      case "file":
        return "File";
      default:
        return f;
    }
  }), i = E(
    (m) => {
      var f;
      return m.attachment.status.type === "incomplete" && m.attachment.status.reason === "error" ? "error" : m.attachment.status.type === "running" || ((f = m.optional.message) == null ? void 0 : f.submission) !== void 0 && m.attachment.status.type !== "complete" ? "uploading" : void 0;
    }
  ), s = i === "uploading", c = i === "error", d = E(
    (m) => m.attachment.status.type === "incomplete" && m.attachment.status.reason === "error" ? m.attachment.status.message ?? "Upload failed" : void 0
  );
  return {
    isComposer: t,
    src: o,
    isImage: a,
    name: r,
    typeLabel: l,
    isUploading: s,
    isError: c,
    errorMessage: d
  };
}
const ir = ({ src: e, name: t }) => {
  const [o, a] = N(!1);
  return (
    // A picture wrapper marks a deliberate native img for the Next.js lint, because
    // next/image needs per-host config for runtime URLs and only exists in Next.js.
    /* @__PURE__ */ n("picture", { className: "contents", children: /* @__PURE__ */ n(
      "img",
      {
        src: e,
        alt: `Preview of ${t}`,
        className: g(
          "block h-auto max-h-[80vh] w-auto max-w-full rounded-sm object-contain transition-opacity duration-300 motion-reduce:transition-none",
          o ? "aui-attachment-preview-image-loaded opacity-100" : "aui-attachment-preview-image-loading opacity-0"
        ),
        onLoad: () => a(!0)
      }
    ) })
  );
}, sr = ({
  children: e,
  src: t,
  name: o
}) => t ? /* @__PURE__ */ u(qa, { children: [
  /* @__PURE__ */ n(
    Xa,
    {
      className: "aui-attachment-preview-trigger cursor-zoom-in",
      asChild: !0,
      children: io(e) ? e : /* @__PURE__ */ n("button", { type: "button", children: e })
    }
  ),
  /* @__PURE__ */ u(Za, { className: "aui-attachment-preview-dialog-content [&>button]:bg-foreground/60 [&>button]:hover:bg-foreground/80 [&_svg]:text-background p-2 sm:max-w-3xl [&>button]:rounded-full [&>button]:p-1 [&>button]:opacity-100 [&>button]:ring-0!", children: [
    /* @__PURE__ */ u(Ja, { className: "aui-sr-only sr-only", children: [
      "Preview ",
      o
    ] }),
    /* @__PURE__ */ n("div", { className: "aui-attachment-preview bg-background relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden rounded-sm", children: /* @__PURE__ */ n(ir, { src: t, name: o }) })
  ] })
] }) : e, lr = ({ src: e }) => /* @__PURE__ */ u(er, { className: "aui-attachment-tile-avatar h-full w-full rounded-none", children: [
  /* @__PURE__ */ n(
    tr,
    {
      src: e,
      alt: "",
      className: "aui-attachment-tile-image rounded-none object-cover"
    }
  ),
  /* @__PURE__ */ n(nr, { children: /* @__PURE__ */ n(No, { className: "aui-attachment-tile-fallback-icon text-muted-foreground/80 size-6 stroke-[1.5]" }) })
] }), fn = () => {
  const {
    isComposer: e,
    src: t,
    isImage: o,
    name: a,
    typeLabel: r,
    isUploading: l,
    isError: i,
    errorMessage: s
  } = rr();
  return /* @__PURE__ */ n(cn, { children: /* @__PURE__ */ u(dn, { children: [
    /* @__PURE__ */ u(
      Ye.Root,
      {
        className: g(
          "aui-attachment-root relative",
          e && "animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none",
          o && !e && "aui-attachment-root-message only:*:first:size-24"
        ),
        children: [
          /* @__PURE__ */ n(sr, { src: t, name: a, children: /* @__PURE__ */ n(un, { asChild: !0, children: /* @__PURE__ */ u(
            "div",
            {
              className: g(
                "aui-attachment-tile bg-muted hover:after:bg-foreground/10 focus-visible:ring-ring/50 relative size-14 overflow-hidden rounded-[calc(var(--composer-radius,1rem)-var(--composer-padding,8px))] transition-transform outline-none after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-black/10 after:transition-colors after:ring-inset focus-visible:ring-1 motion-reduce:transition-none dark:after:ring-white/10",
                t ? "cursor-zoom-in active:scale-[0.96]" : "cursor-default",
                i && "after:ring-destructive/60 dark:after:ring-destructive/60"
              ),
              role: t ? "button" : "group",
              tabIndex: 0,
              onKeyDown: t ? (c) => {
                c.key === "Enter" ? (c.preventDefault(), c.currentTarget.click()) : c.key === " " && c.preventDefault();
              } : void 0,
              onKeyUp: t ? (c) => {
                c.key === " " && c.currentTarget.click();
              } : void 0,
              "aria-label": `${t ? `Preview ${a}` : `${r} attachment ${a}`}${i ? ", upload failed" : l ? ", uploading" : ""}`,
              children: [
                /* @__PURE__ */ n(lr, { src: t }),
                l && /* @__PURE__ */ n(
                  "div",
                  {
                    "aria-hidden": "true",
                    className: "aui-attachment-tile-uploading bg-background/60 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none",
                    children: /* @__PURE__ */ n(Fe, { className: "text-muted-foreground size-4 animate-spin" })
                  }
                ),
                i && /* @__PURE__ */ n(
                  "div",
                  {
                    "aria-hidden": "true",
                    className: "aui-attachment-tile-error bg-background/70 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none",
                    children: /* @__PURE__ */ n(Kt, { className: "text-destructive size-4" })
                  }
                )
              ]
            }
          ) }) }),
          e && /* @__PURE__ */ n(cr, { name: a })
        ]
      }
    ),
    /* @__PURE__ */ u(mn, { side: "top", children: [
      /* @__PURE__ */ n(Ye.Name, {}),
      s && /* @__PURE__ */ n("p", { className: "aui-attachment-error-message", children: s })
    ] })
  ] }) });
}, cr = ({ name: e }) => /* @__PURE__ */ n(Ye.Remove, { asChild: !0, children: /* @__PURE__ */ n(
  L,
  {
    tooltip: `去掉 ${e}`,
    className: "aui-attachment-tile-remove absolute end-1 top-1 size-5 rounded-full bg-black/50! text-white after:absolute after:-inset-1.5 hover:bg-black/70! hover:text-white! active:scale-[0.96] motion-reduce:transition-none",
    side: "top",
    children: /* @__PURE__ */ n(ze, { className: "aui-attachment-remove-icon size-3 stroke-[2.5]" })
  }
) }), dr = () => /* @__PURE__ */ n("div", { className: "aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2 empty:hidden", children: /* @__PURE__ */ n(ae.Attachments, { children: () => /* @__PURE__ */ n(fn, {}) }) }), ur = () => /* @__PURE__ */ n("div", { className: "aui-composer-attachments flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden", children: /* @__PURE__ */ n(B.Attachments, { children: () => /* @__PURE__ */ n(fn, {}) }) }), _t = () => /* @__PURE__ */ n(B.AddAttachment, { asChild: !0, children: /* @__PURE__ */ n(
  L,
  {
    tooltip: "加图片",
    side: "bottom",
    variant: "ghost",
    size: "icon",
    className: "aui-composer-add-attachment text-muted-foreground hover:text-foreground hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30 size-7 rounded-full active:scale-[0.96] motion-reduce:transition-none",
    "aria-label": "加图片",
    children: /* @__PURE__ */ n(yo, { className: "aui-attachment-add-icon size-4" })
  }
) }), mr = typeof globalThis.window < "u", fr = mr ? xe : M, gn = "bg-background border border-border/60 dark:bg-popover", gr = "bg-foreground/[0.04] forced-colors:border dark:bg-foreground/[0.06]", pr = "flex items-center justify-center rounded-full text-muted-foreground outline-hidden transition-[background-color,color,scale] duration-150 hover:bg-foreground/[0.06] hover:text-foreground/90 active:scale-[0.96] focus-visible:ring-1 focus-visible:ring-foreground/20 motion-reduce:transition-none dark:hover:bg-foreground/[0.09]", pn = "bg-foreground text-background transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-90 active:scale-[0.96] motion-reduce:transition-none forced-colors:border", je = "font-mono text-[11px] tracking-tight", hr = /^(?:[/?#]|\.{1,2}\/)/, br = /* @__PURE__ */ new Set(["http:", "https:", "mailto:"]), hn = (e) => {
  try {
    return new URL(e);
  } catch {
    return;
  }
};
function bn(e) {
  if (typeof e != "string") return;
  const t = e.trim();
  if (t === "") return;
  const o = hn(t);
  return o ? br.has(o.protocol) ? t : void 0 : hr.test(t) ? t : void 0;
}
function xr(e) {
  var a;
  const t = bn(e);
  return (t === void 0 ? "" : ((a = hn(t)) == null ? void 0 : a.hostname) ?? "").replace(/^www\./, "") || void 0;
}
const vr = /^(?:data:image\/|data:audio\/|data:video\/|blob:)/i;
function gt(e, t) {
  if (typeof e != "string") return !1;
  const o = e.trim();
  if (o === "") return !1;
  if (vr.test(o)) return !0;
  if (/^[a-z][a-z\d+.-]*:/i.test(o)) {
    let a;
    try {
      a = new URL(o);
    } catch {
      return !1;
    }
    return Et(a, t);
  }
  return ["http:", "https:"].every((a) => {
    const r = `${a}//relative.invalid`;
    try {
      const l = new URL(o, `${r}/`);
      return l.origin === r || Et(l, t);
    } catch {
      return !1;
    }
  });
}
function Et(e, t) {
  return e.protocol !== "http:" && e.protocol !== "https:" ? !1 : (t ?? []).some((o) => {
    if (o === "*") return !0;
    try {
      return new URL(o).origin === e.origin;
    } catch {
      return !1;
    }
  });
}
function $e(e) {
  const t = Math.max(0, Math.floor(e)), o = Math.floor(t / 60), a = t % 60;
  return `${o}:${a.toString().padStart(2, "0")}`;
}
function xn(e, t, o) {
  const a = gt(t, o), [r, l] = N(void 0);
  r !== void 0 && r !== t && l(void 0);
  const i = a || r === t, s = A(i);
  return M(() => {
    const c = e.current;
    c && !i && (s.current || c.hasAttribute("src")) && (c.removeAttribute("src"), c.load()), s.current = i;
  }, [e, t, i]), {
    preload: a,
    armed: i,
    arm: () => {
      const c = e.current;
      !c || i || (c.src = t, l(t));
    }
  };
}
function vn(e, t, o) {
  const [a, r] = N({
    src: t
  });
  M(() => {
    const i = e.current;
    !i || i.readyState < HTMLMediaElement.HAVE_METADATA || Number.isFinite(i.duration) && i.duration >= 0 && r({ src: t, duration: i.duration });
  }, [e, t]);
  const l = o !== void 0 && Number.isFinite(o) ? Math.max(0, o / 1e3) : void 0;
  return {
    duration: a.src === t ? a.duration ?? l : l,
    setDurationFromMetadata: (i) => {
      Number.isFinite(i) && i >= 0 && r({ src: t, duration: i });
    }
  };
}
function kr({
  src: e,
  title: t,
  artwork: o,
  durationMs: a,
  mediaOrigins: r,
  className: l,
  ...i
}) {
  const s = A(null), c = xn(s, e, r), [d, m] = N({
    src: e,
    currentTime: 0,
    playing: !1,
    hasError: !1
  }), { duration: f, setDurationFromMetadata: b } = vn(
    s,
    e,
    a
  ), h = d.src === e ? d : { currentTime: 0, playing: !1, hasError: !1 }, { currentTime: p, playing: x, hasError: k } = h, w = (C) => m((R) => ({
    ...R.src === e ? R : { src: e, currentTime: 0, playing: !1, hasError: !1 },
    ...C
  })), v = t ?? "Audio", T = t ? ` ${t}` : " audio", P = f === void 0 ? "--:--" : $e(f);
  M(() => {
    var C;
    (C = s.current) != null && C.error && m({ src: e, currentTime: 0, playing: !1, hasError: !0 });
  }, [e]);
  const S = () => {
    const C = s.current;
    if (!(!C || k)) {
      if (x) {
        C.pause(), w({ playing: !1 });
        return;
      }
      c.arm(), C.play().then(
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
      className: g(
        gn,
        "flex w-full max-w-md items-center gap-3 rounded-2xl p-3",
        l
      ),
      ...i,
      children: [
        gt(o, r) ? (
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
            "aria-label": `${x ? "Pause" : "Play"}${T}`,
            disabled: k,
            onClick: S,
            className: g(
              pn,
              "flex size-9 shrink-0 items-center justify-center rounded-full disabled:cursor-default disabled:opacity-40"
            ),
            children: x ? /* @__PURE__ */ n(Vt, { "aria-hidden": !0, className: "size-4" }) : /* @__PURE__ */ n(Le, { "aria-hidden": !0, className: "ml-0.5 size-4" })
          }
        ),
        /* @__PURE__ */ u("div", { className: "flex min-w-0 grow basis-16 flex-col gap-1.5", children: [
          /* @__PURE__ */ n("span", { className: "truncate text-[13.5px] font-medium", children: v }),
          /* @__PURE__ */ n(
            "input",
            {
              type: "range",
              min: 0,
              max: f ?? 0,
              step: 0.1,
              value: Math.min(p, f ?? 0),
              "aria-label": "拖动进度",
              "aria-valuetext": `${$e(p)} of ${P}`,
              disabled: k,
              onChange: (C) => {
                const R = Number(C.currentTarget.value);
                if (!Number.isFinite(R)) return;
                const j = Math.min(R, f ?? R);
                s.current && (s.current.currentTime = j), w({ currentTime: j });
              },
              className: "accent-foreground w-full"
            }
          )
        ] }),
        /* @__PURE__ */ u("span", { className: g(je, "text-muted-foreground tabular-nums"), children: [
          $e(p),
          " / ",
          P
        ] }),
        /* @__PURE__ */ n(
          "audio",
          {
            ref: s,
            src: c.preload ? e : void 0,
            preload: c.preload ? "metadata" : "none",
            className: "hidden",
            onLoadedMetadata: (C) => {
              b(C.currentTarget.duration);
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
function yr({
  src: e,
  poster: t,
  title: o,
  ratio: a = "16:9",
  durationMs: r,
  mediaOrigins: l,
  className: i,
  ...s
}) {
  const c = A(null), d = xn(c, e, l), { duration: m, setDurationFromMetadata: f } = vn(
    c,
    e,
    r
  ), b = a === "1:1" ? "aspect-square" : a === "4:3" ? "aspect-[4/3]" : a === "16:9" ? "aspect-video" : a === "9:16" ? "aspect-[9/16]" : void 0;
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "video-player",
      className: g("flex w-full max-w-xl flex-col gap-2", i),
      ...s,
      children: [
        /* @__PURE__ */ u(
          "div",
          {
            className: g(
              gr,
              "relative overflow-hidden rounded-xl",
              b
            ),
            children: [
              /* @__PURE__ */ n(
                "video",
                {
                  ref: c,
                  src: d.preload ? e : void 0,
                  poster: gt(t, l) ? t : void 0,
                  controls: d.armed,
                  playsInline: !0,
                  preload: d.preload ? "metadata" : "none",
                  "aria-label": o ?? "Video",
                  className: g(
                    "block max-w-full",
                    a !== "auto" && "h-full w-full object-contain"
                  ),
                  onLoadedMetadata: (h) => {
                    f(h.currentTarget.duration);
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
                    Na(() => d.arm()), (h = c.current) == null || h.focus(), (p = c.current) == null || p.play().catch(() => {
                    });
                  },
                  className: "absolute inset-0 flex items-center justify-center",
                  children: /* @__PURE__ */ n(
                    "span",
                    {
                      className: g(
                        pn,
                        "flex size-11 items-center justify-center rounded-full"
                      ),
                      children: /* @__PURE__ */ n(Le, { "aria-hidden": !0, className: "ml-0.5 size-5" })
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
              className: g(
                je,
                "text-muted-foreground shrink-0 tabular-nums"
              ),
              children: $e(m)
            }
          ) : null
        ] })
      ]
    }
  );
}
const Nr = Ie(
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
function wr(e) {
  const t = e.toLowerCase();
  return t.startsWith("image/") ? Xt : t === "application/pdf" ? It : t === "application/json" ? wo : t.startsWith("text/") ? It : t.startsWith("audio/") ? To : t.startsWith("video/") ? Co : qt;
}
function pt(e, t) {
  return t === "url" && /^data:/i.test(e) ? "data-uri" : t === "url" || t === "id" ? t : /^data:/i.test(e) ? "data-uri" : /^(https?:\/\/|blob:)/i.test(e) ? "url" : "base64";
}
function Tr(e) {
  return /^[a-z][a-z\d+.-]*:/i.test(e) && !/^(data:|https?:\/\/|blob:)/i.test(e);
}
function Oe(e, t, o) {
  if (Tr(e)) return null;
  const a = pt(e, o);
  return a === "id" ? null : a === "data-uri" ? /^data:[^,]*,/i.test(e) ? e : null : a === "url" ? /^(https?:\/\/|blob:)/i.test(e) ? e : null : `data:${t};base64,${e}`;
}
function kn(e) {
  const t = e.endsWith("==") ? 2 : e.endsWith("=") ? 1 : 0, o = e.search(/[^A-Za-z\d+/]/);
  return o !== -1 && o !== e.length - t || e.length % 4 === 1 || t > 0 && e.length % 4 !== 0 ? 0 : Math.floor(e.length * 3 / 4) - t;
}
function Cr(e) {
  const t = /[\t\n\f\r ]/.test(e) ? e.replace(/[\t\n\f\r ]/g, "") : e;
  return kn(t);
}
function zr(e) {
  const t = e.indexOf("#"), o = t < 0 ? e.length : t, a = e.indexOf(",");
  if (a < 0 || a >= o)
    return 0;
  let r = e.slice(a + 1, o);
  return /;base64$/i.test(e.slice(0, a)) ? (/[%\t\n\f\r ]/.test(r) && (r = r.replace(
    /%([\da-f]{2})/gi,
    (l, i) => String.fromCharCode(Number.parseInt(i, 16))
  ).replace(/[\t\n\f\r ]/g, "")), kn(r)) : new TextEncoder().encode(r.replace(/%[\da-f]{2}/gi, "_")).byteLength;
}
function Ir(e) {
  var o;
  const t = (o = /^[^/;]+\/(?:x-)?(?:[^;+]*\.)?([^;+.\s]+)/.exec(
    e.toLowerCase()
  )) == null ? void 0 : o[1];
  return !t || t === "octet-stream" ? "文件" : t === "plain" ? "文本文件" : `${t.toUpperCase()} file`;
}
function Ar(e) {
  return e < 1024 ? `${e} B` : e < 1024 * 1024 ? `${(e / 1024).toFixed(1)} KB` : `${(e / (1024 * 1024)).toFixed(1)} MB`;
}
function yn({
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
      className: g(Nr({ variant: t, size: o, className: e })),
      ...r,
      children: a
    }
  );
}
function Nn({
  mimeType: e,
  className: t,
  children: o,
  ...a
}) {
  const r = e ? wr(e) : qt;
  return /* @__PURE__ */ n(
    "span",
    {
      "data-slot": "file-icon",
      className: g("text-muted-foreground shrink-0", t),
      ...a,
      children: o ?? /* @__PURE__ */ n(r, { className: "size-5" })
    }
  );
}
function wn({
  className: e,
  children: t,
  ...o
}) {
  return /* @__PURE__ */ n(
    "span",
    {
      "data-slot": "file-name",
      className: g("min-w-0 flex-1 truncate font-medium", e),
      ...o,
      children: t || "没名字的文件"
    }
  );
}
function Je({ bytes: e, className: t, ...o }) {
  return /* @__PURE__ */ n(
    "span",
    {
      "data-slot": "file-size",
      className: g("text-muted-foreground shrink-0", t),
      ...o,
      children: Ar(e)
    }
  );
}
function et({
  data: e,
  mimeType: t,
  filename: o,
  sourceType: a,
  className: r,
  children: l,
  ...i
}) {
  if (typeof e != "string") return null;
  const s = pt(e, a), c = Oe(e, t, a);
  return c ? /* @__PURE__ */ n(
    "a",
    {
      "data-slot": "file-download",
      href: c,
      download: o || "download",
      ...s === "url" && { target: "_blank", rel: "noopener noreferrer" },
      className: g(
        "text-muted-foreground hover:bg-accent hover:text-accent-foreground shrink-0 rounded-md p-1 transition-colors",
        r
      ),
      "aria-label": l ? void 0 : `Download ${o || "file"}`,
      ...i,
      children: l || /* @__PURE__ */ n(lt, { className: "size-4" })
    }
  ) : null;
}
function Tn({
  data: e,
  mimeType: t,
  filename: o,
  sourceType: a,
  className: r,
  ...l
}) {
  const i = Oe(e, t, a), s = t.toLowerCase();
  return !i || !s.startsWith("audio/") && !s.startsWith("video/") ? null : /* @__PURE__ */ n("div", { "data-slot": "file-player", className: g("w-full", r), ...l, children: s.startsWith("audio/") ? /* @__PURE__ */ n(kr, { src: i, title: o }) : /* @__PURE__ */ n(yr, { src: i, title: o }) });
}
const Rr = (e) => {
  const t = typeof e.data == "string" ? e.data : void 0, o = typeof e.mimeType == "string" ? e.mimeType : "application/octet-stream", a = typeof e.filename == "string" ? e.filename : void 0, r = e.sourceType === "url" || e.sourceType === "id" ? e.sourceType : void 0, l = t === void 0 ? void 0 : pt(t, r), i = t === void 0 ? void 0 : l === "data-uri" ? zr(t) : l === "base64" ? Cr(t) : void 0, s = t === void 0 ? null : Oe(t, o, r), c = o.toLowerCase().startsWith("audio/") || o.toLowerCase().startsWith("video/");
  return t !== void 0 && s && c ? /* @__PURE__ */ u("div", { className: "flex w-full max-w-xl flex-col gap-2", children: [
    /* @__PURE__ */ n(
      Tn,
      {
        data: t,
        mimeType: o,
        ...a !== void 0 && { filename: a },
        ...r !== void 0 && { sourceType: r }
      }
    ),
    /* @__PURE__ */ u("div", { className: "flex min-w-0 items-center justify-end gap-2 px-1", children: [
      i !== void 0 && /* @__PURE__ */ n(
        Je,
        {
          bytes: i,
          className: "text-muted-foreground text-[11px]"
        }
      ),
      /* @__PURE__ */ n(
        et,
        {
          data: t,
          mimeType: o,
          ...a !== void 0 && { filename: a },
          ...r !== void 0 && { sourceType: r }
        }
      )
    ] })
  ] }) : /* @__PURE__ */ u(yn, { children: [
    /* @__PURE__ */ n(Nn, { mimeType: o }),
    /* @__PURE__ */ u("div", { className: "flex min-w-0 flex-1 flex-col gap-0.5", children: [
      /* @__PURE__ */ n(wn, { children: a || Ir(o) }),
      i !== void 0 && /* @__PURE__ */ n(Je, { bytes: i, className: "text-xs" })
    ] }),
    t !== void 0 && /* @__PURE__ */ n(
      et,
      {
        data: t,
        mimeType: o,
        ...a !== void 0 && { filename: a },
        ...r !== void 0 && { sourceType: r }
      }
    )
  ] });
}, le = ge(Rr);
le.displayName = "File";
le.Root = yn;
le.Icon = Nn;
le.Name = wn;
le.Size = Je;
le.Download = et;
le.Player = Tn;
const Sr = () => {
  const e = E((s) => s.thread.suggestions), t = A(null), o = A(null), [a, r] = N({ left: !1, right: !1 }), l = J(() => {
    const s = t.current;
    if (!s) return;
    const c = s.scrollWidth - s.clientWidth, d = Math.abs(s.scrollLeft), m = o.current ?? (o.current = getComputedStyle(s).direction === "rtl"), [f, b] = m ? [c - d, d] : [d, c - d];
    r((h) => {
      const p = { left: f > 1, right: b > 1 };
      return h.left === p.left && h.right === p.right ? h : p;
    });
  }, []);
  M(() => {
    l();
    const s = t.current;
    if (!(s != null && s.firstElementChild)) return;
    const c = new ResizeObserver(l);
    return c.observe(s), c.observe(s.firstElementChild), () => c.disconnect();
  }, [l]);
  const i = `linear-gradient(to right, ${a.left ? "transparent, black 2rem" : "black"}, ${a.right ? "black calc(100% - 2rem), transparent" : "black"})`;
  return /* @__PURE__ */ n(
    "div",
    {
      ref: t,
      onScroll: l,
      className: "aui-thread-followup-suggestions -my-1 w-full [scrollbar-width:none] overflow-x-auto py-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
      style: { maskImage: i, WebkitMaskImage: i },
      children: /* @__PURE__ */ n("div", { className: "mx-auto flex min-h-8 w-max items-center gap-2 px-0.5", children: e.map((s, c) => /* @__PURE__ */ u(
        se.Suggestion,
        {
          className: "aui-thread-followup-suggestion border-foreground/10 hover:bg-foreground/[0.03] hover:border-foreground/25 rounded-md border px-2.5 py-1 text-sm whitespace-nowrap transition-colors ease-in motion-reduce:transition-none",
          prompt: s.prompt,
          send: !0,
          children: [
            s.title ?? s.prompt,
            s.label && /* @__PURE__ */ n("span", { className: "aui-thread-followup-suggestion-label text-muted-foreground ms-1", children: s.label })
          ]
        },
        c
      )) })
    }
  );
}, _r = () => /* @__PURE__ */ n(
  O,
  {
    condition: (e) => !e.thread.isEmpty && !e.thread.isRunning && e.thread.suggestions.length > 0,
    children: /* @__PURE__ */ n(Sr, {})
  }
), Er = (e) => {
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
}, Cn = (e) => {
  var s, c;
  const t = e.indexOf(","), o = t >= 0 ? e.slice(0, t) : e, a = t >= 0 ? e.slice(t + 1) : "", r = ((c = (s = o.match(/data:([^;]+)/i)) == null ? void 0 : s[1]) == null ? void 0 : c.toLowerCase()) ?? "application/octet-stream";
  if (!/;base64/i.test(o)) {
    const d = [];
    let m = 0;
    for (const f of a.matchAll(/(?:%[\da-f]{2})+/gi)) {
      f.index > m && d.push(a.slice(m, f.index));
      const b = f[0], h = new Uint8Array(b.length / 3);
      for (let p = 0; p < h.length; p++)
        h[p] = Number.parseInt(
          b.slice(p * 3 + 1, p * 3 + 3),
          16
        );
      d.push(h), m = f.index + b.length;
    }
    return d.push(a.slice(m)), new Blob(d, { type: r });
  }
  let l;
  try {
    const d = a.replace(
      /%([\da-f]{2})/gi,
      (m, f) => String.fromCharCode(Number.parseInt(f, 16))
    );
    l = atob(d);
  } catch {
    return null;
  }
  const i = new Uint8Array(l.length);
  for (let d = 0; d < l.length; d++) i[d] = l.charCodeAt(d);
  return new Blob([i], { type: r });
}, zn = (e) => {
  var t, o;
  return (o = (t = e.match(/^data:([^;,]+)/i)) == null ? void 0 : t[1]) == null ? void 0 : o.toLowerCase();
}, $r = (e) => {
  const t = zn(e);
  if (t) return `image.${Er(t)}`;
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
}, Mr = (e) => {
  try {
    const t = new URL(e, document.baseURI);
    return t.protocol === "http:" || t.protocol === "https:" || t.protocol === "blob:" ? e : null;
  } catch {
    return null;
  }
}, Pr = (e) => {
  if (typeof document > "u") return;
  const t = e.filename ?? $r(e.image), o = /^data:/i.test(e.image), a = o ? Cn(e.image) : null;
  if (o && !a) return;
  const r = a ? URL.createObjectURL(a) : null, l = r ?? Mr(e.image);
  if (!l) return;
  const i = document.createElement("a");
  i.href = l, i.download = t, i.rel = "noopener", document.body.appendChild(i), i.click(), document.body.removeChild(i), r && setTimeout(() => URL.revokeObjectURL(r), 4e4);
}, Fr = async (e) => {
  if (typeof navigator > "u" || !navigator.clipboard || typeof ClipboardItem > "u")
    throw new Error("Clipboard API is not available in this environment.");
  const t = /^data:/i.test(e.image) ? Cn(e.image) : await fetch(e.image).then((a) => a.blob());
  if (!t) return;
  const o = zn(e.image) ?? t.type ?? "image/png";
  await navigator.clipboard.write([new ClipboardItem({ [o]: t })]);
}, Lr = Ie(
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
function Me({
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
      className: g(Lr({ variant: t, size: o, className: e })),
      ...r,
      children: a
    }
  );
}
function In({
  className: e,
  containerClassName: t,
  ratio: o = "auto",
  fit: a = "contain",
  onLoad: r,
  onError: l,
  alt: i = "图片",
  src: s,
  ...c
}) {
  const d = A(null), [m, f] = N(void 0), [b, h] = N(void 0), p = m === s, x = b === s, k = o !== "auto", w = o === "1:1" ? "aspect-square" : o === "4:3" ? "aspect-[4/3]" : o === "16:9" ? "aspect-video" : o === "9:16" ? "aspect-[9/16]" : void 0;
  return M(() => {
    const v = d.current;
    typeof s != "string" || !(v != null && v.complete) || (v.naturalWidth > 0 ? f(s) : h(s));
  }, [s]), /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "image-preview",
      className: g(
        "relative",
        k ? w : "min-h-32",
        t
      ),
      children: [
        !p && !x && /* @__PURE__ */ n(
          "div",
          {
            "data-slot": "image-preview-loading",
            className: "bg-muted/50 absolute inset-0 flex items-center justify-center",
            children: /* @__PURE__ */ n(Xt, { className: "text-muted-foreground size-8 animate-pulse" })
          }
        ),
        x ? /* @__PURE__ */ n(
          "div",
          {
            "data-slot": "image-preview-error",
            className: g(
              "bg-muted/50 flex min-h-32 items-center justify-center p-4",
              k && "absolute inset-0"
            ),
            children: /* @__PURE__ */ n(Io, { className: "text-muted-foreground size-8" })
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
              className: g(
                k ? g("block h-full w-full", {
                  "object-cover": a === "cover",
                  "object-contain": a === "contain"
                }) : "block h-auto w-full object-contain",
                !p && "invisible",
                e
              ),
              onLoad: (v) => {
                typeof s == "string" && f(s), r == null || r(v);
              },
              onError: (v) => {
                typeof s == "string" && h(s), l == null || l(v);
              },
              ...c
            }
          ) })
        )
      ]
    }
  );
}
function Dr({
  className: e,
  label: t,
  url: o,
  iconUrl: a,
  ...r
}) {
  const l = bn(o), i = xr(o), s = t || i, [c, d] = N();
  if (!s) return null;
  const m = a !== void 0 && c !== a;
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "image-source",
      className: g(
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
        l ? /* @__PURE__ */ u(
          "a",
          {
            "data-slot": "image-source-label",
            href: l,
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
function tt({
  className: e,
  children: t,
  ...o
}) {
  return t ? /* @__PURE__ */ n(
    "span",
    {
      "data-slot": "image-filename",
      className: g(
        "text-muted-foreground block truncate px-2 py-1.5 text-xs",
        e
      ),
      ...o,
      children: t
    }
  ) : null;
}
function An({ src: e, alt: t = "图片预览", children: o }) {
  const [a, r] = N(!1), l = A(null), i = A(null), s = A(null), c = J(() => r(!0), []), d = J(() => {
    var m;
    r(!1), (m = l.current) == null || m.focus();
  }, []);
  return M(() => {
    if (!a) return;
    const m = (f) => {
      var x;
      if (f.key === "Escape") {
        d();
        return;
      }
      if (f.key !== "Tab") return;
      const b = (x = s.current) == null ? void 0 : x.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ), h = b == null ? void 0 : b[0], p = b == null ? void 0 : b[b.length - 1];
      !h || !p || (f.shiftKey && document.activeElement === h ? (f.preventDefault(), p.focus()) : !f.shiftKey && document.activeElement === p && (f.preventDefault(), h.focus()));
    };
    return document.addEventListener("keydown", m), () => document.removeEventListener("keydown", m);
  }, [a, d]), M(() => {
    if (!a) return;
    const m = document.body.style.overflow;
    return document.body.style.overflow = "hidden", () => {
      document.body.style.overflow = m;
    };
  }, [a]), M(() => {
    var m;
    a && ((m = i.current) == null || m.focus());
  }, [a]), /* @__PURE__ */ u(fe, { children: [
    /* @__PURE__ */ n(
      "div",
      {
        ref: l,
        onClick: c,
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
    a && wa(
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
                children: /* @__PURE__ */ n(ze, { className: "size-5" })
              }
            )
          ]
        }
      ),
      document.body
    )
  ] });
}
function Rn({ className: e }) {
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "image-generating",
      className: g(
        "bg-muted/50 flex min-h-32 items-center justify-center p-4",
        e
      ),
      children: [
        /* @__PURE__ */ n(Fe, { className: "text-muted-foreground size-8 animate-spin" }),
        /* @__PURE__ */ n("span", { className: "sr-only", children: "Generating image…" })
      ]
    }
  );
}
function Sn({
  className: e,
  reason: t
}) {
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "image-content-filter-error",
      className: g(
        "bg-muted/50 flex min-h-32 flex-col items-center justify-center gap-2 p-4 text-center",
        e
      ),
      children: [
        /* @__PURE__ */ n(zo, { className: "text-muted-foreground size-8" }),
        /* @__PURE__ */ n("p", { className: "text-sm font-medium", children: "Image could not be generated" }),
        t && /* @__PURE__ */ n("p", { className: "text-muted-foreground text-xs", children: t })
      ]
    }
  );
}
function jr({
  onRegenerate: e
}) {
  const [t, o] = N(!1);
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
        ct,
        {
          className: g("size-4", t && "animate-spin")
        }
      )
    }
  );
}
function Or({ part: e, onRegenerate: t, className: o }) {
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "image-actions",
      className: g("flex items-center gap-1 p-1", o),
      children: [
        /* @__PURE__ */ n(
          "button",
          {
            type: "button",
            onClick: () => Pr(e),
            "data-slot": "image-download",
            "aria-label": "下载图片",
            className: "hover:bg-muted inline-flex size-7 items-center justify-center rounded",
            children: /* @__PURE__ */ n(lt, { className: "size-4" })
          }
        ),
        /* @__PURE__ */ n(
          "button",
          {
            type: "button",
            onClick: () => {
              Fr(e).catch(() => {
              });
            },
            "data-slot": "image-copy",
            "aria-label": "复制图片",
            className: "hover:bg-muted inline-flex size-7 items-center justify-center rounded",
            children: /* @__PURE__ */ n(De, { className: "size-4" })
          }
        ),
        t && /* @__PURE__ */ n(jr, { onRegenerate: t })
      ]
    }
  );
}
const Ur = (e) => {
  const { image: t, filename: o, status: a } = e;
  return (a == null ? void 0 : a.type) === "running" ? /* @__PURE__ */ u(Me, { children: [
    /* @__PURE__ */ n(Rn, {}),
    /* @__PURE__ */ n(tt, { children: o })
  ] }) : (a == null ? void 0 : a.type) === "incomplete" && a.reason === "content-filter" ? /* @__PURE__ */ n(Me, { children: /* @__PURE__ */ n(Sn, { reason: "服务商拦了这张图。" }) }) : /* @__PURE__ */ u(Me, { children: [
    /* @__PURE__ */ n(An, { src: t, alt: o || "图片", children: /* @__PURE__ */ n(In, { src: t, alt: o || "图片" }) }),
    /* @__PURE__ */ n(tt, { children: o })
  ] });
}, K = ge(Ur);
K.displayName = "Image";
K.Root = Me;
K.Preview = In;
K.Source = Dr;
K.Filename = tt;
K.Zoom = An;
K.Actions = Or;
K.Generating = Rn;
K.ContentFilterError = Sn;
const Br = ({
  copiedDuration: e = 3e3
} = {}) => {
  const [t, o] = N(!1), a = A(
    void 0
  ), r = A(0);
  return M(
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
}, nt = "#retainpdf-page=", _n = String.raw`\s*(?:[、,，/]|和|与|及|至|到|[-–—~]|and|to)\s*`, Wr = String.raw`第\s*\d{1,4}(?:${_n}\d{1,4})*\s*页`, Hr = String.raw`\b(?:pp?\.|pages?)\s*\d{1,4}(?:${_n}\d{1,4})*`, Gr = new RegExp(`${Wr}|${Hr}`, "gi");
function En(e, t = 0) {
  const o = [];
  let a = 0;
  const r = (l) => {
    if (!l) return;
    const i = o[o.length - 1];
    (i == null ? void 0 : i.type) === "text" ? i.value += l : o.push({ type: "text", value: l });
  };
  for (const l of e.matchAll(Gr)) {
    const i = l.index ?? 0;
    r(e.slice(a, i));
    const s = l[0];
    let c = 0;
    for (const d of s.matchAll(/\d{1,4}/g)) {
      const m = d.index ?? 0, f = Number(d[0]);
      r(s.slice(c, m)), f >= 1 && (!t || f <= t) ? o.push({ type: "page", page: f, value: d[0] }) : r(d[0]), c = m + d[0].length;
    }
    r(s.slice(c)), a = i + s.length;
  }
  return r(e.slice(a)), o;
}
function Kr(e) {
  if (!(e != null && e.startsWith(nt))) return null;
  const t = Number(e.slice(nt.length));
  return Number.isInteger(t) && t >= 1 ? t : null;
}
const Vr = /* @__PURE__ */ new Set(["link", "linkReference", "definition", "inlineCode", "code", "inlineMath", "math", "html"]);
function $n(e) {
  if (!e.children) return;
  const t = [];
  for (const o of e.children) {
    if (o.type === "text" && o.value) {
      for (const a of En(o.value))
        t.push(a.type === "page" ? { type: "link", url: `${nt}${a.page}`, children: [{ type: "text", value: a.value }] } : { type: "text", value: a.value });
      continue;
    }
    Vr.has(o.type) || $n(o), t.push(o);
  }
  e.children = t;
}
function qr() {
  return (e) => $n(e);
}
const ht = Pe(null);
function Xr(e, t) {
  return !!e && t >= 1 && (!e.pageCount || t <= e.pageCount);
}
function Mn({ page: e, children: t }) {
  const o = re(ht);
  return Xr(o, e) ? /* @__PURE__ */ n(
    Z,
    {
      className: "reader-ask-page",
      title: `跳到第 ${e} 页`,
      onClick: (a) => {
        a.preventDefault(), a.stopPropagation(), o.jump(e);
      },
      children: t
    }
  ) : /* @__PURE__ */ n(fe, { children: t });
}
function $t({ text: e }) {
  const t = re(ht);
  return /* @__PURE__ */ n(fe, { children: En(e, (t == null ? void 0 : t.pageCount) || 0).map((o, a) => o.type === "page" ? /* @__PURE__ */ n(Mn, { page: o.page, children: o.value }, a) : /* @__PURE__ */ n("span", { children: o.value }, a)) });
}
const Qr = (e, t) => e !== void 0 && t !== void 0 && Object.keys(e).length === Object.keys(t).length && Object.keys(t).every((o) => e[o] === t[o]), Mt = (e) => {
  const [t, o] = N(e);
  return e !== t && !Qr(t, e) ? (o(e), e) : t;
}, Yr = ({
  components: e,
  componentsByLanguage: t
}) => {
  const o = Mt(e), a = Mt(t), r = ue(() => o ? {
    ...Pt,
    ...on(o)
  } : Pt, [o]);
  return /* @__PURE__ */ n(
    Ta,
    {
      remarkPlugins: [Ia, Aa, qr],
      rehypePlugins: [Ra],
      preprocess: Ca,
      className: "aui-md",
      components: r,
      componentsByLanguage: a,
      defer: !0
    }
  );
}, Pn = ge(Yr), Zr = ({ language: e, code: t }) => {
  const { isCopied: o, copyToClipboard: a } = Br();
  return /* @__PURE__ */ u("div", { className: "aui-code-header-root border-border/50 bg-muted/50 mt-3 flex items-center justify-between rounded-t-xl border border-b-0 px-3.5 py-1.5 text-xs", children: [
    /* @__PURE__ */ n("span", { className: "aui-code-header-language text-muted-foreground font-medium lowercase", children: e }),
    /* @__PURE__ */ u(L, { tooltip: "复制", onClick: () => {
      !t || o || a(t);
    }, children: [
      !o && /* @__PURE__ */ n(De, { className: "animate-in zoom-in-75 fade-in duration-150" }),
      o && /* @__PURE__ */ n(pe, { className: "animate-in zoom-in-50 fade-in duration-200 ease-out" })
    ] })
  ] });
}, Pt = on({
  h1: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "h1",
    {
      className: g(
        "aui-md-h1 mt-5 mb-2 scroll-m-20 text-xl font-semibold first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  h2: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "h2",
    {
      className: g(
        "aui-md-h2 mt-5 mb-2 scroll-m-20 text-lg font-semibold first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  h3: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "h3",
    {
      className: g(
        "aui-md-h3 mt-4 mb-1.5 scroll-m-20 text-base font-semibold first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  h4: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "h4",
    {
      className: g(
        "aui-md-h4 mt-3.5 mb-1 scroll-m-20 text-base font-medium first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  h5: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "h5",
    {
      className: g(
        "aui-md-h5 mt-3 mb-1 text-sm font-semibold first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  h6: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "h6",
    {
      className: g(
        "aui-md-h6 mt-3 mb-1 text-sm font-medium first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  p: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "p",
    {
      className: g(
        "aui-md-p my-3 leading-relaxed first:mt-0 last:mb-0",
        e
      ),
      ...t
    }
  ),
  a: ({ className: e, ...t }) => {
    const o = Kr(t.href);
    return o ? /* @__PURE__ */ n(Mn, { page: o, children: t.children }) : /* @__PURE__ */ n(
      "a",
      {
        className: g(
          "aui-md-a text-primary hover:text-primary/80 underline underline-offset-2",
          e
        ),
        ...t
      }
    );
  },
  blockquote: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "blockquote",
    {
      className: g(
        "aui-md-blockquote border-muted-foreground/30 text-muted-foreground my-3 border-s-2 ps-4",
        e
      ),
      ...t
    }
  ),
  ul: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "ul",
    {
      className: g(
        "aui-md-ul marker:text-muted-foreground my-3 ms-5 list-disc [&>li]:mt-1",
        e
      ),
      ...t
    }
  ),
  ol: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "ol",
    {
      className: g(
        "aui-md-ol marker:text-muted-foreground my-3 ms-5 list-decimal [&>li]:mt-1",
        e
      ),
      ...t
    }
  ),
  hr: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "hr",
    {
      className: g("aui-md-hr border-muted-foreground/20 my-3", e),
      ...t
    }
  ),
  table: ({ className: e, ...t }) => /* @__PURE__ */ n("div", { className: "aui-md-table-wrapper my-3 overflow-x-auto", children: /* @__PURE__ */ n(
    "table",
    {
      className: g(
        "aui-md-table w-full border-separate border-spacing-0",
        e
      ),
      ...t
    }
  ) }),
  th: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "th",
    {
      className: g(
        "aui-md-th bg-muted px-3 py-1.5 text-start font-medium first:rounded-ss-lg last:rounded-se-lg [[align=center]]:text-center [[align=right]]:text-right",
        e
      ),
      ...t
    }
  ),
  td: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "td",
    {
      className: g(
        "aui-md-td border-muted-foreground/20 border-s border-b px-3 py-1.5 text-start last:border-e [[align=center]]:text-center [[align=right]]:text-right",
        e
      ),
      ...t
    }
  ),
  tr: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "tr",
    {
      className: g(
        "aui-md-tr m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-es-lg [&:last-child>td:last-child]:rounded-ee-lg",
        e
      ),
      ...t
    }
  ),
  li: ({ className: e, ...t }) => /* @__PURE__ */ n("li", { className: g("aui-md-li leading-relaxed", e), ...t }),
  strong: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "strong",
    {
      className: g("aui-md-strong font-semibold", e),
      ...t
    }
  ),
  sup: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "sup",
    {
      className: g("aui-md-sup [&>a]:text-xs [&>a]:no-underline", e),
      ...t
    }
  ),
  pre: ({ className: e, ...t }) => /* @__PURE__ */ n(
    "pre",
    {
      className: g(
        "aui-md-pre border-border/50 bg-muted/30 overflow-x-auto rounded-t-none rounded-b-xl border border-t-0 p-3.5 text-[13px] leading-relaxed",
        e
      ),
      ...t
    }
  ),
  code: function({ className: t, ...o }) {
    const a = za();
    return /* @__PURE__ */ n(
      "code",
      {
        className: g(
          !a && "aui-md-inline-code bg-muted rounded-md px-1.5 py-0.5 font-mono text-[0.85em]",
          t
        ),
        ...o
      }
    );
  },
  CodeHeader: Zr
}), bt = Ce(function(t, o) {
  return /* @__PURE__ */ n(mt.Root, { ref: o, "data-slot": "collapsible", ...t });
});
function xt({
  ...e
}) {
  return /* @__PURE__ */ n(
    mt.CollapsibleTrigger,
    {
      "data-slot": "collapsible-trigger",
      ...e
    }
  );
}
function vt({
  ...e
}) {
  return /* @__PURE__ */ n(
    mt.CollapsibleContent,
    {
      "data-slot": "collapsible-content",
      ...e
    }
  );
}
const Fn = 200, kt = Pe(!1), Jr = Ie("aui-reasoning-root mb-4 w-full", {
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
}), ei = Ce(function({
  className: t,
  variant: o,
  open: a,
  onOpenChange: r,
  defaultOpen: l = !1,
  streaming: i,
  onAnimationStart: s,
  children: c,
  ...d
}, m) {
  const [f] = N(l), [b, h] = N(null), p = a !== void 0, x = p ? a : b ?? (i || f), k = i === !0 && x, w = A(i);
  fr(() => {
    w.current !== i && (w.current = i, !p && b === null && !f && (s == null || s()));
  }, [i, p, b, f, s]);
  const v = J(
    (T) => {
      s == null || s(), p || h(T), r == null || r(T);
    },
    [s, p, r]
  );
  return /* @__PURE__ */ n(
    bt,
    {
      ref: m,
      "data-slot": "reasoning-root",
      "data-variant": o,
      open: x,
      onOpenChange: v,
      className: g(
        "group/reasoning-root",
        Jr({ variant: o, className: t })
      ),
      style: {
        "--animation-duration": `${Fn}ms`
      },
      ...d,
      children: /* @__PURE__ */ n(kt.Provider, { value: k, children: c })
    }
  );
});
function ot({
  side: e = "bottom",
  className: t,
  ...o
}) {
  return e === "top" ? /* @__PURE__ */ n(
    "div",
    {
      "data-slot": "reasoning-fade",
      className: g(
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
      className: g(
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
function yt({
  active: e,
  duration: t,
  label: o = "思考",
  className: a,
  ...r
}) {
  const l = t === void 0 ? "" : ` · ${t < 10 ? t.toFixed(1) : Math.round(t)}s`;
  return /* @__PURE__ */ u(
    xt,
    {
      "data-slot": "reasoning-trigger",
      className: g(
        "aui-reasoning-trigger group/trigger text-muted-foreground hover:text-foreground flex max-w-[75%] origin-left items-center gap-2 py-1.5 text-sm transition-[color,scale] active:scale-[0.98]",
        a
      ),
      ...r,
      children: [
        /* @__PURE__ */ n(
          Ao,
          {
            "data-slot": "reasoning-trigger-icon",
            className: "aui-reasoning-trigger-icon size-4 shrink-0"
          }
        ),
        /* @__PURE__ */ u(
          "span",
          {
            "data-slot": "reasoning-trigger-label",
            className: g(
              "aui-reasoning-trigger-label-wrapper inline-block leading-none tabular-nums",
              e && "shimmer motion-reduce:animate-none"
            ),
            children: [
              o,
              l
            ]
          }
        ),
        /* @__PURE__ */ n(
          dt,
          {
            "data-slot": "reasoning-trigger-chevron",
            className: g(
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
function Nt({
  className: e,
  children: t,
  ...o
}) {
  const a = re(kt);
  return /* @__PURE__ */ u(
    vt,
    {
      "data-slot": "reasoning-content",
      className: g(
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
        /* @__PURE__ */ n(ot, { side: "top" }),
        t,
        a ? /* @__PURE__ */ n(ot, {}) : null
      ]
    }
  );
}
function wt({
  className: e,
  children: t,
  ...o
}) {
  const a = re(kt), r = A(null), l = A(null);
  return M(() => {
    if (!a) return;
    const i = r.current, s = l.current;
    if (!i || !s) return;
    let c = !0, d = i.scrollTop, m = i.scrollHeight;
    const f = () => Math.abs(
      i.scrollHeight - i.scrollTop - i.clientHeight
    ) <= 1 || i.scrollHeight <= i.clientHeight, b = () => {
      c && (i.scrollTop = i.scrollHeight);
    }, h = () => {
      f() ? c = !0 : i.scrollTop < d && i.scrollHeight === m && (c = !1), d = i.scrollTop, m = i.scrollHeight;
    };
    b(), i.addEventListener("scroll", h);
    const p = new ResizeObserver(b);
    return p.observe(s), () => {
      i.removeEventListener("scroll", h), p.disconnect();
    };
  }, [a]), /* @__PURE__ */ n(
    "div",
    {
      ref: r,
      "data-slot": "reasoning-text",
      className: g(
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
      children: /* @__PURE__ */ n("div", { ref: l, className: "aui-reasoning-text-content space-y-4", children: t })
    }
  );
}
const Tt = Ce(function({ onAnimationStart: t, ...o }, a) {
  const r = A(null), l = st(r, Fn), i = J(() => {
    l(), t == null || t();
  }, [l, t]), s = J(
    (c) => {
      if (r.current = c, typeof a == "function") {
        const d = a(c);
        if (typeof d == "function")
          return () => {
            r.current = null, d();
          };
      } else a && (a.current = c);
    },
    [a]
  );
  return /* @__PURE__ */ n(
    ei,
    {
      ref: s,
      onAnimationStart: i,
      ...o
    }
  );
}), ti = () => /* @__PURE__ */ n(Pn, {}), ni = ({
  children: e,
  startIndex: t,
  endIndex: o
}) => {
  const a = E((r) => {
    var l, i;
    if (((l = r.message.status) == null ? void 0 : l.type) !== "running") return !1;
    for (let s = t; s <= o; s++)
      if (((i = r.message.parts[s]) == null ? void 0 : i.status.type) === "running") return !0;
    return !1;
  });
  return /* @__PURE__ */ u(Tt, { streaming: a, children: [
    /* @__PURE__ */ n(yt, { active: a }),
    /* @__PURE__ */ n(Nt, { "aria-busy": a, children: /* @__PURE__ */ n(wt, { children: e }) })
  ] });
}, he = ge(
  ti
);
he.displayName = "Reasoning";
he.Root = Tt;
he.Trigger = yt;
he.Content = Nt;
he.Text = wt;
he.Fade = ot;
const oi = ge(ni);
oi.displayName = "ReasoningGroup";
function Ln({ className: e, ...t }) {
  return /* @__PURE__ */ n(
    "textarea",
    {
      "data-slot": "textarea",
      className: g(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        e
      ),
      ...t
    }
  );
}
const Ft = 200, Q = "active:scale-[0.98]";
function Dn({
  className: e,
  open: t,
  onOpenChange: o,
  defaultOpen: a = !1,
  children: r,
  ...l
}) {
  const i = A(null), [s, c] = N(a), d = st(i, Ft), m = t !== void 0, f = m ? t : s, b = J(
    (h) => {
      d(), m || c(h), o == null || o(h);
    },
    [d, m, o]
  );
  return /* @__PURE__ */ n(
    bt,
    {
      ref: i,
      "data-slot": "tool-fallback-root",
      open: f,
      onOpenChange: b,
      className: g(
        "aui-tool-fallback-root group/tool-fallback-root w-full",
        e
      ),
      style: {
        "--animation-duration": `${Ft}ms`
      },
      ...l,
      children: r
    }
  );
}
const ai = {
  running: Yt,
  complete: pe,
  incomplete: Qt,
  "requires-action": Kt
}, ri = (e) => {
  if (e < 1e3) return "<1s";
  const t = e / 1e3;
  return t < 10 ? `${(Math.floor(t * 10) / 10).toFixed(1)}s` : t < 60 ? `${Math.floor(t)}s` : `${Math.floor(t / 60)}m ${Math.floor(t % 60)}s`;
};
function ii({
  className: e,
  ...t
}) {
  const o = fo();
  return o === void 0 ? null : /* @__PURE__ */ n(
    "span",
    {
      "data-slot": "tool-fallback-duration",
      className: g(
        "aui-tool-fallback-duration text-muted-foreground text-xs tabular-nums",
        e
      ),
      ...t,
      children: ri(o)
    }
  );
}
function jn({
  toolName: e,
  status: t,
  isError: o,
  responseDeliveryStatus: a,
  className: r,
  ...l
}) {
  const i = (t == null ? void 0 : t.type) ?? "complete", s = i === "complete" && o ? "incomplete" : i, c = s === "running", d = (t == null ? void 0 : t.type) === "incomplete" && t.reason === "cancelled", m = ai[s], f = a === "queued" ? "回复排着，还没发出" : s === "running" ? "正在用工具" : s === "requires-action" ? "等你决定" : s === "incomplete" ? `${d ? "取消了的" : "失败的"}工具` : "用了工具";
  return /* @__PURE__ */ u(
    xt,
    {
      "data-slot": "tool-fallback-trigger",
      className: g(
        "aui-tool-fallback-trigger group/trigger text-muted-foreground hover:text-foreground flex w-fit max-w-full origin-left items-center gap-2 py-1.5 text-sm transition-[color,scale] active:scale-[0.98]",
        r
      ),
      ...l,
      children: [
        /* @__PURE__ */ n(
          m,
          {
            "data-slot": "tool-fallback-trigger-icon",
            className: g(
              "aui-tool-fallback-trigger-icon size-4 shrink-0",
              d && "text-muted-foreground",
              c && "animate-spin [animation-duration:0.6s]"
            )
          }
        ),
        /* @__PURE__ */ u(
          "span",
          {
            "data-slot": "tool-fallback-trigger-label",
            className: g(
              "aui-tool-fallback-trigger-label-wrapper inline-block min-w-0 text-start leading-none wrap-anywhere",
              d && "text-muted-foreground line-through",
              c && "shimmer motion-reduce:animate-none"
            ),
            children: [
              f,
              ": ",
              /* @__PURE__ */ n("b", { children: e })
            ]
          }
        ),
        /* @__PURE__ */ n(ii, {}),
        /* @__PURE__ */ n(
          dt,
          {
            "data-slot": "tool-fallback-trigger-chevron",
            className: g(
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
function On({
  className: e,
  children: t,
  ...o
}) {
  return /* @__PURE__ */ n(
    vt,
    {
      "data-slot": "tool-fallback-content",
      className: g(
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
          className: g(
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
function Un({
  argsText: e,
  className: t,
  ...o
}) {
  return e ? /* @__PURE__ */ n(
    "div",
    {
      "data-slot": "tool-fallback-args",
      className: g("aui-tool-fallback-args", t),
      ...o,
      children: /* @__PURE__ */ n("pre", { className: "aui-tool-fallback-args-value bg-muted/50 text-foreground/90 rounded-md p-2.5 text-xs break-words whitespace-pre-wrap", children: e })
    }
  ) : null;
}
const Bn = (e, t) => {
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
function Wn({
  result: e,
  className: t,
  ...o
}) {
  return e === void 0 ? null : /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "tool-fallback-result",
      className: g("aui-tool-fallback-result", t),
      ...o,
      children: [
        /* @__PURE__ */ n("p", { className: "aui-tool-fallback-result-header text-muted-foreground text-xs font-medium", children: "结果：" }),
        /* @__PURE__ */ n("pre", { className: "aui-tool-fallback-result-content bg-muted/50 text-foreground/90 mt-1 rounded-md p-2.5 text-xs break-words whitespace-pre-wrap", children: Bn(e, 2) })
      ]
    }
  );
}
function Hn({
  status: e,
  className: t,
  ...o
}) {
  if ((e == null ? void 0 : e.type) !== "incomplete") return null;
  const a = e.error, r = a == null ? null : Bn(a);
  if (!r) return null;
  const i = e.reason === "cancelled" ? "取消原因：" : "出错：";
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "tool-fallback-error",
      className: g("aui-tool-fallback-error", t),
      ...o,
      children: [
        /* @__PURE__ */ n("p", { className: "aui-tool-fallback-error-header text-muted-foreground font-semibold", children: i }),
        /* @__PURE__ */ n("p", { className: "aui-tool-fallback-error-reason text-muted-foreground break-words whitespace-pre-line", children: r })
      ]
    }
  );
}
const si = "用户同意了", li = "用户没同意", Gn = {
  "allow-once": "允许",
  "allow-always": "总是允许",
  "reject-once": "不允许",
  "reject-always": "总是不允许"
}, Te = (e) => Object.hasOwn(Gn, e), Lt = (e) => e === "allow-once" || e === "allow-always", at = (e) => e.label ?? (Te(e.kind) ? Gn[e.kind] : void 0) ?? e.id, Kn = (e) => (e == null ? void 0 : e.display) === "select" || (e == null ? void 0 : e.display) === "text" || (e == null ? void 0 : e.display) === "questions", ci = (e) => {
  var t;
  return !((t = e.options) != null && t.length) || e.allowFreeform === !0;
}, di = (e, t) => {
  var o;
  return [
    ...((t == null ? void 0 : t.optionIds) ?? []).map(
      (a) => {
        var r, l;
        return ((l = (r = e.options) == null ? void 0 : r.find((i) => i.id === a)) == null ? void 0 : l.label) ?? a;
      }
    ),
    ...(o = t == null ? void 0 : t.text) != null && o.trim() ? [t.text] : []
  ];
}, rt = (e) => e != null && (e.approved !== void 0 || e.resolution !== void 0), ui = (e) => {
  var l;
  if (e.resolution !== void 0)
    return {
      outcome: "closed",
      label: e.resolution === "cancelled" ? "没决定就取消了" : "没决定就过期了"
    };
  const t = e.optionId === void 0 || (l = e.options) == null ? void 0 : l.find((i) => i.id === e.optionId), o = t !== void 0 ? at(t) : e.optionId === void 0 ? void 0 : e.optionId, a = Kn(e) || t !== void 0 && !Te(t.kind), r = e.isAutomatic ? "自动" : "";
  return e.approved ? {
    outcome: "allowed",
    label: `${r}${a ? "回答了" : "允许了"}`,
    option: o
  } : {
    outcome: "refused",
    label: `${r}${a ? "跳过了" : "没允许"}`,
    option: o
  };
}, mi = {
  allowed: pe,
  refused: Qt,
  closed: Ro
};
function fi({
  approval: e,
  className: t,
  receiptRef: o,
  ...a
}) {
  var s;
  const r = ui(e), l = mi[r.outcome], i = [
    ...new Set(
      [e.text, e.reason].filter(
        (c) => typeof c == "string" && c !== ""
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
      className: g(
        "aui-tool-fallback-approval-receipt flex flex-col gap-1.5 pt-1",
        t
      ),
      ...a,
      children: [
        e.prompt ? /* @__PURE__ */ n("p", { className: "aui-tool-fallback-approval-prompt text-muted-foreground whitespace-pre-line", children: e.prompt }) : null,
        /* @__PURE__ */ u("p", { className: "aui-tool-fallback-approval-receipt-label flex items-center gap-1.5", children: [
          /* @__PURE__ */ n(l, { "aria-hidden": !0, className: "text-muted-foreground size-3.5 shrink-0" }),
          /* @__PURE__ */ n("span", { className: "font-medium", children: r.label }),
          r.option !== void 0 ? /* @__PURE__ */ u("span", { className: "text-muted-foreground", children: [
            "· ",
            r.option
          ] }) : null
        ] }),
        e.answers && ((s = e.questions) == null ? void 0 : s.map((c) => {
          const d = di(
            c,
            e.answers && Object.hasOwn(e.answers, c.id) ? e.answers[c.id] : void 0
          );
          return d.length === 0 ? null : /* @__PURE__ */ u(
            "p",
            {
              className: "aui-tool-fallback-approval-receipt-answer whitespace-pre-line",
              children: [
                /* @__PURE__ */ n("span", { className: "text-muted-foreground", children: c.header ?? c.prompt }),
                " ",
                "· ",
                d.join(", ")
              ]
            },
            c.id
          );
        })),
        i.map((c) => /* @__PURE__ */ n(
          "p",
          {
            className: "aui-tool-fallback-approval-receipt-note text-muted-foreground whitespace-pre-line",
            children: c
          },
          c
        ))
      ]
    }
  );
}
function gi({
  questions: e,
  dismissible: t,
  locked: o,
  onSend: a,
  onDismiss: r
}) {
  const [l, i] = N(() => /* @__PURE__ */ new Map()), [s, c] = N(
    () => /* @__PURE__ */ new Map()
  ), d = (h, p) => i((x) => {
    const k = x.get(h.id) ?? [], w = k.includes(p) ? k.filter((v) => v !== p) : h.multiple ? [...k, p] : [p];
    return new Map(x).set(h.id, w);
  }), m = (h) => {
    const p = l.get(h.id) ?? [], x = s.get(h.id), k = x != null && x.trim() ? x : void 0;
    return {
      ...p.length > 0 && { optionIds: p },
      ...k !== void 0 && { text: k }
    };
  }, f = e.length > 0 && e.every((h) => {
    const p = m(h);
    return p.optionIds !== void 0 || p.text !== void 0;
  }), b = () => {
    o || !f || a(
      Object.fromEntries(
        e.map((h) => [h.id, m(h)])
      )
    );
  };
  return /* @__PURE__ */ u(fe, { children: [
    e.map((h) => {
      var k, w;
      const p = l.get(h.id) ?? [], x = ((k = h.options) == null ? void 0 : k.some((v) => v.description)) ?? !1;
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
                className: g(
                  "flex gap-2",
                  x ? "flex-col items-stretch" : "flex-wrap items-center"
                ),
                children: h.options.map((v) => {
                  const T = p.includes(v.id);
                  return /* @__PURE__ */ u(
                    F,
                    {
                      size: "sm",
                      variant: T ? "default" : "outline",
                      className: g(
                        Q,
                        x && "h-auto flex-col items-start gap-0.5 py-2 text-start whitespace-normal"
                      ),
                      "aria-pressed": T,
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
            ci(h) ? /* @__PURE__ */ n(
              Ln,
              {
                value: s.get(h.id) ?? "",
                onChange: (v) => c(
                  (T) => new Map(T).set(h.id, v.target.value)
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
        F,
        {
          size: "sm",
          className: Q,
          onClick: b,
          disabled: o || !f,
          children: "发送"
        }
      ),
      t ? /* @__PURE__ */ n(
        F,
        {
          size: "sm",
          variant: "outline",
          className: Q,
          onClick: r,
          disabled: o,
          children: "跳过"
        }
      ) : null
    ] })
  ] });
}
const Vn = (e, t, o) => (e == null ? void 0 : e.type) !== "requires-action" || e.reason !== "interrupt" || t != null || o != null, qn = Ce(function(t, o) {
  var r;
  const a = A(!1);
  return /* @__PURE__ */ n(
    pi,
    {
      carryFocusRef: a,
      forwardedRef: o,
      ...t
    },
    (r = t.approval) == null ? void 0 : r.id
  );
});
function pi({
  className: e,
  forwardedRef: t,
  carryFocusRef: o,
  addResult: a,
  resume: r,
  interrupt: l,
  approval: i,
  respondToApproval: s,
  status: c,
  ...d
}) {
  const [m, f] = N(!1), b = E((y) => y.thread.voice !== void 0), h = E((y) => y.thread.capabilities.answerToolCall), p = m || b, [x, k] = N(null), [w, v] = N(""), [T, P] = N(null), S = (c == null ? void 0 : c.type) === "requires-action", [C, R] = N(S), [j, Y] = N(0), te = A(j);
  xe(() => {
    te.current = j;
  }, [j]), S !== C && (R(S), S && (f(!1), k(null), v(""), P(null), Y(j + 1)));
  const V = A(null), z = A(null), H = A(null);
  xe(() => {
    var y;
    return o.current && (o.current = !1, (y = V.current) == null || y.focus({ preventScroll: !0 })), () => {
      const $ = V.current ?? z.current;
      o.current = ($ == null ? void 0 : $.contains($.ownerDocument.activeElement)) ?? !1;
    };
  }, [o]), so(
    t,
    () => V.current ?? z.current
  );
  const Ge = J(
    (y) => {
      if (z.current = y, !y) return;
      const $ = H.current === (i == null ? void 0 : i.id);
      H.current = null, $ && y.focus({ preventScroll: !0 });
    },
    [i == null ? void 0 : i.id]
  ), ne = J(
    (y) => {
      const $ = V.current;
      H.current = !y && ($ != null && $.contains($.ownerDocument.activeElement)) ? i == null ? void 0 : i.id : null, V.current = y;
    },
    [i == null ? void 0 : i.id]
  ), ke = i != null && !rt(i) && c !== void 0 && c.type !== "requires-action" && !(m && c.type === "running");
  xe(() => {
    ke && (H.current = null);
  }, [ke]);
  const ye = () => {
    const y = V.current;
    y != null && y.contains(y.ownerDocument.activeElement) && y.focus({ preventScroll: !0 });
  };
  if (i != null && rt(i))
    return /* @__PURE__ */ n(
      fi,
      {
        approval: i,
        receiptRef: Ge,
        className: e,
        ...d
      }
    );
  if (ke || !Vn(c, i, l))
    return null;
  const ie = i != null && i.prompt ? /* @__PURE__ */ n("p", { className: "aui-tool-fallback-approval-prompt text-foreground whitespace-pre-line", children: i.prompt }) : null;
  if (!h)
    return ie && /* @__PURE__ */ n(
      "div",
      {
        "data-slot": "tool-fallback-approval",
        tabIndex: -1,
        className: g(
          "aui-tool-fallback-approval flex flex-col gap-2 pt-1",
          e
        ),
        ...d,
        ref: ne,
        children: ie
      }
    );
  const W = s ? i == null ? void 0 : i.options : void 0, _ = i != null && s != null && go(i), I = (y) => {
    ye(), f(!0), k(null), P(null), (async () => {
      try {
        await y();
      } catch ($) {
        if (te.current !== j) return;
        f(!1), P(
          $ instanceof Error ? $.message : String($)
        );
      }
    })();
  }, D = (y) => {
    if (!p)
      if (i != null && i.approved === void 0 && s)
        I(() => s({ approved: y, ...q() }));
      else if (l)
        I(() => r == null ? void 0 : r({ approved: y }));
      else {
        if ((c == null ? void 0 : c.type) === "requires-action" && c.reason === "interrupt")
          return;
        I(() => a == null ? void 0 : a(y ? si : li));
      }
  }, U = (y) => {
    p || I(
      () => s == null ? void 0 : s(
        Te(y.kind) ? { optionId: y.id, ...q() } : { optionId: y.id, approved: !0, ...q() }
      )
    );
  }, q = () => w.trim() ? { text: w } : {}, no = () => {
    p || I(() => s == null ? void 0 : s({ text: w }));
  }, Ct = () => {
    p || I(() => s == null ? void 0 : s({ approved: !1 }));
  }, oo = (y) => {
    y.confirm ? (ye(), k(y.id)) : U(y);
  }, oe = x != null ? W == null ? void 0 : W.find((y) => y.id === x) : void 0, be = Kn(i), Re = be && s != null && (i == null ? void 0 : i.dismissible) === !0 ? /* @__PURE__ */ n(
    F,
    {
      size: "sm",
      variant: "outline",
      className: Q,
      onClick: Ct,
      disabled: p,
      children: "跳过"
    }
  ) : null, Se = T ? /* @__PURE__ */ n(
    "p",
    {
      role: "alert",
      className: "aui-tool-fallback-approval-error text-destructive text-xs whitespace-pre-line",
      children: T
    }
  ) : null, Ke = _ ? /* @__PURE__ */ u("div", { className: "aui-tool-fallback-approval-answer flex flex-col items-start gap-2", children: [
    /* @__PURE__ */ n(
      Ln,
      {
        value: w,
        onChange: (y) => v(y.target.value),
        disabled: p,
        "aria-label": be ? (i == null ? void 0 : i.prompt) ?? "回答" : "备注",
        placeholder: be ? "写下你的回答" : "给这个决定加一句备注"
      }
    ),
    be && /* @__PURE__ */ u("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ n(
        F,
        {
          size: "sm",
          className: Q,
          onClick: no,
          disabled: p,
          children: "发送"
        }
      ),
      Re
    ] })
  ] }) : null;
  if ((i == null ? void 0 : i.display) === "questions" && s)
    return /* @__PURE__ */ u(
      "div",
      {
        "data-slot": "tool-fallback-approval",
        tabIndex: -1,
        className: g(
          "aui-tool-fallback-approval flex flex-col gap-3 pt-1",
          e
        ),
        ...d,
        ref: ne,
        children: [
          ie,
          /* @__PURE__ */ n(
            gi,
            {
              questions: i.questions ?? [],
              dismissible: i.dismissible === !0,
              locked: p,
              onSend: (y) => I(() => s({ answers: y })),
              onDismiss: Ct
            }
          ),
          Se
        ]
      }
    );
  if (oe) {
    const y = typeof oe.confirm == "object" ? oe.confirm : void 0, $ = (y == null ? void 0 : y.description) ?? oe.description;
    return /* @__PURE__ */ u(
      "div",
      {
        "data-slot": "tool-fallback-approval-confirm",
        tabIndex: -1,
        className: g(
          "aui-tool-fallback-approval-confirm flex flex-col gap-2 pt-1",
          e
        ),
        ...d,
        ref: ne,
        children: [
          /* @__PURE__ */ n("p", { className: "aui-tool-fallback-approval-confirm-title font-semibold", children: (y == null ? void 0 : y.title) ?? `${at(oe)}?` }),
          $ && /* @__PURE__ */ n("p", { className: "aui-tool-fallback-approval-confirm-description text-muted-foreground whitespace-pre-line", children: $ }),
          oe.grants && oe.grants.length > 0 && /* @__PURE__ */ n("ul", { className: "aui-tool-fallback-approval-confirm-grants flex flex-col gap-1", children: oe.grants.map((Ne) => /* @__PURE__ */ n("li", { children: /* @__PURE__ */ n("code", { className: "aui-tool-fallback-approval-confirm-grant bg-muted rounded px-1.5 py-0.5 text-xs", children: Ne }) }, Ne)) }),
          /* @__PURE__ */ u("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ n(
              F,
              {
                size: "sm",
                className: Q,
                onClick: () => U(oe),
                disabled: p,
                children: "确定"
              }
            ),
            /* @__PURE__ */ n(
              F,
              {
                size: "sm",
                variant: "outline",
                className: Q,
                onClick: () => {
                  ye(), k(null);
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
  if (W && W.length > 0) {
    const y = W.filter((X) => Lt(X.kind)), $ = W.filter((X) => !Te(X.kind)), Ne = W.filter(
      (X) => Te(X.kind) && !Lt(X.kind)
    );
    return /* @__PURE__ */ u(
      "div",
      {
        "data-slot": "tool-fallback-approval",
        tabIndex: -1,
        className: g(
          "aui-tool-fallback-approval flex flex-col gap-2 pt-1",
          e
        ),
        ...d,
        ref: ne,
        children: [
          ie,
          /* @__PURE__ */ u("div", { className: "flex flex-wrap items-center gap-2", children: [
            [...y, ...$, ...Ne].map(
              (X) => /* @__PURE__ */ n(
                F,
                {
                  size: "sm",
                  variant: X === y[0] ? "default" : "outline",
                  className: Q,
                  onClick: () => oo(X),
                  disabled: p,
                  children: at(X)
                },
                X.id
              )
            ),
            Ne.length === 0 && !be && /* @__PURE__ */ n(
              F,
              {
                size: "sm",
                variant: "outline",
                className: Q,
                onClick: () => D(!1),
                disabled: p,
                children: "不允许"
              }
            ),
            !_ && Re
          ] }),
          Ke,
          Se
        ]
      }
    );
  }
  return be ? /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "tool-fallback-approval",
      tabIndex: -1,
      className: g(
        "aui-tool-fallback-approval flex flex-col gap-2 pt-1",
        e
      ),
      ...d,
      ref: ne,
      children: [
        ie,
        Ke,
        !_ && Re && /* @__PURE__ */ n("div", { className: "flex items-center gap-2", children: Re }),
        Se
      ]
    }
  ) : /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "tool-fallback-approval",
      tabIndex: -1,
      className: g(
        "aui-tool-fallback-approval flex flex-col gap-2 pt-1",
        e
      ),
      ...d,
      ref: ne,
      children: [
        ie,
        /* @__PURE__ */ u("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ n(
            F,
            {
              size: "sm",
              className: Q,
              onClick: () => D(!0),
              disabled: p,
              children: "允许"
            }
          ),
          /* @__PURE__ */ n(
            F,
            {
              size: "sm",
              variant: "outline",
              className: Q,
              onClick: () => D(!1),
              disabled: p,
              children: "不允许"
            }
          )
        ] }),
        Ke,
        Se
      ]
    }
  );
}
const hi = ({
  toolName: e,
  argsText: t,
  result: o,
  isError: a,
  status: r,
  responseDeliveryStatus: l,
  addResult: i,
  resume: s,
  interrupt: c,
  approval: d,
  respondToApproval: m
}) => {
  const f = (r == null ? void 0 : r.type) === "incomplete" && r.reason === "cancelled", b = (r == null ? void 0 : r.type) === "requires-action", h = d != null || b && Vn(r, d, c), [p, x] = N(b), [k, w] = N(b);
  b !== k && (w(b), b && x(!0));
  const v = A(!1), T = A(null), P = A(null);
  return xe(() => {
    var Y;
    const S = T.current;
    if (!S || S.isConnected || b || !v.current)
      return;
    const C = d == null || !rt(d);
    v.current = !1;
    const { activeElement: R, body: j } = S.ownerDocument;
    C && (R == null || R === j) && ((Y = P.current) == null || Y.focus({ preventScroll: !0 }));
  }, [d, b, r == null ? void 0 : r.type]), /* @__PURE__ */ u(Dn, { open: p, onOpenChange: x, children: [
    /* @__PURE__ */ n(
      jn,
      {
        toolName: e,
        status: r,
        isError: a,
        responseDeliveryStatus: l
      }
    ),
    /* @__PURE__ */ u(On, { children: [
      /* @__PURE__ */ n(Hn, { status: r }),
      /* @__PURE__ */ n(
        Un,
        {
          argsText: t,
          className: g(f && "opacity-60")
        }
      ),
      h && /* @__PURE__ */ n(
        qn,
        {
          addResult: i,
          resume: s,
          interrupt: c,
          approval: d,
          respondToApproval: m,
          status: r,
          onFocusCapture: (S) => {
            const C = S.currentTarget.closest(
              '[data-slot="tool-fallback-root"]'
            );
            P.current = (C == null ? void 0 : C.querySelector(
              '[data-slot="tool-fallback-trigger"]'
            )) ?? null, T.current = S.currentTarget, v.current = !0;
          },
          onBlurCapture: (S) => {
            const C = S.relatedTarget;
            (C ? S.currentTarget.contains(C) : S.currentTarget.contains(
              S.currentTarget.ownerDocument.activeElement
            )) || (v.current = !1);
          }
        }
      ),
      /* @__PURE__ */ n(Wn, { result: o })
    ] })
  ] });
}, ee = ge(
  hi
);
ee.displayName = "ToolFallback";
ee.Root = Dn;
ee.Trigger = jn;
ee.Content = On;
ee.Args = Un;
ee.Result = Wn;
ee.Error = Hn;
ee.Approval = qn;
const Dt = 200, bi = Ie("aui-tool-group-root group/tool-group w-full", {
  variants: {
    variant: {
      outline: "rounded-lg border py-3",
      ghost: "",
      muted: "border-muted-foreground/30 bg-muted/30 rounded-lg border py-3"
    }
  },
  defaultVariants: { variant: "outline" }
});
function Ue({
  className: e,
  variant: t,
  open: o,
  onOpenChange: a,
  defaultOpen: r = !1,
  children: l,
  ...i
}) {
  const s = A(null), [c, d] = N(r), m = st(s, Dt), f = o !== void 0, b = f ? o : c, h = J(
    (p) => {
      m(), f || d(p), a == null || a(p);
    },
    [m, f, a]
  );
  return /* @__PURE__ */ n(
    bt,
    {
      ref: s,
      "data-slot": "tool-group-root",
      "data-variant": t ?? "outline",
      open: b,
      onOpenChange: h,
      className: g(
        bi({ variant: t }),
        "group/tool-group-root",
        e
      ),
      style: {
        "--animation-duration": `${Dt}ms`
      },
      ...i,
      children: l
    }
  );
}
function Be({
  count: e,
  active: t = !1,
  label: o = `用了 ${e} 个工具`,
  className: a,
  ...r
}) {
  return /* @__PURE__ */ u(
    xt,
    {
      "data-slot": "tool-group-trigger",
      className: g(
        "aui-tool-group-trigger group/trigger flex origin-left items-center gap-2 text-sm transition-[color,scale] active:scale-[0.98]",
        "group-data-[variant=ghost]/tool-group-root:text-muted-foreground group-data-[variant=ghost]/tool-group-root:hover:text-foreground group-data-[variant=ghost]/tool-group-root:py-1.5",
        "group-data-[variant=outline]/tool-group-root:w-full group-data-[variant=outline]/tool-group-root:px-4",
        "group-data-[variant=muted]/tool-group-root:w-full group-data-[variant=muted]/tool-group-root:px-4",
        a
      ),
      ...r,
      children: [
        t && /* @__PURE__ */ n(
          Yt,
          {
            "data-slot": "tool-group-trigger-loader",
            className: "aui-tool-group-trigger-loader size-3 shrink-0 animate-spin [animation-duration:0.6s]"
          }
        ),
        /* @__PURE__ */ n(
          "span",
          {
            "data-slot": "tool-group-trigger-label",
            className: g(
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
          dt,
          {
            "data-slot": "tool-group-trigger-chevron",
            className: g(
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
function We({
  className: e,
  children: t,
  ...o
}) {
  return /* @__PURE__ */ n(
    vt,
    {
      "data-slot": "tool-group-content",
      className: g(
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
          className: g(
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
const xi = ({ children: e, startIndex: t, endIndex: o }) => {
  const a = o - t + 1;
  return /* @__PURE__ */ u(Ue, { children: [
    /* @__PURE__ */ n(Be, { count: a }),
    /* @__PURE__ */ n(We, { children: e })
  ] });
}, He = ge(xi);
He.displayName = "ToolGroup";
He.Root = Ue;
He.Trigger = Be;
He.Content = We;
function de({ className: e, ...t }) {
  return /* @__PURE__ */ n(
    "div",
    {
      "data-slot": "skeleton",
      className: g("animate-pulse rounded-md bg-accent", e),
      ...t
    }
  );
}
const vi = ({
  group: e,
  children: t
}) => {
  const [o, a] = N(!1);
  return /* @__PURE__ */ u(
    Ue,
    {
      variant: "ghost",
      open: o || e.counts.requiresAction > 0,
      onOpenChange: a,
      children: [
        /* @__PURE__ */ n(
          Be,
          {
            count: e.indices.length,
            active: e.status.type === "running"
          }
        ),
        /* @__PURE__ */ n(We, { children: t })
      ]
    }
  );
}, jt = (e) => !!e.thread.canResume && e.composer.type === "thread" && e.composer.isEmpty, ki = (e) => (e == null ? void 0 : e.completedAt) === void 0 ? void 0 : (e.completedAt - e.startedAt) / 1e3, Xn = po({
  reasoning: ["group-chainOfThought", "group-reasoning"],
  "tool-call": ["group-chainOfThought", "group-tool"],
  "standalone-tool-call": []
}), yi = [
  "group-chainOfThought",
  "group-task"
], Ni = (e, t) => {
  var a, r;
  const o = Xn(e, t);
  return e.type === "tool-call" && e.messages !== void 0 && o.length > 0 && !((r = (a = t == null ? void 0 : t.toolUIs) == null ? void 0 : a[e.toolName]) != null && r.length) ? yi : o;
}, Qn = {}, Ae = Pe(Qn), it = (e) => e.thread.messages.length === 0 && (!e.thread.isLoading || e.threads.isLoading), wi = (e) => e.thread.messages.length === 0 && e.thread.isLoading && !e.thread.isDisabled && !e.threads.isLoading, Ti = () => /* @__PURE__ */ u(
  "div",
  {
    "data-slot": "aui_thread-history-skeleton",
    role: "status",
    className: "animate-in fade-in fill-mode-both flex flex-col gap-y-6 [animation-delay:150ms] [animation-duration:200ms]",
    children: [
      /* @__PURE__ */ n("span", { className: "sr-only", children: "Loading conversation" }),
      /* @__PURE__ */ n(de, { className: "ml-auto h-9 w-2/5 rounded-xl motion-reduce:animate-none" }),
      /* @__PURE__ */ u("div", { className: "flex flex-col gap-y-2", children: [
        /* @__PURE__ */ n(de, { className: "h-4 w-11/12 motion-reduce:animate-none" }),
        /* @__PURE__ */ n(de, { className: "h-4 w-4/5 motion-reduce:animate-none" }),
        /* @__PURE__ */ n(de, { className: "h-4 w-3/5 motion-reduce:animate-none" })
      ] }),
      /* @__PURE__ */ n(de, { className: "ml-auto h-9 w-1/3 rounded-xl motion-reduce:animate-none" }),
      /* @__PURE__ */ u("div", { className: "flex flex-col gap-y-2", children: [
        /* @__PURE__ */ n(de, { className: "h-4 w-10/12 motion-reduce:animate-none" }),
        /* @__PURE__ */ n(de, { className: "h-4 w-2/3 motion-reduce:animate-none" })
      ] })
    ]
  }
), Ci = ({
  components: e = Qn,
  autoFocus: t = !0
}) => {
  const o = E(it);
  return /* @__PURE__ */ n(Ae.Provider, { value: e, children: /* @__PURE__ */ n(zi, { isEmpty: o, autoFocus: t }) });
}, zi = ({
  isEmpty: e,
  autoFocus: t
}) => {
  const { Welcome: o = Pi } = re(Ae);
  return /* @__PURE__ */ n(
    se.Root,
    {
      className: "aui-root aui-thread-root bg-background @container flex h-full flex-col",
      style: {
        "--thread-max-width": "44rem",
        "--composer-bg": "color-mix(in oklab, var(--color-muted) 30%, transparent)",
        "--composer-radius": "0.75rem",
        "--composer-padding": "6px"
      },
      children: /* @__PURE__ */ n(
        se.Viewport,
        {
          turnAnchor: "top",
          "data-slot": "aui_thread-viewport",
          className: "relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth",
          children: /* @__PURE__ */ u(
            "div",
            {
              className: g(
                "mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-3 pt-3",
                e && "justify-center"
              ),
              children: [
                /* @__PURE__ */ n(O, { condition: it, children: /* @__PURE__ */ n(o, {}) }),
                /* @__PURE__ */ n(O, { condition: wi, children: /* @__PURE__ */ n(Ti, {}) }),
                /* @__PURE__ */ n($i, {}),
                /* @__PURE__ */ n(
                  "div",
                  {
                    "data-slot": "aui_message-group",
                    className: "mb-10 flex flex-col gap-y-4 empty:hidden",
                    children: /* @__PURE__ */ n(se.Messages, { children: () => /* @__PURE__ */ n(Ii, {}) })
                  }
                ),
                /* @__PURE__ */ u(
                  se.ViewportFooter,
                  {
                    className: g(
                      "aui-thread-viewport-footer bg-background flex flex-col gap-3 overflow-visible pb-3",
                      !e && "sticky bottom-0 mt-auto rounded-t-(--composer-radius)"
                    ),
                    children: [
                      /* @__PURE__ */ n(Mi, {}),
                      /* @__PURE__ */ n(_r, {}),
                      /* @__PURE__ */ n(Di, { autoFocus: t }),
                      /* @__PURE__ */ n(O, { condition: (a) => it(a) && a.composer.isEmpty, children: /* @__PURE__ */ n(Fi, {}) })
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
}, Ii = () => {
  const { AssistantMessage: e = Ui } = re(Ae), t = E((r) => r.message.role), o = E((r) => r.message.composer.isEditing), a = E((r) => r.message.metadata.modality === "voice");
  return o ? /* @__PURE__ */ n(Vi, {}) : a ? /* @__PURE__ */ n(Si, {}) : t === "user" ? /* @__PURE__ */ n(Gi, {}) : /* @__PURE__ */ n(e, {});
}, Ai = () => E((e) => {
  var a, r;
  const t = ((a = e.thread.messages[e.message.index - 1]) == null ? void 0 : a.metadata.modality) === "voice", o = ((r = e.thread.messages[e.message.index + 1]) == null ? void 0 : r.metadata.modality) === "voice";
  return t ? o ? "middle" : "end" : o ? "start" : "single";
}), Ri = ({ text: e }) => /* @__PURE__ */ n("p", { className: "aui-spoken-message-text m-0", children: e }), Si = () => {
  const e = E((r) => r.message.role), t = Ai(), o = E(
    (r) => {
      var l;
      return r.message.role === "assistant" && ((l = r.message.status) == null ? void 0 : l.type) === "running";
    }
  ), a = t === "start" || t === "single";
  return /* @__PURE__ */ u(
    ae.Root,
    {
      "data-slot": "aui_spoken-message-root",
      "data-role": e,
      "data-voice-run": t,
      className: g(
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
              /* @__PURE__ */ n(_o, { className: "size-3", "aria-hidden": !0 }),
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
              /* @__PURE__ */ n("span", { className: "text-muted-foreground mt-1 shrink-0", "aria-hidden": !0, children: e === "user" ? /* @__PURE__ */ n(Zt, { className: "size-3.5" }) : /* @__PURE__ */ n(Eo, { className: "size-3.5" }) }),
              /* @__PURE__ */ n("span", { className: "sr-only", children: e === "user" ? "你说" : "助手说" }),
              /* @__PURE__ */ u("div", { className: "min-w-0 flex-1 wrap-break-word", children: [
                /* @__PURE__ */ n(ae.Parts, { components: { Text: Ri } }),
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
              /* @__PURE__ */ n(_i, {})
            ]
          }
        )
      ]
    }
  );
}, _i = () => /* @__PURE__ */ n(
  G.Root,
  {
    hideWhenRunning: !0,
    autohide: "always",
    className: "aui-spoken-action-bar text-muted-foreground flex shrink-0 gap-1",
    children: /* @__PURE__ */ n(G.Copy, { asChild: !0, children: /* @__PURE__ */ u(L, { tooltip: "复制", className: "size-6", children: [
      /* @__PURE__ */ n(O, { condition: (e) => e.message.isCopied, children: /* @__PURE__ */ n(pe, { className: "animate-in zoom-in-50 fade-in duration-200 ease-out" }) }),
      /* @__PURE__ */ n(O, { condition: (e) => !e.message.isCopied, children: /* @__PURE__ */ n(De, { className: "animate-in zoom-in-75 fade-in duration-150" }) })
    ] }) })
  }
), Ot = "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1']):not([disabled])", Ei = (e) => {
  for (let t = e.nextElementSibling; t; t = t.nextElementSibling) {
    const o = t.matches(Ot) ? t : t.querySelector(Ot);
    if (o instanceof HTMLElement) return o;
  }
  return null;
}, $i = () => {
  const e = E(
    (r) => r.thread.hasEarlier || r.thread.isLoadingEarlier
  ), t = E((r) => r.thread.isLoadingEarlier), o = A(null), a = A(null);
  return xe(() => {
    var s;
    const r = a.current, l = o.current;
    if (e || !r || r.isConnected || !l) return;
    a.current = null;
    const i = document.activeElement;
    i && i !== document.body || (s = Ei(l)) == null || s.focus();
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
        e && /* @__PURE__ */ n(se.LoadEarlier, { asChild: !0, children: /* @__PURE__ */ n(
          F,
          {
            variant: "ghost",
            size: "sm",
            "data-slot": "aui_thread-load-earlier",
            className: "aui-thread-load-earlier text-muted-foreground mb-6 self-center rounded-full",
            children: /* @__PURE__ */ n(
              "span",
              {
                className: g(t && "shimmer motion-reduce:animate-none"),
                children: t ? "在读更早的对话" : "读更早的对话"
              }
            )
          }
        ) })
      ]
    }
  );
}, Mi = () => /* @__PURE__ */ n(se.ScrollToBottom, { asChild: !0, children: /* @__PURE__ */ n(
  L,
  {
    tooltip: "回到最下面",
    variant: "outline",
    className: "aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-9 end-0 z-10 size-7 rounded-full p-0 disabled:invisible",
    children: /* @__PURE__ */ n(So, {})
  }
) }), Pi = () => /* @__PURE__ */ n("div", { className: "aui-thread-welcome-root mb-6 flex flex-col px-2", children: /* @__PURE__ */ n("p", { className: "aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-medium tracking-tight duration-200", children: "这一处哪里看不懂？" }) }), Fi = () => /* @__PURE__ */ n("div", { className: "aui-thread-welcome-suggestions flex w-full flex-col", children: /* @__PURE__ */ n(se.Suggestions, { children: () => /* @__PURE__ */ n(Li, {}) }) }), Li = () => /* @__PURE__ */ n("div", { className: "aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200", children: /* @__PURE__ */ n(Ve.Trigger, { send: !0, asChild: !0, children: /* @__PURE__ */ u(
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
        /* @__PURE__ */ n(Ve.Title, { className: "aui-thread-welcome-suggestion-text-1 text-foreground" }),
        " ",
        /* @__PURE__ */ n(Ve.Description, { className: "aui-thread-welcome-suggestion-text-2 text-muted-foreground empty:hidden" })
      ] })
    ]
  }
) }) }), Di = ({ autoFocus: e }) => /* @__PURE__ */ n(B.Root, { className: "aui-composer-root relative flex w-full flex-col", children: /* @__PURE__ */ n(B.AttachmentDropzone, { asChild: !0, children: /* @__PURE__ */ u(
  "div",
  {
    "data-slot": "aui_composer-shell",
    className: "border-foreground/10 focus-within:border-foreground/25 data-[dragging=true]:border-ring flex w-full cursor-text flex-col gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) transition-[border-color] data-[dragging=true]:border-dashed data-[dragging=true]:bg-[color-mix(in_oklab,var(--color-accent)_50%,var(--color-background))]",
    children: [
      /* @__PURE__ */ n(ur, {}),
      /* @__PURE__ */ n(
        B.Input,
        {
          placeholder: "问点什么…",
          className: "aui-composer-input caret-primary placeholder:text-muted-foreground/60 max-h-48 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base leading-6 outline-none",
          rows: 1,
          autoFocus: e,
          enterKeyHint: "send",
          "aria-label": "输入问题",
          title: "Enter 发送，Shift+Enter 换行"
        }
      ),
      /* @__PURE__ */ n(ji, {})
    ]
  }
) }) }), ji = () => {
  const { ComposerExtra: e } = re(Ae), t = E(
    (o) => o.composer.submission !== void 0 && !(o.thread.isRunning && o.thread.capabilities.cancel)
  );
  return /* @__PURE__ */ u("div", { className: "aui-composer-action-wrapper relative flex items-center justify-between", children: [
    e ? /* @__PURE__ */ u("div", { className: "aui-composer-action-start flex items-center gap-1.5", children: [
      /* @__PURE__ */ n(_t, {}),
      /* @__PURE__ */ n(e, {})
    ] }) : /* @__PURE__ */ n(_t, {}),
    /* @__PURE__ */ u("div", { className: "flex items-center gap-1.5", children: [
      /* @__PURE__ */ u(O, { condition: (o) => o.thread.capabilities.dictation, children: [
        /* @__PURE__ */ n(O, { condition: (o) => o.composer.dictation == null, children: /* @__PURE__ */ n(B.Dictate, { asChild: !0, children: /* @__PURE__ */ n(
          L,
          {
            tooltip: "语音输入",
            side: "bottom",
            type: "button",
            variant: "ghost",
            size: "icon",
            className: "aui-composer-dictate text-muted-foreground hover:text-foreground size-7 rounded-full",
            "aria-label": "开始语音输入",
            children: /* @__PURE__ */ n(Zt, { className: "aui-composer-dictate-icon size-4" })
          }
        ) }) }),
        /* @__PURE__ */ n(O, { condition: (o) => o.composer.dictation != null, children: /* @__PURE__ */ n(B.StopDictation, { asChild: !0, children: /* @__PURE__ */ n(
          L,
          {
            tooltip: "停止听写",
            side: "bottom",
            type: "button",
            variant: "ghost",
            size: "icon",
            className: "aui-composer-stop-dictation text-destructive size-7 rounded-full",
            "aria-label": "停止语音输入",
            children: /* @__PURE__ */ n(At, { className: "aui-composer-stop-dictation-icon size-3.5 animate-pulse fill-current" })
          }
        ) }) })
      ] }),
      /* @__PURE__ */ n(
        O,
        {
          condition: (o) => (!o.composer.canCancel || o.thread.voice !== void 0 && o.composer.submission === void 0) && !jt(o),
          children: /* @__PURE__ */ n(B.Send, { asChild: !0, children: /* @__PURE__ */ n(
            L,
            {
              tooltip: "发送",
              side: "bottom",
              type: "button",
              variant: "default",
              size: "icon",
              className: "aui-composer-send size-7 rounded-full",
              "aria-label": "发送",
              children: /* @__PURE__ */ n($o, { className: "aui-composer-send-icon size-4" })
            }
          ) })
        }
      ),
      /* @__PURE__ */ n(O, { condition: jt, children: /* @__PURE__ */ n(B.Resume, { asChild: !0, children: /* @__PURE__ */ n(
        L,
        {
          tooltip: "接着生成",
          side: "bottom",
          type: "button",
          variant: "default",
          size: "icon",
          className: "aui-composer-resume size-7 rounded-full",
          "aria-label": "接着生成",
          children: /* @__PURE__ */ n(Le, { className: "aui-composer-resume-icon size-4" })
        }
      ) }) }),
      /* @__PURE__ */ n(
        O,
        {
          condition: (o) => o.composer.canCancel && (o.thread.voice === void 0 || o.composer.submission !== void 0),
          children: /* @__PURE__ */ n(B.Cancel, { asChild: !0, children: /* @__PURE__ */ n(
            F,
            {
              type: "button",
              variant: "default",
              size: "icon",
              className: "aui-composer-cancel size-7 rounded-full",
              "aria-label": t ? "取消发送" : "停下",
              children: /* @__PURE__ */ n(At, { className: "aui-composer-cancel-icon size-3.5 fill-current" })
            }
          ) })
        }
      )
    ] })
  ] });
}, Oi = () => /* @__PURE__ */ n(ae.Error, { children: /* @__PURE__ */ u(zt.Root, { className: "aui-message-error-root group/error border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 data-[run-state=in-progress]:border-border data-[run-state=in-progress]:bg-muted/40 data-[run-state=in-progress]:text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-3 text-sm data-[run-state=stale]:border-amber-500/40 data-[run-state=stale]:bg-amber-500/10 data-[run-state=stale]:text-amber-800 dark:text-red-200 dark:data-[run-state=stale]:bg-amber-500/5 dark:data-[run-state=stale]:text-amber-200", children: [
  /* @__PURE__ */ n(Mo, { className: "hidden size-4 shrink-0 group-data-[run-state=stale]/error:block" }),
  /* @__PURE__ */ n(Fe, { className: "hidden size-4 shrink-0 animate-spin group-data-[run-state=in-progress]/error:block motion-reduce:animate-none" }),
  /* @__PURE__ */ n(zt.Message, { className: "aui-message-error-message line-clamp-2 min-w-0 flex-1" }),
  /* @__PURE__ */ n(G.Resume, { asChild: !0, children: /* @__PURE__ */ u(
    F,
    {
      variant: "outline",
      size: "sm",
      className: "h-7 gap-1.5 border-amber-500/40 bg-transparent hover:bg-amber-500/15 disabled:hidden dark:border-amber-400/30",
      children: [
        /* @__PURE__ */ n(Le, { className: "size-3.5" }),
        "接着生成"
      ]
    }
  ) }),
  /* @__PURE__ */ n(G.RefreshRun, { asChild: !0, children: /* @__PURE__ */ u(
    F,
    {
      variant: "ghost",
      size: "sm",
      className: "h-7 gap-1.5 disabled:hidden",
      children: [
        /* @__PURE__ */ n(ct, { className: "size-3.5" }),
        "重新回答"
      ]
    }
  ) })
] }) }), Ui = () => {
  const {
    Indicator: e,
    ToolFallback: t = ee,
    ToolGroup: o,
    ReasoningGroup: a,
    TaskGroup: r,
    MessageFooter: l
  } = re(Ae), i = r ? Ni : Xn;
  return /* @__PURE__ */ u(
    ae.Root,
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
              /* @__PURE__ */ n(ae.GroupedParts, { groupBy: i, children: ({ part: d, children: m }) => {
                switch (d.type) {
                  case "group-chainOfThought":
                    return /* @__PURE__ */ n("div", { "data-slot": "aui_chain-of-thought", children: m });
                  case "group-task":
                    return r ? /* @__PURE__ */ n(r, { group: d }) : null;
                  case "group-tool":
                    return o ? /* @__PURE__ */ n(o, { group: d, children: m }) : /* @__PURE__ */ n(vi, { group: d, children: m });
                  case "group-reasoning": {
                    if (a)
                      return /* @__PURE__ */ n(a, { group: d, children: m });
                    const f = d.status.type === "running";
                    return /* @__PURE__ */ u(Tt, { streaming: f, children: [
                      /* @__PURE__ */ n(
                        yt,
                        {
                          active: f,
                          duration: ki(d.timing)
                        }
                      ),
                      /* @__PURE__ */ n(Nt, { "aria-busy": f, children: /* @__PURE__ */ n(wt, { children: m }) })
                    ] });
                  }
                  case "text":
                    return /* @__PURE__ */ n(Pn, {});
                  case "reasoning":
                    return /* @__PURE__ */ n(he, { ...d });
                  case "tool-call":
                    return d.toolUI ?? /* @__PURE__ */ n(t, { ...d });
                  case "data":
                    return d.dataRendererUI;
                  case "file":
                    return /* @__PURE__ */ n("div", { "data-slot": "aui_assistant-message-file", className: "py-1", children: /* @__PURE__ */ n(Yn, { ...d }) });
                  case "image":
                    return /* @__PURE__ */ n("div", { "data-slot": "aui_assistant-message-image", className: "py-1", children: /* @__PURE__ */ n(K, { ...d }) });
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
              /* @__PURE__ */ n(Oi, {})
            ]
          }
        ),
        /* @__PURE__ */ u(
          "div",
          {
            "data-slot": "aui_assistant-message-footer",
            className: g("ms-2 flex items-center", "min-h-7.5 pt-1.5"),
            children: [
              /* @__PURE__ */ n(Zn, {}),
              /* @__PURE__ */ n(Bi, {})
            ]
          }
        ),
        l ? /* @__PURE__ */ n(l, {}) : null
      ]
    }
  );
}, Bi = () => /* @__PURE__ */ u(
  G.Root,
  {
    hideWhenRunning: !0,
    autohide: "not-last",
    className: "aui-assistant-action-bar-root text-muted-foreground animate-in fade-in col-start-3 row-start-2 -ms-1 flex gap-1 duration-200",
    children: [
      /* @__PURE__ */ n(G.Copy, { asChild: !0, children: /* @__PURE__ */ u(L, { tooltip: "复制", children: [
        /* @__PURE__ */ n(O, { condition: (e) => e.message.isCopied, children: /* @__PURE__ */ n(pe, { className: "animate-in zoom-in-50 fade-in duration-200 ease-out" }) }),
        /* @__PURE__ */ n(O, { condition: (e) => !e.message.isCopied, children: /* @__PURE__ */ n(De, { className: "animate-in zoom-in-75 fade-in duration-150" }) })
      ] }) }),
      /* @__PURE__ */ u(O, { condition: (e) => e.thread.capabilities.feedback, children: [
        /* @__PURE__ */ n(G.FeedbackPositive, { asChild: !0, children: /* @__PURE__ */ n(
          L,
          {
            tooltip: "有用",
            className: "data-[submitted=true]:bg-accent data-[submitted=true]:text-accent-foreground",
            children: /* @__PURE__ */ n(Lo, {})
          }
        ) }),
        /* @__PURE__ */ n(G.FeedbackNegative, { asChild: !0, children: /* @__PURE__ */ n(
          L,
          {
            tooltip: "没用",
            className: "data-[submitted=true]:bg-accent data-[submitted=true]:text-accent-foreground",
            children: /* @__PURE__ */ n(Do, {})
          }
        ) })
      ] }),
      /* @__PURE__ */ n(G.Reload, { asChild: !0, children: /* @__PURE__ */ n(L, { tooltip: "重新回答", children: /* @__PURE__ */ n(ct, {}) }) }),
      /* @__PURE__ */ u(_e.Root, { children: [
        /* @__PURE__ */ n(_e.Trigger, { asChild: !0, children: /* @__PURE__ */ n(
          L,
          {
            tooltip: "更多",
            className: "data-[state=open]:bg-accent",
            children: /* @__PURE__ */ n(jo, {})
          }
        ) }),
        /* @__PURE__ */ n(
          _e.Content,
          {
            side: "bottom",
            align: "start",
            sideOffset: 6,
            className: "aui-action-bar-more-content bg-popover text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1.5",
            children: /* @__PURE__ */ n(G.ExportMarkdown, { asChild: !0, children: /* @__PURE__ */ u(_e.Item, { className: "aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none", children: [
              /* @__PURE__ */ n(lt, { className: "size-4" }),
              "导出成 Markdown"
            ] }) })
          }
        )
      ] })
    ]
  }
), Yn = (e) => {
  const t = typeof e.mimeType == "string" && typeof e.data == "string" && e.mimeType.toLowerCase().startsWith("image/") ? Oe(e.data, e.mimeType, e.sourceType) : null;
  return t ? /* @__PURE__ */ n(
    K,
    {
      type: "image",
      image: t,
      status: e.status,
      ...typeof e.filename == "string" && { filename: e.filename }
    }
  ) : /* @__PURE__ */ n(le, { ...e });
}, Wi = (e) => /* @__PURE__ */ n("div", { "data-slot": "aui_user-message-file", className: "py-1", children: /* @__PURE__ */ n(Yn, { ...e }) }), Hi = (e) => /* @__PURE__ */ n("div", { "data-slot": "aui_user-message-image", className: "py-1", children: /* @__PURE__ */ n(K, { ...e }) }), Gi = () => /* @__PURE__ */ u(
  ae.Root,
  {
    "data-slot": "aui_user-message-root",
    className: "fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto] [&:where(>*)]:col-start-2",
    "data-role": "user",
    children: [
      /* @__PURE__ */ n(dr, {}),
      /* @__PURE__ */ u("div", { className: "aui-user-message-content-wrapper relative col-start-2 min-w-0", children: [
        /* @__PURE__ */ n("div", { className: "aui-user-message-content peer bg-muted text-foreground rounded-(--composer-radius) px-4 py-2 wrap-break-word empty:hidden", children: /* @__PURE__ */ n(
          ae.Parts,
          {
            components: { File: Wi, Image: Hi }
          }
        ) }),
        /* @__PURE__ */ n("div", { className: "aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full", children: /* @__PURE__ */ n(Ki, {}) })
      ] }),
      /* @__PURE__ */ n(
        Zn,
        {
          "data-slot": "aui_user-branch-picker",
          className: "col-span-full col-start-1 -me-1 justify-end"
        }
      )
    ]
  }
), Ki = () => /* @__PURE__ */ n(
  G.Root,
  {
    hideWhenRunning: !0,
    autohide: "not-last",
    className: "aui-user-action-bar-root flex flex-col items-end",
    children: /* @__PURE__ */ n(G.Edit, { asChild: !0, children: /* @__PURE__ */ n(L, { tooltip: "改这个问题", className: "aui-user-action-edit", children: /* @__PURE__ */ n(Oo, {}) }) })
  }
), Vi = () => /* @__PURE__ */ n(
  ae.Root,
  {
    "data-slot": "aui_edit-composer-wrapper",
    className: "flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]",
    children: /* @__PURE__ */ u(B.Root, { className: "aui-edit-composer-root border-foreground/10 focus-within:border-foreground/25 ms-auto flex w-full max-w-[85%] cursor-text flex-col rounded-(--composer-radius) border bg-(--composer-bg) transition-[border-color]", children: [
      /* @__PURE__ */ n(
        B.Input,
        {
          className: "aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none",
          autoFocus: !0
        }
      ),
      /* @__PURE__ */ u("div", { className: "aui-edit-composer-footer mx-2.5 mb-2.5 flex items-center gap-1.5 self-end", children: [
        /* @__PURE__ */ n(B.Cancel, { asChild: !0, children: /* @__PURE__ */ n(F, { variant: "ghost", size: "sm", className: "h-8 px-3", children: "取消" }) }),
        /* @__PURE__ */ n(B.Send, { asChild: !0, children: /* @__PURE__ */ n(F, { size: "sm", className: "h-8 px-3", children: "重新问" }) })
      ] })
    ] })
  }
), Zn = ({
  className: e,
  ...t
}) => /* @__PURE__ */ u(
  we.Root,
  {
    hideWhenSingleBranch: !0,
    className: g(
      "aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs",
      e
    ),
    ...t,
    children: [
      /* @__PURE__ */ n(we.Previous, { asChild: !0, children: /* @__PURE__ */ n(L, { tooltip: "上一个版本", children: /* @__PURE__ */ n(Po, {}) }) }),
      /* @__PURE__ */ u("span", { className: "aui-branch-picker-state font-medium", children: [
        /* @__PURE__ */ n(we.Number, {}),
        " / ",
        /* @__PURE__ */ n(we.Count, {})
      ] }),
      /* @__PURE__ */ n(we.Next, { asChild: !0, children: /* @__PURE__ */ n(L, { tooltip: "下一个版本", children: /* @__PURE__ */ n(Fo, {}) }) })
    ]
  }
);
function qi(e, t, o) {
  return Number.isNaN(e) ? t : Math.min(o, Math.max(t, e));
}
function Xi({
  items: e,
  revision: t,
  title: o = "计划",
  description: a,
  maxVisible: r,
  className: l,
  ...i
}) {
  const s = e.filter((x) => x.status === "done").length, c = e.filter((x) => x.status !== "cancelled").length, d = Math.floor(
    qi(r ?? e.length, 0, e.length)
  ), [m, f] = N(!1), b = lo(), h = e.filter(
    (x, k) => k >= d && x.status !== "active" && x.status !== "failed"
  ), p = r !== void 0 && h.length > 0;
  return /* @__PURE__ */ u(
    "div",
    {
      "data-slot": "todo-list",
      className: g("flex w-full max-w-sm flex-col gap-3", l),
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
              className: g(
                je,
                "text-muted-foreground shrink-0 whitespace-nowrap tabular-nums"
              ),
              children: t === void 0 ? `${s}/${c}` : `${s}/${c} · 第 ${t} 版`
            }
          )
        ] }),
        /* @__PURE__ */ n("ul", { id: b, className: "flex flex-col gap-1", children: e.map((x, k) => {
          const w = p && k >= d && x.status !== "active" && x.status !== "failed", v = "fade-in slide-in-from-bottom-1 animate-in fill-mode-both flex items-start gap-2.5 py-0.5 text-[13.5px] duration-300 motion-reduce:animate-none", T = /* @__PURE__ */ u(fe, { children: [
            /* @__PURE__ */ n(
              "span",
              {
                "aria-hidden": !0,
                className: "flex size-4 h-5 shrink-0 items-center justify-center",
                children: x.status === "done" ? /* @__PURE__ */ n("span", { className: "border-foreground/20 bg-foreground/[0.06] flex size-3.5 items-center justify-center rounded-[5px] border", children: /* @__PURE__ */ n(pe, { className: "text-muted-foreground size-2.5" }) }) : x.status === "failed" ? /* @__PURE__ */ n("span", { className: "flex size-3.5 items-center justify-center rounded-[5px] border border-red-600/25 bg-red-600/[0.08] dark:border-red-400/25 dark:bg-red-400/[0.08]", children: /* @__PURE__ */ n(ze, { className: "size-2.5 text-red-600 dark:text-red-400" }) }) : x.status === "cancelled" ? /* @__PURE__ */ n("span", { className: "border-foreground/15 text-muted-foreground flex size-3.5 items-center justify-center rounded-[5px] border", children: /* @__PURE__ */ n(Uo, { className: "size-2.5" }) }) : x.status === "active" ? /* @__PURE__ */ n(Fe, { className: "size-3.5 animate-spin text-blue-500 motion-reduce:animate-none dark:text-blue-400" }) : /* @__PURE__ */ n("span", { className: "border-foreground/15 size-3.5 rounded-[5px] border" })
              }
            ),
            /* @__PURE__ */ n("span", { className: "sr-only", children: x.status }),
            /* @__PURE__ */ u("div", { className: "min-w-0 flex-1 leading-5 break-words", children: [
              /* @__PURE__ */ n(
                "span",
                {
                  className: g(
                    x.status === "done" && "text-muted-foreground line-through decoration-[1.5px]",
                    x.status === "active" && "text-foreground/90",
                    x.status === "pending" && "text-muted-foreground",
                    x.status === "failed" && "text-red-600 dark:text-red-400",
                    x.status === "cancelled" && "text-muted-foreground line-through decoration-[1.5px]"
                  ),
                  children: x.text
                }
              ),
              x.status === "failed" ? x.reason ? /* @__PURE__ */ n("p", { className: "text-muted-foreground text-xs leading-4 break-words", children: x.reason }) : null : x.status !== "cancelled" && x.description ? /* @__PURE__ */ n("p", { className: "text-muted-foreground text-xs leading-4 break-words", children: x.description }) : null
            ] })
          ] });
          return w && !m ? null : /* @__PURE__ */ n(
            "li",
            {
              "data-status": x.status,
              className: v,
              children: T
            },
            x.id
          );
        }) }),
        p ? /* @__PURE__ */ n(
          "button",
          {
            type: "button",
            "aria-expanded": m,
            "aria-controls": b,
            onClick: () => f((x) => !x),
            className: g(
              pr,
              "self-start px-2 py-1 text-xs font-medium"
            ),
            children: m ? "收起" : `还有 ${h.length} 项`
          }
        ) : null
      ]
    }
  );
}
function Qi({
  state: e,
  label: t,
  elapsed: o,
  trailing: a,
  className: r,
  ...l
}) {
  return /* @__PURE__ */ u(
    "span",
    {
      "data-slot": "agent-status",
      className: g(
        gn,
        "flex items-center gap-2.5 rounded-full py-1.5 ps-3.5 pe-1.5",
        r
      ),
      ...l,
      children: [
        e === "done" ? /* @__PURE__ */ n(pe, { "aria-hidden": !0, className: "size-3 shrink-0 text-emerald-500" }) : e === "failed" ? /* @__PURE__ */ n(ze, { "aria-hidden": !0, className: "text-destructive size-3 shrink-0" }) : /* @__PURE__ */ n(
          "span",
          {
            "aria-hidden": !0,
            className: g(
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
        o !== void 0 && e !== "done" && e !== "failed" && /* @__PURE__ */ n("span", { className: g(je, "text-muted-foreground tabular-nums"), children: o }),
        /* @__PURE__ */ n(
          "span",
          {
            "aria-hidden": !0,
            "data-slot": "agent-status-trailing",
            className: "text-muted-foreground flex size-6 items-center justify-center rounded-full",
            children: a !== void 0 ? a : e === "done" || e === "failed" ? /* @__PURE__ */ n(Bo, { className: "size-3" }) : /* @__PURE__ */ n(Vt, { className: "size-3" })
          }
        )
      ]
    }
  );
}
const Jn = Pe(null), Yi = {
  allow_once: "allow-once",
  allow_always: "allow-always",
  reject_once: "reject-once",
  reject_always: "reject-always"
};
function eo(e, t) {
  switch (e) {
    case "read":
      return en;
    case "search":
      return la;
    case "fetch":
      return /页/.test(t) ? ia : sa;
    case "edit":
      return ra;
    case "execute":
      return aa;
    case "think":
      return oa;
    default:
      return na;
  }
}
function Ut(e) {
  if (!e || e.completedAt === void 0) return "";
  const t = (e.completedAt - e.startedAt) / 1e3;
  return `${t < 10 ? t.toFixed(1) : Math.round(t)}s`;
}
function Zi(e) {
  var h;
  const t = e.artifact || {}, o = e.timing, a = re(Jn);
  co((a == null ? void 0 : a.subscribe) ?? (() => () => {
  }), (a == null ? void 0 : a.snapshot) ?? (() => 0));
  const r = a == null ? void 0 : a.get(e.toolCallId), l = t.title || e.toolName;
  if (r) {
    const p = {
      id: e.toolCallId,
      prompt: l,
      options: r.request.options.map((k) => ({ id: k.optionId, kind: Yi[k.kind] || k.kind, label: k.name }))
    }, x = async (k) => {
      const w = r.request.options, v = k.optionId ? w.find((T) => T.optionId === k.optionId) : w.find((T) => k.approved ? T.kind.startsWith("allow") : T.kind.startsWith("reject"));
      r.resolve(v ? { outcome: { outcome: "selected", optionId: v.optionId } } : { outcome: { outcome: "cancelled" } });
    };
    return /* @__PURE__ */ n(
      ee,
      {
        ...e,
        toolName: l,
        status: { type: "requires-action", reason: "interrupt" },
        argsText: e.argsText && e.argsText !== "{}" ? e.argsText : "",
        approval: p,
        respondToApproval: x
      }
    );
  }
  const i = eo(t.kind || "", l), s = t.status || "pending", c = t.output || "", d = c.split(`
`).find((p) => p.trim()) || "", m = (h = t.locations) != null && h.length ? t.locations.join("、") : "", f = e.argsText && e.argsText !== "{}" ? e.argsText : "", b = [c, m, f].filter(Boolean).join(`

`);
  return /* @__PURE__ */ u("details", { className: "reader-ask-tool", "data-status": s, children: [
    /* @__PURE__ */ u("summary", { title: l, children: [
      /* @__PURE__ */ n(i, { size: 13, className: "reader-ask-tool-icon", "aria-hidden": !0 }),
      /* @__PURE__ */ n("span", { className: "reader-ask-tool-title", children: /* @__PURE__ */ n($t, { text: l }) }),
      d && d !== l ? /* @__PURE__ */ n("span", { className: "reader-ask-tool-sum", children: /* @__PURE__ */ n($t, { text: d }) }) : null,
      /* @__PURE__ */ n("span", { className: "reader-ask-tool-state", "aria-label": s === "failed" ? "失败" : s === "completed" ? "完成" : "进行中", children: s === "failed" ? /* @__PURE__ */ n(Jt, { size: 12, "aria-hidden": !0 }) : s === "completed" ? /* @__PURE__ */ n(Wo, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ n(Ho, { size: 12, className: "reader-ask-spin", "aria-hidden": !0 }) }),
      Ut(o) ? /* @__PURE__ */ n("span", { className: "reader-ask-tool-time", children: Ut(o) }) : null
    ] }),
    b ? /* @__PURE__ */ n("pre", { className: "reader-ask-tool-detail", children: b }) : null
  ] });
}
function Ji({ group: e, children: t }) {
  var f;
  const o = E((b) => b.message.parts), [a, r] = N(!1), l = e.indices.map((b) => o[b]).filter((b) => (b == null ? void 0 : b.type) === "tool-call"), i = e.status.type === "running", s = i ? l.find((b) => {
    var h, p;
    return ((h = b.artifact) == null ? void 0 : h.status) !== "completed" && ((p = b.artifact) == null ? void 0 : p.status) !== "failed";
  }) || l[l.length - 1] : null, c = [...new Map(l.map((b) => {
    var x, k;
    const h = ((x = b.artifact) == null ? void 0 : x.title) || b.toolName || "", p = eo(((k = b.artifact) == null ? void 0 : k.kind) || "", h);
    return [p, p];
  })).values()].slice(0, 4);
  if (l.length <= 1) return /* @__PURE__ */ n(fe, { children: t });
  const d = ((f = s == null ? void 0 : s.artifact) == null ? void 0 : f.title) || (s == null ? void 0 : s.toolName) || "", m = /* @__PURE__ */ u("span", { className: "reader-ask-toolgroup", title: `用了 ${l.length} 个工具`, children: [
    c.map((b, h) => /* @__PURE__ */ n(b, { size: 13, "aria-hidden": !0 }, h)),
    d ? /* @__PURE__ */ n("span", { className: "reader-ask-toolgroup-text", children: d }) : null,
    l.length > 1 ? /* @__PURE__ */ u("span", { className: "reader-ask-toolgroup-count", children: [
      "×",
      l.length
    ] }) : null
  ] });
  return /* @__PURE__ */ u(Ue, { variant: "ghost", open: a || e.counts.requiresAction > 0, onOpenChange: r, children: [
    /* @__PURE__ */ n(Be, { count: l.length, active: i, label: m }),
    /* @__PURE__ */ n(We, { children: t })
  ] });
}
const es = { pending: "pending", in_progress: "active", completed: "done" };
function ts({ data: e }) {
  const t = e.entries.map((o, a) => ({ id: `${a}`, text: o.content, status: es[o.status] || "pending" }));
  return /* @__PURE__ */ n(Xi, { className: "reader-ask-plan", items: t, title: "计划", maxVisible: 6 });
}
function ns({ data: e }) {
  const t = e.state === "idle" || e.state === "done" || e.state === "completed" ? "done" : e.state === "failed" || e.state === "error" ? "failed" : e.state === "waiting" || e.state === "paused" ? "waiting" : "working";
  return /* @__PURE__ */ n("div", { className: "reader-ask-subagent", children: /* @__PURE__ */ n(Qi, { state: t, trailing: null, label: e.description ? `${e.title} · ${e.description}` : e.title }) });
}
const os = 1e4;
function as() {
  const [e, t] = N(!1);
  return M(() => {
    const o = window.setTimeout(() => t(!0), os);
    return () => window.clearTimeout(o);
  }, []), /* @__PURE__ */ u("div", { className: "reader-ask-waiting", role: "status", children: [
    /* @__PURE__ */ n("span", { className: "reader-ask-dot", "aria-hidden": !0 }),
    e ? "还在等 agent 回应……" : "在想…"
  ] });
}
const Bt = "image/png,image/jpeg,image/webp,image/gif", rs = 4 * 1024 * 1024;
class is extends ho {
  constructor() {
    super(...arguments);
    ce(this, "accept", Bt);
  }
  async add(o) {
    if (!Bt.split(",").includes(o.file.type)) throw new Error("只能贴 PNG、JPEG、WebP、GIF 图片");
    if (o.file.size > rs) throw new Error("图片太大（超过 4MB），先压一下再贴");
    return super.add(o);
  }
}
const ss = {
  model: ea,
  input: Jo,
  output: Zo,
  cacheRead: Yo,
  cacheWrite: Qo,
  context: Xo,
  cost: qo,
  speed: Vo,
  firstToken: Ko,
  elapsed: Go
};
function ls(e) {
  return function() {
    const o = E((r) => {
      var l;
      return (l = r.message.metadata) == null ? void 0 : l.custom;
    });
    if (!(o != null && o.turn)) return null;
    const a = La(o.turn, o.endedAt ?? null, e());
    return a.length ? /* @__PURE__ */ n("div", { className: "reader-ask-footer", children: a.map((r) => {
      const l = ss[r.key];
      return /* @__PURE__ */ u("span", { className: "reader-ask-footer-item", "data-key": r.key, title: r.title, children: [
        /* @__PURE__ */ n(l, { size: 11, "aria-hidden": !0 }),
        r.text
      ] }, r.key);
    }) }) : null;
  };
}
const cs = [
  { icon: en, text: "讲讲这段", prompt: "用中文讲讲这一段在说什么。" },
  { icon: ta, text: "式子怎么来的", prompt: "这里的式子是怎么推出来的？一步一步写。" },
  { icon: tn, text: "译文准不准", prompt: "对照原文看看这段译文准不准，哪里要改。" }
];
function ds(e) {
  return function() {
    return /* @__PURE__ */ n("div", { className: "reader-ask-starters", children: cs.map(({ icon: o, text: a, prompt: r }) => /* @__PURE__ */ u(Z, { className: "reader-ask-starter", title: r, onClick: () => e(r), children: [
      /* @__PURE__ */ n(o, { size: 13, "aria-hidden": !0 }),
      a
    ] }, a)) });
  };
}
function us(e) {
  return e.replace(/^RetainPDF\s*/, "") || e;
}
function ms({ agents: e }) {
  const t = (e || []).filter((r) => r.available === !1 && r.install), [o, a] = N("");
  return t.length ? /* @__PURE__ */ u("details", { className: "reader-ask-install", children: [
    /* @__PURE__ */ n("summary", { className: "reader-ask-close", "aria-label": "还能接的本机 agent", title: `还能接本机的 ${t.map((r) => r.name).join("、")}（要先装）`, children: /* @__PURE__ */ n(ha, { size: 14, "aria-hidden": !0 }) }),
    /* @__PURE__ */ n("ul", { children: t.map((r) => /* @__PURE__ */ u("li", { children: [
      /* @__PURE__ */ n("span", { children: r.name }),
      /* @__PURE__ */ n("code", { title: r.install, children: r.install }),
      /* @__PURE__ */ n(
        Z,
        {
          className: "reader-ask-close",
          "aria-label": `复制「${r.name}」的安装命令`,
          title: o === r.id ? "已复制" : "复制安装命令，在终端里跑一次",
          onClick: async () => {
            await vo(r.install || "") && a(r.id);
          },
          children: /* @__PURE__ */ n(ba, { size: 13, "aria-hidden": !0 })
        }
      )
    ] }, r.id)) })
  ] }) : null;
}
function fs({ anchor: e, agents: t, agentId: o, onAgent: a, mode: r, onMode: l, onShowAnchor: i, onDelete: s, onClose: c }) {
  var m;
  const d = [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · ");
  return /* @__PURE__ */ u("header", { className: "reader-ask-head", onDoubleClick: (f) => {
    f.target.closest("button, select, summary, .ui-select") || l(r === "full" ? "float" : "full");
  }, children: [
    /* @__PURE__ */ n(ca, { size: 15, className: "reader-ask-logo", "aria-label": "提问" }),
    /* @__PURE__ */ u(Z, { className: "reader-ask-where", title: `回到问的那一处：${d}`, onClick: i, children: [
      /* @__PURE__ */ n(da, { size: 11, "aria-hidden": !0 }),
      e.page
    ] }),
    /* @__PURE__ */ n(
      Sa,
      {
        size: "sm",
        className: "reader-ask-agent",
        "aria-label": "用哪个 agent",
        title: ((m = t == null ? void 0 : t.find((f) => f.id === o)) == null ? void 0 : m.name) || "",
        value: o,
        onChange: (f) => a(f.target.value),
        disabled: !(t != null && t.length),
        children: (t || []).map((f) => /* @__PURE__ */ u("option", { value: f.id, disabled: f.available === !1, title: f.reason || f.description || "", children: [
          us(f.name),
          f.available === !1 ? "（没装）" : ""
        ] }, f.id))
      }
    ),
    /* @__PURE__ */ n(ms, { agents: t }),
    /* @__PURE__ */ n("span", { className: "reader-ask-head-gap" }),
    /* @__PURE__ */ n(
      Z,
      {
        className: "reader-ask-close",
        "aria-label": r === "dock" ? "改回浮动" : "贴到右边",
        title: r === "dock" ? "改回浮动" : "贴到右边",
        onClick: () => l(r === "dock" ? "float" : "dock"),
        children: r === "dock" ? /* @__PURE__ */ n(ua, { size: 14, "aria-hidden": !0 }) : /* @__PURE__ */ n(ma, { size: 14, "aria-hidden": !0 })
      }
    ),
    /* @__PURE__ */ n(
      Z,
      {
        className: "reader-ask-close",
        "aria-label": r === "full" ? "还原" : "放大",
        title: r === "full" ? "还原（双击标题栏）" : "放大（双击标题栏）",
        onClick: () => l(r === "full" ? "float" : "full"),
        children: r === "full" ? /* @__PURE__ */ n(fa, { size: 14, "aria-hidden": !0 }) : /* @__PURE__ */ n(ga, { size: 14, "aria-hidden": !0 })
      }
    ),
    s ? /* @__PURE__ */ n(Z, { className: "reader-ask-close", "aria-label": "删掉这次提问", title: "删掉这次提问（书页上的「?」也去掉）", onClick: s, children: /* @__PURE__ */ n(pa, { size: 14, "aria-hidden": !0 }) }) : null,
    /* @__PURE__ */ n(Z, { className: "reader-ask-close", "aria-label": "关掉", title: "关掉（Esc）", onClick: c, children: /* @__PURE__ */ n(Jt, { size: 15, "aria-hidden": !0 }) })
  ] });
}
const gs = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
function ps(e) {
  const t = [];
  let o = 0;
  for (const a of e.matchAll(gs)) {
    const r = a.index ?? 0;
    r > o && t.push({ type: "text", value: e.slice(o, r) });
    const l = (a[1] ?? a[2] ?? a[3] ?? a[4] ?? "").trim();
    t.push(l ? { type: "math", value: l } : { type: "text", value: a[0] }), o = r + a[0].length;
  }
  return o < e.length && t.push({ type: "text", value: e.slice(o) }), t;
}
function hs({ text: e }) {
  const t = ue(() => ps(e), [e]);
  return /* @__PURE__ */ n(fe, { children: t.map((o, a) => {
    if (o.type === "text") return /* @__PURE__ */ n("span", { children: o.value }, a);
    const r = _a.renderToString(o.value, { throwOnError: !1, displayMode: !1, output: "html" });
    return /* @__PURE__ */ n("span", { className: "reader-ask-quote-math", dangerouslySetInnerHTML: { __html: r } }, a);
  }) });
}
function bs({ anchor: e }) {
  const t = !e.selection && !!(e.sourceText && e.translatedText), [o, a] = N(e.pane === "translated" ? "translated" : "source"), [r, l] = N(!1), i = e.selection || (t ? o === "translated" ? e.translatedText : e.sourceText : e.sourceText || e.translatedText);
  return i ? /* @__PURE__ */ u("div", { className: "reader-ask-quote", "data-open": r ? "true" : "false", children: [
    /* @__PURE__ */ n("div", { className: "reader-ask-quote-text", children: /* @__PURE__ */ n(hs, { text: i }) }),
    /* @__PURE__ */ u("div", { className: "reader-ask-quote-tools", children: [
      t ? /* @__PURE__ */ n(
        Z,
        {
          className: "reader-ask-close",
          "aria-label": o === "source" ? "看译文" : "看原文",
          title: o === "source" ? "看译文" : "看原文",
          "data-active": o === "translated" ? "true" : "false",
          onClick: () => a(o === "source" ? "translated" : "source"),
          children: /* @__PURE__ */ n(tn, { size: 13, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ n(Z, { className: "reader-ask-close reader-ask-quote-toggle", "aria-label": r ? "收起" : "展开", title: r ? "收起" : "展开", "aria-expanded": r, onClick: () => l(!r), children: /* @__PURE__ */ n(xa, { size: 14, "aria-hidden": !0 }) })
    ] })
  ] }) : null;
}
const Wt = "retainpdf-katex-css";
function xs() {
  M(() => {
    if (typeof document > "u" || document.getElementById(Wt)) return;
    const e = ko();
    if (!e) return;
    const t = document.createElement("link");
    t.id = Wt, t.rel = "stylesheet", t.href = e, document.head.appendChild(t);
  }, []);
}
const vs = Gt({ name: "plan", render: ts }), ks = Gt({ name: "subagent", render: ns }), Ht = 64, ys = 440;
function to() {
  return { width: globalThis.innerWidth || 1200, height: globalThis.innerHeight || 800 };
}
function Ns() {
  const { width: e, height: t } = to(), o = Math.min(500, e - 32), a = Math.min(640, t - 120);
  return { x: Math.max(16, e - o - 24), y: 72, width: o, height: a };
}
function ws(e, t, o) {
  const { width: a, height: r } = to();
  if (e === "dock") {
    const l = Math.min(o, a - 16);
    return { x: a - l, y: Ht, width: l, height: r - Ht };
  }
  return e === "full" ? { x: 16, y: 16, width: a - 32, height: r - 32 } : t;
}
function Hs({ port: e, jobId: t, bookTitle: o, anchor: a, onClose: r, onShowAnchor: l, initialMessages: i, onTurnDone: s, onDelete: c, onJumpToPage: d, pageCount: m = 0 }) {
  xs();
  const [f, b] = N(null), [h, p] = N(""), [x, k] = N(""), w = A({ agentId: h, anchor: a });
  w.current = { agentId: h, anchor: a }, M(() => {
    let _ = !1;
    return e.listAgents().then(
      (I) => {
        _ || (b(I), p((D) => {
          var U;
          return D || ((U = I.find((q) => q.available !== !1)) == null ? void 0 : U.id) || "";
        }));
      },
      (I) => !_ && k(I instanceof Error ? I.message : String(I))
    ), () => {
      _ = !0;
    };
  }, [e]);
  const v = ue(() => new Ha(), []), T = ue(
    () => Ka({
      port: e,
      jobId: t,
      bookTitle: o,
      permissions: v,
      getAgentId: () => w.current.agentId,
      getAnchor: () => w.current.anchor
    }),
    [e, t, o, v]
  );
  M(() => () => T.close(), [T]);
  const [P] = N(() => Oa(i || [])), S = ue(() => new is(), []), C = bo(T.adapter, { initialMessages: P, adapters: { attachments: S } }), R = A(s);
  R.current = s, M(() => {
    let _ = !1;
    return C.thread.subscribe(() => {
      var D;
      const I = C.thread.getState();
      if (_ && !I.isRunning) {
        const U = ln(I.messages);
        U.length && ((D = R.current) == null || D.call(R, U, w.current.agentId));
      }
      _ = I.isRunning;
    });
  }, [C]);
  const j = () => {
    var _;
    return ((_ = f == null ? void 0 : f.find((I) => I.id === w.current.agentId)) == null ? void 0 : _.name) || "";
  }, Y = (_) => C.thread.append({ role: "user", content: [{ type: "text", text: _ }] }), te = ue(
    () => ({ ToolFallback: Zi, ToolGroup: Ji, Indicator: as, Welcome: ds(Y), MessageFooter: ls(j) }),
    [f, C]
    // eslint-disable-line react-hooks/exhaustive-deps
  ), V = ue(() => d ? { pageCount: m, jump: d } : null, [d, m]);
  M(() => {
    const _ = (I) => {
      var U, q;
      if (I.key !== "Escape") return;
      const D = (q = (U = I.target) == null ? void 0 : U.closest) == null ? void 0 : q.call(U, "textarea, input, select");
      D && `${D.value || ""}`.trim() || (I.preventDefault(), r());
    };
    return window.addEventListener("keydown", _), () => window.removeEventListener("keydown", _);
  }, [r]);
  const [z, H] = N("float"), [Ge, ne] = N(Ns), [ke, ye] = N(ys), [, ie] = N(0);
  M(() => {
    const _ = () => ie((I) => I + 1);
    return window.addEventListener("resize", _), () => window.removeEventListener("resize", _);
  }, []);
  const W = ws(z, Ge, ke);
  return /* @__PURE__ */ n(
    uo,
    {
      className: "reader-ask-window",
      position: { x: W.x, y: W.y },
      size: { width: W.width, height: W.height },
      minWidth: 320,
      minHeight: 280,
      bounds: "window",
      dragHandleClassName: "reader-ask-head",
      cancel: ".reader-ask-head button, .reader-ask-head select, .reader-ask-head summary, .reader-ask-head .ui-select, .reader-ask-install ul",
      disableDragging: z !== "float",
      enableResizing: z === "full" ? !1 : z === "dock" ? { left: !0 } : !0,
      onDragStop: (_, I) => ne((D) => ({ ...D, x: I.x, y: I.y })),
      onResizeStop: (_, I, D, U, q) => {
        z === "dock" ? ye(D.offsetWidth) : ne({ x: q.x, y: q.y, width: D.offsetWidth, height: D.offsetHeight });
      },
      children: /* @__PURE__ */ u("section", { className: "reader-ask", role: "dialog", "aria-label": "提问", "data-mode": z, children: [
        /* @__PURE__ */ n(
          fs,
          {
            anchor: a,
            agents: f,
            agentId: h,
            onAgent: p,
            mode: z,
            onMode: H,
            onShowAnchor: l,
            onDelete: c,
            onClose: r
          }
        ),
        /* @__PURE__ */ u(ht.Provider, { value: V, children: [
          /* @__PURE__ */ n(bs, { anchor: a }),
          x ? /* @__PURE__ */ u("p", { className: "reader-ask-error", children: [
            "列不出能用的 agent：",
            x
          ] }) : null,
          /* @__PURE__ */ n(Jn.Provider, { value: v, children: /* @__PURE__ */ u(xo, { runtime: C, children: [
            /* @__PURE__ */ n(vs, {}),
            /* @__PURE__ */ n(ks, {}),
            /* @__PURE__ */ n("div", { className: "reader-ask-thread", children: /* @__PURE__ */ n(Ci, { components: te, autoFocus: !0 }) })
          ] }) })
        ] })
      ] })
    }
  );
}
export {
  rs as ASK_IMAGE_MAX_BYTES,
  Bt as ASK_IMAGE_TYPES,
  os as ASK_SLOW_HINT_MS,
  Hs as default
};
//# sourceMappingURL=ReaderAskWindow-CsgnsYH_.js.map
