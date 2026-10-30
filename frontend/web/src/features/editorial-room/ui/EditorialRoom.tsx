// 翻译编辑部：把翻译 agent 各个角色怎么分工、一页稿子怎么在他们之间流转画出来。
//
// 只画，不取数据：传进来 RoomState（editorial.v1 事件叠出来的，见 domain/room-state.ts）
// 和最近几条事件（底下的广播）。回放用 EditorialRoomReplay，以后接真实进度同样把事件叠成 state 传进来。

import { narrate, stopReasonText } from "../domain/narration.js";
import type { EditorialEvent } from "../domain/events.js";
import { roomTotals, type RoomState } from "../domain/room-state.js";
import { EditorialFloor } from "./EditorialFloor.jsx";
import { STAGE_TEXT } from "./EditorialPageSheet.jsx";
import { FallbackBasket, GlossaryBoard, PlannedStations } from "./EditorialSidePanels.jsx";

const STATUS_TEXT: Record<RoomState["status"], string> = {
  idle: "还没开工",
  reading: "通读中",
  running: "翻译中",
  stopped: "停下了",
  done: "全部定稿",
};

type Stat = { key: string; label: string; value: string | number; tone?: "ok" | "warn" | "danger" | "accent" };

function StatsRow({ state }: { state: RoomState }) {
  const totals = roomTotals(state);
  const stats: Stat[] = [
    { key: "done", label: "定稿", value: `${totals.donePages} / ${state.pages.length}` },
    { key: "ok", label: "合格", value: totals.ok, tone: "ok" },
    { key: "warn", label: "警告", value: totals.warn, tone: "warn" },
    { key: "error", label: "不合格", value: totals.error, tone: "danger" },
    { key: "fallback", label: "退回原文", value: totals.fallback, tone: "danger" },
    { key: "retries", label: "重翻", value: totals.retries },
    { key: "applied", label: "审校改了", value: totals.applied, tone: "accent" },
    { key: "rejected", label: "没收", value: totals.rejected },
    { key: "glossary", label: "术语表", value: `第 ${totals.glossaryVersion} 版` },
    { key: "ambiguity", label: "歧义单", value: totals.ambiguity, tone: totals.ambiguity ? "warn" : undefined },
  ];
  return (
    <dl className="editorial-room-stats">
      {stats.map((stat) => (
        <div key={stat.key} className={`editorial-room-stat${stat.tone ? ` is-${stat.tone}` : ""}`} data-editorial-stat={stat.key}>
          <dt>{stat.label}</dt>
          <dd key={String(stat.value)}>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PageRail({ state }: { state: RoomState }) {
  if (!state.pages.length) return null;
  return (
    <ol className="editorial-room-rail" aria-label="每页走到哪了">
      {state.pages.map((card) => (
        <li
          key={card.page}
          className={`editorial-room-rail-page is-${card.stage}${card.fallback ? " has-fallback" : ""}`}
          data-editorial-rail-page={card.page}
          title={`第 ${card.label} 页：${STAGE_TEXT[card.stage]}`}
        >
          <span className="editorial-room-rail-label">{card.label}</span>
          <span className="editorial-room-rail-stage">{STAGE_TEXT[card.stage]}</span>
        </li>
      ))}
    </ol>
  );
}

function Broadcast({ recent }: { recent: readonly EditorialEvent[] }) {
  const lines = recent.map((event, index) => ({ ...narrate(event), key: `${recent.length - index}-${event.type}-${event.ts}` }));
  return (
    <ol className="editorial-room-log" aria-label="编辑部广播" aria-live="polite">
      {lines.length ? (
        lines.map((line, index) => (
          <li key={line.key} className={`editorial-room-log-line is-${line.tone}${index === 0 ? " is-latest" : ""}`}>
            {line.text}
          </li>
        ))
      ) : (
        <li className="editorial-room-log-line is-neutral">编辑部还没开工</li>
      )}
    </ol>
  );
}

export type EditorialRoomProps = {
  state: RoomState;
  /** 最近几条事件，新的在前。 */
  recent?: readonly EditorialEvent[];
};

export function EditorialRoom({ state, recent = [] }: EditorialRoomProps) {
  return (
    <section
      className={`editorial-room is-${state.status}`}
      aria-label="翻译编辑部"
      data-editorial-room="true"
      data-editorial-status={state.status}
    >
      <header className="editorial-room-header">
        <div className="editorial-room-title">
          <strong>翻译编辑部</strong>
          {state.docTitle ? <span className="editorial-room-doc">《{state.docTitle}》</span> : null}
          {state.model ? <span className="editorial-room-model">{state.model}</span> : null}
        </div>
        <span className={`editorial-room-status is-${state.status}`} data-editorial-status-pill="true">
          {state.status === "stopped" ? stopReasonText(state.stopReason) : STATUS_TEXT[state.status]}
        </span>
      </header>
      <StatsRow state={state} />
      <div className="editorial-room-body">
        <EditorialFloor state={state} />
        <aside className="editorial-room-side">
          <GlossaryBoard state={state} />
          <FallbackBasket state={state} />
        </aside>
      </div>
      <PageRail state={state} />
      <Broadcast recent={recent} />
      <PlannedStations />
    </section>
  );
}
