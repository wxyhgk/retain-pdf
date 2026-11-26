// 阅读页的提问窗对着一个全局主对话（2026-11-26，docs/api/16-AI/02-主对话和记忆.md）：
// - 打开：取主对话、读最近一页消息；「看更早的」再往前取一页（窗口按新的 initialMessages 重开）。
// - 每答完一轮：问和答一起追加（带出处、幂等号、这一轮记下的记忆）；后端说该压了就让它压。
// - 下一问带的出处：右键「在这里提问 / 问这段」、书页上选字时更新，发出去以后清掉。
// - 「深挖」开副对话（面包屑「主对话 › 标题」），「结束」让后端写结论卡片回到主对话；卡片上能「看副对话」。
// 宿主没给 conversations 端口（演示模式、局域网共享）：只记在这次打开里。

import { useCallback, useRef, useState } from "react";
import type { AskMemoryNotice, AskMessage, AskTurnRecord } from "@retainpdf/ask";
import type { AskCompactionPointView, AskConversationMessageRecord, AskConversationRecord } from "@retainpdf/api/ai";

import type { ReaderAskAnchor, ReaderAskPort } from "../contracts/ask.js";
import { findForkSource, forkTitle, laterMemories, memoriesSince, recordsToMessages, turnToAppend, type AskBook } from "./conversation-messages.js";

const PAGE = 50;

export type AskConversationView = {
  conversation: AskConversationRecord | null;
  /** 主对话（副对话时是它的主对话，面包屑用）。 */
  main: AskConversationRecord | null;
  records: AskConversationMessageRecord[];
  compactions: Pick<AskCompactionPointView, "covers_to_seq">[];
  hasMore: boolean;
  /** 窗口重开的键（换对话、取了更早的）。 */
  key: string;
  initial: AskMessage[];
};

const EMPTY: AskConversationView = { conversation: null, main: null, records: [], compactions: [], hasMore: false, key: "local", initial: [] };

function newClientId(): string {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `c-${random}`;
}

function errorReason(error: unknown): string {
  const value = error as { reason?: string; details?: { reason?: string }; payload?: { error?: { details?: { reason?: string } } } } | null;
  return `${value?.reason || value?.details?.reason || value?.payload?.error?.details?.reason || (error instanceof Error ? error.message : "")}`;
}

export function useAskConversation({ port, book, onAppended }: { port: ReaderAskPort | null; book: AskBook; onAppended?: (records: AskConversationMessageRecord[]) => void }) {
  const conversations = port?.conversations ?? null;
  const memories = port?.memories ?? null;
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState<AskConversationView>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [closingSide, setClosingSide] = useState<"idle" | "busy" | "failed">("idle");
  const [pending, setPending] = useState<ReaderAskAnchor | null>(null);
  // 一轮答完以后查到的「已记住」（按回答在窗口里的消息编号），和画过的记忆编号。
  const [notices, setNotices] = useState<ReadonlyMap<string, readonly AskMemoryNotice[]>>(() => new Map());
  const seenMemories = useRef(new Set<string>());
  const viewRef = useRef(view);
  viewRef.current = view;
  const bookRef = useRef(book);
  bookRef.current = book;
  const reloads = useRef(0);

  /** 读一个对话最近的一页，换成窗口的消息。 */
  const load = useCallback(async (conversation: AskConversationRecord, main: AskConversationRecord | null, beforeSeq?: number, older: AskConversationMessageRecord[] = []) => {
    if (!conversations) return;
    const page = await conversations.messages(conversation.conversation_id, { limit: PAGE, ...(beforeSeq ? { beforeSeq } : {}) });
    const records = [...page.messages, ...older];
    reloads.current += 1;
    setView({
      conversation,
      main: main ?? conversation,
      records,
      compactions: page.compactions || [],
      hasMore: page.has_more,
      key: `${conversation.conversation_id}:${reloads.current}`,
      initial: recordsToMessages(records, page.compactions || [], bookRef.current.documentId),
    });
  }, [conversations]);

  const openMain = useCallback(async () => {
    setVisible(true);
    if (!conversations || viewRef.current.conversation?.kind === "main") return;
    setLoading(true);
    setError("");
    try {
      const main = await conversations.main();
      await load(main, main);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setLoading(false);
    }
  }, [conversations, load]);

  /** 右键「在这里提问 / 问这段」：打开窗口，下一问带上这一处。 */
  const ask = useCallback((anchor: ReaderAskAnchor) => {
    setPending(anchor);
    void openMain();
  }, [openMain]);

  const loadEarlier = useCallback(async () => {
    const current = viewRef.current;
    const first = current.records[0];
    if (!current.conversation || !first || !current.hasMore) return;
    setLoading(true);
    try {
      await load(current.conversation, current.main, first.seq, current.records);
    } finally {
      setLoading(false);
    }
  }, [load]);

  const appendTurn = useCallback(async (turn: AskTurnRecord) => {
    const current = viewRef.current;
    const conversation = current.conversation;
    if (!conversations || !conversation) return;
    for (const id of turn.memoryIds) seenMemories.current.add(id);
    // agent 没在工具卡片里报记忆：按对话和这一轮开始的时间查新记的（RetainPDF + pi）。
    let memoryIds = turn.memoryIds;
    if (!memoryIds.length && memories && turn.startedAt) {
      const found = laterMemories(
        await memories.list({ source_conversation_id: conversation.conversation_id, created_after: memoriesSince(turn.startedAt) }).catch(() => []),
        seenMemories.current,
      );
      for (const memory of found) seenMemories.current.add(memory.id);
      memoryIds = found.map((memory) => memory.id);
      const answerId = turn.answerId;
      if (found.length && answerId) setNotices((current) => new Map(current).set(answerId, found));
    }
    const input = turnToAppend({ ...turn, memoryIds }, bookRef.current.documentId, newClientId());
    let result;
    try {
      result = await conversations.append(conversation.conversation_id, input);
    } catch (failure) {
      // 结束了的副对话接着问：先再开（幂等号保证重试不重复）。
      if (conversation.kind !== "side" || !/ask_conversation_not_open/.test(errorReason(failure))) throw failure;
      await conversations.reopen(conversation.conversation_id);
      result = await conversations.append(conversation.conversation_id, input);
    }
    setView((state) => (state.conversation?.conversation_id === conversation.conversation_id
      ? { ...state, conversation: result.conversation, records: [...state.records, ...result.messages] }
      : state));
    onAppended?.(result.messages);
    if (result.compaction_due && conversation.kind === "main") void conversations.compact(conversation.conversation_id).catch(() => {});
  }, [conversations, memories, onAppended]);

  const onTurn = useCallback((turn: AskTurnRecord) => {
    void appendTurn(turn).catch((failure) => setError(`这一轮没存上：${failure instanceof Error ? failure.message : String(failure)}`));
  }, [appendTurn]);

  const fork = useCallback(async (message: { id?: string; text: string }) => {
    const current = viewRef.current;
    const main = current.main;
    if (!conversations || !main || current.conversation?.kind !== "main") return;
    setError("");
    try {
      const source = findForkSource(current.records, message);
      const side = await conversations.fork({
        parent_id: main.conversation_id,
        ...(source ? { forked_from_message_id: source } : {}),
        title: forkTitle(message.text),
        ...(bookRef.current.documentId ? { document_id: bookRef.current.documentId } : {}),
      });
      await load(side, main);
    } catch (failure) {
      setError(`开不了副对话：${failure instanceof Error ? failure.message : String(failure)}`);
    }
  }, [conversations, load]);

  const openSide = useCallback(async (sideId: string) => {
    const main = viewRef.current.main;
    if (!conversations) return;
    try {
      await load(await conversations.get(sideId), main);
    } catch (failure) {
      setError(`打不开副对话：${failure instanceof Error ? failure.message : String(failure)}`);
    }
  }, [conversations, load]);

  const backToMain = useCallback(async () => {
    const main = viewRef.current.main;
    if (main) await load(main, main).catch(() => {});
  }, [load]);

  /** 结束副对话：后端用设置里的模型写结论，回到主对话（最多等 180 秒）。 */
  const closeSide = useCallback(async () => {
    const side = viewRef.current.conversation;
    if (!conversations || side?.kind !== "side") return;
    setClosingSide("busy");
    try {
      await conversations.close(side.conversation_id);
      setClosingSide("idle");
      await backToMain();
    } catch {
      setClosingSide("failed");
    }
  }, [conversations, backToMain]);

  /** 归档主对话，开一个新的。 */
  const archiveMain = useCallback(async () => {
    const main = viewRef.current.main;
    if (!conversations || !main) return;
    await conversations.archive(main.conversation_id);
    const next = await conversations.main();
    await load(next, next);
  }, [conversations, load]);

  return {
    visible,
    view,
    loading,
    error,
    pending,
    setPending,
    closingSide,
    notices,
    persistent: Boolean(conversations),
    openMain,
    ask,
    close: useCallback(() => setVisible(false), []),
    loadEarlier,
    onTurn,
    fork,
    openSide,
    backToMain,
    closeSide,
    archiveMain,
    forgetMemory: conversations ? conversations.forgetMemory : undefined,
  };
}
