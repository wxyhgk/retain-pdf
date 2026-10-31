import * as React from "react";
import { type VariantProps } from "class-variance-authority";
declare const legacyButtonVariants: (props?: {
    variant?: "default" | "destructive" | "ghost" | "link" | "outline" | "secondary";
    size?: "default" | "icon" | "icon-lg" | "icon-sm" | "icon-xs" | "lg" | "sm" | "xs";
} & import("class-variance-authority/types").ClassProp) => string;
declare function LegacyButton({ className, variant, size, asChild, ...props }: React.ComponentProps<"button"> & VariantProps<typeof legacyButtonVariants> & {
    asChild?: boolean;
}): React.JSX.Element;
export { LegacyButton, legacyButtonVariants };
//# sourceMappingURL=button.d.ts.map