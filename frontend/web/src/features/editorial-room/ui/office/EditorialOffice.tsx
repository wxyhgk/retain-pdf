// 2.5D 编辑部全景：斜 45° 俯视的一间办公室。这个组件只管拼，按层从后往前画：
//   墙和陈设（窗、钟、看板、术语表白板）→ 地上（地毯、绿植、传送带）
//   → 场景里的东西按前后排好（工位、机器）→ 稿纸 → 一闪而过的动作 → 头顶的牌子。
//
// 各管各的：
//   station-model.ts  状态 → 每个工位此刻的样子（忙不忙、动不动、牌子、悬停）
//   stations.tsx      工位表（谁坐哪、什么桌子、桌上摆什么）和按表拼工位
//   cast/             人和机器人，只认角色和样子
//   props/            家具、桌上的东西、陈设，只认位置
//   fixtures.tsx      闸门、档案柜、筐、筹备中的空桌、稿纸
//   OfficeMoments     查资料、质检、审校单、定稿归档这些一闪而过的动作（每条事件只播一次）
//   OfficeParts       房间、方块、传送带、看板、白板这些底子

import { useState } from "react";

import type { RoomState } from "../../domain/room-state.js";
import { PLANNED_GX, PLANNED_GY, Sheet, fixtureItems } from "./fixtures.jsx";
import { VIEW_H, VIEW_W, iso } from "./iso.js";
import { BELT, SHEET_ROUTE } from "./layout.js";
import { OfficeMoments } from "./OfficeMoments.jsx";
import { Belt, Kanban, Room, Whiteboard } from "./OfficeParts.jsx";
import { Plant, Rug, WallClock, WallWindow } from "./props/Decor.jsx";
import { officeModel } from "./station-model.js";
import { STATIONS, TOP_LAYER, stationItems, type SceneItem } from "./stations.jsx";

export function EditorialOffice({ state, glossaryFresh }: { state: RoomState; glossaryFresh: boolean }) {
  const model = officeModel(state);
  // 一闪而过的动作只播挂上以后来的：打开「进度」页时，之前的事件不一起炸开。回放从头放时序号回到 0，跟着归零。
  const [mountedAt] = useState(state.seq);
  const since = state.seq < mountedAt ? 0 : mountedAt;
  const moments = state.moments.filter((moment) => moment.seq > since);
  const writeKey = [...moments].reverse().find((moment) => moment.event.type === "glossary_changed")?.seq ?? 0;

  const items: SceneItem[] = [
    ...STATIONS.flatMap((spec) => stationItems(spec, model.stations[spec.id])),
    ...fixtureItems(model, state.basket),
  ].sort((a, b) => a.depth - b.depth);
  const plannedLabel = iso(PLANNED_GX[0] + 0.2, PLANNED_GY - 0.2, 30);
  const sheets = state.pages.filter((card) => SHEET_ROUTE[card.stage]);

  return (
    <svg
      className={`editorial-room-office is-${state.status}`}
      viewBox={`0 0 ${VIEW_W.toFixed(0)} ${VIEW_H.toFixed(0)}`}
      role="img"
      aria-label="翻译编辑部：几位编辑接力翻译这本书"
      data-editorial-office="true"
    >
      <Room />
      <WallWindow y0={3.7} y1={6.3} z0={40} z1={80} />
      <WallClock gx={1.35} z={66} />
      <Kanban waiting={model.waiting} />
      <Whiteboard
        version={state.glossary.version}
        tickets={state.tickets.length}
        fresh={glossaryFresh}
        entries={state.glossary.recent}
        writeKey={writeKey}
      />
      <Rug at={[2.7, 0.55]} size={[4.6, 2.1]} tone="warm" />
      <Rug at={[2.9, 3.85]} size={[4.0, 1.95]} tone="cool" />
      <Plant at={[0.15, 3.05]} tall />
      <Plant at={[8.7, 0.25]} />
      <Belt path={BELT} moving={model.running} />
      {items.filter((item) => item.depth < TOP_LAYER).map((item) => <g key={item.key}>{item.node}</g>)}
      {sheets.map((card) => (
        <Sheet key={`${card.page}-${card.stage}-${card.attempt}`} card={card} />
      ))}
      <OfficeMoments moments={moments} filedCount={model.done.length} />
      <text className="editorial-room-office-note" x={plannedLabel.x} y={plannedLabel.y}>
        筹备中
      </text>
      {items.filter((item) => item.depth >= TOP_LAYER).map((item) => <g key={item.key}>{item.node}</g>)}
    </svg>
  );
}
