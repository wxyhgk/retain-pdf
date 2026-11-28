import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Maximize2, MessageCircleQuestion, Minimize2, PanelRight, PanelRightClose, Trash2, X } from "lucide-react";
import { Button } from "@retainpdf/ui";
import { AgentIcon } from "./BrandIcon.js";
import { shortAgentName } from "./agent-row.js";
import { AskMoreMenu } from "./head-menu.js";
export { shortAgentName } from "./agent-row.js";
/** agent 列表换成 ModelSelector 的选项（没装的灰着）；留给宿主自己摆选择器用。 */
export function agentOptions(agents) {
    return agents.map((agent) => ({
        id: agent.id,
        name: shortAgentName(agent.name),
        ...(agent.available === false ? { description: agent.reason || "没装" } : agent.description ? { description: agent.description } : {}),
        disabled: agent.available === false,
        keywords: [agent.name],
        icon: _jsx(AgentIcon, { id: agent.id, name: agent.name }),
    }));
}
export function AskHeader({ title, actions, menu = [], mode, onMode, onDelete, onClose }) {
    return (_jsxs("header", { className: "ask-head", onDoubleClick: (event) => {
            if (event.target.closest("button, select, summary, .ui-select, .ask-head-menu-body"))
                return;
            onMode(mode === "full" ? "float" : "full");
        }, children: [_jsx(MessageCircleQuestion, { size: 15, className: "ask-logo", "aria-label": "\u63D0\u95EE" }), title ? _jsx("div", { className: "ask-title", children: title }) : null, _jsx("span", { className: "ask-head-gap" }), actions, _jsx(AskMoreMenu, { items: menu }), _jsx(Button, { className: "ask-icon", "aria-label": mode === "dock" ? "改回浮动" : "贴到右边", title: mode === "dock" ? "改回浮动" : "贴到右边", onClick: () => onMode(mode === "dock" ? "float" : "dock"), children: mode === "dock" ? _jsx(PanelRightClose, { size: 14, "aria-hidden": true }) : _jsx(PanelRight, { size: 14, "aria-hidden": true }) }), _jsx(Button, { className: "ask-icon", "aria-label": mode === "full" ? "还原" : "放大", title: mode === "full" ? "还原（双击标题栏）" : "放大（双击标题栏）", onClick: () => onMode(mode === "full" ? "float" : "full"), children: mode === "full" ? _jsx(Minimize2, { size: 14, "aria-hidden": true }) : _jsx(Maximize2, { size: 14, "aria-hidden": true }) }), onDelete ? (_jsx(Button, { className: "ask-icon", "aria-label": "\u5220\u6389", title: "\u5220\u6389", onClick: onDelete, children: _jsx(Trash2, { size: 14, "aria-hidden": true }) })) : null, _jsx(Button, { className: "ask-icon", "aria-label": "\u5173\u6389", title: "\u5173\u6389\uFF08Esc\uFF09", onClick: onClose, children: _jsx(X, { size: 15, "aria-hidden": true }) })] }));
}
