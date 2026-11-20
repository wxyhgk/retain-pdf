// 2.5D 编辑部里程序干的活（调度、修订）：小机器人，和 Person 同一块 64 × 68 画布，轮子落在 y = 62。
// 只认角色和样子（idle / busy / moving），不读编辑部状态：
//   idle    屏幕脸熄着、眼睛是两道横线，天线灯灰
//   busy    屏幕亮、圆眼睛，天线灯绿
//   moving  再加眨眼、天线灯呼吸、手上的动作（调度挥单子、修订的笔上下划）
// 调度：高个、胸口三盏指示灯、举着一块夹板；修订：胸口一排刻度、握一支红笔。颜色走 cast.css。

import type { ActorPose } from "./Person.jsx";

export type RobotRole = "dispatcher" | "reviser";

export function Robot({ role, pose }: { role: RobotRole; pose: ActorPose }) {
  const tall = role === "dispatcher";
  const top = tall ? 6 : 12;
  return (
    <g className={`office-cast is-robot is-${role} is-${pose}`} data-office-actor={role} data-office-pose={pose}>
      <ellipse className="office-cast-wheel-shadow" cx="32" cy="61" rx="15" ry="3.2" />
      {/* 天线 */}
      <path className="office-cast-stroke" d={`M32 ${top} L32 ${top - 5}`} />
      <circle className="office-cast-bulb office-cast-stroke" cx="32" cy={top - 6.5} r="2.4" />
      {/* 脑袋：外壳、侧面暗部、两颗耳螺丝、屏幕脸 */}
      <rect className="office-cast-shell office-cast-stroke" x="19" y={top} width="26" height="18" rx="5" />
      <path className="office-cast-shell-shade" d={`M39 ${top + 1} Q44 ${top + 1} 44 ${top + 6} L44 ${top + 13} Q44 ${top + 17} 39 ${top + 17} Z`} />
      <circle className="office-cast-bolt office-cast-stroke" cx="18" cy={top + 9} r="1.8" />
      <circle className="office-cast-bolt office-cast-stroke" cx="46" cy={top + 9} r="1.8" />
      <rect className="office-cast-screen" x="22.5" y={top + 3.5} width="19" height="11" rx="3" />
      <g className="office-cast-robot-eyes">
        <rect className="office-cast-led" x="26.2" y={top + 6.6} width="3.4" height="4.6" rx="1.7" />
        <rect className="office-cast-led" x="34.4" y={top + 6.6} width="3.4" height="4.6" rx="1.7" />
        <path className="office-cast-led-off" d={`M26 ${top + 9} h3.8 M34.2 ${top + 9} h3.8`} />
      </g>
      {/* 脖子、身子 */}
      <path className="office-cast-stroke" d={`M29 ${top + 18} L29 ${top + 20.5} M35 ${top + 18} L35 ${top + 20.5}`} />
      <rect className="office-cast-shell office-cast-stroke" x="21" y={top + 20.5} width="22" height={tall ? 26 : 20} rx="5" />
      <path className="office-cast-shell-shade" d={`M37 ${top + 21.5} Q42 ${top + 21.5} 42 ${top + 26} L42 ${top + (tall ? 42 : 36)} Q42 ${top + (tall ? 45.5 : 39.5)} 37 ${top + (tall ? 45.5 : 39.5)} Z`} />
      {tall ? (
        <g className="office-cast-panel">
          <rect className="office-cast-panel-plate office-cast-stroke" x="25" y={top + 25} width="14" height="9" rx="2" />
          <circle className="office-cast-lamp is-a" cx="28.5" cy={top + 29.5} r="1.5" />
          <circle className="office-cast-lamp is-b" cx="32" cy={top + 29.5} r="1.5" />
          <circle className="office-cast-lamp is-c" cx="35.5" cy={top + 29.5} r="1.5" />
          <path className="office-cast-stroke office-cast-ink" d={`M26 ${top + 38} h12 M26 ${top + 41} h8`} />
        </g>
      ) : (
        <path className="office-cast-stroke office-cast-ink" d={`M25 ${top + 26} h14 M25 ${top + 29.5} h3 M30 ${top + 29.5} h3 M35 ${top + 29.5} h4 M25 ${top + 33} h9`} />
      )}
      {/* 左手垂着，右手拿东西 */}
      <path className="office-cast-stroke" d={`M21 ${top + 25} Q15 ${top + 30} 17 ${top + 37}`} />
      <circle className="office-cast-claw office-cast-stroke" cx="17" cy={top + 38} r="2" />
      <g className="office-cast-robot-arm">
        <path className="office-cast-stroke" d={`M43 ${top + 25} Q49 ${top + 27} 49 ${top + 33}`} />
        {tall ? (
          <g>
            <path className="office-cast-board office-cast-stroke" d={`M45 ${top + 31} L55 ${top + 29} L57 ${top + 40} L47 ${top + 42} Z`} />
            <path className="office-cast-stroke office-cast-ink" d={`M48 ${top + 34} L54 ${top + 33} M48.5 ${top + 37} L55 ${top + 35.8}`} />
          </g>
        ) : (
          <path className="office-cast-pen" d={`M48 ${top + 36} L55 ${top + 27}`} />
        )}
        <circle className="office-cast-claw office-cast-stroke" cx="49" cy={top + 34} r="2" />
      </g>
      {/* 底座和轮子 */}
      <path className="office-cast-stroke" d={`M25 ${top + (tall ? 46.5 : 40.5)} L24 56 M39 ${top + (tall ? 46.5 : 40.5)} L40 56`} />
      <rect className="office-cast-base office-cast-stroke" x="17" y="55" width="30" height="6" rx="3" />
      <circle className="office-cast-wheel office-cast-stroke" cx="22" cy="61" r="2.6" />
      <circle className="office-cast-wheel office-cast-stroke" cx="32" cy="61" r="2.6" />
      <circle className="office-cast-wheel office-cast-stroke" cx="42" cy="61" r="2.6" />
    </g>
  );
}
