// 主题皮肤运行时 API
// 注册表：./registry.ts · 文档：docs/core/frontend/theme-system/

import {
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  getThemeDefinition,
  isThemeId,
  listThemes,
  listThemesByGroup,
  type ThemeId,
} from "./registry.js";

export {
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  THEME_REGISTRY,
  THEME_SERIES,
  getThemeDefinition,
  isThemeId,
  listThemes,
  listThemesByGroup,
  listThemesBySeries,
  themeGroupLabel,
  type ThemeDefinition,
  type ThemeGroup,
  type ThemeId,
  type ThemePreview,
  type ThemeSeries,
} from "./registry.js";

/** 兼容旧 import 名 */
export const THEME_IDS = listThemes().map((t) => t.id);
export const THEME_META = Object.fromEntries(
  listThemes().map((t) => [t.id, { id: t.id, label: t.label, description: t.description }]),
);

export const THEME_CHANGE_EVENT = "retainpdf:theme-change";

export function getStoredTheme(): ThemeId {
  if (typeof localStorage === "undefined") return DEFAULT_THEME_ID;
  try {
    const raw = `${localStorage.getItem(THEME_STORAGE_KEY) || ""}`.trim();
    if (isThemeId(raw)) return raw;
  } catch {
    /* private mode */
  }
  return DEFAULT_THEME_ID;
}

export function getTheme(): ThemeId {
  if (typeof document !== "undefined") {
    const fromDom = document.documentElement.dataset.theme;
    if (isThemeId(fromDom)) return fromDom;
  }
  return getStoredTheme();
}

/** 写入 storage + <html data-theme>，并广播事件 */
export function setTheme(theme: ThemeId) {
  const next = isThemeId(theme) ? theme : DEFAULT_THEME_ID;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = next;
    // 深色皮肤可给 body 一个 class，方便个别组件写 .theme-dark 特例
    const def = getThemeDefinition(next);
    document.documentElement.dataset.themeGroup = def?.group || "light";
    document.documentElement.classList.toggle("theme-dark", def?.group === "dark");
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme: next } }),
      );
    } catch {
      /* ignore */
    }
  }
  return next;
}

/** 入口最顶部调用，减少换肤 FOUC（每 entry 只调一次，先于 createRoot） */
let booted = false;
export function bootTheme() {
  if (booted) return getTheme();
  booted = true;
  return setTheme(getStoredTheme());
}
