// 状态小标签。tone 对应皮肤的语义色；界面是黑白的，「完成」用墨色，不用绿色。样子在 styles/badge.css。

import type { ComponentProps } from "react";

import { cn } from "../lib/utils.js";

export type BadgeTone = "muted" | "active" | "done" | "warn" | "danger";

export type BadgeProps = ComponentProps<"span"> & { tone?: BadgeTone };

export function Badge({ tone = "muted", className, ...props }: BadgeProps) {
  return <span className={cn("ui-badge", className)} data-tone={tone} {...props} />;
}
