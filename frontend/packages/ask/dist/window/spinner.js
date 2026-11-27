import { jsx as _jsx } from "react/jsx-runtime";
import { Loader2 } from "lucide-react";
export function AskSpinner({ size = 12 }) {
    return _jsx(Loader2, { size: size, className: "ask-spin", "aria-hidden": true });
}
