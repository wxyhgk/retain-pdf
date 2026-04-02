from __future__ import annotations

import os


def _dir_name(env_var: str, default: str) -> str:
    value = (os.environ.get(env_var, "") or "").strip().strip("/")
    return value or default


SOURCE_DIR_NAME = _dir_name("PDF_TRANSLATOR_SOURCE_DIR_NAME", "source")
OCR_DIR_NAME = _dir_name("PDF_TRANSLATOR_OCR_DIR_NAME", "ocr")
TRANSLATED_DIR_NAME = _dir_name("PDF_TRANSLATOR_TRANSLATED_DIR_NAME", "translated")
RENDERED_DIR_NAME = _dir_name("PDF_TRANSLATOR_RENDERED_DIR_NAME", "rendered")
ARTIFACTS_DIR_NAME = _dir_name("PDF_TRANSLATOR_ARTIFACTS_DIR_NAME", "artifacts")
LOGS_DIR_NAME = _dir_name("PDF_TRANSLATOR_LOGS_DIR_NAME", "logs")
TYPST_DIR_NAME = _dir_name("PDF_TRANSLATOR_TYPST_DIR_NAME", "typst")

LEGACY_SOURCE_DIR_NAME = "originPDF"
LEGACY_OCR_DIR_NAME = "jsonPDF"
LEGACY_TRANSLATED_DIR_NAME = "transPDF"
LEGACY_TYPST_DIR_NAME = "typstPDF"
