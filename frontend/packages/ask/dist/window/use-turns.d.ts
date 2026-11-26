import type { AskContext, AskMessage, AskTurnRecord } from "../contract.js";
type ThreadLike = {
    subscribe: (listener: () => void) => () => void;
    getState: () => {
        isRunning: boolean;
        messages: readonly unknown[];
    };
};
type RunInfo = {
    context: AskContext | null;
    sessionId?: string;
    memoryIds: string[];
};
/** 最后一问和它的回答；回答出错（连不上、断线）不算一轮。 */
export declare function lastTurn(messages: readonly unknown[]): {
    question: unknown;
    answer: unknown;
} | null;
export declare function useTurns({ thread, agentId, run, sessionId, onTurn, onTurnDone, }: {
    thread: ThreadLike;
    agentId: () => string;
    run: () => RunInfo;
    sessionId: () => string | undefined;
    onTurn?: (turn: AskTurnRecord) => void;
    onTurnDone?: (messages: AskMessage[], agentId: string, sessionId?: string) => void;
}): void;
export {};
