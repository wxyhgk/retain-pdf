// 2.5D 编辑部的等距投影：地面格子坐标 (gx, gy) 和离地高度 z（像素）→ SVG 平面坐标。
// 2:1 等距：gx 往右下、gy 往左下，一格宽 TILE_W、高 TILE_H。只算坐标，不碰 React。

export const TILE_W = 56;
export const TILE_H = 28;

/** 房间：地面 ROOM_W × ROOM_D 格，墙高 WALL_H 像素。 */
export const ROOM_W = 9.4;
export const ROOM_D = 8.2;
export const WALL_H = 96;
const PAD = 18;

export const ORIGIN_X = ROOM_D * (TILE_W / 2) + PAD;
export const ORIGIN_Y = WALL_H + PAD + 4;
export const VIEW_W = (ROOM_W + ROOM_D) * (TILE_W / 2) + PAD * 2;
export const VIEW_H = ORIGIN_Y + (ROOM_W + ROOM_D) * (TILE_H / 2) + PAD;

export type Point = { x: number; y: number };

export function iso(gx: number, gy: number, z = 0): Point {
  return {
    x: ORIGIN_X + (gx - gy) * (TILE_W / 2),
    y: ORIGIN_Y + (gx + gy) * (TILE_H / 2) - z,
  };
}

export const pts = (points: Point[]) => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

/** 一个立着的方块：(gx, gy) 是靠后的角，w 沿 gx、d 沿 gy，z 起、高 h。返回看得见的三个面。 */
export function boxFaces(gx: number, gy: number, w: number, d: number, h: number, z = 0) {
  const top = [iso(gx, gy, z + h), iso(gx + w, gy, z + h), iso(gx + w, gy + d, z + h), iso(gx, gy + d, z + h)];
  // 左面朝左下（gy 方向的那一侧），右面朝右下（gx 方向的那一侧）。
  const left = [iso(gx, gy + d, z + h), iso(gx + w, gy + d, z + h), iso(gx + w, gy + d, z), iso(gx, gy + d, z)];
  const right = [iso(gx + w, gy, z + h), iso(gx + w, gy + d, z + h), iso(gx + w, gy + d, z), iso(gx + w, gy, z)];
  return { top: pts(top), left: pts(left), right: pts(right) };
}

/** 一块平放在地上（或某个高度）的矩形，比如地毯、传送带上的一段。 */
export function flatRect(gx: number, gy: number, w: number, d: number, z = 0): string {
  return pts([iso(gx, gy, z), iso(gx + w, gy, z), iso(gx + w, gy + d, z), iso(gx, gy + d, z)]);
}

/** 贴在右边那面墙（gy = 0）上的矩形：gx 从 x0 到 x1，离地 z0 到 z1。 */
export function rightWallRect(x0: number, x1: number, z0: number, z1: number): string {
  return pts([iso(x0, 0, z1), iso(x1, 0, z1), iso(x1, 0, z0), iso(x0, 0, z0)]);
}

/** 贴在左边那面墙（gx = 0）上的矩形：gy 从 y0 到 y1，离地 z0 到 z1。 */
export function leftWallRect(y0: number, y1: number, z0: number, z1: number): string {
  return pts([iso(0, y0, z1), iso(0, y1, z1), iso(0, y1, z0), iso(0, y0, z0)]);
}

/** 画的先后：越靠前（gx + gy 越大）越后画，盖住后面的。 */
export const depthOf = (gx: number, gy: number) => gx + gy;
