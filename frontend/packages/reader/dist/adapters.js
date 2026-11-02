import { s as t } from "./config-CgaWliJ_.js";
import { s as d, r as n } from "./answer-enhance-Dxffc8s3.js";
import { h as w, l as D, n as m } from "./markdown-payload-kK3ewW_I.js";
const i = [
  "isMockMode",
  "resolveResourceUrl",
  "fetchProtected",
  "resolvePdfjsVendorUrl",
  "defaultReaderDataPort",
  "defaultReaderPageConfigPort",
  "resolveReaderAnchor",
  "resolveReaderDocumentId",
  "resolveReaderJobId",
  "resolveReaderArtifactUrl",
  "resolveReaderSourcePdf",
  "resolveReaderTranslatedPdfUrl",
  "liveTranslation",
  "pdf",
  "sessionData",
  "resolveMarkdownAssetUrl",
  "resolveReaderDownloadUrls",
  "resolveReaderDownloadName",
  "downloadProtectedResource",
  "failDownloadToast",
  "apiPrefix",
  "fetchDocumentByJobId",
  "credentialsPort",
  "renderReaderTerminal",
  "renderReaderBoard",
  "notesQuote",
  "notesPanel",
  "readingPosition"
], R = [
  "resolveMarkdownAssetUrl",
  "resolveReaderDownloadUrls",
  "resolveReaderDownloadName",
  "downloadProtectedResource",
  "failDownloadToast",
  "fetchDocumentByJobId",
  "credentialsPort"
];
let o = null;
function f(e) {
  o = e, t({ credentialsPort: (e == null ? void 0 : e.credentialsPort) ?? null }), n(), e && d({
    fetchProtected: e.fetchProtected,
    resolveResourceUrl: e.resolveResourceUrl
  });
}
function s() {
  return o;
}
function u(e) {
  const r = o == null ? void 0 : o[e];
  if (r == null) throw new Error(`Reader adapter missing: ${String(e)} (call setReaderAdapters)`);
  return r;
}
function P(e) {
  var r, a;
  return ((a = (r = s()) == null ? void 0 : r.renderReaderBoard) == null ? void 0 : a.call(r, e)) ?? null;
}
export {
  i as READER_ADAPTER_KEYS,
  R as READER_REQUIRED_ADAPTER_KEYS,
  s as getReaderAdapters,
  w as hasMarkdownContent,
  D as loadMarkdownPayloadWithFallback,
  m as normalizeMarkdownPayload,
  P as renderReaderBoardSlot,
  u as requireAdapter,
  f as setReaderAdapters
};
//# sourceMappingURL=adapters.js.map
