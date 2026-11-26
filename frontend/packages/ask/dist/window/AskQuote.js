import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 提问窗顶上引的那段：OCR 原文里的 $…$ 渲染成公式；默认两行，点开看全；有原文也有译文的可以切换。
import { useMemo, useState } from "react";
import katex from "katex";
import { ChevronDown, Languages } from "lucide-react";
import { Button } from "@retainpdf/ui";
// $$…$$、$…$、\(…\)、\[…\]。$…$ 不跨行（OCR 原文里一行一个式子）。
const MATH = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
/** 一段字切成普通字和公式（纯函数，测试用）。 */
export function splitMath(text) {
    const out = [];
    let last = 0;
    for (const match of text.matchAll(MATH)) {
        const start = match.index ?? 0;
        if (start > last)
            out.push({ type: "text", value: text.slice(last, start) });
        const expression = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").trim();
        out.push(expression ? { type: "math", value: expression } : { type: "text", value: match[0] });
        last = start + match[0].length;
    }
    if (last < text.length)
        out.push({ type: "text", value: text.slice(last) });
    return out;
}
function MathText({ text }) {
    const segments = useMemo(() => splitMath(text), [text]);
    return (_jsx(_Fragment, { children: segments.map((segment, index) => {
            if (segment.type === "text")
                return _jsx("span", { children: segment.value }, index);
            // KaTeX 出的 HTML（throwOnError: false：写错的式子原样标红，不抛错）。
            const html = katex.renderToString(segment.value, { throwOnError: false, displayMode: false, output: "html" });
            return _jsx("span", { className: "ask-quote-math", dangerouslySetInnerHTML: { __html: html } }, index);
        }) }));
}
export function AskQuote({ quote }) {
    const value = quote || {};
    const both = !value.selection && Boolean(value.source && value.translated);
    const [side, setSide] = useState(value.prefer === "translated" ? "translated" : "source");
    const [open, setOpen] = useState(false);
    const text = value.selection || (both ? (side === "translated" ? value.translated : value.source) : value.source || value.translated);
    if (!text)
        return null;
    return (_jsxs("div", { className: "ask-quote", "data-open": open ? "true" : "false", children: [_jsx("div", { className: "ask-quote-text", children: _jsx(MathText, { text: text }) }), _jsxs("div", { className: "ask-quote-tools", children: [both ? (_jsx(Button, { className: "ask-icon", "aria-label": side === "source" ? "看译文" : "看原文", title: side === "source" ? "看译文" : "看原文", "data-active": side === "translated" ? "true" : "false", onClick: () => setSide(side === "source" ? "translated" : "source"), children: _jsx(Languages, { size: 13, "aria-hidden": true }) })) : null, _jsx(Button, { className: "ask-icon ask-quote-toggle", "aria-label": open ? "收起" : "展开", title: open ? "收起" : "展开", "aria-expanded": open, onClick: () => setOpen(!open), children: _jsx(ChevronDown, { size: 14, "aria-hidden": true }) })] })] }));
}
