import { jsx as _jsx } from "react/jsx-runtime";
// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
import { cn } from "../lib/utils.js";
function Skeleton({ className, ...props }) {
    return (_jsx("div", { "data-slot": "skeleton", className: cn("animate-pulse rounded-md bg-accent", className), ...props }));
}
export { Skeleton };
