// ACP（Agent Client Protocol）的 session/update → 问答窗里一条回答的各部分（assistant-ui 的 message parts）。
//
// - agent_message_chunk → 正文（text），agent_thought_chunk → 思考（reasoning）：同类相邻的接着拼，中间插了别的就新起一段。
// - tool_call / tool_call_update → 工具调用卡片（tool-call），按 toolCallId 合并；要许可时由窗口另外画按钮（见 ../window/blocks.tsx 的 ToolCard）。
// - plan → 计划（data: "plan"，整份替换）；subagent_update → 子 agent（data: "subagent"，按 sessionId 合并）。
// - usage_update → 用量（上下文用了多少 / 多大 / 费用）；输入、输出、缓存命中的 token 不在 ACP 标准里，读 `_meta.retainpdf.usage`（自带 agent 给）或 `_meta.usage`。
// - 速度：拿得到输出 token 就按 token 算，拿不到按字数估（标成「字/秒」）。
//
// 纯函数，不认识 React、不认识网络；测试在 frontend/web/tests/ask/。
export function emptyTurn(now) {
    return { parts: [], usage: {}, startedAt: now, firstTokenAt: null, lastTokenAt: null, chars: 0, chunks: 0 };
}
function blockText(block) {
    if (block.type === "text")
        return block.text;
    if (block.type === "resource_link")
        return block.title || block.name || block.uri;
    return "";
}
function contentText(content) {
    return (content || [])
        .map((item) => (item.type === "content" ? blockText(item.content) : item.type === "diff" ? `改了 ${item.path}` : ""))
        .filter(Boolean)
        .join("\n");
}
function locationText(locations) {
    return (locations || []).map((location) => (location.line != null ? `${location.path}:${location.line}` : location.path));
}
function withMemory(memory) {
    return memory ? { memory } : {};
}
/** tool_call_update 的 _meta.retainpdf.memory → 「已记住」；编号、字没有就不算。 */
export function memoryFromMeta(meta) {
    const raw = meta?.retainpdf?.memory;
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id || typeof raw.text !== "string")
        return undefined;
    return {
        id: raw.id,
        scope: typeof raw.scope === "string" ? raw.scope : "user",
        text: raw.text,
        ...(typeof raw.category === "string" ? { category: raw.category } : {}),
        documentId: typeof raw.document_id === "string" ? raw.document_id : null,
        created: raw.created !== false,
    };
}
/** 这一轮记下的记忆编号（新记的；早就记过的不算）。 */
export function turnMemoryIds(parts) {
    const ids = [];
    for (const part of parts) {
        if (part.type !== "tool-call" || !part.artifact.memory?.created)
            continue;
        if (!ids.includes(part.artifact.memory.id))
            ids.push(part.artifact.memory.id);
    }
    return ids;
}
function numberOr(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
/**
 * `_meta` 里的分项 token：RetainPDF 自带 agent 放在 `_meta.retainpdf.usage`（后端 2026-11-25 定），别的 agent 可能放 `_meta.usage`；
 * 几种常见写法都认（camelCase / snake_case / Anthropic 的 cache_read_input_tokens）。
 */
export function usageFromMeta(meta) {
    const object = meta;
    // Claude Code（claude-agent-acp）把模型名放在 _meta["_claude/model"]。
    const claudeModel = typeof object?.["_claude/model"] === "string" ? object["_claude/model"] : "";
    const usage = object?.retainpdf?.usage ?? object?.usage;
    if (!usage || typeof usage !== "object")
        return claudeModel ? { model: claudeModel } : {};
    const pick = (...keys) => {
        for (const key of keys) {
            const value = numberOr(usage[key]);
            if (value !== undefined)
                return value;
        }
        return undefined;
    };
    const out = {};
    const input = pick("inputTokens", "input_tokens", "promptTokens", "prompt_tokens");
    const output = pick("outputTokens", "output_tokens", "completionTokens", "completion_tokens");
    const cached = pick("cachedInputTokens", "cachedReadTokens", "cache_read_tokens", "cache_read_input_tokens", "cached_tokens");
    const cacheWrite = pick("cacheWriteTokens", "cachedWriteTokens", "cache_write_tokens", "cache_creation_input_tokens");
    const reasoning = pick("reasoningTokens", "reasoning_tokens", "thoughtTokens");
    if (input !== undefined)
        out.inputTokens = input;
    if (output !== undefined)
        out.outputTokens = output;
    if (cached !== undefined)
        out.cachedInputTokens = cached;
    if (reasoning !== undefined)
        out.reasoningTokens = reasoning;
    if (cacheWrite !== undefined)
        out.cacheWriteTokens = cacheWrite;
    if (typeof usage.model === "string" && usage.model)
        out.model = usage.model;
    else if (claudeModel)
        out.model = claudeModel;
    const thinking = usage.thinking;
    if (thinking && typeof thinking === "object" && typeof thinking.thought === "boolean") {
        const notice = typeof thinking.notice === "string" ? thinking.notice.trim() : "";
        out.thinking = { level: typeof thinking.level === "string" ? thinking.level : "", thought: thinking.thought, ...(notice ? { notice } : {}) };
    }
    return out;
}
/** 还没收尾的思考记上结束（后面来了别的内容，或这一轮答完了）。 */
export function closeOpenReasoning(parts, wall) {
    return parts.map((part) => (part.type === "reasoning" && part.timing && part.timing.completedAt === undefined
        ? { ...part, timing: { ...part.timing, completedAt: wall } }
        : part));
}
function appendStreamed(parts, type, text, wall) {
    const last = parts[parts.length - 1];
    if (last && last.type === type)
        return [...parts.slice(0, -1), { ...last, text: last.text + text }];
    if (type === "reasoning")
        return [...parts, { type, text, timing: { startedAt: wall } }];
    return [...closeOpenReasoning(parts, wall), { type, text }];
}
/** 一条 session/update 合进这一轮的回答。不认识的更新原样忽略。 */
export function applySessionUpdate(turn, update, now, wall = Date.now()) {
    switch (update.sessionUpdate) {
        case "agent_message_chunk":
        case "agent_thought_chunk": {
            const text = blockText(update.content);
            if (!text)
                return turn;
            const type = update.sessionUpdate === "agent_message_chunk" ? "text" : "reasoning";
            return {
                ...turn,
                parts: appendStreamed(turn.parts, type, text, wall),
                chars: turn.chars + text.length,
                chunks: (turn.chunks || 0) + 1,
                firstTokenAt: turn.firstTokenAt ?? now,
                lastTokenAt: now,
            };
        }
        case "tool_call":
        case "tool_call_update": {
            const at = turn.parts.findIndex((part) => part.type === "tool-call" && part.toolCallId === update.toolCallId);
            const previous = at >= 0 ? turn.parts[at] : null;
            const status = (update.status || previous?.artifact.status || "pending");
            const rawInput = update.rawInput !== undefined ? update.rawInput : previous?.args;
            const args = rawInput && typeof rawInput === "object" ? rawInput : {};
            const output = update.content != null ? contentText(update.content) : previous?.artifact.output || "";
            const finished = status === "completed" || status === "failed";
            const next = {
                type: "tool-call",
                timing: { startedAt: previous?.timing?.startedAt ?? wall, ...(finished ? { completedAt: previous?.timing?.completedAt ?? wall } : {}) },
                toolCallId: update.toolCallId,
                toolName: update.name || previous?.toolName || update.kind || "tool",
                args,
                argsText: JSON.stringify(args),
                result: update.rawOutput !== undefined ? update.rawOutput : previous?.result,
                isError: status === "failed",
                artifact: {
                    title: update.title || previous?.artifact.title || update.name || "工具",
                    kind: update.kind || previous?.artifact.kind || "other",
                    status,
                    locations: update.locations != null ? locationText(update.locations) : previous?.artifact.locations || [],
                    output,
                    ...withMemory(memoryFromMeta(update._meta) ?? previous?.artifact.memory),
                },
            };
            const parts = at >= 0 ? turn.parts.map((part, index) => (index === at ? next : part)) : [...closeOpenReasoning(turn.parts, wall), next];
            return { ...turn, parts };
        }
        case "plan": {
            const at = turn.parts.findIndex((part) => part.type === "data" && part.name === "plan");
            const next = { type: "data", name: "plan", data: { entries: update.entries } };
            // 计划整份替换，留在第一次出现的位置。
            return { ...turn, parts: at >= 0 ? turn.parts.map((part, index) => (index === at ? next : part)) : [...turn.parts, next] };
        }
        case "subagent_update": {
            const at = turn.parts.findIndex((part) => part.type === "data" && part.name === "subagent" && part.data.id === update.sessionId);
            const previous = at >= 0 ? (turn.parts[at].data) : null;
            const state = update.state?.state || previous?.state || "running";
            const next = {
                type: "data",
                name: "subagent",
                data: {
                    id: update.sessionId,
                    title: update.title || previous?.title || "子 agent",
                    description: update.description || previous?.description || "",
                    state,
                },
            };
            return { ...turn, parts: at >= 0 ? turn.parts.map((part, index) => (index === at ? next : part)) : [...turn.parts, next] };
        }
        case "usage_update": {
            const usage = { ...turn.usage, contextUsed: update.used, contextSize: update.size, ...usageFromMeta(update._meta) };
            if (update.cost)
                usage.cost = { amount: update.cost.amount, currency: update.cost.currency };
            return { ...turn, usage };
        }
        default:
            return turn;
    }
}
/** 至少收到几段才算速度：一次整段发来的（Claude Code 常这样），首字到末字只有零点几秒，算出来几千 token/s，是假的。 */
export const SPEED_MIN_CHUNKS = 5;
/** 出字速度：从第一个字到最后一个字。有输出 token 按 token 算，没有按字数估；不到 0.3 秒、段数太少都不算（不准）。 */
export function turnSpeed(turn) {
    if (turn.firstTokenAt == null || turn.lastTokenAt == null)
        return null;
    if ((turn.chunks ?? SPEED_MIN_CHUNKS) < SPEED_MIN_CHUNKS)
        return null;
    const seconds = (turn.lastTokenAt - turn.firstTokenAt) / 1000;
    if (seconds < 0.3)
        return null;
    if (turn.usage.outputTokens)
        return { value: turn.usage.outputTokens / seconds, unit: "token/s" };
    return turn.chars ? { value: turn.chars / seconds, unit: "字/s" } : null;
}
/** 回答底下那一行：模型、用量、缓存命中、速度、首字、用时。没有的项不写。 */
export function turnFooter(turn, finishedAt, agentName = "") {
    const items = [];
    const { usage } = turn;
    if (agentName)
        items.push(usage.model ? `${agentName}（${usage.model}）` : agentName);
    else if (usage.model)
        items.push(usage.model);
    if (usage.inputTokens !== undefined || usage.outputTokens !== undefined) {
        items.push(`输入 ${usage.inputTokens ?? "?"} · 输出 ${usage.outputTokens ?? "?"} token`);
    }
    if (usage.cachedInputTokens)
        items.push(`缓存命中 ${usage.cachedInputTokens}`);
    if (usage.cacheWriteTokens)
        items.push(`写入缓存 ${usage.cacheWriteTokens}`);
    if (usage.contextUsed !== undefined && usage.contextSize) {
        items.push(`上下文 ${Math.round((usage.contextUsed / usage.contextSize) * 100)}%`);
    }
    if (usage.cost)
        items.push(`${usage.cost.amount.toFixed(4)} ${usage.cost.currency}`);
    const speed = turnSpeed(turn);
    if (speed)
        items.push(`${speed.value.toFixed(speed.value >= 10 ? 0 : 1)} ${speed.unit}`);
    if (turn.firstTokenAt != null)
        items.push(`首字 ${((turn.firstTokenAt - turn.startedAt) / 1000).toFixed(1)}s`);
    if (finishedAt != null)
        items.push(`用时 ${((finishedAt - turn.startedAt) / 1000).toFixed(1)}s`);
    return items.join(" · ");
}
/** 1234 → 1.2k，1234567 → 1.2M。 */
export function compactNumber(value) {
    if (value < 1000)
        return String(Math.round(value));
    if (value < 1_000_000)
        return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
    return `${(value / 1_000_000).toFixed(1)}M`;
}
/** 回答底下那一行（图标版）：和 turnFooter 同样的几项，没有的不出。 */
export function turnFooterItems(turn, finishedAt, agentName = "") {
    const items = [];
    const { usage } = turn;
    const model = usage.model || "";
    if (model || agentName)
        items.push({ key: "model", text: model || agentName, title: model && agentName ? `${agentName}（${model}）` : model || agentName });
    if (usage.inputTokens !== undefined)
        items.push({ key: "input", text: compactNumber(usage.inputTokens), title: `输入 ${usage.inputTokens} token` });
    if (usage.outputTokens !== undefined)
        items.push({ key: "output", text: compactNumber(usage.outputTokens), title: `输出 ${usage.outputTokens} token` });
    if (usage.cachedInputTokens)
        items.push({ key: "cacheRead", text: compactNumber(usage.cachedInputTokens), title: `缓存命中 ${usage.cachedInputTokens} token` });
    if (usage.cacheWriteTokens)
        items.push({ key: "cacheWrite", text: compactNumber(usage.cacheWriteTokens), title: `写入缓存 ${usage.cacheWriteTokens} token` });
    if (usage.contextUsed !== undefined && usage.contextSize) {
        const percent = Math.round((usage.contextUsed / usage.contextSize) * 100);
        items.push({ key: "context", text: `${percent}%`, title: `上下文用了 ${percent}%（${usage.contextUsed} / ${usage.contextSize} token）` });
    }
    if (usage.cost)
        items.push({ key: "cost", text: `${usage.cost.currency === "USD" ? "$" : ""}${usage.cost.amount.toFixed(usage.cost.amount < 0.1 ? 4 : 2)}`, title: `花费 ${usage.cost.amount} ${usage.cost.currency}` });
    const speed = turnSpeed(turn);
    if (speed) {
        const value = speed.value.toFixed(speed.value >= 10 ? 0 : 1);
        items.push({ key: "speed", text: `${value}/s`, title: `出字速度 ${value} ${speed.unit}` });
    }
    if (turn.firstTokenAt != null) {
        const seconds = ((turn.firstTokenAt - turn.startedAt) / 1000).toFixed(1);
        items.push({ key: "firstToken", text: `${seconds}s`, title: `首字 ${seconds} 秒` });
    }
    if (finishedAt != null) {
        const seconds = ((finishedAt - turn.startedAt) / 1000).toFixed(1);
        items.push({ key: "elapsed", text: `${seconds}s`, title: `用时 ${seconds} 秒` });
    }
    return items;
}
