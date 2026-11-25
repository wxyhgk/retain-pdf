import * as React from "react";
import { type VariantProps } from "class-variance-authority";
declare const buttonVariants: (props?: {
    variant?: "default" | "destructive" | "ghost" | "link" | "outline" | "secondary";
    size?: "default" | "icon" | "icon-lg" | "icon-sm" | "icon-xs" | "lg" | "sm" | "xs";
} & import("class-variance-authority/types").ClassProp) => string;
declare function Button({ className, variant, size, asChild, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
}): React.JSX.Element;
export { Button, buttonVariants };
//# sourceMappingURL=button.d.ts.map