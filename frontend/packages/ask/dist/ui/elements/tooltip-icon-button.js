import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
import { forwardRef } from "react";
import { Slot } from "radix-ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, } from "../shadcn/tooltip.js";
import { Button } from "../shadcn/button.js";
import { cn } from "../lib/utils.js";
export const TooltipIconButton = forwardRef(({ children, tooltip, side = "bottom", className, ...rest }, ref) => {
    return (_jsx(TooltipProvider, { delayDuration: 0, children: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", ...rest, className: cn("aui-button-icon size-6 p-1 active:scale-90", className), ref: ref, children: [_jsx(Slot.Slottable, { children: children }), _jsx("span", { className: "aui-sr-only sr-only", children: tooltip })] }) }), _jsx(TooltipContent, { side: side, children: tooltip })] }) }));
});
TooltipIconButton.displayName = "TooltipIconButton";
