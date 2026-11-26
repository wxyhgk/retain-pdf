import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";
import { PopoverContent, PopoverTrigger } from "../shadcn/popover.js";
import { CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "../shadcn/command.js";
import { type ModelOption, type ModelSelectorStateProps } from "../utils/model-selection.js";
export { DEFAULT_EFFORT_OPTIONS, resolveModelEffort, useModelSelectorContext, useModelSelectorEfforts, } from "../utils/model-selection.js";
export type { ModelOption, ModelSelectorEffortOption, } from "../utils/model-selection.js";
export type ModelSelectorRootProps = ModelSelectorStateProps & {
    children: ReactNode;
};
declare function ModelSelectorRoot({ children, ...stateProps }: ModelSelectorRootProps): import("react").JSX.Element;
export declare const modelSelectorTriggerVariants: (props?: {
    variant?: "ghost" | "muted" | "outline";
    size?: "default" | "lg" | "sm";
} & import("class-variance-authority/types").ClassProp) => string;
export type ModelSelectorTriggerProps = ComponentPropsWithoutRef<typeof PopoverTrigger> & VariantProps<typeof modelSelectorTriggerVariants>;
declare function ModelSelectorTrigger({ className, variant, size, children, onKeyDown, ...props }: ModelSelectorTriggerProps): import("react").JSX.Element;
export type ModelSelectorValueProps = {
    placeholder?: ReactNode;
    /** Show the active effort level next to the model name. */
    showEffort?: boolean;
    className?: string;
};
declare function ModelSelectorValue({ placeholder, showEffort, className, }: ModelSelectorValueProps): import("react").JSX.Element;
export type ModelSelectorContentProps = Omit<ComponentPropsWithoutRef<typeof PopoverContent>, "side"> & {
    /**
     * Preferred side for the initial placement. Once the popover is open, the
     * rendered side takes over until it closes, so the popup does not jump
     * between sides while filtering resizes the list.
     */
    side?: ComponentPropsWithoutRef<typeof PopoverContent>["side"];
    searchable?: boolean;
};
/**
 * Hidden input that anchors cmdk's keyboard navigation, keeping the list
 * keyboard-operable without a visible search box. ModelSelectorContent renders
 * one automatically when unfiltered.
 */
declare function ModelSelectorFocusAnchor(): import("react").JSX.Element;
declare function ModelSelectorContent({ className, align, side, sideOffset, searchable, children, ...props }: ModelSelectorContentProps): import("react").JSX.Element;
export type ModelSelectorSearchProps = ComponentPropsWithoutRef<typeof CommandInput>;
declare function ModelSelectorSearch({ placeholder, ...props }: ModelSelectorSearchProps): import("react").JSX.Element;
export type ModelSelectorListProps = ComponentPropsWithoutRef<typeof CommandList>;
declare function ModelSelectorList({ className, children, ...props }: ModelSelectorListProps): import("react").JSX.Element;
export type ModelSelectorEmptyProps = ComponentPropsWithoutRef<typeof CommandEmpty>;
declare function ModelSelectorEmpty({ children, ...props }: ModelSelectorEmptyProps): import("react").JSX.Element;
export type ModelSelectorGroupProps = ComponentPropsWithoutRef<typeof CommandGroup>;
declare function ModelSelectorGroup(props: ModelSelectorGroupProps): import("react").JSX.Element;
export type ModelSelectorSeparatorProps = ComponentPropsWithoutRef<typeof CommandSeparator>;
declare function ModelSelectorSeparator(props: ModelSelectorSeparatorProps): import("react").JSX.Element;
export type ModelSelectorItemProps = Omit<ComponentPropsWithoutRef<typeof CommandItem>, "value"> & {
    model: ModelOption;
};
declare function ModelSelectorItem({ model, className, children, onSelect, ...props }: ModelSelectorItemProps): import("react").JSX.Element;
export type ModelSelectorEffortProps = ComponentPropsWithoutRef<"div"> & {
    label?: ReactNode;
};
declare function ModelSelectorEffort({ label, className, onKeyDown, ...props }: ModelSelectorEffortProps): import("react").JSX.Element;
export type ModelSelectorProps = Omit<ModelSelectorRootProps, "children"> & VariantProps<typeof modelSelectorTriggerVariants> & {
    /** Render a search input above the model list. */
    searchable?: boolean;
    /** Alignment of the dropdown relative to the trigger. Use `"end"` when the
     * trigger sits at the right edge of its container. */
    align?: ModelSelectorContentProps["align"];
    className?: string;
    contentClassName?: string;
};
export { ModelSelectorRoot, ModelSelectorTrigger, ModelSelectorValue, ModelSelectorContent, ModelSelectorSearch, ModelSelectorFocusAnchor, ModelSelectorList, ModelSelectorEmpty, ModelSelectorGroup, ModelSelectorSeparator, ModelSelectorItem, ModelSelectorEffort, };
