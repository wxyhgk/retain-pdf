import { n as C } from "./markdown-payload-kK3ewW_I.js";
import { l as h } from "./ask-answerer-GNQdzitl.js";
function R(t = null) {
  return C(t).content.trim();
}
function b(t = "") {
  return `${t}`.replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*]\([^)]+\)/g, " ").replace(/\[[^\]]+]\([^)]+\)/g, " ").replace(/[#>*_`~|[\]()]/g, " ").replace(/\s+/g, " ").trim();
}
function T(t = "") {
  const r = b(t).toLowerCase(), e = r.match(/[a-z0-9][a-z0-9-]{1,}/g) || [], n = r.match(/[\u4e00-\u9fff]{2,}/g) || [];
  return [.../* @__PURE__ */ new Set([...e, ...n])].slice(0, 40);
}
function v(t = "") {
  const r = [];
  let e = "文档开头", n = [];
  for (const o of `${t}`.split(/\r?\n/)) {
    const i = o.match(/^(#{1,4})\s+(.+?)\s*$/);
    i && n.join(`
`).trim() && (r.push({
      title: e,
      text: n.join(`
`).trim()
    }), n = []), i && (e = i[2].trim()), n.push(o);
  }
  return n.join(`
`).trim() && r.push({
    title: e,
    text: n.join(`
`).trim()
  }), r;
}
function B(t, r) {
  const e = b(`${t.title}
${t.text}`).toLowerCase();
  return r.reduce((n, o) => n + (e.includes(o) ? 1 : 0), 0);
}
function O(t = "", r = 420) {
  const e = b(t);
  return e.length <= r ? e : `${e.slice(0, r).trim()}...`;
}
function w(t, r) {
  return r.length ? [
    "我先基于当前 Markdown 找到这些相关片段：",
    ...r.map((n, o) => `${o + 1}. ${n.title}：${O(n.text)}`),
    "",
    `问题：${t}`
  ].join(`
`) : "我没有在当前 Markdown 里找到足够相关的片段。可以换一个更具体的问题，或确认这个任务已经生成 Markdown。";
}
function X({
  loadMarkdownPayload: t,
  maxSections: r = 3
} = {}) {
  let e = null, n = "";
  async function o(s) {
    return n || (e = await (t == null ? void 0 : t(s)), n = R(e), n);
  }
  async function i({ jobId: s = "", question: c = "", scope: u = "document", context: d = null } = {}) {
    const m = await o(s);
    if (!m)
      throw new Error("当前任务还没有可用于问答的 Markdown。");
    const A = T(`${c} ${d != null && d.page ? `第 ${d.page} 页` : ""}`), j = v(m).map((a) => ({
      ...a,
      score: B(a, A)
    })).sort((a, p) => p.score - a.score).filter((a, p) => a.score > 0 || p < r).slice(0, r);
    return {
      answer: w(c, j),
      citations: j.map((a) => a.title),
      scope: u
    };
  }
  return {
    answer: i,
    ensureLoaded: o
  };
}
const L = /\[\s*(p\d+[-_]b\d+)\s*\]/gi, M = new RegExp("(?<![\\w/])(p\\d+[-_]b\\d+)(?![\\w/])", "gi");
function I(t) {
  return `${t || ""}`.trim().toLowerCase().replace(/_/g, "-");
}
const F = /```[\s\S]*?(?:```|$)|`[^`\n]+`/g, S = "CODE_", _ = "";
function G(t, r = []) {
  let e = `${t || ""}`;
  if (!e) return "";
  const n = [];
  e = e.replace(F, (i) => {
    const s = `${S}${n.length}${_}`;
    return n.push(i), s;
  });
  const o = /* @__PURE__ */ new Map();
  for (const i of r) {
    const s = I(`${i.block_id || ""}`);
    if (!s) continue;
    const c = `${i.ref ?? ""}`.trim();
    c && o.set(s, c);
  }
  return e = e.replace(L, (i, s) => {
    const c = o.get(I(s));
    return c ? `[${c}]` : "";
  }), e = e.replace(M, (i, s) => {
    const c = o.get(I(s));
    return c ? `[${c}]` : "";
  }), e = e.replace(/\bblock_id\s*[=:：]\s*\S+/gi, ""), e = e.replace(/\bpage_idx\s*[=:：]\s*\d+/gi, ""), e = e.replace(/[ \t]{2,}/g, " "), e = e.replace(/ *\n/g, `
`), e = e.trim(), n.length && (e = e.replace(
    new RegExp(`${S}(\\d+)${_}`, "g"),
    (i, s) => n[Number(s)] ?? ""
  )), e;
}
const k = "retainpdf.reader.ai.thread-branch.v1:";
function g(t) {
  return typeof t == "string" ? { jobId: `${t || ""}`.trim(), documentId: "" } : {
    jobId: `${(t == null ? void 0 : t.jobId) || ""}`.trim(),
    documentId: `${(t == null ? void 0 : t.documentId) || ""}`.trim()
  };
}
function l(t, r = "") {
  const { jobId: e, documentId: n } = g(t), o = n ? "doc" : "job", i = n || e || "anonymous", s = `${r || ""}`.trim();
  return s ? `${k}${o}:${i}:conv:${s}` : `${k}${o}:${i}`;
}
function y() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function f(t) {
  return !!t && typeof t == "object" && !Array.isArray(t);
}
function D(t) {
  if (!f(t) || typeof t.type != "string") return;
  const r = typeof t.reason == "string" ? t.reason : void 0;
  return r ? { type: t.type, reason: r } : { type: t.type };
}
function N(t) {
  if (!f(t)) return null;
  const r = `${t.id || ""}`.trim(), e = t.role === "user" || t.role === "assistant" ? t.role : null;
  if (!r || !e) return null;
  const n = Array.isArray(t.citations) ? t.citations : void 0, o = typeof t.progress == "string" ? t.progress : void 0;
  let i = D(t.status);
  return (i == null ? void 0 : i.type) === "running" && (i = { type: "incomplete", reason: "cancelled" }), {
    id: r,
    role: e,
    content: typeof t.content == "string" ? t.content : "",
    ...o ? { progress: o } : {},
    ...n != null && n.length ? { citations: n } : {},
    ...i ? { status: i } : {}
  };
}
function x(t) {
  var i;
  if (!f(t) || t.version !== 1 || !Array.isArray(t.items))
    return null;
  const r = [];
  for (const s of t.items) {
    if (!f(s)) continue;
    const c = N(s.message);
    if (!c) continue;
    const u = s.parentId === null || s.parentId === void 0 ? null : `${s.parentId}`.trim() || null;
    r.push({ parentId: u, message: c });
  }
  if (!r.length) return null;
  const e = t.headId, n = e == null ? ((i = r[r.length - 1]) == null ? void 0 : i.message.id) ?? null : `${e}`.trim() || null, o = `${t.conversationId || ""}`.trim();
  return { version: 1, headId: n, items: r, ...o ? { conversationId: o } : {} };
}
function $(t, r) {
  if (!t) return null;
  try {
    const e = x(JSON.parse(t));
    if (!e) return null;
    const n = `${e.conversationId || ""}`.trim();
    return n && r && n !== r ? null : e;
  } catch {
    return null;
  }
}
function z(t, r, e, n) {
  const o = {
    version: 1,
    headId: n.headId,
    items: n.items,
    ...e ? { conversationId: e } : {}
  };
  t.setItem(l(r, e), JSON.stringify(o));
}
function E(t, r, e, n, o) {
  try {
    const i = l(r, e);
    z(t, r, e, n), o && o !== i && t.removeItem(o);
  } catch {
  }
}
function P(t, r = "") {
  const e = y();
  if (!e) return null;
  try {
    const n = g(t), o = e.getItem(l(n, r)), i = $(o, r);
    if (i) return i;
    if (n.documentId && n.jobId) {
      const c = { jobId: n.jobId }, u = $(
        e.getItem(l(c, r)),
        r
      );
      if (u)
        return E(
          e,
          n,
          r,
          u,
          l(c, r)
        ), u;
    }
    if (!r) return null;
    const s = n.documentId ? [n, ...n.jobId ? [{ jobId: n.jobId }] : []] : [n];
    for (const c of s) {
      const u = $(
        e.getItem(l(c)),
        r
      );
      if (!u) continue;
      const d = `${u.conversationId || ""}`.trim(), m = n.documentId ? h({ documentId: n.documentId }) || h({ jobId: n.jobId }) : h({ jobId: n.jobId });
      if (d ? d === r : m === r)
        return n.documentId && E(
          e,
          n,
          r,
          u,
          l(c)
        ), u;
    }
    return null;
  } catch {
    return null;
  }
}
function U(t, r, e = "") {
  const n = y();
  if (!n) return;
  const o = g(t);
  if (!(!o.documentId && !o.jobId || !r.items.length))
    try {
      z(n, o, e, r);
    } catch {
    }
}
function H(t, r = "") {
  const e = y();
  if (e)
    try {
      const n = g(t);
      e.removeItem(l(n, r)), n.documentId && n.jobId && e.removeItem(l({ jobId: n.jobId }, r)), r || (e.removeItem(l(n)), n.documentId && n.jobId && e.removeItem(l({ jobId: n.jobId })));
    } catch {
    }
}
function Q(t) {
  const r = new Map(t.items.map((s) => [s.message.id, s])), e = t.headId && r.get(t.headId) || t.items[t.items.length - 1];
  if (!e) return [];
  const n = [];
  let o = e;
  const i = /* @__PURE__ */ new Set();
  for (; o && !i.has(o.message.id); )
    i.add(o.message.id), n.push(o.message), o = o.parentId ? r.get(o.parentId) : void 0;
  return n.reverse();
}
export {
  X as a,
  U as b,
  H as c,
  P as l,
  G as s,
  l as t,
  Q as v
};
//# sourceMappingURL=thread-branch-store-Jy9wH_F1.js.map
