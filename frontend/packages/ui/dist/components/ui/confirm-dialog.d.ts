import type { ReactNode } from "react";
import { type DialogLevel, type DialogSize } from "./dialog.js";
type ConfirmDialogProps = {
    cancelLabel?: string;
    confirmLabel?: string;
    description: ReactNode;
    id: string;
    level?: DialogLevel;
    onConfirm: () => void | Promise<void>;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    pending?: boolean;
    size?: DialogSize;
    title: string;
    tone?: "default" | "danger" | "info";
};
declare function ConfirmDialog({ cancelLabel, confirmLabel, description, id, level, onConfirm, onOpenChange, open, pending, size, title, tone, }: ConfirmDialogProps): import("react").JSX.Element;
export { ConfirmDialog };
export type { ConfirmDialogProps };
//# sourceMappingURL=confirm-dialog.d.ts.map