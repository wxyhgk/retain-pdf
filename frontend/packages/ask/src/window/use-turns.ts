// 每答完一轮（running → 停）交给宿主：onTurn 给这一轮（问题 + 回答 + 出处 + 记下的记忆），宿主追加到对话里；
// onTurnDone 照旧给整段（按书存问答记录的老用法）。
import { useEffect, useRef } from "react";

import type { AskContext, AskMessage, AskTurnRecord } from "../contract.js";
import { toStoredMessages } from "../acp/messages.js";

type ThreadLike = {
  subscribe: (listener: () => void) => () => void;
  getState: () => { isRunning: boolean; messages: readonly unknown[] };
};

type RunInfo = { context: AskContext | null; sessionId?: string; memoryIds: string[]; startedAt?: number; questionId?: string; editedFrom?: string };

type MessageLike = { id?: string; role: string; status?: { type?: string; reason?: string } };

/** 最后一问和它的回答；回答出错（连不上、断线）不算一轮。 */
export function lastTurn(messages: readonly unknown[]): { question: unknown; answer: unknown } | null {
  const list = messages as readonly MessageLike[];
  const answer = list[list.length - 1];
  const question = list[list.length - 2];
  if (!answer || !question || answer.role !== "assistant" || question.role !== "user") return null;
  if (answer.status?.type === "incomplete" && answer.status.reason === "error") return null;
  return { question, answer };
}

export function useTurns({
  thread,
  agentId,
  run,
  sessionId,
  onTurn,
  onTurnDone,
}: {
  thread: ThreadLike;
  agentId: () => string;
  run: () => RunInfo;
  sessionId: () => string | undefined;
  onTurn?: (turn: AskTurnRecord) => void;
  onTurnDone?: (messages: AskMessage[], agentId: string, sessionId?: string) => void;
}): void {
  const handlers = useRef({ onTurn, onTurnDone });
  handlers.current = { onTurn, onTurnDone };
  useEffect(() => {
    let wasRunning = false;
    return thread.subscribe(() => {
      const state = thread.getState();
      if (wasRunning && !state.isRunning) {
        const stored = toStoredMessages(state.messages as never);
        if (stored.length) handlers.current.onTurnDone?.(stored, agentId(), sessionId());
        const turn = lastTurn(state.messages);
        const [question] = turn ? toStoredMessages([turn.question] as never) : [];
        const [answer] = turn ? toStoredMessages([turn.answer] as never) : [];
        if (question && answer) {
          const info = run();
          const answerId = (turn.answer as MessageLike).id;
          handlers.current.onTurn?.({
            question, answer, context: info.context, agentId: agentId(), sessionId: info.sessionId, memoryIds: info.memoryIds,
            ...(info.startedAt ? { startedAt: info.startedAt } : {}),
            ...(answerId ? { answerId } : {}),
            ...(info.questionId ? { questionId: info.questionId } : {}),
            ...(info.editedFrom ? { editedFrom: info.editedFrom } : {}),
          });
        }
      }
      wasRunning = state.isRunning;
    });
  }, [thread, agentId, run, sessionId]);
}
