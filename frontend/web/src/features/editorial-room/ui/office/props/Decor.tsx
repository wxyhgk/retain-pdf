// 2.5D 编辑部的陈设：左墙一扇窗（天和两朵云）、右墙一只钟、地上两块地毯、几盆绿植。
// 纯装饰，不读状态，不挡工位。颜色走 props.css。

import { flatRect, iso, leftWallRect, pts } from "../iso.js";
import { IsoBox } from "../OfficeParts.jsx";

/** 左墙（gx = 0）上的窗：gy 从 y0 到 y1，离地 z0 到 z1；一横一竖两根窗棂，天上两朵云。 */
export function WallWindow({ y0, y1, z0, z1 }: { y0: number; y1: number; z0: number; z1: number }) {
  const midY = (y0 + y1) / 2;
  const midZ = (z0 + z1) / 2;
  // 左墙平面里的一点：往 -gy 方向 1 像素是往右 1、往上 0.5。
  const cloud = (gy: number, z: number) => iso(0, gy, z);
  const c1 = cloud(y0 + (y1 - y0) * 0.3, z1 - 10);
  const c2 = cloud(y0 + (y1 - y0) * 0.72, z1 - 22);
  return (
    <g className="office-prop-window" aria-hidden="true">
      <polygon className="office-prop-window-frame" points={leftWallRect(y0 - 0.12, y1 + 0.12, z0 - 5, z1 + 5)} />
      <polygon className="office-prop-sky" points={leftWallRect(y0, y1, z0, z1)} />
      <g transform={`matrix(1 -0.5 0 1 ${c1.x.toFixed(1)} ${c1.y.toFixed(1)})`}>
        <ellipse className="office-prop-cloud" cx="0" cy="0" rx="9" ry="3.6" />
        <ellipse className="office-prop-cloud" cx="5" cy="-2.6" rx="5.5" ry="3.4" />
      </g>
      <g transform={`matrix(1 -0.5 0 1 ${c2.x.toFixed(1)} ${c2.y.toFixed(1)})`}>
        <ellipse className="office-prop-cloud" cx="0" cy="0" rx="7" ry="2.8" />
        <ellipse className="office-prop-cloud" cx="-3.5" cy="-2" rx="4.4" ry="2.8" />
      </g>
      <polyline className="office-prop-mullion" points={pts([iso(0, midY, z0), iso(0, midY, z1)])} />
      <polyline className="office-prop-mullion" points={pts([iso(0, y0, midZ), iso(0, y1, midZ)])} />
      <polygon className="office-prop-sill" points={pts([iso(0, y0 - 0.2, z0 - 5), iso(0, y1 + 0.2, z0 - 5), iso(0.25, y1 + 0.2, z0 - 5), iso(0.25, y0 - 0.2, z0 - 5)])} />
    </g>
  );
}

/** 右墙（gy = 0）上的钟：贴着墙斜过去的圆盘，指着十点十分。 */
export function WallClock({ gx, z }: { gx: number; z: number }) {
  const c = iso(gx, 0, z);
  return (
    <g className="office-prop-clock" transform={`matrix(1 0.5 0 1 ${c.x.toFixed(1)} ${c.y.toFixed(1)})`} aria-hidden="true">
      <circle className="office-prop-clock-face" cx="0" cy="0" r="9" />
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return <path key={i} className="office-prop-clock-tick" d={`M${(Math.sin(a) * 6.6).toFixed(1)} ${(-Math.cos(a) * 6.6).toFixed(1)} L${(Math.sin(a) * 8).toFixed(1)} ${(-Math.cos(a) * 8).toFixed(1)}`} />;
      })}
      <path className="office-prop-clock-hand" d="M0 0 L-3.6 -2.2 M0 0 L4.4 -4.6" />
      <circle className="office-prop-clock-pin" cx="0" cy="0" r="1" />
    </g>
  );
}

/** 地毯：一块平铺在地上的长方形，内圈一道边。 */
export function Rug({ at, size, tone }: { at: [number, number]; size: [number, number]; tone: "warm" | "cool" }) {
  const [gx, gy] = at;
  const [w, d] = size;
  return (
    <g className={`office-prop-rug is-${tone}`} aria-hidden="true">
      <polygon className="office-prop-rug-base" points={flatRect(gx, gy, w, d, 0.5)} />
      <polygon className="office-prop-rug-border" points={flatRect(gx + 0.18, gy + 0.18, w - 0.36, d - 0.36, 0.6)} />
    </g>
  );
}

/** 一盆绿植：方盆，几片叶子往上长。 */
export function Plant({ at, tall = false }: { at: [number, number]; tall?: boolean }) {
  const [gx, gy] = at;
  const top = iso(gx + 0.25, gy + 0.25, 16);
  const h = tall ? 1.35 : 1;
  const leaves: Array<[number, number, number, number]> = [
    [-7, -10, 5, -30],
    [6, -12, 5, 28],
    [0, -18, 4.6, -6],
    [-9, -4, 4, -60],
    [9, -5, 4, 58],
    [3, -24, 4, 18],
  ];
  return (
    <g className="office-prop-plant" aria-hidden="true">
      <IsoBox at={[gx, gy]} size={[0.5, 0.5, 16]} tone="plain" />
      <g transform={`translate(${top.x.toFixed(1)} ${top.y.toFixed(1)}) scale(1 ${h})`}>
        {leaves.map(([x, y, r, rot], i) => (
          <ellipse
            key={i}
            className={`office-prop-leaf${i % 2 ? " is-dark" : ""}`}
            cx={x}
            cy={y}
            rx={r}
            ry={r * 2.3}
            transform={`rotate(${rot} ${x} ${y})`}
          />
        ))}
      </g>
    </g>
  );
}

