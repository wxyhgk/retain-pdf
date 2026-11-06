import { h as c, l as i, n as f } from "./markdown-payload-kK3ewW_I.js";
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
  "fetchDocumentByJobId"
], d = [
  "resolveMarkdownAssetUrl",
  "resolveReaderDownloadUrls",
  "resolveReaderDownloadName",
  "downloadProtectedResource",
  "failDownloadToast",
  "fetchDocumentByJobId"
];
let e = null;
function l(r) {
  e = r;
}
function t() {
  return e;
}
function s(r) {
  const o = e == null ? void 0 : e[r];
  if (o == null) throw new Error(`Reader adapter missing: ${String(r)} (call setReaderAdapters)`);
  return o;
}
export {
  a as READER_ADAPTER_KEYS,
  d as READER_REQUIRED_ADAPTER_KEYS,
  t as getReaderAdapters,
  c as hasMarkdownContent,
  i as loadMarkdownPayloadWithFallback,
  f as normalizeMarkdownPayload,
  s as requireAdapter,
  l as setReaderAdapters
};
//# sourceMappingURL=adapters.js.map
