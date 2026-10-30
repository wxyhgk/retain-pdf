// 读一个翻译 agent 任务的编辑部事件，叠成画面状态（domain/live-feed.ts）。
// - poll（任务在跑）：每 3 秒接着上次的位置取新的；收到 run_done 就不再取；
// - 否则只读一次：跑完 / 停下后照样画出最后的样子。
// 读失败保留上一次的结果，不打断界面。同一个任务里 poll 开关变了（任务跑完）接着取，不从头再拉。
import { useEffect, useRef, useState } from "react";

import { fetchEditorialEvents } from "@retainpdf/api/jobs-events";
import { API_PREFIX } from "@/platform/config/api-constants.js";

import {
  emptyEditorialLive,
  mergeEditorialPull,
  pullEditorialEvents,
  type EditorialEventPage,
  type EditorialLive,
} from "../domain/live-feed.js";

export const EDITORIAL_LIVE_POLL_MS = 3_000;

type FetchPage = (jobId: string, after: number) => Promise<EditorialEventPage>;

const defaultFetchPage: FetchPage = (jobId, after) => fetchEditorialEvents(jobId, API_PREFIX, after ? { after } : {});

export function useEditorialLive(
  jobId: string,
  {
    enabled = true,
    poll = false,
    fetchPage = defaultFetchPage,
    intervalMs = EDITORIAL_LIVE_POLL_MS,
  }: { enabled?: boolean; poll?: boolean; fetchPage?: FetchPage; intervalMs?: number } = {},
): EditorialLive | null {
  const latest = useRef<{ jobId: string; live: EditorialLive } | null>(null);
  const [shown, setShown] = useState<{ jobId: string; live: EditorialLive } | null>(null);

  useEffect(() => {
    if (!enabled || !jobId) return undefined;
    if (latest.current?.jobId !== jobId) latest.current = { jobId, live: emptyEditorialLive() };
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      const before = latest.current?.jobId === jobId ? latest.current.live : emptyEditorialLive();
      try {
        const pull = await pullEditorialEvents((after) => fetchPage(jobId, after), before.after);
        if (disposed) return;
        const next = mergeEditorialPull(before, pull);
        latest.current = { jobId, live: next };
        if (pull.reset || next.events.length !== before.events.length) setShown({ jobId, live: next });
        else setShown((current) => (current?.jobId === jobId ? current : { jobId, live: next }));
      } catch {
        // 保留上一次的画面；轮询时下一轮再试。
      }
      const finished = latest.current?.live.state.status === "done";
      if (!disposed && poll && !finished) timer = setTimeout(tick, intervalMs);
    };
    void tick();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, enabled, poll, fetchPage, intervalMs]);

  return enabled && shown?.jobId === jobId ? shown.live : null;
}
