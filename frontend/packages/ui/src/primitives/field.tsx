// 输入：Field 管标题、说明、错误，Input / Textarea / Select 只管框。样子在 styles/field.css。
//
// Field 把标题和说明接到里面那个控件上（id、aria-describedby、aria-invalid），调用方不用自己拼。
// Select 是原生 <select> 加一个箭头：手机上原生的最好用，不做自绘下拉。

import { ChevronDown } from "lucide-react";
import { Children, cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";

import { cn } from "../lib/utils.js";

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

export function Field({ label, hint, error, className, children }: FieldProps) {
  const autoId = useId();
  const control = Children.only(children);
  const controlId = (isValidElement(control) && control.props.id) || `${autoId}-control`;
  const hintId = hint ? `${autoId}-hint` : "";
  const errorId = error ? `${autoId}-error` : "";
  const describedBy = [control.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("ui-field", className)} data-invalid={error ? "true" : undefined}>
      <label className="ui-field-label" htmlFor={controlId}>{label}</label>
      {hint ? <p id={hintId} className="ui-field-hint">{hint}</p> : null}
      {cloneElement(control, {
        id: controlId,
        "aria-describedby": describedBy,
        ...(error ? { "aria-invalid": true } : {}),
      })}
      {error ? <p id={errorId} className="ui-field-error" role="alert">{error}</p> : null}
    </div>
  );
}

export type InputProps = Omit<ComponentProps<"input">, "size"> & { size?: ControlSize };

export function Input({ size = "md", className, ...props }: InputProps) {
  return <input className={cn("ui-input", className)} data-size={size} {...props} />;
}

export type TextareaProps = ComponentProps<"textarea">;

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn("ui-textarea", className)} {...props} />;
}

export type SelectProps = Omit<ComponentProps<"select">, "size"> & {
  size?: ControlSize;
  /** 给外面那层（定宽度、外边距用）；其余属性都落在 <select> 上。 */
  className?: string;
};

export function Select({ size = "md", className, children, ...props }: SelectProps) {
  return (
    <span className={cn("ui-select", className)} data-size={size}>
      <select {...props}>{children}</select>
      <ChevronDown className="ui-select-arrow" aria-hidden="true" />
    </span>
  );
}
