// 画笔的工具条：右键书页弹出的小菜单（在鼠标那儿），和画笔模式下左下角常驻的一条（换笔、换色、撤销、退出）。
// 两处是同一排按钮（InkTools），只用图标，名字在悬停里。
// 右键：书页区里右键出这个菜单；按住 Shift 再右键是浏览器自己的菜单；输入框里右键照旧。
// 快捷键：P 进入 / 退出画笔，Esc 退出，画笔模式下 ⌘Z / Ctrl+Z 撤销（光标在输入框里时都不接）。
import { useEffect, useRef, type ReactElement } from "react";
import { Eraser, Highlighter, PenLine, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@retainpdf/ui";

import { INK_COLORS, type InkTool, type ReaderInk } from "../../hooks/use-reader-ink.js";
import { READER_PAGE_ATTR, READER_SCROLL_SHELL_CLASS } from "../../pdf/reader-dom-contract.js";

const TOOLS: Array<{ tool: InkTool; label: string; Icon: typeof PenLine }> = [
  { tool: "pen", label: "画笔", Icon: PenLine },
  { tool: "highlighter", label: "荧光笔", Icon: Highlighter },
  { tool: "eraser", label: "橡皮", Icon: Eraser },
];

export type InkMenuState = { x: number; y: number; page: number } | null;

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

/** 一排按钮：三种笔、几种颜色、撤销、清掉这一页（右键菜单里才有）、退出画笔（在画笔模式时才有）。 */
function InkTools({ ink, page = 0, onPick }: { ink: ReaderInk; page?: number; onPick?: () => void }): ReactElement {
  const done = () => onPick?.();
  return (
    <>
      {TOOLS.map(({ tool, label, Icon }) => (
        <Button
          key={tool}
          className="reader-ink-tool"
          aria-label={label}
          title={label}
          aria-pressed={ink.tool === tool}
          data-ink-tool={tool}
          onClick={() => {
            ink.setTool(ink.tool === tool ? null : tool);
            done();
          }}
        >
          <Icon size={17} strokeWidth={2} aria-hidden />
        </Button>
      ))}
      <span className="reader-ink-sep" aria-hidden />
      {INK_COLORS.map((color) => (
        <Button
          key={color.key}
          className="reader-ink-color"
          aria-label={`${color.label}色`}
          title={`${color.label}色`}
          aria-pressed={ink.color === color.key}
          data-ink-color={color.key}
          style={{ color: `var(--${color.key})` }}
          onClick={() => {
            ink.setColor(color.key);
            if (!ink.tool || ink.tool === "eraser") ink.setTool("pen");
            done();
          }}
        >
          <span aria-hidden />
        </Button>
      ))}
      <span className="reader-ink-sep" aria-hidden />
      <Button className="reader-ink-tool" aria-label="撤销" title="撤销（⌘Z）" onClick={ink.undo}>
        <Undo2 size={17} strokeWidth={2} aria-hidden />
      </Button>
      {page > 0 ? (
        <Button
          className="reader-ink-tool"
          aria-label={`清掉第 ${page} 页的笔迹`}
          title={`清掉第 ${page} 页的笔迹`}
          onClick={() => {
            ink.clearPage(page);
            done();
          }}
        >
          <Trash2 size={17} strokeWidth={2} aria-hidden />
        </Button>
      ) : null}
      {ink.tool ? (
        <Button
          className="reader-ink-tool"
          aria-label="退出画笔"
          title="退出画笔（Esc）"
          data-ink-exit="true"
          onClick={() => {
            ink.setTool(null);
            done();
          }}
        >
          <X size={17} strokeWidth={2} aria-hidden />
        </Button>
      ) : null}
    </>
  );
}

/** 右键书页弹出的菜单（钉在鼠标位置，贴边时往里收）。 */
/** 右键菜单画笔那一排上面的一行（阅读页提问：「在这里提问」「问这段」）。 */
export type InkMenuAction = { key: string; label: string; hint?: string; onSelect: () => void };

export function ReaderInkMenu({
  ink,
  menu,
  onClose,
  actions = [],
}: {
  ink: ReaderInk;
  menu: InkMenuState;
  onClose: () => void;
  actions?: readonly InkMenuAction[];
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
      <div className="reader-ink-bar is-menu" role="menu" aria-label="画笔">
        <InkTools ink={ink} page={menu.page} onPick={onClose} />
      </div>
    </div>
  );
}

/** 画笔模式下左下角常驻的那一条。 */
export function ReaderInkDock({ ink }: { ink: ReaderInk }): ReactElement | null {
  if (!ink.tool) return null;
  return (
    <div className="reader-ink-bar is-dock" role="toolbar" aria-label="画笔" data-ink-dock="true">
      <InkTools ink={ink} />
    </div>
  );
}

/** 右键：书页区里出画笔菜单（Shift+右键、输入框里照旧是浏览器的菜单）。返回要不要接这次右键。 */
export function inkMenuFromContextMenu(event: { shiftKey: boolean; target: EventTarget | null; clientX: number; clientY: number }): InkMenuState {
  if (event.shiftKey || isTyping(event.target)) return null;
  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest(`.${READER_SCROLL_SHELL_CLASS}`)) return null;
  const page = Number(target.closest(`[${READER_PAGE_ATTR}]`)?.getAttribute(READER_PAGE_ATTR)) || 0;
  return { x: event.clientX, y: event.clientY, page };
}

/** P 进入 / 退出画笔，Esc 退出，画笔模式下 ⌘Z / Ctrl+Z 撤销。 */
export function useInkShortcuts(ink: ReaderInk): void {
  const ref = useRef(ink);
  ref.current = ink;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const current = ref.current;
      const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
      if (plain && !event.repeat && (event.key === "p" || event.key === "P")) {
        event.preventDefault();
        current.setTool(current.tool ? null : "pen");
      } else if (event.key === "Escape" && current.tool) {
        current.setTool(null);
      } else if (current.tool && (event.metaKey || event.ctrlKey) && !event.shiftKey && (event.key === "z" || event.key === "Z")) {
        event.preventDefault();
        current.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
