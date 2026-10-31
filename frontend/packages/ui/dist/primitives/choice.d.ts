import { type ComponentProps, type ReactNode } from "react";
export type CheckboxProps = Omit<ComponentProps<"input">, "type"> & {
    /** 给了就包成 <label>，点字也能勾。 */
    label?: ReactNode;
};
export declare function Checkbox({ label, className, ...props }: CheckboxProps): import("react").JSX.Element;
export type SegmentedOption<T extends string> = {
    value: T;
    label: ReactNode;
    disabled?: boolean;
    /** 落到这个选项按钮上的额外属性（测试用的 data-*、title…）。 */
    props?: Record<string, string | undefined>;
};
export type SegmentedControlProps<T extends string> = {
    value: T;
    options: ReadonlyArray<SegmentedOption<T>>;
    onChange: (value: T) => void;
    /** 给读屏的组名。 */
    label: string;
    size?: "sm" | "md";
    /** 给了就排成这么多列的网格（选项多、一行放不下时用），不给就是一条。 */
    columns?: number;
    disabled?: boolean;
    className?: string;
};
export declare function SegmentedControl<T extends string>({ value, options, onChange, label, size, columns, disabled, className, }: SegmentedControlProps<T>): import("react").JSX.Element;
//# sourceMappingURL=choice.d.ts.map