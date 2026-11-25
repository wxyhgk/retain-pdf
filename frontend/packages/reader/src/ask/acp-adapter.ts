// 问答窗（assistant-ui 的 LocalRuntime）和 ACP 会话之间的那一层：
// - 用户发一句 → session/prompt；第一句前面带上出处（第几页、哪一节、那一块的原文译文、选中的字）。
// - agent 的 session/update 一条条合进这一轮的回答（acp-parts.ts），边收边交给界面。
// - agent 要许可 → 记在 permissions 里，窗口画「允许 / 拒绝」，用户点了才回给 agent。
// 会话在第一次发问时才开；换 agent 关掉旧的重开。

import type { ContentBlock, RequestPermissionRequest, RequestPermissionResponse, SessionUpdate } from "@agentclientprotocol/sdk";

import type { ReaderAskAnchor, ReaderAskPort, ReaderAskSession } from "../contracts/ask.js";
import { applySessionUpdate, emptyTurn, turnSpeed, usageFromMeta, type AskPart, type AskTurn } from "./acp-parts.js";
import { historyText } from "./thread-messages.js";

const QUOTE_LIMIT = 4000;

function clip(text: string, limit = QUOTE_LIMIT): string {
  const value = `${text || ""}`.trim();
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

/** 第一句前面的出处：一段文字，agent 不管有没有接书的工具都看得懂；带上任务号和块号，接了 retainpdf mcp 的 agent 能自己去读。 */
export function anchorPromptBlocks(anchor: ReaderAskAnchor, jobId: string, bookTitle = ""): ContentBlock[] {
  const lines: string[] = [];
  const where = [`第 ${anchor.page} 页`, anchor.section ? `「${anchor.section}」` : ""].filter(Boolean).join("，");
  lines.push(`我在读${bookTitle ? `《${bookTitle}》` : "一本书"}，${where}（${anchor.pane === "source" ? "原文" : "译文"}栏）。`);
  if (anchor.selection) lines.push("", "我选中的这段：", clip(anchor.selection));
  if (anchor.sourceText) lines.push("", "这一块的原文：", clip(anchor.sourceText));
  if (anchor.translatedText) lines.push("", "这一块的译文：", clip(anchor.translatedText));
  if (!anchor.selection && !anchor.sourceText && !anchor.translatedText) lines.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。");
  lines.push("", `（RetainPDF 任务 ${jobId}${anchor.itemId ? `，块 ${anchor.itemId}` : ""}，第 ${anchor.page} 页）`);
  return [{ type: "text", text: lines.join("\n") }];
}

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
  port: ReaderAskPort;
  jobId: string;
  getAgentId: () => string;
  getAnchor: () => ReaderAskAnchor | null;
  bookTitle?: string;
  permissions: PermissionStore;
  now?: () => number;
};

type RunOptions = {
  messages: readonly { role: string; content: readonly { type: string; text?: string }[] }[];
  abortSignal: AbortSignal;
};

/** assistant-ui 的 ChatModelAdapter：run 是 async generator，边收边吐当前这一轮的样子。 */
export function createAcpChatAdapter(options: AcpChatOptions) {
  const now = options.now ?? (() => performance.now());
  let session: ReaderAskSession | null = null;
  let sessionAgent = "";
  let onUpdate: ((update: SessionUpdate) => void) | null = null;
  let sentAnchor = false;

  const ensureSession = async () => {
    const agentId = options.getAgentId();
    if (session && sessionAgent === agentId) return session;
    session?.close();
    session = await options.port.openSession(
      { agentId, jobId: options.jobId },
      {
        onUpdate: (update) => onUpdate?.(update),
        onPermission: (request) => options.permissions.add(request),
      },
    );
    sessionAgent = agentId;
    // 换了 agent：新会话不知道前面问过什么，出处再带一次。
    sentAnchor = false;
    return session;
  };

  const adapter = {
    async *run({ messages, abortSignal }: RunOptions) {
      const lastIndex = messages.map((message) => message.role).lastIndexOf("user");
      const last = lastIndex >= 0 ? messages[lastIndex] : undefined;
      const question = (last?.content || []).map((part) => (part.type === "text" ? part.text || "" : "")).join("\n").trim();
      let current: ReaderAskSession;
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
      const anchor = options.getAnchor();
      const blocks: ContentBlock[] = [];
      if (!sentAnchor && anchor) blocks.push(...anchorPromptBlocks(anchor, options.jobId, options.bookTitle));
      // 新会话（重新打开、换了 agent、断线重连）不知道之前聊过什么：带上之前几轮。
      const earlier = !sentAnchor && lastIndex > 0 ? historyText(messages.slice(0, lastIndex) as never) : "";
      if (earlier) blocks.push({ type: "text", text: earlier });
      blocks.push({ type: "text", text: question });
      sentAnchor = true;

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
