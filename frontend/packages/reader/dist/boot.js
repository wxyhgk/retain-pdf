import { jsx as t } from "react/jsx-runtime";
import { createRoot as a } from "react-dom/client";
import { ErrorBoundary as c } from "@retainpdf/ui";
import { R as n } from "./ReaderApp-CJPrqN9H.js";
import { bootTheme as i } from "@retainpdf/ui/theme";
function m(e = document.body) {
  e.classList.add("reader-body", "reader-mode-compare"), globalThis.window && window.self !== window.top && e.classList.add("reader-embedded");
}
function s(e = document.body, o) {
  Array.from(e.children).forEach((r) => {
    r.tagName !== "SCRIPT" && r.id !== "reader-root" && r !== o && r.remove();
  });
}
function f(e = document.body) {
  let o = document.getElementById("reader-root");
  return o || (o = document.createElement("div"), o.id = "reader-root", e.appendChild(o)), o;
}
function g(e = {}) {
  const o = e.body ?? document.body, r = e.root ?? f(o);
  i(), m(o), e.purgeLegacyMarkup !== !1 && s(o, r);
  const d = a(r);
  return d.render(/* @__PURE__ */ t(c, { scope: "page", label: "阅读页", children: /* @__PURE__ */ t(n, {}) })), d;
}
export {
  g as bootReader,
  s as purgeLegacyMarkup,
  f as resolveReaderRoot,
  m as syncReaderBodyClasses
};
//# sourceMappingURL=boot.js.map
