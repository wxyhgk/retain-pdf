import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../lib/utils.js";
export function Panel({ title, description, actions, titleAs: Title = "h3", className, children, ...props }) {
    const hasHead = Boolean(title || description || actions);
    return (_jsxs("section", { className: cn("ui-panel", className), ...props, children: [hasHead ? (_jsxs("header", { className: "ui-panel-head", children: [_jsxs("div", { className: "ui-panel-heading", children: [title ? _jsx(Title, { className: "ui-panel-title", children: title }) : null, description ? _jsx("p", { className: "ui-panel-description", children: description }) : null] }), actions ? _jsx("div", { className: "ui-panel-actions", children: actions }) : null] })) : null, children] }));
}
//# sourceMappingURL=panel.js.map