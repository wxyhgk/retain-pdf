import { s as n } from "./config-CgaWliJ_.js";
import { s as o, r as s } from "./answer-enhance-W8TBaAUL.js";
import { h as u, l as R, n as h } from "./markdown-payload-kK3ewW_I.js";
const l = {};
let r = null;
function c(e) {
  r = e, n({ credentialsPort: (e == null ? void 0 : e.credentialsPort) ?? null }), s(), e && o({
    fetchProtected: e.fetchProtected,
    resolveResourceUrl: e.resolveResourceUrl
  });
}
function i() {
  return r;
}
function A(e) {
  const t = r == null ? void 0 : r[e];
  if (t == null) throw new Error(`Reader adapter missing: ${String(e)} (call setReaderAdapters)`);
  return t;
}
export {
  l as DEFAULT_READER_ADAPTERS,
  i as getReaderAdapters,
  u as hasMarkdownContent,
  R as loadMarkdownPayloadWithFallback,
  h as normalizeMarkdownPayload,
  A as requireAdapter,
  c as setReaderAdapters
};
//# sourceMappingURL=adapters.js.map
