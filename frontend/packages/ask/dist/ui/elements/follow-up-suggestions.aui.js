import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
import { AuiIf, useAuiState, ThreadPrimitive } from "@assistant-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
const FollowupSuggestionsRow = () => {
    const suggestions = useAuiState((s) => s.thread.suggestions);
    const scrollRef = useRef(null);
    const rtlRef = useRef(null);
    const [fades, setFades] = useState({ left: false, right: false });
    const updateFades = useCallback(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        const maxScroll = el.scrollWidth - el.clientWidth;
        // scrollLeft runs 0..-max in RTL; normalize to hidden width per physical edge.
        const fromStart = Math.abs(el.scrollLeft);
        // getComputedStyle forces a style recalc per scroll event; direction is stable, read it once.
        const rtl = (rtlRef.current ??= getComputedStyle(el).direction === "rtl");
        const [left, right] = rtl
            ? [maxScroll - fromStart, fromStart]
            : [fromStart, maxScroll - fromStart];
        setFades((prev) => {
            const next = { left: left > 1, right: right > 1 };
            return prev.left === next.left && prev.right === next.right ? prev : next;
        });
    }, []);
    useEffect(() => {
        updateFades();
        const el = scrollRef.current;
        if (!el?.firstElementChild)
            return undefined;
        const observer = new ResizeObserver(updateFades);
        observer.observe(el);
        observer.observe(el.firstElementChild);
        return () => observer.disconnect();
    }, [updateFades]);
    const maskImage = `linear-gradient(to right, ${fades.left ? "transparent, black 2rem" : "black"}, ${fades.right ? "black calc(100% - 2rem), transparent" : "black"})`;
    return (_jsx("div", { ref: scrollRef, onScroll: updateFades, 
        // overflow-x clips both axes; py-1/-my-1 gives focus rings vertical room without changing outer height.
        className: "aui-thread-followup-suggestions -my-1 w-full [scrollbar-width:none] overflow-x-auto py-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", style: { maskImage, WebkitMaskImage: maskImage }, children: _jsx("div", { className: "mx-auto flex min-h-8 w-max items-center gap-2 px-0.5", children: suggestions.map((suggestion, idx) => (_jsxs(ThreadPrimitive.Suggestion, { className: "aui-thread-followup-suggestion border-foreground/10 hover:bg-foreground/[0.03] hover:border-foreground/25 rounded-md border px-2.5 py-1 text-sm whitespace-nowrap transition-colors ease-in motion-reduce:transition-none", prompt: suggestion.prompt, send: true, children: [suggestion.title ?? suggestion.prompt, suggestion.label && (_jsx("span", { className: "aui-thread-followup-suggestion-label text-muted-foreground ms-1", children: suggestion.label }))] }, idx))) }) }));
};
export const ThreadFollowupSuggestions = () => (_jsx(AuiIf, { condition: (s) => !s.thread.isEmpty &&
        !s.thread.isRunning &&
        s.thread.suggestions.length > 0, children: _jsx(FollowupSuggestionsRow, {}) }));
