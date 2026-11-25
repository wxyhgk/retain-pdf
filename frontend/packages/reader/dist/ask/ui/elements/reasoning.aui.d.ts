import { type ReasoningMessagePartComponent } from "@assistant-ui/react";
import { ReasoningTrigger, ReasoningContent, ReasoningText, ReasoningFade, reasoningVariants, type ReasoningRootProps } from "./reasoning.js";
export type { ReasoningRootProps } from "./reasoning.js";
/** `ReasoningRoot` with the thread viewport scroll locked during disclosure animations. */
declare const ReasoningRoot: import("react").ForwardRefExoticComponent<Omit<ReasoningRootProps, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
declare const Reasoning: ReasoningMessagePartComponent & {
    Root: typeof ReasoningRoot;
    Trigger: typeof ReasoningTrigger;
    Content: typeof ReasoningContent;
    Text: typeof ReasoningText;
    Fade: typeof ReasoningFade;
};
/**
 * @deprecated This wrapper targets the legacy `components.ReasoningGroup`
 * prop on `<MessagePrimitive.Parts>`. Use `<MessagePrimitive.GroupedParts>`
 * with a `groupBy` returning `"group-reasoning"` and compose `ReasoningRoot`
 * / `ReasoningTrigger` / `ReasoningContent` / `ReasoningText` directly.
 * See `thread.aui.tsx` for an example.
 */
declare const ReasoningGroup: import("react").NamedExoticComponent<import("@assistant-ui/react").ReasoningGroupProps>;
export { Reasoning, ReasoningGroup, ReasoningRoot, ReasoningTrigger, ReasoningContent, ReasoningText, ReasoningFade, reasoningVariants, };
//# sourceMappingURL=reasoning.aui.d.ts.map