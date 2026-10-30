// 回放：喂一串事件，按 ts 的间隔（压到看得清、再按倍速）一条条叠上去。
// 拖进度条、单步、重来都从头重新叠（事件不多，叠一遍很快），不另存中间状态。

import { useEffect, useMemo, useState } from "react";

import type { EditorialEvent } from "../domain/events.js";
import { replayDelayMs } from "../domain/replay.js";
import { roomStateAt, type RoomState } from "../domain/room-state.js";

const RECENT_LINES = 6;
/** 循环播放时，放完停多久再从头来。 */
export const REPLAY_LOOP_PAUSE_MS = 4000;

export type EditorialReplay = {
  state: RoomState;
  /** 最近几条事件，新的在前。 */
  recent: EditorialEvent[];
  count: number;
  total: number;
  playing: boolean;
  speed: number;
  play: () => void;
  pause: () => void;
  restart: () => void;
  step: () => void;
  seek: (count: number) => void;
  setSpeed: (speed: number) => void;
};

export function useEditorialReplay(
  events: readonly EditorialEvent[],
  options: { autoplay?: boolean; speed?: number; loop?: boolean } = {},
): EditorialReplay {
  const total = events.length;
  const [count, setCount] = useState(0);
  const [playing, setPlaying] = useState(options.autoplay ?? true);
  const [speed, setSpeed] = useState(options.speed ?? 1);

  // 换了一串事件（切场景）就从头播。在渲染时比对、不放进 effect：effect 挂载时也会跑一遍，
  // 会把挂载后立刻按下的「下一条」清回 0。
  const [source, setSource] = useState(events);
  if (source !== events) {
    setSource(events);
    setCount(0);
    setPlaying(options.autoplay ?? true);
  }

  useEffect(() => {
    if (!playing) return undefined;
    if (count >= total) {
      if (!options.loop || !total) {
        setPlaying(false);
        return undefined;
      }
      const again = setTimeout(() => setCount(0), REPLAY_LOOP_PAUSE_MS);
      return () => clearTimeout(again);
    }
    const timer = setTimeout(() => setCount((n) => Math.min(total, n + 1)), replayDelayMs(events[count - 1], events[count], speed));
    return () => clearTimeout(timer);
  }, [playing, count, total, events, speed, options.loop]);

  const state = useMemo(() => roomStateAt(events, count), [events, count]);
  const recent = useMemo(() => events.slice(Math.max(0, count - RECENT_LINES), count).reverse(), [events, count]);

  return {
    state,
    recent,
    count,
    total,
    playing,
    speed,
    play: () => {
      if (count >= total) setCount(0);
      setPlaying(true);
    },
    pause: () => setPlaying(false),
    restart: () => {
      setCount(0);
      setPlaying(true);
    },
    step: () => {
      setPlaying(false);
      setCount((n) => Math.min(total, n + 1));
    },
    seek: (next: number) => setCount(Math.max(0, Math.min(total, Math.round(next)))),
    setSpeed,
  };
}
