// 选择类：Checkbox（勾选框，可带文字）、SegmentedControl（几个里选一个的一排按钮）。样子在 styles/choice.css。
//
// SegmentedControl 是 radiogroup：只有选中的那个能 Tab 到，左右方向键换选项（选中跟着走），和系统单选一样。

import { useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "../lib/utils.js";

export type CheckboxProps = Omit<ComponentProps<"input">, "type"> & {
  /** 给了就包成 <label>，点字也能勾。 */
  label?: ReactNode;
};

export function Checkbox({ label, className, ...props }: CheckboxProps) {
  if (!label) return <input type="checkbox" className={cn("ui-checkbox-box", className)} {...props} />;
  return (
    <label className={cn("ui-checkbox", className)}>
      <input type="checkbox" className="ui-checkbox-box" {...props} />
      <span className="ui-checkbox-label">{label}</span>
    </label>
  );
}

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
  disabled?: boolean;
  className?: string;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const group = useRef<HTMLDivElement>(null);
  const enabled = options.filter((option) => !option.disabled);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step || !enabled.length) return;
    event.preventDefault();
    const at = enabled.findIndex((option) => option.value === value);
    const next = enabled[(at + step + enabled.length) % enabled.length];
    onChange(next.value);
    const buttons = group.current?.querySelectorAll<HTMLButtonElement>("[data-segment-value]") || [];
    Array.from(buttons).find((button) => button.dataset.segmentValue === next.value)?.focus();
  }

  return (
    <div ref={group} className={cn("ui-segmented", className)} role="radiogroup" aria-label={label} data-size={size}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className="ui-segmented-option"
            data-segment-value={option.value}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={onKeyDown}
            {...option.props}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
