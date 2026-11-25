import { jsx as _jsx } from "react/jsx-runtime";
// 学习区里的一小段公式（题干、选项）：借白板的 MathJax 排版和清洗，排好之前先显示 TeX 原文。
import { useEffect, useState } from "react";
import { cachedMath, prepareMath } from "@retainpdf/whiteboard";
export function MathText({ tex, className, size = "s" }) {
    const [version, setVersion] = useState(0);
    useEffect(() => {
        let cancelled = false;
        if (cachedMath(tex, size))
            return undefined;
        prepareMath([{ tex, size }]).finally(() => {
            if (!cancelled)
                setVersion((value) => value + 1);
        });
        return () => {
            cancelled = true;
        };
    }, [tex, size]);
    const rendered = cachedMath(tex, size);
    if (!rendered || rendered.error || !rendered.svg) {
        return _jsx("code", { className: `lp-math lp-math-raw ${className ?? ""}`.trim(), "data-version": version, children: tex });
    }
    return (_jsx("span", { className: `lp-math ${className ?? ""}`.trim(), 
        // MathJax 排出来、去掉了链接和事件属性的 SVG（@retainpdf/whiteboard 的 sanitizeMathSvg）。
        dangerouslySetInnerHTML: { __html: rendered.svg } }));
}
