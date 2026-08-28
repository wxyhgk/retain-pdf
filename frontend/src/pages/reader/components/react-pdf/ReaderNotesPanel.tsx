// Cửa sổ nổi ghi chú: danh sách / note / xóa / export / định vị.

import { useEffect, useState } from "react";
import { StickyNote } from "lucide-react";
import type { ReaderNote } from "../../annotations/types.js";
import { ReaderFloatShell } from "./ReaderFloatShell.js";

export type ReaderNotesPanelProps = {
  open: boolean;
  groups: Array<{ page: number; items: ReaderNote[] }>;
  count: number;
  onClose: () => void;
  onJump: (note: ReaderNote) => void;
  onUpdateNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  onExport: () => Promise<boolean>;
};

function NoteItem({
  note,
  onJump,
  onUpdateNote,
  onRemove,
}: {
  note: ReaderNote;
  onJump: (note: ReaderNote) => void;
  onUpdateNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.note);

  useEffect(() => {
    if (!editing) {
      setDraft(note.note);
    }
  }, [note.note, editing]);

  return (
    <article className="reader-notes-item">
      <div className="reader-notes-item-top">
        <span className="reader-notes-kind">
          {note.pane === "translated" ? "Bản dịch" : "Bản gốc"}
        </span>
        <div className="reader-notes-item-actions">
          <button type="button" className="reader-notes-link" onClick={() => onJump(note)}>
            Định vị
          </button>
          <button type="button" className="reader-notes-danger" onClick={() => onRemove(note.id)}>
            Xóa
          </button>
        </div>
      </div>
      <p className="reader-notes-quote">{note.quote}</p>
      {editing ? (
        <div className="reader-notes-editor">
          <textarea
            className="reader-notes-textarea"
            value={draft}
            placeholder="Viết vài suy nghĩ..."
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="reader-notes-editor-actions">
            <button
              type="button"
              className="reader-notes-primary"
              onClick={() => {
                onUpdateNote(note.id, draft);
                setEditing(false);
              }}
            >
              Lưu
            </button>
            <button type="button" className="reader-notes-link" onClick={() => setEditing(false)}>
              Hủy
            </button>
          </div>
        </div>
      ) : note.note ? (
        <button
          type="button"
          className="reader-notes-note"
          onClick={() => setEditing(true)}
          title="Bấm để sửa"
        >
          {note.note}
        </button>
      ) : (
        <button type="button" className="reader-notes-add-note" onClick={() => setEditing(true)}>
          Thêm ghi chú
        </button>
      )}
    </article>
  );
}

export function ReaderNotesPanel({
  open,
  groups,
  count,
  onClose,
  onJump,
  onUpdateNote,
  onRemove,
  onExport,
}: ReaderNotesPanelProps) {
  const [copied, setCopied] = useState(false);

  return (
    <ReaderFloatShell
      id="reader-notes-panel"
      open={open}
      title="Ghi chú"
      subtitle="Chọn chữ trong PDF để thêm · lưu cục bộ"
      titleIcon={<StickyNote size={14} strokeWidth={2.25} aria-hidden />}
      storageKey="retainpdf.reader.notes-float.pos.v1"
      ariaLabel="Ghi chú"
      onClose={onClose}
      toolbar={(
        <>
          <span className="reader-notes-count">{count} mục</span>
          <button
            type="button"
            className="reader-notes-export"
            disabled={copied || count === 0}
            onClick={async () => {
              const ok = await onExport();
              if (ok) {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }
            }}
          >
            {copied ? "Đã sao chép" : "Export Markdown"}
          </button>
        </>
      )}
    >
      {count === 0 ? (
        <p className="reader-notes-empty">
          Chưa có ghi chú. Kéo chọn chữ trên PDF rồi bấm "Thêm ghi chú".
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.page} className="reader-notes-group">
            <h3 className="reader-notes-group-title">Trang {group.page}</h3>
            {group.items.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                onJump={onJump}
                onUpdateNote={onUpdateNote}
                onRemove={onRemove}
              />
            ))}
          </section>
        ))
      )}
    </ReaderFloatShell>
  );
}
