var te = Object.defineProperty;
var ne = (t, e, s) => e in t ? te(t, e, { enumerable: !0, configurable: !0, writable: !0, value: s }) : t[e] = s;
var M = (t, e, s) => ne(t, typeof e != "symbol" ? e + "" : e, s);
import { jsx as i, jsxs as m } from "react/jsx-runtime";
import { useState as E, useRef as q, useEffect as P, useMemo as O, createContext as se, useContext as ae, useSyncExternalStore as re } from "react";
import { Rnd as ie } from "react-rnd";
import { useLocalRuntime as oe, AssistantRuntimeProvider as le, ThreadPrimitive as C, ComposerPrimitive as W, MessagePrimitive as L, useAuiState as Q } from "@assistant-ui/react";
import { Streamdown as ce } from "streamdown";
import { createMathPlugin as de } from "@streamdown/math";
import { Trash2 as ue, X as me, ArrowUp as he, Square as fe, Copy as pe, CircleDot as ge, Wrench as ke, Brain as Te, ChevronRight as xe } from "lucide-react";
import { Button as z, Select as ye } from "@retainpdf/ui";
import { r as Ae, c as Ne } from "./ReaderApp-jtCWfxgP.js";
function V(t) {
  return { parts: [], usage: {}, startedAt: t, firstTokenAt: null, lastTokenAt: null, chars: 0, chunks: 0 };
}
function Y(t) {
  return t.type === "text" ? t.text : t.type === "resource_link" ? t.title || t.name || t.uri : "";
}
function _e(t) {
  return (t || []).map((e) => e.type === "content" ? Y(e.content) : e.type === "diff" ? `改了 ${e.path}` : "").filter(Boolean).join(`
`);
}
function Ie(t) {
  return (t || []).map((e) => e.line != null ? `${e.path}:${e.line}` : e.path);
}
function $e(t) {
  return typeof t == "number" && Number.isFinite(t) ? t : void 0;
}
function K(t) {
  var p;
  const e = t, s = typeof (e == null ? void 0 : e["_claude/model"]) == "string" ? e["_claude/model"] : "", a = ((p = e == null ? void 0 : e.retainpdf) == null ? void 0 : p.usage) ?? (e == null ? void 0 : e.usage);
  if (!a || typeof a != "object") return s ? { model: s } : {};
  const n = (...x) => {
    for (const A of x) {
      const I = $e(a[A]);
      if (I !== void 0) return I;
    }
  }, r = {}, h = n("inputTokens", "input_tokens", "promptTokens", "prompt_tokens"), f = n("outputTokens", "output_tokens", "completionTokens", "completion_tokens"), d = n("cachedInputTokens", "cachedReadTokens", "cache_read_tokens", "cache_read_input_tokens", "cached_tokens"), c = n("cacheWriteTokens", "cachedWriteTokens", "cache_write_tokens", "cache_creation_input_tokens"), T = n("reasoningTokens", "reasoning_tokens", "thoughtTokens");
  return h !== void 0 && (r.inputTokens = h), f !== void 0 && (r.outputTokens = f), d !== void 0 && (r.cachedInputTokens = d), T !== void 0 && (r.reasoningTokens = T), c !== void 0 && (r.cacheWriteTokens = c), typeof a.model == "string" && a.model ? r.model = a.model : s && (r.model = s), r;
}
function we(t, e, s) {
  const a = t[t.length - 1];
  return a && a.type === e ? [...t.slice(0, -1), { type: e, text: a.text + s }] : [...t, { type: e, text: s }];
}
function ve(t, e, s) {
  var a;
  switch (e.sessionUpdate) {
    case "agent_message_chunk":
    case "agent_thought_chunk": {
      const n = Y(e.content);
      if (!n) return t;
      const r = e.sessionUpdate === "agent_message_chunk" ? "text" : "reasoning";
      return {
        ...t,
        parts: we(t.parts, r, n),
        chars: t.chars + n.length,
        chunks: (t.chunks || 0) + 1,
        firstTokenAt: t.firstTokenAt ?? s,
        lastTokenAt: s
      };
    }
    case "tool_call":
    case "tool_call_update": {
      const n = t.parts.findIndex((x) => x.type === "tool-call" && x.toolCallId === e.toolCallId), r = n >= 0 ? t.parts[n] : null, h = e.status || (r == null ? void 0 : r.artifact.status) || "pending", f = e.rawInput !== void 0 ? e.rawInput : r == null ? void 0 : r.args, d = f && typeof f == "object" ? f : {}, c = e.content != null ? _e(e.content) : (r == null ? void 0 : r.artifact.output) || "", T = {
        type: "tool-call",
        toolCallId: e.toolCallId,
        toolName: e.name || (r == null ? void 0 : r.toolName) || e.kind || "tool",
        args: d,
        argsText: JSON.stringify(d),
        result: e.rawOutput !== void 0 ? e.rawOutput : r == null ? void 0 : r.result,
        isError: h === "failed",
        artifact: {
          title: e.title || (r == null ? void 0 : r.artifact.title) || e.name || "工具",
          kind: e.kind || (r == null ? void 0 : r.artifact.kind) || "other",
          status: h,
          locations: e.locations != null ? Ie(e.locations) : (r == null ? void 0 : r.artifact.locations) || [],
          output: c
        }
      }, p = n >= 0 ? t.parts.map((x, A) => A === n ? T : x) : [...t.parts, T];
      return { ...t, parts: p };
    }
    case "plan": {
      const n = t.parts.findIndex((h) => h.type === "data" && h.name === "plan"), r = { type: "data", name: "plan", data: { entries: e.entries } };
      return { ...t, parts: n >= 0 ? t.parts.map((h, f) => f === n ? r : h) : [...t.parts, r] };
    }
    case "subagent_update": {
      const n = t.parts.findIndex((d) => d.type === "data" && d.name === "subagent" && d.data.id === e.sessionId), r = n >= 0 ? t.parts[n].data : null, h = ((a = e.state) == null ? void 0 : a.state) || (r == null ? void 0 : r.state) || "running", f = {
        type: "data",
        name: "subagent",
        data: {
          id: e.sessionId,
          title: e.title || (r == null ? void 0 : r.title) || "子 agent",
          description: e.description || (r == null ? void 0 : r.description) || "",
          state: h
        }
      };
      return { ...t, parts: n >= 0 ? t.parts.map((d, c) => c === n ? f : d) : [...t.parts, f] };
    }
    case "usage_update": {
      const n = { ...t.usage, contextUsed: e.used, contextSize: e.size, ...K(e._meta) };
      return e.cost && (n.cost = { amount: e.cost.amount, currency: e.cost.currency }), { ...t, usage: n };
    }
    default:
      return t;
  }
}
const D = 5;
function G(t) {
  if (t.firstTokenAt == null || t.lastTokenAt == null || (t.chunks ?? D) < D) return null;
  const e = (t.lastTokenAt - t.firstTokenAt) / 1e3;
  return e < 0.3 ? null : t.usage.outputTokens ? { value: t.usage.outputTokens / e, unit: "token/s" } : t.chars ? { value: t.chars / e, unit: "字/s" } : null;
}
function be(t, e, s = "") {
  const a = [], { usage: n } = t;
  s ? a.push(n.model ? `${s}（${n.model}）` : s) : n.model && a.push(n.model), (n.inputTokens !== void 0 || n.outputTokens !== void 0) && a.push(`输入 ${n.inputTokens ?? "?"} · 输出 ${n.outputTokens ?? "?"} token`), n.cachedInputTokens && a.push(`缓存命中 ${n.cachedInputTokens}`), n.cacheWriteTokens && a.push(`写入缓存 ${n.cacheWriteTokens}`), n.contextUsed !== void 0 && n.contextSize && a.push(`上下文 ${Math.round(n.contextUsed / n.contextSize * 100)}%`), n.cost && a.push(`${n.cost.amount.toFixed(4)} ${n.cost.currency}`);
  const r = G(t);
  return r && a.push(`${r.value.toFixed(r.value >= 10 ? 0 : 1)} ${r.unit}`), t.firstTokenAt != null && a.push(`首字 ${((t.firstTokenAt - t.startedAt) / 1e3).toFixed(1)}s`), e != null && a.push(`用时 ${((e - t.startedAt) / 1e3).toFixed(1)}s`), a.join(" · ");
}
const X = 8e3;
function F(t, e) {
  return t.filter((s) => s.type === e).map((s) => s.text || "").join("").trim();
}
function Se(t, e) {
  if (!t) return null;
  const s = { ...t.usage };
  return e != null && (s.elapsedMs = Math.round(e - t.startedAt)), t.firstTokenAt != null && (s.firstTokenMs = Math.round(t.firstTokenAt - t.startedAt)), Object.keys(s).length ? s : null;
}
function Z(t) {
  var s;
  const e = [];
  for (const a of t)
    if (a.role === "user") {
      const n = F(a.content, "text");
      n && e.push({ role: "user", text: n });
    } else if (a.role === "assistant") {
      const n = (s = a.metadata) == null ? void 0 : s.custom, r = F(a.content, "text"), h = F(a.content, "reasoning");
      if (!r && !h) continue;
      e.push({ role: "assistant", text: r, thought: h || null, usage: Se(n == null ? void 0 : n.turn, n == null ? void 0 : n.endedAt) });
    }
  return e;
}
function Me(t) {
  return t.map((e) => {
    if (e.role === "user") return { role: "user", content: e.text };
    const s = e.usage || {}, a = { ...V(0), usage: s, firstTokenAt: s.firstTokenMs ?? null };
    return {
      role: "assistant",
      content: [
        ...e.thought ? [{ type: "reasoning", text: e.thought }] : [],
        { type: "text", text: e.text }
      ],
      status: { type: "complete", reason: "stop" },
      metadata: { custom: { turn: a, endedAt: s.elapsedMs ?? void 0 } }
    };
  });
}
function Ce(t) {
  const e = Z(t).slice(-12);
  if (!e.length) return "";
  let s = e.map((a) => `${a.role === "user" ? "我" : "你"}：${a.text}`).join(`

`);
  return s.length > X && (s = `…${s.slice(-X)}`), `之前我们在这一处聊过（接着聊）：

${s}`;
}
const Ee = 4e3;
function B(t, e = Ee) {
  const s = `${t || ""}`.trim();
  return s.length > e ? `${s.slice(0, e)}…` : s;
}
function Pe(t, e, s = "") {
  const a = [], n = [`第 ${t.page} 页`, t.section ? `「${t.section}」` : ""].filter(Boolean).join("，");
  return a.push(`我在读${s ? `《${s}》` : "一本书"}，${n}（${t.pane === "source" ? "原文" : "译文"}栏）。`), t.selection && a.push("", "我选中的这段：", B(t.selection)), t.sourceText && a.push("", "这一块的原文：", B(t.sourceText)), t.translatedText && a.push("", "这一块的译文：", B(t.translatedText)), !t.selection && !t.sourceText && !t.translatedText && a.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), a.push("", `（RetainPDF 任务 ${e}${t.itemId ? `，块 ${t.itemId}` : ""}，第 ${t.page} 页）`), [{ type: "text", text: a.join(`
`) }];
}
class Re {
  constructor() {
    M(this, "pending", /* @__PURE__ */ new Map());
    M(this, "listeners", /* @__PURE__ */ new Set());
    M(this, "version", 0);
    M(this, "subscribe", (e) => (this.listeners.add(e), () => this.listeners.delete(e)));
    M(this, "snapshot", () => this.version);
  }
  add(e) {
    return new Promise((s) => {
      const a = e.toolCall.toolCallId;
      this.pending.set(a, {
        request: e,
        resolve: (n) => {
          this.pending.delete(a), this.bump(), s(n);
        }
      }), this.bump();
    });
  }
  get(e) {
    return this.pending.get(e);
  }
  all() {
    return [...this.pending.values()];
  }
  /** 关窗 / 停下时，没回的都按取消回掉，agent 不会一直等。 */
  cancelAll() {
    for (const e of [...this.pending.values()]) e.resolve({ outcome: { outcome: "cancelled" } });
  }
  bump() {
    this.version += 1;
    for (const e of this.listeners) e();
  }
}
function H(t) {
  return t.map((e) => e.type === "tool-call" ? { ...e, args: e.args } : e);
}
function je(t) {
  const e = t.now ?? (() => performance.now());
  let s = null, a = "", n = null, r = !1;
  const h = async () => {
    const d = t.getAgentId();
    return s && a === d || (s == null || s.close(), s = await t.port.openSession(
      { agentId: d, jobId: t.jobId },
      {
        onUpdate: (c) => n == null ? void 0 : n(c),
        onPermission: (c) => t.permissions.add(c)
      }
    ), a = d, r = !1), s;
  };
  return {
    adapter: {
      async *run({ messages: d, abortSignal: c }) {
        const T = d.map((o) => o.role).lastIndexOf("user"), p = T >= 0 ? d[T] : void 0, x = ((p == null ? void 0 : p.content) || []).map((o) => o.type === "text" && o.text || "").join(`
`).trim();
        let A;
        try {
          A = await h();
        } catch (o) {
          s = null;
          const k = o instanceof Error ? o.message : String(o);
          yield {
            content: [{ type: "text", text: `（连不上这个 agent：${k}）` }],
            status: { type: "incomplete", reason: "error", error: k }
          };
          return;
        }
        const I = t.getAnchor(), N = [];
        !r && I && N.push(...Pe(I, t.jobId, t.bookTitle));
        const b = !r && T > 0 ? Ce(d.slice(0, T)) : "";
        b && N.push({ type: "text", text: b }), N.push({ type: "text", text: x }), r = !0;
        let u = V(e()), g = null, y = !1;
        n = (o) => {
          u = ve(u, o, e()), y = !0, g == null || g();
        };
        const $ = () => {
          t.permissions.cancelAll(), A.cancel();
        };
        c.addEventListener("abort", $);
        let R = !1, w = null, S = "end_turn";
        A.prompt(N).then(
          (o) => {
            S = o.stopReason;
            const k = { ...K(o.meta), ...K(o.usage ? { usage: o.usage } : null) };
            Object.keys(k).length && (u = { ...u, usage: { ...u.usage, ...k } }, y = !0), R = !0, g == null || g();
          },
          (o) => {
            w = o, R = !0, g == null || g();
          }
        );
        try {
          for (; !R || y; )
            y || await new Promise((o) => g = o), g = null, y && (y = !1, yield { content: H(u.parts), metadata: { custom: { turn: u } } });
        } finally {
          c.removeEventListener("abort", $), n = null;
        }
        const j = e(), v = G(u), l = {
          streamStartTime: u.startedAt,
          firstTokenTime: u.firstTokenAt ?? void 0,
          totalStreamTime: j - u.startedAt,
          tokenCount: u.usage.outputTokens,
          tokensPerSecond: (v == null ? void 0 : v.unit) === "token/s" ? v.value : void 0,
          totalChunks: 0,
          toolCallCount: u.parts.filter((o) => o.type === "tool-call").length
        };
        if (w) {
          const o = w instanceof Error ? w.message : String(w);
          /close|closed|1011|disconnect|断/i.test(o) && (s == null || s.close(), s = null), yield {
            content: H([...u.parts, { type: "text", text: `

（出错了：${o}）` }]),
            status: { type: "incomplete", reason: "error", error: o },
            metadata: { custom: { turn: u, endedAt: j }, timing: l }
          };
          return;
        }
        yield {
          content: H(u.parts),
          status: S === "cancelled" ? { type: "incomplete", reason: "cancelled" } : S === "max_tokens" ? { type: "incomplete", reason: "length" } : { type: "complete", reason: "stop" },
          metadata: { custom: { turn: u, endedAt: j }, timing: l }
        };
      }
    },
    close() {
      t.permissions.cancelAll(), s == null || s.close(), s = null;
    }
  };
}
function ze(t) {
  return `${t || ""}`.split(/(```[\s\S]*?(?:```|$))/).map((e, s) => s % 2 ? e : e.replace(/\\\[([\s\S]*?)\\\]/g, (a, n) => `$$${n}$$`).replace(/\\\(([\s\S]*?)\\\)/g, (a, n) => `$${n}$`)).join("");
}
const Ue = de({ singleDollarTextMath: !0 }), J = "retainpdf-katex-css";
function We() {
  P(() => {
    if (typeof document > "u" || document.getElementById(J)) return;
    const t = Ae();
    if (!t) return;
    const e = document.createElement("link");
    e.id = J, e.rel = "stylesheet", e.href = t, document.head.appendChild(e);
  }, []);
}
const ee = se(null);
function Le({ text: t, status: e }) {
  return /* @__PURE__ */ i(
    ce,
    {
      className: "reader-ask-md",
      mode: "streaming",
      isAnimating: (e == null ? void 0 : e.type) === "running",
      plugins: { math: Ue },
      controls: !1,
      children: ze(t)
    }
  );
}
function Oe({ text: t, status: e }) {
  const s = (e == null ? void 0 : e.type) === "running";
  return /* @__PURE__ */ m("details", { className: "reader-ask-thought", open: s || void 0, children: [
    /* @__PURE__ */ m("summary", { children: [
      /* @__PURE__ */ i(Te, { size: 13, "aria-hidden": !0 }),
      " ",
      s ? "思考中…" : "思考过程",
      /* @__PURE__ */ i(xe, { size: 13, className: "reader-ask-chevron", "aria-hidden": !0 })
    ] }),
    /* @__PURE__ */ i("div", { className: "reader-ask-thought-body", children: t })
  ] });
}
const Fe = { pending: "等着", in_progress: "进行中", completed: "完成", failed: "失败" };
function Be(t) {
  var n;
  const e = t.artifact || {}, s = ae(ee);
  re((s == null ? void 0 : s.subscribe) ?? (() => () => {
  }), (s == null ? void 0 : s.snapshot) ?? (() => 0));
  const a = s == null ? void 0 : s.get(t.toolCallId);
  return /* @__PURE__ */ m("div", { className: "reader-ask-tool", "data-status": e.status || "pending", children: [
    /* @__PURE__ */ m("div", { className: "reader-ask-tool-head", children: [
      /* @__PURE__ */ i(ke, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ i("span", { className: "reader-ask-tool-title", title: e.title || t.toolName, children: e.title || t.toolName }),
      /* @__PURE__ */ i("span", { className: "reader-ask-tool-status", children: Fe[e.status] || e.status })
    ] }),
    (n = e.locations) != null && n.length ? /* @__PURE__ */ i("div", { className: "reader-ask-tool-where", children: e.locations.join("、") }) : null,
    e.output ? /* @__PURE__ */ i("pre", { className: "reader-ask-tool-output", children: e.output }) : null,
    a ? /* @__PURE__ */ m("div", { className: "reader-ask-permission", role: "group", "aria-label": "要你同意", children: [
      /* @__PURE__ */ i("span", { children: "要你同意才继续：" }),
      a.request.options.map((r) => /* @__PURE__ */ i(
        z,
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
const He = { pending: "○", in_progress: "◐", completed: "●" };
function Ke({ data: t }) {
  return /* @__PURE__ */ i("ol", { className: "reader-ask-plan", "aria-label": "计划", children: t.entries.map((e, s) => /* @__PURE__ */ m("li", { "data-status": e.status, children: [
    /* @__PURE__ */ i("span", { "aria-hidden": !0, children: He[e.status] || "○" }),
    " ",
    e.content
  ] }, s)) });
}
function qe({ data: t }) {
  return /* @__PURE__ */ m("div", { className: "reader-ask-subagent", "data-state": t.state, children: [
    /* @__PURE__ */ i(ge, { size: 13, "aria-hidden": !0 }),
    " ",
    /* @__PURE__ */ i("strong", { children: t.title }),
    t.description ? /* @__PURE__ */ m("span", { children: [
      " · ",
      t.description
    ] }) : null,
    /* @__PURE__ */ i("span", { className: "reader-ask-tool-status", children: t.state === "running" ? "进行中" : t.state === "idle" ? "完成" : t.state })
  ] });
}
const De = 1e4;
function Xe() {
  const t = Q((a) => {
    var n;
    return ((n = a.message.status) == null ? void 0 : n.type) === "running" && a.message.parts.length === 0;
  }), [e, s] = E(!1);
  return P(() => {
    if (s(!1), !t) return;
    const a = window.setTimeout(() => s(!0), De);
    return () => window.clearTimeout(a);
  }, [t]), t ? /* @__PURE__ */ m("div", { className: "reader-ask-waiting", role: "status", children: [
    /* @__PURE__ */ i("span", { className: "reader-ask-dot", "aria-hidden": !0 }),
    e ? "还在等 agent 回应……" : "在想…"
  ] }) : null;
}
function Je({ agentName: t }) {
  const e = Q((a) => {
    var n;
    return (n = a.message.metadata) == null ? void 0 : n.custom;
  });
  if (!(e != null && e.turn)) return null;
  const s = be(e.turn, e.endedAt ?? null, t);
  return s ? /* @__PURE__ */ i("div", { className: "reader-ask-footer", children: s }) : null;
}
function Qe() {
  return /* @__PURE__ */ i(L.Root, { className: "reader-ask-msg is-user", children: /* @__PURE__ */ i(L.Parts, {}) });
}
function Ve(t) {
  return function() {
    return /* @__PURE__ */ m(L.Root, { className: "reader-ask-msg is-assistant", children: [
      /* @__PURE__ */ i(Xe, {}),
      /* @__PURE__ */ i(
        L.Parts,
        {
          components: {
            Text: Le,
            Reasoning: Oe,
            tools: { Fallback: Be },
            data: { by_name: { plan: Ke, subagent: qe } }
          }
        }
      ),
      /* @__PURE__ */ i(Je, { agentName: t() })
    ] });
  };
}
function Ye({ agents: t }) {
  const e = (t || []).filter((n) => n.available === !1 && n.install), [s, a] = E("");
  return e.length ? /* @__PURE__ */ m("details", { className: "reader-ask-install", children: [
    /* @__PURE__ */ m("summary", { children: [
      "还能接本机的 ",
      e.map((n) => n.name).join("、"),
      "（要先装）"
    ] }),
    /* @__PURE__ */ i("ul", { children: e.map((n) => /* @__PURE__ */ m("li", { children: [
      /* @__PURE__ */ i("span", { children: n.name }),
      /* @__PURE__ */ i("code", { children: n.install }),
      /* @__PURE__ */ i(
        z,
        {
          className: "reader-ask-close",
          "aria-label": `复制「${n.name}」的安装命令`,
          title: s === n.id ? "已复制" : "复制安装命令，在终端里跑一次",
          onClick: async () => {
            await Ne(n.install || "") && a(n.id);
          },
          children: /* @__PURE__ */ i(pe, { size: 13, "aria-hidden": !0 })
        }
      )
    ] }, n.id)) })
  ] }) : null;
}
function Ge(t) {
  return [`第 ${t.page} 页`, t.section].filter(Boolean).join(" · ");
}
function ct({ port: t, jobId: e, bookTitle: s, anchor: a, onClose: n, onShowAnchor: r, initialMessages: h, onTurnDone: f, onDelete: d }) {
  We();
  const [c, T] = E(null), [p, x] = E(""), [A, I] = E(""), N = q({ agentId: p, anchor: a });
  N.current = { agentId: p, anchor: a }, P(() => {
    let l = !1;
    return t.listAgents().then(
      (o) => {
        l || (T(o), x((k) => {
          var _;
          return k || ((_ = o.find((U) => U.available !== !1)) == null ? void 0 : _.id) || "";
        }));
      },
      (o) => !l && I(o instanceof Error ? o.message : String(o))
    ), () => {
      l = !0;
    };
  }, [t]);
  const b = O(() => new Re(), []), u = O(
    () => je({
      port: t,
      jobId: e,
      bookTitle: s,
      permissions: b,
      getAgentId: () => N.current.agentId,
      getAnchor: () => N.current.anchor
    }),
    [t, e, s, b]
  );
  P(() => () => u.close(), [u]);
  const [g] = E(() => Me(h || [])), y = oe(u.adapter, { initialMessages: g }), $ = q(f);
  $.current = f, P(() => {
    let l = !1;
    return y.thread.subscribe(() => {
      var k;
      const o = y.thread.getState();
      if (l && !o.isRunning) {
        const _ = Z(o.messages);
        _.length && ((k = $.current) == null || k.call($, _, N.current.agentId));
      }
      l = o.isRunning;
    });
  }, [y]);
  const R = () => {
    var l;
    return ((l = c == null ? void 0 : c.find((o) => o.id === N.current.agentId)) == null ? void 0 : l.name) || "";
  }, w = O(() => Ve(R), [c]);
  P(() => {
    const l = (o) => {
      var _, U;
      if (o.key !== "Escape") return;
      const k = (U = (_ = o.target) == null ? void 0 : _.closest) == null ? void 0 : U.call(_, "textarea, input, select");
      k && `${k.value || ""}`.trim() || (o.preventDefault(), n());
    };
    return window.addEventListener("keydown", l), () => window.removeEventListener("keydown", l);
  }, [n]);
  const S = Math.min(460, (globalThis.innerWidth || 1200) - 32), j = Math.min(620, (globalThis.innerHeight || 800) - 120), v = a.selection || a.sourceText || a.translatedText;
  return /* @__PURE__ */ i(
    ie,
    {
      className: "reader-ask-window",
      default: { x: Math.max(16, (globalThis.innerWidth || 1200) - S - 24), y: 72, width: S, height: j },
      minWidth: 320,
      minHeight: 280,
      bounds: "window",
      dragHandleClassName: "reader-ask-head",
      cancel: ".reader-ask-head button, .reader-ask-head select, .reader-ask-head .ui-select",
      children: /* @__PURE__ */ m("section", { className: "reader-ask", role: "dialog", "aria-label": "提问", children: [
        /* @__PURE__ */ m("header", { className: "reader-ask-head", children: [
          /* @__PURE__ */ i("span", { className: "reader-ask-title", children: "提问" }),
          /* @__PURE__ */ i(z, { className: "reader-ask-where", title: "回到问的那一处", onClick: r, children: Ge(a) }),
          /* @__PURE__ */ i(
            ye,
            {
              size: "sm",
              className: "reader-ask-agent",
              "aria-label": "用哪个 agent",
              value: p,
              onChange: (l) => x(l.target.value),
              disabled: !(c != null && c.length),
              children: (c || []).map((l) => /* @__PURE__ */ m("option", { value: l.id, disabled: l.available === !1, title: l.reason || l.description || "", children: [
                l.name,
                l.available === !1 ? "（用不了）" : ""
              ] }, l.id))
            }
          ),
          d ? /* @__PURE__ */ i(z, { className: "reader-ask-close", "aria-label": "删掉这次提问", title: "删掉这次提问（书页上的「?」也去掉）", onClick: d, children: /* @__PURE__ */ i(ue, { size: 14, "aria-hidden": !0 }) }) : null,
          /* @__PURE__ */ i(z, { className: "reader-ask-close", "aria-label": "关掉", title: "关掉（Esc）", onClick: n, children: /* @__PURE__ */ i(me, { size: 15, "aria-hidden": !0 }) })
        ] }),
        v ? /* @__PURE__ */ i("blockquote", { className: "reader-ask-quote", children: v }) : null,
        A ? /* @__PURE__ */ m("p", { className: "reader-ask-error", children: [
          "列不出能用的 agent：",
          A
        ] }) : null,
        /* @__PURE__ */ i(Ye, { agents: c }),
        /* @__PURE__ */ i(ee.Provider, { value: b, children: /* @__PURE__ */ i(le, { runtime: y, children: /* @__PURE__ */ m(C.Root, { className: "reader-ask-thread", children: [
          /* @__PURE__ */ m(C.Viewport, { className: "reader-ask-viewport", children: [
            /* @__PURE__ */ i(C.Empty, { children: /* @__PURE__ */ i("p", { className: "reader-ask-empty", children: "问这一处的问题：哪里看不懂、这个式子怎么来的、这个词什么意思……" }) }),
            /* @__PURE__ */ i(C.Messages, { components: { UserMessage: Qe, AssistantMessage: w } })
          ] }),
          /* @__PURE__ */ m(W.Root, { className: "reader-ask-composer", children: [
            /* @__PURE__ */ i(
              W.Input,
              {
                className: "reader-ask-input",
                placeholder: p ? "问点什么（Enter 发送，Shift+Enter 换行）" : "没有能用的 agent",
                autoFocus: !0,
                rows: 2,
                disabled: !p
              }
            ),
            /* @__PURE__ */ i(C.If, { running: !1, children: /* @__PURE__ */ i(W.Send, { className: "reader-ask-send", "aria-label": "发送", title: "发送（Enter）", children: /* @__PURE__ */ i(he, { size: 15, "aria-hidden": !0 }) }) }),
            /* @__PURE__ */ i(C.If, { running: !0, children: /* @__PURE__ */ i(W.Cancel, { className: "reader-ask-send", "aria-label": "停下", title: "停下", children: /* @__PURE__ */ i(fe, { size: 13, "aria-hidden": !0 }) }) })
          ] })
        ] }) }) })
      ] })
    }
  );
}
export {
  De as ASK_SLOW_HINT_MS,
  ct as default
};
//# sourceMappingURL=ReaderAskWindow-kmg4CAqG.js.map
