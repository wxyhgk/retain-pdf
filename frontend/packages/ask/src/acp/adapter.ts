// 问答窗（assistant-ui 的 LocalRuntime）和 ACP 会话之间的那一层：
// - 用户发一句 → session/prompt；新会话的第一句前面带上宿主给的出处（AskContext.preamble）和之前几轮。
// - agent 的 session/update 一条条合进这一轮的回答（parts.ts），边收边交给界面。
// - agent 要许可 → 记在 permissions 里，窗口画「允许 / 拒绝」，用户点了才回给 agent。
// 会话在第一次发问时才开；换 agent、重新回答、改问题时关掉旧的重开。

import type { ContentBlock, RequestPermissionRequest, RequestPermissionResponse, SessionUpdate } from "@agentclientprotocol/sdk";

import type { AskPort, AskSession } from "../contract.js";
import { applySessionUpdate, closeOpenReasoning, emptyTurn, turnSpeed, usageFromMeta, type AskPart, type AskTurn } from "./parts.js";
import { historyText } from "./messages.js";

/** 等用户点的许可请求（按 toolCallId 认；窗口在那张工具卡片上画按钮）。 */
export type PendingPermission = {
  request: RequestPermissionRequest;
  resolve: (response: RequestPermissionResponse) => void;
};

export class PermissionStore {
  private pending = new Map<string, PendingPermission>();
  private listeners = new Set<() => void>();
  private version = 0;

  add(request: RequestPermissionRequest): Promise<RequestPermissionResponse> {
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

  get(toolCallId: string): PendingPermission | undefined {
    return this.pending.get(toolCallId);
  }

  all(): PendingPermission[] {
    return [...this.pending.values()];
  }

  /** 关窗 / 停下时，没回的都按取消回掉，agent 不会一直等。 */
  cancelAll(): void {
    for (const item of [...this.pending.values()]) item.resolve({ outcome: { outcome: "cancelled" } });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  snapshot = () => this.version;

  private bump() {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}

/** 一轮回答 → assistant-ui 的 content parts。 */
export function toAssistantParts(parts: readonly AskPart[]) {
  return parts.map((part) => {
    if (part.type === "tool-call") return { ...part, args: part.args as never };
    return part;
  });
}

export type AcpChatOptions = {
  port: AskPort;
  getAgentId: () => string;
  /** 新会话第一问前面带的出处（宿主写好的一段字）；空的不带。 */
  getPreamble: () => string;
  permissions: PermissionStore;
  now?: () => number;
};

type RunPart = { type: string; text?: string; image?: string };
type RunOptions = {
  messages: readonly { role: string; content: readonly RunPart[]; attachments?: readonly { content?: readonly RunPart[] }[] }[];
  abortSignal: AbortSignal;
};

/** 用户贴的图（assistant-ui 的图片附件，data URL）→ ACP 的 image 内容块。不是 data URL 的不发。 */
export function imageBlocks(message: RunOptions["messages"][number] | undefined): ContentBlock[] {
  if (!message) return [];
  const parts = [...message.content, ...(message.attachments || []).flatMap((attachment) => attachment.content || [])];
  const blocks: ContentBlock[] = [];
  for (const part of parts) {
    if (part.type !== "image" || !part.image) continue;
    const match = /^data:([^;,]+);base64,(.+)$/.exec(part.image);
    if (match) blocks.push({ type: "image", mimeType: match[1], data: match[2] });
  }
  return blocks;
}

/** assistant-ui 的 ChatModelAdapter：run 是 async generator，边收边吐当前这一轮的样子。 */
export function createAcpChatAdapter(options: AcpChatOptions) {
  const now = options.now ?? (() => performance.now());
  let session: AskSession | null = null;
  let sessionAgent = "";
  let onUpdate: ((update: SessionUpdate) => void) | null = null;
  let sentPreamble = false;
  // 这个会话已经听过几条（问 + 答）。重新回答、改了问题、切到别的版本时，对话和会话里的对不上：开新会话，把到这里为止的带过去。
  let sessionSeen = 0;

  const ensureSession = async () => {
    const agentId = options.getAgentId();
    if (session && sessionAgent === agentId) return session;
    session?.close();
    session = await options.port.openSession(
      { agentId },
      {
        onUpdate: (update) => onUpdate?.(update),
        onPermission: (request) => options.permissions.add(request),
      },
    );
    sessionAgent = agentId;
    // 新会话（换了 agent、重新回答、断线）不知道前面问过什么，出处再带一次。
    sentPreamble = false;
    sessionSeen = 0;
    return session;
  };

  const adapter = {
    async *run({ messages, abortSignal }: RunOptions) {
      const lastIndex = messages.map((message) => message.role).lastIndexOf("user");
      const last = lastIndex >= 0 ? messages[lastIndex] : undefined;
      if (session && lastIndex !== sessionSeen) {
        session.close();
        session = null;
      }
      const question = (last?.content || []).map((part) => (part.type === "text" ? part.text || "" : "")).join("\n").trim();
      let current: AskSession;
      try {
        current = await ensureSession();
      } catch (error) {
        // 连不上（agent 没开、没装、设置不对、握手被拒）：在回答的位置说清楚，不要一片空白。
        session = null;
        const message = error instanceof Error ? error.message : String(error);
        yield {
          content: [{ type: "text", text: `（连不上这个 agent：${message}）` }] as never,
          status: { type: "incomplete", reason: "error", error: message },
        };
        return;
      }
      const preamble = sentPreamble ? "" : options.getPreamble().trim();
      const blocks: ContentBlock[] = [];
      if (preamble) blocks.push({ type: "text", text: preamble });
      // 新会话（重新打开、换了 agent、断线重连）不知道之前聊过什么：带上之前几轮。
      const earlier = !sentPreamble && lastIndex > 0 ? historyText(messages.slice(0, lastIndex) as never) : "";
      if (earlier) blocks.push({ type: "text", text: earlier });
      blocks.push({ type: "text", text: question || "（看图）" });
      blocks.push(...imageBlocks(last as never));
      sentPreamble = true;

      let turn: AskTurn = emptyTurn(now());
      let wake: (() => void) | null = null;
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
      let failure: unknown = null;
      let stopReason = "end_turn";
      current.prompt(blocks).then(
        (result) => {
          stopReason = result.stopReason;
          // 结果里的用量（Claude Code 的 usage、自带 agent 的 _meta.retainpdf.usage）合进这一轮，底下那一行就有分项 token。
          const extra = { ...usageFromMeta(result.meta), ...usageFromMeta(result.usage ? { usage: result.usage } : null) };
          if (Object.keys(extra).length) {
            turn = { ...turn, usage: { ...turn.usage, ...extra } };
            changed = true;
          }
          finished = true;
          wake?.();
        },
        (error) => {
          failure = error;
          finished = true;
          wake?.();
        },
      );
      try {
        while (!finished || changed) {
          if (!changed) await new Promise<void>((resolve) => (wake = resolve));
          wake = null;
          if (changed) {
            changed = false;
            yield { content: toAssistantParts(turn.parts) as never, metadata: { custom: { turn } } };
          }
        }
      } finally {
        abortSignal.removeEventListener("abort", onAbort);
        onUpdate = null;
      }
      const endedAt = now();
      turn = { ...turn, parts: closeOpenReasoning(turn.parts, Date.now()) };
      if (!failure) sessionSeen = lastIndex + 2;
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
          content: toAssistantParts([...turn.parts, { type: "text", text: `\n\n（出错了：${message}）` }]) as never,
          status: { type: "incomplete", reason: "error", error: message },
          metadata: { custom: { turn, endedAt }, timing },
        };
        return;
      }
      yield {
        content: toAssistantParts(turn.parts) as never,
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
    close() {
      options.permissions.cancelAll();
      session?.close();
      session = null;
    },
  };
}
