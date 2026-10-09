/** 混合页码输入：`1-5, 8, 12-14`。翻译和 OCR 两处共用。
 *
 * 原来是起、止两个数字框，只能表达连续区间。改成单个文本框，是因为「只翻某几页」
 * 常常不连续 —— 摘要 + 第 3 章 + 附录里的某张表。
 *
 * **实时预览**是这个组件存在的主要理由：混合格式不是人人都熟，敲的时候就看到
 * 「共 9 页」或者「「5-3」起止颠倒了，应写成 3-5」，比提交之后才报错好得多。
 * 解析和提交用的是同一个 `parsePageSelection`，所以预览说的就是会提交的。
 */
import { useMemo } from "react";

import { parsePageSelection } from "@/features/library/domain.js";

export type PageSpecInputProps = {
  value: string;
  pageCount?: number | null;
  onChange: (value: string) => void;
  /** 给不同位置的输入框各自的 aria 标签，屏幕阅读器分得清是翻译还是 OCR。 */
  label?: string;
  id?: string;
};

export function PageSpecInput({ value, pageCount, onChange, label = "页码", id }: PageSpecInputProps) {
  const preview = useMemo(
    () => (pageCount ? parsePageSelection(value, pageCount) : null),
    [value, pageCount],
  );
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value}
          aria-label={label}
          aria-invalid={preview ? !preview.ok : undefined}
          placeholder="如 1-5, 8, 12-14"
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-44 rounded-md border border-input bg-background px-2 py-0 text-sm"
          data-page-spec-input="true"
        />
        <span className="text-[11px] text-muted-foreground/70">/ {pageCount || "?"} 页</span>
      </div>
      {preview ? (
        <span
          className={preview.ok ? "text-[11px] text-muted-foreground" : "text-[11px] text-destructive"}
          data-page-spec-preview={preview.ok ? "ok" : "error"}
          role={preview.ok ? undefined : "alert"}
        >
          {preview.ok ? `共 ${preview.pages.length} 页` : preview.error}
        </span>
      ) : null}
    </div>
  );
}
