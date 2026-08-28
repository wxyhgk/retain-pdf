import { API_PREFIX } from "../../config/api-constants.js";
import { askLibraryAi } from "../../api/ai.js";
import { fetchDocumentByJobId } from "../../api/documents.js";
import {
  hasModelApiKey,
  MISSING_MODEL_API_KEY_MESSAGE,
  resolveReaderAiConfig,
} from "./config.js";
import {
  clearStoredConversationId,
  loadStoredConversationId,
  saveStoredConversationId,
} from "./conversation-store.js";

// Agentic answerer for reader Q&A: uses /api/v1/ai/ask with SSE progress events and jumpable citations.
// document_id is resolved directly through backend GET /documents?job_id=, including historical runs, and fails closed when missing.
// conversation_id is sticky locally and returned by server auto-create/done events to support multi-turn chats.

const QUOTE_MAX_LENGTH = 240;

function clipQuoteText(text = "", maxLength = QUOTE_MAX_LENGTH) {
  const normalized = `${text}`.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trim()}…`;
}

export function buildScopedQuestion({ question = "", scope = "document", context = null, resolveQuote = null } = {}) {
  const trimmed = `${question}`.trim();
  if (!trimmed) {
    return "";
  }
  if (scope === "selection") {
    const quote = typeof resolveQuote === "function" && context ? resolveQuote(context) : null;
    const quoteText = clipQuoteText(quote?.quoteText || "");
    if (quoteText) {
      return `(Dựa trên đoạn văn bản gốc đã chọn: "${quoteText}") ${trimmed}`;
    }
    if (context?.page) {
      return `(Dựa trên vùng chọn ở trang ${Number(context.page)}) ${trimmed}`;
    }
  }
  if (scope === "page" && context?.page) {
    return `(Trang hiện tại: ${Number(context.page)}) ${trimmed}`;
  }
  return trimmed;
}

export function createReaderAskAnswerer({
  jobId = "",
  apiPrefix = API_PREFIX,
  ask = askLibraryAi,
  documentByJobId = fetchDocumentByJobId,
  resolveQuote = null,
  // Model API Key from frontend credential settings, shared with translation flow, sent to backend with each Q&A request.
  llmConfig = resolveReaderAiConfig,
} = {}) {
  let documentIdPromise = null;
  // Prefer memory, with localStorage fallback across refreshes.
  let conversationId = loadStoredConversationId({ jobId });

  function resolveDocumentId() {
    if (!documentIdPromise) {
      documentIdPromise = (async () => {
        try {
          const document = await documentByJobId(apiPrefix, jobId) as { document_id?: string } | null | undefined;
          return `${document?.document_id || ""}`.trim();
        } catch (_err) {
          return "";
        }
      })();
    }
    return documentIdPromise;
  }

  function rememberConversationId(nextId: string, documentId = "") {
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
    onAnswerDelta = null,
    parentId = "",
    regenerate = false,
    userMessageId = "",
    assistantMessageId = "",
    /** Cancel signal: abort SSE; after aborted, do not write sticky conversation state back, preventing old streams from polluting new chats. */
    signal = null,
  } = {}) {
    const scopedQuestion = buildScopedQuestion({ context, question, resolveQuote, scope });
    if (!scopedQuestion) {
      throw new Error("Vui lòng nhập câu hỏi.");
    }
    // Credential gate must run before any network request, otherwise users see "retrieving" before the missing-key error.
    const config = typeof llmConfig === "function" ? llmConfig() : (llmConfig || {});
    const apiKey = `${config.apiKey || ""}`.trim();
    if (!apiKey) {
      throw new Error(MISSING_MODEL_API_KEY_MESSAGE);
    }
    const documentId = await resolveDocumentId();
    // Reader defaults to whole-document Q&A: fail closed when the document cannot be resolved, never silently search the whole library.
    if (!documentId && `${jobId || ""}`.trim()) {
      throw new Error("Không liên kết được tài liệu hiện tại nên chưa thể hỏi đáp toàn bộ tài liệu. Vui lòng xác nhận tác vụ đã gắn tài liệu rồi thử lại.");
    }
    // After document resolution, if storage only has the job key, add a document-keyed entry too.
    if (!conversationId) {
      conversationId = loadStoredConversationId({ jobId, documentId });
    }
    const result = await ask({
      question: scopedQuestion,
      documentId,
      jobId: `${jobId || ""}`.trim(),
      conversationId,
      parentId: `${parentId || ""}`.trim(),
      regenerate: Boolean(regenerate),
      userMessageId: `${userMessageId || ""}`.trim(),
      assistantMessageId: `${assistantMessageId || ""}`.trim(),
      onToolEvent,
      onAnswerDelta,
      llmApiKey: apiKey,
      llmBaseUrl: `${config.baseUrl || ""}`.trim(),
      llmModel: `${config.model || ""}`.trim(),
      signal,
    });
    const nextConversationId = `${(result as { conversationId?: string })?.conversationId || ""}`.trim();
    // Aborted old streams must not write sticky state back. Otherwise switching
    // chats during generation lets a done event drag conversation_id back to the
    // old chat and route the next question to the wrong thread (audit P0-4).
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
      // Warm document_id; report failures later in answer.
      const documentId = await resolveDocumentId();
      return Boolean(documentId);
    },
  };
}
