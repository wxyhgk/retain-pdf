import type { ComponentProps } from "react";
export type BadgeTone = "muted" | "active" | "done" | "warn" | "danger";
export type BadgeProps = ComponentProps<"span"> & {
    tone?: BadgeTone;
};
export declare function Badge({ tone, className, ...props }: BadgeProps): import("react").JSX.Element;
//# sourceMappingURL=badge.d.ts.map