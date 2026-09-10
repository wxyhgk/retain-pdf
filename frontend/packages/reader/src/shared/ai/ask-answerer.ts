// 共享真值（原 frontend/web/src/js/reader/ai/ask-answerer.ts），已抽离为可注入依赖
// 不直接 import frontend/web 的 api/config，改为参数注入，默认用空实现

import { resolveReaderAiConfig } from "./config.js";
import {
  clearStoredConversationId,
  loadStoredConversationId,
  saveStoredConversationId,
} from "./conversation-store.js";

// 阅读器问答的 agentic 应答器:走 /api/v1/ai/ask(带 SSE 过程事件与可跳转引用)。
// document_id 经后端 GET /documents?job_id= 直查(含历史 run),查不到时 fail closed。
// conversation_id 本地粘性 + 服务端 auto-create / done 回传,实现多轮。

const DEFAULT_API_PREFIX = "/api/v1";

function defaultAsk(): Promise<any> {
  throw new Error("ask not injected (provide ask impl via createReaderAskAnswerer)");
}

function defaultDocumentByJobId(): Promise<any> {
  return Promise.resolve(null);
}

const QUOTE_MAX_LENGTH = 240;

export type ReaderAssistantMode = "auto" | "reading" | "operations";

function clipQuoteText(text = "", maxLength = QUOTE_MAX_LENGTH): string {
  const normalized = `${text}`.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trim()}…`;
}

export function buildScopedQuestion({ question = "", scope = "document", context = null, resolveQuote = null }: { question?: string; scope?: string; context?: any; resolveQuote?: ((ctx: any) => any) | null } = {}): string {
  const trimmed = `${question}`.trim();
  if (!trimmed) {
    return "";
  }
  if (scope === "selection") {
    const quote = typeof resolveQuote === "function" && context ? resolveQuote(context) : null;
    const quoteText = clipQuoteText(quote?.quoteText || context?.quoteText || "");
    if (quoteText) {
      const paneLabel = context?.pane === "translated" ? "译文" : "原文";
      const kindLabel = context?.kind === "formula" ? "公式"
        : context?.kind === "table" ? "表格"
          : context?.kind === "figure" ? "图片"
            : context?.kind === "text" ? "文字" : "片段";
      return `（针对选中的${paneLabel}${kindLabel}：「${quoteText}」）${trimmed}`;
    }
    if (context?.page) {
      return `（针对第 ${Number(context.page)} 页的选区内容）${trimmed}`;
    }
  }
  if (scope === "page" && context?.page) {
    return `（当前第 ${Number(context.page)} 页）${trimmed}`;
  }
  return trimmed;
}

export function createReaderAskAnswerer({
  jobId = "",
  documentId = "",
  apiPrefix = DEFAULT_API_PREFIX,
  ask = defaultAsk,
  documentByJobId = defaultDocumentByJobId,
  resolveQuote = null,
  // 前端凭据设置里的模型 API Key(与翻译流程同源),按请求随问答一起传给后端
  llmConfig = resolveReaderAiConfig,
}: {
  jobId?: string;
  documentId?: string;
  apiPrefix?: string;
  ask?: (opts: any) => Promise<any>;
  documentByJobId?: (apiPrefix: string, jobId: string) => Promise<any>;
  resolveQuote?: ((ctx: any) => any) | null;
  llmConfig?: (() => any) | any;
} = {}): any {
  const stableDocumentId = `${documentId || ""}`.trim();
  let documentIdPromise: Promise<string> | null = null;
  // 内存优先,localStorage 兜底(跨刷新)
  let conversationId = loadStoredConversationId({
    jobId,
    documentId: stableDocumentId,
  });

  function resolveDocumentId(): Promise<string> {
    if (!documentIdPromise) {
      documentIdPromise = (async () => {
        if (stableDocumentId) return stableDocumentId;
        try {
          const document = await documentByJobId(apiPrefix, jobId) as { document_id?: string } | null | undefined;
          return `${(document as any)?.document_id || ""}`.trim();
        } catch (_err) {
          return "";
        }
      })();
    }
    return documentIdPromise;
  }

  function rememberConversationId(nextId: string, documentId = ""): void {
    const id = `${nextId || ""}`.trim();
    if (!id) {
      return;
    }
    conversationId = id;
    saveStoredConversationId({ jobId, documentId }, id);
  }

  async function answer({
    question = "",
    scope = "document",
    context = null,
    onToolEvent = null,
    onProgressEvent = null,
    onAgentOperationEvent = null,
    onAgentConfirmationRequiredEvent = null,
    onAgentSessionEvent = null,
    onAnswerDelta = null,
    onCompress = null,
    parentId = "",
    regenerate = false,
    userMessageId = "",
    assistantMessageId = "",
    assistantMode = "reading",
    /** 取消信号：中止 SSE；aborted 后不回写会话粘性（防旧流污染新会话） */
    signal = null,
  }: {
    question?: string;
    scope?: string;
    context?: any;
    onToolEvent?: ((e: any) => void) | null;
    onProgressEvent?: ((e: { type: "progress"; stage: "routing" | "retrieval"; message: string }) => void) | null;
    onAgentOperationEvent?: ((e: any) => void) | null;
    onAgentConfirmationRequiredEvent?: ((e: any) => void) | null;
    onAgentSessionEvent?: ((e: any) => void) | null;
    onAnswerDelta?: ((a: string, c: string) => void) | null;
    onCompress?: ((e: any) => void) | null;
    parentId?: string;
    regenerate?: boolean;
    userMessageId?: string;
    assistantMessageId?: string;
    assistantMode?: ReaderAssistantMode;
    signal?: AbortSignal | null;
  } = {}): Promise<any> {
    const scopedQuestion = buildScopedQuestion({ context, question, resolveQuote, scope });
    if (!scopedQuestion) {
      throw new Error("请输入问题。");
    }
    // Browser overrides are optional. The AI service owns its configured
    // runtime credential and is authoritative when this value is empty.
    const config = typeof llmConfig === "function" ? (llmConfig as () => any)() : (llmConfig || {});
    const apiKey = `${config.apiKey || ""}`.trim();
    const documentId = await resolveDocumentId();
    // 阅读器默认整本问答:反查不到文档时 fail closed,禁止静默变全库检索
    if (!documentId && `${jobId || ""}`.trim()) {
      throw new Error("无法关联当前文档，暂不能做整本问答。请确认任务已绑定文档后重试。");
    }
    // document 解析后若 storage 里只有 job key,再补写一份 doc key
    if (!conversationId) {
      conversationId = loadStoredConversationId({ jobId, documentId });
    }
    const result = await ask({
      question: scopedQuestion,
      documentId,
      // document_id is the durable knowledge/operation identity. A job is an
      // immutable pipeline attempt and may be a retry/render child without
      // its own document.v1 or Markdown. Once the document is known, letting
      // the backend resolve its authoritative readable artifacts prevents the
      // Reader from pinning AI to a transient job directory.
      jobId: documentId ? "" : `${jobId || ""}`.trim(),
      conversationId,
      parentId: `${parentId || ""}`.trim(),
      regenerate: Boolean(regenerate),
      userMessageId: `${userMessageId || ""}`.trim(),
      assistantMessageId: `${assistantMessageId || ""}`.trim(),
      assistantMode,
      onToolEvent,
      onProgressEvent,
      onAgentOperationEvent,
      onAgentConfirmationRequiredEvent,
      onAgentSessionEvent,
      onAnswerDelta,
      onCompress,
      llmApiKey: apiKey,
      llmBaseUrl: `${config.baseUrl || ""}`.trim(),
      llmModel: `${config.model || ""}`.trim(),
      signal,
    });
    const nextConversationId = `${(result as { conversationId?: string })?.conversationId || ""}`.trim();
    // aborted 的旧流禁止回写粘性：否则"生成中切会话"会被 done 事件把
    // conversation_id 拽回旧会话，下一问落错线程（审计 P0-4）
    if (nextConversationId && !(signal as AbortSignal | null)?.aborted) {
      rememberConversationId(nextConversationId, documentId);
    }
    return {
      ...result,
      conversationId: nextConversationId || conversationId,
      scope,
    };
  }

  return {
    answer,
    getConversationId: () => conversationId,
    setConversationId: (nextId: string, documentId = "") => {
      rememberConversationId(nextId, documentId);
    },
    clearConversationId: (documentId = "") => {
      conversationId = "";
      clearStoredConversationId({ jobId, documentId });
      if (documentId) {
        clearStoredConversationId({ documentId });
      }
      clearStoredConversationId({ jobId });
    },
    getDocumentId: () => resolveDocumentId(),
    ensureLoaded: async () => {
      // 预热 document_id;失败在 answer 时再报错
      const documentId = await resolveDocumentId();
      return Boolean(documentId);
    },
  };
}
