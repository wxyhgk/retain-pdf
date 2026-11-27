/** 输入框那一行的「谁来答」（Thread 的 ComposerExtra 插槽）：assistant-ui 的 ModelSelector（../ui/elements/model-selector.tsx）——
 * 一个按钮写「模型 · 思考」，点开从上到下是 agent 那一排（agent-row.tsx，2026-11-27 从标题栏挪来，没装的也在这里）、带搜索的模型列表、
 * 思考强度（几档的是胶囊滑块，../ui/elements/effort-slider.tsx，仿 Claude 桌面版；只有开 / 关的是开关）；
 * 别的设置项（模式、快速……）收在「更多」里。思考强度的颜色还染输入框和周围、模型厂商的标志做聊天背景的水印（AskWindow）。
 * 数据是 ACP 的 configOptions（agent 开会话时给，见 ../acp/config.ts）和宿主列出的 agent。
 *
 * 只有两档的思考强度（Qwen3、DeepSeek 这类模型只能开 / 关，2026-11-27）画成一个开关，不画两格的滑块；
 * agent 没给档位起名字（名字就是值，自带 agent 报的 off / on / low …）时换成中文（levelName）。
 */
import { type ReactElement } from "react";
import type { AskConfigOption } from "../contract.js";
import type { ModelOption } from "../ui/utils/model-selection.js";
export type AskConfigState = {
    options: readonly AskConfigOption[];
    set: (configId: string, value: string | boolean) => void;
};
export declare const AskConfigContext: import("react").Context<AskConfigState>;
/** 设置项分三类：模型、思考强度、其余。 */
export declare function splitConfig(options: readonly AskConfigOption[]): {
    model: AskConfigOption;
    thought: AskConfigOption;
    rest: AskConfigOption[];
};
/** 档位显示的名字：agent 起了名字就照它；名字就是值（没起）时认得的换成中文，认不得的照原样。 */
export declare function levelName(choice: {
    value: string;
    name?: string;
}): string;
/** 只有两档（从弱到强：关、开）：画成开关，不画滑块。 */
export declare function isThinkingSwitch(thought: AskConfigOption | null): boolean;
/** ModelSelector 要的模型列表：每个模型都带同一份思考强度档位（ACP 的思考强度是整个会话的，不分模型）。 */
export declare function toModelOptions(model: AskConfigOption, thought: AskConfigOption | null): ModelOption[];
/**
 * 思考强度的颜色：不认档位的值，只看它在 agent 给的列表里排第几（agent 按从弱到强排）。
 * 第一档是灰的；往后从绿（--ok）过渡到橙（--warn）再到红（--danger），agent 给几档就分几段。
 */
export declare function effortColor(index: number, count: number): string;
/** 当前思考强度的颜色（按它在 agent 列表里的位置）；没有思考强度这一项是 null。第一档（index 0）算「没开」。 */
export declare function currentEffort(options: readonly AskConfigOption[]): {
    color: string;
    on: boolean;
} | null;
/** 当前模型的厂商（水印用）；没有模型这一项是空串。 */
export declare function currentModelBrand(options: readonly AskConfigOption[]): string;
/** 弹层里的思考强度：几档的是胶囊滑块，名字照 agent 给的（没起名的换中文），颜色按档位位置（effortColor），左右两头用图标（快 / 想得深）；
 * 只有两档的是开关（EffortSwitch）。 */
export declare function EffortRow({ thought, set }: {
    thought: AskConfigOption;
    set: AskConfigState["set"];
}): ReactElement;
/**
 * 输入框那一行的「谁来答」（2026-11-27）：一颗按钮写「模型 · 思考」，点开从上到下是 agent（AgentRow）、这个 agent 的模型、思考。
 * agent 给不出模型时按钮写 agent 名；agent 什么设置都不给时弹层里只有 agent 那一排。只有一个 agent、也没有设置时不画。
 */
export declare function AskAgentSettings(): ReactElement | null;
