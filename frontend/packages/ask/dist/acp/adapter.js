// 问答窗（assistant-ui 的 LocalRuntime）和 ACP 会话之间的那一层：
// - 用户发一句 → session/prompt；新会话的第一句前面带上宿主给的出处（AskContext.preamble）和之前几轮。
// - agent 的 session/update 一条条合进这一轮的回答（parts.ts），边收边交给界面。
// - agent 要许可 → 记在 permissions 里，窗口画「允许 / 拒绝」，用户点了才回给 agent。
// 会话在第一次发问时才开；换 agent、重新回答、改问题时关掉旧的重开。
import { normalizeConfigOptions, pendingConfig } from "./config.js";
import { applySessionUpdate, closeOpenReasoning, emptyTurn, turnSpeed, usageFromMeta } from "./parts.js";
import { historyText } from "./messages.js";
export class PermissionStore {
    pending = new Map();
    listeners = new Set();
    version = 0;
    add(request) {
        return new Promise((resolve) => {
            const key = request.toolCall.toolCallId;
            this.pending.set(key, {
                request,
                resolve: (response) => {
                    this.pending.delete(key);
                    this.bump();
                    resolve(response);
                },
            });
            this.bump();
        });
    }
    get(toolCallId) {
        return this.pending.get(toolCallId);
    }
    all() {
        return [...this.pending.values()];
    }
    /** 关窗 / 停下时，没回的都按取消回掉，agent 不会一直等。 */
    cancelAll() {
        for (const item of [...this.pending.values()])
            item.resolve({ outcome: { outcome: "cancelled" } });
    }
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    snapshot = () => this.version;
    bump() {
        this.version += 1;
        for (const listener of this.listeners)
            listener();
    }
}
/** 一轮回答 → assistant-ui 的 content parts。 */
export function toAssistantParts(parts) {
    return parts.map((part) => {
        if (part.type === "tool-call")
            return { ...part, args: part.args };
        return part;
    });
}
/** 用户贴的图（assistant-ui 的图片附件，data URL）→ ACP 的 image 内容块。不是 data URL 的不发。 */
export function imageBlocks(message) {
    if (!message)
        return [];
    const parts = [...message.content, ...(message.attachments || []).flatMap((attachment) => attachment.content || [])];
    const blocks = [];
    for (const part of parts) {
        if (part.type !== "image" || !part.image)
            continue;
        const match = /^data:([^;,]+);base64,(.+)$/.exec(part.image);
        if (match)
            blocks.push({ type: "image", mimeType: match[1], data: match[2] });
    }
    return blocks;
}
/** 这项设置是不是开会话时定的（改了要重开会话）。 */
function needsReopen(session, configId) {
    const rule = session.reopenOnConfigChange;
    return typeof rule === "function" ? rule(configId) : Boolean(rule);
}
/** assistant-ui 的 ChatModelAdapter：run 是 async generator，边收边吐当前这一轮的样子。 */
export function createAcpChatAdapter(options) {
    const now = options.now ?? (() => performance.now());
    let session = null;
    let sessionAgent = "";
    let onUpdate = null;
    let sentPreamble = false;
    // 这个会话已经听过几条（问 + 答）。重新回答、改了问题、切到别的版本时，对话和会话里的对不上：开新会话，把到这里为止的带过去。
    let sessionSeen = 0;
    // 正在开的会话（提前开和发问撞在一起时只开一个）。
    let opening = null;
    const open = async (agentId) => {
        const desired = options.getDesiredConfig?.() || {};
        const next = await options.port.openSession({ agentId, config: desired }, {
            onUpdate: (update) => {
                // 设置项变了（agent 自己改了模型、模式）：交给窗口，不算回答的一部分。
                if (update.sessionUpdate === "config_option_update") {
                    options.onConfig?.(normalizeConfigOptions(update.configOptions));
                    return;
                }
                onUpdate?.(update);
            },
            onPermission: (request) => options.permissions.add(request),
        });
        // 用户选过的模型、思考强度：新会话再设一次（agent 不认的值跳过，设不上也不挡着发问）。
        let config = next.configOptions || [];
        // 开会话时就定了的（reopenOnConfigChange）不用再设，别的再设一次。
        if (next.setConfigOption) {
            for (const [id, value] of pendingConfig(config, desired)) {
                if (needsReopen(next, id))
                    continue;
                try {
                    config = await next.setConfigOption(id, value);
                }
                catch {
                    // 设不上就用 agent 现在的。
                }
            }
        }
        options.onConfig?.(config);
        return next;
    };
    const ensureSession = async () => {
        const agentId = options.getAgentId();
        if (session && sessionAgent === agentId)
            return session;
        if (opening && sessionAgent === agentId)
            return opening;
        session?.close();
        session = null;
        sessionAgent = agentId;
        opening = open(agentId);
        try {
            session = await opening;
        }
        finally {
            opening = null;
        }
        if (sessionAgent !== agentId) {
            // 开的时候用户换了 agent：这个不要了。
            session.close();
            session = null;
            return ensureSession();
        }
        // 新会话（换了 agent、重新回答、断线）不知道前面问过什么，出处再带一次。
        sentPreamble = false;
        sessionSeen = 0;
        return session;
    };
    const adapter = {
        async *run({ messages, abortSignal }) {
            const lastIndex = messages.map((message) => message.role).lastIndexOf("user");
            const last = lastIndex >= 0 ? messages[lastIndex] : undefined;
            if (session && lastIndex !== sessionSeen) {
                session.close();
                session = null;
            }
            const question = (last?.content || []).map((part) => (part.type === "text" ? part.text || "" : "")).join("\n").trim();
            let current;
            try {
                current = await ensureSession();
            }
            catch (error) {
                // 连不上（agent 没开、没装、设置不对、握手被拒）：在回答的位置说清楚，不要一片空白。
                session = null;
                const message = error instanceof Error ? error.message : String(error);
                yield {
                    content: [{ type: "text", text: `（连不上这个 agent：${message}）` }],
                    status: { type: "incomplete", reason: "error", error: message },
                };
                return;
            }
            const preamble = sentPreamble ? "" : options.getPreamble().trim();
            const blocks = [];
            if (preamble)
                blocks.push({ type: "text", text: preamble });
            // 新会话（重新打开、换了 agent、断线重连）不知道之前聊过什么：带上之前几轮。
            const earlier = !sentPreamble && lastIndex > 0 ? historyText(messages.slice(0, lastIndex)) : "";
            if (earlier)
                blocks.push({ type: "text", text: earlier });
            blocks.push({ type: "text", text: question || "（看图）" });
            blocks.push(...imageBlocks(last));
            sentPreamble = true;
            let turn = emptyTurn(now());
            let wake = null;
            let changed = false;
            onUpdate = (update) => {
                turn = applySessionUpdate(turn, update, now());
                changed = true;
                wake?.();
            };
            const onAbort = () => {
                options.permissions.cancelAll();
                current.cancel();
            };
            abortSignal.addEventListener("abort", onAbort);
            let finished = false;
            let failure = null;
            let stopReason = "end_turn";
            current.prompt(blocks).then((result) => {
                stopReason = result.stopReason;
                // 结果里的用量（Claude Code 的 usage、自带 agent 的 _meta.retainpdf.usage）合进这一轮，底下那一行就有分项 token。
                const extra = { ...usageFromMeta(result.meta), ...usageFromMeta(result.usage ? { usage: result.usage } : null) };
                if (Object.keys(extra).length) {
                    turn = { ...turn, usage: { ...turn.usage, ...extra } };
                    changed = true;
                }
                finished = true;
                wake?.();
            }, (error) => {
                failure = error;
                finished = true;
                wake?.();
            });
            try {
                while (!finished || changed) {
                    if (!changed)
                        await new Promise((resolve) => (wake = resolve));
                    wake = null;
                    if (changed) {
                        changed = false;
                        yield { content: toAssistantParts(turn.parts), metadata: { custom: { turn } } };
                    }
                }
            }
            finally {
                abortSignal.removeEventListener("abort", onAbort);
                onUpdate = null;
            }
            const endedAt = now();
            turn = { ...turn, parts: closeOpenReasoning(turn.parts, Date.now()) };
            if (!failure)
                sessionSeen = lastIndex + 2;
            const speed = turnSpeed(turn);
            const timing = {
                streamStartTime: turn.startedAt,
                firstTokenTime: turn.firstTokenAt ?? undefined,
                totalStreamTime: endedAt - turn.startedAt,
                tokenCount: turn.usage.outputTokens,
                tokensPerSecond: speed?.unit === "token/s" ? speed.value : undefined,
                totalChunks: 0,
                toolCallCount: turn.parts.filter((part) => part.type === "tool-call").length,
            };
            if (failure) {
                const message = failure instanceof Error ? failure.message : String(failure);
                // 连接断了（agent 退出、桥用 1011 关）：扔掉这个会话，下一问重开（出处会再带一次）。
                if (/close|closed|1011|disconnect|断/i.test(message)) {
                    session?.close();
                    session = null;
                }
                yield {
                    content: toAssistantParts([...turn.parts, { type: "text", text: `\n\n（出错了：${message}）` }]),
                    status: { type: "incomplete", reason: "error", error: message },
                    metadata: { custom: { turn, endedAt }, timing },
                };
                return;
            }
            yield {
                content: toAssistantParts(turn.parts),
                status: stopReason === "cancelled"
                    ? { type: "incomplete", reason: "cancelled" }
                    : stopReason === "max_tokens"
                        ? { type: "incomplete", reason: "length" }
                        : { type: "complete", reason: "stop" },
                metadata: { custom: { turn, endedAt }, timing },
            };
        },
    };
    return {
        adapter,
        /** 提前开会话（选了 agent 就开），好拿到模型、思考强度这些设置项。开不了不报错，发问时再说。 */
        async prepare() {
            try {
                await ensureSession();
            }
            catch {
                // 发问时会在回答的位置说清楚为什么连不上。
            }
        },
        /** 改一个设置项：会话开着就马上设；没开就等下次开会话（getDesiredConfig 里有）。 */
        async setConfig(configId, value) {
            if (!session?.setConfigOption)
                return false;
            const current = session;
            options.onConfig?.(await current.setConfigOption(configId, value));
            if (needsReopen(current, configId) && session === current) {
                // 设置是开会话时定的：关掉，下一问按新设置重开（之前几轮照样带过去）。
                current.close();
                session = null;
            }
            return true;
        },
        close() {
            options.permissions.cancelAll();
            session?.close();
            session = null;
        },
    };
}
