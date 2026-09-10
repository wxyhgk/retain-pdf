import type { ReactElement } from "react";
import { Columns2, FileText, Languages } from "lucide-react";
import type { ReaderMode } from "../../hooks/use-reader-session.js";

const MODES: {
  id: ReaderMode;
  label: string;
  Icon: typeof FileText;
}[] = [
  { id: "source", label: "源文件", Icon: FileText },
  { id: "compare", label: "对照", Icon: Columns2 },
  { id: "translated", label: "翻译文件", Icon: Languages },
];

export type ReaderModeTabsProps = {
  mode: ReaderMode;
  sourceOnly: boolean;
  onModeChange: (mode: ReaderMode) => void;
  placement?: "top" | "context";
  splitView?: boolean;
};

export function ReaderModeTabs({
  mode,
  sourceOnly,
  onModeChange,
  placement = "top",
  splitView = false,
}: ReaderModeTabsProps): ReactElement {
  const Tag = placement === "context" ? "div" : "header";
  return (
    <Tag
      className={`${placement === "context" ? "reader-context-modes" : "reader-topbar reader-react-topbar"}${sourceOnly ? " is-source-only" : ""}`}
      aria-label={placement === "context" ? "PDF 显示方式" : undefined}
    >
      <div className="reader-tabs" role="tablist" aria-label="阅读模式">
        {MODES.map((item) => {
          if (splitView && item.id === "compare") {
            return null;
          }
          if (sourceOnly && item.id !== "source") {
            return null;
          }
          const active = mode === item.id;
          const { Icon } = item;
          return (
            <button
              key={item.id}
              type="button"
              className={`reader-tab reader-tab-mode${active ? " is-active" : ""}`}
              role="tab"
              aria-selected={active}
              aria-label={item.label}
              title={item.label}
              data-reader-mode={item.id}
              onClick={() => onModeChange(item.id)}
            >
              <Icon className="reader-tab-lucide" size={16} strokeWidth={2.25} aria-hidden />
            </button>
          );
        })}
      </div>
    </Tag>
  );
}
