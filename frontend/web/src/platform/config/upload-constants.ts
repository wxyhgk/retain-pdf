export const DEFAULT_FILE_LABEL = "点击选择文件或拖到这里";
/**
 * 前端先挡一道的单个 PDF 大小上限，和后端默认的一样大（retainpdf-core config/upload.rs 的 DEFAULT_UPLOAD_MAX_BYTES，512MB）。
 * 以前是 50MB，比后端小得多，几百页的扫描书前端就挡了（2026-11-04 放开）。部署时把后端调小了（RUST_API_UPLOAD_MAX_BYTES，
 * Docker 交付包是 200MB），超过的照样能选，上传时后端拒绝，错误照原样显示。
 */
export const FRONT_MAX_BYTES = 512 * 1024 * 1024;
/** 上传框上写的「最大 …MB」。 */
export const FRONT_MAX_SIZE_TEXT = `${Math.round(FRONT_MAX_BYTES / (1024 * 1024))}MB`;
// 页数上限按设置里选的 OCR 定：platform/config/providers.ts 的 maxPages（GLM-OCR 不限）。
