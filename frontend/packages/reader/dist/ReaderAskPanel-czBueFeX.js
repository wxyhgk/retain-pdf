import { jsx as f } from "react/jsx-runtime";
import { useMemo as l } from "react";
import x from "@retainpdf/ask/window";
import { r as a } from "./ReaderApp-DncUM5SR.js";
const d = 4e3;
function o(e, t = d) {
  const s = `${e || ""}`.trim();
  return s.length > t ? `${s.slice(0, t)}…` : s;
}
function m(e, t, s = "") {
  const i = [], n = [`第 ${e.page} 页`, e.section ? `「${e.section}」` : ""].filter(Boolean).join("，");
  return i.push(`我在读${s ? `《${s}》` : "一本书"}，${n}（${e.pane === "source" ? "原文" : "译文"}栏）。`), e.selection && i.push("", "我选中的这段：", o(e.selection)), e.sourceText && i.push("", "这一块的原文：", o(e.sourceText)), e.translatedText && i.push("", "这一块的译文：", o(e.translatedText)), !e.selection && !e.sourceText && !e.translatedText && i.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。"), i.push("", `（RetainPDF 任务 ${t}${e.itemId ? `，块 ${e.itemId}` : ""}，第 ${e.page} 页）`), i.join(`
`);
}
function $(e, t, s = "") {
  return {
    page: e.page,
    label: [`第 ${e.page} 页`, e.section].filter(Boolean).join(" · "),
    quote: {
      selection: e.selection || void 0,
      source: e.sourceText || void 0,
      translated: e.translatedText || void 0,
      prefer: e.pane === "translated" ? "translated" : "source"
    },
    preamble: m(e, t, s)
  };
}
function g(e, t) {
  return {
    listAgents: () => e.listAgents(),
    openSession: (s, i) => e.openSession({ ...s, jobId: t }, i)
  };
}
function P({ port: e, jobId: t, bookTitle: s, anchor: i, onShowAnchor: n, ...u }) {
  const r = l(() => g(e, t), [e, t]), p = l(() => $(i, t, s), [i, t, s]);
  return /* @__PURE__ */ f(x, { port: r, context: p, onShowContext: n, katexStylesheetUrl: a() || void 0, ...u });
}
export {
  P as default
};
//# sourceMappingURL=ReaderAskPanel-czBueFeX.js.map
