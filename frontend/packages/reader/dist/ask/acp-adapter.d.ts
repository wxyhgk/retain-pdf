import type { ContentBlock, RequestPermissionRequest, RequestPermissionResponse } from "@agentclientprotocol/sdk";
import type { ReaderAskAnchor, ReaderAskPort } from "../contracts/ask.js";
import { type AskPart, type AskTurn } from "./acp-parts.js";
/** 第一句前面的出处：一段文字，agent 不管有没有接书的工具都看得懂；带上任务号和块号，接了 retainpdf mcp 的 agent 能自己去读。 */
export declare function anchorPromptBlocks(anchor: ReaderAskAnchor, jobId: string, bookTitle?: string): ContentBlock[];
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
} | {
    type: "data";
    name: "plan";
    data: {
        entries: import("@agentclientprotocol/sdk").PlanEntry[];
    };
} | {
    type: "data";
    name: "subagent";
    data: import("./acp-parts.js").AskSubagent;
} | {
    type: "tool-call";
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
    port: ReaderAskPort;
    jobId: string;
    getAgentId: () => string;
    getAnchor: () => ReaderAskAnchor | null;
    bookTitle?: string;
    permissions: PermissionStore;
    now?: () => number;
};
type RunOptions = {
    messages: readonly {
        role: string;
        content: readonly {
            type: string;
            text?: string;
        }[];
    }[];
    abortSignal: AbortSignal;
};
/** assistant-ui 的 ChatModelAdapter：run 是 async generator，边收边吐当前这一轮的样子。 */
export declare function createAcpChatAdapter(options: AcpChatOptions): {
    adapter: {
        run({ messages, abortSignal }: RunOptions): AsyncGenerator<{
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
//# sourceMappingURL=acp-adapter.d.ts.map