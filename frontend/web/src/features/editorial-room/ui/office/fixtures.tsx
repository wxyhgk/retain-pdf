// 2.5D 编辑部里不坐人的几样机器：质检闸门、档案柜（定稿的纸堆）、「待人看」筐、筹备中的空桌，
// 和传送带上走的稿纸。都按 station-model 给的数和 RoomState 里的页画，排进场景的前后顺序。

import type { CSSProperties } from "react";

import type { BasketItem, PageCard } from "../../domain/room-state.js";
import { PLANNED_STATIONS } from "../EditorialSidePanels.jsx";
import { depthOf, flatRect, iso, type Point } from "./iso.js";
import { AT, CABINET_TOP_Z, PILE_MAX_SHEETS, PILE_STEP, SHEET_ROUTE } from "./layout.js";
import { Basket, CheckGate, IsoBox } from "./OfficeParts.jsx";
import type { OfficeModel } from "./station-model.js";
import type { SceneItem } from "./stations.jsx";

export const PLANNED_GX = [0.6, 2.2, 3.8, 5.4, 7.0];
export const PLANNED_GY = 7.5;

/** 定稿的页分成至多 PILE_MAX_SHEETS 叠；一叠里有退回原文的页就标红。 */
function filedPile(done: PageCard[]): { flagged: boolean }[] {
  const count = Math.min(done.length, PILE_MAX_SHEETS);
  return Array.from({ length: count }, (_, i) => {
    const slice = done.slice(Math.floor((i * done.length) / count), Math.floor(((i + 1) * done.length) / count));
    return { flagged: slice.some((card) => card.fallback) };
  });
}

export function fixtureItems(model: OfficeModel, basket: readonly BasketItem[]): SceneItem[] {
  const [gx, gy] = AT.gate;
  const [cx, cy] = AT.cabinet;
  const { checker, archive } = model.stations;
  return [
    {
      depth: depthOf(gx, gy) + 1,
      key: "gate",
      node: (
        <g data-editorial-station="checker" data-busy={checker.busy ? "true" : "false"} data-tone={model.gate}>
          <title>{checker.hint}</title>
          <CheckGate at={AT.gate} tone={model.gate} />
        </g>
      ),
    },
    {
      depth: depthOf(cx, cy) + 1.6,
      key: "cabinet",
      node: (
        <g data-editorial-station="archive" data-done={model.done.length}>
          <title>{archive.hint}</title>
          <IsoBox at={[cx, cy]} size={[1.0, 0.8, 44]} tone="metal" />
          {filedPile(model.done).map((sheet, i) => (
            <polygon
              key={i}
              className={`editorial-room-office-paper is-filed${sheet.flagged ? " is-flagged" : ""}`}
              points={flatRect(cx + 0.18, cy + 0.14, 0.62, 0.5, CABINET_TOP_Z + i * PILE_STEP)}
            />
          ))}
        </g>
      ),
    },
    {
      depth: depthOf(AT.basket[0], AT.basket[1]) + 1.6,
      key: "basket",
      node: (
        <g data-editorial-basket={basket.length}>
          <title>{`待人看：${basket.length} 处，先显示原文`}</title>
          <Basket at={AT.basket} count={basket.length} />
        </g>
      ),
    },
    ...PLANNED_STATIONS.map((station, i) => ({
      depth: depthOf(PLANNED_GX[i], PLANNED_GY) + 0.6,
      key: `planned-${station.id}`,
      node: (
        <g data-editorial-planned={station.id}>
          <title>{`筹备中：${station.title}（${station.hint}）`}</title>
          <IsoBox at={[PLANNED_GX[i], PLANNED_GY]} size={[1.2, 0.6, 16]} tone="planned" />
        </g>
      ),
    })),
  ];
}

/** 传送带上的一张稿纸：停在这一站前面，挂上时从上一站沿带子（过拐角）走过来。 */
export function Sheet({ card }: { card: PageCard }) {
  const route = SHEET_ROUTE[card.stage];
  if (!route) return null;
  const to = iso(route.to[0], route.to[1], 6);
  const from = iso(route.from[0], route.from[1], 6);
  // 沿带子拐角走；不拐的那段取中点，好让同一套关键帧（起点 → 中途 → 终点）两种都能用。
  const via = route.via ? iso(route.via[0], route.via[1], 6) : { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const still = from.x === to.x && from.y === to.y;
  const offset = (p: Point, axis: "x" | "y") => `${(p[axis] - to[axis]).toFixed(1)}px`;
  const style = {
    "--from-x": offset(from, "x"),
    "--from-y": offset(from, "y"),
    "--via-x": offset(via, "x"),
    "--via-y": offset(via, "y"),
  } as CSSProperties;
  return (
    <g
      className={`editorial-room-office-sheet is-${card.stage}${still ? " is-still" : ""}`}
      style={style}
      data-editorial-page={card.page}
      data-editorial-stage={card.stage}
    >
      <title>{`第 ${card.label} 页`}</title>
      <polygon className="editorial-room-office-paper" points={flatRect(route.to[0] - 0.28, route.to[1] - 0.24, 0.56, 0.48, 6)} />
      <text className="editorial-room-office-page-no" x={to.x} y={to.y - 8} textAnchor="middle">
        {card.label}
      </text>
    </g>
  );
}
