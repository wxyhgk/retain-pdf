// 在译文栏的框里直接改一段译文。
//
// - 大块：编辑框盖在这一段原来的位置上，往下按内容长；小块（标题、单行、行间公式）：在这一段下面（放不下就上面）
//   弹一个放大的框，原来那段描一圈框着（inlineEditLayout）。
// - 对照读的时候左边就是原文（悬停时两栏同一段一起框出来），框里不再放；只看译文时框顶上一行原文，点开看全。
// - 有公式（$…$）时下面实时预览排出来的样子。
// - 下面一条工具条：上一段 / 下一段（Alt+↑/↓）、原因、历史（N）、取消（Esc）、保存（⌘/Ctrl+Enter）。
//   存好就收起，PDF 上这段先盖着新译文、标「待排版」，右下角「改了 N 处 · 重新排版」。
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { Button, IconButton, Input, Textarea } from "@retainpdf/ui";
import type { ReaderRegion } from "../shared/data/reader-regions.js";
import { editableBlockIds, inlineEditLayout, revisionTime } from "../shared/data/block-edit.js";
import type { ReaderBlockEdit } from "../hooks/use-reader-block-edit.js";
import { useBlockEditor } from "../components/react-pdf/use-block-editor.js";
import { prepareLiveTranslationMathHtml } from "./LiveTranslationOverlay.js";
import type { ReaderTextHoverTarget } from "./ReaderTextHoverLayer.js";

export const READER_INLINE_EDIT_CLASS = "reader-inline-edit";

/** 公式预览：停手 250ms 再渲染，打字时不卡。没有公式不画。 */
function MathPreview({ text }: { text: string }) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    if (!/\$|\\\(|\\\[/.test(text)) {
      setHtml("");
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      const prepared = prepareLiveTranslationMathHtml(text);
      setHtml(prepared.fallbackHtml);
      void prepared.richHtml.then((rich) => { if (active) setHtml(rich); });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [text]);
  if (!html) return null;
  return (
    <div className="reader-inline-edit-preview" data-inline-edit-preview="true">
      <span className="reader-inline-edit-preview-label">预览</span>
      <div className="reader-live-translation-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export function ReaderInlineBlockEditor({
  target,
  page,
  edit,
  showSource,
  regions,
  jumpToBlock,
}: {
  target: ReaderTextHoverTarget;
  page: { width: number; height: number };
  edit: ReaderBlockEdit;
  /** 只看译文（左边没有原文）时框顶上放一行原文。 */
  showSource: boolean;
  regions: readonly ReaderRegion[] | null | undefined;
  jumpToBlock?: (itemId: string) => void;
}) {
  const readerItemId = target.itemId;
  const editor = useBlockEditor({
    port: edit.available && !edit.blockedReason ? edit.port : null,
    jobId: edit.ownerJobId,
    readerItemId,
    memory: edit.memory,
    onSaved: edit.markSaved,
  });
  const [sourceOpen, setSourceOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const layout = inlineEditLayout(target.rect, page);
  const order = useMemo(() => editableBlockIds(regions), [regions]);
  const index = order.indexOf(readerItemId);
  const { loaded } = editor;
  const busy = editor.saving || editor.loading;
  const blocked = edit.blockedReason;
  const unchanged = !loaded || editor.draft === loaded.current;
  const { close, select } = edit;

  const go = useCallback((step: number) => {
    const next = order[index + step];
    if (!next) return;
    select(next);
    jumpToBlock?.(next);
  }, [order, index, select, jumpToBlock]);

  const cancel = useCallback(() => {
    editor.discardDraft();
    close();
  }, [editor, close]);

  const save = useCallback(async (text?: string, why?: string) => {
    if (await editor.save(text, why)) close();
  }, [editor, close]);

  // Alt+↑/↓ 换段：编辑框开着时在哪都管用（框里打字时也是）。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
      event.preventDefault();
      go(event.key === "ArrowUp" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // 编辑框按内容长高：盖在原位时至少和原来那段一样高。
  useLayoutEffect(() => {
    const area = textRef.current;
    if (!area) return;
    area.style.height = "auto";
    const floor = layout.mode === "inline" ? layout.minHeight : 0;
    area.style.height = `${Math.max(floor, area.scrollHeight + 2)}px`;
  }, [editor.draft, loaded, layout.mode, layout.mode === "inline" ? layout.minHeight : 0]);

  const style = layout.mode === "inline"
    ? { left: layout.left, top: layout.top, width: layout.width }
    : { left: layout.left, width: layout.width, top: layout.top, bottom: layout.bottom };

  return (
    <>
      {layout.mode === "popout" ? (
        <div className="reader-inline-edit-frame" style={target.rect} aria-hidden="true" />
      ) : null}
      <div
        className={`${READER_INLINE_EDIT_CLASS} is-${layout.mode}`}
        style={style}
        role="group"
        aria-label={`改第 ${edit.target?.page || "?"} 页这一段译文`}
        data-inline-edit-id={readerItemId}
        data-inline-edit-mode={layout.mode}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {showSource && loaded?.source ? (
          <Button
            className={`reader-inline-edit-source${sourceOpen ? " is-open" : ""}`}
            data-block-edit-source="true"
            title={sourceOpen ? "收起原文" : "展开原文"}
            onClick={() => setSourceOpen((open) => !open)}
          >
            {loaded.source}
          </Button>
        ) : null}
        {blocked ? <p className="reader-inline-edit-note is-blocked" data-block-edit-blocked="true">{blocked}</p> : null}
        {editor.loading ? <p className="reader-inline-edit-note">正在读这一段…</p> : null}
        {loaded ? (
          <Textarea
            ref={textRef}
            id="reader-block-edit-text"
            className="reader-inline-edit-text"
            rows={2}
            value={editor.draft}
            disabled={busy || Boolean(blocked)}
            aria-label="译文"
            autoFocus
            onChange={(event) => editor.setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (!unchanged) void save();
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
          />
        ) : null}
        {loaded ? <MathPreview text={editor.draft} /> : null}
        <div className="reader-inline-edit-toolbar">
          <IconButton className="reader-inline-edit-step" size="sm" label="上一段（Alt+↑）" disabled={index <= 0} onClick={() => go(-1)}>
            <ChevronUp size={14} aria-hidden />
          </IconButton>
          <IconButton className="reader-inline-edit-step" size="sm" label="下一段（Alt+↓）" disabled={index < 0 || index >= order.length - 1} onClick={() => go(1)}>
            <ChevronDown size={14} aria-hidden />
          </IconButton>
          <Input
            size="sm"
            className="reader-inline-edit-reason"
            value={editor.reason}
            placeholder="原因（可不填）"
            aria-label="修改原因"
            disabled={busy || Boolean(blocked) || !loaded}
            onChange={(event) => editor.setReason(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!unchanged) void save();
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
          />
          {editor.history.length ? (
            <Button
              className="reader-inline-edit-act"
              variant="ghost"
              size="sm"
              aria-expanded={historyOpen}
              data-block-edit-action="history"
              onClick={() => setHistoryOpen((open) => !open)}
            >
              <History size={13} aria-hidden />
              {editor.history.length - 1}
            </Button>
          ) : null}
          <Button className="reader-inline-edit-act" variant="ghost" size="sm" data-block-edit-action="cancel" onClick={cancel}>取消</Button>
          <Button
            className="reader-inline-edit-act"
            variant="primary"
            size="sm"
            data-block-edit-action="save"
            disabled={busy || Boolean(blocked) || unchanged || !editor.draft.trim()}
            pending={editor.saving}
            onClick={() => { void save(); }}
          >保存</Button>
        </div>
        {editor.status ? (
          <p className={`reader-inline-edit-status is-${editor.status.tone}`} role={editor.status.tone === "error" ? "alert" : "status"}>
            {editor.status.message}
          </p>
        ) : null}
        {editor.issues.length ? (
          <ul className="reader-inline-edit-issues" data-block-edit-issues="true">
            {editor.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        ) : null}
        {historyOpen && loaded && editor.history.length ? (
          <ol className="reader-inline-edit-history" aria-label="修订历史">
            {editor.history.map((entry, position) => {
              const isCurrent = entry.text === loaded.current;
              const when = [revisionTime(entry.ts), entry.label].filter(Boolean).join(" · ");
              return (
                <li key={`${entry.ts}:${position}`} data-block-edit-history={entry.label} data-current={isCurrent ? "true" : undefined}>
                  <div className="reader-inline-edit-history-meta">
                    <span>{when}{isCurrent ? "（现在用的）" : ""}{entry.reason ? ` · ${entry.reason}` : ""}</span>
                    {isCurrent ? null : (
                      <Button
                        className="reader-inline-edit-act"
                        variant="ghost"
                        size="sm"
                        data-block-edit-action="restore"
                        disabled={busy || Boolean(blocked)}
                        onClick={() => { void save(entry.text, `回到「${when.replace(" · ", " ")}」那一版`); }}
                      >用这版</Button>
                    )}
                  </div>
                  <p className="reader-inline-edit-history-text">{entry.text}</p>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </>
  );
}
