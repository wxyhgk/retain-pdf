// 读这个任务的分段计时（GET /jobs/:id 的 runtime.stage_history），给「进度」页流水线写每站的运行时间。
// - 任务在跑：每 5 秒重读一次，中间每秒走一下时钟，正在跑的那站时间往上跳；
// - 不在跑：读一次就够了。
// 读失败保留上一次的结果，不打断界面。
import { useEffect, useState } from "react";

import { fetchJobPayload } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { timelineFromJobPayload, type JobTimeline } from "../domain/assembly-line-model.js";

export const JOB_TIMELINE_POLL_MS = 5_000;
const CLOCK_TICK_MS = 1_000;

type FetchPayload = (jobId: string) => Promise<unknown>;

const defaultFetchPayload: FetchPayload = (jobId) => fetchJobPayload(jobId, { apiPrefix: API_PREFIX });

export function useJobTimeline(
  jobId: string,
  {
    enabled = true,
    poll = false,
    fetchPayload = defaultFetchPayload,
    intervalMs = JOB_TIMELINE_POLL_MS,
  }: { enabled?: boolean; poll?: boolean; fetchPayload?: FetchPayload; intervalMs?: number } = {},
): { timeline: JobTimeline | null; now: number } {
  const [loaded, setLoaded] = useState<{ jobId: string; timeline: JobTimeline } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || !jobId) return undefined;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const payload = await fetchPayload(jobId);
        const timeline = timelineFromJobPayload(payload, Date.now());
        if (!disposed && timeline) setLoaded({ jobId, timeline });
      } catch {
        // 保留上一次的计时；轮询时下一轮再试。
      }
      if (!disposed && poll) timer = setTimeout(tick, intervalMs);
    };
    void tick();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, enabled, poll, fetchPayload, intervalMs]);

  useEffect(() => {
    if (!enabled || !poll) return undefined;
    const clock = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(clock);
  }, [enabled, poll]);

  return { timeline: enabled && loaded?.jobId === jobId ? loaded.timeline : null, now };
}
