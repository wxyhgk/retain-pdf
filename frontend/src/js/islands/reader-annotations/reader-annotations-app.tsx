import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ANNOTATION_KIND_META,
  annotationAnchor,
  buildAnnotationsMarkdown,
  groupAnnotationsByPage,
} from "../../reader/annotations/view-model.js";

function AnnotationItem({ annotation, onJump, onDelete, onSaveNote }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const meta = ANNOTATION_KIND_META[annotation.kind] || ANNOTATION_KIND_META.sentence;

  const startEdit = () => {
    setDraft(annotation.note || "");
    setEditing(true);
  };

  const commit = async () => {
    setEditing(false);
    await onSaveNote(annotation, draft);
  };

  return (
    <div className="reader-annotations-item">
      <div className="reader-annotations-item-top">
        <span className={`reader-annotations-kind is-${annotation.kind}`}>{meta.label}</span>
        <div className="reader-annotations-actions">
            <button
              type="button"
              className="reader-annotations-locate"
              onClick={() => onJump(annotationAnchor(annotation))}
            >
              Định vị
            </button>
            <button
              type="button"
              className="reader-annotations-remove"
              onClick={() => onDelete(annotation)}
            >
              Xóa
            </button>
        </div>
      </div>
      <p className="reader-annotations-quote">{annotation.quoteText}</p>
      {annotation.translatedQuoteText
        ? <p className="reader-annotations-translated">{annotation.translatedQuoteText}</p>
        : null}
      {editing
        ? (
          <div className="reader-annotations-note-editor">
               <textarea
                 className="reader-annotations-note-input"
                 value={draft}
                 placeholder="Viết vài suy nghĩ..."
                 onChange={(event) => setDraft(event.target.value)}
               />
               <div className="reader-annotations-note-editor-actions">
                 <button type="button" className="reader-annotations-note-save" onClick={commit}>Lưu</button>
                 <button type="button" className="reader-annotations-note-cancel" onClick={() => setEditing(false)}>Hủy</button>
            </div>
          </div>
        )
        : annotation.note
          ? (
            <p className="reader-annotations-note" title="Click để sửa ghi chú" onClick={startEdit}>
              {annotation.note}
            </p>
          )
          : (
            <button type="button" className="reader-annotations-note-add" onClick={startEdit}>
              Thêm ghi chú
            </button>
          )}
    </div>
  );
}

// Export định danh: Trang reader (src/pages/reader) đã được đóng gói, tái sử dụng mã nguồn component để render vào
// ngăn kéo ghi chú (Phase 2b); mountReaderAnnotationsApp được giữ lại làm điểm mount cho test cấp component.
export function ReaderAnnotationsPanel({ ports }) {
  const [open, setOpen] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const loadSeqRef = useRef(0);
  const copyTimerRef = useRef<any>(0);

  const load = useCallback(async () => {
    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    setLoading(true);
    setError("");
    try {
      const list = await ports.loadAnnotations();
      if (loadSeqRef.current !== seq) {
        return;
      }
      setAnnotations(Array.isArray(list) ? list : []);
    } catch (loadError) {
      if (loadSeqRef.current === seq) {
        setError(loadError?.message || "Tải ghi chú thất bại");
      }
    } finally {
      if (loadSeqRef.current === seq) {
        setLoading(false);
      }
    }
  }, [ports]);

  useEffect(() => ports.subscribeOpen((visible) => setOpen(Boolean(visible))), [ports]);

  // Tải khi lần đầu hiển thị, sau đó làm mới mỗi khi trở lại trạng thái hiển thị
  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const handleExport = useCallback(async () => {
    const markdown = buildAnnotationsMarkdown({
      title: ports.documentTitle(),
      annotations,
    });
    const ok = await ports.exportMarkdown(markdown);
    if (ok) {
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [ports, annotations]);

  const handleDelete = useCallback(async (annotation) => {
    // Optimistically remove, then restore on failure.
    setAnnotations((current) => current.filter((item) => item.favoriteId !== annotation.favoriteId));
    let ok = false;
    try {
      ok = await ports.deleteAnnotation(annotation.favoriteId);
    } catch (_err) {
      ok = false;
    }
    if (!ok) {
      setAnnotations((current) => (
        current.some((item) => item.favoriteId === annotation.favoriteId)
          ? current
          : [...current, annotation]
      ));
    }
  }, [ports]);

  const handleSaveNote = useCallback(async (annotation, note) => {
    const previousNote = annotation.note;
    // Optimistically update, then roll back on failure.
    setAnnotations((current) => current.map((item) => (
      item.favoriteId === annotation.favoriteId ? { ...item, note } : item
    )));
    let updated = null;
    try {
      updated = await ports.saveNote(annotation, note);
    } catch (_err) {
      updated = null;
    }
    setAnnotations((current) => current.map((item) => (
      item.favoriteId === annotation.favoriteId
        ? (updated || { ...item, note: previousNote })
        : item
    )));
  }, [ports]);

  if (!open) {
    return null;
  }

  const groups = groupAnnotationsByPage(annotations);

  return (
    <div className="reader-annotations-panel" role="region" aria-label="Danh sách ghi chú">
      <div className="reader-annotations-head">
        <span className="reader-annotations-count">{annotations.length} ghi chú</span>
        <button
          type="button"
          className="reader-annotations-export"
          onClick={handleExport}
          disabled={copied}
        >
            {copied ? "Đã sao chép" : "Xuất Markdown"}
        </button>
      </div>
      {loading
        ? <p className="reader-annotations-loading">Đang tải ghi chú…</p>
        : error
          ? (
            <div className="reader-annotations-error">
              <p>{error}</p>
              <button type="button" className="reader-annotations-retry" onClick={load}>Thử lại</button>
            </div>
          )
          : groups.length === 0
            ? <p className="reader-annotations-empty">Chưa có ghi chú, hãy chọn văn bản gốc để tạo</p>
            : groups.map((group) => (
              <section key={group.pageIdx} className="reader-annotations-group">
                <h4 className="reader-annotations-group-title">Trang {group.pageIdx + 1}</h4>
                <div className="reader-annotations-group-items">
                  {group.items.map((annotation) => (
                    <AnnotationItem
                      key={annotation.favoriteId}
                      annotation={annotation}
                      onJump={ports.jumpToAnchor}
                      onDelete={handleDelete}
                      onSaveNote={handleSaveNote}
                    />
                  ))}
                </div>
              </section>
            ))}
    </div>
  );
}

export function mountReaderAnnotationsApp(host, ports) {
  const root = createRoot(host);
  root.render(<ReaderAnnotationsPanel ports={ports} />);
  return {
    unmount: () => root.unmount(),
  };
}
