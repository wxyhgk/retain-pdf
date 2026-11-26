import type { ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
import type { AskMark } from "./ReaderAskMarks.js";
export type OpenAsk = {
    key: number;
    anchor: ReaderAskAnchor;
    initial: ReaderAskMessage[];
};
export declare function useAskThreads({ port, documentId, resetKey }: {
    port: ReaderAskPort | null;
    documentId: string;
    resetKey: string;
}): {
    marks: AskMark[];
    open: OpenAsk;
    ask: (anchor: ReaderAskAnchor) => void;
    reopen: (mark: AskMark) => Promise<void>;
    save: (key: number, messages: ReaderAskMessage[], agentId: string, sessionId?: string) => void;
    remove: (key: number) => void;
    close: () => void;
    persistent: boolean;
};
//# sourceMappingURL=use-ask-threads.d.ts.map