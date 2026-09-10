// Reading Q&A request projection: frozen submit/retry/cancel over typed ports.
//
// This hook owns the chat stream projection (via the injected chat port) and
// drives new turns through the conversation tree port. It owns no session
// list, no hydration, no persistence, and no PDF operations. Stopping the
// stream aborts only the model request; durable operations keep their own
// lifecycle elsewhere and are deliberately untouched.

import { useCallback, useEffect, useRef } from "react";
import {
  findMessage,
  visibleMessages,
  type ReaderAskStoreMessage,
} from "./reader-ask-tree.js";
import {
  buildReaderRequestSnapshot,
  loadRetryRequestSnapshot,
  saveReaderRequestSnapshot,
} from "./reader-request-snapshots.js";
import {
  chatMessageToStore,
  lastAssistantMessage,
  storeMessagesToChat,
} from "./use-reader-chat.js";
import type { ReaderChatMessage } from "./retainpdf-chat-transport.js";
import type { ReaderConversationTreePort } from "./use-reader-conversation.js";
import type { ReaderChatRequest } from "./retainpdf-chat-transport.js";
import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";
import {
  readerRegionContent,
  type ReaderSelection,
} from "../../../shared/data/reader-regions.js";

/** Narrow chat projection this hook drives. Adapted by the facade from the
 *  chat owner, so no raw React setter crosses this module boundary. */
export type ReaderReadingChatPort = {
  messages: readonly ReaderChatMessage[];
  status: string;
  error: Error | undefined;
  sendUserMessage: (
    message: { id: string; role: "user"; parts: [{ type: "text"; text: string }] },
    request: { body: ReaderChatRequest },
  ) => Promise<void>;
  regenerateFrom: (request: { messageId: string; body: ReaderChatRequest }) => Promise<void>;
  stopStream: () => Promise<void>;
  replaceVisible: (messages: readonly ReaderChatMessage[]) => void;
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useReaderReadingRequest(options: {
  jobId: string;
  assistantMode: ReaderAssistantMode;
  selectionContext?: ReaderSelection | null;
  tree: ReaderConversationTreePort;
  chat: ReaderReadingChatPort;
  getScopeKey: () => string;
}) {
  const { jobId, assistantMode, selectionContext = null, tree, chat, getScopeKey } = options;
  const treeRef = useRef(tree);
  treeRef.current = tree;
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const modeRef = useRef(assistantMode);
  modeRef.current = assistantMode;
  const selectionRef = useRef(selectionContext);
  selectionRef.current = selectionContext;
  const scopeKeyRef = useRef(getScopeKey);
  scopeKeyRef.current = getScopeKey;

  const status = chat.status;
  const isRunning = status === "submitted" || status === "streaming";
  const runningRef = useRef(isRunning);
  runningRef.current = isRunning;

  const streamingAssistantId = isRunning
    ? `${lastAssistantMessage(chat.messages)?.id || ""}`
    : "";

  // Project the AI SDK stream into the persisted tree: mirror only the
  // current linear branch so branching/session features stay intact.
  const chatMessages = chat.messages;
  const chatError = chat.error;
  useEffect(() => {
    if (!chatMessages.length) return;
    const byId = new Map(chatMessages.map((message) => [message.id, message]));
    const patches = new Map<string, ReaderAskStoreMessage>();
    for (const [id, message] of byId) {
      patches.set(id, chatMessageToStore(message as ReaderChatMessage));
    }
    treeRef.current.mergeChatMirror(patches);
  }, [chatMessages]);

  useEffect(() => {
    if (!chatError || status !== "error") return;
    treeRef.current.markRunningAsError(chatError.message);
  }, [chatError, status]);

  const submitQuestion = useCallback(async (questionInput: string) => {
    if (runningRef.current) return;
    const question = `${questionInput || ""}`.trim();
    if (!question) return;

    const liveTree = treeRef.current;
    const liveChat = chatRef.current;
    const mode = modeRef.current;
    const selection = selectionRef.current;
    const scopeKey = scopeKeyRef.current();
    const parentId = liveTree.readHeadId();
    const userId = makeId("u");
    const assistantId = makeId("a");
    const snapshot = buildReaderRequestSnapshot({
      assistantMode: mode,
      selectionContext: selection?.selectionType === "text"
        ? {
          page: selection.page,
          page_idx: Math.max(0, selection.page - 1),
          pane: selection.pane,
          kind: "text",
          block_id: "",
          quoteText: selection.quote,
        }
        : selection
          ? {
            page: selection.page,
            page_idx: Math.max(0, selection.page - 1),
            pane: selection.pane,
            kind: selection.kind,
            block_id: selection.selectionType === "region" ? selection.region.itemId : "",
            quoteText: readerRegionContent(selection.region, selection.pane),
          }
          : null,
    });
    saveReaderRequestSnapshot(scopeKey, assistantId, snapshot);

    liveTree.appendExchange({
      parentId,
      userId,
      assistantId,
      question,
      progress: snapshot.assistantMode === "operations" ? "正在规划 PDF 操作…" : "正在理解文档…",
    });
    await liveChat.sendUserMessage(
      { id: userId, role: "user", parts: [{ type: "text", text: question }] },
      {
        body: {
          assistantMessageId: assistantId,
          assistantMode: snapshot.assistantMode,
          parentId,
          question,
          regenerate: false,
          userMessageId: userId,
          scope: snapshot.scope,
          context: snapshot.context,
        },
      },
    );
  }, []);

  /** Retry the frozen original request, never the currently visible UI mode. */
  const retryAnswer = useCallback(async (assistantMessageId: string) => {
    if (runningRef.current) return;
    const liveTree = treeRef.current;
    const liveChat = chatRef.current;
    const items = liveTree.readItems();
    const assistantItem = items.find(
      (item) => item.message.id === assistantMessageId && item.message.role === "assistant",
    );
    const parentId = assistantItem?.parentId ?? null;
    const parent = parentId ? findMessage(items, parentId) : null;
    let question = "";
    let userId = parentId;
    if (parent?.role === "user") {
      question = parent.content.trim();
    } else {
      const path = visibleMessages(items, parentId ?? liveTree.readHeadId());
      for (let i = path.length - 1; i >= 0; i -= 1) {
        if (path[i].role === "user") {
          question = path[i].content.trim();
          userId = path[i].id;
          break;
        }
      }
    }
    if (!question) return;

    const assistantId = makeId("a");
    const branchParent = userId || parentId;
    const scopeKey = scopeKeyRef.current();
    // New requests persist this snapshot; legacy history falls back to the
    // safest fixed reading/document semantics, never mutable UI state.
    const snapshot = loadRetryRequestSnapshot({
      scopeKey,
      jobId,
      assistantMessageId,
    });
    saveReaderRequestSnapshot(scopeKey, assistantId, snapshot);
    liveTree.appendRetryTurn({ assistantId, branchParent });
    liveChat.replaceVisible(storeMessagesToChat(visibleMessages(items, assistantMessageId)));
    await liveChat.regenerateFrom({
      messageId: assistantMessageId,
      body: {
        assistantMessageId: assistantId,
        assistantMode: snapshot.assistantMode,
        parentId: branchParent,
        question,
        regenerate: true,
        userMessageId: userId || "",
        scope: snapshot.scope,
        context: snapshot.context,
      },
    });
  }, [jobId]);

  // Stop aborts only the model stream. Durable PDF operations dispatched
  // through the operation API keep their own lifecycle and are never
  // cancelled here.
  const cancelAnswer = useCallback(async () => {
    await chatRef.current.stopStream();
    treeRef.current.markRunningCancelled();
  }, []);

  return {
    isRunning,
    streamingAssistantId,
    submitQuestion,
    retryAnswer,
    cancelAnswer,
  };
}

export type ReaderReadingRequest = ReturnType<typeof useReaderReadingRequest>;
