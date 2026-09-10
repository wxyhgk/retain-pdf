// PDF 选择浮条：正文走原生选区，公式/表格/图片走 OCR 结构选择层。

import { useEffect, useState } from "react";
import { Check, Copy, Image, Sigma, Sparkles, Table2, Type, X } from "lucide-react";
import {
  extractReaderFormulaLatex,
  readerRegionContent,
  type ReaderSelection,
} from "../../shared/data/reader-regions.js";

export type ReaderSelectionToolbarProps = {
  selection: ReaderSelection | null;
  onDismiss: () => void;
  onAskAi?: (selection: ReaderSelection) => void;
};

export async function copyReaderSelectionText(value: string): Promise<void> {
  const text = `${value || ""}`;
  if (!text) throw new Error("empty selection");
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Clipboard permission can be unavailable in a local desktop webview.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy failed");
}

export function ReaderSelectionToolbar({
  selection,
  onDismiss,
  onAskAi,
}: ReaderSelectionToolbarProps) {
  const [copied, setCopied] = useState(false);
  const selectionKey = selection
    ? selection.selectionType === "text"
      ? `${selection.pane}:${selection.page}:${selection.quote}`
      : `${selection.region.itemId}:${selection.pane}`
    : "";
  useEffect(() => setCopied(false), [selectionKey]);

  if (!selection) {
    return null;
  }

  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const midX = selection.rect.left + selection.rect.width / 2;
  // 紧凑工具条约 220px 宽，避免覆盖大段正文。
  const TOOLBAR_HALF = 120;
  const left = Math.min(Math.max(16 + TOOLBAR_HALF, midX), vw - 16 - TOOLBAR_HALF);

  // 优先选区上方；空间不够则翻到下方
  const preferAbove = selection.rect.top > 72;
  const top = preferAbove
    ? Math.max(12, selection.rect.top - 8)
    : Math.min(vh - 12, selection.rect.top + selection.rect.height + 8);
  const place = preferAbove ? "above" : "below";

  const paneLabel = selection.pane === "translated" ? "译文" : "原文";
  const kind = selection.selectionType === "text" ? "text" : selection.kind;
  const regionContent = selection.selectionType === "text"
    ? selection.quote
    : readerRegionContent(selection.region, selection.pane);
  const kindLabel = kind === "formula" ? "公式"
    : kind === "table" ? "表格"
      : kind === "figure" ? "图片"
        : kind === "text" ? "文字" : "区域";
  const copyValue = kind === "formula"
    ? extractReaderFormulaLatex(regionContent)
    : regionContent;
  const KindIcon = kind === "formula" ? Sigma
    : kind === "table" ? Table2
      : kind === "text" ? Type : Image;

  return (
    <div
      className={`reader-sel-pop reader-sel-pop--${place} reader-sel-pop--region`}
      style={{ left, top }}
      role="toolbar"
      aria-label="选区操作"
      onPointerDown={(event) => {
        // 点击工具条不能先折叠 PDF.js 的原生文字选区，否则 selectionchange
        // 会在 click 之前卸载按钮，复制与问 AI 都无法触发。
        event.preventDefault();
      }}
    >
      <div className="reader-sel-pop-card reader-floating-surface">
        <div className="reader-sel-pop-context">
          <KindIcon size={15} strokeWidth={2.1} aria-hidden />
          <span>{kindLabel}</span>
          <span className="reader-sel-pop-context-divider" aria-hidden>·</span>
          <span>{paneLabel}</span>
          <span className="reader-sel-pop-context-divider" aria-hidden>·</span>
          <span>{selection.page} 页</span>
        </div>

        <div className="reader-sel-pop-actions">
          {copyValue ? (
            <button
              type="button"
              className="reader-sel-pop-btn reader-sel-pop-btn--primary"
              onClick={async () => {
                try {
                  await copyReaderSelectionText(copyValue);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1400);
                } catch (error) {
                  console.warn("[reader-selection] copy failed", error);
                }
              }}
            >
              {copied ? <Check size={15} strokeWidth={2.4} aria-hidden /> : <Copy size={15} strokeWidth={2.2} aria-hidden />}
              <span>{copied ? "已复制" : kind === "formula" ? "复制 LaTeX" : "复制"}</span>
            </button>
          ) : (
            <span className="reader-sel-pop-selection-hint">已选择图片</span>
          )}
          {onAskAi ? (
            <button
              type="button"
              className="reader-sel-pop-btn reader-sel-pop-btn--secondary"
              onClick={() => onAskAi(selection)}
            >
              <Sparkles size={15} strokeWidth={2.2} aria-hidden />
              <span>问 AI</span>
            </button>
          ) : null}
          <button
            type="button"
            className="reader-sel-pop-btn reader-sel-pop-btn--ghost"
            onClick={onDismiss}
            aria-label="取消选区"
            title="取消"
          >
            <X size={15} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
      <span className="reader-sel-pop-caret" aria-hidden="true" />
    </div>
  );
}
