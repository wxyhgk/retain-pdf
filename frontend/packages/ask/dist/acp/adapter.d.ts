import type { ContentBlock, RequestPermissionRequest, RequestPermissionResponse } from "@agentclientprotocol/sdk";
import type { AskPort } from "../contract.js";
import { type AskPart, type AskTurn } from "./parts.js";
/** 等用户点的许可请求（按 toolCallId 认；窗口在那张工具卡片上画按钮）。 */
export type PendingPermission = {
    request: RequestPermissionRequest;
    resolve: (response: RequestPermissionResponse) => void;
};
export declare class PermissionStore {
    private pending;
    private listeners;
    private version;
    add(request: RequestPermissionRequest): Promise<RequestPermissionResponse>;
    get(toolCallId: string): PendingPermission | undefined;
    all(): PendingPermission[];
    /** 关窗 / 停下时，没回的都按取消回掉，agent 不会一直等。 */
    cancelAll(): void;
    subscribe: (listener: () => void) => () => boolean;
    snapshot: () => number;
    private bump;
}
/** 一轮回答 → assistant-ui 的 content parts。 */
export declare function toAssistantParts(parts: readonly AskPart[]): ({
    type: "text";
    text: string;
} | {
    type: "reasoning";
    text: string;
    timing?: import("./parts.js").AskTiming;
} | {
    type: "data";
    name: "plan";
    data: {
        entries: import("@agentclientprotocol/sdk").PlanEntry[];
    };
} | {
    type: "data";
    name: "subagent";
    data: import("./parts.js").AskSubagent;
} | {
    type: "tool-call";
    timing?: import("./parts.js").AskTiming;
    toolCallId: string;
    toolName: string;
    argsText: string;
    result?: unknown;
    isError?: boolean;
    artifact: {
        title: string;
        kind: string;
        status: "pending" | "in_progress" | "completed" | "failed";
        locations: string[];
        output: string;
    };
    args: never;
})[];
export type AcpChatOptions = {
    port: AskPort;
    getAgentId: () => string;
    /** 新会话第一问前面带的出处（宿主写好的一段字）；空的不带。 */
    getPreamble: () => string;
    permissions: PermissionStore;
    now?: () => number;
};
type RunPart = {
    type: string;
    text?: string;
    image?: string;
};
type RunOptions = {
    messages: readonly {
        role: string;
        content: readonly RunPart[];
        attachments?: readonly {
            content?: readonly RunPart[];
        }[];
    }[];
    abortSignal: AbortSignal;
};
/** 用户贴的图（assistant-ui 的图片附件，data URL）→ ACP 的 image 内容块。不是 data URL 的不发。 */
export declare function imageBlocks(message: RunOptions["messages"][number] | undefined): ContentBlock[];
/** assistant-ui 的 ChatModelAdapter：run 是 async generator，边收边吐当前这一轮的样子。 */
export declare function createAcpChatAdapter(options: AcpChatOptions): {
    adapter: {
        run({ messages, abortSignal }: RunOptions): AsyncGenerator<{
            content: never;
            status: {
                type: string;
                reason: string;
                error: string;
            };
            metadata?: undefined;
        } | {
            content: never;
            metadata: {
                custom: {
                    turn: AskTurn;
                    endedAt?: undefined;
                };
                timing?: undefined;
            };
            status?: undefined;
        } | {
            content: never;
            status: {
                type: string;
                reason: string;
                error: string;
            };
            metadata: {
                custom: {
                    turn: AskTurn;
                    endedAt: number;
                };
                timing: {
                    streamStartTime: number;
                    firstTokenTime: number;
                    totalStreamTime: number;
                    tokenCount: number;
                    tokensPerSecond: number;
                    totalChunks: number;
                    toolCallCount: number;
                };
            };
        } | {
            content: never;
            status: {
                error?: undefined;
                type: string;
                reason: string;
            };
            metadata: {
                custom: {
                    turn: AskTurn;
                    endedAt: number;
                };
                timing: {
                    streamStartTime: number;
                    firstTokenTime: number;
                    totalStreamTime: number;
                    tokenCount: number;
                    tokensPerSecond: number;
                    totalChunks: number;
                    toolCallCount: number;
                };
            };
        }, void, unknown>;
    };
    close(): void;
};
export {};
