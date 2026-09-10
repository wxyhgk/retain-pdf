function s(...e) {
  for (const t of e) {
    const n = `${t ?? ""}`.trim();
    if (n)
      return n;
  }
  return "";
}
let l = null, o = () => null, a = () => null, d = () => "", u = () => "";
function A(e = {}) {
  "credentialsPort" in e && (l = e.credentialsPort ?? null), e.loadBrowserStoredConfig && (o = e.loadBrowserStoredConfig), e.loadDeveloperStoredConfig && (a = e.loadDeveloperStoredConfig), e.defaultModelBaseUrl && (d = e.defaultModelBaseUrl), e.defaultModelName && (u = e.defaultModelName);
}
function m() {
  l = null, o = () => null, a = () => null, d = () => "", u = () => "";
}
function i(e = o()) {
  var t, n;
  try {
    const r = `${((n = (t = l == null ? void 0 : l.getCredentials) == null ? void 0 : t.call(l)) == null ? void 0 : n.modelApiKey) ?? ""}`.trim();
    if (r)
      return r;
  } catch {
  }
  return `${(e == null ? void 0 : e.modelApiKey) ?? ""}`.trim();
}
function S({
  browserConfig: e = o(),
  developerConfig: t = a()
} = {}) {
  return {
    apiKey: i(e),
    baseUrl: s(t == null ? void 0 : t.baseUrl, d()),
    model: s(t == null ? void 0 : t.model, u()),
    provider: "deepseek"
  };
}
function y(e) {
  return e !== void 0 ? !!i(e) : !!i();
}
const f = "retainpdf:credentials-changed";
function E() {
  var e;
  try {
    (e = globalThis.document) == null || e.dispatchEvent(new CustomEvent(f));
  } catch {
  }
}
const M = "缺少模型 API Key：请到设置 → API 设置填写 DeepSeek 等模型 Key（不是后端 X-API-Key）。";
export {
  f as C,
  M,
  i as a,
  m as b,
  y as h,
  E as n,
  S as r,
  A as s
};
//# sourceMappingURL=config-CgaWliJ_.js.map
