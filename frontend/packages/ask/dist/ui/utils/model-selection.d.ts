import { type ReactNode } from "react";
export type ModelSelectorEffortOption = {
    id: string;
    name: string;
};
export declare const DEFAULT_EFFORT_OPTIONS: readonly ModelSelectorEffortOption[];
export type ModelOption = {
    id: string;
    name: string;
    description?: string;
    icon?: ReactNode;
    disabled?: boolean;
    /** Extra terms matched by ModelSelector.Search, in addition to id and name. */
    keywords?: readonly string[];
    /**
     * Reasoning effort levels the model supports. Pass `true` for the default
     * low/medium/high levels, or a custom list. Omit for models without
     * configurable reasoning.
     */
    efforts?: boolean | readonly ModelSelectorEffortOption[];
};
export declare function getModelEfforts(model: ModelOption | undefined): readonly ModelSelectorEffortOption[] | undefined;
export declare function resolveEffort(efforts: readonly ModelSelectorEffortOption[] | undefined, effort: string | undefined): string | undefined;
/**
 * Returns the effort id if the given model supports it, otherwise undefined.
 * Effort selection is kept sticky across model switches; this resolves what
 * actually applies to the current model.
 */
export declare function resolveModelEffort(models: readonly ModelOption[], modelId: string | undefined, effort: string | undefined): string | undefined;
export declare function useControllableState<T>({ prop, defaultProp, onChange, }: {
    prop: T | undefined;
    defaultProp: T | undefined;
    onChange: ((next: T) => void) | undefined;
}): readonly [T, (next: T) => void];
type ModelSelectorContextValue = {
    models: readonly ModelOption[];
    value: string | undefined;
    setValue: (value: string) => void;
    /** The model matching `value`, derived once for all sub-components. */
    selectedModel: ModelOption | undefined;
    /** The selected model's effort levels, undefined when not configurable. */
    efforts: readonly ModelSelectorEffortOption[] | undefined;
    /** Effort resolved against the selected model's supported levels. */
    effort: string | undefined;
    setEffort: (effort: string) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
};
export declare const ModelSelectorContext: import("react").Context<ModelSelectorContextValue>;
export type ModelSelectorStateProps = {
    models: readonly ModelOption[];
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    effort?: string;
    defaultEffort?: string;
    onEffortChange?: (effort: string) => void;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
};
export declare function useModelSelectorState({ models, value: valueProp, defaultValue, onValueChange, effort: effortProp, defaultEffort, onEffortChange, open: openProp, defaultOpen, onOpenChange, }: ModelSelectorStateProps): {
    open: boolean;
    setOpen: (next: boolean) => void;
    contextValue: {
        models: readonly ModelOption[];
        value: string;
        setValue: (next: string) => void;
        selectedModel: ModelOption;
        efforts: readonly ModelSelectorEffortOption[];
        effort: string;
        setEffort: (next: string) => void;
        open: boolean;
        setOpen: (next: boolean) => void;
    };
};
export declare function useModelSelectorContext(): ModelSelectorContextValue;
/**
 * The selected model's effort levels and the active selection. Use it to build
 * a custom effort UI inside ModelSelector.Content (e.g. a slider or a shadcn
 * DropdownMenu) when the built-in ModelSelector.Effort layout doesn't fit.
 * `efforts` is undefined for models without configurable reasoning.
 */
export declare function useModelSelectorEfforts(): {
    efforts: readonly ModelSelectorEffortOption[] | undefined;
    effort: string | undefined;
    setEffort: (effort: string) => void;
};
export declare function useLazyFlipSide<TSide extends string>(open?: boolean, preferred?: TSide): {
    side: TSide | undefined;
    popupRef: (node: HTMLDivElement | null) => void;
};
export {};
