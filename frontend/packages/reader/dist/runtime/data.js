import { r as J, l as C, h as y } from "../markdown-payload-kK3ewW_I.js";
import { d as O } from "../pdf-document-config-DOSsufI-.js";
import { jobOutputFilePath as G } from "@retainpdf/domain/job";
import { e as me, f as he, a as _e, b as ke, i as Ue, n as ge, c as ve, p as Me, r as Ee, d as Ae, g as De, h as Le, j as Fe, k as Je } from "../reader-regions-CP3ZMHPc.js";
const q = "/api/v1", $ = 250;
function X(e, t) {
  return typeof globalThis.fetch == "function" ? globalThis.fetch(e, t) : Promise.reject(new Error(`fetchProtected not injected for ${e}`));
}
function S(e, t) {
  return e().then(
    (u) => ({ value: u, error: null }),
    (u) => ({ value: t, error: u })
  );
}
function Z() {
  return Promise.resolve(null);
}
function Q() {
  return Promise.resolve({ items: [] });
}
function Y() {
  return Promise.resolve(null);
}
function V() {
  return Promise.resolve(null);
}
function x() {
  return Promise.resolve({ items: [] });
}
function P() {
  return Promise.resolve(null);
}
function I({
  apiPrefix: e = q,
  loadJob: t = Z,
  loadManifest: u = Q,
  loadMarkdown: r = Y,
  loadMarkdownDocument: s = V,
  loadMarkdownSource: l = null,
  fetchMarkdownRange: o = null,
  loadRegions: f = x,
  loadMetadata: p = P,
  fetchProtectedResource: U = X,
  liveTranslation: h = null
} = {}) {
  const R = /* @__PURE__ */ new Map(), _ = /* @__PURE__ */ new Map();
  function w(a) {
    const n = _.get(a);
    if (n && Date.now() - n.at < $)
      return Promise.resolve(n.value);
    const d = R.get(a);
    if (d) return d;
    let c;
    try {
      c = Promise.resolve(t(a, e)).then((i) => {
        const g = Date.now();
        _.set(a, { at: g, value: i });
        for (const [E, A] of _)
          g - A.at >= $ && _.delete(E);
        return i;
      }).finally(() => {
        R.get(a) === c && R.delete(a);
      });
    } catch (i) {
      c = Promise.reject(i);
    }
    return R.set(a, c), c;
  }
  async function F(a) {
    const [n, d] = await Promise.all([
      S(() => f(a, e), { items: [] }),
      S(() => p(a, e), null)
    ]);
    return {
      readerMetadata: d.value,
      regionsPayload: n.value,
      readerErrors: {
        regions: n.error,
        metadata: d.error
      }
    };
  }
  async function B(a, n = {}) {
    const d = n.includeOptionalArtifacts !== !1, c = w(a), i = u(a, e).catch((m) => {
      if (Number(m == null ? void 0 : m.status) === 404) return { items: [] };
      throw m;
    });
    if (!d) {
      const [m, W] = await Promise.all([c, i]);
      return {
        jobPayload: m,
        manifestPayload: W,
        readerMetadata: null,
        regionsPayload: { items: [] },
        readerErrors: { regions: null, metadata: null }
      };
    }
    const [g, E, A] = await Promise.all([
      c,
      i,
      F(a)
    ]);
    return {
      jobPayload: g,
      manifestPayload: E,
      ...A
    };
  }
  function z(a) {
    return w(a);
  }
  async function H(a) {
    const n = await C(
      () => s(a, e),
      () => r(a, e)
    );
    if (y(n)) return n;
    try {
      const d = await w(a), c = J(d, a);
      if (!c) return n;
      const i = await C(
        () => s(c, e),
        () => r(c, e)
      );
      return y(i) ? i : n;
    } catch {
      return n;
    }
  }
  async function K(a) {
    if (typeof l != "function") return null;
    let n = await l(a, e).catch(() => null);
    if (n != null && n.rawUrl) return n;
    try {
      const d = await w(a), c = J(d, a);
      return c ? (n = await l(c, e).catch(() => null), n != null && n.rawUrl ? n : null) : n;
    } catch {
      return n;
    }
  }
  function N(a, n, d, c, i) {
    return typeof o != "function" ? Promise.reject(new Error("fetchMarkdownRange not injected")) : o(a, n, d, c, i);
  }
  return Object.freeze({
    apiPrefix: e,
    fetchProtected: U,
    loadMarkdownPayload: H,
    loadMarkdownSource: K,
    loadMarkdownRange: N,
    loadJobPayload: z,
    loadReaderPayload: B,
    loadReaderOptionalArtifacts: F,
    liveTranslation: h
  });
}
const oe = I();
function T(e) {
  return `${e ?? ""}`.trim();
}
function v(e = "") {
  return `${e ?? ""}`.trim() ? `${e}`.trim() : "";
}
const b = 512 * 1024;
let k = null;
function D(e = v) {
  return {
    moduleUrl: e("build/pdf.mjs"),
    workerUrl: e("build/pdf.worker.mjs"),
    cmapUrl: e("cmaps/"),
    standardFontDataUrl: e("standard_fonts/")
  };
}
async function j({ resolvePdfjsVendorUrl: e = v } = {}) {
  const { moduleUrl: t, workerUrl: u } = D(e);
  if (!t)
    throw new Error("resolvePdfjsVendorUrl not injected");
  return k || (k = import(t).then((r) => (r.GlobalWorkerOptions.workerSrc = u, r)).catch((r) => {
    throw k = null, r;
  })), k;
}
function ee(e, { resolveResourceUrl: t = T } = {}) {
  return t((e == null ? void 0 : e.resource_url) || (e == null ? void 0 : e.resource_path) || "");
}
function te({
  url: e,
  configPort: t = O,
  resolvePdfjsVendorUrl: u = v
} = {}) {
  var l;
  if (!e)
    return null;
  const { cmapUrl: r, standardFontDataUrl: s } = D(u);
  return {
    url: e,
    httpHeaders: ((l = t == null ? void 0 : t.apiHeaders) == null ? void 0 : l.call(t)) ?? {},
    withCredentials: !1,
    disableRange: !1,
    disableStream: !1,
    rangeChunkSize: b,
    cMapUrl: r,
    cMapPacked: !0,
    standardFontDataUrl: s
  };
}
async function ce({
  itemOrUrl: e,
  configPort: t = O,
  fetchProtected: u = null,
  resolveResourceUrl: r = T,
  resolvePdfjsVendorUrl: s = v
} = {}) {
  const l = typeof e == "string" ? e : ee(e, { resolveResourceUrl: r });
  if (!l)
    return null;
  const o = await j({ resolvePdfjsVendorUrl: s }), { cmapUrl: f, standardFontDataUrl: p } = D(s);
  if (l.startsWith("mock://") && typeof u == "function") {
    const U = await u(l), h = new Uint8Array(await U.arrayBuffer());
    return o.getDocument({
      data: h,
      cMapUrl: f,
      cMapPacked: !0,
      standardFontDataUrl: p
    }).promise;
  }
  return o.getDocument(te({ url: l, configPort: t, resolvePdfjsVendorUrl: s })).promise;
}
function de() {
  k = null;
}
function M(e) {
  return `${e ?? ""}`.trim();
}
function L(e, t) {
  return (Array.isArray(e == null ? void 0 : e.items) ? e.items : []).find((r) => (r == null ? void 0 : r.artifact_key) === t && (r == null ? void 0 : r.ready)) || null;
}
function re(e, t, { resolveResourceUrl: u = M, findReadyManifestArtifact: r = L } = {}) {
  const s = r(e, t), l = `${(s == null ? void 0 : s.resource_url) || (s == null ? void 0 : s.resource_path) || ""}`.trim();
  return l ? u(l) : "";
}
function ne(e, { resolveResourceUrl: t = M } = {}) {
  return t((e == null ? void 0 : e.resource_url) || (e == null ? void 0 : e.resource_path) || "");
}
function ae(e) {
  var l, o, f, p;
  if (!e) return null;
  const t = (e == null ? void 0 : e.actions) || {}, u = (e == null ? void 0 : e.artifacts) || {}, r = !!(((l = t.download_pdf) == null ? void 0 : l.enabled) ?? ((o = u.pdf) == null ? void 0 : o.ready) ?? (e == null ? void 0 : e.pdf_ready) ?? (e == null ? void 0 : e.output_pdf_ready)), s = `${((f = t.download_pdf) == null ? void 0 : f.url) || ((p = u.pdf) == null ? void 0 : p.url) || (e == null ? void 0 : e.pdf_url) || ""}`.trim();
  return { pdfEnabled: r, pdf: s ? M(s) : "" };
}
function ie(e) {
  var t;
  return ((t = e == null ? void 0 : e.readerJobId) == null ? void 0 : t.call(e)) || "";
}
function fe(e, {
  findReadyManifestArtifact: t = L,
  resolveManifestArtifactUrl: u = (r, s) => re(r, s, { findReadyManifestArtifact: t })
} = {}) {
  const r = u(e, "source_pdf");
  return r || t(e, "source_pdf");
}
function pe(e, t, {
  resolveJobActions: u = ae,
  findReadyManifestArtifact: r = L,
  resolveReaderArtifactUrl: s = ne,
  resolveResourceUrl: l = M
} = {}) {
  const o = e ? u(e) : null;
  if (o != null && o.pdfEnabled && (o != null && o.pdf))
    return o.pdf;
  const f = ["pdf", "translated_pdf", "result_pdf"];
  for (const h of f) {
    const R = r(t, h), w = s(R, { resolveResourceUrl: l }) || s(R);
    if (w)
      return w;
  }
  const p = `${(e == null ? void 0 : e.workflow) || (e == null ? void 0 : e.job_type) || ""}`.trim().toLowerCase();
  return ((o == null ? void 0 : o.pdfEnabled) || `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase() === "succeeded" && p !== "ocr") && (e != null && e.job_id) ? l(G(e.job_id, "translated.pdf")) : "";
}
export {
  de as __resetPdfjsForTests,
  te as buildPdfDocumentOptions,
  I as createReaderDataPort,
  oe as defaultReaderDataPort,
  me as extractReaderFormulaLatex,
  he as findReaderRegion,
  _e as findReaderRegionByAssetUrl,
  ke as findReaderRegionByCitation,
  Ue as isStructuredReaderRegion,
  ce as loadPdfDocument,
  ge as normalizeReaderMetadata,
  ve as normalizeReaderRegions,
  Me as projectReaderRegion,
  Ee as readerRegionContent,
  Ae as readerRegionCopyText,
  De as readerRegionKind,
  Le as readerRegionKindForRegion,
  Fe as regionBoxForPane,
  ee as resolveReaderArtifactUrl,
  ie as resolveReaderJobId,
  Je as resolveReaderRegionHighlight,
  fe as resolveReaderSourcePdf,
  pe as resolveReaderTranslatedPdfUrl
};
//# sourceMappingURL=data.js.map
