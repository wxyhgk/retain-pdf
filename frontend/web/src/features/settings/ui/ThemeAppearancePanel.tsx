// 设置 · 外观：主题皮肤切换（注册表驱动，后期加皮肤无需改本文件）
// 真值：html[data-theme] + localStorage（shared/theme）
// 字体：渲染字体族（request.render.typst_font_family），持久化至 localStorage 并在创建任务时注入

import { useEffect, useState } from "react";
import { cn } from "@/ui/lib/utils";
import {
  getTheme,
  listThemesBySeries,
  setTheme,
  type ThemeId,
} from "@/ui/theme/theme.js";
import {
  getStoredFontFamily,
  setStoredFontFamily,
  RENDER_FONT_STORAGE_KEY,
} from "../domain/render-font.js";
import { listFonts, type FontInfo } from "@retainpdf/api/fonts";
import { API_PREFIX } from "@/platform/config/api-constants.js";

const FALLBACK_FONTS: FontInfo[] = [
  { family: "Source Han Serif SC", files: [], available: true },
  { family: "Source Han Sans SC", files: [], available: true },
];

function FontSelector() {
  const [fonts, setFonts] = useState<FontInfo[]>(FALLBACK_FONTS);
  const [selected, setSelected] = useState<string>(() => getStoredFontFamily());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const list = await listFonts(API_PREFIX);
        if (cancelled) return;
        const normalized = Array.isArray(list) && list.length ? list : FALLBACK_FONTS;
        // Ensure selected family is present even if backend didn't return it
        const families = new Set(normalized.map((f) => f.family));
        if (!families.has(selected)) {
          // Keep selected in list so dropdown can display persisted value even before fetch
          normalized.unshift({ family: selected, files: [], available: true });
          // Deduplicate
          const seen = new Set<string>();
          const deduped: FontInfo[] = [];
          for (const f of normalized) {
            if (!seen.has(f.family)) {
              seen.add(f.family);
              deduped.push(f);
            }
          }
          setFonts(deduped);
        } else {
          setFonts(normalized);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : `${e}`);
        setFonts((prev) => (prev.length ? prev : FALLBACK_FONTS));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Sync if another tab/window changed font
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent<{ family?: string }>;
      const next = custom.detail?.family || getStoredFontFamily();
      setSelected(next);
    };
    window.addEventListener("retainpdf:render-font-change" as unknown as string, handler as EventListener);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === RENDER_FONT_STORAGE_KEY && e.newValue) setSelected(e.newValue);
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("retainpdf:render-font-change" as unknown as string, handler as EventListener);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  function handleChange(value: string) {
    const next = `${value || ""}`.trim();
    if (!next) return;
    setStoredFontFamily(next);
    setSelected(next);
  }

  return (
    <div className="font-selector" id="font-selector" data-testid="font-selector">
      <h3 className="theme-appearance-group-title">渲染字体</h3>
      <p className="text-xs text-neutral-500" style={{ margin: "4px 0 8px" }}>
        用于 Typst 渲染的正文字体族（request.render.typst_font_family），随下次新建任务生效。
      </p>
      <label htmlFor="typst-font-family-select" className="sr-only">
        渲染字体
      </label>
      <select
        id="typst-font-family-select"
        data-testid="typst-font-family-select"
        name="typst_font_family"
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-paper px-3 py-2 text-sm text-ink shadow-sm focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
        disabled={loading && fonts.length === 0}
      >
        {fonts.map((f) => (
          <option key={f.family} value={f.family}>
            {f.family}
            {f.available ? "" : " (不可用)"}
          </option>
        ))}
      </select>
      {loading ? <span className="text-xs text-neutral-400">加载字体列表…</span> : null}
      {error ? <span className="text-xs text-amber-600">字体列表加载失败，已显示本地备选：{error}</span> : null}
      <span className="text-xs text-neutral-400">已选：{selected}</span>
    </div>
  );
}

export function ThemeAppearancePanel() {
  const [active, setActive] = useState<ThemeId>(() => getTheme());
  // 按产品系列分区（基础/诸子百家/王朝/二次元…），系列注册表见
  // shared/theme/registry.ts 的 THEME_SERIES——新系列加一行即出新分区
  const groups = listThemesBySeries();

  useEffect(() => {
    setActive(getTheme());
  }, []);

  function choose(id: ThemeId) {
    setTheme(id);
    setActive(id);
  }

  return (
    <div className="theme-appearance" id="theme-appearance-panel">
      {/* 说明文案由设置面板的 pane-head 承担，此处不再重复 hint */}
      {groups.map(({ series, label, themes }) => (
        <div key={series} className="theme-appearance-group" data-theme-series={series}>
          <h3 className="theme-appearance-group-title">{label}</h3>
          <div
            className="theme-appearance-grid"
            role="radiogroup"
            aria-label={`${label}主题`}
          >
            {themes.map((meta) => {
              const swatch = meta.preview;
              const selected = active === meta.id;
              // className 用 cn + 纯字面量：v4 扫描器提不出 `x${y}` 模板里的
              // 类名（tailwind-theme.css 头注释记录的坑，theme-option 曾因此
              // 整条 @utility 静默丢失）
              return (
                <button
                  key={meta.id}
                  id={`theme-option-${meta.id}`}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn("theme-option", selected && "is-selected")}
                  data-theme-option={meta.id}
                  data-theme-group={meta.group}
                  onClick={() => choose(meta.id)}
                >
                  <span
                    className="theme-option-swatch"
                    style={{ background: swatch.bg }}
                    aria-hidden="true"
                  >
                    <span
                      className="theme-option-swatch-paper"
                      style={{ background: swatch.paper }}
                    >
                      <span
                        className="theme-option-swatch-bar"
                        style={{ background: swatch.accent }}
                      />
                      <span
                        className="theme-option-swatch-line"
                        style={{ background: swatch.ink }}
                      />
                      <span
                        className="theme-option-swatch-line-short"
                        style={{ background: swatch.ink }}
                      />
                    </span>
                    <span
                      className="theme-option-swatch-dot"
                      style={{ background: swatch.danger }}
                    />
                  </span>
                  <span className="theme-option-copy">
                    <strong>{meta.label}</strong>
                    <span>{meta.description}</span>
                  </span>
                  {selected ? (
                    <span className="theme-option-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="theme-appearance-group" data-theme-series="font">
        <FontSelector />
      </div>
    </div>
  );
}
