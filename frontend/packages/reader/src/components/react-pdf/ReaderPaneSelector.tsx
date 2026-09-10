import { useEffect, useRef, useState, type FocusEvent, type ReactElement } from "react";
import { Check, FileCode2, FileText, GripVertical, Languages, Sparkles } from "lucide-react";

export type ReaderPaneContent = "source" | "translated" | "markdown" | "ai";
export type ReaderPaneSide = "left" | "right";

const CONTENT_META = {
  source: { label: "源文件", Icon: FileText },
  translated: { label: "翻译文件", Icon: Languages },
  markdown: { label: "Markdown", Icon: FileCode2 },
  ai: { label: "AI 问答", Icon: Sparkles },
} as const;

export type ReaderPaneSelectorProps = {
  side: ReaderPaneSide;
  value: ReaderPaneContent;
  options: readonly ReaderPaneContent[];
  onChange: (value: ReaderPaneContent) => void;
};

export function ReaderPaneSelector({
  side,
  value,
  options,
  onChange,
}: ReaderPaneSelectorProps): ReactElement {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const sideLabel = side === "left" ? "左侧" : "右侧";
  const cancelScheduledClose = () => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };
  const openMenu = () => {
    cancelScheduledClose();
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 360);
  };
  const closeAfterBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  };

  useEffect(() => () => cancelScheduledClose(), []);

  return (
    <div
      className={`reader-pane-selector is-${side}${open ? " is-open" : ""}`}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
      onFocusCapture={openMenu}
      onBlurCapture={closeAfterBlur}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        setOpen(false);
      }}
    >
      <button
        type="button"
        className="reader-pane-selector-trigger"
        aria-label={`${sideLabel}窗格内容：${CONTENT_META[value].label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`切换${sideLabel}内容`}
        onClick={openMenu}
      >
        <GripVertical size={16} strokeWidth={2.4} aria-hidden />
      </button>
      {open ? (
        <div className="reader-pane-selector-menu" role="menu" aria-label={`${sideLabel}窗格可选内容`}>
          {options.map((option) => {
            const { Icon, label } = CONTENT_META[option];
            const selected = value === option;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={selected ? "is-selected" : ""}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <Icon size={15} strokeWidth={2} aria-hidden />
                <span>{label}</span>
                {selected ? <Check size={14} strokeWidth={2.4} aria-hidden /> : <span className="reader-pane-selector-check-space" />}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
