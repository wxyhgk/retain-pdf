import type { AgentConfirmationMode } from "@retainpdf/api/agent-runtime-settings";
import type { AgentOperationView } from "@retainpdf/api/document-operations";
import type { ReaderAgentOperationEntry, ReaderAgentOperationPerformOptions } from "./use-reader-agent-operations.js";
type OperationAction = "run" | "cancel" | "commit" | "retry";
export declare function readerAgentOperationDismissalKey(operation: AgentOperationView): string;
export declare function ReaderAgentOperationPanel({ entries, confirmationMode, runtimeRestarting, loadCandidate, onAction, }: {
    entries: ReaderAgentOperationEntry[];
    confirmationMode: AgentConfirmationMode;
    runtimeRestarting: boolean;
    loadCandidate: (operation: AgentOperationView) => Promise<Blob>;
    onAction: (action: OperationAction, operation: AgentOperationView, options?: ReaderAgentOperationPerformOptions) => void | Promise<void>;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=ReaderAgentOperationPanel.d.ts.map