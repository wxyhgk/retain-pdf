import type { AskConfigOption } from "../contract.js";
/** agent 给的设置项 → 窗口用的。认不出的项跳过。 */
export declare function normalizeConfigOptions(raw: unknown): AskConfigOption[];
/** 用户想要的值（窗口记的，换会话以后再设一次）里，和 agent 现在的不一样、又是 agent 认的那些。 */
export declare function pendingConfig(options: readonly AskConfigOption[], desired: Readonly<Record<string, string | boolean>>): [string, string | boolean][];
