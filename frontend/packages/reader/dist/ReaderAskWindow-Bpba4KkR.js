var X = Object.defineProperty;
var J = (e, t, s) => t in e ? X(e, t, { enumerable: !0, configurable: !0, writable: !0, value: s }) : e[t] = s;
var v = (e, t, s) => J(e, typeof t != "symbol" ? t + "" : t, s);
import { jsx as o, jsxs as m } from "react/jsx-runtime";
import { useState as j, useRef as B, useEffect as E, useMemo as F, createContext as Q, useContext as V, useSyncExternalStore as G } from "react";
import { Rnd as Y } from "react-rnd";
import { useLocalRuntime as Z, AssistantRuntimeProvider as ee, ThreadPrimitive as w, ComposerPrimitive as R, MessagePrimitive as z, useAuiState as D } from "@assistant-ui/react";
import { Streamdown as te } from "streamdown";
import { createMathPlugin as ne } from "@streamdown/math";
import { X as se, ArrowUp as ae, Square as re, CircleDot as oe, Wrench as ie, Brain as le, ChevronRight as ce } from "lucide-react";
import { Button as W, Select as de } from "@retainpdf/ui";
import { r as ue } from "./ReaderApp-CL9JXaUM.js";
function me(e) {
  return { parts: [], usage: {}, startedAt: e, firstTokenAt: null, lastTokenAt: null, chars: 0 };
}
function K(e) {
  return e.type === "text" ? e.text : e.type === "resource_link" ? e.title || e.name || e.uri : "";
}
function he(e) {
  return (e || []).map((t) => t.type === "content" ? K(t.content) : t.type === "diff" ? `改了 ${t.path}` : "").filter(Boolean).join(`
`);
}
function pe(e) {
  return (e || []).map((t) => t.line != null ? `${t.path}:${t.line}` : t.path);
}
function fe(e) {
  return typeof e == "number" && Number.isFinite(e) ? e : void 0;
}
function ge(e) {
  var f;
  const t = e, s = ((f = t == null ? void 0 : t.retainpdf) == null ? void 0 : f.usage) ?? (t == null ? void 0 : t.usage);
  if (!s || typeof s != "object") return {};
  const r = (...y) => {
    for (const k of y) {
      const x = fe(s[k]);
      if (x !== void 0) return x;
    }
  }, n = {}, a = r("inputTokens", "input_tokens", "promptTokens", "prompt_tokens"), u = r("outputTokens", "output_tokens", "completionTokens", "completion_tokens"), h = r("cachedInputTokens", "cachedReadTokens", "cache_read_tokens", "cache_read_input_tokens", "cached_tokens"), l = r("cacheWriteTokens", "cache_write_tokens", "cache_creation_input_tokens"), p = r("reasoningTokens", "reasoning_tokens", "thoughtTokens");
  return a !== void 0 && (n.inputTokens = a), u !== void 0 && (n.outputTokens = u), h !== void 0 && (n.cachedInputTokens = h), p !== void 0 && (n.reasoningTokens = p), l !== void 0 && (n.cacheWriteTokens = l), typeof s.model == "string" && s.model && (n.model = s.model), n;
}
function ke(e, t, s) {
  const r = e[e.length - 1];
  return r && r.type === t ? [...e.slice(0, -1), { type: t, text: r.text + s }] : [...e, { type: t, text: s }];
}
function Te(e, t, s) {
  var r;
  switch (t.sessionUpdate) {
    case "agent_message_chunk":
    case "agent_thought_chunk": {
      const n = K(t.content);
      if (!n) return e;
      const a = t.sessionUpdate === "agent_message_chunk" ? "text" : "reasoning";
      return {
        ...e,
        parts: ke(e.parts, a, n),
        chars: e.chars + n.length,
        firstTokenAt: e.firstTokenAt ?? s,
        lastTokenAt: s
      };
    }
    case "tool_call":
    case "tool_call_update": {
      const n = e.parts.findIndex((k) => k.type === "tool-call" && k.toolCallId === t.toolCallId), a = n >= 0 ? e.parts[n] : null, u = t.status || (a == null ? void 0 : a.artifact.status) || "pending", h = t.rawInput !== void 0 ? t.rawInput : a == null ? void 0 : a.args, l = h && typeof h == "object" ? h : {}, p = t.content != null ? he(t.content) : (a == null ? void 0 : a.artifact.output) || "", f = {
        type: "tool-call",
        toolCallId: t.toolCallId,
        toolName: t.name || (a == null ? void 0 : a.toolName) || t.kind || "tool",
        args: l,
        argsText: JSON.stringify(l),
        result: t.rawOutput !== void 0 ? t.rawOutput : a == null ? void 0 : a.result,
        isError: u === "failed",
        artifact: {
          title: t.title || (a == null ? void 0 : a.artifact.title) || t.name || "工具",
          kind: t.kind || (a == null ? void 0 : a.artifact.kind) || "other",
          status: u,
          locations: t.locations != null ? pe(t.locations) : (a == null ? void 0 : a.artifact.locations) || [],
          output: p
        }
      }, y = n >= 0 ? e.parts.map((k, x) => x === n ? f : k) : [...e.parts, f];
      return { ...e, parts: y };
    }
    case "plan": {
      const n = e.parts.findIndex((u) => u.type === "data" && u.name === "plan"), a = { type: "data", name: "plan", data: { entries: t.entries } };
      return { ...e, parts: n >= 0 ? e.parts.map((u, h) => h === n ? a : u) : [...e.parts, a] };
    }
    case "subagent_update": {
      const n = e.parts.findIndex((l) => l.type === "data" && l.name === "subagent" && l.data.id === t.sessionId), a = n >= 0 ? e.parts[n].data : null, u = ((r = t.state) == null ? void 0 : r.state) || (a == null ? void 0 : a.state) || "running", h = {
        type: "data",
        name: "subagent",
        data: {
          id: t.sessionId,
          title: t.title || (a == null ? void 0 : a.title) || "子 agent",
          description: t.description || (a == null ? void 0 : a.description) || "",
          state: u
        }
      };
      return { ...e, parts: n >= 0 ? e.parts.map((l, p) => p === n ? h : l) : [...e.parts, h] };
    }
    case "usage_update": {
      const n = { ...e.usage, contextUsed: t.used, contextSize: t.size, ...ge(t._meta) };
      return t.cost && (n.cost = { amount: t.cost.amount, currency: t.cost.currency }), { ...e, usage: n };
    }
    default:
      return e;
  }
}
function q(e) {
  if (e.firstTokenAt == null || e.lastTokenAt == null) return null;
  const t = (e.lastTokenAt - e.firstTokenAt) / 1e3;
  return t < 0.3 ? null : e.usage.outputTokens ? { value: e.usage.outputTokens / t, unit: "token/s" } : e.chars ? { value: e.chars / t, unit: "字/s" } : null;
}
function xe(e, t, s = "") {
  const r = [], { usage: n } = e;
  s ? r.push(n.model ? `${s}（${n.model}）` : s) : n.model && r.push(n.model), (n.inputTokens !== void 0 || n.outputTokens !== void 0) && r.push(`输入 ${n.inputTokens ?? "?"} · 输出 ${n.outputTokens ?? "?"} token`), n.cachedInputTokens && r.push(`缓存命中 ${n.cachedInputTokens}`), n.cacheWriteTokens && r.push(`写入缓存 ${n.cacheWriteTokens}`), n.contextUsed !== void 0 && n.contextSize && r.push(`上下文 ${Math.round(n.contextUsed / n.contextSize * 100)}%`), n.cost && r.push(`${n.cost.amount.toFixed(4)} ${n.cost.currency}`);
  const a = q(e);
  return a && r.push(`${a.value.toFixed(a.value >= 10 ? 0 : 1)} ${a.unit}`), e.firstTokenAt != null && r.push(`首字 ${((e.firstTokenAt - e.startedAt) / 1e3).toFixed(1)}s`), t != null && r.push(`用时 ${((t - e.startedAt) / 1e3).toFixed(1)}s`), r.join(" · ");
}
const ye = 4e3;
function L(e, t = ye) {
  const s = `${e || ""}`.trim();
  return s.length > t ? `${s.slice(0, t)}…` : s;
}
function Ae(e, t, s = "") {
  const r = [], n = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return r.push(`我在读${s ? `《${s}》` : "一本书"}，${n}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && r.push("", "我选中的这段：", L(e.selection)), e.sourceText && r.push("", "这一块的原文：", L(e.sourceText)), e.translatedText && r.push("", "这一块的译文：", L(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && r.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), r.push("", `（RetainPDF 任务 ${t}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), [{ type: "text", text: r.join(`
`) }];
}
class Ne {
  constructor() {
    v(this, "pending", /* @__PURE__ */ new Map());
    v(this, "listeners", /* @__PURE__ */ new Set());
    v(this, "version", 0);
    v(this, "subscribe", (t) => (this.listeners.add(t), () => this.listeners.delete(t)));
    v(this, "snapshot", () => this.version);
  }
  add(t) {
    return new Promise((s) => {
      const r = t.toolCall.toolCallId;
      this.pending.set(r, {
        request: t,
        resolve: (n) => {
          this.pending.delete(r), this.bump(), s(n);
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
function U(e) {
  return e.map((t) => t.type === "tool-call" ? { ...t, args: t.args } : t);
}
function _e(e) {
  const t = e.now ?? (() => performance.now());
  let s = null, r = "", n = null, a = !1;
  const u = async () => {
    const l = e.getAgentId();
    return s && r === l || (s == null || s.close(), s = await e.port.openSession(
      { agentId: l, jobId: e.jobId },
      {
        onUpdate: (p) => n == null ? void 0 : n(p),
        onPermission: (p) => e.permissions.add(p)
      }
    ), r = l, a = !1), s;
  };
  return {
    adapter: {
      async *run({ messages: l, abortSignal: p }) {
        const f = [...l].reverse().find((i) => i.role === "user"), y = ((f == null ? void 0 : f.content) || []).map((i) => i.type === "text" && i.text || "").join(`
`).trim(), k = await u(), x = e.getAnchor(), A = [];
        !a && x && A.push(...Ae(x, e.jobId, e.bookTitle)), A.push({ type: "text", text: y }), a = !0;
        let d = me(t()), g = null, T = !1;
        n = (i) => {
          d = Te(d, i, t()), T = !0, g == null || g();
        };
        const N = () => {
          e.permissions.cancelAll(), k.cancel();
        };
        p.addEventListener("abort", N);
        let S = !1, _ = null, b = "end_turn";
        k.prompt(A).then(
          (i) => {
            b = i.stopReason, S = !0, g == null || g();
          },
          (i) => {
            _ = i, S = !0, g == null || g();
          }
        );
        try {
          for (; !S || T; )
            T || await new Promise((i) => g = i), g = null, T && (T = !1, yield { content: U(d.parts), metadata: { custom: { turn: d } } });
        } finally {
          p.removeEventListener("abort", N), n = null;
        }
        const C = t(), $ = q(d), c = {
          streamStartTime: d.startedAt,
          firstTokenTime: d.firstTokenAt ?? void 0,
          totalStreamTime: C - d.startedAt,
          tokenCount: d.usage.outputTokens,
          tokensPerSecond: ($ == null ? void 0 : $.unit) === "token/s" ? $.value : void 0,
          totalChunks: 0,
          toolCallCount: d.parts.filter((i) => i.type === "tool-call").length
        };
        if (_) {
          const i = _ instanceof Error ? _.message : String(_);
          yield {
            content: U([...d.parts, { type: "text", text: `

（出错了：${i}）` }]),
            status: { type: "incomplete", reason: "error", error: i },
            metadata: { custom: { turn: d, endedAt: C }, timing: c }
          };
          return;
        }
        yield {
          content: U(d.parts),
          status: b === "cancelled" ? { type: "incomplete", reason: "cancelled" } : b === "max_tokens" ? { type: "incomplete", reason: "length" } : { type: "complete", reason: "stop" },
          metadata: { custom: { turn: d, endedAt: C }, timing: c }
        };
      }
    },
    close() {
      e.permissions.cancelAll(), s == null || s.close(), s = null;
    }
  };
}
function $e(e) {
  return `${e || ""}`.split(/(```[\s\S]*?(?:```|$))/).map((t, s) => s % 2 ? t : t.replace(/\\\[([\s\S]*?)\\\]/g, (r, n) => `$$${n}$$`).replace(/\\\(([\s\S]*?)\\\)/g, (r, n) => `$${n}$`)).join("");
}
const Ie = ne({ singleDollarTextMath: !0 }), O = "retainpdf-katex-css";
function be() {
  E(() => {
    if (typeof document > "u" || document.getElementById(O)) return;
    const e = ue();
    if (!e) return;
    const t = document.createElement("link");
    t.id = O, t.rel = "stylesheet", t.href = e, document.head.appendChild(t);
  }, []);
}
const H = Q(null);
function ve({ text: e, status: t }) {
  return /* @__PURE__ */ o(
    te,
    {
      className: "reader-ask-md",
      mode: "streaming",
      isAnimating: (t == null ? void 0 : t.type) === "running",
      plugins: { math: Ie },
      controls: !1,
      children: $e(e)
    }
  );
}
function we({ text: e, status: t }) {
  const s = (t == null ? void 0 : t.type) === "running";
  return /* @__PURE__ */ m("details", { className: "reader-ask-thought", open: s || void 0, children: [
    /* @__PURE__ */ m("summary", { children: [
      /* @__PURE__ */ o(le, { size: 13, "aria-hidden": !0 }),
      " ",
      s ? "思考中…" : "思考过程",
      /* @__PURE__ */ o(ce, { size: 13, className: "reader-ask-chevron", "aria-hidden": !0 })
    ] }),
    /* @__PURE__ */ o("div", { className: "reader-ask-thought-body", children: e })
  ] });
}
const Se = { pending: "等着", in_progress: "进行中", completed: "完成", failed: "失败" };
function Ce(e) {
  var n;
  const t = e.artifact || {}, s = V(H);
  G((s == null ? void 0 : s.subscribe) ?? (() => () => {
  }), (s == null ? void 0 : s.snapshot) ?? (() => 0));
  const r = s == null ? void 0 : s.get(e.toolCallId);
  return /* @__PURE__ */ m("div", { className: "reader-ask-tool", "data-status": t.status || "pending", children: [
    /* @__PURE__ */ m("div", { className: "reader-ask-tool-head", children: [
      /* @__PURE__ */ o(ie, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ o("span", { className: "reader-ask-tool-title", children: t.title || e.toolName }),
      /* @__PURE__ */ o("span", { className: "reader-ask-tool-status", children: Se[t.status] || t.status })
    ] }),
    (n = t.locations) != null && n.length ? /* @__PURE__ */ o("div", { className: "reader-ask-tool-where", children: t.locations.join("、") }) : null,
    t.output ? /* @__PURE__ */ o("pre", { className: "reader-ask-tool-output", children: t.output }) : null,
    r ? /* @__PURE__ */ m("div", { className: "reader-ask-permission", role: "group", "aria-label": "要你同意", children: [
      /* @__PURE__ */ o("span", { children: "要你同意才继续：" }),
      r.request.options.map((a) => /* @__PURE__ */ o(
        W,
        {
          className: "reader-ask-permission-option",
          "data-kind": a.kind,
          onClick: () => r.resolve({ outcome: { outcome: "selected", optionId: a.optionId } }),
          children: a.name
        },
        a.optionId
      ))
    ] }) : null
  ] });
}
const Ee = { pending: "○", in_progress: "◐", completed: "●" };
function Me({ data: e }) {
  return /* @__PURE__ */ o("ol", { className: "reader-ask-plan", "aria-label": "计划", children: e.entries.map((t, s) => /* @__PURE__ */ m("li", { "data-status": t.status, children: [
    /* @__PURE__ */ o("span", { "aria-hidden": !0, children: Ee[t.status] || "○" }),
    " ",
    t.content
  ] }, s)) });
}
function Pe({ data: e }) {
  return /* @__PURE__ */ m("div", { className: "reader-ask-subagent", "data-state": e.state, children: [
    /* @__PURE__ */ o(oe, { size: 13, "aria-hidden": !0 }),
    " ",
    /* @__PURE__ */ o("strong", { children: e.title }),
    e.description ? /* @__PURE__ */ m("span", { children: [
      " · ",
      e.description
    ] }) : null,
    /* @__PURE__ */ o("span", { className: "reader-ask-tool-status", children: e.state === "running" ? "进行中" : e.state === "idle" ? "完成" : e.state })
  ] });
}
function Re() {
  return D((t) => {
    var s;
    return ((s = t.message.status) == null ? void 0 : s.type) === "running" && t.message.parts.length === 0;
  }) ? /* @__PURE__ */ m("div", { className: "reader-ask-waiting", role: "status", children: [
    /* @__PURE__ */ o("span", { className: "reader-ask-dot", "aria-hidden": !0 }),
    "在想…"
  ] }) : null;
}
function ze({ agentName: e }) {
  const t = D((r) => {
    var n;
    return (n = r.message.metadata) == null ? void 0 : n.custom;
  });
  if (!(t != null && t.turn)) return null;
  const s = xe(t.turn, t.endedAt ?? null, e);
  return s ? /* @__PURE__ */ o("div", { className: "reader-ask-footer", children: s }) : null;
}
function je() {
  return /* @__PURE__ */ o(z.Root, { className: "reader-ask-msg is-user", children: /* @__PURE__ */ o(z.Parts, {}) });
}
function Fe(e) {
  return function() {
    return /* @__PURE__ */ m(z.Root, { className: "reader-ask-msg is-assistant", children: [
      /* @__PURE__ */ o(Re, {}),
      /* @__PURE__ */ o(
        z.Parts,
        {
          components: {
            Text: ve,
            Reasoning: we,
            tools: { Fallback: Ce },
            data: { by_name: { plan: Me, subagent: Pe } }
          }
        }
      ),
      /* @__PURE__ */ o(ze, { agentName: e() })
    ] });
  };
}
function Le(e) {
  return [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · ");
}
function Qe({ port: e, jobId: t, bookTitle: s, anchor: r, onClose: n, onShowAnchor: a, saved: u, onSave: h }) {
  be();
  const [l, p] = j(null), [f, y] = j(""), [k, x] = j(""), A = B({ agentId: f, anchor: r });
  A.current = { agentId: f, anchor: r }, E(() => {
    let c = !1;
    return e.listAgents().then(
      (i) => {
        c || (p(i), y((M) => {
          var I;
          return M || ((I = i.find((P) => P.available !== !1)) == null ? void 0 : I.id) || "";
        }));
      },
      (i) => !c && x(i instanceof Error ? i.message : String(i))
    ), () => {
      c = !0;
    };
  }, [e]);
  const d = F(() => new Ne(), []), g = F(
    () => _e({
      port: e,
      jobId: t,
      bookTitle: s,
      permissions: d,
      getAgentId: () => A.current.agentId,
      getAnchor: () => A.current.anchor
    }),
    [e, t, s, d]
  );
  E(() => () => g.close(), [g]);
  const T = Z(g.adapter), N = B(h);
  N.current = h, E(() => {
    if (u)
      try {
        T.thread.import(u);
      } catch {
      }
    return () => {
      var c;
      try {
        (c = N.current) == null || c.call(N, T.thread.export());
      } catch {
      }
    };
  }, [T]);
  const S = () => {
    var c;
    return ((c = l == null ? void 0 : l.find((i) => i.id === A.current.agentId)) == null ? void 0 : c.name) || "";
  }, _ = F(() => Fe(S), [l]);
  E(() => {
    const c = (i) => {
      var I, P;
      if (i.key !== "Escape") return;
      const M = (P = (I = i.target) == null ? void 0 : I.closest) == null ? void 0 : P.call(I, "textarea, input, select");
      M && `${M.value || ""}`.trim() || (i.preventDefault(), n());
    };
    return window.addEventListener("keydown", c), () => window.removeEventListener("keydown", c);
  }, [n]);
  const b = Math.min(460, (globalThis.innerWidth || 1200) - 32), C = Math.min(620, (globalThis.innerHeight || 800) - 120), $ = r.selection || r.sourceText || r.translatedText;
  return /* @__PURE__ */ o(
    Y,
    {
      className: "reader-ask-window",
      default: { x: Math.max(16, (globalThis.innerWidth || 1200) - b - 24), y: 72, width: b, height: C },
      minWidth: 320,
      minHeight: 280,
      bounds: "window",
      dragHandleClassName: "reader-ask-head",
      cancel: ".reader-ask-head button, .reader-ask-head select, .reader-ask-head .ui-select",
      children: /* @__PURE__ */ m("section", { className: "reader-ask", role: "dialog", "aria-label": "提问", children: [
        /* @__PURE__ */ m("header", { className: "reader-ask-head", children: [
          /* @__PURE__ */ o("span", { className: "reader-ask-title", children: "提问" }),
          /* @__PURE__ */ o(W, { className: "reader-ask-where", title: "回到问的那一处", onClick: a, children: Le(r) }),
          /* @__PURE__ */ o(
            de,
            {
              size: "sm",
              className: "reader-ask-agent",
              "aria-label": "用哪个 agent",
              value: f,
              onChange: (c) => y(c.target.value),
              disabled: !(l != null && l.length),
              children: (l || []).map((c) => /* @__PURE__ */ m("option", { value: c.id, disabled: c.available === !1, title: c.reason || c.description || "", children: [
                c.name,
                c.available === !1 ? "（用不了）" : ""
              ] }, c.id))
            }
          ),
          /* @__PURE__ */ o(W, { className: "reader-ask-close", "aria-label": "关掉", title: "关掉（Esc）", onClick: n, children: /* @__PURE__ */ o(se, { size: 15, "aria-hidden": !0 }) })
        ] }),
        $ ? /* @__PURE__ */ o("blockquote", { className: "reader-ask-quote", children: $ }) : null,
        k ? /* @__PURE__ */ m("p", { className: "reader-ask-error", children: [
          "列不出能用的 agent：",
          k
        ] }) : null,
        /* @__PURE__ */ o(H.Provider, { value: d, children: /* @__PURE__ */ o(ee, { runtime: T, children: /* @__PURE__ */ m(w.Root, { className: "reader-ask-thread", children: [
          /* @__PURE__ */ m(w.Viewport, { className: "reader-ask-viewport", children: [
            /* @__PURE__ */ o(w.Empty, { children: /* @__PURE__ */ o("p", { className: "reader-ask-empty", children: "问这一处的问题：哪里看不懂、这个式子怎么来的、这个词什么意思……" }) }),
            /* @__PURE__ */ o(w.Messages, { components: { UserMessage: je, AssistantMessage: _ } })
          ] }),
          /* @__PURE__ */ m(R.Root, { className: "reader-ask-composer", children: [
            /* @__PURE__ */ o(
              R.Input,
              {
                className: "reader-ask-input",
                placeholder: f ? "问点什么（Enter 发送，Shift+Enter 换行）" : "没有能用的 agent",
                autoFocus: !0,
                rows: 2,
                disabled: !f
              }
            ),
            /* @__PURE__ */ o(w.If, { running: !1, children: /* @__PURE__ */ o(R.Send, { className: "reader-ask-send", "aria-label": "发送", title: "发送（Enter）", children: /* @__PURE__ */ o(ae, { size: 15, "aria-hidden": !0 }) }) }),
            /* @__PURE__ */ o(w.If, { running: !0, children: /* @__PURE__ */ o(R.Cancel, { className: "reader-ask-send", "aria-label": "停下", title: "停下", children: /* @__PURE__ */ o(re, { size: 13, "aria-hidden": !0 }) }) })
          ] })
        ] }) }) })
      ] })
    }
  );
}
export {
  Qe as default
};
//# sourceMappingURL=ReaderAskWindow-Bpba4KkR.js.map
