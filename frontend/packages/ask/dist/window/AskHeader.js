import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Copy, Maximize2, MapPin, MessageCircleQuestion, Minimize2, PanelRight, PanelRightClose, Plug, Trash2, X } from "lucide-react";
import { Button } from "@retainpdf/ui";
import { useCopyToClipboard } from "../ui/hooks/use-copy-to-clipboard.js";
import { ModelSelectorContent, ModelSelectorRoot, ModelSelectorTrigger } from "../ui/elements/model-selector.js";
import { AgentIcon } from "./BrandIcon.js";
/** 下拉里写短一点：「RetainPDF 自带模型」→「自带模型」。 */
export function shortAgentName(name) {
    return name.replace(/^RetainPDF\s*/, "") || name;
}
function InstallRow({ agent }) {
    const { isCopied, copyToClipboard } = useCopyToClipboard();
    return (_jsxs("li", { children: [_jsx("span", { children: agent.name }), _jsx("code", { title: agent.install, children: agent.install }), _jsx(Button, { className: "ask-icon", "aria-label": `复制「${agent.name}」的安装命令`, title: isCopied ? "已复制" : "复制安装命令，在终端里跑一次", onClick: () => copyToClipboard(agent.install || ""), children: _jsx(Copy, { size: 13, "aria-hidden": true }) })] }));
}
/** 没装的本机 agent：插头图标，点开写安装命令（在终端跑一次），可以复制。 */
function InstallMenu({ agents }) {
    const missing = (agents || []).filter((agent) => agent.available === false && agent.install);
    if (!missing.length)
        return null;
    return (_jsxs("details", { className: "ask-install", children: [_jsx("summary", { className: "ask-icon", "aria-label": "\u8FD8\u80FD\u63A5\u7684\u672C\u673A agent", title: `还能接本机的 ${missing.map((agent) => agent.name).join("、")}（要先装）`, children: _jsx(Plug, { size: 14, "aria-hidden": true }) }), _jsx("ul", { children: missing.map((agent) => _jsx(InstallRow, { agent: agent }, agent.id)) })] }));
}
/** 选 agent：按钮上只有图标（悬停写名字），点开是带图标的列表（assistant-ui 的 ModelSelector，agent 多时能搜）。没装的灰着。 */
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
function AgentPicker({ agents, agentId, onAgent }) {
    const list = agents || [];
    const current = list.find((agent) => agent.id === agentId);
    return (_jsxs(ModelSelectorRoot, { models: agentOptions(list), value: agentId, onValueChange: onAgent, children: [_jsx(ModelSelectorTrigger, { variant: "ghost", size: "sm", className: "ask-agent-trigger", "aria-label": current ? `用的 agent：${current.name}` : "选 agent", title: current?.name || "选 agent", disabled: !list.length, children: current ? _jsx(AgentIcon, { id: current.id, name: current.name, size: 16 }) : null }), _jsx(ModelSelectorContent, { align: "start", searchable: list.length > 8, className: "ask-agent-list" })] }));
}
export function AskHeader({ context, agents, agentId, onAgent, mode, onMode, onShowContext, onDelete, onClose }) {
    return (_jsxs("header", { className: "ask-head", onDoubleClick: (event) => {
            if (event.target.closest("button, select, summary, .ui-select"))
                return;
            onMode(mode === "full" ? "float" : "full");
        }, children: [_jsx(MessageCircleQuestion, { size: 15, className: "ask-logo", "aria-label": "\u63D0\u95EE" }), _jsxs(Button, { className: "ask-where", title: context.label ? `回到问的那一处：${context.label}` : "回到问的那一处", onClick: onShowContext, children: [_jsx(MapPin, { size: 11, "aria-hidden": true }), context.page ?? ""] }), _jsx(AgentPicker, { agents: agents, agentId: agentId, onAgent: onAgent }), _jsx(InstallMenu, { agents: agents }), _jsx("span", { className: "ask-head-gap" }), _jsx(Button, { className: "ask-icon", "aria-label": mode === "dock" ? "改回浮动" : "贴到右边", title: mode === "dock" ? "改回浮动" : "贴到右边", onClick: () => onMode(mode === "dock" ? "float" : "dock"), children: mode === "dock" ? _jsx(PanelRightClose, { size: 14, "aria-hidden": true }) : _jsx(PanelRight, { size: 14, "aria-hidden": true }) }), _jsx(Button, { className: "ask-icon", "aria-label": mode === "full" ? "还原" : "放大", title: mode === "full" ? "还原（双击标题栏）" : "放大（双击标题栏）", onClick: () => onMode(mode === "full" ? "float" : "full"), children: mode === "full" ? _jsx(Minimize2, { size: 14, "aria-hidden": true }) : _jsx(Maximize2, { size: 14, "aria-hidden": true }) }), onDelete ? (_jsx(Button, { className: "ask-icon", "aria-label": "\u5220\u6389\u8FD9\u6B21\u63D0\u95EE", title: "\u5220\u6389\u8FD9\u6B21\u63D0\u95EE\uFF08\u4E66\u9875\u4E0A\u7684\u300C?\u300D\u4E5F\u53BB\u6389\uFF09", onClick: onDelete, children: _jsx(Trash2, { size: 14, "aria-hidden": true }) })) : null, _jsx(Button, { className: "ask-icon", "aria-label": "\u5173\u6389", title: "\u5173\u6389\uFF08Esc\uFF09", onClick: onClose, children: _jsx(X, { size: 15, "aria-hidden": true }) })] }));
}
