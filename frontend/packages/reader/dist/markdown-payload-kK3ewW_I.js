function l(t) {
  return t && typeof t == "object" && t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
}
function d(t) {
  return typeof t == "string" ? t.trim() : "";
}
function y(t, n = "") {
  var o, c, i, s, u;
  const a = l(t) || {}, r = [
    a.source_artifact_job_id,
    (c = (o = a.request_payload) == null ? void 0 : o.source) == null ? void 0 : c.artifact_job_id,
    (s = (i = a.request) == null ? void 0 : i.source) == null ? void 0 : s.artifact_job_id,
    (u = a.source) == null ? void 0 : u.artifact_job_id
  ], _ = d(n);
  for (const b of r) {
    const e = d(b);
    if (e && e !== _) return e;
  }
  return "";
}
function m(t) {
  const n = l(t) || {}, a = `${n.content_with_absolute_image_urls || n.content || n.markdown || ""}`;
  return {
    payload: n,
    content: a,
    imagesBaseUrl: `${n.images_base_url || n.images_base_path || ""}`.trim(),
    ready: n.ready !== !1 && !!a.trim()
  };
}
function f(t) {
  return !!m(t).content.trim();
}
async function w(t, n) {
  let a = null;
  try {
    if (a = await t(), f(a))
      return a;
  } catch {
  }
  const r = await n();
  return f(r) ? r : a ?? r;
}
export {
  f as h,
  w as l,
  m as n,
  y as r
};
//# sourceMappingURL=markdown-payload-kK3ewW_I.js.map
