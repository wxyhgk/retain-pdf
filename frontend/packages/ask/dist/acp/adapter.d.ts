import type { ContentBlock, RequestPermissionRequest, RequestPermissionResponse } from "@agentclientprotocol/sdk";
import type { AskConfigOption, AskContext, AskPort } from "../contract.js";
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
        memory?: import("../contract.js").AskMemoryNotice;
    };
    args: never;
})[];
export type AcpChatOptions = {
    port: AskPort;
    getAgentId: () => string;
    /** 这一问问的是哪儿（发问那一刻读）；没有是 null。 */
    getContext: () => AskContext | null;
    permissions: PermissionStore;
    now?: () => number;
    /** agent 的设置项变了（开了新会话、agent 推来 config_option_update、用户改了）。 */
    onConfig?: (options: AskConfigOption[]) => void;
    /** 发问那一刻：哪条问题带了哪个出处（窗口在问题上面画小标签）。 */
    onAsked?: (messageId: string, context: AskContext | null) => void;
    /** 用户选过的值（模型、思考强度……）：每开一个新会话再设一次。 */
    getDesiredConfig?: () => Readonly<Record<string, string | boolean>>;
};
type RunPart = {
    type: string;
    text?: string;
    image?: string;
};
type RunOptions = {
    messages: readonly {
        id?: string;
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
    /** 提前开会话（选了 agent 就开），好拿到模型、思考强度这些设置项。开不了不报错，发问时再说。 */
    prepare(): Promise<void>;
    /** 改一个设置项：会话开着就马上设；没开就等下次开会话（getDesiredConfig 里有）。 */
    setConfig(configId: string, value: string | boolean): Promise<boolean>;
    /** 答最近一轮的会话的 sessionId（agent 没给就没有）。 */
    sessionId: () => string;
    /** 最近答完的一轮：用的出处、会话、这一轮记下的记忆编号。 */
    lastRun: () => {
        context: AskContext | null;
        sessionId?: string;
        memoryIds: string[];
        startedAt?: number;
    };
    close(): void;
};
export {};
