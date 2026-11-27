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

/** 下拉里的一项：左边图标、名字（下面一行灰的说明）、右边可以再放一点东西（条数）。宿主的下拉（阅读页的对话菜单）也用它，不用直接写这里的类名。 */
export function AskHeadMenuItem({ icon, label, hint, trailing, current, disabled, onClick }: {
  icon?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  trailing?: ReactNode;
  /** 现在看的就是这一项。 */
  current?: boolean;
  disabled?: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <Button className="ask-head-menu-item" data-current={current ? "true" : undefined} disabled={disabled} onClick={onClick}>
      {icon ? <span className="ask-head-menu-icon">{icon}</span> : null}
      <span className="ask-head-menu-text">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </span>
      {trailing ? <small className="ask-head-menu-trailing">{trailing}</small> : null}
    </Button>
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
        <AskHeadMenuItem
          key={item.key}
          icon={item.icon}
          label={item.label}
          hint={item.hint}
          onClick={() => {
            close();
            item.onSelect();
          }}
        />
      ))}
    </AskHeadMenu>
  );
}
