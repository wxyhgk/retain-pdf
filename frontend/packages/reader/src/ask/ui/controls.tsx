// assistant-ui 官方组件里用的 shadcn Button / Textarea，转到我们的基础组件（@retainpdf/ui）：
// 阅读器不许再写原生 <button> / <textarea>（手写控件棘轮），也不引第二套按钮样式。
// 变体对照：default → primary，outline / secondary → secondary，ghost → ghost，destructive → danger；尺寸 icon / sm → sm。
import { forwardRef, type ComponentProps } from "react";
import { Button as UiButton, Textarea as UiTextarea } from "@retainpdf/ui";

type ShadcnVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
type ShadcnSize = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-xs" | "xs";

const VARIANT: Record<ShadcnVariant, "primary" | "secondary" | "ghost" | "danger"> = {
  default: "primary",
  outline: "secondary",
  secondary: "secondary",
  ghost: "ghost",
  destructive: "danger",
  link: "ghost",
};

export type ButtonProps = Omit<ComponentProps<typeof UiButton>, "variant" | "size"> & {
  variant?: ShadcnVariant;
  size?: ShadcnSize;
  asChild?: boolean;
};

// 样式挂在 reader-ask-action 上（styles/ask.css）：阅读页没引组件库的按钮样式，也不在这里另造 *-button 类名。
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "default", size = "default", asChild: _asChild, className, ...props }, ref) {
  return (
    <UiButton
      ref={ref}
      variant={VARIANT[variant] ?? "secondary"}
      size={size === "lg" ? "lg" : size === "default" ? "md" : "sm"}
      className={className ? `reader-ask-action ${className}` : "reader-ask-action"}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea(props, ref) {
  return <UiTextarea ref={ref} {...props} />;
});
