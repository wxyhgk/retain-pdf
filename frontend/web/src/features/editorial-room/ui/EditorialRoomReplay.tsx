// 编辑部回放：喂一串事件按时间播放。默认是给用户看的简洁画面（EditorialStage），循环播放、没有按钮；
// debug 时换成完整信息的调试视图（EditorialRoom），带一排回放按钮（播放/暂停、单步、重来、拖进度条、倍速）。
// 以后接真实进度时直接用 EditorialStage / EditorialRoom，不需要回放。

import { Pause, Play, RotateCcw, StepForward } from "lucide-react";

import type { EditorialEvent } from "../domain/events.js";
import { REPLAY_SPEEDS } from "../domain/replay.js";
import { EditorialRoom } from "./EditorialRoom.jsx";
import { EditorialStage } from "./EditorialStage.jsx";
import { useEditorialReplay } from "./useEditorialReplay.js";

export type EditorialRoomReplayProps = {
  events: readonly EditorialEvent[];
  autoplay?: boolean;
  speed?: number;
  /** 调试视图：完整信息 + 回放按钮。 */
  debug?: boolean;
};

export function EditorialRoomReplay({ events, autoplay = true, speed = 1, debug = false }: EditorialRoomReplayProps) {
  const replay = useEditorialReplay(events, { autoplay, speed, loop: !debug });
  const finished = replay.count >= replay.total;
  if (!debug) {
    return (
      <div className="editorial-room-replay" data-editorial-replay="true">
        <EditorialStage state={replay.state} />
      </div>
    );
  }
  return (
    <div className="editorial-room-replay" data-editorial-replay="true">
      <EditorialRoom state={replay.state} recent={replay.recent} />
      <div className="editorial-room-controls" role="group" aria-label="回放">
        <button
          type="button"
          className="editorial-room-control is-primary"
          data-editorial-control="toggle"
          onClick={replay.playing ? replay.pause : replay.play}
          aria-label={replay.playing ? "暂停" : finished ? "从头播放" : "播放"}
        >
          {replay.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          <span>{replay.playing ? "暂停" : finished ? "再播一遍" : "播放"}</span>
        </button>
        <button
          type="button"
          className="editorial-room-control"
          data-editorial-control="step"
          onClick={replay.step}
          disabled={finished}
          aria-label="下一条"
        >
          <StepForward aria-hidden="true" />
        </button>
        <button
          type="button"
          className="editorial-room-control"
          data-editorial-control="restart"
          onClick={replay.restart}
          aria-label="从头播"
        >
          <RotateCcw aria-hidden="true" />
        </button>
        <input
          className="editorial-room-scrubber"
          type="range"
          min={0}
          max={replay.total}
          value={replay.count}
          onChange={(event) => replay.seek(Number(event.currentTarget.value))}
          aria-label="回放进度"
          data-editorial-control="seek"
        />
        <span className="editorial-room-count">
          {replay.count} / {replay.total}
        </span>
        <span className="editorial-room-speeds" role="radiogroup" aria-label="倍速">
          {REPLAY_SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={replay.speed === value}
              className={`editorial-room-speed${replay.speed === value ? " is-active" : ""}`}
              data-editorial-speed={value}
              onClick={() => replay.setSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
