import type { AskMessage } from "../contract.js";
import { type AskTurn } from "./parts.js";
type PartLike = {
    type: string;
    text?: string;
    timing?: {
        startedAt?: number;
        completedAt?: number;
    };
};
type MessageLike = {
    role: string;
    content: readonly PartLike[];
    metadata?: {
        custom?: Record<string, unknown>;
    };
};
export declare function toStoredMessages(messages: readonly MessageLike[]): AskMessage[];
/** 重新打开：交给 assistant-ui（ThreadMessageLike）。用量放回 metadata，回答底下那一行照样画（没有速度、首字照存的写）。 */
export declare function toInitialMessages(messages: readonly AskMessage[]): ({
    role: "user";
    content: string;
    status?: undefined;
    metadata?: undefined;
} | {
    role: "assistant";
    content: ({
        timing: {
            startedAt: number;
            completedAt: number;
        };
        type: "reasoning";
        text: string;
    } | {
        timing?: undefined;
        type: "reasoning";
        text: string;
    } | {
        type: "text";
        text: string;
    })[];
    status: {
        type: "complete";
        reason: "stop";
    };
    metadata: {
        custom: {
            turn: AskTurn;
            endedAt: number;
        };
    };
})[];
/** 新会话的第一问前面带的「之前的对话」：最近几条，太长从前面截。没有就是空串。 */
export declare function historyText(messages: readonly MessageLike[]): string;
export {};
