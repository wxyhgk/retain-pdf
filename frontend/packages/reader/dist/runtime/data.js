import { l as M, h as D, r as F } from "../markdown-payload-kK3ewW_I.js";
import { d as C } from "../pdf-document-config-DOSsufI-.js";
const T = "/api/v1";
function J() {
  return Promise.resolve(null);
}
function S() {
  return Promise.resolve({ items: [] });
}
function I() {
  return Promise.resolve(null);
}
function H() {
  return Promise.resolve(null);
}
function W() {
  return Promise.resolve({ answer: "" });
}
function z() {
  return Promise.resolve({ items: [] });
}
function B() {
  return Promise.resolve(null);
}
function G() {
  return Promise.resolve(null);
}
function K(r, t) {
  return typeof globalThis.fetch == "function" ? globalThis.fetch(r, t) : Promise.reject(new Error(`fetchProtected not injected for ${r}`));
}
function N({
  apiPrefix: r = T,
  loadJob: t = J,
  loadManifest: u = S,
  loadMarkdown: e = I,
  loadMarkdownDocument: n = H,
  loadAiChat: s = W,
  loadRegions: a = z,
  loadMetadata: d = B,
  loadTranslationItem: f = G,
  fetchProtectedResource: w = K
} = {}) {
  async function o(c) {
    const [l, U, i, m] = await Promise.all([
      t(c, r),
      // During OCR the immutable artifact manifest does not exist yet. That is
      // a normal in-progress state: the Reader can still load the document's
      // source PDF and reserve the right pane for live translation.
      u(c, r).catch(() => ({ items: [] })),
      a(c, r).catch(() => ({ items: [] })),
      d(c, r).catch(() => null)
    ]);
    return {
      jobPayload: l,
      manifestPayload: U,
      readerMetadata: m,
      regionsPayload: i
    };
  }
  function _(c) {
    return t(c, r);
  }
  function L(c, l) {
    return f(c, l, r);
  }
  async function h(c) {
    const l = await M(
      () => n(c, r),
      () => e(c, r)
    );
    if (D(l)) return l;
    try {
      const U = await t(c, r), i = F(U, c);
      if (!i) return l;
      const m = await M(
        () => n(i, r),
        () => e(i, r)
      );
      return D(m) ? m : l;
    } catch {
      return l;
    }
  }
  function $(c, l) {
    return s(c, l, r);
  }
  return Object.freeze({
    apiPrefix: r,
    fetchProtected: w,
    fetchRegionTranslationItem: L,
    loadMarkdownPayload: h,
    loadJobPayload: _,
    loadReaderPayload: o,
    submitAiChat: $
  });
}
const x = N();
function E(r) {
  return `${r ?? ""}`.trim();
}
function R(r = "") {
  return `${r ?? ""}`.trim() ? `${r}`.trim() : "";
}
const O = 512 * 1024;
let p = null;
function v(r = R) {
  return {
    moduleUrl: r("build/pdf.mjs"),
    workerUrl: r("build/pdf.worker.mjs"),
    cmapUrl: r("cmaps/"),
    standardFontDataUrl: r("standard_fonts/")
  };
}
async function X({ resolvePdfjsVendorUrl: r = R } = {}) {
  const { moduleUrl: t, workerUrl: u } = v(r);
  if (!t)
    throw new Error("resolvePdfjsVendorUrl not injected");
  return p || (p = import(t).then((e) => (e.GlobalWorkerOptions.workerSrc = u, e)).catch((e) => {
    throw p = null, e;
  })), p;
}
function Z(r, { resolveResourceUrl: t = E } = {}) {
  return t((r == null ? void 0 : r.resource_url) || (r == null ? void 0 : r.resource_path) || "");
}
function q({
  url: r,
  configPort: t = C,
  resolvePdfjsVendorUrl: u = R
} = {}) {
  var s;
  if (!r)
    return null;
  const { cmapUrl: e, standardFontDataUrl: n } = v(u);
  return {
    url: r,
    httpHeaders: ((s = t == null ? void 0 : t.apiHeaders) == null ? void 0 : s.call(t)) ?? {},
    withCredentials: !1,
    disableRange: !1,
    disableStream: !1,
    rangeChunkSize: O,
    cMapUrl: e,
    cMapPacked: !0,
    standardFontDataUrl: n
  };
}
async function P({
  itemOrUrl: r,
  configPort: t = C,
  fetchProtected: u = null,
  resolveResourceUrl: e = E,
  resolvePdfjsVendorUrl: n = R
} = {}) {
  const s = typeof r == "string" ? r : Z(r, { resolveResourceUrl: e });
  if (!s)
    return null;
  const a = await X({ resolvePdfjsVendorUrl: n }), { cmapUrl: d, standardFontDataUrl: f } = v(n);
  if (s.startsWith("mock://") && typeof u == "function") {
    const w = await u(s), o = new Uint8Array(await w.arrayBuffer());
    return a.getDocument({
      data: o,
      cMapUrl: d,
      cMapPacked: !0,
      standardFontDataUrl: f
    }).promise;
  }
  return a.getDocument(q({ url: s, configPort: t, resolvePdfjsVendorUrl: n })).promise;
}
function b() {
  p = null;
}
function k(r) {
  return `${r ?? ""}`.trim();
}
function A(r, t) {
  return (Array.isArray(r == null ? void 0 : r.items) ? r.items : []).find((e) => (e == null ? void 0 : e.artifact_key) === t && (e == null ? void 0 : e.ready)) || null;
}
function Q(r, t, { resolveResourceUrl: u = k, findReadyManifestArtifact: e = A } = {}) {
  const n = e(r, t), s = `${(n == null ? void 0 : n.resource_url) || (n == null ? void 0 : n.resource_path) || ""}`.trim();
  return s ? u(s) : "";
}
function Y(r, { resolveResourceUrl: t = k } = {}) {
  return t((r == null ? void 0 : r.resource_url) || (r == null ? void 0 : r.resource_path) || "");
}
function V(r) {
  var s, a, d, f;
  if (!r) return null;
  const t = (r == null ? void 0 : r.actions) || {}, u = (r == null ? void 0 : r.artifacts) || {}, e = !!(((s = t.download_pdf) == null ? void 0 : s.enabled) ?? ((a = u.pdf) == null ? void 0 : a.ready) ?? (r == null ? void 0 : r.pdf_ready) ?? (r == null ? void 0 : r.output_pdf_ready)), n = `${((d = t.download_pdf) == null ? void 0 : d.url) || ((f = u.pdf) == null ? void 0 : f.url) || (r == null ? void 0 : r.pdf_url) || ""}`.trim();
  return { pdfEnabled: e, pdf: n ? k(n) : "" };
}
function j(r) {
  var t;
  return ((t = r == null ? void 0 : r.readerJobId) == null ? void 0 : t.call(r)) || "";
}
function rr(r, {
  findReadyManifestArtifact: t = A,
  resolveManifestArtifactUrl: u = (e, n) => Q(e, n, { findReadyManifestArtifact: t })
} = {}) {
  const e = u(r, "source_pdf");
  return e || t(r, "source_pdf");
}
function tr(r, t, {
  resolveJobActions: u = V,
  findReadyManifestArtifact: e = A,
  resolveReaderArtifactUrl: n = Y,
  resolveResourceUrl: s = k
} = {}) {
  const a = r ? u(r) : null;
  if (a != null && a.pdfEnabled && (a != null && a.pdf))
    return a.pdf;
  const d = ["pdf", "translated_pdf", "result_pdf"];
  for (const o of d) {
    const _ = e(t, o), h = n(_, { resolveResourceUrl: s }) || n(_);
    if (h)
      return h;
  }
  const f = `${(r == null ? void 0 : r.workflow) || (r == null ? void 0 : r.job_type) || ""}`.trim().toLowerCase();
  return ((a == null ? void 0 : a.pdfEnabled) || `${(r == null ? void 0 : r.status) || ""}`.trim().toLowerCase() === "succeeded" && f !== "ocr") && (r != null && r.job_id) ? s(`/api/v1/jobs/${encodeURIComponent(r.job_id)}/pdf`) : "";
}
export {
  b as __resetPdfjsForTests,
  q as buildPdfDocumentOptions,
  N as createReaderDataPort,
  x as defaultReaderDataPort,
  P as loadPdfDocument,
  Z as resolveReaderArtifactUrl,
  j as resolveReaderJobId,
  rr as resolveReaderSourcePdf,
  tr as resolveReaderTranslatedPdfUrl
};
//# sourceMappingURL=data.js.map
