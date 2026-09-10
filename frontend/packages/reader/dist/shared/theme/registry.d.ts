export declare const THEME_STORAGE_KEY = "retainpdf.theme";
export declare const DEFAULT_THEME_ID = "classic";
/** 设置页色块预览（与 CSS 皮肤主色一致，仅用于 UI 缩略） */
export type ThemePreview = {
    bg: string;
    paper: string;
    accent: string;
    ink: string;
    danger: string;
};
export type ThemeGroup = "light" | "dark" | "accent";
/**
 * 主题系列（产品线维度，与明暗 group 正交）：
 * 诸子百家 / 王朝 / 二次元……皮肤挂 series 字段归队，
 * 新系列 = 此表加一行，外观面板自动出现新分区。
 */
export type ThemeSeries = {
    id: string;
    label: string;
    /** 分区排序，越小越靠前 */
    order: number;
};
export declare const THEME_SERIES: readonly ThemeSeries[];
export type ThemeDefinition = {
    /** 与 html[data-theme] / 文件名 themes/<id>.css 一致 */
    id: string;
    label: string;
    description: string;
    /** 设置页分组 */
    group: ThemeGroup;
    /** 列表排序，越小越靠前 */
    order: number;
    preview: ThemePreview;
    /**
     * 装饰包名（public 静态目录 decor/<包名>/manifest.json）。
     * 缺省 = 纯配色皮肤，零装饰零额外下载。
     * 契约：src/shared/decor/contract.ts · docs/core/frontend/theme-system/DECOR_PACKS.md
     */
    decorPack?: string;
    /** 所属系列 id（THEME_SERIES），缺省归入 "base" 基础系列 */
    series?: string;
};
/**
 * 注册表真值。
 * 新增皮肤步骤见 docs/core/frontend/theme-system/ADDING_A_THEME.md
 */
export declare const THEME_REGISTRY: readonly ThemeDefinition[];
export type ThemeId = (typeof THEME_REGISTRY)[number]["id"] | string;
export declare function themeGroupLabel(group: ThemeGroup): string;
export declare function listThemes(): ThemeDefinition[];
export declare function listThemesByGroup(): {
    group: ThemeGroup;
    label: string;
    themes: ThemeDefinition[];
}[];
/**
 * 按系列分组（外观面板消费）：系列按 THEME_SERIES.order 排，
 * 未登记 series 的皮肤归入 "base"；空系列不出现。
 */
export declare function listThemesBySeries(): {
    series: string;
    label: string;
    themes: ThemeDefinition[];
}[];
export declare function getThemeDefinition(id: string): ThemeDefinition | undefined;
export declare function isThemeId(value: unknown): value is string;
//# sourceMappingURL=registry.d.ts.map