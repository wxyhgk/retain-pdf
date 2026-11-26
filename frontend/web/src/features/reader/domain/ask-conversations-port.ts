// 阅读页提问的主对话、副对话、记忆（契约 ask-conversations.v1）：阅读器的 conversations 端口接到生成的请求函数上。
// 接口见 docs/api/16-AI/02-主对话和记忆.md。压缩主对话、副对话结论由后端用设置里那条模型写（connection 由 ask-port 给）。

import type { ReaderAskConversationsPort } from "@retainpdf/reader/contracts";
import {
  appendAskConversationMessages,
  closeAskConversation,
  createAskCompaction,
  createAskSideConversation,
  deleteAskMemory,
  getAskConversation,
  getAskConversationContext,
  getMainAskConversation,
  listAskConversationMessages,
  listDocumentAskMessages,
  updateAskConversation,
  type AskModelConnectionInput,
} from "@retainpdf/api/ai";

import { API_PREFIX } from "@/platform/config/api-constants.js";

/** connection：设置里那条模型连接（没配是 null）。 */
export function createAskConversationsPort(connection: () => Promise<AskModelConnectionInput | null>): ReaderAskConversationsPort {
  return {
    main: () => getMainAskConversation(API_PREFIX),
    get: (conversationId) => getAskConversation(API_PREFIX, conversationId),
    messages: (conversationId, page = {}) => listAskConversationMessages(API_PREFIX, conversationId, {
      ...(page.beforeSeq ? { before_seq: page.beforeSeq } : {}),
      ...(page.limit ? { limit: page.limit } : {}),
    }),
    append: (conversationId, messages) => appendAskConversationMessages(API_PREFIX, conversationId, { messages: messages as never }),
    contextText: async (conversationId, documentId) => {
      const context = await getAskConversationContext(API_PREFIX, conversationId, documentId ? { document_id: documentId } : {});
      return context.text || "";
    },
    fork: (input) => createAskSideConversation(API_PREFIX, input),
    close: async (conversationId, summary) => {
      if (summary) return closeAskConversation(API_PREFIX, conversationId, { summary });
      // 没写结论：让后端用设置里的模型写；没配模型就只结束。
      const model = await connection();
      return closeAskConversation(API_PREFIX, conversationId, model ? { summarize_with: model } : {});
    },
    reopen: (conversationId) => updateAskConversation(API_PREFIX, conversationId, { status: "open" }),
    archive: (conversationId) => updateAskConversation(API_PREFIX, conversationId, { status: "archived" }),
    compact: async (conversationId) => {
      const model = await connection();
      if (model) await createAskCompaction(API_PREFIX, conversationId, model);
    },
    bookMessages: async (documentId) => (await listDocumentAskMessages(API_PREFIX, documentId)).messages || [],
    forgetMemory: async (memoryId) => {
      await deleteAskMemory(API_PREFIX, memoryId);
    },
  };
}
