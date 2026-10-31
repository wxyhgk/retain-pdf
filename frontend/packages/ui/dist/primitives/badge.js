import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "../lib/utils.js";
export function Badge({ tone = "muted", className, ...props }) {
    return _jsx("span", { className: cn("ui-badge", className), "data-tone": tone, ...props });
}
//# sourceMappingURL=badge.js.map