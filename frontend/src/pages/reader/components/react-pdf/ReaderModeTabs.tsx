import { Columns2, FileText, Languages } from "lucide-react";
import type { ReaderMode } from "../../hooks/use-reader-session.js";

const MODES: {
  id: ReaderMode;
  label: string;
  Icon: typeof FileText;
}[] = [
  { id: "source", label: "Bản gốc", Icon: FileText },
  { id: "translated", label: "Bản dịch", Icon: Languages },
  { id: "compare", label: "Đọc đối chiếu", Icon: Columns2 },
];

export type ReaderModeTabsProps = {
  mode: ReaderMode;
  sourceOnly: boolean;
  onModeChange: (mode: ReaderMode) => void;
};

export function ReaderModeTabs({
  mode,
  sourceOnly,
  onModeChange,
}: ReaderModeTabsProps): JSX.Element {
  return (
    <header className="reader-topbar reader-react-topbar">
      <div className="reader-tabs" role="tablist" aria-label="Chế độ đọc">
        {MODES.map((item) => {
          if (sourceOnly && item.id !== "source") {
            return null;
          }
          const active = mode === item.id;
          const { Icon } = item;
          return (
            <button
              key={item.id}
              type="button"
              className={`reader-tab reader-tab-icon${active ? " is-active" : ""}`}
              role="tab"
              aria-selected={active}
              aria-label={item.label}
              title={item.label}
              data-reader-mode={item.id}
              onClick={() => onModeChange(item.id)}
            >
              <Icon className="reader-tab-lucide" size={16} strokeWidth={2.25} aria-hidden />
              <span className="sr-only">{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
