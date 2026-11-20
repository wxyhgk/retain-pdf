// 2.5D 编辑部里坐在桌后的人（通读员、译者、审校）：自己画的线描，64 × 68 的画布，座位底线在 y = 62
// （桌子画在前面，挡住腰以下）。只认角色和三种样子，不读编辑部状态：
//   idle    没活：衣服褪成灰，眯着眼，不动
//   busy    有活但定格（任务停下、跑完）：上色、睁眼，不动
//   moving  有活在干：上色、眨眼、各自的手上动作
// 三个人靠打扮和手上的东西区分：
//   通读员  盘发、开衫，捧着一本摊开的书，书页翻动
//   译者    乱发、戴耳机、连帽衫，两手在键盘上敲
//   审校    侧分短发、圆眼镜、马甲领带，一手放大镜来回扫、一手红笔
// 颜色全走 CSS 变量（cast.css），跟着皮肤换。

export type PersonRole = "reader" | "translator" | "reviewer";
export type ActorPose = "idle" | "busy" | "moving";

function Hair({ role }: { role: PersonRole }) {
  if (role === "reader") {
    return (
      <g className="office-cast-hair">
        <path d="M22.5 17 Q22 7.5 32 7 Q42 7.5 41.5 17 Q39 11.5 32 12 Q26 11.5 22.5 17 Z" />
        <circle cx="32" cy="5.2" r="3.6" />
        <path d="M22.5 16 Q21 22 23 25 L24.5 18 Z M41.5 16 Q43 22 41 25 L39.5 18 Z" />
      </g>
    );
  }
  if (role === "translator") {
    return (
      <g className="office-cast-hair">
        <path d="M22.5 17.5 Q21.5 8 31 7.5 Q34 5.5 36 7.5 Q42.5 8.5 41.5 17.5 Q39.5 12 36 13 L34 11 L31.5 13 L28 11.5 Q25 13 22.5 17.5 Z" />
      </g>
    );
  }
  return (
    <g className="office-cast-hair">
      <path d="M22.5 16.5 Q22.5 7.5 32 7.5 Q41.5 7.5 41.5 16.5 Q40 12 35 11.5 Q31 11 28 12.5 Q25 13.5 22.5 16.5 Z" />
      <path className="office-cast-parting" d="M28 8.5 Q29 11 28 12.5" />
    </g>
  );
}

function Face({ role }: { role: PersonRole }) {
  return (
    <g className="office-cast-face">
      <g className="office-cast-eyes">
        <ellipse className="office-cast-eye" cx="28.3" cy="19" rx="1.25" ry="1.6" />
        <ellipse className="office-cast-eye" cx="35.7" cy="19" rx="1.25" ry="1.6" />
        <path className="office-cast-eye-shut office-cast-stroke" d="M26.8 19.4 Q28.3 20.4 29.8 19.4 M34.2 19.4 Q35.7 20.4 37.2 19.4" />
      </g>
      <circle className="office-cast-blush" cx="25.6" cy="22.4" r="1.7" />
      <circle className="office-cast-blush" cx="38.4" cy="22.4" r="1.7" />
      <path className="office-cast-stroke" d="M30 23.6 Q32 25.2 34 23.6" />
      {role === "reviewer" ? (
        <g className="office-cast-glasses office-cast-stroke">
          <circle cx="28.3" cy="19" r="3.1" />
          <circle cx="35.7" cy="19" r="3.1" />
          <path d="M31.4 19 h1.2 M25.2 18.4 L23 17.6 M38.8 18.4 L41 17.6" />
        </g>
      ) : null}
    </g>
  );
}

function Outfit({ role }: { role: PersonRole }) {
  return (
    <g className="office-cast-outfit">
      <path className="office-cast-cloth office-cast-stroke" d="M16.5 62 Q15.5 39 24 34 Q32 31 40 34 Q48.5 39 47.5 62 Z" />
      <path className="office-cast-cloth-shade" d="M38 33.5 Q47.5 38 47.5 62 L41 62 Q42.5 44 38 33.5 Z" />
      {role === "reader" ? (
        // 开衫：领口、门襟、两颗扣子
        <g className="office-cast-trim office-cast-stroke">
          <path d="M28 32.5 L32 41 L36 32.5" />
          <path d="M32 41 L32 62" />
          <circle className="office-cast-stud" cx="32" cy="46" r="0.9" />
          <circle className="office-cast-stud" cx="32" cy="52" r="0.9" />
        </g>
      ) : null}
      {role === "translator" ? (
        // 连帽衫：帽子搭在肩后，两根抽绳
        <g className="office-cast-trim office-cast-stroke">
          <path className="office-cast-hood" d="M23.5 35 Q32 41 40.5 35 Q38 31 32 31 Q26 31 23.5 35 Z" />
          <path d="M29.5 37.5 L29 44 M34.5 37.5 L35 44" />
        </g>
      ) : null}
      {role === "reviewer" ? (
        // 衬衫领、马甲、领带
        <g className="office-cast-trim office-cast-stroke">
          <path className="office-cast-shirt" d="M27.5 32.5 L32 38 L36.5 32.5 L34.5 31.5 L32 33 L29.5 31.5 Z" />
          <path className="office-cast-tie" d="M31 37 L33 37 L34 47 L32 49.5 L30 47 Z" />
          <path d="M25 36 L30 50 M39 36 L34 50" />
        </g>
      ) : null}
    </g>
  );
}

function Hands({ role }: { role: PersonRole }) {
  if (role === "reader") {
    // 捧着摊开的书，书页会翻
    return (
      <g className="office-cast-hands">
        <path className="office-cast-arm office-cast-stroke" d="M21 40 Q17 47 21.5 51 M43 40 Q47 47 42.5 51" />
        <g className="office-cast-book">
          <path className="office-cast-paper office-cast-stroke" d="M20 44 L32 47 L44 44 L44 54 L32 57 L20 54 Z" />
          <path className="office-cast-stroke office-cast-ink" d="M32 47 L32 57 M22.5 47.5 L29 49 M22.5 50.5 L29 52 M35 49 L41.5 47.5 M35 52 L41.5 50.5" />
          <path className="office-cast-page office-cast-paper office-cast-stroke" d="M32 47 L42 44.6 L42 53.6 L32 57 Z" />
        </g>
        <circle className="office-cast-skin office-cast-stroke" cx="21.5" cy="51.5" r="2.4" />
        <circle className="office-cast-skin office-cast-stroke" cx="42.5" cy="51.5" r="2.4" />
      </g>
    );
  }
  if (role === "translator") {
    // 两手伸到键盘上，轮流敲
    return (
      <g className="office-cast-hands">
        <path className="office-cast-arm office-cast-stroke" d="M21 40 Q18 50 25 57 M43 40 Q46 50 39 57" />
        <circle className="office-cast-skin office-cast-stroke office-cast-tap is-left" cx="25.5" cy="57.5" r="2.4" />
        <circle className="office-cast-skin office-cast-stroke office-cast-tap is-right" cx="38.5" cy="57.5" r="2.4" />
      </g>
    );
  }
  // 右手放大镜来回扫，左手红笔
  return (
    <g className="office-cast-hands">
      <path className="office-cast-arm office-cast-stroke" d="M21 40 Q17 49 23 55" />
      <path className="office-cast-pen" d="M22 56 L27.5 50" />
      <circle className="office-cast-skin office-cast-stroke" cx="23" cy="55.5" r="2.4" />
      <g className="office-cast-lens">
        <path className="office-cast-arm office-cast-stroke" d="M43 40 Q48 45 45 50" />
        <path className="office-cast-handle" d="M45 50 L41.5 45.5" />
        <circle className="office-cast-glass office-cast-stroke" cx="39" cy="42.5" r="4.6" />
        <path className="office-cast-glint" d="M36.6 41 Q37.4 39.6 39 39.3" />
        <circle className="office-cast-skin office-cast-stroke" cx="45" cy="50.5" r="2.4" />
      </g>
    </g>
  );
}

export function Person({ role, pose }: { role: PersonRole; pose: ActorPose }) {
  return (
    <g className={`office-cast is-person is-${role} is-${pose}`} data-office-actor={role} data-office-pose={pose}>
      <g className="office-cast-body">
        <Outfit role={role} />
        <path className="office-cast-skin office-cast-stroke" d="M29 27.5 L29 32.5 Q32 34 35 32.5 L35 27.5 Z" />
        <g className="office-cast-head">
          {role === "translator" ? <path className="office-cast-headband office-cast-stroke" d="M21.5 19 Q21 6.5 32 6 Q43 6.5 42.5 19" /> : null}
          <circle className="office-cast-skin office-cast-stroke" cx="22.6" cy="19.5" r="2.1" />
          <circle className="office-cast-skin office-cast-stroke" cx="41.4" cy="19.5" r="2.1" />
          <circle className="office-cast-skin office-cast-stroke" cx="32" cy="18.5" r="9.6" />
          <Hair role={role} />
          <Face role={role} />
          {role === "translator" ? (
            <g className="office-cast-phones">
              <rect className="office-cast-stroke" x="19" y="15.5" width="4.6" height="8" rx="2.2" />
              <rect className="office-cast-stroke" x="40.4" y="15.5" width="4.6" height="8" rx="2.2" />
            </g>
          ) : null}
        </g>
        <Hands role={role} />
      </g>
    </g>
  );
}
