// 从一边滑出的抽屉（radix Dialog）：焦点关在里面、Esc 和点外面关、关掉后焦点回到打开它的按钮。
// 给阅读器的面板、窄屏上的侧栏用；居中的弹窗用 Dialog。样子在 styles/sheet.css。

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";
import { IconButton } from "./button.js";

export type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  side?: "left" | "right";
  id?: string;
  className?: string;
  children: ReactNode;
};

export function Sheet({ open, onOpenChange, title, description, side = "right", id, className, children }: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-sheet-overlay" />
        <DialogPrimitive.Content
          id={id}
          className={cn("ui-sheet", className)}
          data-side={side}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <header className="ui-sheet-head">
            <DialogPrimitive.Title className="ui-sheet-title">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton label="关闭" size="sm">
                <X aria-hidden="true" />
              </IconButton>
            </DialogPrimitive.Close>
          </header>
          {description ? <DialogPrimitive.Description className="ui-sheet-description">{description}</DialogPrimitive.Description> : null}
          <div className="ui-sheet-body">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
