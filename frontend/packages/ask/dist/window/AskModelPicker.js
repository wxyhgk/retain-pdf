import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 输入框那一行的 agent 设置（Thread 的 ComposerExtra 插槽）：都是 assistant-ui 的 ModelSelector（../ui/elements/model-selector.tsx）——
 * 模型是一个按钮（点开是带搜索、分组的列表），思考强度是旁边一排胶囊（ModelSelectorEffort，一点就切）；
 * 别的设置项（模式、快速……）收在「更多」里。
 * 数据是 ACP 的 configOptions（agent 开会话时给，见 ../acp/config.ts），agent 不给就什么都不画。
 */
import { createContext, useContext } from "react";
import { Brain, SlidersHorizontal } from "lucide-react";
import { Select } from "@retainpdf/ui";
import { ModelSelectorContent, ModelSelectorEffort, ModelSelectorList, ModelSelectorRoot, ModelSelectorSearch, ModelSelectorTrigger, ModelSelectorValue, } from "../ui/elements/model-selector.js";
import { BrandIcon, brandFor } from "./BrandIcon.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/shadcn/popover.js";
export const AskConfigContext = createContext(null);
/** 设置项分三类：模型、思考强度、其余。 */
export function splitConfig(options) {
    const model = options.find((option) => option.category === "model" && option.type === "select" && option.options.length) || null;
    const thought = options.find((option) => option.category === "thought_level" && option.type === "select" && option.options.length) || null;
    const rest = options.filter((option) => option !== model && option !== thought);
    return { model, thought, rest };
}
/** ModelSelector 要的模型列表：每个模型都带同一份思考强度档位（ACP 的思考强度是整个会话的，不分模型）。 */
export function toModelOptions(model, thought) {
    // 档位和名字都照 agent 给的（ACP configOptions），前端不认值、不翻译。
    const efforts = thought ? thought.options.map((choice) => ({ id: choice.value, name: choice.name })) : undefined;
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
    const t = Math.min(1, index / (count - 1));
    if (t <= 0.5)
        return `color-mix(in srgb, var(--warn) ${Math.round((t / 0.5) * 100)}%, var(--ok))`;
    return `color-mix(in srgb, var(--danger) ${Math.round(((t - 0.5) / 0.5) * 100)}%, var(--warn))`;
}
/** 思考强度的胶囊（ModelSelectorEffort）：图标代替「思考」两个字，悬停写全；选中的那档按它在列表里的位置上色。 */
function EffortCapsule({ thought }) {
    const index = thought.options.findIndex((choice) => choice.value === `${thought.currentValue}`);
    const style = { "--ask-effort-color": effortColor(index, thought.options.length) };
    return _jsx(ModelSelectorEffort, { className: "ask-effort", style: style, label: _jsx(Brain, { size: 13, "aria-label": "\u601D\u8003\u5F3A\u5EA6" }), title: `思考强度：${thought.options[index]?.name ?? ""}` });
}
export function AskAgentSettings() {
    const state = useContext(AskConfigContext);
    if (!state?.options.length)
        return null;
    const { model, thought, rest } = splitConfig(state.options);
    return (_jsxs("div", { className: "ask-config", children: [model ? (_jsxs(ModelSelectorRoot, { models: toModelOptions(model, thought), value: `${model.currentValue}`, onValueChange: (value) => state.set(model.id, value), ...(thought ? { effort: `${thought.currentValue}`, onEffortChange: (value) => state.set(thought.id, value) } : {}), children: [_jsx(ModelSelectorTrigger, { variant: "ghost", size: "sm", className: "ask-config-trigger", children: _jsx(ModelSelectorValue, { showEffort: false }) }), _jsxs(ModelSelectorContent, { side: "top", searchable: model.options.length > 8, children: [model.options.length > 8 ? _jsx(ModelSelectorSearch, {}) : null, _jsx(ModelSelectorList, {})] }), thought ? _jsx(EffortCapsule, { thought: thought }) : null] })) : thought ? (_jsx(ModelSelectorRoot, { models: [{ id: "_", name: "", efforts: toModelOptions({ ...thought, options: [{ value: "_", name: "" }] }, thought)[0].efforts }], value: "_", effort: `${thought.currentValue}`, onEffortChange: (value) => state.set(thought.id, value), children: _jsx(EffortCapsule, { thought: thought }) })) : null, _jsx(OtherSettings, { options: rest, set: state.set })] }));
}
