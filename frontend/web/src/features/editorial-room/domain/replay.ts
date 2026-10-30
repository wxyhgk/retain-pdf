/** 回放的节奏：两条事件之间等多久。按事件的 ts 差算，压到看得清的范围，再按倍速缩短。 */

import type { EditorialEvent } from "./events.js";

/** 事件里的 1 秒在 1 倍速下播多少毫秒。 */
export const REPLAY_MS_PER_SECOND = 320;
/** 1 倍速下两条事件最少隔多久（太快看不清工位动作）、最多隔多久（真实数据里的长空档不干等）。 */
export const REPLAY_MIN_GAP_MS = 520;
export const REPLAY_MAX_GAP_MS = 1800;
export const REPLAY_SPEEDS = [0.5, 1, 2, 4] as const;

export function replayDelayMs(prev: EditorialEvent | undefined, next: EditorialEvent, speed = 1): number {
  const gapSeconds = prev ? Math.max(0, next.ts - prev.ts) : 0;
  const base = Math.min(REPLAY_MAX_GAP_MS, Math.max(REPLAY_MIN_GAP_MS, gapSeconds * REPLAY_MS_PER_SECOND));
  return Math.round(base / (speed > 0 ? speed : 1));
}
