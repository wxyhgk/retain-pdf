import { jsx as t } from "react/jsx-runtime";
import { createRoot as a } from "react-dom/client";
import { ErrorBoundary as c } from "@retainpdf/ui";
import { R as n } from "./ReaderApp-CF7Nwzex.js";
import { bootTheme as i } from "@retainpdf/ui/theme";
function m(o = document.body) {
  o.classList.add("reader-body", "reader-mode-compare"), globalThis.window && window.self !== window.top && o.classList.add("reader-embedded");
}
function s(o = document.body, r) {
  Array.from(o.children).forEach((e) => {
    e.tagName !== "SCRIPT" && e.id !== "reader-root" && e !== r && e.remove();
  });
}
function f(o = document.body) {
  let r = document.getElementById("reader-root");
  return r || (r = document.createElement("div"), r.id = "reader-root", o.appendChild(r)), r;
}
function g(o = {}) {
  const r = o.body ?? document.body, e = o.root ?? f(r);
  i(), m(r), o.purgeLegacyMarkup !== !1 && s(r, e);
  const d = a(e, o.rootOptions);
  return d.render(/* @__PURE__ */ t(c, { scope: "page", label: "阅读页", children: /* @__PURE__ */ t(n, {}) })), d;
}
export {
  g as bootReader,
  s as purgeLegacyMarkup,
  f as resolveReaderRoot,
  m as syncReaderBodyClasses
};
//# sourceMappingURL=boot.js.map
