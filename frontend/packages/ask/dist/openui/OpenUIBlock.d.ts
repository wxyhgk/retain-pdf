/** 回答里的互动块（```openui-lang 代码块）：OpenUI 的渲染器 + 去掉外网组件的组件库（library.ts）。单独一块，第一次出现时才加载。
 *
 * - 流式时边收边画（isStreaming 时表单不能点）。
 * - 写错了（解析出错、组件不认识）：答完以后显示原文和错误，「让它修」把错误发回给 agent。
 * - 按钮：@ToAssistant 当作用户的下一问发出去（带上表单里填的值）；@OpenUrl 只开 http(s)，新标签页、不带 opener。
 * 方案：docs/ops/planning/reader-ask/20261126-互动块分层提示词.md。
 */
import { type ReactElement } from "react";
import { type ActionEvent } from "@openuidev/react-lang";
export type OpenUIBlockProps = {
    code: string;
    streaming: boolean;
    mode: "light" | "dark";
    /** 替用户发一句（@ToAssistant、「让它修」）。 */
    send: ((text: string) => void) | null;
};
type Problem = {
    code?: string;
    statementId?: string;
    message: string;
};
/** 只开 http(s)：模型写的 javascript:、data: 这类地址什么都不做。 */
export declare function safeUrl(value: unknown): string | null;
/** @ToAssistant 发出去的那句：按钮上的话，加上表单里填的值。 */
export declare function actionMessage(event: Pick<ActionEvent, "humanFriendlyMessage" | "formState">): string;
/** 「让它修」发回去的话。 */
export declare function fixMessage(problems: readonly Problem[]): string;
export default function OpenUIBlock({ code, streaming, mode, send }: OpenUIBlockProps): ReactElement;
export {};
