import type { ComponentProps } from "react";
export declare const paper = "bg-background border border-border/60 dark:bg-popover";
export declare const floating = "bg-background border border-border/60 dark:bg-popover";
export declare const field = "bg-foreground/[0.04] forced-colors:border dark:bg-foreground/[0.06]";
export declare const fieldInteractive = "bg-foreground/[0.04] transition-colors hover:bg-foreground/[0.07] forced-colors:border dark:bg-foreground/[0.06] dark:hover:bg-foreground/[0.09]";
export declare const pressable = "transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] motion-reduce:transition-none";
export declare const ghostButton = "flex items-center justify-center rounded-full text-muted-foreground outline-hidden transition-[background-color,color,scale] duration-150 hover:bg-foreground/[0.06] hover:text-foreground/90 active:scale-[0.96] focus-visible:ring-1 focus-visible:ring-foreground/20 motion-reduce:transition-none dark:hover:bg-foreground/[0.09]";
export declare const inkButton = "bg-foreground text-background transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-90 active:scale-[0.96] motion-reduce:transition-none forced-colors:border";
export declare const iconSwap = "[grid-area:1/1] transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";
export declare const iconSwapIn = "scale-100 opacity-100 blur-none";
export declare const iconSwapOut = "scale-[0.25] opacity-0 blur-[4px]";
export declare const labelSwap = "col-start-1 row-start-1 flex w-max items-center gap-1.5 leading-none transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";
export declare const labelSwapIn = "opacity-100 blur-none";
export declare const labelSwapOut = "pointer-events-none select-none opacity-0 blur-[2px]";
export declare const collapsePanel = "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none";
export declare const live = "text-blue-500 dark:text-blue-400";
export declare const mono = "font-mono text-[11px] tracking-tight";
export declare function ShimmerLabel({ active, className, ...props }: ComponentProps<"span"> & {
    active?: boolean;
}): import("react").JSX.Element;
/**
 * Scroll region for content that keeps its own whitespace. `whitespace-pre` in
 * a bounded box clips a long line with no way to reach it, so the rows scroll
 * instead.
 *
 * `codeSurface` wraps all the rows as one block, and the rows are its children.
 * It cannot go on each row: `min-width: 100%` resolves against the scroll
 * container's visible width rather than its scroll width, so a per-row width
 * leaves every row except the longest ending its background at the fold.
 */
export declare const codeScroll = "overflow-x-auto";
export declare const codeSurface = "w-max min-w-full";
export declare function SwapLabel({ active, children, className, }: {
    active: 0 | 1;
    children: [React.ReactNode, React.ReactNode];
    className?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=surfaces.d.ts.map