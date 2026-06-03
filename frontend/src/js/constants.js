export const API_PREFIX = "/api/v1";
export const DEFAULT_FILE_LABEL = "点击选择文件或拖到这里";
export const DEFAULT_MODE = "sci";
export const DEFAULT_MODEL = "deepseek-v4-flash";
export const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
export const DEFAULT_LANGUAGE = "ch";
export const DEFAULT_TARGET_LANGUAGE = "Simplified Chinese";
export const TARGET_LANGUAGE_OPTIONS = [
  { label: "简体中文", value: "Simplified Chinese", code: "zh-CN" },
  { label: "English", value: "English", code: "en" },
  { label: "日本語", value: "Japanese", code: "ja" },
  { label: "한국어", value: "Korean", code: "ko" },
  { label: "Français", value: "French", code: "fr" },
  { label: "Deutsch", value: "German", code: "de" },
  { label: "Русский", value: "Russian", code: "ru" },
  { label: "Español", value: "Spanish", code: "es" },
  { label: "Português", value: "Portuguese", code: "pt" },
  { label: "العربية", value: "Arabic", code: "ar" },
];
export const DEFAULT_RULE_PROFILE = "general_sci";
export const DEFAULT_RENDER_MODE = "auto";
export const DEFAULT_TYPST_FONT_FAMILY = "Source Han Serif SC";
export const DEFAULT_PDF_COMPRESS_DPI = 0;
export const DEFAULT_TRANSLATED_PDF_NAME = "";
export const DEFAULT_BODY_FONT_SIZE_FACTOR = 0.95;
export const DEFAULT_BODY_LEADING_FACTOR = 1.08;
export const DEFAULT_INNER_BBOX_SHRINK_X = 0;
export const DEFAULT_INNER_BBOX_SHRINK_Y = 0;
export const DEFAULT_INNER_BBOX_DENSE_SHRINK_X = 0;
export const DEFAULT_INNER_BBOX_DENSE_SHRINK_Y = 0;
export const DEFAULT_FONT_UNIFY_MODE = "role_min";
export const DEFAULT_MODEL_VERSION = "vlm";
export const DEFAULT_WORKERS = 100;
export const DEFAULT_BATCH_SIZE = 1;
export const DEFAULT_CLASSIFY_BATCH_SIZE = 12;
export const DEFAULT_COMPILE_WORKERS = 8;
export const DEFAULT_TIMEOUT_SECONDS = 1800;
export const FRONT_MAX_BYTES = 50 * 1024 * 1024;
export const FRONT_MAX_PAGE_COUNT = 999;
export const BROWSER_CONFIG_STORAGE_KEY = "retainpdf.browser.config.v1";
export const DEVELOPER_CONFIG_STORAGE_KEY = "retainpdf.developer.config.v1";
