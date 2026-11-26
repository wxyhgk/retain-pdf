// 问答记录：这本书问过的地方（书页白边的「?」）、开哪一次、每答完一轮存、删。
// 宿主给了 port.threads、又知道书的 documentId 才存后端；不然只记在这次打开里（关了书就没了）。

import { useCallback, useEffect, useRef, useState } from "react";

import type { ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
import type { AskMark } from "./ReaderAskMarks.js";

export type OpenAsk = { key: number; anchor: ReaderAskAnchor; initial: ReaderAskMessage[] };

export function useAskThreads({ port, documentId, resetKey }: { port: ReaderAskPort | null; documentId: string; resetKey: string }) {
  const threads = port?.threads ?? null;
  const [marks, setMarks] = useState<AskMark[]>([]);
  const [open, setOpen] = useState<OpenAsk | null>(null);
  const keyRef = useRef(0);
  const marksRef = useRef(marks);
  marksRef.current = marks;
  // 这次打开里每一处最新的问答（重新打开不用再读后端；还没存上的也在这里）。
  const cache = useRef(new Map<number, ReaderAskMessage[]>());
  // 正在新建（POST 还没回来）的：这时又答完一轮，等新建回来再补一次 PATCH。
  const creating = useRef(new Set<number>());
  const nextKey = () => {
    keyRef.current += 1;
    return keyRef.current;
  };

  useEffect(() => {
    setOpen(null);
    setMarks([]);
    cache.current.clear();
    if (!threads || !documentId) return undefined;
    let cancelled = false;
    threads.list(documentId).then(
      (list) => {
        if (cancelled) return;
        setMarks(list.map((thread) => ({ key: nextKey(), anchor: thread.anchor, threadId: thread.threadId, title: thread.title })));
      },
      () => {
        // 读不到问答记录：照样能问，只是看不到以前的「?」。
      },
    );
    return () => {
      cancelled = true;
    };
  }, [threads, documentId, resetKey]);

  const ask = useCallback((anchor: ReaderAskAnchor) => {
    const key = nextKey();
    setMarks((current) => [...current, { key, anchor }]);
    setOpen({ key, anchor, initial: [] });
  }, []);

  const reopen = useCallback(async (mark: AskMark) => {
    const cached = cache.current.get(mark.key);
    if (cached || !mark.threadId || !threads || !documentId) {
      setOpen({ key: mark.key, anchor: mark.anchor, initial: cached || [] });
      return;
    }
    try {
      const thread = await threads.get(documentId, mark.threadId);
      const messages = thread.messages || [];
      cache.current.set(mark.key, messages);
      setOpen({ key: mark.key, anchor: thread.anchor || mark.anchor, initial: messages });
    } catch {
      setOpen({ key: mark.key, anchor: mark.anchor, initial: [] });
    }
  }, [threads, documentId]);

  // sessionId：答这一轮的 ACP 会话。后端删问答、删书时按它清 agent 自己存的会话文件（retainpdf-pi），换了会话就带新的。
  const save = useCallback((key: number, messages: ReaderAskMessage[], agentId: string, sessionId?: string) => {
    const session = sessionId ? { sessionId } : {};
    cache.current.set(key, messages);
    if (!threads || !documentId) return;
    const mark = marksRef.current.find((entry) => entry.key === key);
    if (!mark) return;
    if (mark.threadId) {
      threads.update(documentId, mark.threadId, { agentId, ...session, messages }).catch(() => {});
      return;
    }
    if (creating.current.has(key)) return;
    creating.current.add(key);
    threads.create(documentId, { agentId, ...session, anchor: mark.anchor, messages }).then(
      (thread) => {
        setMarks((current) => current.map((entry) => (entry.key === key ? { ...entry, threadId: thread.threadId, title: thread.title } : entry)));
        // 新建期间又答完了一轮：补存最新的。
        const latest = cache.current.get(key);
        if (latest && latest.length > messages.length) threads.update(documentId, thread.threadId, { agentId, ...session, messages: latest }).catch(() => {});
      },
      () => {
        // 存不上（比如一本书满 500 次）：这次打开里照样在，关了书就没了。
      },
    ).finally(() => creating.current.delete(key));
  }, [threads, documentId]);

  const remove = useCallback((key: number) => {
    const mark = marksRef.current.find((entry) => entry.key === key);
    setMarks((current) => current.filter((entry) => entry.key !== key));
    setOpen((current) => (current?.key === key ? null : current));
    cache.current.delete(key);
    if (mark?.threadId && threads && documentId) threads.remove(documentId, mark.threadId).catch(() => {});
  }, [threads, documentId]);

  // 关窗：一句没问就关了的那一处，书页上不留「?」。
  const close = useCallback(() => {
    setOpen((current) => {
      if (current && !cache.current.get(current.key)?.length) {
        const mark = marksRef.current.find((entry) => entry.key === current.key);
        if (mark && !mark.threadId) setMarks((list) => list.filter((entry) => entry.key !== current.key));
      }
      return null;
    });
  }, []);

  return { marks, open, ask, reopen, save, remove, close, persistent: Boolean(threads && documentId) };
}
