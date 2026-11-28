import { c as k, d as w } from "../pdf-document-config-DOSsufI-.js";
function i() {
  var t, e;
  return ((e = (t = globalThis.window) == null ? void 0 : t.location) == null ? void 0 : e.search) || "";
}
function s() {
  return !1;
}
function f() {
  return "";
}
function g() {
  return "*";
}
function m({
  search: t = i(),
  isMock: e = s,
  mockJobId: n = f
} = {}) {
  var a, c;
  const r = ((a = new URLSearchParams(t).get("job_id")) == null ? void 0 : a.trim()) || "";
  return r || (((c = new URLSearchParams(t).get("document_id")) == null ? void 0 : c.trim()) || "" ? "" : e() ? n() : "");
}
function P({ search: t = i() } = {}) {
  var e;
  return ((e = new URLSearchParams(t).get("document_id")) == null ? void 0 : e.trim()) || "";
}
function I({ search: t = i() } = {}) {
  const e = new URLSearchParams(t), n = `${e.get("page_idx") ?? ""}`.trim(), r = `${e.get("block_id") || ""}`.trim(), o = n === "" ? NaN : Number(n);
  return !Number.isFinite(o) && !r ? null : { pageIdx: Number.isFinite(o) ? o : null, blockId: r };
}
const R = ["page_idx", "page", "block_id", "blockId"];
function h(t = i()) {
  try {
    const e = new URLSearchParams(t);
    for (const n of R) e.delete(n);
    return e.sort(), e.toString();
  } catch {
    return `${t || ""}`;
  }
}
function _(t, e, n) {
  if (!Number.isFinite(e) || e < 1) return null;
  let r;
  try {
    r = new URLSearchParams(t);
  } catch {
    return null;
  }
  const o = Math.floor(e), a = `${o - 1}`, c = r.get("page_idx");
  let d = !1;
  c !== a && (c === null && a === "0" || (r.set("page_idx", a), d = !0));
  const l = `${r.get("block_id") || ""}`.trim();
  if (l && n) {
    const u = n(l);
    u != null && Number.isFinite(u) && Math.floor(u) !== o && (r.delete("block_id"), d = !0);
  }
  return d ? r.toString() : null;
}
function b({
  messageTargetOrigin: t = g,
  isMock: e = s,
  mockJobId: n = f,
  search: r = i
} = {}) {
  function o() {
    return m({ search: r(), isMock: e, mockJobId: n });
  }
  return Object.freeze({ messageTargetOrigin: t, readerJobId: o });
}
const x = b();
export {
  _ as buildReaderPageIdxSearch,
  b as createReaderPageConfigPort,
  k as createReaderPdfDocumentConfigPort,
  x as defaultReaderPageConfigPort,
  w as defaultReaderPdfDocumentConfigPort,
  h as readerRouteSearchSignature,
  I as resolveReaderAnchor,
  P as resolveReaderDocumentId,
  m as resolveReaderJobId
};
//# sourceMappingURL=config.js.map
