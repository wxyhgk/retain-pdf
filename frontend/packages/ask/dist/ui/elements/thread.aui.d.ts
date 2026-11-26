import { MessagePrimitive, type ToolCallMessagePartComponent } from "@assistant-ui/react";
import { type ComponentType, type FC, type PropsWithChildren } from "react";
export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;
/**
 * Optional component overrides for the thread. `AssistantMessage` and
 * `Welcome` replace whole sections; the message slots override tool calls,
 * part groups, and the pending indicator. Tool UIs registered
 * by name (toolkit `render`, `useAssistantDataUI`) take precedence over
 * `ToolFallback`. When `TaskGroup` is set, tool calls that carry a nested
 * conversation and have no registered UI render through it instead of the
 * tool group; without it they render like any other tool call.
 * `ComposerExtra` renders in the composer's action row beside the attach
 * button.
 */
export type ThreadComponents = {
    AssistantMessage?: ComponentType | undefined;
    Welcome?: ComponentType | undefined;
    Indicator?: ComponentType | undefined;
    ToolFallback?: ToolCallMessagePartComponent | undefined;
    ToolGroup?: ComponentType<PropsWithChildren<{
        group: ThreadGroupPart;
    }>> | undefined;
    ReasoningGroup?: ComponentType<PropsWithChildren<{
        group: ThreadGroupPart;
    }>> | undefined;
    TaskGroup?: ComponentType<{
        group: ThreadGroupPart;
    }> | undefined;
    ComposerExtra?: ComponentType | undefined;
    /** RetainPDF：回答底下操作条下面再放一样东西（用量那一行）。 */
    MessageFooter?: ComponentType | undefined;
    /** RetainPDF：消息列表最上面（「看更早的」）。 */
    HistoryTop?: ComponentType | undefined;
    /** RetainPDF：输入框上面（这一问带的出处）。 */
    ComposerTop?: ComponentType | undefined;
    /** RetainPDF：问题上面（这一问问的是哪儿）。 */
    UserMessageTop?: ComponentType | undefined;
    /** RetainPDF：回答正文下面、操作条上面（「已记住」、压缩点）。 */
    MessageAfter?: ComponentType | undefined;
};
export type ThreadProps = {
    components?: ThreadComponents | undefined;
    autoFocus?: boolean | undefined;
};
export declare const Thread: FC<ThreadProps>;
