// 右键书页弹出的菜单（钉在鼠标位置，贴边时往里收）：上面一行是扩展登记的菜单项（提问的「在这里提问 / 问这段」），
// 下面是扩展登记的几块（画笔的笔和颜色那一排）。2026-11-27 从画笔里拆出来（以前叫 ReaderInkMenu，画笔那一排写死在里面），
// class 名照旧是 reader-ink-menu*（样式在 ink.css，没改名免得样式和测试一起动）。
// 右键：书页区里出这个菜单；按住 Shift 再右键、输入框里、书页外照旧是浏览器自己的菜单；没有扩展往菜单里放东西也是浏览器的。
import { Fragment, useEffect, useRef, type ReactElement } from "react";
import { Button } from "@retainpdf/ui";

import type { ReaderMenuSection } from "../../extensions/registry.js";
import type { ReaderMenuItem } from "../../extensions/types.js";
import { READER_PAGE_ATTR, READER_SCROLL_SHELL_CLASS } from "../../pdf/reader-dom-contract.js";

export type ReaderPageMenuState = { x: number; y: number; page: number } | null;

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

/** 这次右键要不要接（书页区里、没按 Shift、不在输入框里），接的话菜单钉在哪、是第几页（认不出是 0）。 */
export function pageMenuFromContextMenu(event: { shiftKey: boolean; target: EventTarget | null; clientX: number; clientY: number }): ReaderPageMenuState {
  if (event.shiftKey || isTyping(event.target)) return null;
  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest(`.${READER_SCROLL_SHELL_CLASS}`)) return null;
  const page = Number(target.closest(`[${READER_PAGE_ATTR}]`)?.getAttribute(READER_PAGE_ATTR)) || 0;
  return { x: event.clientX, y: event.clientY, page };
}

export function ReaderPageMenu({
  menu,
  onClose,
  actions,
  sections,
}: {
  menu: ReaderPageMenuState;
  onClose: () => void;
  actions: readonly ReaderMenuItem[];
  sections: readonly ReaderMenuSection[];
}): ReactElement | null {
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menu) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, onClose]);
  if (!menu) return null;
  const width = 380;
  const left = Math.max(8, Math.min(menu.x, (globalThis.innerWidth || width) - width - 8));
  const top = Math.max(68, Math.min(menu.y, (globalThis.innerHeight || 600) - 60 - (actions.length ? 40 : 0)));
  return (
    <div ref={root} className="reader-ink-menu" style={{ left, top }} data-ink-menu="true">
      {actions.length ? (
        <div className="reader-ink-menu-actions" role="menu" aria-label="书页">
          {actions.map((action) => (
            <Button
              key={action.key}
              className="reader-ink-menu-action"
              role="menuitem"
              title={action.hint}
              onClick={() => {
                action.onSelect();
                onClose();
              }}
            >
              {action.label}
              {action.hint ? <kbd>{action.hint}</kbd> : null}
            </Button>
          ))}
        </div>
      ) : null}
      {sections.map((section) => <Fragment key={section.id}>{section.render({ page: menu.page, close: onClose })}</Fragment>)}
    </div>
  );
}
