// 编辑部的小人：自己画的线描 SVG（没用外部素材，不涉及许可）。
// 颜色全走 CSS 类（editorial-room-figures.css），跟着皮肤换；忙的时候手和头会动，停下就静止。
// 三个角色靠手上的东西区分：通读员捧书、译者握笔对着稿纸、审校拿放大镜。

export type FigureRole = "reader" | "translator" | "reviewer";

function Prop({ role }: { role: FigureRole }) {
  if (role === "reader") {
    // 摊开的书，捧在胸前。
    return (
      <g className="editorial-room-fig-prop">
        <path className="editorial-room-fig-paper" d="M19 41 L32 44 L45 41 L45 51 L32 54 L19 51 Z" />
        <path className="editorial-room-fig-line" d="M32 44 L32 54 M22 44.5 L29 46 M22 47.5 L29 49 M35 46 L42 44.5 M35 49 L42 47.5" />
      </g>
    );
  }
  if (role === "translator") {
    // 桌上一张稿纸，右手握笔。
    return (
      <g className="editorial-room-fig-prop">
        <path className="editorial-room-fig-paper" d="M17 54 L35 54 L37 62 L15 62 Z" />
        <path className="editorial-room-fig-line" d="M19 57 L31 57 M18.5 59.5 L28 59.5" />
        <path className="editorial-room-fig-pen editorial-room-fig-line" d="M40 47 L46 39" />
      </g>
    );
  }
  // 放大镜举在面前。
  return (
    <g className="editorial-room-fig-prop editorial-room-fig-lens">
      <circle className="editorial-room-fig-glass editorial-room-fig-line" cx="46" cy="38" r="5.5" />
      <path className="editorial-room-fig-line" d="M42 42 L38 47" />
    </g>
  );
}

function Hair({ role }: { role: FigureRole }) {
  if (role === "reader") {
    return <path className="editorial-room-fig-hair" d="M23.5 15 Q24 6 32 6 Q40 6 40.5 15 Q36 10 32 11 Q27 10 23.5 15 Z M30 4 a3.2 3.2 0 1 0 4 0 Z" />;
  }
  if (role === "translator") {
    return (
      <g>
        <path className="editorial-room-fig-hair" d="M23.5 14 Q25 6 32 6.5 Q39 6 40.5 14 Q35 11 23.5 14 Z" />
        <path className="editorial-room-fig-line" d="M26 16.5 h4.5 M33.5 16.5 h4.5 M30.5 16.5 h3" />
      </g>
    );
  }
  return <path className="editorial-room-fig-hair" d="M23 13 Q24 6 32 6 Q40 6 41 13 L43.5 14 L22 14 Z" />;
}

export function EditorialFigure({ role, busy }: { role: FigureRole; busy: boolean }) {
  return (
    <svg
      className={`editorial-room-fig is-${role}${busy ? " is-busy" : ""}`}
      viewBox="0 0 64 68"
      aria-hidden="true"
      focusable="false"
    >
      {/* 桌面 */}
      <path className="editorial-room-fig-desk" d="M6 62 L58 62" />
      <g className="editorial-room-fig-body">
        <path className="editorial-room-fig-cloth editorial-room-fig-line" d="M20 58 Q19 33 32 30 Q45 33 44 58 Z" />
        <g className="editorial-room-fig-head">
          <circle className="editorial-room-fig-skin editorial-room-fig-line" cx="32" cy="17" r="9" />
          <Hair role={role} />
          <path className="editorial-room-fig-line" d="M29 21.5 Q32 23.5 35 21.5" />
        </g>
        <g className="editorial-room-fig-arms">
          <path className="editorial-room-fig-line" d="M24 36 Q20 44 24 49 M40 36 Q45 42 41 48" />
        </g>
        <Prop role={role} />
      </g>
    </svg>
  );
}
