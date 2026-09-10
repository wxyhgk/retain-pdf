import { c as R, d as h } from "../pdf-document-config-DOSsufI-.js";
function a() {
  var r, e;
  return ((e = (r = globalThis.window) == null ? void 0 : r.location) == null ? void 0 : e.search) || "";
}
function u() {
  return !1;
}
function i() {
  return "";
}
function f() {
  return "*";
}
function s({
  search: r = a(),
  isMock: e = u,
  mockJobId: n = i
} = {}) {
  var d, c;
  const t = ((d = new URLSearchParams(r).get("job_id")) == null ? void 0 : d.trim()) || "";
  return t || (((c = new URLSearchParams(r).get("document_id")) == null ? void 0 : c.trim()) || "" ? "" : e() ? n() : "");
}
function g({ search: r = a() } = {}) {
  var e;
  return ((e = new URLSearchParams(r).get("document_id")) == null ? void 0 : e.trim()) || "";
}
function l({ search: r = a() } = {}) {
  const e = new URLSearchParams(r), n = `${e.get("page_idx") ?? ""}`.trim(), t = `${e.get("block_id") || ""}`.trim(), o = n === "" ? NaN : Number(n);
  return !Number.isFinite(o) && !t ? null : { pageIdx: Number.isFinite(o) ? o : null, blockId: t };
}
function m({
  messageTargetOrigin: r = f,
  isMock: e = u,
  mockJobId: n = i,
  search: t = a
} = {}) {
  function o() {
    return s({ search: t(), isMock: e, mockJobId: n });
  }
  return Object.freeze({ messageTargetOrigin: r, readerJobId: o });
}
const P = m();
export {
  m as createReaderPageConfigPort,
  R as createReaderPdfDocumentConfigPort,
  P as defaultReaderPageConfigPort,
  h as defaultReaderPdfDocumentConfigPort,
  l as resolveReaderAnchor,
  g as resolveReaderDocumentId,
  s as resolveReaderJobId
};
//# sourceMappingURL=config.js.map
