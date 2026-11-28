import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cva } from "class-variance-authority";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "../lib/utils.js";
import { Popover, PopoverContent, PopoverTrigger, } from "../shadcn/popover.js";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, } from "../shadcn/command.js";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { ModelSelectorContext, useLazyFlipSide, useModelSelectorContext, useModelSelectorEfforts, useModelSelectorState, } from "../utils/model-selection.js";
export { DEFAULT_EFFORT_OPTIONS, resolveModelEffort, useModelSelectorContext, useModelSelectorEfforts, } from "../utils/model-selection.js";
function ModelSelectorRoot({ children, ...stateProps }) {
    const { open, setOpen, contextValue } = useModelSelectorState(stateProps);
    return (_jsx(ModelSelectorContext.Provider, { value: contextValue, children: _jsx(Popover, { open: open ?? false, onOpenChange: setOpen, children: children }) }));
}
export const modelSelectorTriggerVariants = cva("focus-visible:ring-ring/50 flex w-fit items-center justify-between gap-2 overflow-hidden rounded-md text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5", {
    variants: {
        variant: {
            outline: "border-input hover:bg-accent hover:text-accent-foreground border bg-transparent",
            ghost: "hover:bg-accent hover:text-accent-foreground",
            muted: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        },
        size: {
            default: "h-9 px-3 py-2",
            sm: "h-8 px-2.5 py-1.5 text-xs",
            lg: "h-10 px-4 py-2.5",
        },
    },
    defaultVariants: {
        variant: "outline",
        size: "default",
    },
});
function ModelSelectorTrigger({ className, variant, size, children, onKeyDown, ...props }) {
    const { setOpen, selectedModel, efforts, effort } = useModelSelectorContext();
    const effortName = effort !== undefined
        ? efforts?.find((item) => item.id === effort)?.name
        : undefined;
    return (_jsxs(PopoverTrigger, { "data-slot": "model-selector-trigger", "data-variant": variant ?? "outline", "data-size": size ?? "default", role: "combobox", "aria-label": selectedModel
            ? `模型：${selectedModel.name}${effortName ? ` ${effortName}` : ""}`
            : "选模型", "aria-haspopup": "listbox", className: cn(modelSelectorTriggerVariants({ variant, size }), className), onKeyDown: (e) => {
            onKeyDown?.(e);
            if (e.defaultPrevented)
                return;
            // ARIA combobox: arrows open the listbox from a focused trigger.
            // Popover leaves this to the consumer.
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setOpen(true);
            }
        }, ...props, children: [children ?? _jsx(ModelSelectorValue, {}), _jsx(ChevronDownIcon, { className: "size-4 opacity-50" })] }));
}
function ModelIcon({ children, className, }) {
    return (_jsx("span", { className: cn("flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5", className), children: children }));
}
function ModelSelectorValue({ placeholder = "选模型", showEffort = true, className, }) {
    const { selectedModel, efforts, effort } = useModelSelectorContext();
    if (!selectedModel) {
        return (_jsx("span", { "data-slot": "model-selector-value", className: cn("text-muted-foreground", className), children: placeholder }));
    }
    const effortName = showEffort && effort !== undefined
        ? efforts?.find((e) => e.id === effort)?.name
        : undefined;
    return (_jsxs("span", { "data-slot": "model-selector-value", className: cn("flex min-w-0 items-center gap-2", className), children: [selectedModel.icon && _jsx(ModelIcon, { children: selectedModel.icon }), _jsx("span", { className: "truncate font-medium", children: selectedModel.name }), effortName && (_jsx("span", { className: "text-muted-foreground min-w-7.5 truncate text-center", children: effortName }))] }));
}
/**
 * Hidden input that anchors cmdk's keyboard navigation, keeping the list
 * keyboard-operable without a visible search box. ModelSelectorContent renders
 * one automatically when unfiltered.
 */
function ModelSelectorFocusAnchor() {
    return (_jsx("div", { className: "sr-only", children: _jsx(CommandInput, { readOnly: true, "aria-label": "\u6A21\u578B" }) }));
}
function ModelSelectorContent({ className, align = "start", side, sideOffset = 6, searchable, children, ...props }) {
    const { value, open } = useModelSelectorContext();
    const { side: renderedSide, popupRef } = useLazyFlipSide(open, side ?? "bottom");
    const unfiltered = searchable === false || (!searchable && children === undefined);
    return (_jsx(PopoverContent, { ref: popupRef, "data-slot": "model-selector-content", align: align, side: renderedSide ?? side ?? "bottom", sideOffset: sideOffset, className: cn("bg-popover w-72 min-w-(--radix-popover-trigger-width) overflow-hidden rounded-xl p-0 text-[length:var(--ui-text-md,13px)]", className), ...props, children: _jsxs(Command, { className: "bg-transparent", shouldFilter: !unfiltered, ...(value !== undefined ? { defaultValue: value } : {}), children: [unfiltered && _jsx(ModelSelectorFocusAnchor, {}), children ?? (_jsxs(_Fragment, { children: [searchable && _jsx(ModelSelectorSearch, {}), _jsx(ModelSelectorList, {}), _jsx(ModelSelectorEffort, {})] }))] }) }));
}
function ModelSelectorSearch({ placeholder = "搜模型…", ...props }) {
    return (_jsx(CommandInput, { "data-slot": "model-selector-search", placeholder: placeholder, ...props }));
}
function ModelSelectorList({ className, children, ...props }) {
    const { models } = useModelSelectorContext();
    return (_jsx(CommandList, { "data-slot": "model-selector-list", className: cn("[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", className), ...props, children: children ?? (_jsxs(_Fragment, { children: [_jsx(ModelSelectorEmpty, {}), _jsx(CommandGroup, { children: models.map((model) => (_jsx(ModelSelectorItem, { model: model }, model.id))) })] })) }));
}
function ModelSelectorEmpty({ children, ...props }) {
    return (_jsx(CommandEmpty, { "data-slot": "model-selector-empty", ...props, children: children ?? "没有这个模型" }));
}
function ModelSelectorGroup(props) {
    return _jsx(CommandGroup, { "data-slot": "model-selector-group", ...props });
}
function ModelSelectorSeparator(props) {
    return _jsx(CommandSeparator, { "data-slot": "model-selector-separator", ...props });
}
function ModelSelectorItem({ model, className, children, onSelect, ...props }) {
    const { value, setValue, setOpen } = useModelSelectorContext();
    const isSelected = value === model.id;
    return (_jsxs(CommandItem, { "data-slot": "model-selector-item", value: model.id, keywords: [model.name, ...(model.keywords ?? [])], ...(model.disabled ? { disabled: true } : undefined), onSelect: (selectedValue) => {
            setValue(model.id);
            setOpen(false);
            onSelect?.(selectedValue);
        }, className: cn("relative items-start gap-2 rounded-lg py-2 ps-3 pe-9 [&_svg:not([class*='size-'])]:size-3.5 data-[selected=true]:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] data-[selected=true]:text-(--ink) aria-selected:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] aria-selected:text-(--ink)", className), ...props, children: [children ?? (_jsxs(_Fragment, { children: [model.icon && (_jsx(ModelIcon, { className: "mt-[3px]", children: model.icon })), _jsxs("span", { className: "flex min-w-0 flex-col", children: [_jsx("span", { className: "truncate font-medium", children: model.name }), model.description && (_jsx("span", { className: "text-muted-foreground truncate text-xs", children: model.description }))] })] })), isSelected && (_jsx("span", { className: "absolute end-3 top-2.5 flex size-4 items-center justify-center", children: _jsx(CheckIcon, { className: "size-4" }) }))] }));
}
function ModelSelectorEffort({ label = "思考", className, onKeyDown, ...props }) {
    const { efforts, effort, setEffort } = useModelSelectorEfforts();
    if (!efforts?.length)
        return null;
    return (_jsxs("div", { "data-slot": "model-selector-effort", className: cn("flex cursor-default items-center justify-between gap-3 border-t px-3 py-2", className), onKeyDown: (e) => {
            onKeyDown?.(e);
            if (e.defaultPrevented)
                return;
            // cmdk's Command root claims Home/End to jump the model list; stop
            // them here so only the radiogroup reacts.
            if (e.key === "Home" || e.key === "End")
                e.stopPropagation();
            // Vertical arrows refocus cmdk's input before the event bubbles to
            // the Command root: the same keypress then moves the list highlight,
            // and Enter selects again (cmdk's Enter is inert while a radio has
            // focus, so the highlight would otherwise move with no way to act).
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.currentTarget
                    .closest("[cmdk-root]")
                    ?.querySelector("[cmdk-input]")
                    ?.focus();
            }
        }, ...props, children: [_jsx("span", { className: "text-muted-foreground text-xs", children: label }), _jsx(RadioGroupPrimitive.Root, { value: effort ?? "", onValueChange: setEffort, orientation: "horizontal", "aria-label": typeof label === "string" ? label : "思考强度", className: "flex items-center gap-0.5", children: efforts.map((option) => (_jsx(RadioGroupPrimitive.Item, { value: option.id, className: cn("focus-visible:ring-ring/50 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2 py-1 text-xs transition-colors outline-none focus-visible:ring-1", "data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground data-[state=checked]:font-medium"), children: option.name }, option.id))) })] }));
}
export { ModelSelectorRoot, ModelSelectorTrigger, ModelSelectorValue, ModelSelectorContent, ModelSelectorSearch, ModelSelectorFocusAnchor, ModelSelectorList, ModelSelectorEmpty, ModelSelectorGroup, ModelSelectorSeparator, ModelSelectorItem, ModelSelectorEffort, };
