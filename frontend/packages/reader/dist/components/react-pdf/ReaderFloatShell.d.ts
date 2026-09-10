import { type ReactNode } from "react";
export type ReaderFloatShellProps = {
    id: string;
    open: boolean;
    title: string;
    subtitle?: string;
    titleIcon?: ReactNode;
    storageKey: string;
    ariaLabel: string;
    className?: string;
    /** 默认宽（px），会 min 到视口 */
    width?: number;
    /** dock-right 用于 PDF / Markdown 等稳定双栏，不启用拖拽定位。 */
    placement?: "floating" | "dock-right" | "workspace";
    showHeader?: boolean;
    onClose: () => void;
    toolbar?: ReactNode;
    children: ReactNode;
};
export declare function ReaderFloatShell({ id, open, title, subtitle, titleIcon, storageKey, ariaLabel, className, width, placement, showHeader, onClose, toolbar, children, }: ReaderFloatShellProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderFloatShell.d.ts.map