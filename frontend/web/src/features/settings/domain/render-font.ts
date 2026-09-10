// Render font family persistence (typst_font_family)
// Stores selected font family in localStorage, defaults to workflow default.
import { DEFAULT_TYPST_FONT_FAMILY } from "@/platform/config/workflow-defaults.js";

export const RENDER_FONT_STORAGE_KEY = "retainpdf.render.typst_font_family";
export const RENDER_FONT_CHANGE_EVENT = "retainpdf:render-font-change";

export function getStoredFontFamily(): string {
  if (typeof localStorage === "undefined") return DEFAULT_TYPST_FONT_FAMILY;
  try {
    const raw = `${localStorage.getItem(RENDER_FONT_STORAGE_KEY) || ""}`.trim();
    if (raw) return raw;
  } catch {}
  return DEFAULT_TYPST_FONT_FAMILY;
}

export function getFontFamily(): string {
  return getStoredFontFamily();
}

export function setStoredFontFamily(family: string): string {
  const normalized = `${family || ""}`.trim() || DEFAULT_TYPST_FONT_FAMILY;
  try {
    localStorage.setItem(RENDER_FONT_STORAGE_KEY, normalized);
  } catch {}
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(RENDER_FONT_CHANGE_EVENT, { detail: { family: normalized } }));
    } catch {}
  }
  return normalized;
}

export function isValidFontFamily(value: unknown): boolean {
  return typeof value === "string" && `${value}`.trim().length > 0;
}
