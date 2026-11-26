import type { AskMemoryNotice, AskMessage, AskTurnRecord } from "@retainpdf/ask";
import type { AskCompactionPointView, AskConversationMessageRecord, AskConversationRecord } from "@retainpdf/api/ai";
import type { ReaderAskAnchor, ReaderAskPort } from "../contracts/ask.js";
import { type AskBook } from "./conversation-messages.js";
export type AskConversationView = {
    conversation: AskConversationRecord | null;
    /** 主对话（副对话时是它的主对话，面包屑用）。 */
    main: AskConversationRecord | null;
    records: AskConversationMessageRecord[];
    compactions: Pick<AskCompactionPointView, "covers_to_seq">[];
    hasMore: boolean;
    /** 窗口重开的键（换对话、取了更早的）。 */
    key: string;
    initial: AskMessage[];
};
export declare function useAskConversation({ port, book, onAppended }: {
    port: ReaderAskPort | null;
    book: AskBook;
    onAppended?: (records: AskConversationMessageRecord[]) => void;
}): {
    visible: boolean;
    view: AskConversationView;
    loading: boolean;
    error: string;
    pending: ReaderAskAnchor;
    setPending: import("react").Dispatch<import("react").SetStateAction<ReaderAskAnchor>>;
    closingSide: "busy" | "failed" | "idle";
    notices: ReadonlyMap<string, readonly AskMemoryNotice[]>;
    persistent: boolean;
    openMain: () => Promise<void>;
    ask: (anchor: ReaderAskAnchor) => void;
    close: () => void;
    loadEarlier: () => Promise<void>;
    onTurn: (turn: AskTurnRecord) => void;
    rewrite: (windowId: string) => Promise<import("@retainpdf/contracts/ask-conversations").AskSelectionRecord>;
    fork: (message: {
        id?: string;
        text: string;
    }) => Promise<void>;
    openSide: (sideId: string) => Promise<void>;
    backToMain: () => Promise<void>;
    closeSide: () => Promise<void>;
    archiveMain: () => Promise<void>;
    forgetMemory: (memoryId: string) => Promise<void>;
};
//# sourceMappingURL=use-ask-conversation.d.ts.map