// 装饰锚点（slot）注册表：装饰主题的"布局契约"。
//
// 设计原则（docs/core/frontend/theme-system/DECOR_PACKS.md）：
// - 功能 UI 永远是 DOM；装饰层只能挂在下列具名锚点上，不得自造坐标。
// - manifest 声明"资产挂在哪个 slot"，slot 在哪、多大、什么层级由
//   舞台 CSS（后续 DecorStage）统一实现——资产侧与布局侧解耦。
// - 新增锚点 = 此处登记 + 舞台 CSS 补一条定位；manifest 校验自动放行。
//
// 层级带（z-index band，具体数值由舞台 CSS 统一分配）：
//   bg  < 功能 UI 背板 < mid < 功能 UI 内容 …之外的边缘 < fg
//   bg  全幅背景（山水/园林/草原），永远被 UI 面板盖住
//   mid 中景道具（人物/铜鼎/马），可被 UI 面板局部遮挡
//   fg  前景压边（花枝/龙雕探进 UI 边缘），pointer-events: none

export type DecorLayerBand = "bg" | "mid" | "fg";

export type DecorSlotDefinition = {
  /** manifest.layers[].slot 引用的 id */
  id: string;
  band: DecorLayerBand;
  /** 大致区域（百分比语义仅作文档提示，真值在舞台 CSS） */
  area: string;
  /** true = 允许压到功能 UI 边缘之上（仅 fg 带可为 true） */
  overUi: boolean;
  /** true = 该 slot 支持竖排/横排文字（题字横幅） */
  textCapable?: boolean;
};

/**
 * 锚点真值表。围绕中央书库面板一圈 + 全幅背景 + 题字位。
 * 三张概念稿（国风/园林/草原）的装饰元素都能映射进这套锚点。
 */
export const DECOR_SLOTS: readonly DecorSlotDefinition[] = [
  { id: "backdrop", band: "bg", area: "全屏 100%×100%", overUi: false },

  // 左右两翼：概念稿里的人物、龙雕、瓷瓶、马匹、鹰架
  { id: "left-top", band: "mid", area: "左上 0~25% × 0~40%", overUi: false },
  { id: "left-bottom", band: "mid", area: "左下 0~25% × 55~100%", overUi: false },
  { id: "right-top", band: "mid", area: "右上 75~100% × 0~40%", overUi: false },
  { id: "right-bottom", band: "mid", area: "右下 75~100% × 55~100%", overUi: false },

  // 顶部中央：导航上方的拱形饰件/蝴蝶/飞鸟
  { id: "top-center", band: "mid", area: "顶部 30~70% × 0~12%", overUi: false },

  // 主角位：顶部横幅区的人物（三张概念稿的看书少女/少年）
  { id: "hero", band: "mid", area: "顶部横幅区 40~70% × 10~30%", overUi: false },

  // 前景压边：探进面板边缘的花枝、璎珞、流苏
  { id: "edge-left", band: "fg", area: "左缘 0~12% × 全高", overUi: true },
  { id: "edge-right", band: "fg", area: "右缘 88~100% × 全高", overUi: true },

  // 右下前景位：right-bottom 的 fg 版——需要人物/道具压在面板之上的场合
  { id: "right-bottom-fg", band: "fg", area: "右下 75~100% × 55~100%", overUi: true },

  // 题字横幅（"知其所来 明其所往"）：竖排文字位
  { id: "quote", band: "mid", area: "右上 82~98% × 5~35%", overUi: false, textCapable: true },
] as const;

export type DecorSlotId = (typeof DECOR_SLOTS)[number]["id"];

const SLOT_MAP: ReadonlyMap<string, DecorSlotDefinition> = new Map(
  DECOR_SLOTS.map((s) => [s.id, s]),
);

export function getDecorSlot(id: string): DecorSlotDefinition | undefined {
  return SLOT_MAP.get(id);
}

export function isDecorSlotId(value: unknown): value is DecorSlotId {
  return typeof value === "string" && SLOT_MAP.has(value);
}
