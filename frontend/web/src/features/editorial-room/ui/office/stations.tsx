// 2.5D 编辑部的工位表：谁坐哪、坐不坐椅子、什么桌子、桌上摆什么。加一个工位就是加一行。
// stationItems 按这张表和 station-model 给的样子（忙不忙、头顶一个词、悬停一句话）拼出要画的东西，
// 角色（cast/）和家具（props/）都不读编辑部状态。质检闸门、档案柜、筐这几样机器在 EditorialOffice 里单画。

import type { ReactNode } from "react";

import { Person, type ActorPose, type PersonRole } from "./cast/Person.jsx";
import { Robot, type RobotRole } from "./cast/Robot.jsx";
import { depthOf, iso } from "./iso.js";
import { AT, SPRITE_SCALE, TAG_Z, type Spot } from "./layout.js";
import { IsoBox, Sprite, Tag } from "./OfficeParts.jsx";
import { ChairBack, DeskItem, GroundShadow, type DeskItemSpec, type DeskSpec } from "./props/Furniture.jsx";
import type { StationId, StationView } from "./station-model.js";

type Actor = { kind: "person"; role: PersonRole } | { kind: "robot"; role: RobotRole };

export type StationSpec = {
  id: Exclude<StationId, "checker" | "archive">;
  actor: Actor;
  spot: Spot;
  chair?: boolean;
  desk?: DeskSpec;
  items?: DeskItemSpec[];
};

/** 人坐的木桌：在人前面一点，1.3 × 0.7 格、26 像素高。 */
const woodDesk = ([gx, gy]: Spot): DeskSpec => ({ at: [gx - 0.3, gy + 0.2], size: [1.3, 0.7, 26], tone: "wood" });

export const STATIONS: StationSpec[] = [
  { id: "dispatcher", actor: { kind: "robot", role: "dispatcher" }, spot: AT.dispatcher },
  {
    id: "reader",
    actor: { kind: "person", role: "reader" },
    spot: AT.reader,
    chair: true,
    desk: woodDesk(AT.reader),
    items: [
      { kind: "books", u: 0.18, v: 0.45 },
      { kind: "mug", u: 0.86, v: 0.5 },
    ],
  },
  {
    id: "translator",
    actor: { kind: "person", role: "translator" },
    spot: AT.translator,
    chair: true,
    desk: woodDesk(AT.translator),
    items: [
      { kind: "papers", u: 0.24, v: 0.5 },
      { kind: "laptop", u: 0.78, v: 0.42 },
    ],
  },
  {
    id: "reviewer",
    actor: { kind: "person", role: "reviewer" },
    spot: AT.reviewer,
    chair: true,
    desk: woodDesk(AT.reviewer),
    items: [
      { kind: "marked-papers", u: 0.3, v: 0.5 },
      { kind: "lamp", u: 0.86, v: 0.32 },
    ],
  },
  {
    id: "reviser",
    actor: { kind: "robot", role: "reviser" },
    spot: AT.reviser,
    desk: { at: [AT.reviser[0] - 0.25, AT.reviser[1] + 0.2], size: [1.1, 0.6, 20], tone: "metal" },
    items: [
      { kind: "papers", u: 0.25, v: 0.5 },
      { kind: "monitor", u: 0.74, v: 0.4 },
    ],
  },
];

export type SceneItem = { depth: number; key: string; node: ReactNode };

/** 头顶牌子的深度：总在最上面一层。 */
export const TOP_LAYER = 99;

export const poseOf = (view: StationView): ActorPose => (view.moving ? "moving" : view.busy ? "busy" : "idle");

export function stationItems(spec: StationSpec, view: StationView): SceneItem[] {
  const [gx, gy] = spec.spot;
  const base = depthOf(gx, gy);
  const pose = poseOf(view);
  const lit = view.busy ? " is-lit" : "";
  const items: SceneItem[] = [
    {
      depth: base,
      key: `${spec.id}-actor`,
      node: (
        // 人标 data-editorial-seat、机器标 data-editorial-station（和调试视图同一套标记）。
        <g
          {...(spec.actor.kind === "person" ? { "data-editorial-seat": spec.id } : { "data-editorial-station": spec.id })}
          data-busy={view.busy ? "true" : "false"}
          data-editorial-holding={view.holding || undefined}
        >
          <title>{view.hint}</title>
          <GroundShadow at={iso(gx, gy)} rx={spec.actor.kind === "robot" ? 18 : 24} />
          <Sprite at={iso(gx, gy)} scale={SPRITE_SCALE}>
            {spec.chair ? <ChairBack /> : null}
            {spec.actor.kind === "person" ? <Person role={spec.actor.role} pose={pose} /> : <Robot role={spec.actor.role} pose={pose} />}
          </Sprite>
        </g>
      ),
    },
  ];
  if (spec.desk) {
    const desk = spec.desk;
    items.push({
      depth: base + 1,
      key: `${spec.id}-desk`,
      node: (
        <g className={`office-desk${lit}`} data-office-desk={spec.id}>
          <IsoBox at={desk.at} size={desk.size} tone={desk.tone} />
          {(spec.items || []).map((item, i) => (
            <DeskItem key={`${item.kind}-${i}`} desk={desk} item={item} />
          ))}
        </g>
      ),
    });
  }
  if (view.tag) items.push({ depth: TOP_LAYER, key: `${spec.id}-tag`, node: <Tag at={iso(gx, gy, TAG_Z)} text={view.tag} /> });
  return items;
}
