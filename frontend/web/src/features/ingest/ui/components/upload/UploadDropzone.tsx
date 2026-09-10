// 展示组件边界：只收 props 发回调，不直连 services/store；
// 文件选择与拖拽预览均由 UploadTile 容器映射为 onFile* 回调。
import type { ChangeEventHandler, MouseEventHandler, ReactNode, RefCallback } from "react";

import type { UploadViewState } from "../../../domain/upload-store.js";

type UploadDropzoneProps = {
  upload: UploadViewState;
  fileInputRef: RefCallback<HTMLInputElement>;
  onFileInputClick: () => void;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
  onTileClick: MouseEventHandler<HTMLDivElement>;
  budgetSlot: ReactNode;
};

export function UploadDropzone({
  upload,
  fileInputRef,
  onFileInputClick,
  onFileChange,
  onTileClick,
  budgetSlot,
}: UploadDropzoneProps) {
  const tileClasses = [
    "upload-tile",
    "upload-tile-hero",
    upload.tileLocked ? "is-locked" : "",
    upload.ready ? "is-ready" : "",
    upload.uploading ? "is-uploading" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={tileClasses} onClick={onTileClick}>
      <input
        id="file"
        name="file"
        type="file"
        accept="application/pdf,.pdf"
        aria-label="选择 PDF 文件"
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
      <span id="upload-glyph" className={`upload-glyph${upload.tileEnabled ? "" : " hidden"}`} aria-hidden="true">
        <span className="upload-glyph-h" />
        <span className="upload-glyph-v" />
      </span>

      <div className="upload-primary-copy">
        <strong id="file-label" className={upload.labelVisible ? "" : "hidden"} title={upload.labelTitle}>
          {upload.label}
        </strong>
        <em id="upload-help" className={upload.helpVisible ? "" : "hidden"}>{upload.help}</em>
        <div className={`upload-meta upload-meta-inline${upload.tileEnabled ? "" : " hidden"}`}>
          <span>单个 PDF</span>
          <span>最大 50MB</span>
          <span>最多 999 页</span>
        </div>
      </div>

      <div id="upload-status" className={`upload-status${upload.statusVisible ? "" : " hidden"}`}>
        {upload.status}
      </div>
      <div
        id="upload-progress-panel"
        className={`upload-progress-panel${upload.progressVisible ? "" : " hidden"}`}
        aria-live="polite"
      >
        <span id="upload-progress-text">{upload.progressText}</span>
      </div>
      {budgetSlot}
    </div>
  );
}
