import type { ReaderAskSessionSummary } from "./use-reader-ask-runtime.js";
export type ReaderConversationBarProps = {
    sessions: ReaderAskSessionSummary[];
    activeId: string;
    busy?: boolean;
    disabled?: boolean;
    errorText?: string;
    onSwitch: (conversationId: string) => void | Promise<void>;
    onNew: () => void | Promise<void>;
    onDelete: (conversationId: string) => void | Promise<void>;
    onRename: (conversationId: string, title: string) => void | Promise<void>;
};
export declare function ReaderConversationBar({ sessions, activeId, busy, disabled, errorText, onSwitch, onNew, onDelete, onRename, }: ReaderConversationBarProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderConversationBar.d.ts.map