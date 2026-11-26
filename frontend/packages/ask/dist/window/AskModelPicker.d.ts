/** 输入框那一行的 agent 设置（Thread 的 ComposerExtra 插槽）：模型和思考强度用 assistant-ui 的 ModelSelector
 * （../ui/elements/model-selector.tsx：搜索、分组、思考强度一栏），别的设置项（模式、快速……）收在「更多」里。
 * 数据是 ACP 的 configOptions（agent 开会话时给，见 ../acp/config.ts），agent 不给就什么都不画。
 */
import { type ReactElement } from "react";
import type { AskConfigOption } from "../contract.js";
import type { ModelOption } from "../ui/utils/model-selection.js";
export type AskConfigState = {
    options: readonly AskConfigOption[];
    set: (configId: string, value: string | boolean) => void;
};
export declare const AskConfigContext: import("react").Context<AskConfigState>;
export declare function effortName(value: string, fallback: string): string;
/** 设置项分三类：模型、思考强度、其余。 */
export declare function splitConfig(options: readonly AskConfigOption[]): {
    model: AskConfigOption;
    thought: AskConfigOption;
    rest: AskConfigOption[];
};
/** ModelSelector 要的模型列表：每个模型都带同一份思考强度档位（ACP 的思考强度是整个会话的，不分模型）。 */
export declare function toModelOptions(model: AskConfigOption, thought: AskConfigOption | null): ModelOption[];
export declare function AskAgentSettings(): ReactElement | null;
