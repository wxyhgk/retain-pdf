// Markdown 的标志（圆角框里一个 M 和一个向下的箭头，照 Markdown Mark 画的线描版），和 lucide 图标同一套参数，
// 能放进面板清单的 Icon（LucideIcon）里。
import { forwardRef } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

const MarkdownMark = forwardRef<SVGSVGElement, LucideProps>(function MarkdownMark(
  { size = 24, strokeWidth = 2, color = "currentColor", className, ...rest },
  ref,
) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M6 15V9l2.5 3L11 9v6" />
      <path d="M16.5 9v6M14.5 13l2 2 2-2" />
    </svg>
  );
});

export const MarkdownIcon = MarkdownMark as unknown as LucideIcon;
