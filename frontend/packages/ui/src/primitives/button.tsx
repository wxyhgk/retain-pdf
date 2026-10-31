// 按钮：所有带字的按钮用 Button，只有图标的用 IconButton。样子在 styles/button.css，颜色、尺寸只用皮肤变量。
//
// 迁移期：Button 不给 variant 时原样渲染一个 <button>（默认 type="button"），样子全由调用方的 className 决定，
// 和以前的 web/src/ui/Button.tsx 一样。迁到基础组件的地方写上 variant。

import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/utils.js";

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

function Spinner() {
  return <span className="ui-button-spinner" aria-hidden="true" />;
}

export function Button({
  variant,
  size = "md",
  pending = false,
  type = "button",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  if (!variant) {
    return <button type={type} className={className} disabled={disabled} {...props}>{children}</button>;
  }
  return (
    <button
      type={type}
      className={cn("ui-button", className)}
      data-variant={variant}
      data-size={size}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}

export type IconButtonProps = NativeButtonProps & {
  /** 必填：读屏和悬停提示都用它。 */
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  children: ReactNode;
};

export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  pending = false,
  type = "button",
  className,
  disabled,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn("ui-icon-button", className)}
      data-variant={variant}
      data-size={size}
      aria-label={label}
      title={label}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <Spinner /> : children}
    </button>
  );
}
