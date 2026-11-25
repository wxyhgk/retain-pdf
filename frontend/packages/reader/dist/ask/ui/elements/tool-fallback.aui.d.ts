import { type ToolCallMessagePart, type ToolCallMessagePartStatus, type ToolCallMessagePartComponent } from "@assistant-ui/react";
import { CollapsibleRoot as Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible-root.js";
export type ToolFallbackRootProps = Omit<React.ComponentProps<typeof Collapsible>, "open" | "onOpenChange"> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
};
declare function ToolFallbackRoot({ className, open: controlledOpen, onOpenChange: controlledOnOpenChange, defaultOpen, children, ...props }: ToolFallbackRootProps): import("react").JSX.Element;
declare function ToolFallbackTrigger({ toolName, status, isError, responseDeliveryStatus, className, ...props }: React.ComponentProps<typeof CollapsibleTrigger> & {
    toolName: string;
    status?: ToolCallMessagePartStatus;
    isError?: ToolCallMessagePart["isError"];
    responseDeliveryStatus?: ToolCallMessagePart["responseDeliveryStatus"];
}): import("react").JSX.Element;
declare function ToolFallbackContent({ className, children, ...props }: React.ComponentProps<typeof CollapsibleContent>): import("react").JSX.Element;
declare function ToolFallbackArgs({ argsText, className, ...props }: React.ComponentProps<"div"> & {
    argsText?: string;
}): import("react").JSX.Element;
declare const formatUnknownValue: (value: unknown, space?: number) => string;
declare function ToolFallbackResult({ result, className, ...props }: React.ComponentProps<"div"> & {
    result?: unknown;
}): import("react").JSX.Element;
declare function ToolFallbackError({ status, className, ...props }: React.ComponentProps<"div"> & {
    status?: ToolCallMessagePartStatus;
}): import("react").JSX.Element;
declare const offersInterruptAction: (status: ToolCallMessagePartStatus | undefined, approval: ToolCallMessagePart["approval"], interrupt: ToolCallMessagePart["interrupt"]) => boolean;
declare const ToolFallbackApproval: import("react").ForwardRefExoticComponent<Omit<import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & Partial<Pick<ToolCallMessagePart<import("assistant-stream/utils").ReadonlyJSONObject, unknown> & {
    readonly status: import("@assistant-ui/core").MessagePartStatus | ToolCallMessagePartStatus;
} & ToolCallMessagePart<any, unknown> & {
    addResult: (result: unknown) => void;
    resume: (payload: unknown) => void;
    respondToApproval: (response: import("@assistant-ui/core").ToolApprovalResponse) => Promise<void>;
    unstable_recordInteraction?: ((input: import("@assistant-ui/core").Unstable_ToolInteractionInput) => Promise<void>) | undefined;
}, "addResult" | "respondToApproval" | "resume" | "status">> & {
    interrupt?: ToolCallMessagePart["interrupt"];
    approval?: ToolCallMessagePart["approval"];
} & import("react").RefAttributes<HTMLDivElement>>;
declare const ToolFallback: ToolCallMessagePartComponent & {
    Root: typeof ToolFallbackRoot;
    Trigger: typeof ToolFallbackTrigger;
    Content: typeof ToolFallbackContent;
    Args: typeof ToolFallbackArgs;
    Result: typeof ToolFallbackResult;
    Error: typeof ToolFallbackError;
    Approval: typeof ToolFallbackApproval;
};
export { formatUnknownValue, offersInterruptAction, ToolFallback, ToolFallbackRoot, ToolFallbackTrigger, ToolFallbackContent, ToolFallbackArgs, ToolFallbackResult, ToolFallbackError, ToolFallbackApproval, };
//# sourceMappingURL=tool-fallback.aui.d.ts.map