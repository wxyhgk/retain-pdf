import { type ComponentProps, type ReactElement, type ReactNode } from "react";
export type ControlSize = "sm" | "md";
type ControlA11yProps = {
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean | "true" | "false";
};
export type FieldProps = {
    label: ReactNode;
    /** 标题下面的一句说明。 */
    hint?: ReactNode;
    /** 有错时显示在下面，控件标成 aria-invalid。 */
    error?: ReactNode;
    className?: string;
    /** 恰好一个控件（Input、Textarea、Select 或别的接受 id 的元素）。 */
    children: ReactElement<ControlA11yProps>;
};
export declare function Field({ label, hint, error, className, children }: FieldProps): import("react").JSX.Element;
export type InputProps = Omit<ComponentProps<"input">, "size"> & {
    size?: ControlSize;
};
export declare function Input({ size, className, ...props }: InputProps): import("react").JSX.Element;
export type TextareaProps = ComponentProps<"textarea">;
export declare function Textarea({ className, ...props }: TextareaProps): import("react").JSX.Element;
export type SelectProps = Omit<ComponentProps<"select">, "size"> & {
    size?: ControlSize;
    /** 给外面那层（定宽度、外边距用）；其余属性都落在 <select> 上。 */
    className?: string;
};
export declare function Select({ size, className, children, ...props }: SelectProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=field.d.ts.map