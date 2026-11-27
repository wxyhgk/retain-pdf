/** 提问窗往 assistant-ui 的 Thread 里塞的几块（AskWindow 用）：工具调用一行一个、工具分组的图标、计划、子 agent、
 * 「在想…」、回答底下的用量（图标）、空白时的几个常问。图标多、字少，细节放悬停提示。
 */
import { type ComponentType, type PropsWithChildren, type ReactElement } from "react";
import { SimpleImageAttachmentAdapter, type DataMessagePartProps, type ToolCallMessagePartProps } from "@assistant-ui/react";
import { type AskSubagent } from "../acp/parts.js";
import type { PermissionStore } from "../acp/adapter.js";
import type { ThreadGroupPart } from "../ui/elements/thread.aui.js";
export declare const PermissionContext: import("react").Context<PermissionStore>;
type IconType = ComponentType<{
    size?: number;
    className?: string;
    "aria-hidden"?: boolean;
}>;
/** ACP 工具的 kind → 图标。自带 agent 的「看第 N 页的图」也是 fetch，看标题里有没有「页」。 */
export declare function toolIcon(kind: string, title: string): IconType;
/**
 * 工具调用：一行——图标、标题（页码能点）、结果摘要、状态、用时；点开看结果全文和参数。
 * 等许可的还是用 assistant-ui 官方的 ToolFallback（它的许可界面），ACP 的选项换成它认的写法。
 */
export declare function ToolCard(props: ToolCallMessagePartProps): ReactElement;
/** 工具分组的标题：用到的几种工具的图标、次数；正在跑的写它的标题。 */
export declare function AskToolGroup({ group, children }: PropsWithChildren<{
    group: ThreadGroupPart;
}>): ReactElement;
/** 计划（ACP plan，整份替换）：assistant-ui 官方的 TodoList（每项状态图标、进度「1/3」、新项进场动画）。 */
export declare function PlanBlock({ data }: DataMessagePartProps<{
    entries: {
        content: string;
        status: string;
    }[];
}>): ReactElement;
/** 子 agent（ACP subagent_update）：assistant-ui 官方的 AgentStatus（小胶囊：进行中 / 等着 / 完成 / 失败）。 */
export declare function SubagentBlock({ data }: DataMessagePartProps<AskSubagent>): ReactElement;
/** 第一段到之前等多久就补一句「还在等」（本机 agent 起进程、模型排队都可能慢），不说的话像卡住了。 */
export declare const ASK_SLOW_HINT_MS = 10000;
/** Thread 的「正在回答」指示（还没有任何内容时它会画）：说一声在想；等久了再说一句。 */
export declare function Waiting(): ReactElement;
/** 自带 agent 只认 png / jpeg / webp / gif，单张最好 4MB 以内（Anthropic 单张约 5MB 上限，一条 WebSocket 消息最大 32MB；后端 11-26 说的）。 */
export declare const ASK_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";
export declare const ASK_IMAGE_MAX_BYTES: number;
export declare class AskImageAttachmentAdapter extends SimpleImageAttachmentAdapter {
    accept: string;
    add(state: {
        file: File;
    }): Promise<import("@assistant-ui/core").PendingAttachment>;
}
/** 回答底下的用量（Thread 的 MessageFooter 插槽，和复制、重新回答在同一排）：只一个图标，点开看模型、token、缓存、速度、用时。Extra 跟在后面（深挖……）。 */
export declare function makeMessageFooter(agentName: () => string, Extra?: ComponentType): () => ReactElement | null;
/**
 * 输入框上面、出处下面的一排常问（2026-11-27）：带着书上的一处（刚右键「问这段」、窗口开着时新选了字）、输入框空着、没在答时才有，
 * 点一下带这处直接问，问完出处清掉、这排跟着没了。对话一直延续（主对话），空白时的常问只在第一次看得到，所以挪到这里。
 */
export declare function PendingStarters(): ReactElement | null;
export declare function makeWelcome(send: (text: string) => void): () => ReactElement | null;
export {};
