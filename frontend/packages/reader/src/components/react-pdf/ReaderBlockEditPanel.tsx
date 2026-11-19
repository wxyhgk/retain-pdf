// 侧栏「改译文」：改阅读页上的一段译文。左边 PDF 照常看，这里上面是原文、中间是可改的译文、下面是修订历史。
//
// - 选块：译文上悬停框里点「改」，或者鼠标停在一块上按 E；面板里「上一段 / 下一段」（Alt+↑/↓）顺着往下改。
// - 存：PATCH 写回（source=user），不排版；PDF 上先盖着新译文。顶上一条「改了 N 处，还没排进 PDF · 重新排版」，
//   点了才整本重排（原地，大书要几分钟），排完 PDF 自动换成新的。
// - 历史：每次写回一条，「用这版」就是再写回一次那段文字，不会丢东西。
import { useCallback, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button, IconButton, Input, Textarea } from "@retainpdf/ui";
import type { ReaderRegion } from "../../shared/data/reader-regions.js";
import { readerRegionKindForRegion } from "../../shared/data/reader-regions.js";
import { revisionTime } from "../../shared/data/block-edit.js";
import type { ReaderBlockEdit } from "../../hooks/use-reader-block-edit.js";
import { ReaderPanelShell } from "./ReaderPanelShell.js";
import { useBlockEditor } from "./use-block-editor.js";

const EDITABLE_KINDS = new Set(["text", "formula", "table"]);

/** 能改的块（正文、公式、表格）按阅读顺序排好，给「上一段 / 下一段」用。 */
export function editableBlockIds(regions: readonly ReaderRegion[] | null | undefined): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const region of regions || []) {
    const id = `${region?.itemId || ""}`.trim();
    if (!id || seen.has(id) || !EDITABLE_KINDS.has(readerRegionKindForRegion(region))) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** 顶上那条：还有几处没排进 PDF、排版进行到哪了。 */
export function PendingRerenderBar({ edit }: { edit: ReaderBlockEdit }) {
  const count = edit.pendingEdits.size;
  const { rerender } = edit;
  if (rerender.phase === "running" || rerender.phase === "submitting") {
    return (
      <p className="reader-block-edit-pending is-running" role="status" data-block-edit-rerender="running">
        正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。
      </p>
    );
  }
  if (!count && rerender.phase !== "failed") return null;
  return (
    <div className="reader-block-edit-pending" role="status" data-block-edit-pending={count}>
      <span>{rerender.phase === "failed" ? rerender.message : `改了 ${count} 处，还没排进 PDF。`}</span>
      {count ? (
        <Button className="reader-block-edit-act" size="sm" variant="secondary" data-block-edit-action="rerender" onClick={() => { void edit.startRerender(); }}>
          重新排版
        </Button>
      ) : null}
    </div>
  );
}

export function ReaderBlockEditPanel({
  open,
  onClose,
  edit,
  regions,
  jumpToBlock,
}: {
  open: boolean;
  onClose: () => void;
  edit: ReaderBlockEdit;
  regions: readonly ReaderRegion[] | null | undefined;
  jumpToBlock?: (itemId: string) => void;
}) {
  const readerItemId = edit.target?.itemId || "";
  const editor = useBlockEditor({
    port: edit.available && !edit.blockedReason ? edit.port : null,
    jobId: edit.ownerJobId,
    readerItemId,
    onSaved: edit.markSaved,
  });
  const order = useMemo(() => editableBlockIds(regions), [regions]);
  const index = order.indexOf(readerItemId);
  const go = useCallback((step: number) => {
    const next = order[index + step];
    if (!next) return;
    edit.select(next);
    jumpToBlock?.(next);
  }, [order, index, edit, jumpToBlock]);

  // Alt+↑/↓ 换段：面板开着、有选中的块时在哪都管用（编辑框里也是）。
  useEffect(() => {
    if (!open || index < 0) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
      event.preventDefault();
      go(event.key === "ArrowUp" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, go]);

  const { loaded } = editor;
  const busy = editor.saving || editor.loading;
  const blocked = edit.blockedReason;
  const unchanged = !loaded || editor.draft === loaded.current;

  let body;
  if (!edit.available) {
    body = <p className="reader-block-edit-note">这里不能改译文。</p>;
  } else if (!readerItemId) {
    body = <p className="reader-block-edit-note">在译文上把鼠标停在一段上，点「改」，或者按 E。</p>;
  } else {
    body = (
      <>
        <div className="reader-block-edit-nav">
          <span className="reader-block-edit-where">第 {edit.target?.page || "?"} 页</span>
          <IconButton className="reader-block-edit-step" size="sm" label="上一段（Alt+↑）" disabled={index <= 0} onClick={() => go(-1)}>
            <ChevronUp size={14} aria-hidden />
          </IconButton>
          <IconButton className="reader-block-edit-step" size="sm" label="下一段（Alt+↓）" disabled={index < 0 || index >= order.length - 1} onClick={() => go(1)}>
            <ChevronDown size={14} aria-hidden />
          </IconButton>
        </div>
        {blocked ? <p className="reader-block-edit-note is-blocked" data-block-edit-blocked="true">{blocked}</p> : null}
        {editor.loading ? <p className="reader-block-edit-note">正在读这一段…</p> : null}
        {loaded ? (
          <form
            className="reader-block-edit-form"
            onSubmit={(event) => { event.preventDefault(); void editor.save(); }}
          >
            <h4>原文</h4>
            <p className="reader-block-edit-source" data-block-edit-source="true">{loaded.source || "（没有原文）"}</p>
            <h4>译文</h4>
            <Textarea
              id="reader-block-edit-text"
              className="reader-block-edit-text"
              rows={8}
              value={editor.draft}
              disabled={busy || Boolean(blocked)}
              aria-label="译文"
              onChange={(event) => editor.setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  if (!unchanged) void editor.save();
                }
              }}
            />
            <p className="reader-block-edit-hint">公式照框里原来的写法（$…$）保留，改坏了保存时会检查不过。Ctrl+Enter 保存。</p>
            <Input
              size="sm"
              className="reader-block-edit-reason"
              value={editor.reason}
              placeholder="为什么改（可不填）"
              aria-label="修改原因"
              disabled={busy || Boolean(blocked)}
              onChange={(event) => editor.setReason(event.target.value)}
            />
            <div className="reader-block-edit-actions">
              <Button className="reader-block-edit-act" type="button" variant="ghost" size="sm" disabled={busy || unchanged} onClick={editor.resetDraft}>还原</Button>
              <Button className="reader-block-edit-act" type="submit" variant="primary" size="sm" data-block-edit-action="save" disabled={busy || Boolean(blocked) || unchanged || !editor.draft.trim()} pending={editor.saving}>
                保存
              </Button>
            </div>
          </form>
        ) : null}
        {editor.status ? (
          <p className={`reader-block-edit-status is-${editor.status.tone}`} role={editor.status.tone === "error" ? "alert" : "status"}>
            {editor.status.message}
          </p>
        ) : null}
        {editor.issues.length ? (
          <ul className="reader-block-edit-issues" data-block-edit-issues="true">
            {editor.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        ) : null}
        {loaded && editor.history.length ? (
          <section className="reader-block-edit-history" aria-label="修订历史">
            <h4>修订历史（{editor.history.length - 1}）</h4>
            <ol>
              {editor.history.map((entry, position) => {
                const isCurrent = entry.text === loaded.current;
                return (
                  <li key={`${entry.ts}:${position}`} data-block-edit-history={entry.label} data-current={isCurrent ? "true" : undefined}>
                    <div className="reader-block-edit-history-meta">
                      <span>{[revisionTime(entry.ts), entry.label].filter(Boolean).join(" · ")}{isCurrent ? "（现在用的）" : ""}</span>
                      {isCurrent ? null : (
                        <Button
                          className="reader-block-edit-act"
                          variant="ghost"
                          size="sm"
                          data-block-edit-action="restore"
                          disabled={busy || Boolean(blocked)}
                          onClick={() => { void editor.save(entry.text, `回到「${[revisionTime(entry.ts), entry.label].filter(Boolean).join(" ")}」那一版`); }}
                        >用这版</Button>
                      )}
                    </div>
                    {entry.reason ? <p className="reader-block-edit-history-reason">{entry.reason}</p> : null}
                    <p className="reader-block-edit-history-text">{entry.text}</p>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}
      </>
    );
  }

  return (
    <ReaderPanelShell
      id="reader-block-edit-panel"
      open={open}
      ariaLabel="改译文"
      className="is-pane-right reader-block-edit-panel"
      onClose={onClose}
      toolbar={edit.pendingEdits.size || edit.rerender.phase !== "idle" ? <PendingRerenderBar edit={edit} /> : undefined}
    >
      <div className="reader-block-edit">{body}</div>
    </ReaderPanelShell>
  );
}
