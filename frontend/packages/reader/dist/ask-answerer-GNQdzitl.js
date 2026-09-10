import { r as Q } from "./config-CgaWliJ_.js";
const y = "retainpdf.reader.ai.conversation.v1:";
function w(e = {}) {
  const n = `${e.jobId || ""}`.trim(), r = `${e.documentId || ""}`.trim();
  return r ? `${y}doc:${r}` : n ? `${y}job:${n}` : `${y}anonymous`;
}
function E(e) {
  const n = `${e.jobId || ""}`.trim();
  return n ? `${y}job:${n}` : "";
}
function k() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function T(e = {}) {
  const n = k();
  if (!n)
    return "";
  try {
    const r = w(e), i = `${n.getItem(r) || ""}`.trim();
    if (i) return i;
    const o = `${e.documentId || ""}`.trim() ? E(e) : "", a = o ? `${n.getItem(o) || ""}`.trim() : "";
    return a && n.setItem(r, a), a;
  } catch {
    return "";
  }
}
function X(e, n) {
  const r = `${n || ""}`.trim(), i = k();
  if (!(!i || !r))
    try {
      i.setItem(w(e), r);
    } catch {
    }
}
function b(e = {}) {
  const n = k();
  if (n)
    try {
      n.removeItem(w(e));
      const r = `${e.documentId || ""}`.trim() ? E(e) : "";
      r && n.removeItem(r);
    } catch {
    }
}
const G = "/api/v1";
function J() {
  throw new Error("ask not injected (provide ask impl via createReaderAskAnswerer)");
}
function O() {
  return Promise.resolve(null);
}
const j = 240;
function z(e = "", n = j) {
  const r = `${e}`.replace(/\s+/g, " ").trim();
  return r.length <= n ? r : `${r.slice(0, n).trim()}…`;
}
function H({ question: e = "", scope: n = "document", context: r = null, resolveQuote: i = null } = {}) {
  const o = `${e}`.trim();
  if (!o)
    return "";
  if (n === "selection") {
    const a = typeof i == "function" && r ? i(r) : null, s = z((a == null ? void 0 : a.quoteText) || (r == null ? void 0 : r.quoteText) || "");
    if (s) {
      const l = (r == null ? void 0 : r.pane) === "translated" ? "译文" : "原文", m = (r == null ? void 0 : r.kind) === "formula" ? "公式" : (r == null ? void 0 : r.kind) === "table" ? "表格" : (r == null ? void 0 : r.kind) === "figure" ? "图片" : (r == null ? void 0 : r.kind) === "text" ? "文字" : "片段";
      return `（针对选中的${l}${m}：「${s}」）${o}`;
    }
    if (r != null && r.page)
      return `（针对第 ${Number(r.page)} 页的选区内容）${o}`;
  }
  return n === "page" && (r != null && r.page) ? `（当前第 ${Number(r.page)} 页）${o}` : o;
}
function W({
  jobId: e = "",
  documentId: n = "",
  apiPrefix: r = G,
  ask: i = J,
  documentByJobId: o = O,
  resolveQuote: a = null,
  // 前端凭据设置里的模型 API Key(与翻译流程同源),按请求随问答一起传给后端
  llmConfig: s = Q
} = {}) {
  const l = `${n || ""}`.trim();
  let m = null, u = T({
    jobId: e,
    documentId: l
  });
  function v() {
    return m || (m = (async () => {
      if (l) return l;
      try {
        const t = await o(r, e);
        return `${(t == null ? void 0 : t.document_id) || ""}`.trim();
      } catch {
        return "";
      }
    })()), m;
  }
  function A(t, d = "") {
    const c = `${t || ""}`.trim();
    c && (u = c, X({ jobId: e, documentId: d }, c));
  }
  async function S({
    question: t = "",
    scope: d = "document",
    context: c = null,
    onToolEvent: C = null,
    onProgressEvent: K = null,
    onAgentOperationEvent: _ = null,
    onAgentConfirmationRequiredEvent: R = null,
    onAgentSessionEvent: D = null,
    onAnswerDelta: P = null,
    onCompress: B = null,
    parentId: L = "",
    regenerate: M = !1,
    userMessageId: U = "",
    assistantMessageId: q = "",
    assistantMode: F = "reading",
    /** 取消信号：中止 SSE；aborted 后不回写会话粘性（防旧流污染新会话） */
    signal: $ = null
  } = {}) {
    const h = H({ context: c, question: t, resolveQuote: a, scope: d });
    if (!h)
      throw new Error("请输入问题。");
    const g = typeof s == "function" ? s() : s || {}, N = `${g.apiKey || ""}`.trim(), f = await v();
    if (!f && `${e || ""}`.trim())
      throw new Error("无法关联当前文档，暂不能做整本问答。请确认任务已绑定文档后重试。");
    u || (u = T({ jobId: e, documentId: f }));
    const I = await i({
      question: h,
      documentId: f,
      // document_id is the durable knowledge/operation identity. A job is an
      // immutable pipeline attempt and may be a retry/render child without
      // its own document.v1 or Markdown. Once the document is known, letting
      // the backend resolve its authoritative readable artifacts prevents the
      // Reader from pinning AI to a transient job directory.
      jobId: f ? "" : `${e || ""}`.trim(),
      conversationId: u,
      parentId: `${L || ""}`.trim(),
      regenerate: !!M,
      userMessageId: `${U || ""}`.trim(),
      assistantMessageId: `${q || ""}`.trim(),
      assistantMode: F,
      onToolEvent: C,
      onProgressEvent: K,
      onAgentOperationEvent: _,
      onAgentConfirmationRequiredEvent: R,
      onAgentSessionEvent: D,
      onAnswerDelta: P,
      onCompress: B,
      llmApiKey: N,
      llmBaseUrl: `${g.baseUrl || ""}`.trim(),
      llmModel: `${g.model || ""}`.trim(),
      signal: $
    }), p = `${(I == null ? void 0 : I.conversationId) || ""}`.trim();
    return p && !($ != null && $.aborted) && A(p, f), {
      ...I,
      conversationId: p || u,
      scope: d
    };
  }
  return {
    answer: S,
    getConversationId: () => u,
    setConversationId: (t, d = "") => {
      A(t, d);
    },
    clearConversationId: (t = "") => {
      u = "", b({ jobId: e, documentId: t }), t && b({ documentId: t }), b({ jobId: e });
    },
    getDocumentId: () => v(),
    ensureLoaded: async () => !!await v()
  };
}
export {
  w as a,
  H as b,
  b as c,
  W as d,
  T as l,
  X as s
};
//# sourceMappingURL=ask-answerer-GNQdzitl.js.map
