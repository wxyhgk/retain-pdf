function c() {
  var t, e;
  return ((e = (t = globalThis.window) == null ? void 0 : t.location) == null ? void 0 : e.search) || "";
}
function l() {
  return !1;
}
function f() {
  return "";
}
function g() {
  return "*";
}
function m({
  search: t = c(),
  isMock: e = l,
  mockJobId: n = f
} = {}) {
  var o, i;
  const r = ((o = new URLSearchParams(t).get("job_id")) == null ? void 0 : o.trim()) || "";
  return r || (((i = new URLSearchParams(t).get("document_id")) == null ? void 0 : i.trim()) || "" ? "" : e() ? n() : "");
}
function I({ search: t = c() } = {}) {
  var e;
  return ((e = new URLSearchParams(t).get("document_id")) == null ? void 0 : e.trim()) || "";
}
function h({ search: t = c() } = {}) {
  const e = new URLSearchParams(t), n = `${e.get("page_idx") ?? ""}`.trim(), r = `${e.get("block_id") || ""}`.trim(), a = n === "" ? NaN : Number(n);
  return !Number.isFinite(a) && !r ? null : { pageIdx: Number.isFinite(a) ? a : null, blockId: r };
}
const b = ["page_idx", "page", "block_id", "blockId"];
function P(t = c()) {
  try {
    const e = new URLSearchParams(t);
    for (const n of b) e.delete(n);
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
  const a = Math.floor(e), o = `${a - 1}`, i = r.get("page_idx");
  let u = !1;
  i !== o && (i === null && o === "0" || (r.set("page_idx", o), u = !0));
  const s = `${r.get("block_id") || ""}`.trim();
  if (s && n) {
    const d = n(s);
    d != null && Number.isFinite(d) && Math.floor(d) !== a && (r.delete("block_id"), u = !0);
  }
  return u ? r.toString() : null;
}
function R({
  messageTargetOrigin: t = g,
  isMock: e = l,
  mockJobId: n = f,
  search: r = c
} = {}) {
  function a() {
    return m({ search: r(), isMock: e, mockJobId: n });
  }
  return Object.freeze({ messageTargetOrigin: t, readerJobId: a });
}
const S = R();
export {
  h as a,
  _ as b,
  R as c,
  S as d,
  I as e,
  m as f,
  P as r
};
//# sourceMappingURL=page-config-Ct7qR5rm.js.map
