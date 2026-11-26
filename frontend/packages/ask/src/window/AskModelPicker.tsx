/** 输入框那一行的 agent 设置（Thread 的 ComposerExtra 插槽）：都是 assistant-ui 的 ModelSelector（../ui/elements/model-selector.tsx）——
 * 模型是一个按钮（点开是带搜索、分组的列表），思考强度是旁边一排胶囊（ModelSelectorEffort，一点就切）；
 * 别的设置项（模式、快速……）收在「更多」里。
 * 数据是 ACP 的 configOptions（agent 开会话时给，见 ../acp/config.ts），agent 不给就什么都不画。
 */
import { createContext, useContext, type CSSProperties, type ReactElement } from "react";
import { Brain, SlidersHorizontal } from "lucide-react";
import { Select } from "@retainpdf/ui";

import type { AskConfigOption } from "../contract.js";
import {
  ModelSelectorContent,
  ModelSelectorEffort,
  ModelSelectorList,
  ModelSelectorRoot,
  ModelSelectorSearch,
  ModelSelectorTrigger,
  ModelSelectorValue,
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

/** 思考强度的胶囊（ModelSelectorEffort）：图标代替「思考」两个字，悬停写全；选中的那档按它在列表里的位置上色。 */
function EffortCapsule({ thought }: { thought: AskConfigOption }): ReactElement {
  const index = thought.options.findIndex((choice) => choice.value === `${thought.currentValue}`);
  const style = { "--ask-effort-color": effortColor(index, thought.options.length) } as CSSProperties;
  return <ModelSelectorEffort className="ask-effort" style={style} label={<Brain size={13} aria-label="思考强度" />} title={`思考强度：${thought.options[index]?.name ?? ""}`} />;
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
          <ModelSelectorTrigger variant="ghost" size="sm" className="ask-config-trigger">
            <ModelSelectorValue showEffort={false} />
          </ModelSelectorTrigger>
          <ModelSelectorContent side="top" searchable={model.options.length > 8}>
            {model.options.length > 8 ? <ModelSelectorSearch /> : null}
            <ModelSelectorList />
          </ModelSelectorContent>
          {thought ? <EffortCapsule thought={thought} /> : null}
        </ModelSelectorRoot>
      ) : thought ? (
        // 只有思考强度、没有模型可选：拿思考强度当唯一的「模型」喂给 ModelSelector，只画胶囊。
        <ModelSelectorRoot
          models={[{ id: "_", name: "", efforts: toModelOptions({ ...thought, options: [{ value: "_", name: "" }] }, thought)[0].efforts }]}
          value="_"
          effort={`${thought.currentValue}`}
          onEffortChange={(value: string) => state.set(thought.id, value)}
        >
          <EffortCapsule thought={thought} />
        </ModelSelectorRoot>
      ) : null}
      <OtherSettings options={rest} set={state.set} />
    </div>
  );
}
