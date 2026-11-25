// 白板上写字的框：直接写 Markdown，公式写在 `$…$` / `$$…$$` 里。为了公式好打：
// - 光标在公式里时，公式在光标上方实时画出来（写错时留着上一次画对的，停手一秒才说哪错了——照 notes-studio）；
// - 打 `\fr` 出补全菜单（带公式预览），↑↓ 选、回车 / Tab 填进去，`\frac{|}{}` 光标停在第一个空里；
// - `$` 自带收尾、`{` 自带 `}`、Tab 跳到下一个空 / 跳出公式、空 `{}` 退格一起删（math-typing.ts）。
// Esc 或 ⌘/Ctrl+回车 写完；点到框外也算写完（由外面的白板决定）。

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { applyCompletion, completeLatex, completionQuery, latexCommands, type LatexCommand } from "../math/latex-assist.js";
import { loadMathEngine, mathEngineReady, mathHtmlNow } from "../math/engine.js";
import { mathAtCaret } from "../markdown/math-markdown.js";
import { caretCoordinates, type CaretPoint } from "./caret-coordinates.js";
import { applyTextEdit, planBackspace, planBrace, planDollar, planTab, type TextEdit } from "./math-typing.js";

const COMMANDS = latexCommands();
/** 公式写错时等多久才说（打到一半总是错的）。 */
const ERROR_DELAY_MS = 1000;
/** 补全菜单的宽度：放得下命令名和它画出来的样子。 */
const MENU_WIDTH = 240;

export type MathMarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  /** Esc、⌘/Ctrl+回车：写完了。 */
  onDone?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
};

function useMathEngine(): boolean {
  const [ready, setReady] = useState(mathEngineReady());
  useEffect(() => {
    if (ready) return undefined;
    let cancelled = false;
    loadMathEngine().then(() => {
      if (!cancelled) setReady(true);
    }, () => {});
    return () => {
      cancelled = true;
    };
  }, [ready]);
  return ready;
}

export function MathMarkdownEditor({ value, onChange, onDone, autoFocus, placeholder, className }: MathMarkdownEditorProps) {
  const ready = useMathEngine();
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(value.length);
  const pendingCaret = useRef<number | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const [point, setPoint] = useState<CaretPoint | null>(null);

  // 文字变了以后把光标放到该去的地方（改动是我们替用户做的时）。
  useLayoutEffect(() => {
    const area = ref.current;
    if (!area) return;
    if (pendingCaret.current !== null) {
      area.setSelectionRange(pendingCaret.current, pendingCaret.current);
      setCaret(pendingCaret.current);
      pendingCaret.current = null;
    }
    // 高度跟着内容长。
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    if (!autoFocus || !ref.current) return;
    ref.current.focus();
    const end = ref.current.value.length;
    ref.current.setSelectionRange(end, end);
    setCaret(end);
  }, [autoFocus]);

  const math = useMemo(() => mathAtCaret(value, caret), [value, caret]);

  // 命令补全：光标前是 `\字母`。
  const query = math ? completionQuery(math.tex, caret - math.innerFrom) : null;
  const queryKey = query && math ? `${math.innerFrom + query.from}:${query.prefix}` : null;
  const options: LatexCommand[] = query && queryKey !== dismissedQuery ? completeLatex(query.prefix, COMMANDS) : [];
  // 光标处公式的预览：画得出就更新，画不出留着上一次的，停手一秒再说错在哪。
  const [lastGood, setLastGood] = useState<{ key: number; html: string } | null>(null);
  const [error, setError] = useState("");
  const rendered = ready && math && math.tex.trim() ? mathHtmlNow(math.tex, math.display) : null;
  useEffect(() => {
    if (!math) {
      setLastGood(null);
      setError("");
      return undefined;
    }
    // 正在打命令时（菜单开着）画出来的是半截命令，不当成「画对的」。
    if (rendered?.html && !options.length) {
      setLastGood({ key: math.innerFrom, html: rendered.html });
      setError("");
      return undefined;
    }
    if (!rendered?.error) return undefined;
    const timer = setTimeout(() => setError(rendered.error ?? ""), ERROR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [math?.innerFrom, math?.tex, rendered?.html, rendered?.error, options.length]);
  const previous = lastGood && math && lastGood.key === math.innerFrom ? lastGood.html : "";
  // 正在打命令（\fr…）时公式必然画不对：只给上一次画对的，不给一片红。
  const previewHtml = options.length ? previous : rendered?.html ?? previous;
  const showError = Boolean(error) && !options.length && !rendered?.html;

  useEffect(() => setMenuIndex(0), [queryKey]);

  useLayoutEffect(() => {
    if (!ref.current || (!math && !options.length)) {
      setPoint(null);
      return;
    }
    setPoint(caretCoordinates(ref.current, caret));
  }, [caret, value, Boolean(math), options.length]);

  const apply = (edit: TextEdit) => {
    const next = applyTextEdit(value, edit);
    if (next === value) {
      // 只挪光标（Tab 跳到下一个空、跳过收尾的 $）：文字没变就不会重新渲染，直接挪。
      ref.current?.setSelectionRange(edit.caret, edit.caret);
      setCaret(edit.caret);
      return;
    }
    pendingCaret.current = edit.caret;
    onChange(next);
  };

  const accept = (command: LatexCommand) => {
    if (!math || !query) return;
    const edit = applyCompletion(math.tex, query, command);
    apply({ from: edit.from + math.innerFrom, to: edit.to + math.innerFrom, insert: edit.insert, caret: edit.caret + math.innerFrom });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const area = event.currentTarget;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    if (event.nativeEvent.isComposing) return;
    if (options.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setMenuIndex((index) => (index + step + options.length) % options.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        accept(options[Math.min(menuIndex, options.length - 1)]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissedQuery(queryKey);
        return;
      }
    }
    if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
      event.preventDefault();
      onDone?.();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    let edit: TextEdit | null = null;
    if (event.key === "$") edit = planDollar(value, start, end);
    else if (event.key === "{" || event.key === "}") edit = planBrace(value, start, end, event.key);
    else if (event.key === "Backspace") edit = planBackspace(value, start, end);
    else if (event.key === "Tab" && !event.shiftKey) edit = planTab(value, start);
    if (edit) {
      event.preventDefault();
      apply(edit);
    }
  };

  const syncCaret = () => {
    if (ref.current) setCaret(ref.current.selectionStart);
  };

  return (
    <div className={`wbm-editor${className ? ` ${className}` : ""}`}>
      <textarea
        ref={ref}
        className="wbm-editor-input"
        value={value}
        rows={1}
        spellCheck={false}
        placeholder={placeholder ?? "写点什么……公式用 $…$，单独一块用 $$"}
        aria-label="写字（Markdown，公式用 $…$）"
        onChange={(event) => {
          setCaret(event.target.selectionStart);
          onChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onSelect={syncCaret}
      />
      {math && point && (previewHtml || showError || !ready) ? (
        <div
          className={`wbm-preview${math.display ? " is-display" : ""}${showError ? " has-error" : ""}`}
          style={{ left: Math.max(0, point.left - 8), top: point.top }}
          aria-live="polite"
        >
          {!ready ? <span className="wbm-preview-note">正在加载公式…</span> : null}
          {previewHtml ? <span className="wbm-preview-math" dangerouslySetInnerHTML={{ __html: previewHtml }} /> : null}
          {showError ? <span className="wbm-preview-error">{error}</span> : null}
        </div>
      ) : null}
      {options.length && point ? (
        <ul
          className="wbm-menu"
          role="listbox"
          aria-label="LaTeX 命令"
          // 不超出卡片右边（白板会把超出去的裁掉）。
          style={{ left: Math.max(0, Math.min(point.left, (ref.current?.clientWidth ?? 0) - MENU_WIDTH)), top: point.top + point.height + 4, width: MENU_WIDTH }}
        >
          {options.map((command, index) => {
            const preview = ready && command.preview ? mathHtmlNow(command.preview, false) : null;
            return (
              <li
                key={command.name}
                role="option"
                aria-selected={index === menuIndex}
                className={`wbm-menu-item${index === menuIndex ? " is-active" : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  accept(command);
                }}
                onMouseEnter={() => setMenuIndex(index)}
              >
                <code className="wbm-menu-name">{command.name}</code>
                {preview?.html ? <span className="wbm-menu-preview" dangerouslySetInnerHTML={{ __html: preview.html }} /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
