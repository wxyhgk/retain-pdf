import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
type DialogSize = "compact" | "standard" | "wide" | "workspace";
type DialogLevel = "base" | "nested";
declare function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>): React.JSX.Element;
declare function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>): React.JSX.Element;
declare function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>): React.JSX.Element;
declare function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>): React.JSX.Element;
declare function DialogOverlay({ className, level, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay> & {
    level?: DialogLevel;
}): React.JSX.Element;
declare function DialogContent({ className, children, level, overlayClassName, showCloseButton, size, ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & {
    level?: DialogLevel;
    overlayClassName?: string;
    showCloseButton?: boolean;
    size?: DialogSize;
}): React.JSX.Element;
declare function DialogShell({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
declare function DialogHeader({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
declare function DialogBody({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
declare function DialogFooter({ className, showCloseButton, children, ...props }: React.ComponentProps<"div"> & {
    showCloseButton?: boolean;
}): React.JSX.Element;
declare function DialogCloseButton({ children, className, ...props }: React.ComponentProps<typeof DialogPrimitive.Close>): React.JSX.Element;
declare function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>): React.JSX.Element;
declare function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>): React.JSX.Element;
export { Dialog, DialogBody, DialogClose, DialogCloseButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogShell, DialogTitle, DialogTrigger, };
export type { DialogLevel, DialogSize };
//# sourceMappingURL=dialog.d.ts.map