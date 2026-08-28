// Cài đặt · Ngoại quan: chuyển skin chủ đề (registry-driven, sau này thêm skin không cần sửa
// file này)
// Giá trị thật: html[data-theme] + localStorage (shared/theme)

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getTheme,
  listThemesBySeries,
  setTheme,
  type ThemeId,
} from "../../../../shared/theme/theme.js";

export function ThemeAppearancePanel() {
  const [active, setActive] = useState<ThemeId>(() => getTheme());
  // Phân vùng theo dòng sản phẩm (cơ bản / các trường phái / triều đại / anime ...), bảng
  // đăng ký dòng xem THEME_SERIES của shared/theme/registry.ts — thêm dòng mới là ra
  // phân vùng mới
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
      {/* Pane-head của bảng cài đặt đã chứa mô tả, không lặp lại hint tại đây. */}
      {groups.map(({ series, label, themes }) => (
        <div key={series} className="theme-appearance-group" data-theme-series={series}>
          <h3 className="theme-appearance-group-title">{label}</h3>
          <div
            className="theme-appearance-grid"
            role="radiogroup"
            aria-label={`Chủ đề ${label}`}
          >
            {themes.map((meta) => {
              const swatch = meta.preview;
              const selected = active === meta.id;
              // className dùng cn + thuần literal: máy quét v4 không rút được tên class
              // trong template `x${y}` (cái bẫy ghi ở đầu tailwind-theme.css, cả
              // @utility theme-option từng bị thất lạc âm thầm vì vậy)
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
    </div>
  );
}
