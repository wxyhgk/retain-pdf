import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 「谁来答」（2026-11-27 从标题栏挪进输入框那颗按钮的弹层）：用户心里「谁来答」是一件事——哪个 agent、什么模型、想不想——
// 以前 agent 在标题栏、模型和思考在输入框，分在两处。没装的本机 agent 也列在这里，点了给安装命令（以前是标题栏的插头图标）。
import { createContext, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@retainpdf/ui";
import { useCopyToClipboard } from "../ui/hooks/use-copy-to-clipboard.js";
import { AgentIcon } from "./BrandIcon.js";
/** 下拉里写短一点：「RetainPDF 自带模型」→「自带模型」。 */
export function shortAgentName(name) {
    return name.replace(/^RetainPDF\s*/, "") || name;
}
export const AskAgentsContext = createContext(null);
function InstallHint({ agent }) {
    const { isCopied, copyToClipboard } = useCopyToClipboard();
    if (!agent.install)
        return _jsx("p", { className: "ask-answerer-install", children: agent.reason || "这台电脑上还用不了。" });
    return (_jsxs("p", { className: "ask-answerer-install", children: [_jsx("span", { children: "\u5728\u7EC8\u7AEF\u91CC\u8DD1\u4E00\u6B21\uFF0C\u88C5\u597D\u540E\u91CD\u5F00\u63D0\u95EE\u7A97\uFF1A" }), _jsx("code", { title: agent.install, children: agent.install }), _jsx(Button, { className: "ask-icon", "aria-label": `复制「${agent.name}」的安装命令`, title: isCopied ? "已复制" : "复制安装命令", onClick: () => copyToClipboard(agent.install || ""), children: _jsx(Copy, { size: 13, "aria-hidden": true }) })] }));
}
/** 弹层最上面一排：能用的点了就换（换 agent 会开新会话，主对话照旧接着），没装的写「要先装」、点了看安装命令。只有一个 agent 时不画。 */
export function AgentRow({ agents, agentId, onAgent }) {
    const [installing, setInstalling] = useState(null);
    if (agents.length < 2)
        return null;
    const shown = installing ? agents.find((agent) => agent.id === installing) : undefined;
    return (_jsxs("div", { className: "ask-answerer", children: [_jsx("p", { className: "ask-answerer-title", children: "\u8C01\u6765\u7B54" }), _jsx("div", { className: "ask-answerer-agents", role: "radiogroup", "aria-label": "\u8C01\u6765\u7B54", children: agents.map((agent) => {
                    const missing = agent.available === false;
                    return (_jsxs(Button, { role: "radio", "aria-checked": agent.id === agentId, className: "ask-answerer-agent", "data-missing": missing ? "true" : undefined, title: missing ? `${agent.name}：${agent.reason || "要先装"}` : agent.description || agent.name, onClick: () => (missing ? setInstalling((current) => (current === agent.id ? null : agent.id)) : onAgent(agent.id)), children: [_jsx(AgentIcon, { id: agent.id, name: agent.name, size: 14 }), _jsx("span", { children: shortAgentName(agent.name) }), missing ? _jsx("small", { children: "\u8981\u5148\u88C5" }) : null] }, agent.id));
                }) }), shown ? _jsx(InstallHint, { agent: shown }) : null] }));
}
