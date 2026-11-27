// 标题栏的下拉（2026-11-27）：左边「主对话 ▾」那种对话菜单（宿主画里面的东西）和右边「···」都用它。
// 用 <details>：开合不用状态库，标题栏拖动时 Rnd 的 cancel 已经放过 summary；点外面、按 Esc 收起（<details> 自己只在点 summary 时开合）。
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@retainpdf/ui";

export type AskHeadMenuProps = {
  /** summary 里的东西（按钮的样子）。 */
  label: ReactNode;
  /** summary 的悬停提示和读屏名。 */
  title: string;
  className?: string;
  /** 下拉里的东西；给函数时拿到 close（点了一项收起）。 */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** 开了 / 收了（宿主按需读列表）。 */
  onOpenChange?: (open: boolean) => void;
};

export function AskHeadMenu({ label, title, className, children, onOpenChange }: AskHeadMenuProps): ReactElement {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDetailsElement | null>(null);
  const change = useRef(onOpenChange);
  change.current = onOpenChange;
  useEffect(() => {
    change.current?.(open);
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // 只收下拉，不关窗（AskWindow 的 Esc 看 defaultPrevented）。
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <details
      ref={root}
      className={`ask-head-menu${className ? ` ${className}` : ""}`}
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary aria-label={title} title={title}>{label}</summary>
      <div className="ask-head-menu-body">{typeof children === "function" ? children(close) : children}</div>
    </details>
  );
}

/** 「···」里的一项。 */
export type AskHeaderMenuItem = {
  key: string;
  label: string;
  /** 一句说明（灰的，写在下面）。 */
  hint?: string;
  icon?: ReactNode;
  onSelect: () => void;
};

/** 标题栏右边的「···」：不常用的（阅读页：记忆）。没有项就不画。 */
export function AskMoreMenu({ items }: { items: readonly AskHeaderMenuItem[] }): ReactElement | null {
  if (!items.length) return null;
  return (
    <AskHeadMenu className="ask-more" title={`更多：${items.map((item) => item.label).join("、")}`} label={<MoreHorizontal size={15} aria-hidden />}>
      {(close) => items.map((item) => (
        <Button
          key={item.key}
          className="ask-head-menu-item"
          onClick={() => {
            close();
            item.onSelect();
          }}
        >
          {item.icon ? <span className="ask-head-menu-icon">{item.icon}</span> : null}
          <span className="ask-head-menu-text">
            <span>{item.label}</span>
            {item.hint ? <small>{item.hint}</small> : null}
          </span>
        </Button>
      ))}
    </AskHeadMenu>
  );
}
