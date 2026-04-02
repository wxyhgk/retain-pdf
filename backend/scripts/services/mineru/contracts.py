from __future__ import annotations

"""Shared MinerU pipeline filesystem/stdout contract."""

MINERU_RESULT_FILE_NAME = "mineru_result.json"
MINERU_BUNDLE_FILE_NAME = "mineru_bundle.zip"
MINERU_UNPACK_DIR_NAME = "unpacked"
MINERU_LAYOUT_JSON_FILE_NAME = "layout.json"
MINERU_CONTENT_LIST_V2_FILE_NAME = "content_list_v2.json"
MINERU_NORMALIZED_DIR_NAME = "normalized"
MINERU_PIPELINE_SUMMARY_FILE_NAME = "pipeline_summary.json"

STDOUT_LABEL_JOB_ROOT = "job root"
STDOUT_LABEL_SOURCE_PDF = "source pdf"
STDOUT_LABEL_LAYOUT_JSON = "layout json"
STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON = "normalized document json"
STDOUT_LABEL_NORMALIZATION_REPORT_JSON = "normalization report json"
STDOUT_LABEL_SOURCE_JSON_USED = "source json used"
STDOUT_LABEL_TRANSLATIONS_DIR = "translations dir"
STDOUT_LABEL_OUTPUT_PDF = "output pdf"
STDOUT_LABEL_SUMMARY = "summary"


def format_stdout_kv(label: str, value: object) -> str:
    return f"{label}: {value}"
