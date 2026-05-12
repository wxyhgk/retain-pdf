export const TRANSLATION_ANIMATION_PATH = "./src/assets/animations/deepseek_lottie.json";
export const OCR_ANIMATION_PATH = "./src/assets/animations/ocr_Lottie.json";
export const UPLOAD_ANIMATION_PATH = "./src/assets/animations/pdf_upload_Lottie.json";
export const DOWNLOAD_ANIMATION_PATH = "./src/assets/animations/pdf_download_Lottie.json";
export const RENDER_ANIMATION_PATH = "./src/assets/animations/typst_rendering.json";

export const STAGE_ANIMATIONS = {
  queued: UPLOAD_ANIMATION_PATH,
  ocr_upload: UPLOAD_ANIMATION_PATH,
  ocr: OCR_ANIMATION_PATH,
  ocr_processing: OCR_ANIMATION_PATH,
  ocr_result_ready: OCR_ANIMATION_PATH,
  ocr_normalizing: OCR_ANIMATION_PATH,
  translate: TRANSLATION_ANIMATION_PATH,
  render: RENDER_ANIMATION_PATH,
  done: DOWNLOAD_ANIMATION_PATH,
};

export const STAGE_FLOW = ["ocr", "translate", "render", "done"];

export const STAGE_LABELS = {
  ocr: "OCR",
  translate: "翻译",
  render: "渲染",
  done: "完成",
};

export const TRANSLATION_SUBSTAGES = [
  { key: "translation_batches", label: "翻译批次" },
  { key: "continuation_review", label: "跨栏/跨页" },
  { key: "page_policies", label: "页面策略" },
  { key: "garbled", label: "乱码修复" },
];
