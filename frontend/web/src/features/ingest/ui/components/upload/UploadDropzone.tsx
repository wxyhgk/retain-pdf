// 展示组件边界：只收 props 发回调，不直连 services/store；
// 文件选择与拖拽预览均由 UploadTile 容器映射为 onFile* 回调。
// 2026-11-20 用户：框里不要文字，没选文件只有一个上传图标（拖进来高亮），选了只显示 PDF 的名字（fileSlot，附魔卡片）。
// 原来的提示文字（点击选择或拖到这里、最大 512MB……）只留给读屏和悬停提示。
import { useState, type ChangeEventHandler, type MouseEventHandler, type ReactNode, type RefCallback } from "react";
import { FileUp } from "lucide-react";

import type { UploadViewState } from "../../../domain/upload-store.js";
import { FRONT_MAX_SIZE_TEXT } from "@/platform/config/upload-constants.js";

type UploadDropzoneProps = {
  upload: UploadViewState;
  fileInputRef: RefCallback<HTMLInputElement>;
  onFileInputClick: () => void;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
  onTileClick: MouseEventHandler<HTMLDivElement>;
  budgetSlot: ReactNode;
  /** 选好文件后框里放的东西（附魔卡片）；没有就是空框 + 上传图标。 */
  fileSlot?: ReactNode;
};

export function UploadDropzone({
  upload,
  fileInputRef,
  onFileInputClick,
  onFileChange,
  onTileClick,
  budgetSlot,
  fileSlot = null,
}: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const tileClasses = [
    "upload-tile",
    "upload-tile-hero",
    upload.tileLocked ? "is-locked" : "",
    upload.ready ? "is-ready" : "",
    upload.uploading ? "is-uploading" : "",
    fileSlot ? "has-file" : "",
  ].filter(Boolean).join(" ");
  const hint = `点击选择或把 PDF 拖到这里（可一次选多个，最大 ${FRONT_MAX_SIZE_TEXT}，页数上限随所选 OCR）`;

  return (
    <div
      className={tileClasses}
      onClick={onTileClick}
      title={fileSlot ? undefined : hint}
      data-dragging={dragging || undefined}
      onDragEnter={() => setDragging(true)}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={() => setDragging(false)}
    >
      <input
        id="file"
        name="file"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        aria-label={hint}
        ref={fileInputRef}
        disabled={!upload.tileEnabled}
        onClick={onFileInputClick}
        onChange={onFileChange}
      />
      <span
        id="upload-fill"
        className="upload-fill"
        aria-hidden="true"
        style={{ width: `${upload.uploading ? upload.progressPercent : 0}%` }}
      />
      <span id="upload-glyph" className={`upload-glyph${upload.tileEnabled && !fileSlot ? "" : " hidden"}`} aria-hidden="true">
        <FileUp className="upload-glyph-icon" />
      </span>

      {fileSlot}
      <div className="upload-primary-copy sr-only">
        <strong id="file-label" className={upload.labelVisible ? "" : "hidden"} title={upload.labelTitle}>
          {upload.label}
        </strong>
        <em id="upload-help" className={upload.helpVisible ? "" : "hidden"}>{upload.help}</em>
      </div>

      {/* 状态（正在上传、校验失败……）只给读屏：框里只放文件名；出错另有框下面的错误框。 */}
      <div id="upload-status" className={`upload-status sr-only${upload.statusVisible ? "" : " hidden"}`} aria-live="polite">
        {upload.status}
      </div>
      <div
        id="upload-progress-panel"
        className={`upload-progress-panel${upload.progressVisible ? "" : " hidden"}`}
        aria-live="polite"
      >
        <span id="upload-progress-text" className="sr-only">{upload.progressText}</span>
      </div>
      {budgetSlot}
    </div>
  );
}
