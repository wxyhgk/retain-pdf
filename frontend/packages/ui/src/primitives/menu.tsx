// 点开的选项列表（radix DropdownMenu）：键盘上下选、回车选中、Esc 关、焦点回到按钮。样子在 styles/menu.css。
//
// trigger 是一个按钮元素（通常是 Button 或 IconButton），由 Menu 接上开关。

import { DropdownMenu } from "radix-ui";
import type { ReactElement, ReactNode } from "react";

import { cn } from "../lib/utils.js";

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

export function Menu({ trigger, items, align = "start", label, className, open, onOpenChange }: MenuProps) {
  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={cn("ui-menu", className)} align={align} sideOffset={4} aria-label={label}>
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.key}
              className="ui-menu-item"
              disabled={item.disabled}
              data-danger={item.danger ? "true" : undefined}
              onSelect={() => item.onSelect()}
            >
              {item.icon ? <span className="ui-menu-icon" aria-hidden="true">{item.icon}</span> : null}
              <span className="ui-menu-label">{item.label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
