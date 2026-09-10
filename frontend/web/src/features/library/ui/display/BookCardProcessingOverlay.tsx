// 封面中央「处理中」加载层：排队/OCR/翻译/渲染时用，不在角标写过程文案。

import { cn } from "@retainpdf/ui/lib/utils";

type BookCardProcessingOverlayProps = {
  /** 列表缩略图用更小尺寸 */
  compact?: boolean;
  className?: string;
};

export function BookCardProcessingOverlay({
  compact = false,
  className = "",
}: BookCardProcessingOverlayProps) {
  return (
    <div
      className={cn(
        "book-card-processing-overlay pointer-events-none absolute inset-0 z-[5] flex items-center justify-center",
        "bg-scrim/25 backdrop-blur-[1px]",
        className,
      )}
      data-processing="true"
      aria-hidden="true"
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-paper/90 shadow-md",
          compact ? "h-7 w-7" : "h-11 w-11",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          className={cn(
            "animate-spin text-primary [animation-duration:0.85s]",
            compact ? "h-3.5 w-3.5" : "h-5 w-5",
          )}
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    </div>
  );
}
