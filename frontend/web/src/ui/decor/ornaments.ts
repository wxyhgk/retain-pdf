// 装饰位（ornament）白名单：任何主题都能在这些界面位置挂一张小图。
//
// 和 slots.ts 的区别：slots 是整页装饰舞台上的锚点（DecorStage 画在页面背后/边缘）；
// ornament 是挂在具体组件上的小图，组件里放一个
//   <span class="theme-ornament" data-ornament="<名字>" aria-hidden="true" />
// 不设图时不显示、不占位（样式 packages/ui/styles/ornaments.css）。
//
// 新增装饰位 = 这里登记 + ornaments.css 补一条显示规则 + 组件里放钩子；
// tests/shared/decor-ornaments.test.mjs 会核对三处对得上。
// 设计与写法：docs/core/frontend/theme-system/DECOR_PACKS.md「装饰位（ornaments）」

export type OrnamentDefinition = {
  /** manifest.ornaments 的键，也是 data-ornament 的值 */
  id: string;
  /** 挂在哪个组件上（文档用） */
  where: string;
  /** 建议尺寸 px；null = 铺满宿主（不接受 width/height） */
  size: { width: number; height: number } | null;
  /** 默认定位（文档用，真值在 ornaments.css） */
  placement: string;
  /** 可以用 hideIcon 换掉宿主原有图标 / 底板 */
  canHideIcon: boolean;
  /** 宿主可悬停（按钮、页签），支持 hover 动效 */
  canHover: boolean;
};

export const ORNAMENTS: readonly OrnamentDefinition[] = [
  {
    id: "library-title",
    where: "书库标题「全部书库」右边（LibraryToolbar）",
    size: { width: 28, height: 28 },
    placement: "跟在标题后，垂直居中",
    canHideIcon: false,
    canHover: false,
  },
  {
    id: "dialog-corner",
    where: "所有弹窗的右上角（@retainpdf/ui 的 DialogContent）",
    size: { width: 56, height: 56 },
    placement: "弹窗右上角，向外探出 4px，在关闭钮下面",
    canHideIcon: false,
    canHover: false,
  },
  {
    id: "empty-state",
    where: "空状态插画（EmptyState），在原仪器图标上方",
    size: { width: 96, height: 96 },
    placement: "居中；hideIcon 时整块换掉仪器图标",
    canHideIcon: true,
    canHover: false,
  },
  {
    id: "cover-placeholder",
    where: "没有封面的书卡的占位图（BookCardCover）",
    size: null,
    placement: "铺满封面区（cover）；hideIcon 时藏掉灰底里的 PDF 图标",
    canHideIcon: true,
    canHover: false,
  },
  {
    id: "bottom-add",
    where: "底栏「添加 PDF」按钮（AppBottomBar）",
    size: { width: 46, height: 46 },
    placement: "按钮正中；hideIcon 时去掉按钮的底、描边和阴影，整颗换成这张图",
    canHideIcon: true,
    canHover: true,
  },
  {
    id: "bottom-tasks",
    where: "底栏「任务中心」按钮",
    size: { width: 46, height: 46 },
    placement: "同 bottom-add",
    canHideIcon: true,
    canHover: true,
  },
  {
    id: "bottom-guide",
    where: "底栏「使用说明」按钮",
    size: { width: 46, height: 46 },
    placement: "同 bottom-add",
    canHideIcon: true,
    canHover: true,
  },
  {
    id: "bottom-settings",
    where: "底栏「设置」按钮",
    size: { width: 46, height: 46 },
    placement: "同 bottom-add",
    canHideIcon: true,
    canHover: true,
  },
  {
    id: "top-tab-library",
    where: "顶栏「图书馆」页签（LibraryTopTabs）",
    size: { width: 24, height: 24 },
    placement: "页签左侧图标位；hideIcon 时藏掉原图标",
    canHideIcon: true,
    canHover: true,
  },
  {
    id: "top-tab-collections",
    where: "顶栏「合集」页签",
    size: { width: 24, height: 24 },
    placement: "同 top-tab-library",
    canHideIcon: true,
    canHover: true,
  },
  {
    id: "book-cover-tape",
    where: "书卡封面顶边的纸胶带（元素由书架放在封面区里）",
    size: { width: 64, height: 22 },
    placement: "封面顶边正中，微微倾斜，压在封面上",
    canHideIcon: false,
    canHover: false,
  },
  {
    id: "reader-bar-left",
    where: "阅读器顶栏左端（ReaderWorkspaceTabs）",
    size: { width: 40, height: 40 },
    placement: "顶栏左侧「目录」按钮右边，垂直居中；≤ 720px 不显示",
    canHideIcon: false,
    canHover: false,
  },
  {
    id: "reader-bar-right",
    where: "阅读器顶栏右端",
    size: { width: 40, height: 40 },
    placement: "顶栏右侧「下载 / 关闭」托盘左边，垂直居中；≤ 720px 不显示",
    canHideIcon: false,
    canHover: false,
  },
] as const;

export type OrnamentId = (typeof ORNAMENTS)[number]["id"];

const ORNAMENT_MAP: ReadonlyMap<string, OrnamentDefinition> = new Map(
  ORNAMENTS.map((o) => [o.id, o]),
);

export function getOrnament(id: string): OrnamentDefinition | undefined {
  return ORNAMENT_MAP.get(id);
}

export function isOrnamentId(value: unknown): value is OrnamentId {
  return typeof value === "string" && ORNAMENT_MAP.has(value);
}

/** 悬停动效：写进 manifest 的是名字，不是 CSS（用户写不了任意 transform）。 */
export const ORNAMENT_HOVERS = {
  rotate: "rotate(45deg)",
  lift: "translateY(-2px)",
} as const;

export type OrnamentHover = keyof typeof ORNAMENT_HOVERS;
