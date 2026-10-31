import type { ReactElement, ReactNode } from "react";
export type MenuItem = {
    key: string;
    label: ReactNode;
    onSelect: () => void;
    icon?: ReactNode;
    disabled?: boolean;
    /** 删除一类的操作，用红字。 */
    danger?: boolean;
};
export type MenuProps = {
    trigger: ReactElement;
    items: MenuItem[];
    /** 菜单和按钮的哪一边对齐。 */
    align?: "start" | "end";
    /** 给读屏的菜单名。 */
    label?: string;
    className?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};
export declare function Menu({ trigger, items, align, label, className, open, onOpenChange }: MenuProps): import("react").JSX.Element;
//# sourceMappingURL=menu.d.ts.map