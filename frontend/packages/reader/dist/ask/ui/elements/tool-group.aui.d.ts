import { type FC, type PropsWithChildren, type ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";
import { CollapsibleRoot as Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible-root.js";
declare const toolGroupVariants: (props?: {
    variant?: "ghost" | "muted" | "outline";
} & import("class-variance-authority/types").ClassProp) => string;
export type ToolGroupRootProps = Omit<React.ComponentProps<typeof Collapsible>, "open" | "onOpenChange"> & VariantProps<typeof toolGroupVariants> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
};
declare function ToolGroupRoot({ className, variant, open: controlledOpen, onOpenChange: controlledOnOpenChange, defaultOpen, children, ...props }: ToolGroupRootProps): import("react").JSX.Element;
declare function ToolGroupTrigger({ count, active, label, className, ...props }: Omit<React.ComponentProps<typeof CollapsibleTrigger>, "children"> & {
    count: number;
    active?: boolean;
    label?: ReactNode;
}): import("react").JSX.Element;
declare function ToolGroupContent({ className, children, ...props }: React.ComponentProps<typeof CollapsibleContent>): import("react").JSX.Element;
type ToolGroupComponent = FC<PropsWithChildren<{
    startIndex: number;
    endIndex: number;
}>> & {
    Root: typeof ToolGroupRoot;
    Trigger: typeof ToolGroupTrigger;
    Content: typeof ToolGroupContent;
};
/**
 * @deprecated This wrapper targets the legacy `components.ToolGroup` prop
 * on `<MessagePrimitive.Parts>`. Use `<MessagePrimitive.GroupedParts>` with
 * a `groupBy` returning `"group-tool"` and compose `ToolGroupRoot` /
 * `ToolGroupTrigger` / `ToolGroupContent` directly. See `thread.tsx`.
 */
declare const ToolGroup: ToolGroupComponent;
export { ToolGroup, ToolGroupRoot, ToolGroupTrigger, ToolGroupContent, toolGroupVariants, };
//# sourceMappingURL=tool-group.aui.d.ts.map