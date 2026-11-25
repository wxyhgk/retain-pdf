import type { PlanEntry, SessionUpdate } from "@agentclientprotocol/sdk";
export type AskToolCall = {
    type: "tool-call";
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    argsText: string;
    result?: unknown;
    isError?: boolean;
    /** 卡片要画的：标题、种类、状态、读到哪些位置、输出的文字。 */
    artifact: {
        title: string;
        kind: string;
        status: "pending" | "in_progress" | "completed" | "failed";
        locations: string[];
        output: string;
    };
};
export type AskPart = {
    type: "text";
    text: string;
} | {
    type: "reasoning";
    text: string;
} | AskToolCall | {
    type: "data";
    name: "plan";
    data: {
        entries: PlanEntry[];
    };
} | {
    type: "data";
    name: "subagent";
    data: AskSubagent;
};
export type AskSubagent = {
    id: string;
    title: string;
    description: string;
    state: string;
};
export type AskUsage = {
    /** 上下文用了多少 token / 一共多大（ACP usage_update）。 */
    contextUsed?: number;
    contextSize?: number;
    cost?: {
        amount: number;
        currency: string;
    };
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    /** 写进缓存的 token（Anthropic 的提示缓存）。 */
    cacheWriteTokens?: number;
    reasoningTokens?: number;
    /** 实际用的模型（自带 agent 在 _meta.retainpdf.usage.model 里给）。 */
    model?: string;
};
export type AskTurn = {
    parts: AskPart[];
    usage: AskUsage;
    /** 计时：开始、第一个字、最后一个字（毫秒，performance.now 那套）。 */
    startedAt: number;
    firstTokenAt: number | null;
    lastTokenAt: number | null;
    /** 正文 + 思考一共多少字（拿不到 token 时估速度用）。 */
    chars: number;
};
export declare function emptyTurn(now: number): AskTurn;
/**
 * `_meta` 里的分项 token：RetainPDF 自带 agent 放在 `_meta.retainpdf.usage`（后端 2026-11-25 定），别的 agent 可能放 `_meta.usage`；
 * 几种常见写法都认（camelCase / snake_case / Anthropic 的 cache_read_input_tokens）。
 */
export declare function usageFromMeta(meta: unknown): Partial<AskUsage>;
/** 一条 session/update 合进这一轮的回答。不认识的更新原样忽略。 */
export declare function applySessionUpdate(turn: AskTurn, update: SessionUpdate, now: number): AskTurn;
export type AskSpeed = {
    value: number;
    unit: "token/s" | "字/s";
} | null;
/** 出字速度：从第一个字到最后一个字。有输出 token 按 token 算，没有按字数估；不到 0.3 秒不算（太短不准）。 */
export declare function turnSpeed(turn: AskTurn): AskSpeed;
/** 回答底下那一行：模型、用量、缓存命中、速度、首字、用时。没有的项不写。 */
export declare function turnFooter(turn: AskTurn, finishedAt: number | null, agentName?: string): string;
//# sourceMappingURL=acp-parts.d.ts.map