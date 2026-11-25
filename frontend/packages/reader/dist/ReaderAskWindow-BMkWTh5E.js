var Gn = Object.defineProperty;
var Bn = (e, t, n) => t in e ? Gn(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var ye = (e, t, n) => Bn(e, typeof t != "symbol" ? t + "" : t, n);
import { jsx as l, jsxs as I, Fragment as Rt } from "react/jsx-runtime";
import * as v from "react";
import { useLayoutEffect as _e, useEffect as ce, forwardRef as Ee, useState as F, useRef as H, useCallback as Le, useContext as ot, createContext as At, memo as Hn, useImperativeHandle as Kn, useId as Yn, useMemo as He, useSyncExternalStore as qn } from "react";
import { Rnd as Xn } from "react-rnd";
import { useScrollLock as Qn, useToolCallElapsed as Jn, useAuiState as Fe, toolApprovalAcceptsText as Zn, useLocalRuntime as eo, AssistantRuntimeProvider as to, ThreadPrimitive as we, ComposerPrimitive as Me, MessagePrimitive as De } from "@assistant-ui/react";
import { Streamdown as no } from "streamdown";
import { createMathPlugin as oo } from "@streamdown/math";
import { BrainIcon as ro, ChevronDownIcon as _t, AlertCircleIcon as so, XCircleIcon as Pt, CheckIcon as Ve, LoaderIcon as ao, CircleMinusIcon as io, XIcon as Et, MinusIcon as lo, Loader2Icon as co, RotateCcwIcon as uo, PauseIcon as fo, Trash2 as mo, X as po, ArrowUp as go, Square as bo, Copy as ho } from "lucide-react";
import { Textarea as xo, Button as Ne, Select as ko } from "@retainpdf/ui";
import { b as yo, c as wo } from "./ReaderApp-CJ3Qr6dU.js";
import * as vo from "react-dom";
function zt(e) {
  return { parts: [], usage: {}, startedAt: e, firstTokenAt: null, lastTokenAt: null, chars: 0, chunks: 0 };
}
function $t(e) {
  return e.type === "text" ? e.text : e.type === "resource_link" ? e.title || e.name || e.uri : "";
}
function Co(e) {
  return (e || []).map((t) => t.type === "content" ? $t(t.content) : t.type === "diff" ? `改了 ${t.path}` : "").filter(Boolean).join(`
`);
}
function No(e) {
  return (e || []).map((t) => t.line != null ? `${t.path}:${t.line}` : t.path);
}
function So(e) {
  return typeof e == "number" && Number.isFinite(e) ? e : void 0;
}
function Qe(e) {
  var f;
  const t = e, n = typeof (t == null ? void 0 : t["_claude/model"]) == "string" ? t["_claude/model"] : "", o = ((f = t == null ? void 0 : t.retainpdf) == null ? void 0 : f.usage) ?? (t == null ? void 0 : t.usage);
  if (!o || typeof o != "object") return n ? { model: n } : {};
  const r = (...g) => {
    for (const m of g) {
      const b = So(o[m]);
      if (b !== void 0) return b;
    }
  }, a = {}, s = r("inputTokens", "input_tokens", "promptTokens", "prompt_tokens"), i = r("outputTokens", "output_tokens", "completionTokens", "completion_tokens"), d = r("cachedInputTokens", "cachedReadTokens", "cache_read_tokens", "cache_read_input_tokens", "cached_tokens"), c = r("cacheWriteTokens", "cachedWriteTokens", "cache_write_tokens", "cache_creation_input_tokens"), u = r("reasoningTokens", "reasoning_tokens", "thoughtTokens");
  return s !== void 0 && (a.inputTokens = s), i !== void 0 && (a.outputTokens = i), d !== void 0 && (a.cachedInputTokens = d), u !== void 0 && (a.reasoningTokens = u), c !== void 0 && (a.cacheWriteTokens = c), typeof o.model == "string" && o.model ? a.model = o.model : n && (a.model = n), a;
}
function To(e, t, n) {
  const o = e[e.length - 1];
  return o && o.type === t ? [...e.slice(0, -1), { type: t, text: o.text + n }] : [...e, { type: t, text: n }];
}
function Io(e, t, n) {
  var o;
  switch (t.sessionUpdate) {
    case "agent_message_chunk":
    case "agent_thought_chunk": {
      const r = $t(t.content);
      if (!r) return e;
      const a = t.sessionUpdate === "agent_message_chunk" ? "text" : "reasoning";
      return {
        ...e,
        parts: To(e.parts, a, r),
        chars: e.chars + r.length,
        chunks: (e.chunks || 0) + 1,
        firstTokenAt: e.firstTokenAt ?? n,
        lastTokenAt: n
      };
    }
    case "tool_call":
    case "tool_call_update": {
      const r = e.parts.findIndex((g) => g.type === "tool-call" && g.toolCallId === t.toolCallId), a = r >= 0 ? e.parts[r] : null, s = t.status || (a == null ? void 0 : a.artifact.status) || "pending", i = t.rawInput !== void 0 ? t.rawInput : a == null ? void 0 : a.args, d = i && typeof i == "object" ? i : {}, c = t.content != null ? Co(t.content) : (a == null ? void 0 : a.artifact.output) || "", u = {
        type: "tool-call",
        toolCallId: t.toolCallId,
        toolName: t.name || (a == null ? void 0 : a.toolName) || t.kind || "tool",
        args: d,
        argsText: JSON.stringify(d),
        result: t.rawOutput !== void 0 ? t.rawOutput : a == null ? void 0 : a.result,
        isError: s === "failed",
        artifact: {
          title: t.title || (a == null ? void 0 : a.artifact.title) || t.name || "工具",
          kind: t.kind || (a == null ? void 0 : a.artifact.kind) || "other",
          status: s,
          locations: t.locations != null ? No(t.locations) : (a == null ? void 0 : a.artifact.locations) || [],
          output: c
        }
      }, f = r >= 0 ? e.parts.map((g, m) => m === r ? u : g) : [...e.parts, u];
      return { ...e, parts: f };
    }
    case "plan": {
      const r = e.parts.findIndex((s) => s.type === "data" && s.name === "plan"), a = { type: "data", name: "plan", data: { entries: t.entries } };
      return { ...e, parts: r >= 0 ? e.parts.map((s, i) => i === r ? a : s) : [...e.parts, a] };
    }
    case "subagent_update": {
      const r = e.parts.findIndex((d) => d.type === "data" && d.name === "subagent" && d.data.id === t.sessionId), a = r >= 0 ? e.parts[r].data : null, s = ((o = t.state) == null ? void 0 : o.state) || (a == null ? void 0 : a.state) || "running", i = {
        type: "data",
        name: "subagent",
        data: {
          id: t.sessionId,
          title: t.title || (a == null ? void 0 : a.title) || "子 agent",
          description: t.description || (a == null ? void 0 : a.description) || "",
          state: s
        }
      };
      return { ...e, parts: r >= 0 ? e.parts.map((d, c) => c === r ? i : d) : [...e.parts, i] };
    }
    case "usage_update": {
      const r = { ...e.usage, contextUsed: t.used, contextSize: t.size, ...Qe(t._meta) };
      return t.cost && (r.cost = { amount: t.cost.amount, currency: t.cost.currency }), { ...e, usage: r };
    }
    default:
      return e;
  }
}
const mt = 5;
function Mt(e) {
  if (e.firstTokenAt == null || e.lastTokenAt == null || (e.chunks ?? mt) < mt) return null;
  const t = (e.lastTokenAt - e.firstTokenAt) / 1e3;
  return t < 0.3 ? null : e.usage.outputTokens ? { value: e.usage.outputTokens / t, unit: "token/s" } : e.chars ? { value: e.chars / t, unit: "字/s" } : null;
}
function Ro(e, t, n = "") {
  const o = [], { usage: r } = e;
  n ? o.push(r.model ? `${n}（${r.model}）` : n) : r.model && o.push(r.model), (r.inputTokens !== void 0 || r.outputTokens !== void 0) && o.push(`输入 ${r.inputTokens ?? "?"} · 输出 ${r.outputTokens ?? "?"} token`), r.cachedInputTokens && o.push(`缓存命中 ${r.cachedInputTokens}`), r.cacheWriteTokens && o.push(`写入缓存 ${r.cacheWriteTokens}`), r.contextUsed !== void 0 && r.contextSize && o.push(`上下文 ${Math.round(r.contextUsed / r.contextSize * 100)}%`), r.cost && o.push(`${r.cost.amount.toFixed(4)} ${r.cost.currency}`);
  const a = Mt(e);
  return a && o.push(`${a.value.toFixed(a.value >= 10 ? 0 : 1)} ${a.unit}`), e.firstTokenAt != null && o.push(`首字 ${((e.firstTokenAt - e.startedAt) / 1e3).toFixed(1)}s`), t != null && o.push(`用时 ${((t - e.startedAt) / 1e3).toFixed(1)}s`), o.join(" · ");
}
const pt = 8e3;
function Ke(e, t) {
  return e.filter((n) => n.type === t).map((n) => n.text || "").join("").trim();
}
function Ao(e, t) {
  if (!e) return null;
  const n = { ...e.usage };
  return t != null && (n.elapsedMs = Math.round(t - e.startedAt)), e.firstTokenAt != null && (n.firstTokenMs = Math.round(e.firstTokenAt - e.startedAt)), Object.keys(n).length ? n : null;
}
function Ot(e) {
  var n;
  const t = [];
  for (const o of e)
    if (o.role === "user") {
      const r = Ke(o.content, "text");
      r && t.push({ role: "user", text: r });
    } else if (o.role === "assistant") {
      const r = (n = o.metadata) == null ? void 0 : n.custom, a = Ke(o.content, "text"), s = Ke(o.content, "reasoning");
      if (!a && !s) continue;
      t.push({ role: "assistant", text: a, thought: s || null, usage: Ao(r == null ? void 0 : r.turn, r == null ? void 0 : r.endedAt) });
    }
  return t;
}
function _o(e) {
  return e.map((t) => {
    if (t.role === "user") return { role: "user", content: t.text };
    const n = t.usage || {}, o = { ...zt(0), usage: n, firstTokenAt: n.firstTokenMs ?? null };
    return {
      role: "assistant",
      content: [
        ...t.thought ? [{ type: "reasoning", text: t.thought }] : [],
        { type: "text", text: t.text }
      ],
      status: { type: "complete", reason: "stop" },
      metadata: { custom: { turn: o, endedAt: n.elapsedMs ?? void 0 } }
    };
  });
}
function Po(e) {
  const t = Ot(e).slice(-12);
  if (!t.length) return "";
  let n = t.map((o) => `${o.role === "user" ? "我" : "你"}：${o.text}`).join(`

`);
  return n.length > pt && (n = `…${n.slice(-pt)}`), `之前我们在这一处聊过（接着聊）：

${n}`;
}
const Eo = 4e3;
function Ye(e, t = Eo) {
  const n = `${e || ""}`.trim();
  return n.length > t ? `${n.slice(0, t)}…` : n;
}
function zo(e, t, n = "") {
  const o = [], r = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return o.push(`我在读${n ? `《${n}》` : "一本书"}，${r}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && o.push("", "我选中的这段：", Ye(e.selection)), e.sourceText && o.push("", "这一块的原文：", Ye(e.sourceText)), e.translatedText && o.push("", "这一块的译文：", Ye(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && o.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), o.push("", `（RetainPDF 任务 ${t}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), [{ type: "text", text: o.join(`
`) }];
}
class $o {
  constructor() {
    ye(this, "pending", /* @__PURE__ */ new Map());
    ye(this, "listeners", /* @__PURE__ */ new Set());
    ye(this, "version", 0);
    ye(this, "subscribe", (t) => (this.listeners.add(t), () => this.listeners.delete(t)));
    ye(this, "snapshot", () => this.version);
  }
  add(t) {
    return new Promise((n) => {
      const o = t.toolCall.toolCallId;
      this.pending.set(o, {
        request: t,
        resolve: (r) => {
          this.pending.delete(o), this.bump(), n(r);
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
function qe(e) {
  return e.map((t) => t.type === "tool-call" ? { ...t, args: t.args } : t);
}
function Mo(e) {
  const t = e.now ?? (() => performance.now());
  let n = null, o = "", r = null, a = !1;
  const s = async () => {
    const d = e.getAgentId();
    return n && o === d || (n == null || n.close(), n = await e.port.openSession(
      { agentId: d, jobId: e.jobId },
      {
        onUpdate: (c) => r == null ? void 0 : r(c),
        onPermission: (c) => e.permissions.add(c)
      }
    ), o = d, a = !1), n;
  };
  return {
    adapter: {
      async *run({ messages: d, abortSignal: c }) {
        const u = d.map((T) => T.role).lastIndexOf("user"), f = u >= 0 ? d[u] : void 0, g = ((f == null ? void 0 : f.content) || []).map((T) => T.type === "text" && T.text || "").join(`
`).trim();
        let m;
        try {
          m = await s();
        } catch (T) {
          n = null;
          const L = T instanceof Error ? T.message : String(T);
          yield {
            content: [{ type: "text", text: `（连不上这个 agent：${L}）` }],
            status: { type: "incomplete", reason: "error", error: L }
          };
          return;
        }
        const b = e.getAnchor(), p = [];
        !a && b && p.push(...zo(b, e.jobId, e.bookTitle));
        const w = !a && u > 0 ? Po(d.slice(0, u)) : "";
        w && p.push({ type: "text", text: w }), p.push({ type: "text", text: g }), a = !0;
        let h = zt(t()), C = null, R = !1;
        r = (T) => {
          h = Io(h, T, t()), R = !0, C == null || C();
        };
        const O = () => {
          e.permissions.cancelAll(), m.cancel();
        };
        c.addEventListener("abort", O);
        let E = !1, $ = null, j = "end_turn";
        m.prompt(p).then(
          (T) => {
            j = T.stopReason;
            const L = { ...Qe(T.meta), ...Qe(T.usage ? { usage: T.usage } : null) };
            Object.keys(L).length && (h = { ...h, usage: { ...h.usage, ...L } }, R = !0), E = !0, C == null || C();
          },
          (T) => {
            $ = T, E = !0, C == null || C();
          }
        );
        try {
          for (; !E || R; )
            R || await new Promise((T) => C = T), C = null, R && (R = !1, yield { content: qe(h.parts), metadata: { custom: { turn: h } } });
        } finally {
          c.removeEventListener("abort", O), r = null;
        }
        const x = t(), z = Mt(h), P = {
          streamStartTime: h.startedAt,
          firstTokenTime: h.firstTokenAt ?? void 0,
          totalStreamTime: x - h.startedAt,
          tokenCount: h.usage.outputTokens,
          tokensPerSecond: (z == null ? void 0 : z.unit) === "token/s" ? z.value : void 0,
          totalChunks: 0,
          toolCallCount: h.parts.filter((T) => T.type === "tool-call").length
        };
        if ($) {
          const T = $ instanceof Error ? $.message : String($);
          /close|closed|1011|disconnect|断/i.test(T) && (n == null || n.close(), n = null), yield {
            content: qe([...h.parts, { type: "text", text: `

（出错了：${T}）` }]),
            status: { type: "incomplete", reason: "error", error: T },
            metadata: { custom: { turn: h, endedAt: x }, timing: P }
          };
          return;
        }
        yield {
          content: qe(h.parts),
          status: j === "cancelled" ? { type: "incomplete", reason: "cancelled" } : j === "max_tokens" ? { type: "incomplete", reason: "length" } : { type: "complete", reason: "stop" },
          metadata: { custom: { turn: h, endedAt: x }, timing: P }
        };
      }
    },
    close() {
      e.permissions.cancelAll(), n == null || n.close(), n = null;
    }
  };
}
function Oo(e) {
  return `${e || ""}`.split(/(```[\s\S]*?(?:```|$))/).map((t, n) => n % 2 ? t : t.replace(/\\\[([\s\S]*?)\\\]/g, (o, r) => `$$${r}$$`).replace(/\\\(([\s\S]*?)\\\)/g, (o, r) => `$${r}$`)).join("");
}
const jo = typeof window < "u" ? _e : ce;
function jt(e) {
  var t, n, o = "";
  if (typeof e == "string" || typeof e == "number") o += e;
  else if (typeof e == "object") if (Array.isArray(e)) {
    var r = e.length;
    for (t = 0; t < r; t++) e[t] && (n = jt(e[t])) && (o && (o += " "), o += n);
  } else for (n in e) e[n] && (o && (o += " "), o += n);
  return o;
}
function Lt() {
  for (var e, t, n = 0, o = "", r = arguments.length; n < r; n++) (e = arguments[n]) && (t = jt(e)) && (o && (o += " "), o += t);
  return o;
}
const gt = (e) => typeof e == "boolean" ? `${e}` : e === 0 ? "0" : e, bt = Lt, Lo = (e, t) => (n) => {
  var o;
  if ((t == null ? void 0 : t.variants) == null) return bt(e, n == null ? void 0 : n.class, n == null ? void 0 : n.className);
  const { variants: r, defaultVariants: a } = t, s = Object.keys(r).map((c) => {
    const u = n == null ? void 0 : n[c], f = a == null ? void 0 : a[c];
    if (u === null) return null;
    const g = gt(u) || gt(f);
    return r[c][g];
  }), i = n && Object.entries(n).reduce((c, u) => {
    let [f, g] = u;
    return g === void 0 || (c[f] = g), c;
  }, {}), d = t == null || (o = t.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((c, u) => {
    let { class: f, className: g, ...m } = u;
    return Object.entries(m).every((b) => {
      let [p, w] = b;
      return Array.isArray(w) ? w.includes({
        ...a,
        ...i
      }[p]) : {
        ...a,
        ...i
      }[p] === w;
    }) ? [
      ...c,
      f,
      g
    ] : c;
  }, []);
  return bt(e, s, d, n == null ? void 0 : n.class, n == null ? void 0 : n.className);
}, Fo = (e, t) => {
  const n = new Array(e.length + t.length);
  for (let o = 0; o < e.length; o++)
    n[o] = e[o];
  for (let o = 0; o < t.length; o++)
    n[e.length + o] = t[o];
  return n;
}, Do = (e, t) => ({
  classGroupId: e,
  validator: t
}), Ft = (e = /* @__PURE__ */ new Map(), t = null, n) => ({
  nextPart: e,
  validators: t,
  classGroupId: n
}), We = "-", ht = [], Wo = "arbitrary..", Uo = (e) => {
  const t = Go(e), {
    conflictingClassGroups: n,
    conflictingClassGroupModifiers: o
  } = e;
  return {
    getClassGroupId: (s) => {
      if (s.startsWith("[") && s.endsWith("]"))
        return Vo(s);
      const i = s.split(We), d = i[0] === "" && i.length > 1 ? 1 : 0;
      return Dt(i, d, t);
    },
    getConflictingClassGroupIds: (s, i) => {
      if (i) {
        const d = o[s], c = n[s];
        return d ? c ? Fo(c, d) : d : c || ht;
      }
      return n[s] || ht;
    }
  };
}, Dt = (e, t, n) => {
  if (e.length - t === 0)
    return n.classGroupId;
  const r = e[t], a = n.nextPart.get(r);
  if (a) {
    const c = Dt(e, t + 1, a);
    if (c) return c;
  }
  const s = n.validators;
  if (s === null)
    return;
  const i = t === 0 ? e.join(We) : e.slice(t).join(We), d = s.length;
  for (let c = 0; c < d; c++) {
    const u = s[c];
    if (u.validator(i))
      return u.classGroupId;
  }
}, Vo = (e) => e.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const t = e.slice(1, -1), n = t.indexOf(":"), o = t.slice(0, n);
  return o ? Wo + o : void 0;
})(), Go = (e) => {
  const {
    theme: t,
    classGroups: n
  } = e;
  return Bo(n, t);
}, Bo = (e, t) => {
  const n = Ft();
  for (const o in e) {
    const r = e[o];
    rt(r, n, o, t);
  }
  return n;
}, rt = (e, t, n, o) => {
  const r = e.length;
  for (let a = 0; a < r; a++) {
    const s = e[a];
    Ho(s, t, n, o);
  }
}, Ho = (e, t, n, o) => {
  if (typeof e == "string") {
    Ko(e, t, n);
    return;
  }
  if (typeof e == "function") {
    Yo(e, t, n, o);
    return;
  }
  qo(e, t, n, o);
}, Ko = (e, t, n) => {
  const o = e === "" ? t : Wt(t, e);
  o.classGroupId = n;
}, Yo = (e, t, n, o) => {
  if (Xo(e)) {
    rt(e(o), t, n, o);
    return;
  }
  t.validators === null && (t.validators = []), t.validators.push(Do(n, e));
}, qo = (e, t, n, o) => {
  const r = Object.entries(e), a = r.length;
  for (let s = 0; s < a; s++) {
    const [i, d] = r[s];
    rt(d, Wt(t, i), n, o);
  }
}, Wt = (e, t) => {
  let n = e;
  const o = t.split(We), r = o.length;
  for (let a = 0; a < r; a++) {
    const s = o[a];
    let i = n.nextPart.get(s);
    i || (i = Ft(), n.nextPart.set(s, i)), n = i;
  }
  return n;
}, Xo = (e) => "isThemeGetter" in e && e.isThemeGetter === !0, Qo = (e) => {
  if (e < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let t = 0, n = /* @__PURE__ */ Object.create(null), o = /* @__PURE__ */ Object.create(null);
  const r = (a, s) => {
    n[a] = s, t++, t > e && (t = 0, o = n, n = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(a) {
      let s = n[a];
      if (s !== void 0)
        return s;
      if ((s = o[a]) !== void 0)
        return r(a, s), s;
    },
    set(a, s) {
      a in n ? n[a] = s : r(a, s);
    }
  };
}, Ae = "!", xt = ":", Jo = [], kt = (e, t, n, o, r) => ({
  modifiers: e,
  hasImportantModifier: t,
  baseClassName: n,
  maybePostfixModifierPosition: o,
  isExternal: r
}), Zo = (e) => {
  const {
    prefix: t,
    experimentalParseClassName: n
  } = e;
  let o = (r) => {
    const a = [];
    let s = 0, i = 0, d = 0, c;
    const u = r.length;
    for (let w = 0; w < u; w++) {
      const h = r[w];
      if (s === 0 && i === 0) {
        if (h === xt) {
          a.push(r.slice(d, w)), d = w + 1;
          continue;
        }
        if (h === "/") {
          c = w;
          continue;
        }
      }
      if (h === "[") s++;
      else if (h === "]") s--;
      else if (h === "(") i++;
      else if (h === ")") i--;
      else if (h === "\\") w++;
      else if (h === '"' || h === "'")
        for (; ++w < u; ) {
          const C = r[w];
          if (C === "\\") w++;
          else if (C === h) break;
        }
    }
    const f = a.length === 0 ? r : r.slice(d);
    let g = f, m = !1;
    f.endsWith(Ae) ? (g = f.slice(0, -1), m = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      f.startsWith(Ae) && (g = f.slice(1), m = !0)
    );
    const b = m && f.startsWith(Ae) ? Ae.length : 0, p = c && c > d ? c - d - b : void 0;
    return kt(a, m, g, p);
  };
  if (t) {
    const r = t + xt, a = o;
    o = (s) => s.startsWith(r) ? a(s.slice(r.length)) : kt(Jo, !1, s, void 0, !0);
  }
  if (n) {
    const r = o;
    o = (a) => n({
      className: a,
      parseClassName: r
    });
  }
  return o;
}, er = (e) => {
  const t = /* @__PURE__ */ new Map();
  return e.orderSensitiveModifiers.forEach((n, o) => {
    t.set(n, 1e6 + o);
  }), (n) => {
    const o = [];
    let r = [];
    for (let a = 0; a < n.length; a++) {
      const s = n[a], i = s[0] === "[", d = t.has(s);
      i || d ? (r.length > 0 && (r.sort(), o.push(...r), r = []), o.push(s)) : r.push(s);
    }
    return r.length > 0 && (r.sort(), o.push(...r)), o;
  };
}, tr = (e) => ({
  cache: Qo(e.cacheSize),
  parseClassName: Zo(e),
  sortModifiers: er(e),
  postfixLookupClassGroupIds: nr(e),
  ...Uo(e)
}), nr = (e) => {
  const t = /* @__PURE__ */ Object.create(null), n = e.postfixLookupClassGroups;
  if (n)
    for (let o = 0; o < n.length; o++)
      t[n[o]] = !0;
  return t;
}, or = /\s+/, rr = (e, t) => {
  const {
    parseClassName: n,
    getClassGroupId: o,
    getConflictingClassGroupIds: r,
    sortModifiers: a,
    postfixLookupClassGroupIds: s
  } = t, i = [], d = e.trim().split(or);
  let c = "";
  for (let u = d.length - 1; u >= 0; u -= 1) {
    const f = d[u], {
      isExternal: g,
      modifiers: m,
      hasImportantModifier: b,
      baseClassName: p,
      maybePostfixModifierPosition: w
    } = n(f);
    if (g) {
      c = f + (c.length > 0 ? " " + c : c);
      continue;
    }
    let h = !!w, C;
    if (h) {
      const j = p.substring(0, w);
      C = o(j);
      const x = C && s[C] ? o(p) : void 0;
      x && x !== C && (C = x, h = !1);
    } else
      C = o(p);
    if (!C) {
      if (!h) {
        c = f + (c.length > 0 ? " " + c : c);
        continue;
      }
      if (C = o(p), !C) {
        c = f + (c.length > 0 ? " " + c : c);
        continue;
      }
      h = !1;
    }
    const R = m.length === 0 ? "" : m.length === 1 ? m[0] : a(m).join(":"), O = b ? R + Ae : R, E = O + C;
    if (i.indexOf(E) > -1)
      continue;
    i.push(E);
    const $ = r(C, h);
    for (let j = 0; j < $.length; ++j) {
      const x = $[j];
      i.push(O + x);
    }
    c = f + (c.length > 0 ? " " + c : c);
  }
  return c;
}, sr = (...e) => {
  let t = 0, n, o, r = "";
  for (; t < e.length; )
    (n = e[t++]) && (o = Ut(n)) && (r && (r += " "), r += o);
  return r;
}, Ut = (e) => {
  if (typeof e == "string")
    return e;
  let t, n = "";
  for (let o = 0; o < e.length; o++)
    e[o] && (t = Ut(e[o])) && (n && (n += " "), n += t);
  return n;
}, ar = (e, ...t) => {
  let n, o, r, a;
  const s = (d) => {
    const c = t.reduce((u, f) => f(u), e());
    return n = tr(c), o = n.cache.get, r = n.cache.set, a = i, i(d);
  }, i = (d) => {
    const c = o(d);
    if (c)
      return c;
    const u = rr(d, n);
    return r(d, u), u;
  };
  return a = s, (...d) => a(sr(...d));
}, ir = [], W = (e) => {
  const t = (n) => n[e] || ir;
  return t.isThemeGetter = !0, t.themeKey = e, t;
}, Vt = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Gt = /^\((?:(\w[\w-]*):)?(.+)\)$/i, lr = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, cr = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, dr = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|Q|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^--spacing\(.+\)|^0$/, Bt = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark|contrast-color|device-cmyk|--alpha)\(.+\)$/i, ur = /^(?:_*[+-]?(?:\d|\.\d)|[\w-]+\(|_*(?:inherit|initial|revert(?:-layer)?|unset)_*$)/i, fr = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, mr = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, me = (e) => lr.test(e), A = (e) => !!e && !Number.isNaN(Number(e)), se = (e) => !!e && Number.isInteger(Number(e)), Xe = (e) => e.endsWith("%") && A(e.slice(0, -1)), le = (e) => cr.test(e), Ht = () => !0, pr = (e) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  dr.test(e) && !Bt.test(e)
), gr = (e) => (
  // Mask stops default to positions for variables and non-color CSS functions, including angles, so color functions need to be excluded explicitly.
  ur.test(e) && !Bt.test(e)
), st = () => !1, br = (e) => fr.test(e), hr = (e) => mr.test(e), xr = (e) => !k(e) && !y(e), kr = (e) => e.startsWith("@container") && (e[10] === "/" && e[11] !== void 0 || e[11] === "s" && e[16] !== void 0 && e.startsWith("-size/", 10) || e[11] === "n" && e[18] !== void 0 && e.startsWith("-normal/", 10)), yr = (e) => ue(e, qt, st), k = (e) => Vt.test(e), he = (e) => ue(e, Xt, pr), wr = (e) => ue(e, Qt, gr), vr = (e) => ue(e, Er, A), Cr = (e) => ue(e, Zt, Ht), Nr = (e) => ue(e, Jt, st), Sr = (e) => ue(e, Kt, st), Tr = (e) => ue(e, Yt, hr), Oe = (e) => ue(e, en, br), y = (e) => Gt.test(e), ve = (e) => pe(e, Xt), Ir = (e) => pe(e, Qt, !0), Rr = (e) => pe(e, Jt), yt = (e) => pe(e, Kt), Ar = (e) => pe(e, qt), _r = (e) => pe(e, Yt), je = (e) => pe(e, en, !0), Pr = (e) => pe(e, Zt, !0), ue = (e, t, n) => {
  const o = Vt.exec(e);
  return o ? o[1] ? t(o[1]) : n(o[2]) : !1;
}, pe = (e, t, n = !1) => {
  const o = Gt.exec(e);
  return o ? o[1] ? t(o[1]) : n : !1;
}, Kt = (e) => e === "position" || e === "percentage", Yt = (e) => e === "image" || e === "url", qt = (e) => e === "length" || e === "size" || e === "bg-size", Xt = (e) => e === "length", Qt = (e) => e !== "color", Er = (e) => e === "number", Jt = (e) => e === "family-name", Zt = (e) => e === "number" || e === "weight", en = (e) => e === "shadow", zr = () => {
  const e = W("color"), t = W("font"), n = W("text"), o = W("font-weight"), r = W("tracking"), a = W("leading"), s = W("breakpoint"), i = W("container"), d = W("spacing"), c = W("radius"), u = W("shadow"), f = W("inset-shadow"), g = W("text-shadow"), m = W("drop-shadow"), b = W("blur"), p = W("perspective"), w = W("aspect"), h = W("ease"), C = W("animate"), R = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], O = () => [
    "center",
    "top",
    "bottom",
    "left",
    "right",
    "top-left",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "left-top",
    "top-right",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "right-top",
    "bottom-right",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "right-bottom",
    "bottom-left",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "left-bottom"
  ], E = () => [...O(), y, k], $ = () => ["auto", "hidden", "clip", "visible", "scroll"], j = () => ["auto", "contain", "none"], x = () => [y, k, d], z = () => [me, "full", "auto", ...x()], P = () => [se, "none", "subgrid", y, k], T = () => ["auto", {
    span: ["full", se, y, k]
  }, se, y, k], L = () => [se, "auto", y, k], U = () => ["auto", "min", "max", "fr", y, k], ne = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], K = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], B = () => ["auto", ...x()], J = () => [me, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...x()], oe = () => [i, me, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...x()], q = () => [me, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...x()], N = () => [e, y, k], re = () => [...O(), yt, Sr, {
    position: [y, k]
  }], xe = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], Ie = () => ["auto", "cover", "contain", Ar, yr, {
    size: [y, k]
  }], ge = () => [Xe, ve, he], G = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    c,
    y,
    k
  ], V = () => ["", A, ve, he], ke = () => ["solid", "dashed", "dotted", "double"], X = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], M = () => [A, Xe, Ir, wr], Be = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    b,
    y,
    k
  ], ae = () => ["none", A, y, k], ie = () => ["none", A, y, k], be = () => [A, y, k], S = () => [me, "full", ...x()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [le],
      breakpoint: [le],
      color: [Ht],
      container: [le],
      "drop-shadow": [le],
      ease: ["in", "out", "in-out"],
      font: [xr],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [le],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [le],
      shadow: [le],
      spacing: ["px", A],
      text: [le],
      "text-shadow": [le],
      tracking: ["tighter", "tight", "normal", "wide", "wider", "widest"]
    },
    classGroups: {
      // --------------
      // --- Layout ---
      // --------------
      /**
       * Aspect Ratio
       * @see https://tailwindcss.com/docs/aspect-ratio
       */
      aspect: [{
        aspect: ["auto", "square", me, k, y, w]
      }],
      /**
       * Container
       * @see https://tailwindcss.com/docs/container
       * @deprecated since Tailwind CSS v4.0.0
       */
      container: ["container"],
      /**
       * Container Type
       * @see https://tailwindcss.com/docs/responsive-design#container-queries
       */
      "container-type": [{
        "@container": ["", "normal", "size", y, k]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [kr],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [A, "auto", k, y, i]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": R()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": R()
      }],
      /**
       * Break Inside
       * @see https://tailwindcss.com/docs/break-inside
       */
      "break-inside": [{
        "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
      }],
      /**
       * Box Decoration Break
       * @see https://tailwindcss.com/docs/box-decoration-break
       */
      "box-decoration": [{
        "box-decoration": ["slice", "clone"]
      }],
      /**
       * Box Sizing
       * @see https://tailwindcss.com/docs/box-sizing
       */
      box: [{
        box: ["border", "content"]
      }],
      /**
       * Display
       * @see https://tailwindcss.com/docs/display
       */
      display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
      /**
       * Screen Reader Only
       * @see https://tailwindcss.com/docs/display#screen-reader-only
       */
      sr: ["sr-only"],
      /**
       * Not Screen Reader Only
       * @see https://tailwindcss.com/docs/display#screen-reader-only
       */
      "not-sr": ["not-sr-only"],
      /**
       * Floats
       * @see https://tailwindcss.com/docs/float
       */
      float: [{
        float: ["right", "left", "none", "start", "end"]
      }],
      /**
       * Clear
       * @see https://tailwindcss.com/docs/clear
       */
      clear: [{
        clear: ["left", "right", "both", "none", "start", "end"]
      }],
      /**
       * Isolation
       * @see https://tailwindcss.com/docs/isolation
       */
      isolation: ["isolate", "isolation-auto"],
      /**
       * Object Fit
       * @see https://tailwindcss.com/docs/object-fit
       */
      "object-fit": [{
        object: ["contain", "cover", "fill", "none", "scale-down"]
      }],
      /**
       * Object Position
       * @see https://tailwindcss.com/docs/object-position
       */
      "object-position": [{
        object: E()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: $()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": $()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": $()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: j()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": j()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": j()
      }],
      /**
       * Position
       * @see https://tailwindcss.com/docs/position
       */
      position: ["static", "fixed", "absolute", "relative", "sticky"],
      /**
       * Inset
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      inset: [{
        inset: z()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": z()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": z()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": z(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: z()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": z(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: z()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": z()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": z()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: z()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: z()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: z()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: z()
      }],
      /**
       * Visibility
       * @see https://tailwindcss.com/docs/visibility
       */
      visibility: ["visible", "invisible", "collapse"],
      /**
       * Z-Index
       * @see https://tailwindcss.com/docs/z-index
       */
      z: [{
        z: [se, "auto", y, k]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [me, "full", "auto", i, ...x()]
      }],
      /**
       * Flex Direction
       * @see https://tailwindcss.com/docs/flex-direction
       */
      "flex-direction": [{
        flex: ["row", "row-reverse", "col", "col-reverse"]
      }],
      /**
       * Flex Wrap
       * @see https://tailwindcss.com/docs/flex-wrap
       */
      "flex-wrap": [{
        flex: ["nowrap", "wrap", "wrap-reverse"]
      }],
      /**
       * Flex
       * @see https://tailwindcss.com/docs/flex
       */
      flex: [{
        flex: [A, me, "auto", "initial", "none", y, k]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", A, y, k]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", A, y, k]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [se, "first", "last", "none", y, k]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": P()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: T()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": L()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": L()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": P()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: T()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": L()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": L()
      }],
      /**
       * Grid Auto Flow
       * @see https://tailwindcss.com/docs/grid-auto-flow
       */
      "grid-flow": [{
        "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
      }],
      /**
       * Grid Auto Columns
       * @see https://tailwindcss.com/docs/grid-auto-columns
       */
      "auto-cols": [{
        "auto-cols": U()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": U()
      }],
      /**
       * Gap
       * @see https://tailwindcss.com/docs/gap
       */
      gap: [{
        gap: x()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": x()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": x()
      }],
      /**
       * Justify Content
       * @see https://tailwindcss.com/docs/justify-content
       */
      "justify-content": [{
        justify: [...ne(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...K(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...K()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...ne()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...K(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...K(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": ne()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...K(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...K()]
      }],
      // Spacing
      /**
       * Padding
       * @see https://tailwindcss.com/docs/padding
       */
      p: [{
        p: x()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: x()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: x()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: x()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: x()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: x()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: x()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: x()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: x()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: x()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: x()
      }],
      /**
       * Margin
       * @see https://tailwindcss.com/docs/margin
       */
      m: [{
        m: B()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: B()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: B()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: B()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: B()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: B()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: B()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: B()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: B()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: B()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: B()
      }],
      /**
       * Space Between X
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x": [{
        "space-x": x()
      }],
      /**
       * Space Between X Reverse
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x-reverse": ["space-x-reverse"],
      /**
       * Space Between Y
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-y": [{
        "space-y": x()
      }],
      /**
       * Space Between Y Reverse
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-y-reverse": ["space-y-reverse"],
      // --------------
      // --- Sizing ---
      // --------------
      /**
       * Size
       * @see https://tailwindcss.com/docs/width#setting-both-width-and-height
       */
      size: [{
        size: J()
      }],
      /**
       * Inline Size
       * @see https://tailwindcss.com/docs/inline-size
       */
      "inline-size": [{
        inline: ["auto", ...oe()]
      }],
      /**
       * Min-Inline Size
       * @see https://tailwindcss.com/docs/min-inline-size
       */
      "min-inline-size": [{
        "min-inline": ["auto", ...oe()]
      }],
      /**
       * Max-Inline Size
       * @see https://tailwindcss.com/docs/max-inline-size
       */
      "max-inline-size": [{
        "max-inline": ["none", ...oe()]
      }],
      /**
       * Block Size
       * @see https://tailwindcss.com/docs/block-size
       */
      "block-size": [{
        block: ["auto", ...q()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...q()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...q()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [i, "screen", ...J()]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [
          i,
          "screen",
          /** Deprecated. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "none",
          ...J()
        ]
      }],
      /**
       * Max-Width
       * @see https://tailwindcss.com/docs/max-width
       */
      "max-w": [{
        "max-w": [
          i,
          "screen",
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "prose",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          {
            screen: [s]
          },
          ...J()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...J()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...J()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...J()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", n, ve, he]
      }],
      /**
       * Font Smoothing
       * @see https://tailwindcss.com/docs/font-smoothing
       */
      "font-smoothing": ["antialiased", "subpixel-antialiased"],
      /**
       * Font Style
       * @see https://tailwindcss.com/docs/font-style
       */
      "font-style": ["italic", "not-italic"],
      /**
       * Font Weight
       * @see https://tailwindcss.com/docs/font-weight
       */
      "font-weight": [{
        font: [o, Pr, Cr]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Xe, k]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [Rr, Nr, t]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [k]
      }],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-normal": ["normal-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-ordinal": ["ordinal"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-slashed-zero": ["slashed-zero"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-figure": ["lining-nums", "oldstyle-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-spacing": ["proportional-nums", "tabular-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
      /**
       * Letter Spacing
       * @see https://tailwindcss.com/docs/letter-spacing
       */
      tracking: [{
        tracking: [r, y, k]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [A, "none", y, k]
      }],
      /**
       * Line Height
       * @see https://tailwindcss.com/docs/line-height
       */
      leading: [{
        leading: [
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          a,
          ...x()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", y, k]
      }],
      /**
       * List Style Position
       * @see https://tailwindcss.com/docs/list-style-position
       */
      "list-style-position": [{
        list: ["inside", "outside"]
      }],
      /**
       * List Style Type
       * @see https://tailwindcss.com/docs/list-style-type
       */
      "list-style-type": [{
        list: ["disc", "decimal", "none", y, k]
      }],
      /**
       * Text Alignment
       * @see https://tailwindcss.com/docs/text-align
       */
      "text-alignment": [{
        text: ["left", "center", "right", "justify", "start", "end"]
      }],
      /**
       * Placeholder Color
       * @deprecated since Tailwind CSS v3.0.0
       * @see https://v3.tailwindcss.com/docs/placeholder-color
       */
      "placeholder-color": [{
        placeholder: N()
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: N()
      }],
      /**
       * Text Decoration
       * @see https://tailwindcss.com/docs/text-decoration
       */
      "text-decoration": ["underline", "overline", "line-through", "no-underline"],
      /**
       * Text Decoration Style
       * @see https://tailwindcss.com/docs/text-decoration-style
       */
      "text-decoration-style": [{
        decoration: [...ke(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [A, "from-font", "auto", ve, yt, he]
      }],
      /**
       * Text Decoration Color
       * @see https://tailwindcss.com/docs/text-decoration-color
       */
      "text-decoration-color": [{
        decoration: N()
      }],
      /**
       * Text Underline Offset
       * @see https://tailwindcss.com/docs/text-underline-offset
       */
      "underline-offset": [{
        "underline-offset": [A, "auto", y, k]
      }],
      /**
       * Text Transform
       * @see https://tailwindcss.com/docs/text-transform
       */
      "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
      /**
       * Text Overflow
       * @see https://tailwindcss.com/docs/text-overflow
       */
      "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
      /**
       * Text Wrap
       * @see https://tailwindcss.com/docs/text-wrap
       */
      "text-wrap": [{
        text: ["wrap", "nowrap", "balance", "pretty"]
      }],
      /**
       * Text Indent
       * @see https://tailwindcss.com/docs/text-indent
       */
      indent: [{
        indent: x()
      }],
      /**
       * Tab Size
       * @see https://tailwindcss.com/docs/tab-size
       */
      "tab-size": [{
        tab: [se, y, k]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", y, k]
      }],
      /**
       * Whitespace
       * @see https://tailwindcss.com/docs/whitespace
       */
      whitespace: [{
        whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
      }],
      /**
       * Word Break
       * @see https://tailwindcss.com/docs/word-break
       */
      break: [{
        break: ["normal", "words", "all", "keep"]
      }],
      /**
       * Overflow Wrap
       * @see https://tailwindcss.com/docs/overflow-wrap
       */
      wrap: [{
        wrap: ["break-word", "anywhere", "normal"]
      }],
      /**
       * Hyphens
       * @see https://tailwindcss.com/docs/hyphens
       */
      hyphens: [{
        hyphens: ["none", "manual", "auto"]
      }],
      /**
       * Content
       * @see https://tailwindcss.com/docs/content
       */
      content: [{
        content: ["none", y, k]
      }],
      // -------------------
      // --- Backgrounds ---
      // -------------------
      /**
       * Background Attachment
       * @see https://tailwindcss.com/docs/background-attachment
       */
      "bg-attachment": [{
        bg: ["fixed", "local", "scroll"]
      }],
      /**
       * Background Clip
       * @see https://tailwindcss.com/docs/background-clip
       */
      "bg-clip": [{
        "bg-clip": ["border", "padding", "content", "text"]
      }],
      /**
       * Background Origin
       * @see https://tailwindcss.com/docs/background-origin
       */
      "bg-origin": [{
        "bg-origin": ["border", "padding", "content"]
      }],
      /**
       * Background Position
       * @see https://tailwindcss.com/docs/background-position
       */
      "bg-position": [{
        bg: re()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: xe()
      }],
      /**
       * Background Size
       * @see https://tailwindcss.com/docs/background-size
       */
      "bg-size": [{
        bg: Ie()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, se, y, k],
          radial: ["", y, k],
          conic: ["", se, y, k]
        }, _r, Tr]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: N()
      }],
      /**
       * Gradient Color Stops From Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from-pos": [{
        from: ge()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: ge()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: ge()
      }],
      /**
       * Gradient Color Stops From
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from": [{
        from: N()
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: N()
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: N()
      }],
      // ---------------
      // --- Borders ---
      // ---------------
      /**
       * Border Radius
       * @see https://tailwindcss.com/docs/border-radius
       */
      rounded: [{
        rounded: G()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": G()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": G()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": G()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": G()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": G()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": G()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": G()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": G()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": G()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": G()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": G()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": G()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": G()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": G()
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: V()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": V()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": V()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": V()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": V()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": V()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": V()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": V()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": V()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": V()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": V()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": V()
      }],
      /**
       * Divide Width X Reverse
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x-reverse": ["divide-x-reverse"],
      /**
       * Divide Width Y
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-y": [{
        "divide-y": V()
      }],
      /**
       * Divide Width Y Reverse
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-y-reverse": ["divide-y-reverse"],
      /**
       * Border Style
       * @see https://tailwindcss.com/docs/border-style
       */
      "border-style": [{
        border: [...ke(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...ke(), "hidden", "none"]
      }],
      /**
       * Border Color
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color": [{
        border: N()
      }],
      /**
       * Border Color Inline
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": N()
      }],
      /**
       * Border Color Block
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": N()
      }],
      /**
       * Border Color Inline Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": N()
      }],
      /**
       * Border Color Inline End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": N()
      }],
      /**
       * Border Color Block Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-bs": [{
        "border-bs": N()
      }],
      /**
       * Border Color Block End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-be": [{
        "border-be": N()
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": N()
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": N()
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": N()
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": N()
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: N()
      }],
      /**
       * Outline Style
       * @see https://tailwindcss.com/docs/outline-style
       */
      "outline-style": [{
        outline: [...ke(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [A, y, k]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", A, ve, he]
      }],
      /**
       * Outline Color
       * @see https://tailwindcss.com/docs/outline-color
       */
      "outline-color": [{
        outline: N()
      }],
      // ---------------
      // --- Effects ---
      // ---------------
      /**
       * Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow
       */
      shadow: [{
        shadow: [
          // Deprecated since Tailwind CSS v4.0.0
          "",
          // Deprecated since Tailwind CSS v4.0.0
          "inner",
          "none",
          u,
          je,
          Oe
        ]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
       */
      "shadow-color": [{
        shadow: N()
      }],
      /**
       * Inset Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
       */
      "inset-shadow": [{
        "inset-shadow": ["none", f, je, Oe]
      }],
      /**
       * Inset Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
       */
      "inset-shadow-color": [{
        "inset-shadow": N()
      }],
      /**
       * Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
       */
      "ring-w": [{
        ring: V()
      }],
      /**
       * Ring Width Inset
       * @see https://v3.tailwindcss.com/docs/ring-width#inset-rings
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-w-inset": ["ring-inset"],
      /**
       * Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-ring-color
       */
      "ring-color": [{
        ring: N()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [A, he]
      }],
      /**
       * Ring Offset Color
       * @see https://v3.tailwindcss.com/docs/ring-offset-color
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-color": [{
        "ring-offset": N()
      }],
      /**
       * Inset Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
       */
      "inset-ring-w": [{
        "inset-ring": V()
      }],
      /**
       * Inset Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
       */
      "inset-ring-color": [{
        "inset-ring": N()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", g, je, Oe]
      }],
      /**
       * Text Shadow Color
       * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
       */
      "text-shadow-color": [{
        "text-shadow": N()
      }],
      /**
       * Opacity
       * @see https://tailwindcss.com/docs/opacity
       */
      opacity: [{
        opacity: [A, y, k]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...X(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": X()
      }],
      /**
       * Mask Clip
       * @see https://tailwindcss.com/docs/mask-clip
       */
      "mask-clip": [{
        "mask-clip": ["border", "padding", "content", "fill", "stroke", "view"]
      }, "mask-no-clip"],
      /**
       * Mask Composite
       * @see https://tailwindcss.com/docs/mask-composite
       */
      "mask-composite": [{
        mask: ["add", "subtract", "intersect", "exclude"]
      }],
      /**
       * Mask Image
       * @see https://tailwindcss.com/docs/mask-image
       */
      "mask-image-linear-pos": [{
        "mask-linear": [A]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": M()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": M()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": N()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": N()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": M()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": M()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": N()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": N()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": M()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": M()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": N()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": N()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": M()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": M()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": N()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": N()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": M()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": M()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": N()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": N()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": M()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": M()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": N()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": N()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": M()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": M()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": N()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": N()
      }],
      "mask-image-radial": [{
        "mask-radial": [y, k]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": M()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": M()
      }],
      "mask-image-radial-from-color": [{
        "mask-radial-from": N()
      }],
      "mask-image-radial-to-color": [{
        "mask-radial-to": N()
      }],
      "mask-image-radial-shape": [{
        mask: ["circle", "ellipse"]
      }],
      "mask-image-radial-size": [{
        "mask-radial": [{
          closest: ["side", "corner"],
          farthest: ["side", "corner"]
        }]
      }],
      "mask-image-radial-pos": [{
        "mask-radial-at": O()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [A]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": M()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": M()
      }],
      "mask-image-conic-from-color": [{
        "mask-conic-from": N()
      }],
      "mask-image-conic-to-color": [{
        "mask-conic-to": N()
      }],
      /**
       * Mask Mode
       * @see https://tailwindcss.com/docs/mask-mode
       */
      "mask-mode": [{
        mask: ["alpha", "luminance", "match"]
      }],
      /**
       * Mask Origin
       * @see https://tailwindcss.com/docs/mask-origin
       */
      "mask-origin": [{
        "mask-origin": ["border", "padding", "content", "fill", "stroke", "view"]
      }],
      /**
       * Mask Position
       * @see https://tailwindcss.com/docs/mask-position
       */
      "mask-position": [{
        mask: re()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: xe()
      }],
      /**
       * Mask Size
       * @see https://tailwindcss.com/docs/mask-size
       */
      "mask-size": [{
        mask: Ie()
      }],
      /**
       * Mask Type
       * @see https://tailwindcss.com/docs/mask-type
       */
      "mask-type": [{
        "mask-type": ["alpha", "luminance"]
      }],
      /**
       * Mask Image
       * @see https://tailwindcss.com/docs/mask-image
       */
      "mask-image": [{
        mask: ["none", y, k]
      }],
      // ---------------
      // --- Filters ---
      // ---------------
      /**
       * Filter
       * @see https://tailwindcss.com/docs/filter
       */
      filter: [{
        filter: [
          // Deprecated since Tailwind CSS v3.0.0
          "",
          "none",
          y,
          k
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: Be()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [A, y, k]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [A, y, k]
      }],
      /**
       * Drop Shadow
       * @see https://tailwindcss.com/docs/drop-shadow
       */
      "drop-shadow": [{
        "drop-shadow": [
          // Deprecated since Tailwind CSS v4.0.0
          "",
          "none",
          m,
          je,
          Oe
        ]
      }],
      /**
       * Drop Shadow Color
       * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
       */
      "drop-shadow-color": [{
        "drop-shadow": N()
      }],
      /**
       * Grayscale
       * @see https://tailwindcss.com/docs/grayscale
       */
      grayscale: [{
        grayscale: ["", A, y, k]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [A, y, k]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", A, y, k]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [A, y, k]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", A, y, k]
      }],
      /**
       * Backdrop Filter
       * @see https://tailwindcss.com/docs/backdrop-filter
       */
      "backdrop-filter": [{
        "backdrop-filter": [
          // Deprecated since Tailwind CSS v3.0.0
          "",
          "none",
          y,
          k
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": Be()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [A, y, k]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [A, y, k]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", A, y, k]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [A, y, k]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", A, y, k]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [A, y, k]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [A, y, k]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", A, y, k]
      }],
      // --------------
      // --- Tables ---
      // --------------
      /**
       * Border Collapse
       * @see https://tailwindcss.com/docs/border-collapse
       */
      "border-collapse": [{
        border: ["collapse", "separate"]
      }],
      /**
       * Border Spacing
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing": [{
        "border-spacing": x()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": x()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": x()
      }],
      /**
       * Table Layout
       * @see https://tailwindcss.com/docs/table-layout
       */
      "table-layout": [{
        table: ["auto", "fixed"]
      }],
      /**
       * Caption Side
       * @see https://tailwindcss.com/docs/caption-side
       */
      caption: [{
        caption: ["top", "bottom"]
      }],
      // ---------------------------------
      // --- Transitions and Animation ---
      // ---------------------------------
      /**
       * Transition Property
       * @see https://tailwindcss.com/docs/transition-property
       */
      transition: [{
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", y, k]
      }],
      /**
       * Transition Behavior
       * @see https://tailwindcss.com/docs/transition-behavior
       */
      "transition-behavior": [{
        transition: ["normal", "discrete"]
      }],
      /**
       * Transition Duration
       * @see https://tailwindcss.com/docs/transition-duration
       */
      duration: [{
        duration: [A, "initial", y, k]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", h, y, k]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [A, y, k]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", C, y, k]
      }],
      // ------------------
      // --- Transforms ---
      // ------------------
      /**
       * Backface Visibility
       * @see https://tailwindcss.com/docs/backface-visibility
       */
      backface: [{
        backface: ["hidden", "visible"]
      }],
      /**
       * Perspective
       * @see https://tailwindcss.com/docs/perspective
       */
      perspective: [{
        perspective: [p, y, k]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": E()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: ae()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": ae()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": ae()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": ae()
      }],
      /**
       * Scale
       * @see https://tailwindcss.com/docs/scale
       */
      scale: [{
        scale: ie()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": ie()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": ie()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": ie()
      }],
      /**
       * Scale 3D
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-3d": ["scale-3d"],
      /**
       * Skew
       * @see https://tailwindcss.com/docs/skew
       */
      skew: [{
        skew: be()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": be()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": be()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [y, k, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: E()
      }],
      /**
       * Transform Style
       * @see https://tailwindcss.com/docs/transform-style
       */
      "transform-style": [{
        transform: ["3d", "flat"]
      }],
      /**
       * Translate
       * @see https://tailwindcss.com/docs/translate
       */
      translate: [{
        translate: S()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": S()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": S()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": S()
      }],
      /**
       * Translate None
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-none": ["translate-none"],
      /**
       * Zoom
       * @see https://tailwindcss.com/docs/zoom
       */
      zoom: [{
        zoom: [se, y, k]
      }],
      // ---------------------
      // --- Interactivity ---
      // ---------------------
      /**
       * Accent Color
       * @see https://tailwindcss.com/docs/accent-color
       */
      accent: [{
        accent: N()
      }],
      /**
       * Appearance
       * @see https://tailwindcss.com/docs/appearance
       */
      appearance: [{
        appearance: ["none", "auto"]
      }],
      /**
       * Caret Color
       * @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
       */
      "caret-color": [{
        caret: N()
      }],
      /**
       * Color Scheme
       * @see https://tailwindcss.com/docs/color-scheme
       */
      "color-scheme": [{
        scheme: ["normal", "dark", "light", "light-dark", "only-dark", "only-light"]
      }],
      /**
       * Cursor
       * @see https://tailwindcss.com/docs/cursor
       */
      cursor: [{
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", y, k]
      }],
      /**
       * Field Sizing
       * @see https://tailwindcss.com/docs/field-sizing
       */
      "field-sizing": [{
        "field-sizing": ["fixed", "content"]
      }],
      /**
       * Pointer Events
       * @see https://tailwindcss.com/docs/pointer-events
       */
      "pointer-events": [{
        "pointer-events": ["auto", "none"]
      }],
      /**
       * Resize
       * @see https://tailwindcss.com/docs/resize
       */
      resize: [{
        resize: ["none", "", "y", "x"]
      }],
      /**
       * Scroll Behavior
       * @see https://tailwindcss.com/docs/scroll-behavior
       */
      "scroll-behavior": [{
        scroll: ["auto", "smooth"]
      }],
      /**
       * Scrollbar Thumb Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-thumb-color": [{
        "scrollbar-thumb": N()
      }],
      /**
       * Scrollbar Track Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-track-color": [{
        "scrollbar-track": N()
      }],
      /**
       * Scrollbar Gutter
       * @see https://tailwindcss.com/docs/scrollbar-gutter
       */
      "scrollbar-gutter": [{
        "scrollbar-gutter": ["auto", "stable", "both"]
      }],
      /**
       * Scrollbar Width
       * @see https://tailwindcss.com/docs/scrollbar-width
       */
      "scrollbar-w": [{
        scrollbar: ["auto", "thin", "none"]
      }],
      /**
       * Scroll Margin
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-m": [{
        "scroll-m": x()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": x()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": x()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": x()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": x()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": x()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": x()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": x()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": x()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": x()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": x()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": x()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": x()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": x()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": x()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": x()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": x()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": x()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": x()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": x()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": x()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": x()
      }],
      /**
       * Scroll Snap Align
       * @see https://tailwindcss.com/docs/scroll-snap-align
       */
      "snap-align": [{
        snap: ["start", "end", "center", "align-none"]
      }],
      /**
       * Scroll Snap Stop
       * @see https://tailwindcss.com/docs/scroll-snap-stop
       */
      "snap-stop": [{
        snap: ["normal", "always"]
      }],
      /**
       * Scroll Snap Type
       * @see https://tailwindcss.com/docs/scroll-snap-type
       */
      "snap-type": [{
        snap: ["none", "x", "y", "both"]
      }],
      /**
       * Scroll Snap Type Strictness
       * @see https://tailwindcss.com/docs/scroll-snap-type
       */
      "snap-strictness": [{
        snap: ["mandatory", "proximity"]
      }],
      /**
       * Touch Action
       * @see https://tailwindcss.com/docs/touch-action
       */
      touch: [{
        touch: ["auto", "none", "manipulation"]
      }],
      /**
       * Touch Action X
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-x": [{
        "touch-pan": ["x", "left", "right"]
      }],
      /**
       * Touch Action Y
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-y": [{
        "touch-pan": ["y", "up", "down"]
      }],
      /**
       * Touch Action Pinch Zoom
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-pz": ["touch-pinch-zoom"],
      /**
       * User Select
       * @see https://tailwindcss.com/docs/user-select
       */
      select: [{
        select: ["none", "text", "all", "auto"]
      }],
      /**
       * Will Change
       * @see https://tailwindcss.com/docs/will-change
       */
      "will-change": [{
        "will-change": ["auto", "scroll", "contents", "transform", y, k]
      }],
      // -----------
      // --- SVG ---
      // -----------
      /**
       * Fill
       * @see https://tailwindcss.com/docs/fill
       */
      fill: [{
        fill: ["none", ...N()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [A, ve, he, vr]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: ["none", ...N()]
      }],
      // ---------------------
      // --- Accessibility ---
      // ---------------------
      /**
       * Forced Color Adjust
       * @see https://tailwindcss.com/docs/forced-color-adjust
       */
      "forced-color-adjust": [{
        "forced-color-adjust": ["auto", "none"]
      }]
    },
    conflictingClassGroups: {
      "container-named": ["container-type"],
      overflow: ["overflow-x", "overflow-y"],
      overscroll: ["overscroll-x", "overscroll-y"],
      inset: ["inset-x", "inset-y", "inset-bs", "inset-be", "start", "end", "top", "right", "bottom", "left"],
      "inset-x": ["start", "end", "right", "left"],
      "inset-y": ["inset-bs", "inset-be", "top", "bottom"],
      flex: ["basis", "grow", "shrink"],
      gap: ["gap-x", "gap-y"],
      "place-content": ["align-content", "justify-content"],
      "place-items": ["align-items", "justify-items"],
      "place-self": ["align-self", "justify-self"],
      p: ["px", "py", "ps", "pe", "pbs", "pbe", "pt", "pr", "pb", "pl"],
      px: ["ps", "pe", "pr", "pl"],
      py: ["pbs", "pbe", "pt", "pb"],
      m: ["mx", "my", "ms", "me", "mbs", "mbe", "mt", "mr", "mb", "ml"],
      mx: ["ms", "me", "mr", "ml"],
      my: ["mbs", "mbe", "mt", "mb"],
      size: ["w", "h"],
      "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
      "fvn-ordinal": ["fvn-normal"],
      "fvn-slashed-zero": ["fvn-normal"],
      "fvn-figure": ["fvn-normal"],
      "fvn-spacing": ["fvn-normal"],
      "fvn-fraction": ["fvn-normal"],
      "line-clamp": ["display", "overflow"],
      // Tailwind emits these utilities after `sr-only`, so keeping an earlier `relative` or `p-4` undoes the hide. Removing them is safe because `not-sr-only` resets the same properties when the element is revealed.
      // Border width and min/max sizes stay independent because `not-sr-only` doesn't reset them, so they still apply once the element is revealed. While hidden they don't undo the hide: the element is absolutely positioned and clipped away.
      // `not-sr-only` only conflicts with `sr-only`: Tailwind emits these utilities after it too, so an earlier `relative` or `p-4` is meant to apply once the element is visible.
      sr: ["not-sr", "position", "size", "w", "h", "p", "px", "py", "ps", "pe", "pbs", "pbe", "pt", "pr", "pb", "pl", "m", "mx", "my", "ms", "me", "mbs", "mbe", "mt", "mr", "mb", "ml", "overflow", "overflow-x", "overflow-y", "whitespace"],
      "not-sr": ["sr"],
      rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
      "rounded-s": ["rounded-ss", "rounded-es"],
      "rounded-e": ["rounded-se", "rounded-ee"],
      "rounded-t": ["rounded-tl", "rounded-tr"],
      "rounded-r": ["rounded-tr", "rounded-br"],
      "rounded-b": ["rounded-br", "rounded-bl"],
      "rounded-l": ["rounded-tl", "rounded-bl"],
      "border-spacing": ["border-spacing-x", "border-spacing-y"],
      "border-w": ["border-w-x", "border-w-y", "border-w-s", "border-w-e", "border-w-bs", "border-w-be", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
      "border-w-x": ["border-w-s", "border-w-e", "border-w-r", "border-w-l"],
      "border-w-y": ["border-w-bs", "border-w-be", "border-w-t", "border-w-b"],
      "border-color": ["border-color-x", "border-color-y", "border-color-s", "border-color-e", "border-color-bs", "border-color-be", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
      "border-color-x": ["border-color-s", "border-color-e", "border-color-r", "border-color-l"],
      "border-color-y": ["border-color-bs", "border-color-be", "border-color-t", "border-color-b"],
      "mask-image-x-from-pos": ["mask-image-r-from-pos", "mask-image-l-from-pos"],
      "mask-image-x-to-pos": ["mask-image-r-to-pos", "mask-image-l-to-pos"],
      "mask-image-x-from-color": ["mask-image-r-from-color", "mask-image-l-from-color"],
      "mask-image-x-to-color": ["mask-image-r-to-color", "mask-image-l-to-color"],
      "mask-image-y-from-pos": ["mask-image-t-from-pos", "mask-image-b-from-pos"],
      "mask-image-y-to-pos": ["mask-image-t-to-pos", "mask-image-b-to-pos"],
      "mask-image-y-from-color": ["mask-image-t-from-color", "mask-image-b-from-color"],
      "mask-image-y-to-color": ["mask-image-t-to-color", "mask-image-b-to-color"],
      translate: ["translate-x", "translate-y", "translate-none"],
      "translate-none": ["translate", "translate-x", "translate-y", "translate-z"],
      "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mbs", "scroll-mbe", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
      "scroll-mx": ["scroll-ms", "scroll-me", "scroll-mr", "scroll-ml"],
      "scroll-my": ["scroll-mbs", "scroll-mbe", "scroll-mt", "scroll-mb"],
      "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pbs", "scroll-pbe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
      "scroll-px": ["scroll-ps", "scroll-pe", "scroll-pr", "scroll-pl"],
      "scroll-py": ["scroll-pbs", "scroll-pbe", "scroll-pt", "scroll-pb"],
      touch: ["touch-x", "touch-y", "touch-pz"],
      "touch-x": ["touch"],
      "touch-y": ["touch"],
      "touch-pz": ["touch"]
    },
    conflictingClassGroupModifiers: {
      // Only a font size with a line-height modifier like `text-lg/7` sets `line-height` directly. Without a modifier, font sizes don't conflict with `leading-*`: arbitrary ones only set `font-size`, and the theme ones set `line-height: var(--tw-leading, …)`, so an earlier `leading-*` keeps applying in Tailwind's CSS.
      "font-size": ["leading"]
    },
    postfixLookupClassGroups: ["container-type"],
    orderSensitiveModifiers: ["*", "**", "after", "backdrop", "before", "details-content", "file", "first-letter", "first-line", "marker", "placeholder", "selection"]
  };
}, $r = /* @__PURE__ */ ar(zr);
function _(...e) {
  return $r(Lt(e));
}
var Mr = Object.defineProperty, at = (e, t) => Mr(e, "name", { value: t, configurable: !0 });
function Je(e, t) {
  if (typeof e == "function")
    return e(t);
  e != null && (e.current = t);
}
at(Je, "setRef");
function tn(...e) {
  return (t) => {
    let n = !1;
    const o = e.map((r) => {
      const a = Je(r, t);
      return !n && typeof a == "function" && (n = !0), a;
    });
    if (n)
      return () => {
        for (let r = 0; r < o.length; r++) {
          const a = o[r];
          typeof a == "function" ? a() : Je(e[r], null);
        }
      };
  };
}
at(tn, "composeRefs");
function it(...e) {
  return v.useCallback(tn(...e), e);
}
at(it, "useComposedRefs");
var Or = Object.defineProperty, Y = (e, t) => Or(e, "name", { value: t, configurable: !0 });
// @__NO_SIDE_EFFECTS__
function nn(e) {
  const t = v.forwardRef((n, o) => {
    let { children: r, ...a } = n, s = null, i = !1;
    const d = [];
    r = cn(r), v.Children.forEach(r, (g) => {
      var m;
      if (an(g)) {
        i = !0;
        const b = g;
        let p = "child" in b.props ? b.props.child : b.props.children;
        for (; lt(p) && typeof Ue == "function"; )
          p = Ue(p._payload);
        s = Lr(b, p), d.push((m = s == null ? void 0 : s.props) == null ? void 0 : m.children);
      } else
        d.push(g);
    }), s ? s = v.cloneElement(s, void 0, d) : (
      // A `Slottable` was found but it didn't resolve to a single element (e.g.
      // it wrapped multiple elements, text, or a render-prop `child` that
      // wasn't an element). Don't fall back to treating the `Slottable` wrapper
      // itself as the slot target — throw a descriptive error below instead.
      !i && v.Children.count(r) === 1 && v.isValidElement(r) && (s = r)
    );
    const c = s ? sn(s) : void 0, u = it(o, c);
    if (!s) {
      if (r || r === 0)
        throw new Error(
          i ? Wr(e) : Dr(e)
        );
      return r;
    }
    const f = rn(a, s.props ?? {});
    return s.type !== v.Fragment && (f.ref = o ? u : c), v.cloneElement(s, f);
  });
  return t.displayName = `${e}.Slot`, t;
}
Y(nn, "createSlot");
var on = Symbol.for("radix.slottable");
// @__NO_SIDE_EFFECTS__
function jr(e) {
  const t = /* @__PURE__ */ Y((n) => "child" in n ? n.children(n.child) : n.children, "Slottable");
  return t.displayName = `${e}.Slottable`, t.__radixId = on, t;
}
Y(jr, "createSlottable");
var Lr = /* @__PURE__ */ Y((e, t) => "child" in e.props ? v.isValidElement(t) ? v.cloneElement(t, void 0, e.props.children(t.props.children)) : null : v.isValidElement(t) ? t : null, "getSlottableElementFromSlottable");
function rn(e, t) {
  const n = { ...t };
  for (const o in t) {
    const r = e[o], a = t[o];
    /^on[A-Z]/.test(o) ? r && a ? n[o] = (...i) => {
      const d = a(...i);
      return r(...i), d;
    } : r && (n[o] = r) : o === "style" ? n[o] = { ...r, ...a } : o === "className" ? n[o] = [r, a].filter(Boolean).join(" ") : o === "aria-describedby" && (n[o] = dn(a, r));
  }
  return { ...e, ...n };
}
Y(rn, "mergeProps");
function sn(e) {
  var o, r;
  let t = (o = Object.getOwnPropertyDescriptor(e.props, "ref")) == null ? void 0 : o.get, n = t && "isReactWarning" in t && t.isReactWarning;
  return n ? e.ref : (t = (r = Object.getOwnPropertyDescriptor(e, "ref")) == null ? void 0 : r.get, n = t && "isReactWarning" in t && t.isReactWarning, n ? e.props.ref : e.props.ref || e.ref);
}
Y(sn, "getElementRef");
function an(e) {
  return v.isValidElement(e) && typeof e.type == "function" && "__radixId" in e.type && e.type.__radixId === on;
}
Y(an, "isSlottable");
var Fr = Symbol.for("react.lazy");
function lt(e) {
  return e != null && typeof e == "object" && "$$typeof" in e && e.$$typeof === Fr && "_payload" in e && ln(e._payload);
}
Y(lt, "isLazyComponent");
function ln(e) {
  return typeof e == "object" && e !== null && "then" in e;
}
Y(ln, "isPromiseLike");
function cn(e) {
  let t = e;
  for (; lt(t) && typeof Ue == "function"; )
    t = Ue(t._payload);
  return t;
}
Y(cn, "useUnwrappedLazy");
function dn(...e) {
  const t = /* @__PURE__ */ new Set();
  for (const n of e)
    if (typeof n == "string")
      for (const o of String(n).trim().split(/\s+/))
        o && t.add(o);
  return t.size > 0 ? Array.from(t).join(" ") : void 0;
}
Y(dn, "concatAriaDescribedby");
var Dr = /* @__PURE__ */ Y((e) => `${e} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`, "createSlotError"), Wr = /* @__PURE__ */ Y((e) => `${e} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`, "createSlottableError"), Ue = v[" use ".trim().toString()], Ur = Object.defineProperty, Vr = (e, t) => Ur(e, "name", { value: t, configurable: !0 }), Gr = [
  "a",
  "button",
  "div",
  "form",
  "h2",
  "h3",
  "img",
  "input",
  "label",
  "li",
  "nav",
  "ol",
  "p",
  "select",
  "span",
  "svg",
  "ul"
], ct = Gr.reduce((e, t) => {
  const n = /* @__PURE__ */ nn(`Primitive.${t}`), o = v.forwardRef((r, a) => {
    const { asChild: s, ...i } = r, d = s ? n : t;
    return typeof window < "u" && (window[Symbol.for("radix-ui")] = !0), /* @__PURE__ */ l(d, { ...i, ref: a });
  });
  return o.displayName = `Primitive.${t}`, { ...e, [t]: o };
}, {});
function Br(e, t) {
  e && vo.flushSync(() => e.dispatchEvent(t));
}
Vr(Br, "dispatchDiscreteCustomEvent");
var Hr = Object.defineProperty, Q = (e, t) => Hr(e, "name", { value: t, configurable: !0 });
// @__NO_SIDE_EFFECTS__
function Kr(e, t) {
  const n = v.createContext(t);
  n.displayName = e + "Context";
  const o = /* @__PURE__ */ Q((a) => {
    const { children: s, ...i } = a, d = v.useMemo(() => i, Object.values(i));
    return /* @__PURE__ */ l(n.Provider, { value: d, children: s });
  }, "Provider");
  o.displayName = e + "Provider";
  function r(a, s = {}) {
    const { optional: i = !1 } = s, d = v.useContext(n);
    if (d) return d;
    if (t !== void 0) return t;
    if (!i)
      throw new Error(`\`${a}\` must be used within \`${e}\``);
  }
  return Q(r, "useContext"), [o, r];
}
Q(Kr, "createContext");
// @__NO_SIDE_EFFECTS__
function un(e, t = []) {
  let n = [];
  function o(a, s) {
    const i = v.createContext(s);
    i.displayName = a + "Context";
    const d = n.length;
    n = [...n, s];
    const c = /* @__PURE__ */ Q((f) => {
      var h;
      const { scope: g, children: m, ...b } = f, p = ((h = g == null ? void 0 : g[e]) == null ? void 0 : h[d]) || i, w = v.useMemo(() => b, Object.values(b));
      return /* @__PURE__ */ l(p.Provider, { value: w, children: m });
    }, "Provider");
    c.displayName = a + "Provider";
    function u(f, g, m = {}) {
      var h;
      const { optional: b = !1 } = m, p = ((h = g == null ? void 0 : g[e]) == null ? void 0 : h[d]) || i, w = v.useContext(p);
      if (w) return w;
      if (s !== void 0) return s;
      if (!b)
        throw new Error(`\`${f}\` must be used within \`${a}\``);
    }
    return Q(u, "useContext"), [c, u];
  }
  Q(o, "createContext");
  const r = /* @__PURE__ */ Q(() => {
    const a = n.map((s) => v.createContext(s));
    return /* @__PURE__ */ Q(function(i) {
      const d = (i == null ? void 0 : i[e]) || a;
      return v.useMemo(
        () => ({ [`__scope${e}`]: { ...i, [e]: d } }),
        [i, d]
      );
    }, "useScope");
  }, "createScope");
  return r.scopeName = e, [o, fn(r, ...t)];
}
Q(un, "createContextScope");
function fn(...e) {
  const t = e[0];
  if (e.length === 1) return t;
  const n = /* @__PURE__ */ Q(() => {
    const o = e.map((r) => ({
      useScope: r(),
      scopeName: r.scopeName
    }));
    return /* @__PURE__ */ Q(function(a) {
      const s = o.reduce((i, { useScope: d, scopeName: c }) => {
        const f = d(a)[`__scope${c}`];
        return { ...i, ...f };
      }, {});
      return v.useMemo(() => ({ [`__scope${t.scopeName}`]: s }), [s]);
    }, "useComposedScopes");
  }, "createScope");
  return n.scopeName = t.scopeName, n;
}
Q(fn, "composeContextScopes");
var Se = globalThis != null && globalThis.document ? v.useLayoutEffect : () => {
}, Yr = Object.defineProperty, Te = (e, t) => Yr(e, "name", { value: t, configurable: !0 }), mn = !!(typeof window < "u" && window.document && window.document.createElement);
function pn(e, t, { checkForDefaultPrevented: n = !0 } = {}) {
  return /* @__PURE__ */ Te(function(r) {
    if (e == null || e(r), n === !1 || !r || !r.defaultPrevented)
      return t == null ? void 0 : t(r);
  }, "handleEvent");
}
Te(pn, "composeEventHandlers");
function qr(e) {
  var t;
  if (!mn)
    throw new Error("Cannot access window outside of the DOM");
  return ((t = e == null ? void 0 : e.ownerDocument) == null ? void 0 : t.defaultView) ?? window;
}
Te(qr, "getOwnerWindow");
function Ze(e) {
  if (!mn)
    throw new Error("Cannot access document outside of the DOM");
  return (e == null ? void 0 : e.ownerDocument) ?? document;
}
Te(Ze, "getOwnerDocument");
function gn(e, t = !1) {
  const { activeElement: n } = Ze(e);
  if (!(n != null && n.nodeName))
    return null;
  if (bn(n) && n.contentDocument)
    return gn(n.contentDocument.body, t);
  if (t) {
    const o = n.getAttribute("aria-activedescendant");
    if (o) {
      const r = Ze(n).getElementById(o);
      if (r)
        return r;
    }
  }
  return n;
}
Te(gn, "getActiveElement");
function bn(e) {
  return e.tagName === "IFRAME";
}
Te(bn, "isFrame");
var Xr = Object.defineProperty, Qr = (e, t) => Xr(e, "name", { value: t, configurable: !0 }), wt = v[" useEffectEvent ".trim().toString()], vt = v[" useInsertionEffect ".trim().toString()];
function hn(e) {
  if (typeof wt == "function")
    return wt(e);
  const t = v.useRef(() => {
    throw new Error("Cannot call an event handler while rendering.");
  });
  return typeof vt == "function" ? vt(() => {
    t.current = e;
  }) : Se(() => {
    t.current = e;
  }), v.useMemo(() => ((...n) => {
    var o;
    return (o = t.current) == null ? void 0 : o.call(t, ...n);
  }), []);
}
Qr(hn, "useEffectEvent");
var Jr = Object.defineProperty, ze = (e, t) => Jr(e, "name", { value: t, configurable: !0 }), Zr = v[" useInsertionEffect ".trim().toString()] || Se;
function xn({
  prop: e,
  defaultProp: t,
  onChange: n = /* @__PURE__ */ ze(() => {
  }, "onChange"),
  caller: o
}) {
  const [r, a, s] = kn({
    defaultProp: t,
    onChange: n
  }), i = e !== void 0, d = i ? e : r, c = v.useCallback(
    (u) => {
      var f;
      if (i) {
        const g = yn(u) ? u(e) : u;
        g !== e && ((f = s.current) == null || f.call(s, g));
      } else
        a(u);
    },
    [i, e, a, s]
  );
  return [d, c];
}
ze(xn, "useControllableState");
function kn({
  defaultProp: e,
  onChange: t
}) {
  const [n, o] = v.useState(e), r = v.useRef(n), a = v.useRef(t);
  return Zr(() => {
    a.current = t;
  }, [t]), v.useEffect(() => {
    var s;
    r.current !== n && ((s = a.current) == null || s.call(a, n), r.current = n);
  }, [n, r]), [n, o, a];
}
ze(kn, "useUncontrolledState");
function yn(e) {
  return typeof e == "function";
}
ze(yn, "isFunction");
var Ct = Symbol("RADIX:SYNC_STATE");
function es(e, t, n, o) {
  const { prop: r, defaultProp: a, onChange: s, caller: i } = t, d = r !== void 0, c = hn(s), u = [{ ...n, state: a }];
  o && u.push(o);
  const [f, g] = v.useReducer(
    (w, h) => {
      if (h.type === Ct)
        return { ...w, state: h.state };
      const C = e(w, h);
      return d && !Object.is(C.state, w.state) && c(C.state), C;
    },
    ...u
  ), m = f.state, b = v.useRef(m);
  v.useEffect(() => {
    b.current !== m && (b.current = m, d || c(m));
  }, [m, b, d]);
  const p = v.useMemo(() => r !== void 0 ? { ...f, state: r } : f, [f, r]);
  return v.useEffect(() => {
    d && !Object.is(r, f.state) && g({ type: Ct, state: r });
  }, [r, f.state, d]), [p, g];
}
ze(es, "useControllableStateReducer");
var ts = Object.defineProperty, de = (e, t) => ts(e, "name", { value: t, configurable: !0 });
function wn(e, t) {
  return v.useReducer((n, o) => t[n][o] ?? n, e);
}
de(wn, "useStateMachine");
var ns = /* @__PURE__ */ de((e) => {
  const { present: t, children: n } = e, o = vn(t), r = typeof n == "function" ? n({ present: o.isPresent }) : v.Children.only(n), a = Cn(o.ref, Nn(r));
  return typeof n == "function" || o.isPresent ? v.cloneElement(r, { ref: a }) : null;
}, "Presence");
function vn(e) {
  const [t, n] = v.useState(), o = v.useRef(null), r = v.useRef(e), a = v.useRef("none"), s = v.useRef(void 0), i = e ? "mounted" : "unmounted", [d, c] = wn(i, {
    mounted: {
      UNMOUNT: "unmounted",
      ANIMATION_OUT: "unmountSuspended"
    },
    unmountSuspended: {
      MOUNT: "mounted",
      ANIMATION_END: "unmounted"
    },
    unmounted: {
      MOUNT: "mounted"
    }
  });
  return v.useEffect(() => {
    d === "mounted" ? (a.current = s.current ?? Ce(o.current), s.current = void 0) : a.current = "none";
  }, [d]), Se(() => {
    const u = o.current, f = r.current;
    if (f !== e) {
      const m = a.current, b = Ce(u);
      e ? (s.current = b, c("MOUNT")) : b === "none" || (u == null ? void 0 : u.display) === "none" ? c("UNMOUNT") : c(f && m !== b ? "ANIMATION_OUT" : "UNMOUNT"), r.current = e;
    }
  }, [e, c]), Se(() => {
    if (t) {
      let u;
      const f = t.ownerDocument.defaultView ?? window, g = /* @__PURE__ */ de((b) => {
        const w = Ce(o.current).includes(CSS.escape(b.animationName));
        if (b.target === t && w && (c("ANIMATION_END"), !r.current)) {
          const h = t.style.animationFillMode;
          t.style.animationFillMode = "forwards", u = f.setTimeout(() => {
            t.style.animationFillMode === "forwards" && (t.style.animationFillMode = h);
          });
        }
      }, "handleAnimationEnd"), m = /* @__PURE__ */ de((b) => {
        b.target === t && (a.current = Ce(o.current));
      }, "handleAnimationStart");
      return t.addEventListener("animationstart", m), t.addEventListener("animationcancel", g), t.addEventListener("animationend", g), () => {
        f.clearTimeout(u), t.removeEventListener("animationstart", m), t.removeEventListener("animationcancel", g), t.removeEventListener("animationend", g);
      };
    } else
      c("ANIMATION_END");
  }, [t, c]), {
    isPresent: ["mounted", "unmountSuspended"].includes(d),
    ref: v.useCallback((u) => {
      if (u) {
        const f = getComputedStyle(u);
        o.current = f, s.current = Ce(f);
      } else
        o.current = null;
      n(u);
    }, [])
  };
}
de(vn, "usePresence");
function et(e, t) {
  if (typeof e == "function")
    return e(t);
  e != null && (e.current = t);
}
de(et, "setRef");
function Cn(...e) {
  const t = v.useRef(e);
  return t.current = e, v.useCallback((n) => {
    const o = t.current;
    let r = !1;
    const a = o.map((s) => {
      const i = et(s, n);
      return !r && typeof i == "function" && (r = !0), i;
    });
    if (r)
      return () => {
        for (let s = 0; s < a.length; s++) {
          const i = a[s];
          typeof i == "function" ? i() : et(o[s], null);
        }
      };
  }, []);
}
de(Cn, "useStableComposedRefs");
function Ce(e) {
  return (e == null ? void 0 : e.animationName) || "none";
}
de(Ce, "getAnimationName");
function Nn(e) {
  var o, r;
  let t = (o = Object.getOwnPropertyDescriptor(e.props, "ref")) == null ? void 0 : o.get, n = t && "isReactWarning" in t && t.isReactWarning;
  return n ? e.ref : (t = (r = Object.getOwnPropertyDescriptor(e, "ref")) == null ? void 0 : r.get, n = t && "isReactWarning" in t && t.isReactWarning, n ? e.props.ref : e.props.ref || e.ref);
}
de(Nn, "getElementRef");
var os = Object.defineProperty, rs = (e, t) => os(e, "name", { value: t, configurable: !0 }), ss = v[" useId ".trim().toString()] || (() => {
}), as = 0;
function Sn(e) {
  const [t, n] = v.useState(ss());
  return Se(() => {
    e || n((o) => o ?? String(as++));
  }, [e]), e || (t ? `radix-${t}` : "");
}
rs(Sn, "useId");
var is = Object.defineProperty, $e = (e, t) => is(e, "name", { value: t, configurable: !0 }), dt = "Collapsible", [ls, fa] = /* @__PURE__ */ un(dt), [cs, ut] = ls(dt), ds = /* @__PURE__ */ v.forwardRef(
  /* @__PURE__ */ $e(function(t, n) {
    const {
      __scopeCollapsible: o,
      open: r,
      defaultOpen: a,
      disabled: s,
      onOpenChange: i,
      ...d
    } = t, [c, u] = xn({
      prop: r,
      defaultProp: a ?? !1,
      onChange: i,
      caller: dt
    });
    return /* @__PURE__ */ l(
      cs,
      {
        scope: o,
        disabled: s,
        contentId: Sn(),
        open: c,
        onOpenToggle: v.useCallback(() => u((f) => !f), [u]),
        children: /* @__PURE__ */ l(
          ct.div,
          {
            "data-state": Ge(c),
            "data-disabled": s ? "" : void 0,
            ...d,
            ref: n
          }
        )
      }
    );
  }, "Collapsible")
), us = "CollapsibleTrigger", fs = /* @__PURE__ */ v.forwardRef(
  // blank line to reduce diff noise
  /* @__PURE__ */ $e(function(t, n) {
    const { __scopeCollapsible: o, ...r } = t, a = ut(us, o);
    return /* @__PURE__ */ l(
      ct.button,
      {
        type: "button",
        "aria-controls": a.open ? a.contentId : void 0,
        "aria-expanded": a.open || !1,
        "data-state": Ge(a.open),
        "data-disabled": a.disabled ? "" : void 0,
        disabled: a.disabled,
        ...r,
        ref: n,
        onClick: pn(t.onClick, a.onOpenToggle)
      }
    );
  }, "CollapsibleTrigger")
), Tn = "CollapsibleContent", ms = /* @__PURE__ */ v.forwardRef(
  // blank line to reduce diff noise
  /* @__PURE__ */ $e(function(t, n) {
    const { forceMount: o, ...r } = t, a = ut(Tn, t.__scopeCollapsible);
    return /* @__PURE__ */ l(ns, { present: o || a.open, children: ({ present: s }) => /* @__PURE__ */ l(ps, { ...r, ref: n, present: s }) });
  }, "CollapsibleContent")
), ps = /* @__PURE__ */ v.forwardRef(/* @__PURE__ */ $e(function(t, n) {
  const { __scopeCollapsible: o, present: r, children: a, ...s } = t, i = ut(Tn, o), [d, c] = v.useState(r), u = v.useRef(null), f = it(n, u), g = v.useRef(0), m = g.current, b = v.useRef(0), p = b.current, w = i.open || d, h = v.useRef(w), C = v.useRef(void 0);
  return v.useEffect(() => {
    const R = requestAnimationFrame(() => h.current = !1);
    return () => cancelAnimationFrame(R);
  }, []), Se(() => {
    const R = u.current;
    if (R) {
      C.current = C.current || {
        transitionDuration: R.style.transitionDuration,
        animationName: R.style.animationName
      }, R.style.transitionDuration = "0s", R.style.animationName = "none";
      const O = R.getBoundingClientRect();
      g.current = O.height, b.current = O.width, h.current || (R.style.transitionDuration = C.current.transitionDuration, R.style.animationName = C.current.animationName), c(r);
    }
  }, [i.open, r]), /* @__PURE__ */ l(
    ct.div,
    {
      "data-state": Ge(i.open),
      "data-disabled": i.disabled ? "" : void 0,
      id: i.contentId,
      hidden: !w,
      ...s,
      ref: f,
      style: {
        "--radix-collapsible-content-height": m ? `${m}px` : void 0,
        "--radix-collapsible-content-width": p ? `${p}px` : void 0,
        ...t.style
      },
      children: w && a
    }
  );
}, "CollapsibleContentImpl"));
function Ge(e) {
  return e ? "open" : "closed";
}
$e(Ge, "getState");
const In = Ee(function(t, n) {
  return /* @__PURE__ */ l(ds, { ref: n, "data-slot": "collapsible", ...t });
});
function Rn({
  ...e
}) {
  return /* @__PURE__ */ l(
    fs,
    {
      "data-slot": "collapsible-trigger",
      ...e
    }
  );
}
function An({
  ...e
}) {
  return /* @__PURE__ */ l(
    ms,
    {
      "data-slot": "collapsible-content",
      ...e
    }
  );
}
const gs = 200, ft = At(!1), bs = Lo("aui-reasoning-root mb-4 w-full", {
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
}), hs = Ee(function({
  className: t,
  variant: n,
  open: o,
  onOpenChange: r,
  defaultOpen: a = !1,
  streaming: s,
  onAnimationStart: i,
  children: d,
  ...c
}, u) {
  const [f] = F(a), [g, m] = F(null), b = o !== void 0, p = b ? o : g ?? (s || f), w = s === !0 && p, h = H(s);
  jo(() => {
    h.current !== s && (h.current = s, !b && g === null && !f && (i == null || i()));
  }, [s, b, g, f, i]);
  const C = Le(
    (R) => {
      i == null || i(), b || m(R), r == null || r(R);
    },
    [i, b, r]
  );
  return /* @__PURE__ */ l(
    In,
    {
      ref: u,
      "data-slot": "reasoning-root",
      "data-variant": n,
      open: p,
      onOpenChange: C,
      className: _(
        "group/reasoning-root",
        bs({ variant: n, className: t })
      ),
      style: {
        "--animation-duration": `${gs}ms`
      },
      ...c,
      children: /* @__PURE__ */ l(ft.Provider, { value: w, children: d })
    }
  );
});
function Nt({
  side: e = "bottom",
  className: t,
  ...n
}) {
  return e === "top" ? /* @__PURE__ */ l(
    "div",
    {
      "data-slot": "reasoning-fade",
      className: _(
        "aui-reasoning-fade pointer-events-none absolute inset-x-0 top-0 z-10 h-8",
        "bg-[linear-gradient(to_bottom,var(--color-background),transparent)]",
        "group-data-[variant=muted]/reasoning-root:bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--color-muted)_50%,var(--color-background)),transparent)]",
        "fade-in-0 animate-in",
        "animation-duration-(--animation-duration)",
        t
      ),
      ...n
    }
  ) : /* @__PURE__ */ l(
    "div",
    {
      "data-slot": "reasoning-fade",
      className: _(
        "aui-reasoning-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8",
        "bg-[linear-gradient(to_top,var(--color-background),transparent)]",
        "group-data-[variant=muted]/reasoning-root:bg-[linear-gradient(to_top,color-mix(in_oklab,var(--color-muted)_50%,var(--color-background)),transparent)]",
        "fade-in-0 animate-in",
        "animation-duration-(--animation-duration)",
        t
      ),
      ...n
    }
  );
}
function xs({
  active: e,
  duration: t,
  label: n = "思考",
  className: o,
  ...r
}) {
  const a = t ? `（${t} 秒）` : "";
  return /* @__PURE__ */ I(
    Rn,
    {
      "data-slot": "reasoning-trigger",
      className: _(
        "aui-reasoning-trigger group/trigger text-muted-foreground hover:text-foreground flex max-w-[75%] origin-left items-center gap-2 py-1.5 text-sm transition-[color,scale] active:scale-[0.98]",
        o
      ),
      ...r,
      children: [
        /* @__PURE__ */ l(
          ro,
          {
            "data-slot": "reasoning-trigger-icon",
            className: "aui-reasoning-trigger-icon size-4 shrink-0"
          }
        ),
        /* @__PURE__ */ I(
          "span",
          {
            "data-slot": "reasoning-trigger-label",
            className: _(
              "aui-reasoning-trigger-label-wrapper inline-block leading-none tabular-nums",
              e && "shimmer motion-reduce:animate-none"
            ),
            children: [
              n,
              a
            ]
          }
        ),
        /* @__PURE__ */ l(
          _t,
          {
            "data-slot": "reasoning-trigger-chevron",
            className: _(
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
function ks({
  className: e,
  children: t,
  ...n
}) {
  const o = ot(ft);
  return /* @__PURE__ */ I(
    An,
    {
      "data-slot": "reasoning-content",
      className: _(
        "aui-reasoning-content text-muted-foreground relative overflow-hidden text-sm outline-none",
        "group/collapsible-content ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none",
        "data-closed:animate-collapsible-up",
        "data-open:animate-collapsible-down",
        "data-closed:fill-mode-forwards",
        "data-closed:pointer-events-none",
        "[--tw-duration:var(--animation-duration)]",
        e
      ),
      ...n,
      children: [
        /* @__PURE__ */ l(Nt, { side: "top" }),
        t,
        o ? /* @__PURE__ */ l(Nt, {}) : null
      ]
    }
  );
}
function ys({
  className: e,
  children: t,
  ...n
}) {
  const o = ot(ft), r = H(null), a = H(null);
  return ce(() => {
    if (!o) return;
    const s = r.current, i = a.current;
    if (!s || !i) return;
    let d = !0, c = s.scrollTop, u = s.scrollHeight;
    const f = () => Math.abs(
      s.scrollHeight - s.scrollTop - s.clientHeight
    ) <= 1 || s.scrollHeight <= s.clientHeight, g = () => {
      d && (s.scrollTop = s.scrollHeight);
    }, m = () => {
      f() ? d = !0 : s.scrollTop < c && s.scrollHeight === u && (d = !1), c = s.scrollTop, u = s.scrollHeight;
    };
    g(), s.addEventListener("scroll", m);
    const b = new ResizeObserver(g);
    return b.observe(i), () => {
      s.removeEventListener("scroll", m), b.disconnect();
    };
  }, [o]), /* @__PURE__ */ l(
    "div",
    {
      ref: r,
      "data-slot": "reasoning-text",
      className: _(
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
      ...n,
      children: /* @__PURE__ */ l("div", { ref: a, className: "aui-reasoning-text-content space-y-4", children: t })
    }
  );
}
const ws = {
  default: "primary",
  outline: "secondary",
  secondary: "secondary",
  ghost: "ghost",
  destructive: "danger",
  link: "ghost"
}, ee = Ee(function({ variant: t = "default", size: n = "default", asChild: o, className: r, ...a }, s) {
  return /* @__PURE__ */ l(
    Ne,
    {
      ref: s,
      variant: ws[t] ?? "secondary",
      size: n === "lg" ? "lg" : n === "default" ? "md" : "sm",
      className: r ? `reader-ask-action ${r}` : "reader-ask-action",
      ...a
    }
  );
}), _n = Ee(function(t, n) {
  return /* @__PURE__ */ l(xo, { ref: n, ...t });
}), St = 200, te = "active:scale-[0.98]";
function Pn({
  className: e,
  open: t,
  onOpenChange: n,
  defaultOpen: o = !1,
  children: r,
  ...a
}) {
  const s = H(null), [i, d] = F(o), c = Qn(s, St), u = t !== void 0, f = u ? t : i, g = Le(
    (m) => {
      c(), u || d(m), n == null || n(m);
    },
    [c, u, n]
  );
  return /* @__PURE__ */ l(
    In,
    {
      ref: s,
      "data-slot": "tool-fallback-root",
      open: f,
      onOpenChange: g,
      className: _(
        "aui-tool-fallback-root group/tool-fallback-root w-full",
        e
      ),
      style: {
        "--animation-duration": `${St}ms`
      },
      ...a,
      children: r
    }
  );
}
const vs = {
  running: ao,
  complete: Ve,
  incomplete: Pt,
  "requires-action": so
}, Cs = (e) => {
  if (e < 1e3) return "<1s";
  const t = e / 1e3;
  return t < 10 ? `${(Math.floor(t * 10) / 10).toFixed(1)}s` : t < 60 ? `${Math.floor(t)}s` : `${Math.floor(t / 60)}m ${Math.floor(t % 60)}s`;
};
function Ns({
  className: e,
  ...t
}) {
  const n = Jn();
  return n === void 0 ? null : /* @__PURE__ */ l(
    "span",
    {
      "data-slot": "tool-fallback-duration",
      className: _(
        "aui-tool-fallback-duration text-muted-foreground text-xs tabular-nums",
        e
      ),
      ...t,
      children: Cs(n)
    }
  );
}
function En({
  toolName: e,
  status: t,
  isError: n,
  responseDeliveryStatus: o,
  className: r,
  ...a
}) {
  const s = (t == null ? void 0 : t.type) ?? "complete", i = s === "complete" && n ? "incomplete" : s, d = i === "running", c = (t == null ? void 0 : t.type) === "incomplete" && t.reason === "cancelled", u = vs[i], f = o === "queued" ? "回复排着，还没发出" : i === "running" ? "正在用工具" : i === "requires-action" ? "等你决定" : i === "incomplete" ? `${c ? "取消了的" : "失败的"}工具` : "用了工具";
  return /* @__PURE__ */ I(
    Rn,
    {
      "data-slot": "tool-fallback-trigger",
      className: _(
        "aui-tool-fallback-trigger group/trigger text-muted-foreground hover:text-foreground flex w-fit max-w-full origin-left items-center gap-2 py-1.5 text-sm transition-[color,scale] active:scale-[0.98]",
        r
      ),
      ...a,
      children: [
        /* @__PURE__ */ l(
          u,
          {
            "data-slot": "tool-fallback-trigger-icon",
            className: _(
              "aui-tool-fallback-trigger-icon size-4 shrink-0",
              c && "text-muted-foreground",
              d && "animate-spin [animation-duration:0.6s]"
            )
          }
        ),
        /* @__PURE__ */ I(
          "span",
          {
            "data-slot": "tool-fallback-trigger-label",
            className: _(
              "aui-tool-fallback-trigger-label-wrapper inline-block min-w-0 text-start leading-none wrap-anywhere",
              c && "text-muted-foreground line-through",
              d && "shimmer motion-reduce:animate-none"
            ),
            children: [
              f,
              ": ",
              /* @__PURE__ */ l("b", { children: e })
            ]
          }
        ),
        /* @__PURE__ */ l(Ns, {}),
        /* @__PURE__ */ l(
          _t,
          {
            "data-slot": "tool-fallback-trigger-chevron",
            className: _(
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
  ...n
}) {
  return /* @__PURE__ */ l(
    An,
    {
      "data-slot": "tool-fallback-content",
      className: _(
        "aui-tool-fallback-content relative overflow-hidden text-sm outline-none",
        "group/collapsible-content ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none",
        "data-closed:animate-collapsible-up",
        "data-open:animate-collapsible-down",
        "data-closed:fill-mode-forwards",
        "data-closed:pointer-events-none",
        "[--tw-duration:var(--animation-duration)]",
        e
      ),
      ...n,
      children: /* @__PURE__ */ l(
        "div",
        {
          className: _(
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
function $n({
  argsText: e,
  className: t,
  ...n
}) {
  return e ? /* @__PURE__ */ l(
    "div",
    {
      "data-slot": "tool-fallback-args",
      className: _("aui-tool-fallback-args", t),
      ...n,
      children: /* @__PURE__ */ l("pre", { className: "aui-tool-fallback-args-value bg-muted/50 text-foreground/90 rounded-md p-2.5 text-xs break-words whitespace-pre-wrap", children: e })
    }
  ) : null;
}
const Mn = (e, t) => {
  if (typeof e == "string") return e;
  try {
    if (e instanceof Error) return String(e);
    const n = JSON.stringify(e, null, t);
    if (n !== void 0) return n;
  } catch {
  }
  try {
    return String(e);
  } catch {
    return "[Unserializable value]";
  }
};
function On({
  result: e,
  className: t,
  ...n
}) {
  return e === void 0 ? null : /* @__PURE__ */ I(
    "div",
    {
      "data-slot": "tool-fallback-result",
      className: _("aui-tool-fallback-result", t),
      ...n,
      children: [
        /* @__PURE__ */ l("p", { className: "aui-tool-fallback-result-header text-muted-foreground text-xs font-medium", children: "结果：" }),
        /* @__PURE__ */ l("pre", { className: "aui-tool-fallback-result-content bg-muted/50 text-foreground/90 mt-1 rounded-md p-2.5 text-xs break-words whitespace-pre-wrap", children: Mn(e, 2) })
      ]
    }
  );
}
function jn({
  status: e,
  className: t,
  ...n
}) {
  if ((e == null ? void 0 : e.type) !== "incomplete") return null;
  const o = e.error, r = o == null ? null : Mn(o);
  if (!r) return null;
  const s = e.reason === "cancelled" ? "取消原因：" : "出错：";
  return /* @__PURE__ */ I(
    "div",
    {
      "data-slot": "tool-fallback-error",
      className: _("aui-tool-fallback-error", t),
      ...n,
      children: [
        /* @__PURE__ */ l("p", { className: "aui-tool-fallback-error-header text-muted-foreground font-semibold", children: s }),
        /* @__PURE__ */ l("p", { className: "aui-tool-fallback-error-reason text-muted-foreground break-words whitespace-pre-line", children: r })
      ]
    }
  );
}
const Ss = "用户同意了", Ts = "用户没同意", Ln = {
  "allow-once": "允许",
  "allow-always": "总是允许",
  "reject-once": "不允许",
  "reject-always": "总是不允许"
}, Pe = (e) => Object.hasOwn(Ln, e), Tt = (e) => e === "allow-once" || e === "allow-always", tt = (e) => e.label ?? (Pe(e.kind) ? Ln[e.kind] : void 0) ?? e.id, Fn = (e) => (e == null ? void 0 : e.display) === "select" || (e == null ? void 0 : e.display) === "text" || (e == null ? void 0 : e.display) === "questions", Is = (e) => {
  var t;
  return !((t = e.options) != null && t.length) || e.allowFreeform === !0;
}, Rs = (e, t) => {
  var n;
  return [
    ...((t == null ? void 0 : t.optionIds) ?? []).map(
      (o) => {
        var r, a;
        return ((a = (r = e.options) == null ? void 0 : r.find((s) => s.id === o)) == null ? void 0 : a.label) ?? o;
      }
    ),
    ...(n = t == null ? void 0 : t.text) != null && n.trim() ? [t.text] : []
  ];
}, nt = (e) => e != null && (e.approved !== void 0 || e.resolution !== void 0), As = (e) => {
  var a;
  if (e.resolution !== void 0)
    return {
      outcome: "closed",
      label: e.resolution === "cancelled" ? "没决定就取消了" : "没决定就过期了"
    };
  const t = e.optionId === void 0 || (a = e.options) == null ? void 0 : a.find((s) => s.id === e.optionId), n = t !== void 0 ? tt(t) : e.optionId === void 0 ? void 0 : e.optionId, o = Fn(e) || t !== void 0 && !Pe(t.kind), r = e.isAutomatic ? "自动" : "";
  return e.approved ? {
    outcome: "allowed",
    label: `${r}${o ? "回答了" : "允许了"}`,
    option: n
  } : {
    outcome: "refused",
    label: `${r}${o ? "跳过了" : "没允许"}`,
    option: n
  };
}, _s = {
  allowed: Ve,
  refused: Pt,
  closed: io
};
function Ps({
  approval: e,
  className: t,
  receiptRef: n,
  ...o
}) {
  var i;
  const r = As(e), a = _s[r.outcome], s = [
    ...new Set(
      [e.text, e.reason].filter(
        (d) => typeof d == "string" && d !== ""
      )
    )
  ];
  return /* @__PURE__ */ I(
    "div",
    {
      ref: n,
      "data-slot": "tool-fallback-approval-receipt",
      "data-outcome": r.outcome,
      tabIndex: -1,
      className: _(
        "aui-tool-fallback-approval-receipt flex flex-col gap-1.5 pt-1",
        t
      ),
      ...o,
      children: [
        e.prompt ? /* @__PURE__ */ l("p", { className: "aui-tool-fallback-approval-prompt text-muted-foreground whitespace-pre-line", children: e.prompt }) : null,
        /* @__PURE__ */ I("p", { className: "aui-tool-fallback-approval-receipt-label flex items-center gap-1.5", children: [
          /* @__PURE__ */ l(a, { "aria-hidden": !0, className: "text-muted-foreground size-3.5 shrink-0" }),
          /* @__PURE__ */ l("span", { className: "font-medium", children: r.label }),
          r.option !== void 0 ? /* @__PURE__ */ I("span", { className: "text-muted-foreground", children: [
            "· ",
            r.option
          ] }) : null
        ] }),
        e.answers && ((i = e.questions) == null ? void 0 : i.map((d) => {
          const c = Rs(
            d,
            e.answers && Object.hasOwn(e.answers, d.id) ? e.answers[d.id] : void 0
          );
          return c.length === 0 ? null : /* @__PURE__ */ I(
            "p",
            {
              className: "aui-tool-fallback-approval-receipt-answer whitespace-pre-line",
              children: [
                /* @__PURE__ */ l("span", { className: "text-muted-foreground", children: d.header ?? d.prompt }),
                " ",
                "· ",
                c.join(", ")
              ]
            },
            d.id
          );
        })),
        s.map((d) => /* @__PURE__ */ l(
          "p",
          {
            className: "aui-tool-fallback-approval-receipt-note text-muted-foreground whitespace-pre-line",
            children: d
          },
          d
        ))
      ]
    }
  );
}
function Es({
  questions: e,
  dismissible: t,
  locked: n,
  onSend: o,
  onDismiss: r
}) {
  const [a, s] = F(() => /* @__PURE__ */ new Map()), [i, d] = F(
    () => /* @__PURE__ */ new Map()
  ), c = (m, b) => s((p) => {
    const w = p.get(m.id) ?? [], h = w.includes(b) ? w.filter((C) => C !== b) : m.multiple ? [...w, b] : [b];
    return new Map(p).set(m.id, h);
  }), u = (m) => {
    const b = a.get(m.id) ?? [], p = i.get(m.id), w = p != null && p.trim() ? p : void 0;
    return {
      ...b.length > 0 && { optionIds: b },
      ...w !== void 0 && { text: w }
    };
  }, f = e.length > 0 && e.every((m) => {
    const b = u(m);
    return b.optionIds !== void 0 || b.text !== void 0;
  }), g = () => {
    n || !f || o(
      Object.fromEntries(
        e.map((m) => [m.id, u(m)])
      )
    );
  };
  return /* @__PURE__ */ I(Rt, { children: [
    e.map((m) => {
      var w, h;
      const b = a.get(m.id) ?? [], p = ((w = m.options) == null ? void 0 : w.some((C) => C.description)) ?? !1;
      return /* @__PURE__ */ I(
        "div",
        {
          role: "group",
          "aria-label": m.prompt,
          "data-slot": "tool-fallback-approval-question",
          className: "aui-tool-fallback-approval-question flex flex-col gap-2",
          children: [
            /* @__PURE__ */ I("p", { className: "aui-tool-fallback-approval-question-prompt text-foreground whitespace-pre-line", children: [
              m.header ? /* @__PURE__ */ l("span", { className: "text-muted-foreground me-1.5 text-xs font-medium uppercase", children: m.header }) : null,
              m.prompt
            ] }),
            m.options && m.options.length > 0 ? /* @__PURE__ */ l(
              "div",
              {
                className: _(
                  "flex gap-2",
                  p ? "flex-col items-stretch" : "flex-wrap items-center"
                ),
                children: m.options.map((C) => {
                  const R = b.includes(C.id);
                  return /* @__PURE__ */ I(
                    ee,
                    {
                      size: "sm",
                      variant: R ? "default" : "outline",
                      className: _(
                        te,
                        p && "h-auto flex-col items-start gap-0.5 py-2 text-start whitespace-normal"
                      ),
                      "aria-pressed": R,
                      onClick: () => c(m, C.id),
                      disabled: n,
                      children: [
                        /* @__PURE__ */ l("span", { children: C.label }),
                        C.description ? /* @__PURE__ */ l("span", { className: "text-xs font-normal opacity-80", children: C.description }) : null
                      ]
                    },
                    C.id
                  );
                })
              }
            ) : null,
            Is(m) ? /* @__PURE__ */ l(
              _n,
              {
                value: i.get(m.id) ?? "",
                onChange: (C) => d(
                  (R) => new Map(R).set(m.id, C.target.value)
                ),
                disabled: n,
                "aria-label": m.prompt,
                placeholder: (h = m.options) != null && h.length ? "或者自己写" : "写下你的回答"
              }
            ) : null
          ]
        },
        m.id
      );
    }),
    /* @__PURE__ */ I("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ l(
        ee,
        {
          size: "sm",
          className: te,
          onClick: g,
          disabled: n || !f,
          children: "发送"
        }
      ),
      t ? /* @__PURE__ */ l(
        ee,
        {
          size: "sm",
          variant: "outline",
          className: te,
          onClick: r,
          disabled: n,
          children: "跳过"
        }
      ) : null
    ] })
  ] });
}
const Dn = (e, t, n) => (e == null ? void 0 : e.type) !== "requires-action" || e.reason !== "interrupt" || t != null || n != null, Wn = Ee(function(t, n) {
  var r;
  const o = H(!1);
  return /* @__PURE__ */ l(
    zs,
    {
      carryFocusRef: o,
      forwardedRef: n,
      ...t
    },
    (r = t.approval) == null ? void 0 : r.id
  );
});
function zs({
  className: e,
  forwardedRef: t,
  carryFocusRef: n,
  addResult: o,
  resume: r,
  interrupt: a,
  approval: s,
  respondToApproval: i,
  status: d,
  ...c
}) {
  const [u, f] = F(!1), g = Fe((S) => S.thread.voice !== void 0), m = Fe((S) => S.thread.capabilities.answerToolCall), b = u || g, [p, w] = F(null), [h, C] = F(""), [R, O] = F(null), E = (d == null ? void 0 : d.type) === "requires-action", [$, j] = F(E), [x, z] = F(0), P = H(x);
  _e(() => {
    P.current = x;
  }, [x]), E !== $ && (j(E), E && (f(!1), w(null), C(""), O(null), z(x + 1)));
  const T = H(null), L = H(null), U = H(null);
  _e(() => {
    var S;
    return n.current && (n.current = !1, (S = T.current) == null || S.focus({ preventScroll: !0 })), () => {
      const D = T.current ?? L.current;
      n.current = (D == null ? void 0 : D.contains(D.ownerDocument.activeElement)) ?? !1;
    };
  }, [n]), Kn(
    t,
    () => T.current ?? L.current
  );
  const ne = Le(
    (S) => {
      if (L.current = S, !S) return;
      const D = U.current === (s == null ? void 0 : s.id);
      U.current = null, D && S.focus({ preventScroll: !0 });
    },
    [s == null ? void 0 : s.id]
  ), K = Le(
    (S) => {
      const D = T.current;
      U.current = !S && (D != null && D.contains(D.ownerDocument.activeElement)) ? s == null ? void 0 : s.id : null, T.current = S;
    },
    [s == null ? void 0 : s.id]
  ), B = s != null && !nt(s) && d !== void 0 && d.type !== "requires-action" && !(u && d.type === "running");
  _e(() => {
    B && (U.current = null);
  }, [B]);
  const J = () => {
    const S = T.current;
    S != null && S.contains(S.ownerDocument.activeElement) && S.focus({ preventScroll: !0 });
  };
  if (s != null && nt(s))
    return /* @__PURE__ */ l(
      Ps,
      {
        approval: s,
        receiptRef: ne,
        className: e,
        ...c
      }
    );
  if (B || !Dn(d, s, a))
    return null;
  const oe = s != null && s.prompt ? /* @__PURE__ */ l("p", { className: "aui-tool-fallback-approval-prompt text-foreground whitespace-pre-line", children: s.prompt }) : null;
  if (!m)
    return oe && /* @__PURE__ */ l(
      "div",
      {
        "data-slot": "tool-fallback-approval",
        tabIndex: -1,
        className: _(
          "aui-tool-fallback-approval flex flex-col gap-2 pt-1",
          e
        ),
        ...c,
        ref: K,
        children: oe
      }
    );
  const q = i ? s == null ? void 0 : s.options : void 0, N = s != null && i != null && Zn(s), re = (S) => {
    J(), f(!0), w(null), O(null), (async () => {
      try {
        await S();
      } catch (D) {
        if (P.current !== x) return;
        f(!1), O(
          D instanceof Error ? D.message : String(D)
        );
      }
    })();
  }, xe = (S) => {
    if (!b)
      if (s != null && s.approved === void 0 && i)
        re(() => i({ approved: S, ...ge() }));
      else if (a)
        re(() => r == null ? void 0 : r({ approved: S }));
      else {
        if ((d == null ? void 0 : d.type) === "requires-action" && d.reason === "interrupt")
          return;
        re(() => o == null ? void 0 : o(S ? Ss : Ts));
      }
  }, Ie = (S) => {
    b || re(
      () => i == null ? void 0 : i(
        Pe(S.kind) ? { optionId: S.id, ...ge() } : { optionId: S.id, approved: !0, ...ge() }
      )
    );
  }, ge = () => h.trim() ? { text: h } : {}, G = () => {
    b || re(() => i == null ? void 0 : i({ text: h }));
  }, V = () => {
    b || re(() => i == null ? void 0 : i({ approved: !1 }));
  }, ke = (S) => {
    S.confirm ? (J(), w(S.id)) : Ie(S);
  }, X = p != null ? q == null ? void 0 : q.find((S) => S.id === p) : void 0, M = Fn(s), ae = M && i != null && (s == null ? void 0 : s.dismissible) === !0 ? /* @__PURE__ */ l(
    ee,
    {
      size: "sm",
      variant: "outline",
      className: te,
      onClick: V,
      disabled: b,
      children: "跳过"
    }
  ) : null, ie = R ? /* @__PURE__ */ l(
    "p",
    {
      role: "alert",
      className: "aui-tool-fallback-approval-error text-destructive text-xs whitespace-pre-line",
      children: R
    }
  ) : null, be = N ? /* @__PURE__ */ I("div", { className: "aui-tool-fallback-approval-answer flex flex-col items-start gap-2", children: [
    /* @__PURE__ */ l(
      _n,
      {
        value: h,
        onChange: (S) => C(S.target.value),
        disabled: b,
        "aria-label": M ? (s == null ? void 0 : s.prompt) ?? "回答" : "备注",
        placeholder: M ? "写下你的回答" : "给这个决定加一句备注"
      }
    ),
    M && /* @__PURE__ */ I("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ l(
        ee,
        {
          size: "sm",
          className: te,
          onClick: G,
          disabled: b,
          children: "发送"
        }
      ),
      ae
    ] })
  ] }) : null;
  if ((s == null ? void 0 : s.display) === "questions" && i)
    return /* @__PURE__ */ I(
      "div",
      {
        "data-slot": "tool-fallback-approval",
        tabIndex: -1,
        className: _(
          "aui-tool-fallback-approval flex flex-col gap-3 pt-1",
          e
        ),
        ...c,
        ref: K,
        children: [
          oe,
          /* @__PURE__ */ l(
            Es,
            {
              questions: s.questions ?? [],
              dismissible: s.dismissible === !0,
              locked: b,
              onSend: (S) => re(() => i({ answers: S })),
              onDismiss: V
            }
          ),
          ie
        ]
      }
    );
  if (X) {
    const S = typeof X.confirm == "object" ? X.confirm : void 0, D = (S == null ? void 0 : S.description) ?? X.description;
    return /* @__PURE__ */ I(
      "div",
      {
        "data-slot": "tool-fallback-approval-confirm",
        tabIndex: -1,
        className: _(
          "aui-tool-fallback-approval-confirm flex flex-col gap-2 pt-1",
          e
        ),
        ...c,
        ref: K,
        children: [
          /* @__PURE__ */ l("p", { className: "aui-tool-fallback-approval-confirm-title font-semibold", children: (S == null ? void 0 : S.title) ?? `${tt(X)}?` }),
          D && /* @__PURE__ */ l("p", { className: "aui-tool-fallback-approval-confirm-description text-muted-foreground whitespace-pre-line", children: D }),
          X.grants && X.grants.length > 0 && /* @__PURE__ */ l("ul", { className: "aui-tool-fallback-approval-confirm-grants flex flex-col gap-1", children: X.grants.map((Re) => /* @__PURE__ */ l("li", { children: /* @__PURE__ */ l("code", { className: "aui-tool-fallback-approval-confirm-grant bg-muted rounded px-1.5 py-0.5 text-xs", children: Re }) }, Re)) }),
          /* @__PURE__ */ I("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ l(
              ee,
              {
                size: "sm",
                className: te,
                onClick: () => Ie(X),
                disabled: b,
                children: "确定"
              }
            ),
            /* @__PURE__ */ l(
              ee,
              {
                size: "sm",
                variant: "outline",
                className: te,
                onClick: () => {
                  J(), w(null);
                },
                disabled: b,
                children: "返回"
              }
            )
          ] })
        ]
      }
    );
  }
  if (q && q.length > 0) {
    const S = q.filter((Z) => Tt(Z.kind)), D = q.filter((Z) => !Pe(Z.kind)), Re = q.filter(
      (Z) => Pe(Z.kind) && !Tt(Z.kind)
    );
    return /* @__PURE__ */ I(
      "div",
      {
        "data-slot": "tool-fallback-approval",
        tabIndex: -1,
        className: _(
          "aui-tool-fallback-approval flex flex-col gap-2 pt-1",
          e
        ),
        ...c,
        ref: K,
        children: [
          oe,
          /* @__PURE__ */ I("div", { className: "flex flex-wrap items-center gap-2", children: [
            [...S, ...D, ...Re].map(
              (Z) => /* @__PURE__ */ l(
                ee,
                {
                  size: "sm",
                  variant: Z === S[0] ? "default" : "outline",
                  className: te,
                  onClick: () => ke(Z),
                  disabled: b,
                  children: tt(Z)
                },
                Z.id
              )
            ),
            Re.length === 0 && !M && /* @__PURE__ */ l(
              ee,
              {
                size: "sm",
                variant: "outline",
                className: te,
                onClick: () => xe(!1),
                disabled: b,
                children: "不允许"
              }
            ),
            !N && ae
          ] }),
          be,
          ie
        ]
      }
    );
  }
  return M ? /* @__PURE__ */ I(
    "div",
    {
      "data-slot": "tool-fallback-approval",
      tabIndex: -1,
      className: _(
        "aui-tool-fallback-approval flex flex-col gap-2 pt-1",
        e
      ),
      ...c,
      ref: K,
      children: [
        oe,
        be,
        !N && ae && /* @__PURE__ */ l("div", { className: "flex items-center gap-2", children: ae }),
        ie
      ]
    }
  ) : /* @__PURE__ */ I(
    "div",
    {
      "data-slot": "tool-fallback-approval",
      tabIndex: -1,
      className: _(
        "aui-tool-fallback-approval flex flex-col gap-2 pt-1",
        e
      ),
      ...c,
      ref: K,
      children: [
        oe,
        /* @__PURE__ */ I("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ l(
            ee,
            {
              size: "sm",
              className: te,
              onClick: () => xe(!0),
              disabled: b,
              children: "允许"
            }
          ),
          /* @__PURE__ */ l(
            ee,
            {
              size: "sm",
              variant: "outline",
              className: te,
              onClick: () => xe(!1),
              disabled: b,
              children: "不允许"
            }
          )
        ] }),
        be,
        ie
      ]
    }
  );
}
const $s = ({
  toolName: e,
  argsText: t,
  result: n,
  isError: o,
  status: r,
  responseDeliveryStatus: a,
  addResult: s,
  resume: i,
  interrupt: d,
  approval: c,
  respondToApproval: u
}) => {
  const f = (r == null ? void 0 : r.type) === "incomplete" && r.reason === "cancelled", g = (r == null ? void 0 : r.type) === "requires-action", m = c != null || g && Dn(r, c, d), [b, p] = F(g), [w, h] = F(g);
  g !== w && (h(g), g && p(!0));
  const C = H(!1), R = H(null), O = H(null);
  return _e(() => {
    var z;
    const E = R.current;
    if (!E || E.isConnected || g || !C.current)
      return;
    const $ = c == null || !nt(c);
    C.current = !1;
    const { activeElement: j, body: x } = E.ownerDocument;
    $ && (j == null || j === x) && ((z = O.current) == null || z.focus({ preventScroll: !0 }));
  }, [c, g, r == null ? void 0 : r.type]), /* @__PURE__ */ I(Pn, { open: b, onOpenChange: p, children: [
    /* @__PURE__ */ l(
      En,
      {
        toolName: e,
        status: r,
        isError: o,
        responseDeliveryStatus: a
      }
    ),
    /* @__PURE__ */ I(zn, { children: [
      /* @__PURE__ */ l(jn, { status: r }),
      /* @__PURE__ */ l(
        $n,
        {
          argsText: t,
          className: _(f && "opacity-60")
        }
      ),
      m && /* @__PURE__ */ l(
        Wn,
        {
          addResult: s,
          resume: i,
          interrupt: d,
          approval: c,
          respondToApproval: u,
          status: r,
          onFocusCapture: (E) => {
            const $ = E.currentTarget.closest(
              '[data-slot="tool-fallback-root"]'
            );
            O.current = ($ == null ? void 0 : $.querySelector(
              '[data-slot="tool-fallback-trigger"]'
            )) ?? null, R.current = E.currentTarget, C.current = !0;
          },
          onBlurCapture: (E) => {
            const $ = E.relatedTarget;
            ($ ? E.currentTarget.contains($) : E.currentTarget.contains(
              E.currentTarget.ownerDocument.activeElement
            )) || (C.current = !1);
          }
        }
      ),
      /* @__PURE__ */ l(On, { result: n })
    ] })
  ] });
}, fe = Hn(
  $s
);
fe.displayName = "ToolFallback";
fe.Root = Pn;
fe.Trigger = En;
fe.Content = zn;
fe.Args = $n;
fe.Result = On;
fe.Error = jn;
fe.Approval = Wn;
const Ms = "bg-background border border-border/60 dark:bg-popover", Os = "flex items-center justify-center rounded-full text-muted-foreground outline-hidden transition-[background-color,color,scale] duration-150 hover:bg-foreground/[0.06] hover:text-foreground/90 active:scale-[0.96] focus-visible:ring-1 focus-visible:ring-foreground/20 motion-reduce:transition-none dark:hover:bg-foreground/[0.09]", Un = "font-mono text-[11px] tracking-tight";
function js(e, t, n) {
  return Number.isNaN(e) ? t : Math.min(n, Math.max(t, e));
}
function Ls({
  items: e,
  revision: t,
  title: n = "计划",
  description: o,
  maxVisible: r,
  className: a,
  ...s
}) {
  const i = e.filter((p) => p.status === "done").length, d = e.filter((p) => p.status !== "cancelled").length, c = Math.floor(
    js(r ?? e.length, 0, e.length)
  ), [u, f] = F(!1), g = Yn(), m = e.filter(
    (p, w) => w >= c && p.status !== "active" && p.status !== "failed"
  ), b = r !== void 0 && m.length > 0;
  return /* @__PURE__ */ I(
    "div",
    {
      "data-slot": "todo-list",
      className: _("flex w-full max-w-sm flex-col gap-3", a),
      ...s,
      children: [
        /* @__PURE__ */ I("div", { className: "flex items-start justify-between gap-3", children: [
          /* @__PURE__ */ I("div", { className: "min-w-0", children: [
            /* @__PURE__ */ l("span", { className: "text-[13.5px] font-medium", children: n }),
            o ? /* @__PURE__ */ l("p", { className: "text-muted-foreground text-xs leading-4 break-words", children: o }) : null
          ] }),
          /* @__PURE__ */ l(
            "span",
            {
              className: _(
                Un,
                "text-muted-foreground shrink-0 whitespace-nowrap tabular-nums"
              ),
              children: t === void 0 ? `${i}/${d}` : `${i}/${d} · 第 ${t} 版`
            }
          )
        ] }),
        /* @__PURE__ */ l("ul", { id: g, className: "flex flex-col gap-1", children: e.map((p, w) => {
          const h = b && w >= c && p.status !== "active" && p.status !== "failed", C = "fade-in slide-in-from-bottom-1 animate-in fill-mode-both flex items-start gap-2.5 py-0.5 text-[13.5px] duration-300 motion-reduce:animate-none", R = /* @__PURE__ */ I(Rt, { children: [
            /* @__PURE__ */ l(
              "span",
              {
                "aria-hidden": !0,
                className: "flex size-4 h-5 shrink-0 items-center justify-center",
                children: p.status === "done" ? /* @__PURE__ */ l("span", { className: "border-foreground/20 bg-foreground/[0.06] flex size-3.5 items-center justify-center rounded-[5px] border", children: /* @__PURE__ */ l(Ve, { className: "text-muted-foreground size-2.5" }) }) : p.status === "failed" ? /* @__PURE__ */ l("span", { className: "flex size-3.5 items-center justify-center rounded-[5px] border border-red-600/25 bg-red-600/[0.08] dark:border-red-400/25 dark:bg-red-400/[0.08]", children: /* @__PURE__ */ l(Et, { className: "size-2.5 text-red-600 dark:text-red-400" }) }) : p.status === "cancelled" ? /* @__PURE__ */ l("span", { className: "border-foreground/15 text-muted-foreground flex size-3.5 items-center justify-center rounded-[5px] border", children: /* @__PURE__ */ l(lo, { className: "size-2.5" }) }) : p.status === "active" ? /* @__PURE__ */ l(co, { className: "size-3.5 animate-spin text-blue-500 motion-reduce:animate-none dark:text-blue-400" }) : /* @__PURE__ */ l("span", { className: "border-foreground/15 size-3.5 rounded-[5px] border" })
              }
            ),
            /* @__PURE__ */ l("span", { className: "sr-only", children: p.status }),
            /* @__PURE__ */ I("div", { className: "min-w-0 flex-1 leading-5 break-words", children: [
              /* @__PURE__ */ l(
                "span",
                {
                  className: _(
                    p.status === "done" && "text-muted-foreground line-through decoration-[1.5px]",
                    p.status === "active" && "text-foreground/90",
                    p.status === "pending" && "text-muted-foreground",
                    p.status === "failed" && "text-red-600 dark:text-red-400",
                    p.status === "cancelled" && "text-muted-foreground line-through decoration-[1.5px]"
                  ),
                  children: p.text
                }
              ),
              p.status === "failed" ? p.reason ? /* @__PURE__ */ l("p", { className: "text-muted-foreground text-xs leading-4 break-words", children: p.reason }) : null : p.status !== "cancelled" && p.description ? /* @__PURE__ */ l("p", { className: "text-muted-foreground text-xs leading-4 break-words", children: p.description }) : null
            ] })
          ] });
          return h && !u ? null : /* @__PURE__ */ l(
            "li",
            {
              "data-status": p.status,
              className: C,
              children: R
            },
            p.id
          );
        }) }),
        b ? /* @__PURE__ */ l(
          Ne,
          {
            type: "button",
            "aria-expanded": u,
            "aria-controls": g,
            onClick: () => f((p) => !p),
            className: _(
              Os,
              "self-start px-2 py-1 text-xs font-medium"
            ),
            children: u ? "收起" : `还有 ${m.length} 项`
          }
        ) : null
      ]
    }
  );
}
function Fs({
  state: e,
  label: t,
  elapsed: n,
  trailing: o,
  className: r,
  ...a
}) {
  return /* @__PURE__ */ I(
    "span",
    {
      "data-slot": "agent-status",
      className: _(
        Ms,
        "flex items-center gap-2.5 rounded-full py-1.5 ps-3.5 pe-1.5",
        r
      ),
      ...a,
      children: [
        e === "done" ? /* @__PURE__ */ l(Ve, { "aria-hidden": !0, className: "size-3 shrink-0 text-emerald-500" }) : e === "failed" ? /* @__PURE__ */ l(Et, { "aria-hidden": !0, className: "text-destructive size-3 shrink-0" }) : /* @__PURE__ */ l(
          "span",
          {
            "aria-hidden": !0,
            className: _(
              "size-1.5 shrink-0 rounded-full motion-reduce:animate-none",
              e === "working" ? "animate-pulse bg-blue-500 dark:bg-blue-400" : "border-foreground/35 border"
            )
          }
        ),
        /* @__PURE__ */ l("span", { className: "sr-only", children: { working: "进行中", waiting: "等着", done: "完成", failed: "失败" }[e] }),
        /* @__PURE__ */ l(
          "span",
          {
            className: "fade-in blur-in-[2px] animate-in max-w-44 truncate text-xs duration-300 motion-reduce:animate-none",
            children: t
          },
          t
        ),
        n !== void 0 && e !== "done" && e !== "failed" && /* @__PURE__ */ l("span", { className: _(Un, "text-muted-foreground tabular-nums"), children: n }),
        /* @__PURE__ */ l(
          "span",
          {
            "aria-hidden": !0,
            "data-slot": "agent-status-trailing",
            className: "text-muted-foreground flex size-6 items-center justify-center rounded-full",
            children: o !== void 0 ? o : e === "done" || e === "failed" ? /* @__PURE__ */ l(uo, { className: "size-3" }) : /* @__PURE__ */ l(fo, { className: "size-3" })
          }
        )
      ]
    }
  );
}
const Ds = oo({ singleDollarTextMath: !0 }), It = "retainpdf-katex-css";
function Ws() {
  ce(() => {
    if (typeof document > "u" || document.getElementById(It)) return;
    const e = yo();
    if (!e) return;
    const t = document.createElement("link");
    t.id = It, t.rel = "stylesheet", t.href = e, document.head.appendChild(t);
  }, []);
}
const Vn = At(null);
function Us({ text: e, status: t }) {
  return /* @__PURE__ */ l(
    no,
    {
      className: "reader-ask-md",
      mode: "streaming",
      isAnimating: (t == null ? void 0 : t.type) === "running",
      plugins: { math: Ds },
      controls: !1,
      children: Oo(e)
    }
  );
}
function Vs({ text: e, status: t }) {
  const n = (t == null ? void 0 : t.type) === "running", o = H(null), [r, a] = F(void 0);
  return ce(() => {
    n && o.current === null && (o.current = Date.now()), !n && o.current !== null && (a(Math.max(1, Math.round((Date.now() - o.current) / 1e3))), o.current = null);
  }, [n]), /* @__PURE__ */ I(hs, { streaming: n, variant: "ghost", className: "reader-ask-reasoning", children: [
    /* @__PURE__ */ l(xs, { active: n, duration: r, label: n ? "思考中" : "思考" }),
    /* @__PURE__ */ l(ks, { "aria-busy": n, children: /* @__PURE__ */ l(ys, { children: /* @__PURE__ */ l("div", { className: "reader-ask-thought-body", children: e }) }) })
  ] });
}
const Gs = {
  allow_once: "allow-once",
  allow_always: "allow-always",
  reject_once: "reject-once",
  reject_always: "reject-always"
};
function Bs(e) {
  var d;
  const t = e.artifact || {}, n = ot(Vn);
  qn((n == null ? void 0 : n.subscribe) ?? (() => () => {
  }), (n == null ? void 0 : n.snapshot) ?? (() => 0));
  const o = n == null ? void 0 : n.get(e.toolCallId), r = o ? { type: "requires-action", reason: "interrupt" } : t.status === "failed" ? { type: "incomplete", reason: "error" } : t.status === "completed" ? { type: "complete" } : { type: "running" }, a = o ? {
    id: e.toolCallId,
    prompt: t.title || e.toolName,
    options: o.request.options.map((c) => ({ id: c.optionId, kind: Gs[c.kind] || c.kind, label: c.name }))
  } : void 0, s = o ? async (c) => {
    const u = o.request.options, f = c.optionId ? u.find((g) => g.optionId === c.optionId) : u.find((g) => c.approved ? g.kind.startsWith("allow") : g.kind.startsWith("reject"));
    o.resolve(f ? { outcome: { outcome: "selected", optionId: f.optionId } } : { outcome: { outcome: "cancelled" } });
  } : void 0, i = (d = t.locations) != null && d.length ? `
（${t.locations.join("、")}）` : "";
  return /* @__PURE__ */ l(
    fe,
    {
      ...e,
      toolName: t.title || e.toolName,
      status: r,
      isError: t.status === "failed",
      argsText: e.argsText && e.argsText !== "{}" ? e.argsText : "",
      result: t.output ? `${t.output}${i}` : e.result,
      approval: a,
      respondToApproval: s
    }
  );
}
const Hs = { pending: "pending", in_progress: "active", completed: "done" };
function Ks({ data: e }) {
  const t = e.entries.map((n, o) => ({ id: `${o}`, text: n.content, status: Hs[n.status] || "pending" }));
  return /* @__PURE__ */ l(Ls, { className: "reader-ask-plan", items: t, title: "计划", maxVisible: 6 });
}
function Ys({ data: e }) {
  const t = e.state === "idle" || e.state === "done" || e.state === "completed" ? "done" : e.state === "failed" || e.state === "error" ? "failed" : e.state === "waiting" || e.state === "paused" ? "waiting" : "working";
  return /* @__PURE__ */ l("div", { className: "reader-ask-subagent", children: /* @__PURE__ */ l(Fs, { state: t, trailing: null, label: e.description ? `${e.title} · ${e.description}` : e.title }) });
}
const qs = 1e4;
function Xs() {
  const e = Fe((o) => {
    var r;
    return ((r = o.message.status) == null ? void 0 : r.type) === "running" && o.message.parts.length === 0;
  }), [t, n] = F(!1);
  return ce(() => {
    if (n(!1), !e) return;
    const o = window.setTimeout(() => n(!0), qs);
    return () => window.clearTimeout(o);
  }, [e]), e ? /* @__PURE__ */ I("div", { className: "reader-ask-waiting", role: "status", children: [
    /* @__PURE__ */ l("span", { className: "reader-ask-dot", "aria-hidden": !0 }),
    t ? "还在等 agent 回应……" : "在想…"
  ] }) : null;
}
function Qs({ agentName: e }) {
  const t = Fe((o) => {
    var r;
    return (r = o.message.metadata) == null ? void 0 : r.custom;
  });
  if (!(t != null && t.turn)) return null;
  const n = Ro(t.turn, t.endedAt ?? null, e);
  return n ? /* @__PURE__ */ l("div", { className: "reader-ask-footer", children: n }) : null;
}
function Js() {
  return /* @__PURE__ */ l(De.Root, { className: "reader-ask-msg is-user", children: /* @__PURE__ */ l(De.Parts, {}) });
}
function Zs(e) {
  return function() {
    return /* @__PURE__ */ I(De.Root, { className: "reader-ask-msg is-assistant", children: [
      /* @__PURE__ */ l(Xs, {}),
      /* @__PURE__ */ l(
        De.Parts,
        {
          components: {
            Text: Us,
            Reasoning: Vs,
            tools: { Fallback: Bs },
            data: { by_name: { plan: Ks, subagent: Ys } }
          }
        }
      ),
      /* @__PURE__ */ l(Qs, { agentName: e() })
    ] });
  };
}
function ea({ agents: e }) {
  const t = (e || []).filter((r) => r.available === !1 && r.install), [n, o] = F("");
  return t.length ? /* @__PURE__ */ I("details", { className: "reader-ask-install", children: [
    /* @__PURE__ */ I("summary", { children: [
      "还能接本机的 ",
      t.map((r) => r.name).join("、"),
      "（要先装）"
    ] }),
    /* @__PURE__ */ l("ul", { children: t.map((r) => /* @__PURE__ */ I("li", { children: [
      /* @__PURE__ */ l("span", { children: r.name }),
      /* @__PURE__ */ l("code", { children: r.install }),
      /* @__PURE__ */ l(
        Ne,
        {
          className: "reader-ask-close",
          "aria-label": `复制「${r.name}」的安装命令`,
          title: n === r.id ? "已复制" : "复制安装命令，在终端里跑一次",
          onClick: async () => {
            await wo(r.install || "") && o(r.id);
          },
          children: /* @__PURE__ */ l(ho, { size: 13, "aria-hidden": !0 })
        }
      )
    ] }, r.id)) })
  ] }) : null;
}
function ta(e) {
  return [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · ");
}
function ma({ port: e, jobId: t, bookTitle: n, anchor: o, onClose: r, onShowAnchor: a, initialMessages: s, onTurnDone: i, onDelete: d }) {
  Ws();
  const [c, u] = F(null), [f, g] = F(""), [m, b] = F(""), p = H({ agentId: f, anchor: o });
  p.current = { agentId: f, anchor: o }, ce(() => {
    let P = !1;
    return e.listAgents().then(
      (T) => {
        P || (u(T), g((L) => {
          var U;
          return L || ((U = T.find((ne) => ne.available !== !1)) == null ? void 0 : U.id) || "";
        }));
      },
      (T) => !P && b(T instanceof Error ? T.message : String(T))
    ), () => {
      P = !0;
    };
  }, [e]);
  const w = He(() => new $o(), []), h = He(
    () => Mo({
      port: e,
      jobId: t,
      bookTitle: n,
      permissions: w,
      getAgentId: () => p.current.agentId,
      getAnchor: () => p.current.anchor
    }),
    [e, t, n, w]
  );
  ce(() => () => h.close(), [h]);
  const [C] = F(() => _o(s || [])), R = eo(h.adapter, { initialMessages: C }), O = H(i);
  O.current = i, ce(() => {
    let P = !1;
    return R.thread.subscribe(() => {
      var L;
      const T = R.thread.getState();
      if (P && !T.isRunning) {
        const U = Ot(T.messages);
        U.length && ((L = O.current) == null || L.call(O, U, p.current.agentId));
      }
      P = T.isRunning;
    });
  }, [R]);
  const E = () => {
    var P;
    return ((P = c == null ? void 0 : c.find((T) => T.id === p.current.agentId)) == null ? void 0 : P.name) || "";
  }, $ = He(() => Zs(E), [c]);
  ce(() => {
    const P = (T) => {
      var U, ne;
      if (T.key !== "Escape") return;
      const L = (ne = (U = T.target) == null ? void 0 : U.closest) == null ? void 0 : ne.call(U, "textarea, input, select");
      L && `${L.value || ""}`.trim() || (T.preventDefault(), r());
    };
    return window.addEventListener("keydown", P), () => window.removeEventListener("keydown", P);
  }, [r]);
  const j = Math.min(460, (globalThis.innerWidth || 1200) - 32), x = Math.min(620, (globalThis.innerHeight || 800) - 120), z = o.selection || o.sourceText || o.translatedText;
  return /* @__PURE__ */ l(
    Xn,
    {
      className: "reader-ask-window",
      default: { x: Math.max(16, (globalThis.innerWidth || 1200) - j - 24), y: 72, width: j, height: x },
      minWidth: 320,
      minHeight: 280,
      bounds: "window",
      dragHandleClassName: "reader-ask-head",
      cancel: ".reader-ask-head button, .reader-ask-head select, .reader-ask-head .ui-select",
      children: /* @__PURE__ */ I("section", { className: "reader-ask", role: "dialog", "aria-label": "提问", children: [
        /* @__PURE__ */ I("header", { className: "reader-ask-head", children: [
          /* @__PURE__ */ l("span", { className: "reader-ask-title", children: "提问" }),
          /* @__PURE__ */ l(Ne, { className: "reader-ask-where", title: "回到问的那一处", onClick: a, children: ta(o) }),
          /* @__PURE__ */ l(
            ko,
            {
              size: "sm",
              className: "reader-ask-agent",
              "aria-label": "用哪个 agent",
              value: f,
              onChange: (P) => g(P.target.value),
              disabled: !(c != null && c.length),
              children: (c || []).map((P) => /* @__PURE__ */ I("option", { value: P.id, disabled: P.available === !1, title: P.reason || P.description || "", children: [
                P.name,
                P.available === !1 ? "（用不了）" : ""
              ] }, P.id))
            }
          ),
          d ? /* @__PURE__ */ l(Ne, { className: "reader-ask-close", "aria-label": "删掉这次提问", title: "删掉这次提问（书页上的「?」也去掉）", onClick: d, children: /* @__PURE__ */ l(mo, { size: 14, "aria-hidden": !0 }) }) : null,
          /* @__PURE__ */ l(Ne, { className: "reader-ask-close", "aria-label": "关掉", title: "关掉（Esc）", onClick: r, children: /* @__PURE__ */ l(po, { size: 15, "aria-hidden": !0 }) })
        ] }),
        z ? /* @__PURE__ */ l("blockquote", { className: "reader-ask-quote", children: z }) : null,
        m ? /* @__PURE__ */ I("p", { className: "reader-ask-error", children: [
          "列不出能用的 agent：",
          m
        ] }) : null,
        /* @__PURE__ */ l(ea, { agents: c }),
        /* @__PURE__ */ l(Vn.Provider, { value: w, children: /* @__PURE__ */ l(to, { runtime: R, children: /* @__PURE__ */ I(we.Root, { className: "reader-ask-thread", children: [
          /* @__PURE__ */ I(we.Viewport, { className: "reader-ask-viewport", children: [
            /* @__PURE__ */ l(we.Empty, { children: /* @__PURE__ */ l("p", { className: "reader-ask-empty", children: "问这一处的问题：哪里看不懂、这个式子怎么来的、这个词什么意思……" }) }),
            /* @__PURE__ */ l(we.Messages, { components: { UserMessage: Js, AssistantMessage: $ } })
          ] }),
          /* @__PURE__ */ I(Me.Root, { className: "reader-ask-composer", children: [
            /* @__PURE__ */ l(
              Me.Input,
              {
                className: "reader-ask-input",
                placeholder: f ? "问点什么（Enter 发送，Shift+Enter 换行）" : "没有能用的 agent",
                autoFocus: !0,
                rows: 2,
                disabled: !f
              }
            ),
            /* @__PURE__ */ l(we.If, { running: !1, children: /* @__PURE__ */ l(Me.Send, { className: "reader-ask-send", "aria-label": "发送", title: "发送（Enter）", children: /* @__PURE__ */ l(go, { size: 15, "aria-hidden": !0 }) }) }),
            /* @__PURE__ */ l(we.If, { running: !0, children: /* @__PURE__ */ l(Me.Cancel, { className: "reader-ask-send", "aria-label": "停下", title: "停下", children: /* @__PURE__ */ l(bo, { size: 13, "aria-hidden": !0 }) }) })
          ] })
        ] }) }) })
      ] })
    }
  );
}
export {
  qs as ASK_SLOW_HINT_MS,
  ma as default
};
//# sourceMappingURL=ReaderAskWindow-BMkWTh5E.js.map
