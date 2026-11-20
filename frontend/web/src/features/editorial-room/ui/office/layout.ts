// 2.5D 编辑部的摆位：工位站在地面哪一格、稿纸停在传送带哪一点、稿纸从一站到下一站沿带子怎么拐。
// 全景（EditorialOffice）和一次性动效（OfficeMoments）共用。只有坐标，不碰 React。

import type { PageStage } from "../../domain/room-state.js";

export type Spot = [number, number];

// 工位在地面上的位置。
export const AT = {
  dispatcher: [0.8, 1.7] as Spot,
  reader: [3.6, 1.5] as Spot,
  translator: [6.0, 1.5] as Spot,
  gate: [8.3, 3.7] as Spot,
  reviewer: [6.0, 4.7] as Spot,
  reviser: [3.6, 4.7] as Spot,
  cabinet: [0.7, 4.5] as Spot,
  basket: [8.5, 6.9] as Spot,
};

// 稿纸停在传送带上的点。
export const DROP = {
  dispatcher: [1.5, 2.9] as Spot,
  translator: [6.0, 2.9] as Spot,
  checker: [8.45, 4.3] as Spot,
  reviewer: [6.0, 6.2] as Spot,
  reviser: [3.6, 6.2] as Spot,
  /** 带子的尽头，定稿的页从这里送上档案柜。 */
  end: [1.3, 6.2] as Spot,
};

/** 带子的两个拐角：后排到闸门、闸门到前排。 */
const CORNER = {
  back: [8.45, 2.9] as Spot,
  front: [8.45, 6.2] as Spot,
};

export const BELT: Spot[] = [[1.0, 2.9], CORNER.back, CORNER.front, [1.0, 6.2]];

/**
 * 每个阶段的稿纸停在哪（to）、从哪来（from）、中间拐哪个角（via，不拐就没有）。
 * 稿纸沿带子走，不再斜穿过地面：译者 → 拐角 → 闸门，闸门 → 拐角 → 审校。
 */
export const SHEET_ROUTE: Partial<Record<PageStage, { to: Spot; from: Spot; via?: Spot }>> = {
  queued: { to: DROP.translator, from: DROP.dispatcher },
  translating: { to: DROP.translator, from: DROP.translator },
  retrying: { to: DROP.translator, from: DROP.checker, via: CORNER.back },
  checking: { to: DROP.checker, from: DROP.translator, via: CORNER.back },
  reviewing: { to: DROP.reviewer, from: DROP.checker, via: CORNER.front },
  revising: { to: DROP.reviser, from: DROP.reviewer },
};

/** 小人、机器人在场景里放大多少；头顶牌子离地多高（气泡再往上一层）。 */
export const SPRITE_SCALE = 1.35;
export const TAG_Z = 62 * SPRITE_SCALE + 10;
export const BUBBLE_Z = TAG_Z + 28;

/** 档案柜柜顶离地多高；纸堆最多画几张、每张多厚。 */
export const CABINET_TOP_Z = 45;
export const PILE_MAX_SHEETS = 10;
export const PILE_STEP = 3;
