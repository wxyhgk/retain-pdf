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
};
export type ThreadProps = {
    components?: ThreadComponents | undefined;
    autoFocus?: boolean | undefined;
};
export declare const Thread: FC<ThreadProps>;
//# sourceMappingURL=thread.aui.d.ts.map