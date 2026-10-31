import type { ComponentProps, ReactNode } from "react";
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
type NativeButtonProps = Omit<ComponentProps<"button">, "type"> & {
    type?: "button" | "submit" | "reset";
};
export type ButtonProps = NativeButtonProps & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** 进行中：转圈、禁用，aria-busy。 */
    pending?: boolean;
};
export declare function Button({ variant, size, pending, type, className, disabled, children, ...props }: ButtonProps): import("react").JSX.Element;
export type IconButtonProps = NativeButtonProps & {
    /** 必填：读屏和悬停提示都用它。 */
    label: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    pending?: boolean;
    children: ReactNode;
};
export declare function IconButton({ label, variant, size, pending, type, className, disabled, children, ...props }: IconButtonProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=button.d.ts.map