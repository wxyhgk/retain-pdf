import { k as ee, l as te, m as re, j as ae, n as ne, d as se, f as ie, h as oe, o as ce, g as de, i as le, p as ue, q as fe, t as Ae, u as me, v as pe, w as ge, e as he, r as ye, b as ve, x as $e, a as Ie, c as Se, s as we, y as Ce } from "../answer-enhance-W8TBaAUL.js";
import { b as be, c as ke, a as Me, d as _e, l as Ne, s as Re } from "../ask-answerer-GNQdzitl.js";
import { C as xe, M as He, h as Fe, n as Le, a as Pe, b as Oe, r as De, s as ze } from "../config-CgaWliJ_.js";
import { c as Ke, a as Ue, l as Xe, s as qe, b as Be, t as je, v as We } from "../thread-branch-store-Jy9wH_F1.js";
import { Marked as T } from "marked";
import { p as x } from "../markdown-math-Cb17EyYs.js";
const w = "CITE_", C = "";
function v(t) {
  return `${t}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function H(t) {
  const a = [];
  return { text: `${t ?? ""}`.replace(/\[(\d+)\]/g, (n, o) => {
    const d = `${w}${a.length}${C}`;
    return a.push(o), d;
  }), refs: a };
}
function F(t, a) {
  return a.length ? `${t ?? ""}`.replace(
    new RegExp(`${w}(\\d+)${C}`, "g"),
    (r, n) => {
      const o = a[Number(n)];
      return o != null ? `[${o}]` : "";
    }
  ) : t;
}
function W(t) {
  return v(t || "").replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br />");
}
function L(t) {
  if (typeof t == "string") return t;
  const a = t;
  return `${(a == null ? void 0 : a.raw) ?? (a == null ? void 0 : a.text) ?? ""}`;
}
const $ = new T();
$.setOptions({ gfm: !0, breaks: !0 });
$.use({
  renderer: {
    html: (t) => v(L(t))
  }
});
const P = /^\s*(?:javascript|vbscript|data:text\/html)/i;
function O(t) {
  const a = globalThis.document;
  if (!a)
    return v(t);
  const r = a.createElement("template");
  r.innerHTML = t;
  const n = r.content;
  return n.querySelectorAll("script, iframe, object, embed, base, link, meta, form").forEach((o) => o.remove()), n.querySelectorAll("*").forEach((o) => {
    for (const d of [...o.attributes]) {
      const i = d.name.toLowerCase();
      if (i.startsWith("on") || i === "srcdoc") {
        o.removeAttribute(d.name);
        continue;
      }
      if ((i === "href" || i === "src" || i === "xlink:href") && P.test(d.value)) {
        o.removeAttribute(d.name);
        continue;
      }
      i === "target" && o.removeAttribute(d.name);
    }
  }), r.innerHTML;
}
const f = /* @__PURE__ */ new Map(), D = 48;
function J(t) {
  const a = `${t || ""}`.trim();
  return a ? f.get(a) ?? null : null;
}
function z(t, a) {
  const r = `${t || ""}`.trim();
  if (r)
    for (f.has(r) && f.delete(r), f.set(r, a); f.size > D; ) {
      const n = f.keys().next().value;
      if (n == null) break;
      f.delete(n);
    }
}
async function Q(t) {
  const a = `${t || ""}`;
  if (!a.trim()) return "";
  const r = f.get(a);
  if (r != null) return r;
  const { text: n, refs: o } = H(a), d = await x(n, (u) => {
    const p = String($.parse(u, { async: !1 }));
    return O(p);
  }), i = F(d, o);
  return z(a, i), i;
}
const G = 20, I = 18;
function K(t = {}) {
  const r = (Array.isArray(t == null ? void 0 : t.messages) ? t.messages : []).find(
    (o) => (o == null ? void 0 : o.role) === "user" && `${(o == null ? void 0 : o.text) || ""}`.trim()
  ), n = `${(r == null ? void 0 : r.text) || (t == null ? void 0 : t.title) || ""}`.replace(/\s+/g, " ").trim();
  return n ? n.length > I ? `${n.slice(0, I).trim()}…` : n : "新对话";
}
function S({
  sessions: t = [],
  activeId: a = ""
} = {}) {
  return (Array.isArray(t) ? t : []).map((r) => ({
    id: `${(r == null ? void 0 : r.id) || ""}`,
    title: K(r),
    updatedAt: Number(r == null ? void 0 : r.updatedAt) || 0,
    messageCount: Array.isArray(r == null ? void 0 : r.messages) ? r.messages.length : 0,
    active: `${(r == null ? void 0 : r.id) || ""}` == `${a}`
  })).filter((r) => r.id).sort((r, n) => n.updatedAt - r.updatedAt);
}
function U({ sessions: t = [], activeId: a = "" } = {}, r = G) {
  const n = Array.isArray(t) ? [...t] : [];
  if (n.length <= r)
    return n;
  const d = n.sort(
    (i, u) => (Number(u == null ? void 0 : u.updatedAt) || 0) - (Number(i == null ? void 0 : i.updatedAt) || 0)
  ).slice(0, r);
  if (a && !d.some((i) => `${i == null ? void 0 : i.id}` == `${a}`)) {
    const i = n.find((u) => `${u == null ? void 0 : u.id}` == `${a}`);
    i && (d[d.length - 1] = i);
  }
  return d;
}
const X = "retainpdf-ai-chat-v1:";
function q(t) {
  return `${X}${`${t || ""}`.trim()}`;
}
function A() {
  try {
    return Date.now();
  } catch {
    return 0;
  }
}
function h(t, a) {
  return { id: t, title: "", createdAt: a, updatedAt: a, messages: [], history: [] };
}
function V({
  jobId: t = "",
  storage: a = globalThis.localStorage || null
} = {}) {
  const r = q(t), n = !!(`${t || ""}`.trim() && a);
  let o = 0;
  function d() {
    return o += 1, `s-${A().toString(36)}-${o}`;
  }
  function i() {
    var l;
    const s = { activeId: "", sessions: [] };
    if (!n)
      return s;
    let e = null;
    try {
      const c = a.getItem(r);
      e = c ? JSON.parse(c) : null;
    } catch {
      return s;
    }
    if (!e || typeof e != "object")
      return s;
    if (Array.isArray(e.sessions)) {
      const c = e.sessions.filter((g) => g && `${g.id || ""}`.trim());
      return { activeId: c.some((g) => `${g.id}` == `${e.activeId}`) ? `${e.activeId}` : `${((l = c[0]) == null ? void 0 : l.id) || ""}`, sessions: c };
    }
    if (Array.isArray(e.messages) || Array.isArray(e.history)) {
      const c = A(), m = {
        ...h(d(), c),
        messages: Array.isArray(e.messages) ? e.messages : [],
        history: Array.isArray(e.history) ? e.history : []
      };
      return { activeId: m.id, sessions: [m] };
    }
    return s;
  }
  function u(s) {
    var e;
    if (n)
      try {
        const l = U(s), c = l.some((m) => `${m.id}` == `${s.activeId}`) ? s.activeId : `${((e = l[0]) == null ? void 0 : e.id) || ""}`;
        a.setItem(r, JSON.stringify({ v: 2, activeId: c, sessions: l }));
      } catch {
      }
  }
  function p(s) {
    let e = s.sessions.find((l) => `${l.id}` == `${s.activeId}`);
    return e || (e = h(d(), A()), s.sessions.push(e), s.activeId = e.id), e;
  }
  function y() {
    if (!n)
      return { messages: [], history: [] };
    const s = i(), e = s.sessions.find((l) => `${l.id}` == `${s.activeId}`);
    return {
      messages: Array.isArray(e == null ? void 0 : e.messages) ? e.messages : [],
      history: Array.isArray(e == null ? void 0 : e.history) ? e.history : []
    };
  }
  function E({ messages: s = [], history: e = [] } = {}) {
    if (!n)
      return;
    const l = i(), c = p(l);
    c.messages = s.slice(-40), c.history = e.slice(-40), c.updatedAt = A(), u(l);
  }
  function b() {
    if (!n)
      return;
    const s = i(), e = p(s);
    e.messages = [], e.history = [], e.title = "", e.updatedAt = A(), u(s);
  }
  function k() {
    return n ? S(i()) : [];
  }
  function M() {
    return n ? `${i().activeId || ""}` : "";
  }
  function _() {
    if (!n)
      return "";
    const s = i(), e = h(d(), A());
    return s.sessions.push(e), s.activeId = e.id, u(s), e.id;
  }
  function N(s) {
    if (!n)
      return { messages: [], history: [] };
    const e = i();
    return e.sessions.some((l) => `${l.id}` == `${s}`) && (e.activeId = `${s}`, u(e)), y();
  }
  function R(s) {
    if (!n)
      return { messages: [], history: [] };
    const e = i(), l = `${s || e.activeId}`;
    if (e.sessions = e.sessions.filter((c) => `${c.id}` !== l), `${e.activeId}` === l) {
      const c = S(e)[0];
      e.activeId = c ? c.id : "";
    }
    if (!e.sessions.length) {
      const c = h(d(), A());
      e.sessions.push(c), e.activeId = c.id;
    }
    return u(e), y();
  }
  return {
    load: y,
    save: E,
    clear: b,
    enabled: n,
    listSessions: k,
    activeSessionId: M,
    newSession: _,
    switchSession: N,
    deleteSession: R
  };
}
export {
  xe as CREDENTIALS_CHANGED_EVENT,
  G as MAX_SESSIONS,
  He as MISSING_MODEL_API_KEY_MESSAGE,
  ee as armReaderAiClickShield,
  te as buildMarkdownImageApiUrl,
  re as buildPagePreviewUrl,
  be as buildScopedQuestion,
  ae as clearReaderAiNavigationLock,
  ke as clearStoredConversationId,
  Ke as clearThreadBranchSnapshot,
  ne as clipSnippet,
  Me as conversationStorageKey,
  V as createReaderAiHistoryStore,
  _e as createReaderAskAnswerer,
  Ue as createReaderMarkdownAnswerer,
  se as decorateCitationMarkdown,
  K as deriveSessionTitle,
  ie as findCitationForAnswerImage,
  Fe as hasModelApiKey,
  oe as hydrateProtectedImages,
  ce as injectCitationMarkers,
  de as installReaderWindowOpenGuard,
  le as isAgenticCitation,
  ue as isReaderAiNavigationLocked,
  Ne as loadStoredConversationId,
  Xe as loadThreadBranchSnapshot,
  fe as lockReaderAiNavigation,
  Ae as mountAnswerHtml,
  me as neutralizeMarkdownAnchors,
  pe as normalizeAiCitations,
  Le as notifyCredentialsChanged,
  J as peekFinalAnswerHtmlCache,
  ge as pickCitationsForAnswer,
  H as protectNumericCitations,
  Pe as readSettingsModelApiKey,
  he as renderCitationFooter,
  Q as renderFinalAnswerHtml,
  W as renderStreamingPreviewHtml,
  ye as resetAnswerEnhanceAdapters,
  Oe as resetReaderAiConfigAdapters,
  ve as resolveAnswerImageUrl,
  $e as resolveCitationPageIdx,
  Ie as resolveCitationPageNumber,
  De as resolveReaderAiConfig,
  F as restoreNumericCitations,
  Se as revokeHydratedImageUrls,
  qe as sanitizeAssistantAnswer,
  Re as saveStoredConversationId,
  Be as saveThreadBranchSnapshot,
  we as setAnswerEnhanceAdapters,
  ze as setReaderAiConfigAdapters,
  Ce as shouldIgnoreReaderAiNavEvent,
  S as summarizeSessions,
  je as threadBranchStorageKey,
  U as trimSessions,
  We as visiblePathFromSnapshot
};
//# sourceMappingURL=ai.js.map
