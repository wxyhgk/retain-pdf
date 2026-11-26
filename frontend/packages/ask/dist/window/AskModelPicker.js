import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 输入框那一行的 agent 设置（Thread 的 ComposerExtra 插槽）：模型和思考强度用 assistant-ui 的 ModelSelector
 * （../ui/elements/model-selector.tsx：搜索、分组、思考强度一栏），别的设置项（模式、快速……）收在「更多」里。
 * 数据是 ACP 的 configOptions（agent 开会话时给，见 ../acp/config.ts），agent 不给就什么都不画。
 */
import { createContext, useContext } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Select } from "@retainpdf/ui";
import { ModelSelectorContent, ModelSelectorRoot, ModelSelectorTrigger, } from "../ui/elements/model-selector.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/shadcn/popover.js";
export const AskConfigContext = createContext(null);
/** 思考强度的中文名（agent 给的是 low / high 这类 id）。认不出的照 agent 给的名字。 */
const EFFORT_NAMES = {
    default: "默认",
    off: "不思考",
    none: "不思考",
    minimal: "最少",
    low: "低",
    medium: "中",
    high: "高",
    xhigh: "很高",
    max: "最高",
};
export function effortName(value, fallback) {
    return EFFORT_NAMES[value] || fallback;
}
/** 设置项分三类：模型、思考强度、其余。 */
export function splitConfig(options) {
    const model = options.find((option) => option.category === "model" && option.type === "select" && option.options.length) || null;
    const thought = options.find((option) => option.category === "thought_level" && option.type === "select" && option.options.length) || null;
    const rest = options.filter((option) => option !== model && option !== thought);
    return { model, thought, rest };
}
/** ModelSelector 要的模型列表：每个模型都带同一份思考强度档位（ACP 的思考强度是整个会话的，不分模型）。 */
export function toModelOptions(model, thought) {
    const efforts = thought ? thought.options.map((choice) => ({ id: choice.value, name: effortName(choice.value, choice.name) })) : undefined;
    return model.options.map((choice) => ({
        id: choice.value,
        name: choice.name,
        ...(choice.description ? { description: choice.description } : {}),
        ...(choice.group ? { keywords: [choice.group] } : {}),
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
/** 只有思考强度、没有模型选择时：一个小下拉。 */
function EffortOnly({ thought, set }) {
    return (_jsx(Select, { size: "sm", className: "ask-config-effort", "aria-label": "\u601D\u8003\u5F3A\u5EA6", title: "\u601D\u8003\u5F3A\u5EA6", value: `${thought.currentValue}`, onChange: (event) => set(thought.id, event.target.value), children: thought.options.map((choice) => _jsxs("option", { value: choice.value, children: ["\u601D\u8003\uFF1A", effortName(choice.value, choice.name)] }, choice.value)) }));
}
export function AskAgentSettings() {
    const state = useContext(AskConfigContext);
    if (!state?.options.length)
        return null;
    const { model, thought, rest } = splitConfig(state.options);
    return (_jsxs("div", { className: "ask-config", children: [model ? (_jsxs(ModelSelectorRoot, { models: toModelOptions(model, thought), value: `${model.currentValue}`, onValueChange: (value) => state.set(model.id, value), ...(thought ? { effort: `${thought.currentValue}`, onEffortChange: (value) => state.set(thought.id, value) } : {}), children: [_jsx(ModelSelectorTrigger, { variant: "ghost", size: "sm", className: "ask-config-trigger" }), _jsx(ModelSelectorContent, { side: "top", searchable: model.options.length > 8 })] })) : thought ? _jsx(EffortOnly, { thought: thought, set: state.set }) : null, _jsx(OtherSettings, { options: rest, set: state.set })] }));
}
