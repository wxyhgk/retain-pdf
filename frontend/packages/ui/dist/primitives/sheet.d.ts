import type { ReactNode } from "react";
export type SheetProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: ReactNode;
    description?: ReactNode;
    side?: "left" | "right";
    id?: string;
    className?: string;
    children: ReactNode;
};
export declare function Sheet({ open, onOpenChange, title, description, side, id, className, children }: SheetProps): import("react").JSX.Element;
//# sourceMappingURL=sheet.d.ts.map