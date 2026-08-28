// Runtime API cho giao diện chủ đề
// Registry: ./registry.ts · Tài liệu: docs/theme-system/

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

/** Tương thích với tên import cũ */
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

/** Ghi vào storage + <html data-theme> và phát sự kiện */
export function setTheme(theme: ThemeId) {
  const next = isThemeId(theme) ? theme : DEFAULT_THEME_ID;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = next;
    // Giao diện tối có thể gán class cho body để các component đặc thù dễ dàng viết style .theme-dark
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

/** Gọi ở đầu entry để giảm FOUC khi đổi skin */
export function bootTheme() {
  return setTheme(getStoredTheme());
}
