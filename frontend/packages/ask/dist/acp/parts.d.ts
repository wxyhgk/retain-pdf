import type { PlanEntry, SessionUpdate } from "@agentclientprotocol/sdk";
import type { AskMemoryNotice } from "../contract.js";
/** 部件的起止时刻（毫秒时间戳，assistant-ui 的 MessagePartTiming）：思考写「思考（N 秒）」、工具调用写用时都靠它。 */
export type AskTiming = {
    startedAt: number;
    completedAt?: number;
};
export type AskToolCall = {
    type: "tool-call";
    timing?: AskTiming;
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
        /** 「已记住」：自带 agent 的 remember 完成时 _meta.retainpdf.memory 给的那条记忆。 */
        memory?: AskMemoryNotice;
    };
};
export type AskPart = {
    type: "text";
    text: string;
} | {
    type: "reasoning";
    text: string;
    timing?: AskTiming;
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
    /** 收到几段正文 / 思考（一次整段发来的 agent，比如 Claude Code，段数少，算不出速度）。 */
    chunks: number;
};
export declare function emptyTurn(now: number): AskTurn;
/** tool_call_update 的 _meta.retainpdf.memory → 「已记住」；编号、字没有就不算。 */
export declare function memoryFromMeta(meta: unknown): AskMemoryNotice | undefined;
/** 这一轮记下的记忆编号（新记的；早就记过的不算）。 */
export declare function turnMemoryIds(parts: readonly AskPart[]): string[];
/**
 * `_meta` 里的分项 token：RetainPDF 自带 agent 放在 `_meta.retainpdf.usage`（后端 2026-11-25 定），别的 agent 可能放 `_meta.usage`；
 * 几种常见写法都认（camelCase / snake_case / Anthropic 的 cache_read_input_tokens）。
 */
export declare function usageFromMeta(meta: unknown): Partial<AskUsage>;
/** 还没收尾的思考记上结束（后面来了别的内容，或这一轮答完了）。 */
export declare function closeOpenReasoning(parts: readonly AskPart[], wall: number): AskPart[];
/** 一条 session/update 合进这一轮的回答。不认识的更新原样忽略。 */
export declare function applySessionUpdate(turn: AskTurn, update: SessionUpdate, now: number, wall?: number): AskTurn;
export type AskSpeed = {
    value: number;
    unit: "token/s" | "字/s";
} | null;
/** 至少收到几段才算速度：一次整段发来的（Claude Code 常这样），首字到末字只有零点几秒，算出来几千 token/s，是假的。 */
export declare const SPEED_MIN_CHUNKS = 5;
/** 出字速度：从第一个字到最后一个字。有输出 token 按 token 算，没有按字数估；不到 0.3 秒、段数太少都不算（不准）。 */
export declare function turnSpeed(turn: AskTurn): AskSpeed;
/** 回答底下那一行：模型、用量、缓存命中、速度、首字、用时。没有的项不写。 */
export declare function turnFooter(turn: AskTurn, finishedAt: number | null, agentName?: string): string;
/** 用量那一行的一项：图标认 key，字尽量短，悬停（title）写全。 */
export type FooterItem = {
    key: "model" | "input" | "output" | "cacheRead" | "cacheWrite" | "context" | "cost" | "speed" | "firstToken" | "elapsed";
    text: string;
    title: string;
};
/** 1234 → 1.2k，1234567 → 1.2M。 */
export declare function compactNumber(value: number): string;
/** 回答底下那一行（图标版）：和 turnFooter 同样的几项，没有的不出。 */
export declare function turnFooterItems(turn: AskTurn, finishedAt: number | null, agentName?: string): FooterItem[];
