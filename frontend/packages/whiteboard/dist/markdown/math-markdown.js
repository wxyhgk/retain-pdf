// 白板上的文字：直接写 Markdown，公式用 `$…$`（行内）和 `$$…$$`（单独一块），也认 `\(…\)`、`\[…\]`。
// 这里只管两件事：从文字里把公式找出来（不碰代码里的 `$`），以及把整段渲染成 HTML（公式交给 MathJax）。
//
// 文字是用户或 AI 写的，当数据处理：Markdown 里的原始 HTML 一律转义成文字，链接只认 http(s) 和 mailto。
import { Marked } from "marked";
import { backslashesBefore } from "../math/latex-assist.js";
import { mathHtmlNow } from "../math/engine.js";
/** 代码（``` 块、`行内`）占的范围：这里面的 `$` 不是公式。 */
function codeRanges(text) {
    const ranges = [];
    const fence = /^(```|~~~)[^\n]*\n[\s\S]*?(?:\n\1[ \t]*(?:\n|$)|$)/gm;
    for (const match of text.matchAll(fence))
        ranges.push([match.index, match.index + match[0].length]);
    const inside = (index) => ranges.some(([from, to]) => index >= from && index < to);
    const inline = /(`+)([\s\S]*?[^`])\1(?!`)/g;
    for (const match of text.matchAll(inline)) {
        if (!inside(match.index))
            ranges.push([match.index, match.index + match[0].length]);
    }
    return ranges;
}
/**
 * 文字里所有的公式，按出现顺序。规则和常见的 Markdown 公式写法一致：
 * - `$$…$$`、`\[…\]` 是单独一块（可以跨行）；
 * - `$…$`、`\(…\)` 是行内；`$` 后面紧跟空白、或者结尾的 `$` 前面是空白 / 后面紧跟数字的不算（`$5 和 $10`）；
 * - 转义的 `\$` 不算；代码里的不算；行内公式不跨空行。
 * open 为 true 时，没写完的行内公式（只有开头的 `$`，后面没有别的 `$`）也算一个、到文字末尾为止——边打边看要用；
 * 渲染时不算（`$5 和 $10` 里的 `$10` 不是公式）。
 */
export function findMath(text, { open = false } = {}) {
    const code = codeRanges(text);
    const inCode = (index) => code.find(([from, to]) => index >= from && index < to);
    const found = [];
    let index = 0;
    while (index < text.length) {
        const skip = inCode(index);
        if (skip) {
            index = skip[1];
            continue;
        }
        const char = text[index];
        const escaped = backslashesBefore(text, index) % 2 === 1;
        if (char === "$" && !escaped) {
            if (text[index + 1] === "$") {
                const close = findClose(text, index + 2, "$$");
                if (close < 0 && !open) {
                    index += 2;
                    continue;
                }
                const end = close < 0 ? text.length : close;
                found.push(segment(text, index, end + (close < 0 ? 0 : 2), index + 2, end, true));
                index = close < 0 ? text.length : close + 2;
                continue;
            }
            if (text[index + 1] && !/\s/.test(text[index + 1])) {
                const close = findInlineClose(text, index + 1);
                if (close >= 0) {
                    found.push(segment(text, index, close + 1, index + 1, close, false));
                    index = close + 1;
                    continue;
                }
                const lineEnd = text.indexOf("\n\n", index);
                if (open && lineEnd < 0 && !text.slice(index + 1).includes("$")) {
                    // 还没打收尾的 `$`：算到末尾（边打边看用；渲染时会按原文显示）。
                    found.push(segment(text, index, text.length, index + 1, text.length, false));
                    break;
                }
            }
        }
        else if (char === "\\" && (text[index + 1] === "[" || text[index + 1] === "(") && !escaped) {
            const display = text[index + 1] === "[";
            const closer = display ? "\\]" : "\\)";
            const close = findClose(text, index + 2, closer);
            if (close >= 0) {
                found.push(segment(text, index, close + 2, index + 2, close, display));
                index = close + 2;
                continue;
            }
        }
        index += 1;
    }
    return found;
}
function segment(text, from, to, innerFrom, innerTo, display) {
    return { from, to, innerFrom, innerTo, tex: text.slice(innerFrom, innerTo), display };
}
function findClose(text, start, closer) {
    let at = text.indexOf(closer, start);
    while (at >= 0 && backslashesBefore(text, at) % 2 === 1 && closer.startsWith("$"))
        at = text.indexOf(closer, at + 1);
    return at;
}
function findInlineClose(text, start) {
    for (let at = start; at < text.length; at += 1) {
        if (text[at] === "\n" && text[at + 1] === "\n")
            return -1;
        if (text[at] !== "$" || backslashesBefore(text, at) % 2 === 1)
            continue;
        if (/\s/.test(text[at - 1] ?? ""))
            continue;
        if (/[0-9]/.test(text[at + 1] ?? ""))
            continue;
        if (text[at + 1] === "$")
            continue;
        return at;
    }
    return -1;
}
/** 光标所在的公式（光标在定界符里面，或者正好在公式末尾）。不在公式里返回 null。 */
export function mathAtCaret(text, caret) {
    return findMath(text, { open: true }).find((math) => caret >= math.innerFrom && caret <= math.innerTo) ?? null;
}
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
const PLACEHOLDER = (index) => `\u{E000}M${index}\u{E001}`;
const PLACEHOLDER_RE = /\u{E000}M(\d+)\u{E001}/gu;
const marked = new Marked({
    gfm: true,
    breaks: true,
    renderer: {
        // 原始 HTML 当文字显示。
        html({ text }) {
            return escapeHtml(text);
        },
        link({ href, title, tokens }) {
            const label = this.parser.parseInline(tokens);
            if (!/^(https?:|mailto:)/i.test(href))
                return label;
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
            return `<a href="${escapeHtml(href)}"${titleAttr} target="_blank" rel="noreferrer noopener">${label}</a>`;
        },
        image({ text }) {
            // 白板上不加载外部图片（以后放图走附件）。
            return escapeHtml(text);
        },
    },
});
function renderMathPiece(math, complete) {
    const source = escapeHtml(math.display ? `$$${math.tex}$$` : `$${math.tex}$`);
    if (!complete || !math.tex.trim())
        return `<code class="wbm-math-source">${source}</code>`;
    const rendered = mathHtmlNow(math.tex, math.display);
    if (!rendered)
        return `<code class="wbm-math-source wbm-math-pending">${source}</code>`;
    if (rendered.error)
        return `<code class="wbm-math-source wbm-math-error" title="${escapeHtml(rendered.error)}">${source}</code>`;
    return math.display
        ? `<span class="wbm-math wbm-math-display">${rendered.html}</span>`
        : `<span class="wbm-math wbm-math-inline">${rendered.html}</span>`;
}
/**
 * 整段 Markdown → HTML：先把公式换成占位符（免得 Markdown 把 `_`、`*` 当成斜体），渲染完再换回公式。
 * 公式引擎没加载好时公式按原文显示（调用方 loadMathEngine 后再渲染一次）。
 */
export function renderMathMarkdown(text) {
    const pieces = [];
    let source = "";
    let cursor = 0;
    for (const math of findMath(text)) {
        const complete = math.to > math.innerTo;
        source += text.slice(cursor, math.from);
        const html = renderMathPiece(math, complete);
        pieces.push(html);
        // 行间公式单独成段，前后空行让 Markdown 不把它并进别的段落。
        source += math.display ? `\n\n${PLACEHOLDER(pieces.length - 1)}\n\n` : PLACEHOLDER(pieces.length - 1);
        cursor = math.to;
    }
    source += text.slice(cursor);
    const html = marked.parse(source, { async: false });
    return html
        .replace(/<p>(\u{E000}M\d+\u{E001})<\/p>/gu, "$1")
        .replace(PLACEHOLDER_RE, (_, index) => pieces[Number(index)] ?? "");
}
