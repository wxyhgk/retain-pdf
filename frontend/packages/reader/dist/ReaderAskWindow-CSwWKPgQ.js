var Z = Object.defineProperty;
var ee = (e, t, s) => t in e ? Z(e, t, { enumerable: !0, configurable: !0, writable: !0, value: s }) : e[t] = s;
var S = (e, t, s) => ee(e, typeof t != "symbol" ? t + "" : t, s);
import { jsx as i, jsxs as u } from "react/jsx-runtime";
import { useState as M, useRef as K, useEffect as E, useMemo as F, createContext as te, useContext as ne, useSyncExternalStore as se } from "react";
import { Rnd as ae } from "react-rnd";
import { useLocalRuntime as re, AssistantRuntimeProvider as ie, ThreadPrimitive as C, ComposerPrimitive as U, MessagePrimitive as W, useAuiState as X } from "@assistant-ui/react";
import { Streamdown as oe } from "streamdown";
import { createMathPlugin as le } from "@streamdown/math";
import { Trash2 as ce, X as de, ArrowUp as ue, Square as me, Copy as he, CircleDot as pe, Wrench as fe, Brain as ge, ChevronRight as ke } from "lucide-react";
import { Button as j, Select as Te } from "@retainpdf/ui";
import { r as xe, c as ye } from "./ReaderApp-C39-diKB.js";
function J(e) {
  return { parts: [], usage: {}, startedAt: e, firstTokenAt: null, lastTokenAt: null, chars: 0 };
}
function Q(e) {
  return e.type === "text" ? e.text : e.type === "resource_link" ? e.title || e.name || e.uri : "";
}
function Ae(e) {
  return (e || []).map((t) => t.type === "content" ? Q(t.content) : t.type === "diff" ? `改了 ${t.path}` : "").filter(Boolean).join(`
`);
}
function Ne(e) {
  return (e || []).map((t) => t.line != null ? `${t.path}:${t.line}` : t.path);
}
function Ie(e) {
  return typeof e == "number" && Number.isFinite(e) ? e : void 0;
}
function $e(e) {
  var k;
  const t = e, s = ((k = t == null ? void 0 : t.retainpdf) == null ? void 0 : k.usage) ?? (t == null ? void 0 : t.usage);
  if (!s || typeof s != "object") return {};
  const a = (...f) => {
    for (const T of f) {
      const x = Ie(s[T]);
      if (x !== void 0) return x;
    }
  }, n = {}, r = a("inputTokens", "input_tokens", "promptTokens", "prompt_tokens"), m = a("outputTokens", "output_tokens", "completionTokens", "completion_tokens"), p = a("cachedInputTokens", "cachedReadTokens", "cache_read_tokens", "cache_read_input_tokens", "cached_tokens"), d = a("cacheWriteTokens", "cache_write_tokens", "cache_creation_input_tokens"), c = a("reasoningTokens", "reasoning_tokens", "thoughtTokens");
  return r !== void 0 && (n.inputTokens = r), m !== void 0 && (n.outputTokens = m), p !== void 0 && (n.cachedInputTokens = p), c !== void 0 && (n.reasoningTokens = c), d !== void 0 && (n.cacheWriteTokens = d), typeof s.model == "string" && s.model && (n.model = s.model), n;
}
function we(e, t, s) {
  const a = e[e.length - 1];
  return a && a.type === t ? [...e.slice(0, -1), { type: t, text: a.text + s }] : [...e, { type: t, text: s }];
}
function _e(e, t, s) {
  var a;
  switch (t.sessionUpdate) {
    case "agent_message_chunk":
    case "agent_thought_chunk": {
      const n = Q(t.content);
      if (!n) return e;
      const r = t.sessionUpdate === "agent_message_chunk" ? "text" : "reasoning";
      return {
        ...e,
        parts: we(e.parts, r, n),
        chars: e.chars + n.length,
        firstTokenAt: e.firstTokenAt ?? s,
        lastTokenAt: s
      };
    }
    case "tool_call":
    case "tool_call_update": {
      const n = e.parts.findIndex((T) => T.type === "tool-call" && T.toolCallId === t.toolCallId), r = n >= 0 ? e.parts[n] : null, m = t.status || (r == null ? void 0 : r.artifact.status) || "pending", p = t.rawInput !== void 0 ? t.rawInput : r == null ? void 0 : r.args, d = p && typeof p == "object" ? p : {}, c = t.content != null ? Ae(t.content) : (r == null ? void 0 : r.artifact.output) || "", k = {
        type: "tool-call",
        toolCallId: t.toolCallId,
        toolName: t.name || (r == null ? void 0 : r.toolName) || t.kind || "tool",
        args: d,
        argsText: JSON.stringify(d),
        result: t.rawOutput !== void 0 ? t.rawOutput : r == null ? void 0 : r.result,
        isError: m === "failed",
        artifact: {
          title: t.title || (r == null ? void 0 : r.artifact.title) || t.name || "工具",
          kind: t.kind || (r == null ? void 0 : r.artifact.kind) || "other",
          status: m,
          locations: t.locations != null ? Ne(t.locations) : (r == null ? void 0 : r.artifact.locations) || [],
          output: c
        }
      }, f = n >= 0 ? e.parts.map((T, x) => x === n ? k : T) : [...e.parts, k];
      return { ...e, parts: f };
    }
    case "plan": {
      const n = e.parts.findIndex((m) => m.type === "data" && m.name === "plan"), r = { type: "data", name: "plan", data: { entries: t.entries } };
      return { ...e, parts: n >= 0 ? e.parts.map((m, p) => p === n ? r : m) : [...e.parts, r] };
    }
    case "subagent_update": {
      const n = e.parts.findIndex((d) => d.type === "data" && d.name === "subagent" && d.data.id === t.sessionId), r = n >= 0 ? e.parts[n].data : null, m = ((a = t.state) == null ? void 0 : a.state) || (r == null ? void 0 : r.state) || "running", p = {
        type: "data",
        name: "subagent",
        data: {
          id: t.sessionId,
          title: t.title || (r == null ? void 0 : r.title) || "子 agent",
          description: t.description || (r == null ? void 0 : r.description) || "",
          state: m
        }
      };
      return { ...e, parts: n >= 0 ? e.parts.map((d, c) => c === n ? p : d) : [...e.parts, p] };
    }
    case "usage_update": {
      const n = { ...e.usage, contextUsed: t.used, contextSize: t.size, ...$e(t._meta) };
      return t.cost && (n.cost = { amount: t.cost.amount, currency: t.cost.currency }), { ...e, usage: n };
    }
    default:
      return e;
  }
}
function V(e) {
  if (e.firstTokenAt == null || e.lastTokenAt == null) return null;
  const t = (e.lastTokenAt - e.firstTokenAt) / 1e3;
  return t < 0.3 ? null : e.usage.outputTokens ? { value: e.usage.outputTokens / t, unit: "token/s" } : e.chars ? { value: e.chars / t, unit: "字/s" } : null;
}
function be(e, t, s = "") {
  const a = [], { usage: n } = e;
  s ? a.push(n.model ? `${s}（${n.model}）` : s) : n.model && a.push(n.model), (n.inputTokens !== void 0 || n.outputTokens !== void 0) && a.push(`输入 ${n.inputTokens ?? "?"} · 输出 ${n.outputTokens ?? "?"} token`), n.cachedInputTokens && a.push(`缓存命中 ${n.cachedInputTokens}`), n.cacheWriteTokens && a.push(`写入缓存 ${n.cacheWriteTokens}`), n.contextUsed !== void 0 && n.contextSize && a.push(`上下文 ${Math.round(n.contextUsed / n.contextSize * 100)}%`), n.cost && a.push(`${n.cost.amount.toFixed(4)} ${n.cost.currency}`);
  const r = V(e);
  return r && a.push(`${r.value.toFixed(r.value >= 10 ? 0 : 1)} ${r.unit}`), e.firstTokenAt != null && a.push(`首字 ${((e.firstTokenAt - e.startedAt) / 1e3).toFixed(1)}s`), t != null && a.push(`用时 ${((t - e.startedAt) / 1e3).toFixed(1)}s`), a.join(" · ");
}
const q = 8e3;
function O(e, t) {
  return e.filter((s) => s.type === t).map((s) => s.text || "").join("").trim();
}
function ve(e, t) {
  if (!e) return null;
  const s = { ...e.usage };
  return t != null && (s.elapsedMs = Math.round(t - e.startedAt)), e.firstTokenAt != null && (s.firstTokenMs = Math.round(e.firstTokenAt - e.startedAt)), Object.keys(s).length ? s : null;
}
function Y(e) {
  var s;
  const t = [];
  for (const a of e)
    if (a.role === "user") {
      const n = O(a.content, "text");
      n && t.push({ role: "user", text: n });
    } else if (a.role === "assistant") {
      const n = (s = a.metadata) == null ? void 0 : s.custom, r = O(a.content, "text"), m = O(a.content, "reasoning");
      if (!r && !m) continue;
      t.push({ role: "assistant", text: r, thought: m || null, usage: ve(n == null ? void 0 : n.turn, n == null ? void 0 : n.endedAt) });
    }
  return t;
}
function Se(e) {
  return e.map((t) => {
    if (t.role === "user") return { role: "user", content: t.text };
    const s = t.usage || {}, a = { ...J(0), usage: s, firstTokenAt: s.firstTokenMs ?? null };
    return {
      role: "assistant",
      content: [
        ...t.thought ? [{ type: "reasoning", text: t.thought }] : [],
        { type: "text", text: t.text }
      ],
      status: { type: "complete", reason: "stop" },
      metadata: { custom: { turn: a, endedAt: s.elapsedMs ?? void 0 } }
    };
  });
}
function Ce(e) {
  const t = Y(e).slice(-12);
  if (!t.length) return "";
  let s = t.map((a) => `${a.role === "user" ? "我" : "你"}：${a.text}`).join(`

`);
  return s.length > q && (s = `…${s.slice(-q)}`), `之前我们在这一处聊过（接着聊）：

${s}`;
}
const Me = 4e3;
function B(e, t = Me) {
  const s = `${e || ""}`.trim();
  return s.length > t ? `${s.slice(0, t)}…` : s;
}
function Ee(e, t, s = "") {
  const a = [], n = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return a.push(`我在读${s ? `《${s}》` : "一本书"}，${n}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && a.push("", "我选中的这段：", B(e.selection)), e.sourceText && a.push("", "这一块的原文：", B(e.sourceText)), e.translatedText && a.push("", "这一块的译文：", B(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && a.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), a.push("", `（RetainPDF 任务 ${t}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), [{ type: "text", text: a.join(`
`) }];
}
class Re {
  constructor() {
    S(this, "pending", /* @__PURE__ */ new Map());
    S(this, "listeners", /* @__PURE__ */ new Set());
    S(this, "version", 0);
    S(this, "subscribe", (t) => (this.listeners.add(t), () => this.listeners.delete(t)));
    S(this, "snapshot", () => this.version);
  }
  add(t) {
    return new Promise((s) => {
      const a = t.toolCall.toolCallId;
      this.pending.set(a, {
        request: t,
        resolve: (n) => {
          this.pending.delete(a), this.bump(), s(n);
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
function H(e) {
  return e.map((t) => t.type === "tool-call" ? { ...t, args: t.args } : t);
}
function Pe(e) {
  const t = e.now ?? (() => performance.now());
  let s = null, a = "", n = null, r = !1;
  const m = async () => {
    const d = e.getAgentId();
    return s && a === d || (s == null || s.close(), s = await e.port.openSession(
      { agentId: d, jobId: e.jobId },
      {
        onUpdate: (c) => n == null ? void 0 : n(c),
        onPermission: (c) => e.permissions.add(c)
      }
    ), a = d, r = !1), s;
  };
  return {
    adapter: {
      async *run({ messages: d, abortSignal: c }) {
        const k = d.map((o) => o.role).lastIndexOf("user"), f = k >= 0 ? d[k] : void 0, T = ((f == null ? void 0 : f.content) || []).map((o) => o.type === "text" && o.text || "").join(`
`).trim();
        let x;
        try {
          x = await m();
        } catch (o) {
          s = null;
          const N = o instanceof Error ? o.message : String(o);
          yield {
            content: [{ type: "text", text: `（连不上这个 agent：${N}）` }],
            status: { type: "incomplete", reason: "error", error: N }
          };
          return;
        }
        const z = e.getAnchor(), y = [];
        !r && z && y.push(...Ee(z, e.jobId, e.bookTitle));
        const b = !r && k > 0 ? Ce(d.slice(0, k)) : "";
        b && y.push({ type: "text", text: b }), y.push({ type: "text", text: T }), r = !0;
        let h = J(t()), g = null, A = !1;
        n = (o) => {
          h = _e(h, o, t()), A = !0, g == null || g();
        };
        const $ = () => {
          e.permissions.cancelAll(), x.cancel();
        };
        c.addEventListener("abort", $);
        let R = !1, w = null, v = "end_turn";
        x.prompt(y).then(
          (o) => {
            v = o.stopReason, R = !0, g == null || g();
          },
          (o) => {
            w = o, R = !0, g == null || g();
          }
        );
        try {
          for (; !R || A; )
            A || await new Promise((o) => g = o), g = null, A && (A = !1, yield { content: H(h.parts), metadata: { custom: { turn: h } } });
        } finally {
          c.removeEventListener("abort", $), n = null;
        }
        const P = t(), _ = V(h), l = {
          streamStartTime: h.startedAt,
          firstTokenTime: h.firstTokenAt ?? void 0,
          totalStreamTime: P - h.startedAt,
          tokenCount: h.usage.outputTokens,
          tokensPerSecond: (_ == null ? void 0 : _.unit) === "token/s" ? _.value : void 0,
          totalChunks: 0,
          toolCallCount: h.parts.filter((o) => o.type === "tool-call").length
        };
        if (w) {
          const o = w instanceof Error ? w.message : String(w);
          /close|closed|1011|disconnect|断/i.test(o) && (s == null || s.close(), s = null), yield {
            content: H([...h.parts, { type: "text", text: `

（出错了：${o}）` }]),
            status: { type: "incomplete", reason: "error", error: o },
            metadata: { custom: { turn: h, endedAt: P }, timing: l }
          };
          return;
        }
        yield {
          content: H(h.parts),
          status: v === "cancelled" ? { type: "incomplete", reason: "cancelled" } : v === "max_tokens" ? { type: "incomplete", reason: "length" } : { type: "complete", reason: "stop" },
          metadata: { custom: { turn: h, endedAt: P }, timing: l }
        };
      }
    },
    close() {
      e.permissions.cancelAll(), s == null || s.close(), s = null;
    }
  };
}
function je(e) {
  return `${e || ""}`.split(/(```[\s\S]*?(?:```|$))/).map((t, s) => s % 2 ? t : t.replace(/\\\[([\s\S]*?)\\\]/g, (a, n) => `$$${n}$$`).replace(/\\\(([\s\S]*?)\\\)/g, (a, n) => `$${n}$`)).join("");
}
const ze = le({ singleDollarTextMath: !0 }), D = "retainpdf-katex-css";
function Le() {
  E(() => {
    if (typeof document > "u" || document.getElementById(D)) return;
    const e = xe();
    if (!e) return;
    const t = document.createElement("link");
    t.id = D, t.rel = "stylesheet", t.href = e, document.head.appendChild(t);
  }, []);
}
const G = te(null);
function Ue({ text: e, status: t }) {
  return /* @__PURE__ */ i(
    oe,
    {
      className: "reader-ask-md",
      mode: "streaming",
      isAnimating: (t == null ? void 0 : t.type) === "running",
      plugins: { math: ze },
      controls: !1,
      children: je(e)
    }
  );
}
function We({ text: e, status: t }) {
  const s = (t == null ? void 0 : t.type) === "running";
  return /* @__PURE__ */ u("details", { className: "reader-ask-thought", open: s || void 0, children: [
    /* @__PURE__ */ u("summary", { children: [
      /* @__PURE__ */ i(ge, { size: 13, "aria-hidden": !0 }),
      " ",
      s ? "思考中…" : "思考过程",
      /* @__PURE__ */ i(ke, { size: 13, className: "reader-ask-chevron", "aria-hidden": !0 })
    ] }),
    /* @__PURE__ */ i("div", { className: "reader-ask-thought-body", children: e })
  ] });
}
const Fe = { pending: "等着", in_progress: "进行中", completed: "完成", failed: "失败" };
function Oe(e) {
  var n;
  const t = e.artifact || {}, s = ne(G);
  se((s == null ? void 0 : s.subscribe) ?? (() => () => {
  }), (s == null ? void 0 : s.snapshot) ?? (() => 0));
  const a = s == null ? void 0 : s.get(e.toolCallId);
  return /* @__PURE__ */ u("div", { className: "reader-ask-tool", "data-status": t.status || "pending", children: [
    /* @__PURE__ */ u("div", { className: "reader-ask-tool-head", children: [
      /* @__PURE__ */ i(fe, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ i("span", { className: "reader-ask-tool-title", children: t.title || e.toolName }),
      /* @__PURE__ */ i("span", { className: "reader-ask-tool-status", children: Fe[t.status] || t.status })
    ] }),
    (n = t.locations) != null && n.length ? /* @__PURE__ */ i("div", { className: "reader-ask-tool-where", children: t.locations.join("、") }) : null,
    t.output ? /* @__PURE__ */ i("pre", { className: "reader-ask-tool-output", children: t.output }) : null,
    a ? /* @__PURE__ */ u("div", { className: "reader-ask-permission", role: "group", "aria-label": "要你同意", children: [
      /* @__PURE__ */ i("span", { children: "要你同意才继续：" }),
      a.request.options.map((r) => /* @__PURE__ */ i(
        j,
        {
          className: "reader-ask-permission-option",
          "data-kind": r.kind,
          onClick: () => a.resolve({ outcome: { outcome: "selected", optionId: r.optionId } }),
          children: r.name
        },
        r.optionId
      ))
    ] }) : null
  ] });
}
const Be = { pending: "○", in_progress: "◐", completed: "●" };
function He({ data: e }) {
  return /* @__PURE__ */ i("ol", { className: "reader-ask-plan", "aria-label": "计划", children: e.entries.map((t, s) => /* @__PURE__ */ u("li", { "data-status": t.status, children: [
    /* @__PURE__ */ i("span", { "aria-hidden": !0, children: Be[t.status] || "○" }),
    " ",
    t.content
  ] }, s)) });
}
function Ke({ data: e }) {
  return /* @__PURE__ */ u("div", { className: "reader-ask-subagent", "data-state": e.state, children: [
    /* @__PURE__ */ i(pe, { size: 13, "aria-hidden": !0 }),
    " ",
    /* @__PURE__ */ i("strong", { children: e.title }),
    e.description ? /* @__PURE__ */ u("span", { children: [
      " · ",
      e.description
    ] }) : null,
    /* @__PURE__ */ i("span", { className: "reader-ask-tool-status", children: e.state === "running" ? "进行中" : e.state === "idle" ? "完成" : e.state })
  ] });
}
const qe = 1e4;
function De() {
  const e = X((a) => {
    var n;
    return ((n = a.message.status) == null ? void 0 : n.type) === "running" && a.message.parts.length === 0;
  }), [t, s] = M(!1);
  return E(() => {
    if (s(!1), !e) return;
    const a = window.setTimeout(() => s(!0), qe);
    return () => window.clearTimeout(a);
  }, [e]), e ? /* @__PURE__ */ u("div", { className: "reader-ask-waiting", role: "status", children: [
    /* @__PURE__ */ i("span", { className: "reader-ask-dot", "aria-hidden": !0 }),
    t ? "还在等 agent 回应……" : "在想…"
  ] }) : null;
}
function Xe({ agentName: e }) {
  const t = X((a) => {
    var n;
    return (n = a.message.metadata) == null ? void 0 : n.custom;
  });
  if (!(t != null && t.turn)) return null;
  const s = be(t.turn, t.endedAt ?? null, e);
  return s ? /* @__PURE__ */ i("div", { className: "reader-ask-footer", children: s }) : null;
}
function Je() {
  return /* @__PURE__ */ i(W.Root, { className: "reader-ask-msg is-user", children: /* @__PURE__ */ i(W.Parts, {}) });
}
function Qe(e) {
  return function() {
    return /* @__PURE__ */ u(W.Root, { className: "reader-ask-msg is-assistant", children: [
      /* @__PURE__ */ i(De, {}),
      /* @__PURE__ */ i(
        W.Parts,
        {
          components: {
            Text: Ue,
            Reasoning: We,
            tools: { Fallback: Oe },
            data: { by_name: { plan: He, subagent: Ke } }
          }
        }
      ),
      /* @__PURE__ */ i(Xe, { agentName: e() })
    ] });
  };
}
function Ve({ agents: e }) {
  const t = (e || []).filter((n) => n.available === !1 && n.install), [s, a] = M("");
  return t.length ? /* @__PURE__ */ u("details", { className: "reader-ask-install", children: [
    /* @__PURE__ */ u("summary", { children: [
      "还能接本机的 ",
      t.map((n) => n.name).join("、"),
      "（要先装）"
    ] }),
    /* @__PURE__ */ i("ul", { children: t.map((n) => /* @__PURE__ */ u("li", { children: [
      /* @__PURE__ */ i("span", { children: n.name }),
      /* @__PURE__ */ i("code", { children: n.install }),
      /* @__PURE__ */ i(
        j,
        {
          className: "reader-ask-close",
          "aria-label": `复制「${n.name}」的安装命令`,
          title: s === n.id ? "已复制" : "复制安装命令，在终端里跑一次",
          onClick: async () => {
            await ye(n.install || "") && a(n.id);
          },
          children: /* @__PURE__ */ i(he, { size: 13, "aria-hidden": !0 })
        }
      )
    ] }, n.id)) })
  ] }) : null;
}
function Ye(e) {
  return [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · ");
}
function lt({ port: e, jobId: t, bookTitle: s, anchor: a, onClose: n, onShowAnchor: r, initialMessages: m, onTurnDone: p, onDelete: d }) {
  Le();
  const [c, k] = M(null), [f, T] = M(""), [x, z] = M(""), y = K({ agentId: f, anchor: a });
  y.current = { agentId: f, anchor: a }, E(() => {
    let l = !1;
    return e.listAgents().then(
      (o) => {
        l || (k(o), T((N) => {
          var I;
          return N || ((I = o.find((L) => L.available !== !1)) == null ? void 0 : I.id) || "";
        }));
      },
      (o) => !l && z(o instanceof Error ? o.message : String(o))
    ), () => {
      l = !0;
    };
  }, [e]);
  const b = F(() => new Re(), []), h = F(
    () => Pe({
      port: e,
      jobId: t,
      bookTitle: s,
      permissions: b,
      getAgentId: () => y.current.agentId,
      getAnchor: () => y.current.anchor
    }),
    [e, t, s, b]
  );
  E(() => () => h.close(), [h]);
  const [g] = M(() => Se(m || [])), A = re(h.adapter, { initialMessages: g }), $ = K(p);
  $.current = p, E(() => {
    let l = !1;
    return A.thread.subscribe(() => {
      var N;
      const o = A.thread.getState();
      if (l && !o.isRunning) {
        const I = Y(o.messages);
        I.length && ((N = $.current) == null || N.call($, I, y.current.agentId));
      }
      l = o.isRunning;
    });
  }, [A]);
  const R = () => {
    var l;
    return ((l = c == null ? void 0 : c.find((o) => o.id === y.current.agentId)) == null ? void 0 : l.name) || "";
  }, w = F(() => Qe(R), [c]);
  E(() => {
    const l = (o) => {
      var I, L;
      if (o.key !== "Escape") return;
      const N = (L = (I = o.target) == null ? void 0 : I.closest) == null ? void 0 : L.call(I, "textarea, input, select");
      N && `${N.value || ""}`.trim() || (o.preventDefault(), n());
    };
    return window.addEventListener("keydown", l), () => window.removeEventListener("keydown", l);
  }, [n]);
  const v = Math.min(460, (globalThis.innerWidth || 1200) - 32), P = Math.min(620, (globalThis.innerHeight || 800) - 120), _ = a.selection || a.sourceText || a.translatedText;
  return /* @__PURE__ */ i(
    ae,
    {
      className: "reader-ask-window",
      default: { x: Math.max(16, (globalThis.innerWidth || 1200) - v - 24), y: 72, width: v, height: P },
      minWidth: 320,
      minHeight: 280,
      bounds: "window",
      dragHandleClassName: "reader-ask-head",
      cancel: ".reader-ask-head button, .reader-ask-head select, .reader-ask-head .ui-select",
      children: /* @__PURE__ */ u("section", { className: "reader-ask", role: "dialog", "aria-label": "提问", children: [
        /* @__PURE__ */ u("header", { className: "reader-ask-head", children: [
          /* @__PURE__ */ i("span", { className: "reader-ask-title", children: "提问" }),
          /* @__PURE__ */ i(j, { className: "reader-ask-where", title: "回到问的那一处", onClick: r, children: Ye(a) }),
          /* @__PURE__ */ i(
            Te,
            {
              size: "sm",
              className: "reader-ask-agent",
              "aria-label": "用哪个 agent",
              value: f,
              onChange: (l) => T(l.target.value),
              disabled: !(c != null && c.length),
              children: (c || []).map((l) => /* @__PURE__ */ u("option", { value: l.id, disabled: l.available === !1, title: l.reason || l.description || "", children: [
                l.name,
                l.available === !1 ? "（用不了）" : ""
              ] }, l.id))
            }
          ),
          d ? /* @__PURE__ */ i(j, { className: "reader-ask-close", "aria-label": "删掉这次提问", title: "删掉这次提问（书页上的「?」也去掉）", onClick: d, children: /* @__PURE__ */ i(ce, { size: 14, "aria-hidden": !0 }) }) : null,
          /* @__PURE__ */ i(j, { className: "reader-ask-close", "aria-label": "关掉", title: "关掉（Esc）", onClick: n, children: /* @__PURE__ */ i(de, { size: 15, "aria-hidden": !0 }) })
        ] }),
        _ ? /* @__PURE__ */ i("blockquote", { className: "reader-ask-quote", children: _ }) : null,
        x ? /* @__PURE__ */ u("p", { className: "reader-ask-error", children: [
          "列不出能用的 agent：",
          x
        ] }) : null,
        /* @__PURE__ */ i(Ve, { agents: c }),
        /* @__PURE__ */ i(G.Provider, { value: b, children: /* @__PURE__ */ i(ie, { runtime: A, children: /* @__PURE__ */ u(C.Root, { className: "reader-ask-thread", children: [
          /* @__PURE__ */ u(C.Viewport, { className: "reader-ask-viewport", children: [
            /* @__PURE__ */ i(C.Empty, { children: /* @__PURE__ */ i("p", { className: "reader-ask-empty", children: "问这一处的问题：哪里看不懂、这个式子怎么来的、这个词什么意思……" }) }),
            /* @__PURE__ */ i(C.Messages, { components: { UserMessage: Je, AssistantMessage: w } })
          ] }),
          /* @__PURE__ */ u(U.Root, { className: "reader-ask-composer", children: [
            /* @__PURE__ */ i(
              U.Input,
              {
                className: "reader-ask-input",
                placeholder: f ? "问点什么（Enter 发送，Shift+Enter 换行）" : "没有能用的 agent",
                autoFocus: !0,
                rows: 2,
                disabled: !f
              }
            ),
            /* @__PURE__ */ i(C.If, { running: !1, children: /* @__PURE__ */ i(U.Send, { className: "reader-ask-send", "aria-label": "发送", title: "发送（Enter）", children: /* @__PURE__ */ i(ue, { size: 15, "aria-hidden": !0 }) }) }),
            /* @__PURE__ */ i(C.If, { running: !0, children: /* @__PURE__ */ i(U.Cancel, { className: "reader-ask-send", "aria-label": "停下", title: "停下", children: /* @__PURE__ */ i(me, { size: 13, "aria-hidden": !0 }) }) })
          ] })
        ] }) }) })
      ] })
    }
  );
}
export {
  qe as ASK_SLOW_HINT_MS,
  lt as default
};
//# sourceMappingURL=ReaderAskWindow-CSwWKPgQ.js.map
