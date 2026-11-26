/** 输入框那一行的 agent 设置（Thread 的 ComposerExtra 插槽）：assistant-ui 的 ModelSelector（../ui/elements/model-selector.tsx）——
 * 一个按钮写「模型 · 思考强度」，点开是带搜索、分组的模型列表，底下是思考强度的胶囊滑块（../ui/elements/effort-slider.tsx，仿 Claude 桌面版）；
 * 别的设置项（模式、快速……）收在「更多」里。思考强度的颜色还染输入框和周围、模型厂商的标志做聊天背景的水印（AskWindow）。
 * 数据是 ACP 的 configOptions（agent 开会话时给，见 ../acp/config.ts），agent 不给就什么都不画。
 */
import { createContext, useContext, type ReactElement } from "react";
import { Brain, SlidersHorizontal, Sparkles, Zap } from "lucide-react";
import { Select } from "@retainpdf/ui";

import type { AskConfigOption } from "../contract.js";
import { EffortSlider } from "../ui/elements/effort-slider.js";
import {
  ModelSelectorContent,
  ModelSelectorList,
  ModelSelectorRoot,
  ModelSelectorSearch,
  ModelSelectorTrigger,
} from "../ui/elements/model-selector.js";
import type { ModelOption } from "../ui/utils/model-selection.js";
import { BrandIcon, brandFor } from "./BrandIcon.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/shadcn/popover.js";

export type AskConfigState = {
  options: readonly AskConfigOption[];
  set: (configId: string, value: string | boolean) => void;
};

export const AskConfigContext = createContext<AskConfigState | null>(null);

/** 设置项分三类：模型、思考强度、其余。 */
export function splitConfig(options: readonly AskConfigOption[]) {
  const model = options.find((option) => option.category === "model" && option.type === "select" && option.options.length) || null;
  const thought = options.find((option) => option.category === "thought_level" && option.type === "select" && option.options.length) || null;
  const rest = options.filter((option) => option !== model && option !== thought);
  return { model, thought, rest };
}

/** ModelSelector 要的模型列表：每个模型都带同一份思考强度档位（ACP 的思考强度是整个会话的，不分模型）。 */
export function toModelOptions(model: AskConfigOption, thought: AskConfigOption | null): ModelOption[] {
  // 档位和名字都照 agent 给的（ACP configOptions），前端不认值、不翻译。
  const efforts = thought ? thought.options.map((choice) => ({ id: choice.value, name: choice.name })) : undefined;
  return model.options.map((choice) => ({
    id: choice.value,
    name: choice.name,
    ...(choice.description ? { description: choice.description } : {}),
    ...(choice.group ? { keywords: [choice.group] } : {}),
    icon: <BrandIcon brand={brandFor(choice.value, choice.name, choice.group)} title={choice.group || choice.name} />,
    ...(efforts ? { efforts } : {}),
  }));
}

function OtherSettings({ options, set }: { options: readonly AskConfigOption[]; set: AskConfigState["set"] }): ReactElement | null {
  if (!options.length) return null;
  return (
    <Popover>
      <PopoverTrigger className="ask-icon ask-config-more" aria-label="更多设置" title={options.map((option) => option.name).join("、")}>
        <SlidersHorizontal size={14} aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="ask-config-panel">
        {options.map((option) => (
          <label key={option.id} className="ask-config-row" title={option.description || ""}>
            <span>{option.name}</span>
            <Select
              size="sm"
              value={option.type === "boolean" ? (option.currentValue ? "on" : "off") : `${option.currentValue}`}
              onChange={(event) => set(option.id, option.type === "boolean" ? event.target.value === "on" : event.target.value)}
            >
              {option.type === "boolean"
                ? [<option key="on" value="on">开</option>, <option key="off" value="off">关</option>]
                : option.options.map((choice) => <option key={choice.value} value={choice.value} title={choice.description || ""}>{choice.name}</option>)}
            </Select>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * 思考强度的颜色：不认档位的值，只看它在 agent 给的列表里排第几（agent 按从弱到强排）。
 * 第一档是灰的；往后从绿（--ok）过渡到橙（--warn）再到红（--danger），agent 给几档就分几段。
 */
export function effortColor(index: number, count: number): string {
  if (count <= 1 || index <= 0) return "var(--muted)";
  const t = Math.min(1, index / (count - 1));
  if (t <= 0.5) return `color-mix(in srgb, var(--warn) ${Math.round((t / 0.5) * 100)}%, var(--ok))`;
  return `color-mix(in srgb, var(--danger) ${Math.round(((t - 0.5) / 0.5) * 100)}%, var(--warn))`;
}

/** 当前思考强度的颜色（按它在 agent 列表里的位置）；没有思考强度这一项是 null。第一档（index 0）算「没开」。 */
export function currentEffort(options: readonly AskConfigOption[]): { color: string; on: boolean } | null {
  const { thought } = splitConfig(options);
  if (!thought) return null;
  const index = thought.options.findIndex((choice) => choice.value === `${thought.currentValue}`);
  return { color: effortColor(index, thought.options.length), on: index > 0 };
}

/** 当前模型的厂商（水印用）；没有模型这一项是空串。 */
export function currentModelBrand(options: readonly AskConfigOption[]): string {
  const { model } = splitConfig(options);
  if (!model) return "";
  const choice = model.options.find((entry) => entry.value === `${model.currentValue}`);
  return brandFor(`${model.currentValue}`, choice?.name, choice?.group);
}

/** 弹层里的思考强度：胶囊滑块，档位和名字照 agent 给的，颜色按档位位置（effortColor）；左右两头用图标（快 / 想得深）。 */
function EffortRow({ thought, set }: { thought: AskConfigOption; set: AskConfigState["set"] }): ReactElement {
  return (
    <EffortSlider
      className="ask-effort"
      levels={thought.options.map((choice) => ({ id: choice.value, name: choice.name, ...(choice.description ? { description: choice.description } : {}) }))}
      value={`${thought.currentValue}`}
      onChange={(value) => set(thought.id, value)}
      colorAt={effortColor}
      label={<Brain size={13} aria-label={thought.name || "思考强度"} />}
      start={<Zap size={12} aria-label="更快" />}
      end={<Sparkles size={12} aria-label="想得更深" />}
      aria-label={thought.name || "思考强度"}
    />
  );
}

export function AskAgentSettings(): ReactElement | null {
  const state = useContext(AskConfigContext);
  if (!state?.options.length) return null;
  const { model, thought, rest } = splitConfig(state.options);
  return (
    <div className="ask-config">
      {model ? (
        <ModelSelectorRoot
          models={toModelOptions(model, thought)}
          value={`${model.currentValue}`}
          onValueChange={(value) => state.set(model.id, value)}
          {...(thought ? { effort: `${thought.currentValue}`, onEffortChange: (value: string) => state.set(thought.id, value) } : {})}
        >
          <ModelSelectorTrigger variant="ghost" size="sm" className="ask-config-trigger" />
          <ModelSelectorContent side="top" searchable={model.options.length > 8}>
            {model.options.length > 8 ? <ModelSelectorSearch /> : null}
            <ModelSelectorList />
            {thought ? <EffortRow thought={thought} set={state.set} /> : null}
          </ModelSelectorContent>
        </ModelSelectorRoot>
      ) : thought ? (
        // 只有思考强度、没有模型可选：拿思考强度当唯一的「模型」喂给 ModelSelector，按钮只写档位，弹层只有滑块。
        <ModelSelectorRoot
          models={[{ id: "_", name: "", efforts: toModelOptions({ ...thought, options: [{ value: "_", name: "" }] }, thought)[0].efforts }]}
          value="_"
          effort={`${thought.currentValue}`}
          onEffortChange={(value: string) => state.set(thought.id, value)}
        >
          <ModelSelectorTrigger variant="ghost" size="sm" className="ask-config-trigger">
            <Brain size={13} aria-hidden />
            <span className="ask-config-effort-name">{thought.options.find((choice) => choice.value === `${thought.currentValue}`)?.name}</span>
          </ModelSelectorTrigger>
          <ModelSelectorContent side="top">
            <EffortRow thought={thought} set={state.set} />
          </ModelSelectorContent>
        </ModelSelectorRoot>
      ) : null}
      <OtherSettings options={rest} set={state.set} />
    </div>
  );
}
