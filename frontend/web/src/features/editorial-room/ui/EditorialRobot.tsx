// 编辑部里程序干活的小机器人（调度、修订）：方脑袋、天线、两只眼睛，和小人同一种线描。
// 颜色走 CSS 类（EditorialRobot.css）；忙的时候天线灯闪、手臂动，闲着半透明。
// 和 EditorialFigure 一样是 64 × 68 的画布，脚底在 y = 62，方便在 2.5D 场景里同样摆放。

export type RobotRole = "dispatcher" | "reviser";

export function EditorialRobot({ role, busy }: { role: RobotRole; busy: boolean }) {
  return (
    <svg
      className={`editorial-room-robot is-${role}${busy ? " is-busy" : ""}`}
      viewBox="0 0 64 68"
      width={64}
      height={68}
      aria-hidden="true"
      focusable="false"
      overflow="visible"
    >
      <g className="editorial-room-robot-body">
        {/* 天线 */}
        <path className="editorial-room-fig-line" d="M32 12 L32 5" />
        <circle className="editorial-room-robot-bulb" cx="32" cy="4" r="2.6" />
        {/* 脑袋和眼睛 */}
        <rect className="editorial-room-robot-shell editorial-room-fig-line" x="20" y="12" width="24" height="17" rx="5" />
        <g className="editorial-room-robot-eyes">
          <circle className="editorial-room-robot-eye" cx="27" cy="20.5" r="2.2" />
          <circle className="editorial-room-robot-eye" cx="37" cy="20.5" r="2.2" />
        </g>
        {/* 身子 */}
        <rect className="editorial-room-robot-chest editorial-room-fig-line" x="22" y="31" width="20" height="20" rx="4" />
        <path className="editorial-room-fig-line" d="M27 38 h10 M27 43 h6" />
        {/* 手臂：调度举着一张单子，修订握着一支笔 */}
        <path className="editorial-room-fig-line" d="M22 36 Q16 40 18 46" />
        <g className="editorial-room-robot-arm">
          <path className="editorial-room-fig-line" d="M42 36 Q48 38 48 44" />
          {role === "dispatcher" ? (
            <path className="editorial-room-fig-paper" d="M45 42 L53 40 L55 48 L47 50 Z" />
          ) : (
            <path className="editorial-room-robot-pen editorial-room-fig-line" d="M47 45 L53 37" />
          )}
        </g>
        {/* 底座轮子 */}
        <path className="editorial-room-fig-line" d="M24 51 L22 57 M40 51 L42 57" />
        <rect className="editorial-room-robot-base editorial-room-fig-line" x="18" y="56" width="28" height="6" rx="3" />
      </g>
    </svg>
  );
}
