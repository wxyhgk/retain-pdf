// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
// RetainPDF 的改动（无）。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, } from "react";
export const DEFAULT_EFFORT_OPTIONS = [
    { id: "low", name: "Low" },
    { id: "medium", name: "Med" },
    { id: "high", name: "High" },
];
export function getModelEfforts(model) {
    if (!model?.efforts)
        return undefined;
    return model.efforts === true ? DEFAULT_EFFORT_OPTIONS : model.efforts;
}
export function resolveEffort(efforts, effort) {
    if (effort === undefined)
        return undefined;
    return efforts?.some((e) => e.id === effort) ? effort : undefined;
}
/**
 * Returns the effort id if the given model supports it, otherwise undefined.
 * Effort selection is kept sticky across model switches; this resolves what
 * actually applies to the current model.
 */
export function resolveModelEffort(models, modelId, effort) {
    return resolveEffort(getModelEfforts(models.find((m) => m.id === modelId)), effort);
}
export function useControllableState({ prop, defaultProp, onChange, }) {
    const [internal, setInternal] = useState(defaultProp);
    const isControlled = prop !== undefined;
    const value = isControlled ? prop : internal;
    // Read onChange through a ref so inline callbacks don't recreate the setter
    // (and with it the memoized context value) every render.
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    });
    const setValue = useCallback((next) => {
        if (!isControlled)
            setInternal(next);
        onChangeRef.current?.(next);
    }, [isControlled]);
    return [value, setValue];
}
export const ModelSelectorContext = createContext(null);
export function useModelSelectorState({ models, value: valueProp, defaultValue, onValueChange, effort: effortProp, defaultEffort, onEffortChange, open: openProp, defaultOpen, onOpenChange, }) {
    const [value, setValue] = useControllableState({
        prop: valueProp,
        defaultProp: defaultValue ?? models[0]?.id,
        onChange: onValueChange,
    });
    const [effort, setEffort] = useControllableState({
        prop: effortProp,
        defaultProp: defaultEffort,
        onChange: onEffortChange,
    });
    const [open, setOpen] = useControllableState({
        prop: openProp,
        defaultProp: defaultOpen ?? false,
        onChange: onOpenChange,
    });
    const selectedModel = models.find((m) => m.id === value);
    const efforts = getModelEfforts(selectedModel);
    const activeEffort = resolveEffort(efforts, effort);
    const contextValue = useMemo(() => ({
        models,
        value,
        setValue,
        selectedModel,
        efforts,
        effort: activeEffort,
        setEffort,
        open: open ?? false,
        setOpen,
    }), [
        models,
        value,
        setValue,
        selectedModel,
        efforts,
        activeEffort,
        setEffort,
        open,
        setOpen,
    ]);
    return { open, setOpen, contextValue };
}
export function useModelSelectorContext() {
    const ctx = useContext(ModelSelectorContext);
    if (!ctx) {
        throw new Error("ModelSelector sub-components must be used within ModelSelector.Root");
    }
    return ctx;
}
/**
 * The selected model's effort levels and the active selection. Use it to build
 * a custom effort UI inside ModelSelector.Content (e.g. a slider or a shadcn
 * DropdownMenu) when the built-in ModelSelector.Effort layout doesn't fit.
 * `efforts` is undefined for models without configurable reasoning.
 */
export function useModelSelectorEfforts() {
    const { efforts, effort, setEffort } = useModelSelectorContext();
    return { efforts, effort, setEffort };
}
// The popover re-evaluates collision flipping whenever the popup resizes, so
// filtering the list down flips the popup back to the preferred side
// mid-interaction. Base UI only exposes lazy flipping on the Combobox
// positioner, so adopt the side the popup first flips to as the preferred side
// for the rest of the open. Adopting every change can alternate between sides
// without end: after a preference change the popup can render on the opposite
// side even when both sides fit.
//
// A force-mounted popup keeps its node and position while closed. Pass `open`
// and the `preferred` side for one, so the side resets on close and a reopen
// adopts a side the popup already flipped to.
export function useLazyFlipSide(open = true, preferred) {
    const [side, setSide] = useState();
    const observerRef = useRef(null);
    const preferredRef = useRef(preferred);
    preferredRef.current = preferred;
    const popupRef = useCallback((node) => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        if (!node || !open) {
            setSide(undefined);
            return;
        }
        const current = node.getAttribute("data-side");
        const hasFlipped = preferredRef.current !== undefined &&
            current !== null &&
            current !== preferredRef.current;
        if (hasFlipped) {
            setSide(current);
            return;
        }
        const observer = new MutationObserver(() => {
            const rendered = node.getAttribute("data-side");
            if (!rendered)
                return;
            observer.disconnect();
            setSide(rendered);
        });
        observer.observe(node, {
            attributes: true,
            attributeFilter: ["data-side"],
        });
        observerRef.current = observer;
    }, [open]);
    return { side, popupRef };
}
