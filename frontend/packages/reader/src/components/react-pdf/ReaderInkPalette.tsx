// 画笔的工具条：右键书页弹出的菜单里那一排（ReaderInkMenuSection，菜单本身是 ReaderPageMenu），和画笔模式下左下角常驻的一条（换笔、换色、撤销、退出）。
// 两处是同一排按钮（InkTools），只用图标，名字在悬停里。
// 快捷键：P 进入 / 退出画笔，Esc 退出，画笔模式下 ⌘Z / Ctrl+Z 撤销（光标在输入框里时都不接）。
import { useEffect, useRef, type ReactElement } from "react";
import { Eraser, Highlighter, PenLine, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@retainpdf/ui";

import { INK_COLORS, type InkTool, type ReaderInk } from "../../hooks/use-reader-ink.js";

const TOOLS: Array<{ tool: InkTool; label: string; Icon: typeof PenLine }> = [
  { tool: "pen", label: "画笔", Icon: PenLine },
  { tool: "highlighter", label: "荧光笔", Icon: Highlighter },
  { tool: "eraser", label: "橡皮", Icon: Eraser },
];

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

/** 右键菜单里画笔那一排（画笔扩展登记的 menuSection；菜单本身是 ReaderPageMenu）。 */
export function ReaderInkMenuSection({ ink, page, onPick }: { ink: ReaderInk; page: number; onPick: () => void }): ReactElement {
  return (
    <div className="reader-ink-bar is-menu" role="menu" aria-label="画笔">
      <InkTools ink={ink} page={page} onPick={onPick} />
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
