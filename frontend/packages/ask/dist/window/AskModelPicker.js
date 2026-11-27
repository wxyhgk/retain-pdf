import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 输入框那一行的「谁来答」（Thread 的 ComposerExtra 插槽）：assistant-ui 的 ModelSelector（../ui/elements/model-selector.tsx）——
 * 一个按钮写「模型 · 思考」，点开从上到下是 agent 那一排（agent-row.tsx，2026-11-27 从标题栏挪来，没装的也在这里）、带搜索的模型列表、
 * 思考强度（几档的是胶囊滑块，../ui/elements/effort-slider.tsx，仿 Claude 桌面版；只有开 / 关的是开关）；
 * 别的设置项（模式、快速……）收在「更多」里。思考强度的颜色还染输入框和周围、模型厂商的标志做聊天背景的水印（AskWindow）。
 * 数据是 ACP 的 configOptions（agent 开会话时给，见 ../acp/config.ts）和宿主列出的 agent。
 *
 * 只有两档的思考强度（Qwen3、DeepSeek 这类模型只能开 / 关，2026-11-27）画成一个开关，不画两格的滑块；
 * agent 没给档位起名字（名字就是值，自带 agent 报的 off / on / low …）时换成中文（levelName）。
 */
import { createContext, useContext } from "react";
import { Brain, SlidersHorizontal, Sparkles, Zap } from "lucide-react";
import { Button, Select } from "@retainpdf/ui";
import { EffortSlider } from "../ui/elements/effort-slider.js";
import { ModelSelectorContent, ModelSelectorList, ModelSelectorRoot, ModelSelectorSearch, ModelSelectorTrigger, } from "../ui/elements/model-selector.js";
import { AgentIcon, BrandIcon, brandFor } from "./BrandIcon.js";
import { AgentRow, AskAgentsContext, shortAgentName } from "./agent-row.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/shadcn/popover.js";
export const AskConfigContext = createContext(null);
/** 设置项分三类：模型、思考强度、其余。 */
export function splitConfig(options) {
    const model = options.find((option) => option.category === "model" && option.type === "select" && option.options.length) || null;
    const thought = options.find((option) => option.category === "thought_level" && option.type === "select" && option.options.length) || null;
    const rest = options.filter((option) => option !== model && option !== thought);
    return { model, thought, rest };
}
/** 常见档位值的中文名：只在 agent 没起名字（名字就是值）时用。 */
const LEVEL_NAMES = {
    off: "不思考",
    none: "不思考",
    disabled: "不思考",
    on: "思考",
    enabled: "思考",
    auto: "自动",
    minimal: "最低",
    low: "低",
    medium: "中",
    high: "高",
    xhigh: "很高",
    max: "最高",
};
/** 档位显示的名字：agent 起了名字就照它；名字就是值（没起）时认得的换成中文，认不得的照原样。 */
export function levelName(choice) {
    const name = `${choice.name || ""}`.trim();
    if (name && name !== choice.value)
        return name;
    return LEVEL_NAMES[`${choice.value}`.trim().toLowerCase()] || name || choice.value;
}
/** 只有两档（从弱到强：关、开）：画成开关，不画滑块。 */
export function isThinkingSwitch(thought) {
    return Boolean(thought && thought.options.length === 2);
}
/** 按钮上、列表里写的档位名。开关关着时不写（按钮上只有模型名），开着写「思考」。 */
function triggerLevelName(thought, index) {
    if (isThinkingSwitch(thought))
        return index === 1 ? "思考" : "";
    return levelName(thought.options[index]);
}
/** ModelSelector 要的模型列表：每个模型都带同一份思考强度档位（ACP 的思考强度是整个会话的，不分模型）。 */
export function toModelOptions(model, thought) {
    // 档位照 agent 给的（几档、顺序、值）；名字没起的换成中文（levelName）。
    const efforts = thought ? thought.options.map((choice, index) => ({ id: choice.value, name: triggerLevelName(thought, index) })) : undefined;
    return model.options.map((choice) => ({
        id: choice.value,
        name: choice.name,
        ...(choice.description ? { description: choice.description } : {}),
        ...(choice.group ? { keywords: [choice.group] } : {}),
        icon: _jsx(BrandIcon, { brand: brandFor(choice.value, choice.name, choice.group), title: choice.group || choice.name }),
        ...(efforts ? { efforts } : {}),
    }));
}
function OtherSettings({ options, set }) {
    if (!options.length)
        return null;
    return (_jsxs(Popover, { children: [_jsx(PopoverTrigger, { className: "ask-icon ask-config-more", "aria-label": "\u66F4\u591A\u8BBE\u7F6E", title: options.map((option) => option.name).join("、"), children: _jsx(SlidersHorizontal, { size: 14, "aria-hidden": true }) }), _jsx(PopoverContent, { align: "start", side: "top", className: "ask-config-panel", children: options.map((option) => (_jsxs("label", { className: "ask-config-row", title: option.description || "", children: [_jsx("span", { children: option.name }), _jsx(Select, { size: "sm", value: option.type === "boolean" ? (option.currentValue ? "on" : "off") : `${option.currentValue}`, onChange: (event) => set(option.id, option.type === "boolean" ? event.target.value === "on" : event.target.value), children: option.type === "boolean"
                                ? [_jsx("option", { value: "on", children: "\u5F00" }, "on"), _jsx("option", { value: "off", children: "\u5173" }, "off")]
                                : option.options.map((choice) => _jsx("option", { value: choice.value, title: choice.description || "", children: choice.name }, choice.value)) })] }, option.id))) })] }));
}
/**
 * 思考强度的颜色：不认档位的值，只看它在 agent 给的列表里排第几（agent 按从弱到强排）。
 * 第一档是灰的；往后从绿（--ok）过渡到橙（--warn）再到红（--danger），agent 给几档就分几段。
 */
export function effortColor(index, count) {
    if (count <= 1 || index <= 0)
        return "var(--muted)";
    // 只有开 / 关：开着是中间那个橙色，不是「最强」的红（2026-11-27 用户看到一个红的 on 觉得诡异）。
    if (count === 2)
        return "var(--warn)";
    const t = Math.min(1, index / (count - 1));
    if (t <= 0.5)
        return `color-mix(in srgb, var(--warn) ${Math.round((t / 0.5) * 100)}%, var(--ok))`;
    return `color-mix(in srgb, var(--danger) ${Math.round(((t - 0.5) / 0.5) * 100)}%, var(--warn))`;
}
/** 当前思考强度的颜色（按它在 agent 列表里的位置）；没有思考强度这一项是 null。第一档（index 0）算「没开」。 */
export function currentEffort(options) {
    const { thought } = splitConfig(options);
    if (!thought)
        return null;
    const index = thought.options.findIndex((choice) => choice.value === `${thought.currentValue}`);
    return { color: effortColor(index, thought.options.length), on: index > 0 };
}
/** 当前模型的厂商（水印用）；没有模型这一项是空串。 */
export function currentModelBrand(options) {
    const { model } = splitConfig(options);
    if (!model)
        return "";
    const choice = model.options.find((entry) => entry.value === `${model.currentValue}`);
    return brandFor(`${model.currentValue}`, choice?.name, choice?.group);
}
/** 只能开 / 关的思考：一行「深度思考」加一个开关。 */
function EffortSwitch({ thought, set }) {
    const [off, on] = thought.options;
    const checked = `${thought.currentValue}` === on.value;
    return (_jsxs("div", { className: "ask-effort ask-effort-switch", "data-on": checked ? "true" : "false", children: [_jsx(Brain, { size: 14, "aria-hidden": true }), _jsxs("span", { className: "ask-effort-switch-text", children: [_jsx("span", { className: "ask-effort-switch-name", children: "\u6DF1\u5EA6\u601D\u8003" }), _jsx("span", { className: "ask-effort-switch-hint", children: checked ? "先想再答：慢一些，答得更好" : "直接答：快" })] }), _jsx(Button, { role: "switch", "aria-checked": checked, "aria-label": `深度思考：${checked ? "开" : "关"}`, className: "ask-effort-switch-toggle", onClick: () => set(thought.id, checked ? off.value : on.value), children: _jsx("span", { "aria-hidden": true }) })] }));
}
/** 弹层里的思考强度：几档的是胶囊滑块，名字照 agent 给的（没起名的换中文），颜色按档位位置（effortColor），左右两头用图标（快 / 想得深）；
 * 只有两档的是开关（EffortSwitch）。 */
export function EffortRow({ thought, set }) {
    if (isThinkingSwitch(thought))
        return _jsx(EffortSwitch, { thought: thought, set: set });
    return (_jsx(EffortSlider, { className: "ask-effort", levels: thought.options.map((choice) => ({ id: choice.value, name: levelName(choice), ...(choice.description ? { description: choice.description } : {}) })), value: `${thought.currentValue}`, onChange: (value) => set(thought.id, value), colorAt: effortColor, label: _jsx(Brain, { size: 13, "aria-label": thought.name || "思考强度" }), start: _jsx(Zap, { size: 12, "aria-label": "\u66F4\u5FEB" }), end: _jsx(Sparkles, { size: 12, "aria-label": "\u60F3\u5F97\u66F4\u6DF1" }), "aria-label": thought.name || "思考强度" }));
}
/** 按钮上写的：自带的（宿主排第一的）agent 只写模型名；别的 agent 写「Claude Code · Opus」，一眼看出谁在答。 */
function answererLabel(agent, lead, modelName) {
    const agentName = agent ? shortAgentName(agent.name) : "";
    if (!modelName)
        return agentName;
    return agent && !lead ? `${agentName} · ${modelName}` : modelName;
}
/**
 * 输入框那一行的「谁来答」（2026-11-27）：一颗按钮写「模型 · 思考」，点开从上到下是 agent（AgentRow）、这个 agent 的模型、思考。
 * agent 给不出模型时按钮写 agent 名；agent 什么设置都不给时弹层里只有 agent 那一排。只有一个 agent、也没有设置时不画。
 */
export function AskAgentSettings() {
    const state = useContext(AskConfigContext);
    const who = useContext(AskAgentsContext);
    const options = state?.options ?? [];
    const agents = who?.agents ?? [];
    const agent = agents.find((entry) => entry.id === who?.agentId);
    const canChooseAgent = Boolean(who && agents.length > 1);
    if (!options.length && !canChooseAgent)
        return null;
    const set = state?.set ?? (() => { });
    const { model, thought, rest } = splitConfig(options);
    const lead = !agent || agents[0]?.id === agent.id;
    // 没有模型可选：拿 agent 自己当唯一的「模型」喂给 ModelSelector（按钮写 agent 名，弹层里不列模型）。
    const models = model
        ? toModelOptions(model, thought)
        : [{ id: "_", name: agent ? shortAgentName(agent.name) : "", icon: agent ? _jsx(AgentIcon, { id: agent.id, name: agent.name }) : undefined, ...(thought ? { efforts: toModelOptions({ ...thought, options: [{ value: "_", name: "" }] }, thought)[0].efforts } : {}) }];
    const value = model ? `${model.currentValue}` : "_";
    const selected = models.find((entry) => entry.id === value);
    const thoughtIndex = thought ? thought.options.findIndex((choice) => choice.value === `${thought.currentValue}`) : -1;
    const effortLabel = thought && thoughtIndex >= 0 ? triggerLevelName(thought, thoughtIndex) : "";
    const label = answererLabel(agent, lead, model ? selected?.name || "" : "");
    return (_jsxs("div", { className: "ask-config", children: [_jsxs(ModelSelectorRoot, { models: models, value: value, onValueChange: (next) => { if (model)
                    set(model.id, next); }, ...(thought ? { effort: `${thought.currentValue}`, onEffortChange: (next) => set(thought.id, next) } : {}), children: [_jsxs(ModelSelectorTrigger, { variant: "ghost", size: "sm", className: "ask-config-trigger", "aria-label": `谁来答：${[agent?.name, model ? selected?.name : "", effortLabel].filter(Boolean).join(" · ")}`, title: `谁来答：${[agent?.name, model ? selected?.name : "", effortLabel].filter(Boolean).join(" · ")}`, children: [selected?.icon ? _jsx("span", { className: "ask-config-icon", children: selected.icon }) : null, _jsx("span", { className: "ask-config-label", children: label }), effortLabel ? _jsx("span", { className: "ask-config-effort-name", children: effortLabel }) : null] }), _jsxs(ModelSelectorContent, { side: "top", searchable: Boolean(model && model.options.length > 8), className: "ask-answerer-popover", children: [who ? _jsx(AgentRow, { agents: agents, agentId: who.agentId, onAgent: who.onAgent }) : null, model && model.options.length > 8 ? _jsx(ModelSelectorSearch, {}) : null, model ? _jsx(ModelSelectorList, {}) : null, thought ? _jsx(EffortRow, { thought: thought, set: set }) : null] })] }), _jsx(OtherSettings, { options: rest, set: set })] }));
}
