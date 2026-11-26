import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
// RetainPDF 的改动（按 assistant-ui 的 LaTeX 文档加 remark-math / rehype-katex 和 normalizeMathDelimiters；打字光标的 dot.css 改在 styles/entry.css 里引入；
// 加 remarkPageCitations，a 组件认出页码链接画成能点的页码标签（../../window/page-citations.ts、../../window/AskPageLink.tsx））。
import { MarkdownTextPrimitive, normalizeMathDelimiters, memoizeMarkdownComponents, useIsMarkdownCodeBlock, } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { memo, useMemo, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { TooltipIconButton } from "./tooltip-icon-button.js";
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { cn } from "../lib/utils.js";
import { pageFromHref, remarkPageCitations } from "../../window/page-citations.js";
import { AskPageLink } from "../../window/AskPageLink.js";
const isShallowEqual = (a, b) => a !== undefined &&
    b !== undefined &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(b).every((key) => a[key] === b[key]);
const useShallowStable = (value) => {
    const [stable, setStable] = useState(value);
    if (value !== stable && !isShallowEqual(stable, value)) {
        setStable(value);
        return value;
    }
    return stable;
};
const MarkdownTextImpl = ({ components, componentsByLanguage, }) => {
    const stableComponents = useShallowStable(components);
    const stableComponentsByLanguage = useShallowStable(componentsByLanguage);
    const markdownComponents = useMemo(() => {
        if (!stableComponents)
            return defaultComponents;
        return {
            ...defaultComponents,
            ...memoizeMarkdownComponents(stableComponents),
        };
    }, [stableComponents]);
    return (_jsx(MarkdownTextPrimitive, { remarkPlugins: [remarkGfm, remarkMath, remarkPageCitations], rehypePlugins: [rehypeKatex], preprocess: normalizeMathDelimiters, className: "aui-md", components: markdownComponents, componentsByLanguage: stableComponentsByLanguage, defer: true }));
};
export const MarkdownText = memo(MarkdownTextImpl);
const CodeHeader = ({ language, code }) => {
    const { isCopied, copyToClipboard } = useCopyToClipboard();
    const onCopy = () => {
        if (!code || isCopied)
            return;
        copyToClipboard(code);
    };
    return (_jsxs("div", { className: "aui-code-header-root border-border/50 bg-muted/50 mt-3 flex items-center justify-between rounded-t-xl border border-b-0 px-3.5 py-1.5 text-xs", children: [_jsx("span", { className: "aui-code-header-language text-muted-foreground font-medium lowercase", children: language }), _jsxs(TooltipIconButton, { tooltip: "\u590D\u5236", onClick: onCopy, children: [!isCopied && (_jsx(CopyIcon, { className: "animate-in zoom-in-75 fade-in duration-150" })), isCopied && (_jsx(CheckIcon, { className: "animate-in zoom-in-50 fade-in duration-200 ease-out" }))] })] }));
};
const defaultComponents = memoizeMarkdownComponents({
    h1: ({ className, ...props }) => (_jsx("h1", { className: cn("aui-md-h1 mt-5 mb-2 scroll-m-20 text-xl font-semibold first:mt-0 last:mb-0", className), ...props })),
    h2: ({ className, ...props }) => (_jsx("h2", { className: cn("aui-md-h2 mt-5 mb-2 scroll-m-20 text-lg font-semibold first:mt-0 last:mb-0", className), ...props })),
    h3: ({ className, ...props }) => (_jsx("h3", { className: cn("aui-md-h3 mt-4 mb-1.5 scroll-m-20 text-base font-semibold first:mt-0 last:mb-0", className), ...props })),
    h4: ({ className, ...props }) => (_jsx("h4", { className: cn("aui-md-h4 mt-3.5 mb-1 scroll-m-20 text-base font-medium first:mt-0 last:mb-0", className), ...props })),
    h5: ({ className, ...props }) => (_jsx("h5", { className: cn("aui-md-h5 mt-3 mb-1 text-sm font-semibold first:mt-0 last:mb-0", className), ...props })),
    h6: ({ className, ...props }) => (_jsx("h6", { className: cn("aui-md-h6 mt-3 mb-1 text-sm font-medium first:mt-0 last:mb-0", className), ...props })),
    p: ({ className, ...props }) => (_jsx("p", { className: cn("aui-md-p my-3 leading-relaxed first:mt-0 last:mb-0", className), ...props })),
    a: ({ className, ...props }) => {
        const page = pageFromHref(props.href);
        if (page)
            return _jsx(AskPageLink, { page: page, children: props.children });
        return (_jsx("a", { className: cn("aui-md-a text-primary hover:text-primary/80 underline underline-offset-2", className), ...props }));
    },
    blockquote: ({ className, ...props }) => (_jsx("blockquote", { className: cn("aui-md-blockquote border-muted-foreground/30 text-muted-foreground my-3 border-s-2 ps-4", className), ...props })),
    ul: ({ className, ...props }) => (_jsx("ul", { className: cn("aui-md-ul marker:text-muted-foreground my-3 ms-5 list-disc [&>li]:mt-1", className), ...props })),
    ol: ({ className, ...props }) => (_jsx("ol", { className: cn("aui-md-ol marker:text-muted-foreground my-3 ms-5 list-decimal [&>li]:mt-1", className), ...props })),
    hr: ({ className, ...props }) => (_jsx("hr", { className: cn("aui-md-hr border-muted-foreground/20 my-3", className), ...props })),
    table: ({ className, ...props }) => (_jsx("div", { className: "aui-md-table-wrapper my-3 overflow-x-auto", children: _jsx("table", { className: cn("aui-md-table w-full border-separate border-spacing-0", className), ...props }) })),
    th: ({ className, ...props }) => (_jsx("th", { className: cn("aui-md-th bg-muted px-3 py-1.5 text-start font-medium first:rounded-ss-lg last:rounded-se-lg [[align=center]]:text-center [[align=right]]:text-right", className), ...props })),
    td: ({ className, ...props }) => (_jsx("td", { className: cn("aui-md-td border-muted-foreground/20 border-s border-b px-3 py-1.5 text-start last:border-e [[align=center]]:text-center [[align=right]]:text-right", className), ...props })),
    tr: ({ className, ...props }) => (_jsx("tr", { className: cn("aui-md-tr m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-es-lg [&:last-child>td:last-child]:rounded-ee-lg", className), ...props })),
    li: ({ className, ...props }) => (_jsx("li", { className: cn("aui-md-li leading-relaxed", className), ...props })),
    strong: ({ className, ...props }) => (_jsx("strong", { className: cn("aui-md-strong font-semibold", className), ...props })),
    sup: ({ className, ...props }) => (_jsx("sup", { className: cn("aui-md-sup [&>a]:text-xs [&>a]:no-underline", className), ...props })),
    pre: ({ className, ...props }) => (_jsx("pre", { className: cn("aui-md-pre border-border/50 bg-muted/30 overflow-x-auto rounded-t-none rounded-b-xl border border-t-0 p-3.5 text-[13px] leading-relaxed", className), ...props })),
    code: function Code({ className, ...props }) {
        const isCodeBlock = useIsMarkdownCodeBlock();
        return (_jsx("code", { className: cn(!isCodeBlock &&
                "aui-md-inline-code bg-muted rounded-md px-1.5 py-0.5 font-mono text-[0.85em]", className), ...props }));
    },
    CodeHeader,
});
