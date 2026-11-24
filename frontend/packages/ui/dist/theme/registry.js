// 主题注册表：后期加皮肤 = 追加一项 + 对应 CSS 文件。
// 组件只读 listThemes() / setTheme()，不要 hardcode 皮肤 id 列表。
// 设计：docs/core/frontend/theme-system/THEME_SYSTEM.md · ADDING_A_THEME.md
// 网页和阅读器共用这一份（2026-11-24 起；以前阅读器包里复制了一份，两边会漂）。
/** 当前皮肤 id 存在 localStorage 的键。网页和阅读页同源，靠它共享同一个皮肤。 */
export const THEME_STORAGE_KEY = "retainpdf.theme";
export const DEFAULT_THEME_ID = "classic";
export const THEME_SERIES = [
    { id: "base", label: "基础", order: 10 },
    { id: "baijia", label: "诸子百家", order: 20 },
    // 规划中：{ id: "wangchao", label: "王朝", order: 30 },
    //         { id: "niji", label: "二次元", order: 40 },
];
/**
 * 注册表真值。
 * 新增皮肤步骤见 docs/core/frontend/theme-system/ADDING_A_THEME.md
 */
export const THEME_REGISTRY = [
    {
        id: "classic",
        label: "经典",
        description: "黑白灰克制，默认观感",
        group: "light",
        order: 10,
        preview: {
            bg: "#f5f5f7",
            paper: "#ffffff",
            accent: "#1d1d1f",
            ink: "#1d1d1f",
            danger: "#ff3b30",
        },
    },
    {
        id: "jiangnan",
        label: "素纸",
        description: "冷石灰底 · 冷青绿强调（去土黄）",
        group: "accent",
        order: 20,
        decorPack: "jiangnan",
        preview: {
            bg: "#f1f0ed",
            paper: "#fbfaf8",
            accent: "#2a5f57",
            ink: "#1b1b1d",
            danger: "#c23b32",
        },
    },
    {
        id: "mojia",
        label: "墨家",
        description: "素绢暖底 · 青铜机关",
        group: "accent",
        order: 25,
        decorPack: "mojia",
        series: "baijia",
        preview: {
            bg: "#f2efe8",
            paper: "#faf8f1",
            accent: "#4c6658",
            ink: "#26221b",
            danger: "#b23b32",
        },
    },
    {
        id: "seacliff",
        label: "雾青",
        description: "冷灰蓝底 · 青灰强调",
        group: "accent",
        order: 30,
        preview: {
            bg: "#eef1f4",
            paper: "#f8f9fb",
            accent: "#2d5f6e",
            ink: "#1a1d21",
            danger: "#c23b32",
        },
    },
    {
        id: "night",
        label: "黛瓦夜色",
        description: "深底阅读 · 黛瓦墨黑",
        group: "dark",
        order: 40,
        preview: {
            bg: "#141618",
            paper: "#1e2226",
            accent: "#5aa88e",
            ink: "#e8e6e3",
            danger: "#e07068",
        },
    },
];
const GROUP_LABEL = {
    light: "浅色",
    dark: "深色",
    accent: "意境",
};
export function themeGroupLabel(group) {
    return GROUP_LABEL[group] || group;
}
export function listThemes() {
    return [...THEME_REGISTRY].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
export function listThemesByGroup() {
    const order = ["light", "accent", "dark"];
    const map = new Map();
    for (const t of listThemes()) {
        const list = map.get(t.group) || [];
        list.push(t);
        map.set(t.group, list);
    }
    return order
        .filter((g) => (map.get(g) || []).length > 0)
        .map((group) => ({
        group,
        label: themeGroupLabel(group),
        themes: map.get(group) || [],
    }));
}
/**
 * 按系列分组（外观面板消费）：系列按 THEME_SERIES.order 排，
 * 未登记 series 的皮肤归入 "base"；空系列不出现。
 */
export function listThemesBySeries() {
    const map = new Map();
    for (const t of listThemes()) {
        const key = t.series && THEME_SERIES.some((s) => s.id === t.series) ? t.series : "base";
        const list = map.get(key) || [];
        list.push(t);
        map.set(key, list);
    }
    return [...THEME_SERIES]
        .sort((a, b) => a.order - b.order)
        .filter((s) => (map.get(s.id) || []).length > 0)
        .map((s) => ({ series: s.id, label: s.label, themes: map.get(s.id) || [] }));
}
export function getThemeDefinition(id) {
    return THEME_REGISTRY.find((t) => t.id === id);
}
export function isThemeId(value) {
    return typeof value === "string" && THEME_REGISTRY.some((t) => t.id === value);
}
//# sourceMappingURL=registry.js.map