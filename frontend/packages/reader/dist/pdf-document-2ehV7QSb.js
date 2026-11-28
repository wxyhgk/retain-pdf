import { d } from "./pdf-document-config-DOSsufI-.js";
function f(r) {
  return `${r ?? ""}`.trim();
}
function l(r = "") {
  return `${r ?? ""}`.trim() ? `${r}`.trim() : "";
}
const U = 512 * 1024;
let u = null;
function o(r = l) {
  return {
    moduleUrl: r("build/pdf.mjs"),
    workerUrl: r("build/pdf.worker.mjs"),
    cmapUrl: r("cmaps/"),
    standardFontDataUrl: r("standard_fonts/")
  };
}
async function k({ resolvePdfjsVendorUrl: r = l } = {}) {
  const { moduleUrl: t, workerUrl: e } = o(r);
  if (!t)
    throw new Error("resolvePdfjsVendorUrl not injected");
  return u || (u = import(t).then((a) => (a.GlobalWorkerOptions.workerSrc = e, a)).catch((a) => {
    throw u = null, a;
  })), u;
}
function D(r, { resolveResourceUrl: t = f } = {}) {
  return t((r == null ? void 0 : r.resource_url) || (r == null ? void 0 : r.resource_path) || "");
}
function R({
  url: r,
  configPort: t = d,
  resolvePdfjsVendorUrl: e = l
} = {}) {
  var n;
  if (!r)
    return null;
  const { cmapUrl: a, standardFontDataUrl: s } = o(e);
  return {
    url: r,
    httpHeaders: ((n = t == null ? void 0 : t.apiHeaders) == null ? void 0 : n.call(t)) ?? {},
    withCredentials: !1,
    disableRange: !1,
    disableStream: !1,
    rangeChunkSize: U,
    cMapUrl: a,
    cMapPacked: !0,
    standardFontDataUrl: s
  };
}
async function b({
  itemOrUrl: r,
  configPort: t = d,
  fetchProtected: e = null,
  resolveResourceUrl: a = f,
  resolvePdfjsVendorUrl: s = l
} = {}) {
  const n = typeof r == "string" ? r : D(r, { resolveResourceUrl: a });
  if (!n)
    return null;
  const c = await k({ resolvePdfjsVendorUrl: s }), { cmapUrl: p, standardFontDataUrl: i } = o(s);
  if (n.startsWith("mock://") && typeof e == "function") {
    const m = await e(n), w = new Uint8Array(await m.arrayBuffer());
    return c.getDocument({
      data: w,
      cMapUrl: p,
      cMapPacked: !0,
      standardFontDataUrl: i
    }).promise;
  }
  return c.getDocument(R({ url: n, configPort: t, resolvePdfjsVendorUrl: s })).promise;
}
function h() {
  u = null;
}
export {
  h as _,
  R as b,
  b as l,
  D as r
};
//# sourceMappingURL=pdf-document-2ehV7QSb.js.map
