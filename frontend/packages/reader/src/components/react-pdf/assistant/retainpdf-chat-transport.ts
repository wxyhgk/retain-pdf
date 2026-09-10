import type {
  ChatTransport,
  UIMessage,
  UIMessageChunk,
} from "ai";
import type { AiCitationLike } from "../../../shared/ai/answer-enhance.js";
import { normalizeAiCitations } from "../../../shared/ai/answer-enhance.js";
import { sanitizeAssistantAnswer } from "../../../shared/ai/sanitize-answer.js";
import { describeToolEvent } from "../../../shared/ai/tool-labels.js";
import type { AgentConfirmationMode } from "@retainpdf/api/agent-runtime-settings";
import type { ReaderAgentOperationSignal } from "./use-reader-agent-operations.js";
import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";

export type ReaderChatMetadata = {
  citations?: AiCitationLike[];
  progress?: string;
  persisted?: boolean;
  status?: "running" | "complete" | "cancelled" | "error";
};

export type ReaderChatMessage = UIMessage<ReaderChatMetadata>;

type ReaderAnswerer = {
  ensureLoaded?: (jobId?: string) => Promise<unknown>;
  answer: (options: Record<string, unknown>) => Promise<{
    answer?: string;
    citations?: unknown[];
    persisted?: boolean;
    conversationId?: string;
    confirmationMode?: AgentConfirmationMode | "";
    operationRefs?: Array<string | { operation_id?: string }>;
    confirmationRequests?: Array<{ operation_id?: string }>;
  }>;
};

export type ReaderChatRequest = {
  assistantMode?: ReaderAssistantMode;
  assistantMessageId?: string;
  parentId?: string;
  question?: string;
  regenerate?: boolean;
  userMessageId?: string;
  scope?: "document" | "selection" | "page";
  context?: Record<string, unknown> | null;
};

function textFromMessage(message: ReaderChatMessage | undefined): string {
  return (message?.parts || [])
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => (
      part.type === "text"
    ))
    .map((part) => part.text)
    .join("")
    .trim();
}

function questionForRequest(
  messages: ReaderChatMessage[],
  request: ReaderChatRequest,
): string {
  const explicit = `${request.question || ""}`.trim();
  if (explicit) return explicit;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;
    const text = textFromMessage(message);
    if (text) return text;
  }
  return "";
}

function shouldFallbackToLocal(error: unknown): boolean {
  const status = Number((error as { status?: number })?.status) || 0;
  const message = `${(error as Error)?.message || ""}`;
  return status === 502 || /\b502\b/.test(message);
}

/**
 * Translate RetainPDF's small SSE contract into AI SDK UI message chunks.
 *
 * The backend remains framework-agnostic. It only needs to emit answer deltas,
 * optional tool progress, and a final answer/citation payload.
 */
export class RetainPdfChatTransport implements ChatTransport<ReaderChatMessage> {
  constructor(private readonly options: {
    jobId: string;
    getRemoteAnswerer: () => ReaderAnswerer | null;
    getLocalAnswerer?: () => ReaderAnswerer | null;
    getAssistantMode?: () => ReaderAssistantMode;
    onAgentOperationSignal?: (signal: Omit<ReaderAgentOperationSignal, "nonce">) => void;
    onConfirmationMode?: (mode: AgentConfirmationMode) => void;
  }) {}

  async sendMessages({
    abortSignal,
    body,
    messages,
    trigger,
  }: Parameters<ChatTransport<ReaderChatMessage>["sendMessages"]>[0]): Promise<ReadableStream<UIMessageChunk>> {
    const request = (body || {}) as ReaderChatRequest;
    const question = questionForRequest(messages, request);
    if (!question) throw new Error("请输入问题。");

    // Freeze routing semantics synchronously, before ensureLoaded or any other
    // await. A user can change the visible mode/selection while loading; that
    // must not turn an already-submitted reading request into a PDF operation
    // (or vice versa).
    const assistantMode = request.assistantMode
      || this.options.getAssistantMode?.()
      || "reading";
    const requestScope = request.scope || "document";
    const requestContext = request.context ? { ...request.context } : null;

    const assistantMessageId = `${request.assistantMessageId || ""}`.trim()
      || `a-${Date.now().toString(36)}`;
    const textPartId = `${assistantMessageId}-text`;
    const remoteAnswerer = this.options.getRemoteAnswerer();
    const localAnswerer = this.options.getLocalAnswerer?.() || null;

    if (!remoteAnswerer && !localAnswerer) {
      throw new Error("问答暂不可用：请确认已打开任务阅读器。");
    }

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        let closed = false;
        let streamedAnswer = "";
        let metadata: ReaderChatMetadata = {
          citations: [],
          progress: trigger === "regenerate-message" ? "正在重新生成…" : "正在检索文档…",
          status: "running",
        };

        const enqueue = (chunk: UIMessageChunk) => {
          if (!closed) controller.enqueue(chunk);
        };
        const updateMetadata = (patch: Partial<ReaderChatMetadata>) => {
          metadata = { ...metadata, ...patch };
          enqueue({ type: "message-metadata", messageMetadata: metadata });
        };

        enqueue({ type: "start", messageId: assistantMessageId, messageMetadata: metadata });
        enqueue({ type: "start-step" });
        enqueue({ type: "text-start", id: textPartId });

        void (async () => {
          try {
            await remoteAnswerer?.ensureLoaded?.(this.options.jobId);
            if (abortSignal?.aborted) throw new Error("aborted");
            let answerer = remoteAnswerer || localAnswerer!;
            let usedFallback = false;
            let result: Awaited<ReturnType<ReaderAnswerer["answer"]>>;
            try {
              result = await answerer.answer({
                question,
                assistantMode,
                scope: requestScope,
                context: requestContext,
                parentId: `${request.parentId || ""}`.trim(),
                regenerate: request.regenerate ?? trigger === "regenerate-message",
                userMessageId: `${request.userMessageId || ""}`.trim(),
                assistantMessageId,
                onAgentSessionEvent: (event: unknown) => {
                  const mode = (event as any)?.capabilities?.document_operation_confirmation_mode;
                  if (mode === "explicit" || mode === "green_light") {
                    this.options.onConfirmationMode?.(mode);
                  }
                },
                onAgentOperationEvent: (event: unknown) => {
                  const operationId = `${(event as any)?.operation_id || ""}`.trim();
                  if (!operationId) return;
                  this.options.onAgentOperationSignal?.({
                    operationId,
                    conversationId: `${(event as any)?.conversation_id || ""}`.trim() || undefined,
                  });
                },
                onAgentConfirmationRequiredEvent: (event: unknown) => {
                  const operationId = `${(event as any)?.operation_id || ""}`.trim();
                  if (operationId) this.options.onAgentOperationSignal?.({ operationId });
                },
                onToolEvent: (event: unknown) => {
                  if (streamedAnswer || abortSignal?.aborted) return;
                  const progress = describeToolEvent(event as any);
                  if (progress) updateMetadata({ progress });
                },
                onProgressEvent: (event: unknown) => {
                  if (streamedAnswer || abortSignal?.aborted) return;
                  const message = `${(event as { message?: string })?.message || ""}`.trim();
                  if (message) updateMetadata({ progress: message });
                },
                onAnswerDelta: (_fullText: string, chunk: string) => {
                  if (!chunk || abortSignal?.aborted) return;
                  streamedAnswer += chunk;
                  if (metadata.progress) updateMetadata({ progress: "" });
                  enqueue({ type: "text-delta", id: textPartId, delta: chunk });
                },
                onCompress: (event: unknown) => {
                  if (streamedAnswer || abortSignal?.aborted) return;
                  const dropped = Number((event as { dropped_turns?: number })?.dropped_turns) || 0;
                  if (dropped) updateMetadata({ progress: `已压缩 ${dropped} 轮早期对话` });
                },
                signal: abortSignal,
              });
            } catch (error) {
              if (abortSignal?.aborted) throw error;
              if (
                assistantMode === "operations"
                || !remoteAnswerer
                || !localAnswerer
                || !shouldFallbackToLocal(error)
              ) throw error;
              usedFallback = true;
              updateMetadata({ progress: "在线服务暂不可用，改用本地检索…" });
              await localAnswerer.ensureLoaded?.(this.options.jobId);
              if (abortSignal?.aborted) throw new Error("aborted");
              answerer = localAnswerer;
              result = await answerer.answer({
                question,
                assistantMode,
                scope: requestScope,
                context: requestContext,
                signal: abortSignal,
              });
            }

            if (abortSignal?.aborted) {
              updateMetadata({ progress: "", status: "cancelled" });
              enqueue({ type: "abort", reason: "cancelled" });
              return;
            }

            const mode = result?.confirmationMode;
            if (mode === "explicit" || mode === "green_light") {
              this.options.onConfirmationMode?.(mode);
            }
            const conversationId = `${result?.conversationId || ""}`.trim() || undefined;
            const operationIds = new Set<string>();
            for (const ref of result?.operationRefs || []) {
              const id = typeof ref === "string" ? ref : `${ref?.operation_id || ""}`;
              if (id.trim()) operationIds.add(id.trim());
            }
            for (const request of result?.confirmationRequests || []) {
              const id = `${request?.operation_id || ""}`.trim();
              if (id) operationIds.add(id);
            }
            for (const operationId of operationIds) {
              this.options.onAgentOperationSignal?.({
                operationId,
                conversationId,
                confirmationMode: mode || undefined,
              });
            }

            const citations = normalizeAiCitations(result?.citations);
            let finalAnswer = sanitizeAssistantAnswer(
              `${result?.answer || streamedAnswer || ""}`.trim() || "没有找到可用回答。",
              citations,
            );
            if (usedFallback) {
              finalAnswer += "\n\n_在线服务暂不可用，以上来自本地文档检索。_";
            }
            if (result?.persisted === false) {
              finalAnswer += "\n\n_⚠️ 本轮回答未能写入历史记录（存储暂时不可用），刷新后可能丢失。_";
            }

            // AI SDK 6 is the newest line compatible with the repository's
            // Node 20 desktop release. It has no reset-step chunk, so a fully
            // streamed answer cannot be replaced at the end. Append a safe
            // suffix when possible; non-streaming responses still use the
            // completely sanitized final text.
            if (!streamedAnswer) {
              enqueue({ type: "text-delta", id: textPartId, delta: finalAnswer });
            } else if (finalAnswer.startsWith(streamedAnswer)) {
              const suffix = finalAnswer.slice(streamedAnswer.length);
              if (suffix) enqueue({ type: "text-delta", id: textPartId, delta: suffix });
            }
            enqueue({ type: "text-end", id: textPartId });
            updateMetadata({
              citations,
              persisted: result?.persisted !== false,
              progress: "",
              status: "complete",
            });
            enqueue({ type: "finish-step" });
            enqueue({ type: "finish", finishReason: "stop", messageMetadata: metadata });
          } catch (error) {
            if (abortSignal?.aborted) {
              updateMetadata({ progress: "", status: "cancelled" });
              enqueue({ type: "abort", reason: "cancelled" });
            } else {
              updateMetadata({ progress: "", status: "error" });
              enqueue({
                type: "error",
                errorText: error instanceof Error ? error.message : "生成回答失败，请重试。",
              });
            }
          } finally {
            if (!closed) {
              closed = true;
              controller.close();
            }
          }
        })();
      },
    });
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}

export function readerChatMessageText(message: ReaderChatMessage): string {
  return textFromMessage(message);
}
