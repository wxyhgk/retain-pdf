/** 输入框那一行的 agent 设置（Thread 的 ComposerExtra 插槽）：模型和思考强度用 assistant-ui 的 ModelSelector
 * （../ui/elements/model-selector.tsx：搜索、分组、思考强度一栏），别的设置项（模式、快速……）收在「更多」里。
 * 数据是 ACP 的 configOptions（agent 开会话时给，见 ../acp/config.ts），agent 不给就什么都不画。
 */
import { createContext, useContext, type ReactElement } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Select } from "@retainpdf/ui";

import type { AskConfigOption } from "../contract.js";
import {
  ModelSelectorContent,
  ModelSelectorRoot,
  ModelSelectorTrigger,
} from "../ui/elements/model-selector.js";
import type { ModelOption } from "../ui/utils/model-selection.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/shadcn/popover.js";

export type AskConfigState = {
  options: readonly AskConfigOption[];
  set: (configId: string, value: string | boolean) => void;
};

export const AskConfigContext = createContext<AskConfigState | null>(null);

/** 思考强度的中文名（agent 给的是 low / high 这类 id）。认不出的照 agent 给的名字。 */
const EFFORT_NAMES: Record<string, string> = {
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

export function effortName(value: string, fallback: string): string {
  return EFFORT_NAMES[value] || fallback;
}

/** 设置项分三类：模型、思考强度、其余。 */
export function splitConfig(options: readonly AskConfigOption[]) {
  const model = options.find((option) => option.category === "model" && option.type === "select" && option.options.length) || null;
  const thought = options.find((option) => option.category === "thought_level" && option.type === "select" && option.options.length) || null;
  const rest = options.filter((option) => option !== model && option !== thought);
  return { model, thought, rest };
}

/** ModelSelector 要的模型列表：每个模型都带同一份思考强度档位（ACP 的思考强度是整个会话的，不分模型）。 */
export function toModelOptions(model: AskConfigOption, thought: AskConfigOption | null): ModelOption[] {
  const efforts = thought ? thought.options.map((choice) => ({ id: choice.value, name: effortName(choice.value, choice.name) })) : undefined;
  return model.options.map((choice) => ({
    id: choice.value,
    name: choice.name,
    ...(choice.description ? { description: choice.description } : {}),
    ...(choice.group ? { keywords: [choice.group] } : {}),
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

/** 只有思考强度、没有模型选择时：一个小下拉。 */
function EffortOnly({ thought, set }: { thought: AskConfigOption; set: AskConfigState["set"] }): ReactElement {
  return (
    <Select size="sm" className="ask-config-effort" aria-label="思考强度" title="思考强度" value={`${thought.currentValue}`} onChange={(event) => set(thought.id, event.target.value)}>
      {thought.options.map((choice) => <option key={choice.value} value={choice.value}>思考：{effortName(choice.value, choice.name)}</option>)}
    </Select>
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
          <ModelSelectorContent side="top" searchable={model.options.length > 8} />
        </ModelSelectorRoot>
      ) : thought ? <EffortOnly thought={thought} set={state.set} /> : null}
      <OtherSettings options={rest} set={state.set} />
    </div>
  );
}
