import { type ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";
import { CollapsibleRoot as Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible-root.js";
export declare const ANIMATION_DURATION = 200;
declare const reasoningVariants: (props?: {
    variant?: "ghost" | "muted" | "outline";
} & import("class-variance-authority/types").ClassProp) => string;
export type ReasoningRootProps = Omit<React.ComponentProps<typeof Collapsible>, "open" | "onOpenChange"> & VariantProps<typeof reasoningVariants> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
    /**
     * Whether the reasoning is currently streaming. While `true` the
     * disclosure is held open with a bottom-pinned live preview; when
     * streaming ends it returns to `defaultOpen`, and the first manual
     * toggle takes over the open/close state permanently. The live preview
     * keeps following the newest tokens while the disclosure is open during
     * streaming, even after a manual toggle, and pauses while the reader is
     * scrolled up.
     */
    streaming?: boolean;
    /** Called right before the disclosure animates, on toggle and on streaming transitions. */
    onAnimationStart?: () => void;
};
declare const ReasoningRoot: import("react").ForwardRefExoticComponent<Omit<ReasoningRootProps, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
declare function ReasoningFade({ side, className, ...props }: React.ComponentProps<"div"> & {
    side?: "top" | "bottom";
}): import("react").JSX.Element;
declare function ReasoningTrigger({ active, duration, label, className, ...props }: Omit<React.ComponentProps<typeof CollapsibleTrigger>, "children"> & {
    active?: boolean;
    duration?: number | undefined;
    label?: ReactNode;
}): import("react").JSX.Element;
declare function ReasoningContent({ className, children, ...props }: React.ComponentProps<typeof CollapsibleContent>): import("react").JSX.Element;
declare function ReasoningText({ className, children, ...props }: React.ComponentProps<"div">): import("react").JSX.Element;
export { ReasoningRoot, ReasoningTrigger, ReasoningContent, ReasoningText, ReasoningFade, reasoningVariants, };
//# sourceMappingURL=reasoning.d.ts.map