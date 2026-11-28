import { r as $, l as J, h as C } from "../markdown-payload-kK3ewW_I.js";
import { d as S } from "../pdf-document-config-DOSsufI-.js";
import { jobOutputFilePath as G } from "@retainpdf/domain/job";
import { e as _e, f as ke, b as Ue, c as ge, i as ve, d as Me, n as Ee, p as Ae, r as De, g as Le, h as Fe, j as $e, k as Je, l as Ce } from "../reader-regions-BmqHsJ-I.js";
const q = "/api/v1", y = 250;
function X(e, t) {
  return typeof globalThis.fetch == "function" ? globalThis.fetch(e, t) : Promise.reject(new Error(`fetchProtected not injected for ${e}`));
}
function O(e, t) {
  return e().then(
    (a) => ({ value: a, error: null }),
    (a) => ({ value: t, error: a })
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
function x() {
  return Promise.resolve(null);
}
function P() {
  return Promise.resolve({ items: [] });
}
function V() {
  return Promise.resolve(null);
}
function I({
  apiPrefix: e = q,
  loadJob: t = Z,
  loadManifest: a = Q,
  loadMarkdown: r = Y,
  loadMarkdownDocument: u = x,
  loadMarkdownSource: o = null,
  fetchMarkdownRange: l = null,
  loadRegions: f = P,
  loadMetadata: p = V,
  fetchProtectedResource: U = X,
  liveTranslation: h = null
} = {}) {
  const R = /* @__PURE__ */ new Map(), _ = /* @__PURE__ */ new Map();
  function w(s) {
    const n = _.get(s);
    if (n && Date.now() - n.at < y)
      return Promise.resolve(n.value);
    const d = R.get(s);
    if (d) return d;
    let c;
    try {
      c = Promise.resolve(t(s, e)).then((i) => {
        const g = Date.now();
        _.set(s, { at: g, value: i });
        for (const [E, A] of _)
          g - A.at >= y && _.delete(E);
        return i;
      }).finally(() => {
        R.get(s) === c && R.delete(s);
      });
    } catch (i) {
      c = Promise.reject(i);
    }
    return R.set(s, c), c;
  }
  async function F(s) {
    const [n, d] = await Promise.all([
      O(() => f(s, e), { items: [] }),
      O(() => p(s, e), null)
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
  async function B(s, n = {}) {
    const d = n.includeOptionalArtifacts !== !1, c = w(s), i = a(s, e).catch((m) => {
      if (Number(m == null ? void 0 : m.status) === 404) return { items: [] };
      throw m;
    });
    if (!d) {
      const [m, N] = await Promise.all([c, i]);
      return {
        jobPayload: m,
        manifestPayload: N,
        readerMetadata: null,
        regionsPayload: { items: [] },
        readerErrors: { regions: null, metadata: null }
      };
    }
    const [g, E, A] = await Promise.all([
      c,
      i,
      F(s)
    ]);
    return {
      jobPayload: g,
      manifestPayload: E,
      ...A
    };
  }
  function z(s) {
    return w(s);
  }
  async function H(s) {
    const n = await J(
      () => u(s, e),
      () => r(s, e)
    );
    if (C(n)) return n;
    try {
      const d = await w(s), c = $(d, s);
      if (!c) return n;
      const i = await J(
        () => u(c, e),
        () => r(c, e)
      );
      return C(i) ? i : n;
    } catch {
      return n;
    }
  }
  async function K(s) {
    if (typeof o != "function") return null;
    let n = await o(s, e).catch(() => null);
    if (n != null && n.rawUrl) return n;
    try {
      const d = await w(s), c = $(d, s);
      return c ? (n = await o(c, e).catch(() => null), n != null && n.rawUrl ? n : null) : n;
    } catch {
      return n;
    }
  }
  function W(s, n, d, c, i) {
    return typeof l != "function" ? Promise.reject(new Error("fetchMarkdownRange not injected")) : l(s, n, d, c, i);
  }
  return Object.freeze({
    apiPrefix: e,
    fetchProtected: U,
    loadMarkdownPayload: H,
    loadMarkdownSource: K,
    loadMarkdownRange: W,
    loadJobPayload: z,
    loadReaderPayload: B,
    loadReaderOptionalArtifacts: F,
    liveTranslation: h
  });
}
const de = I();
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
  const { moduleUrl: t, workerUrl: a } = D(e);
  if (!t)
    throw new Error("resolvePdfjsVendorUrl not injected");
  return k || (k = import(t).then((r) => (r.GlobalWorkerOptions.workerSrc = a, r)).catch((r) => {
    throw k = null, r;
  })), k;
}
function ee(e, { resolveResourceUrl: t = T } = {}) {
  return t((e == null ? void 0 : e.resource_url) || (e == null ? void 0 : e.resource_path) || "");
}
function te({
  url: e,
  configPort: t = S,
  resolvePdfjsVendorUrl: a = v
} = {}) {
  var o;
  if (!e)
    return null;
  const { cmapUrl: r, standardFontDataUrl: u } = D(a);
  return {
    url: e,
    httpHeaders: ((o = t == null ? void 0 : t.apiHeaders) == null ? void 0 : o.call(t)) ?? {},
    withCredentials: !1,
    disableRange: !1,
    disableStream: !1,
    rangeChunkSize: b,
    cMapUrl: r,
    cMapPacked: !0,
    standardFontDataUrl: u
  };
}
async function ie({
  itemOrUrl: e,
  configPort: t = S,
  fetchProtected: a = null,
  resolveResourceUrl: r = T,
  resolvePdfjsVendorUrl: u = v
} = {}) {
  const o = typeof e == "string" ? e : ee(e, { resolveResourceUrl: r });
  if (!o)
    return null;
  const l = await j({ resolvePdfjsVendorUrl: u }), { cmapUrl: f, standardFontDataUrl: p } = D(u);
  if (o.startsWith("mock://") && typeof a == "function") {
    const U = await a(o), h = new Uint8Array(await U.arrayBuffer());
    return l.getDocument({
      data: h,
      cMapUrl: f,
      cMapPacked: !0,
      standardFontDataUrl: p
    }).promise;
  }
  return l.getDocument(te({ url: o, configPort: t, resolvePdfjsVendorUrl: u })).promise;
}
function fe() {
  k = null;
}
function M(e) {
  return `${e ?? ""}`.trim();
}
function L(e, t) {
  return (Array.isArray(e == null ? void 0 : e.items) ? e.items : []).find((r) => (r == null ? void 0 : r.artifact_key) === t && (r == null ? void 0 : r.ready)) || null;
}
function re(e, t, { resolveResourceUrl: a = M, findReadyManifestArtifact: r = L } = {}) {
  const u = r(e, t), o = `${(u == null ? void 0 : u.resource_url) || (u == null ? void 0 : u.resource_path) || ""}`.trim();
  return o ? a(o) : "";
}
function ne(e, { resolveResourceUrl: t = M } = {}) {
  return t((e == null ? void 0 : e.resource_url) || (e == null ? void 0 : e.resource_path) || "");
}
function ae(e) {
  var o, l, f, p;
  if (!e) return null;
  const t = (e == null ? void 0 : e.actions) || {}, a = (e == null ? void 0 : e.artifacts) || {}, r = !!(((o = t.download_pdf) == null ? void 0 : o.enabled) ?? ((l = a.pdf) == null ? void 0 : l.ready) ?? (e == null ? void 0 : e.pdf_ready) ?? (e == null ? void 0 : e.output_pdf_ready)), u = `${((f = t.download_pdf) == null ? void 0 : f.url) || ((p = a.pdf) == null ? void 0 : p.url) || (e == null ? void 0 : e.pdf_url) || ""}`.trim();
  return { pdfEnabled: r, pdf: u ? M(u) : "" };
}
function pe(e) {
  var t;
  return ((t = e == null ? void 0 : e.readerJobId) == null ? void 0 : t.call(e)) || "";
}
function Re(e, {
  findReadyManifestArtifact: t = L,
  resolveManifestArtifactUrl: a = (r, u) => re(r, u, { findReadyManifestArtifact: t })
} = {}) {
  const r = a(e, "source_pdf");
  return r || t(e, "source_pdf");
}
function se(e) {
  if (!e || /[?&]watermark=/.test(e)) return e;
  const t = e.indexOf("#"), [a, r] = t < 0 ? [e, ""] : [e.slice(0, t), e.slice(t)];
  return `${a}${a.includes("?") ? "&" : "?"}watermark=0${r}`;
}
function we(e, t, {
  resolveJobActions: a = ae,
  findReadyManifestArtifact: r = L,
  resolveReaderArtifactUrl: u = ne,
  resolveResourceUrl: o = M
} = {}) {
  return se(
    ue(e, t, { resolveJobActions: a, findReadyManifestArtifact: r, resolveReaderArtifactUrl: u, resolveResourceUrl: o })
  );
}
function ue(e, t, {
  resolveJobActions: a,
  findReadyManifestArtifact: r,
  resolveReaderArtifactUrl: u,
  resolveResourceUrl: o
}) {
  const l = e ? a(e) : null;
  if (l != null && l.pdfEnabled && (l != null && l.pdf))
    return l.pdf;
  const f = ["pdf", "translated_pdf", "result_pdf"];
  for (const h of f) {
    const R = r(t, h), w = u(R, { resolveResourceUrl: o }) || u(R);
    if (w)
      return w;
  }
  const p = `${(e == null ? void 0 : e.workflow) || (e == null ? void 0 : e.job_type) || ""}`.trim().toLowerCase();
  return ((l == null ? void 0 : l.pdfEnabled) || `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase() === "succeeded" && p !== "ocr") && (e != null && e.job_id) ? o(G(e.job_id, "translated.pdf")) : "";
}
export {
  fe as __resetPdfjsForTests,
  te as buildPdfDocumentOptions,
  I as createReaderDataPort,
  de as defaultReaderDataPort,
  _e as extractReaderFormulaLatex,
  ke as findReaderRegion,
  Ue as findReaderRegionByAssetUrl,
  ge as findReaderRegionByCitation,
  ve as isStructuredReaderRegion,
  ie as loadPdfDocument,
  Me as normalizeReaderMetadata,
  Ee as normalizeReaderRegions,
  Ae as projectReaderRegion,
  De as readerRegionContent,
  Le as readerRegionCopyText,
  Fe as readerRegionKind,
  $e as readerRegionKindForRegion,
  Je as regionBoxForPane,
  ee as resolveReaderArtifactUrl,
  pe as resolveReaderJobId,
  Ce as resolveReaderRegionHighlight,
  Re as resolveReaderSourcePdf,
  we as resolveReaderTranslatedPdfUrl,
  se as withoutExportWatermark
};
//# sourceMappingURL=data.js.map
