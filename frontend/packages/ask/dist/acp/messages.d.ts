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
/**
 * 重新打开：交给 assistant-ui（ThreadMessageLike）。用量放回 metadata，回答底下那一行照样画（没有速度、首字照存的写）。
 * 宿主的编号当消息编号；问题的出处、回答的标记（结论卡片、压缩点）放 metadata.custom，插槽从那里读。
 */
export declare function toInitialMessages(messages: readonly AskMessage[]): ({
    id: string;
    role: "user";
    content: string;
    metadata?: {
        custom: {
            context: import("../contract.js").AskMessageContext;
            turn?: undefined;
            endedAt?: undefined;
            stored?: undefined;
        };
    };
} | {
    id?: undefined;
    role: "user";
    content: string;
    metadata?: {
        custom: {
            context: import("../contract.js").AskMessageContext;
            turn?: undefined;
            endedAt?: undefined;
            stored?: undefined;
        };
    };
} | {
    id: string;
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
            context?: undefined;
            turn: AskTurn;
            endedAt: number;
            stored: {
                id: string;
                marks: {
                    sideSummary?: {
                        sideId: string | null;
                        title?: string;
                    };
                    compactedBefore?: boolean;
                };
            };
        };
    };
} | {
    id?: undefined;
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
            context?: undefined;
            turn: AskTurn;
            endedAt: number;
            stored: {
                id: string;
                marks: {
                    sideSummary?: {
                        sideId: string | null;
                        title?: string;
                    };
                    compactedBefore?: boolean;
                };
            };
        };
    };
})[];
/** 新会话的第一问前面带的「之前的对话」：最近几条，太长从前面截。没有就是空串。 */
export declare function historyText(messages: readonly MessageLike[]): string;
export {};
