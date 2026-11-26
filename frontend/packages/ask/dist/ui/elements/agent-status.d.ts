import type { ComponentProps, ReactNode } from "react";
export type AgentState = "working" | "waiting" | "done" | "failed";
export interface StatusStep {
    state: AgentState;
    label: string;
}
export declare function AgentStatus({ state, label, elapsed, trailing, className, ...props }: Omit<ComponentProps<"span">, "children" | "state" | "label" | "elapsed"> & {
    state: AgentState;
    label: string;
    elapsed?: string | undefined;
    trailing?: ReactNode | undefined;
}): import("react").JSX.Element;
