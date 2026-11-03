import { h as i, l as c, n as f } from "./markdown-payload-kK3ewW_I.js";
const a = [
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
  "notesQuote",
  "notesPanel",
  "readingPosition",
  "hostAi",
  "hostNavigation"
], t = [
  "resolveMarkdownAssetUrl",
  "resolveReaderDownloadUrls",
  "resolveReaderDownloadName",
  "downloadProtectedResource",
  "failDownloadToast",
  "fetchDocumentByJobId"
];
let e = null;
function d(o) {
  e = o;
}
function l() {
  return e;
}
function s(o) {
  const r = e == null ? void 0 : e[o];
  if (r == null) throw new Error(`Reader adapter missing: ${String(o)} (call setReaderAdapters)`);
  return r;
}
export {
  a as READER_ADAPTER_KEYS,
  t as READER_REQUIRED_ADAPTER_KEYS,
  l as getReaderAdapters,
  i as hasMarkdownContent,
  c as loadMarkdownPayloadWithFallback,
  f as normalizeMarkdownPayload,
  s as requireAdapter,
  d as setReaderAdapters
};
//# sourceMappingURL=adapters.js.map
