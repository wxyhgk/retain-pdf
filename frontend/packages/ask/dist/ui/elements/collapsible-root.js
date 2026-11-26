import { jsx as _jsx } from "react/jsx-runtime";
// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
import { Collapsible } from "radix-ui";
import { forwardRef } from "react";
export const CollapsibleRoot = forwardRef(function CollapsibleRoot(props, ref) {
    return _jsx(Collapsible.Root, { ref: ref, "data-slot": "collapsible", ...props });
});
export function CollapsibleTrigger({ ...props }) {
    return (_jsx(Collapsible.CollapsibleTrigger, { "data-slot": "collapsible-trigger", ...props }));
}
export function CollapsibleContent({ ...props }) {
    return (_jsx(Collapsible.CollapsibleContent, { "data-slot": "collapsible-content", ...props }));
}
