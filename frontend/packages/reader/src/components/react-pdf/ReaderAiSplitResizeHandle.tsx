import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  Group,
  Panel,
  Separator,
  type Layout,
  type LayoutChangedMeta,
} from "react-resizable-panels";

const DOCUMENT_PANEL_ID = "reader-document";
const ASSISTANT_PANEL_ID = "reader-assistant";
const STORAGE_KEY = "retainpdf.reader.ai-split-layout.v1";
const MIN_ASSISTANT_PERCENT = 30;
const MAX_ASSISTANT_PERCENT = 65;

const DEFAULT_LAYOUT: Layout = {
  [DOCUMENT_PANEL_ID]: 50,
  [ASSISTANT_PANEL_ID]: 50,
};

export function normalizeReaderAiSplitLayout(
  layout: Partial<Layout> | null | undefined,
): Layout {
  const rawAssistant = Number(layout?.[ASSISTANT_PANEL_ID]);
  const assistant = Number.isFinite(rawAssistant)
    ? Math.min(MAX_ASSISTANT_PERCENT, Math.max(MIN_ASSISTANT_PERCENT, rawAssistant))
    : 50;
  return {
    [DOCUMENT_PANEL_ID]: 100 - assistant,
    [ASSISTANT_PANEL_ID]: assistant,
  };
}

function loadLayout(): Layout {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<Layout> | null;
    return normalizeReaderAiSplitLayout(stored);
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(layout: Layout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeReaderAiSplitLayout(layout)));
  } catch {
    // Storage may be disabled; resizing should still work for this session.
  }
}

function applyAssistantWidth(group: HTMLDivElement | null, layout: Layout): void {
  const root = group?.closest<HTMLElement>(".reader-react-root");
  if (!root) return;
  const normalized = normalizeReaderAiSplitLayout(layout);
  root.style.setProperty(
    "--reader-ai-split-width",
    `${normalized[ASSISTANT_PANEL_ID]}vw`,
  );
}

/**
 * Transparent layout controller over the existing Reader panes. The library owns
 * pointer/keyboard resizing; the real PDF and AI panes follow one CSS variable.
 */
export function ReaderAiSplitResizeHandle() {
  const groupRef = useRef<HTMLDivElement | null>(null);
  const [defaultLayout] = useState(loadLayout);

  useLayoutEffect(() => {
    const group = groupRef.current;
    applyAssistantWidth(group, defaultLayout);
    return () => {
      group?.closest<HTMLElement>(".reader-react-root")
        ?.style.removeProperty("--reader-ai-split-width");
    };
  }, [defaultLayout]);

  const handleLayoutChange = useCallback((layout: Layout) => {
    applyAssistantWidth(groupRef.current, layout);
  }, []);

  const handleLayoutChanged = useCallback((layout: Layout, meta: LayoutChangedMeta) => {
    applyAssistantWidth(groupRef.current, layout);
    if (meta.isUserInteraction) saveLayout(layout);
  }, []);

  return (
    <Group
      id="reader-ai-split"
      className="reader-ai-split-resizer"
      elementRef={groupRef}
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChange={handleLayoutChange}
      onLayoutChanged={handleLayoutChanged}
      resizeTargetMinimumSize={{ fine: 12, coarse: 28 }}
    >
      <Panel
        id={DOCUMENT_PANEL_ID}
        defaultSize="50%"
        minSize="35%"
        maxSize="70%"
      />
      <Separator
        id="reader-ai-split-separator"
        className="reader-ai-split-separator"
        aria-label="调整文档与 AI 问答宽度"
      >
        <span aria-hidden="true" />
      </Separator>
      <Panel
        id={ASSISTANT_PANEL_ID}
        defaultSize="50%"
        minSize="30%"
        maxSize="65%"
      />
    </Group>
  );
}
