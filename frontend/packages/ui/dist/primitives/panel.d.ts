import type { ComponentProps, ReactNode } from "react";
export type PanelProps = Omit<ComponentProps<"section">, "title"> & {
    title?: ReactNode;
    description?: ReactNode;
    /** 标题右边的按钮。 */
    actions?: ReactNode;
    /** 标题用哪一级，按它在页面里的位置给。 */
    titleAs?: "h2" | "h3" | "h4";
};
export declare function Panel({ title, description, actions, titleAs: Title, className, children, ...props }: PanelProps): import("react").JSX.Element;
//# sourceMappingURL=panel.d.ts.map