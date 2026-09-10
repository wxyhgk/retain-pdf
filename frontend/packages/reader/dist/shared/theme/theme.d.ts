import { type ThemeId } from "./registry.js";
export { DEFAULT_THEME_ID, THEME_STORAGE_KEY, THEME_REGISTRY, THEME_SERIES, getThemeDefinition, isThemeId, listThemes, listThemesByGroup, listThemesBySeries, themeGroupLabel, type ThemeDefinition, type ThemeGroup, type ThemeId, type ThemePreview, type ThemeSeries, } from "./registry.js";
/** 兼容旧 import 名 */
export declare const THEME_IDS: string[];
export declare const THEME_META: {
    [k: string]: {
        id: string;
        label: string;
        description: string;
    };
};
export declare const THEME_CHANGE_EVENT = "retainpdf:theme-change";
export declare function getStoredTheme(): ThemeId;
export declare function getTheme(): ThemeId;
/** 写入 storage + <html data-theme>，并广播事件 */
export declare function setTheme(theme: ThemeId): string;
/** 入口最顶部调用，减少换肤 FOUC */
export declare function bootTheme(): string;
//# sourceMappingURL=theme.d.ts.map