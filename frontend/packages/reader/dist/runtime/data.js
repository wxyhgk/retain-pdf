import { r as E, l as J, h as F } from "../markdown-payload-kK3ewW_I.js";
import { _ as oe, b as ue, l as le, r as ie } from "../pdf-document-2ehV7QSb.js";
import { jobOutputFilePath as z } from "@retainpdf/domain/job";
import { e as de, f as fe, b as Re, c as pe, i as me, d as we, n as he, p as _e, r as ve, g as ge, h as ke, j as Me, k as Le, l as Ue } from "../reader-regions-BmqHsJ-I.js";
const K = "/api/v1", O = 250;
function P(e, t) {
  return typeof globalThis.fetch == "function" ? globalThis.fetch(e, t) : Promise.reject(new Error(`fetchProtected not injected for ${e}`));
}
function T(e, t) {
  return e().then(
    (s) => ({ value: s, error: null }),
    (s) => ({ value: t, error: s })
  );
}
function W() {
  return Promise.resolve(null);
}
function q() {
  return Promise.resolve({ items: [] });
}
function H() {
  return Promise.resolve(null);
}
function N() {
  return Promise.resolve(null);
}
function X() {
  return Promise.resolve({ items: [] });
}
function G() {
  return Promise.resolve(null);
}
function Q({
  apiPrefix: e = K,
  loadJob: t = W,
  loadManifest: s = q,
  loadMarkdown: a = H,
  loadMarkdownDocument: o = N,
  loadMarkdownSource: i = null,
  fetchMarkdownRange: l = null,
  loadRegions: p = X,
  loadMetadata: m = G,
  fetchProtectedResource: U = P,
  liveTranslation: g = null
} = {}) {
  const f = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Map();
  function R(n) {
    const r = h.get(n);
    if (r && Date.now() - r.at < O)
      return Promise.resolve(r.value);
    const c = f.get(n);
    if (c) return c;
    let u;
    try {
      u = Promise.resolve(t(n, e)).then((d) => {
        const _ = Date.now();
        h.set(n, { at: _, value: d });
        for (const [k, M] of h)
          _ - M.at >= O && h.delete(k);
        return d;
      }).finally(() => {
        f.get(n) === u && f.delete(n);
      });
    } catch (d) {
      u = Promise.reject(d);
    }
    return f.set(n, u), u;
  }
  async function A(n) {
    const [r, c] = await Promise.all([
      T(() => p(n, e), { items: [] }),
      T(() => m(n, e), null)
    ]);
    return {
      readerMetadata: c.value,
      regionsPayload: r.value,
      readerErrors: {
        regions: r.error,
        metadata: c.error
      }
    };
  }
  async function $(n, r = {}) {
    const c = r.includeOptionalArtifacts !== !1, u = R(n), d = s(n, e).catch((w) => {
      if (Number(w == null ? void 0 : w.status) === 404) return { items: [] };
      throw w;
    });
    if (!c) {
      const [w, y] = await Promise.all([u, d]);
      return {
        jobPayload: w,
        manifestPayload: y,
        readerMetadata: null,
        regionsPayload: { items: [] },
        readerErrors: { regions: null, metadata: null }
      };
    }
    const [_, k, M] = await Promise.all([
      u,
      d,
      A(n)
    ]);
    return {
      jobPayload: _,
      manifestPayload: k,
      ...M
    };
  }
  function D(n) {
    return R(n);
  }
  async function C(n) {
    const r = await J(
      () => o(n, e),
      () => a(n, e)
    );
    if (F(r)) return r;
    try {
      const c = await R(n), u = E(c, n);
      if (!u) return r;
      const d = await J(
        () => o(u, e),
        () => a(u, e)
      );
      return F(d) ? d : r;
    } catch {
      return r;
    }
  }
  async function B(n) {
    if (typeof i != "function") return null;
    let r = await i(n, e).catch(() => null);
    if (r != null && r.rawUrl) return r;
    try {
      const c = await R(n), u = E(c, n);
      return u ? (r = await i(u, e).catch(() => null), r != null && r.rawUrl ? r : null) : r;
    } catch {
      return r;
    }
  }
  function S(n, r, c, u, d) {
    return typeof l != "function" ? Promise.reject(new Error("fetchMarkdownRange not injected")) : l(n, r, c, u, d);
  }
  return Object.freeze({
    apiPrefix: e,
    fetchProtected: U,
    loadMarkdownPayload: C,
    loadMarkdownSource: B,
    loadMarkdownRange: S,
    loadJobPayload: D,
    loadReaderPayload: $,
    loadReaderOptionalArtifacts: A,
    liveTranslation: g
  });
}
const ee = Q();
function v(e) {
  return `${e ?? ""}`.trim();
}
function L(e, t) {
  return (Array.isArray(e == null ? void 0 : e.items) ? e.items : []).find((a) => (a == null ? void 0 : a.artifact_key) === t && (a == null ? void 0 : a.ready)) || null;
}
function V(e, t, { resolveResourceUrl: s = v, findReadyManifestArtifact: a = L } = {}) {
  const o = a(e, t), i = `${(o == null ? void 0 : o.resource_url) || (o == null ? void 0 : o.resource_path) || ""}`.trim();
  return i ? s(i) : "";
}
function Y(e, { resolveResourceUrl: t = v } = {}) {
  return t((e == null ? void 0 : e.resource_url) || (e == null ? void 0 : e.resource_path) || "");
}
function Z(e) {
  var i, l, p, m;
  if (!e) return null;
  const t = (e == null ? void 0 : e.actions) || {}, s = (e == null ? void 0 : e.artifacts) || {}, a = !!(((i = t.download_pdf) == null ? void 0 : i.enabled) ?? ((l = s.pdf) == null ? void 0 : l.ready) ?? (e == null ? void 0 : e.pdf_ready) ?? (e == null ? void 0 : e.output_pdf_ready)), o = `${((p = t.download_pdf) == null ? void 0 : p.url) || ((m = s.pdf) == null ? void 0 : m.url) || (e == null ? void 0 : e.pdf_url) || ""}`.trim();
  return { pdfEnabled: a, pdf: o ? v(o) : "" };
}
function te(e) {
  var t;
  return ((t = e == null ? void 0 : e.readerJobId) == null ? void 0 : t.call(e)) || "";
}
function re(e, {
  findReadyManifestArtifact: t = L,
  resolveManifestArtifactUrl: s = (a, o) => V(a, o, { findReadyManifestArtifact: t })
} = {}) {
  const a = s(e, "source_pdf");
  return a || t(e, "source_pdf");
}
function x(e) {
  if (!e || /[?&]watermark=/.test(e)) return e;
  const t = e.indexOf("#"), [s, a] = t < 0 ? [e, ""] : [e.slice(0, t), e.slice(t)];
  return `${s}${s.includes("?") ? "&" : "?"}watermark=0${a}`;
}
function ne(e, t, {
  resolveJobActions: s = Z,
  findReadyManifestArtifact: a = L,
  resolveReaderArtifactUrl: o = Y,
  resolveResourceUrl: i = v
} = {}) {
  return x(
    I(e, t, { resolveJobActions: s, findReadyManifestArtifact: a, resolveReaderArtifactUrl: o, resolveResourceUrl: i })
  );
}
function I(e, t, {
  resolveJobActions: s,
  findReadyManifestArtifact: a,
  resolveReaderArtifactUrl: o,
  resolveResourceUrl: i
}) {
  const l = e ? s(e) : null;
  if (l != null && l.pdfEnabled && (l != null && l.pdf))
    return l.pdf;
  const p = ["pdf", "translated_pdf", "result_pdf"];
  for (const g of p) {
    const f = a(t, g), R = o(f, { resolveResourceUrl: i }) || o(f);
    if (R)
      return R;
  }
  const m = `${(e == null ? void 0 : e.workflow) || (e == null ? void 0 : e.job_type) || ""}`.trim().toLowerCase();
  return ((l == null ? void 0 : l.pdfEnabled) || `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase() === "succeeded" && m !== "ocr") && (e != null && e.job_id) ? i(z(e.job_id, "translated.pdf")) : "";
}
export {
  oe as __resetPdfjsForTests,
  ue as buildPdfDocumentOptions,
  Q as createReaderDataPort,
  ee as defaultReaderDataPort,
  de as extractReaderFormulaLatex,
  fe as findReaderRegion,
  Re as findReaderRegionByAssetUrl,
  pe as findReaderRegionByCitation,
  me as isStructuredReaderRegion,
  le as loadPdfDocument,
  we as normalizeReaderMetadata,
  he as normalizeReaderRegions,
  _e as projectReaderRegion,
  ve as readerRegionContent,
  ge as readerRegionCopyText,
  ke as readerRegionKind,
  Me as readerRegionKindForRegion,
  Le as regionBoxForPane,
  ie as resolveReaderArtifactUrl,
  te as resolveReaderJobId,
  Ue as resolveReaderRegionHighlight,
  re as resolveReaderSourcePdf,
  ne as resolveReaderTranslatedPdfUrl,
  x as withoutExportWatermark
};
//# sourceMappingURL=data.js.map
