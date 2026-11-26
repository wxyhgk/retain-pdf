// 书页上的「?」：这本书上问过的地方。
// - 主对话里属于这本书、有页码的问（GET /documents/{id}/ask-messages）：点了打开主对话。
// - 以前按书存的问答记录（2026-11-26 起只读）：照旧画，点了只读地看那一次。
// 位置：问的时候认出的那一块的上沿；认不出就画在页顶。

import { useCallback, useEffect, useRef, useState } from "react";
import type { AskConversationMessageRecord } from "@retainpdf/api/ai";

import type { ReaderAskAnchor, ReaderAskPort } from "../contracts/ask.js";
import type { AskMark } from "./ReaderAskMarks.js";

export type AskPointOf = (itemId: string | null, pane: "source" | "translated", page: number) => { x: number; y: number } | null;

/** 主对话里的一问 → 书页上的「?」；没有页码的不画。 */
export function recordMark(record: AskConversationMessageRecord, key: number, pointOf: AskPointOf): AskMark | null {
  const selection = record.selection;
  const page = record.page ?? selection?.page ?? 0;
  if (record.role !== "user" || !page) return null;
  const pane = (record.pane ?? selection?.pane) === "source" ? "source" : "translated";
  const itemId = selection?.item_ids?.[0] ?? null;
  const anchor: ReaderAskAnchor = {
    pane,
    page,
    itemId,
    selection: selection?.selected_text || "",
    sourceText: selection?.source_text || "",
    translatedText: selection?.translated_text || "",
    section: selection?.section || "",
    point: pointOf(itemId, pane, page),
  };
  return { key, anchor, messageId: record.message_id, title: record.text.slice(0, 80) };
}

export function useAskMarks({ port, documentId, resetKey, pointOf }: { port: ReaderAskPort | null; documentId: string; resetKey: string; pointOf: AskPointOf }) {
  const [marks, setMarks] = useState<AskMark[]>([]);
  const keyRef = useRef(0);
  const pointRef = useRef(pointOf);
  pointRef.current = pointOf;
  const nextKey = () => {
    keyRef.current += 1;
    return keyRef.current;
  };

  useEffect(() => {
    setMarks([]);
    if (!port || !documentId) return undefined;
    let cancelled = false;
    const add = (list: AskMark[]) => {
      if (!cancelled && list.length) setMarks((current) => [...current, ...list]);
    };
    // 读不到就不画，照样能问。
    port.threads?.list(documentId).then(
      (threads) => add(threads.map((thread) => ({ key: nextKey(), anchor: thread.anchor, threadId: thread.threadId, title: thread.title }))),
      () => {},
    );
    port.conversations?.bookMessages(documentId).then(
      (records) => add(records.map((record) => recordMark(record, nextKey(), pointRef.current)).filter((mark): mark is AskMark => Boolean(mark))),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [port, documentId, resetKey]);

  /** 刚追加的问：属于这本书、有页码的画上。 */
  const addRecords = useCallback((records: readonly AskConversationMessageRecord[]) => {
    const fresh = records
      .filter((record) => !record.document_id || record.document_id === documentId)
      .map((record) => recordMark(record, nextKey(), pointRef.current))
      .filter((mark): mark is AskMark => Boolean(mark));
    if (fresh.length) setMarks((current) => [...current.filter((mark) => !fresh.some((next) => next.messageId === mark.messageId)), ...fresh]);
  }, [documentId]);

  const removeMark = useCallback((key: number) => setMarks((current) => current.filter((mark) => mark.key !== key)), []);

  return { marks, addRecords, removeMark };
}
