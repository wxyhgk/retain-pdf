"""Opt-in visual OCR transports for local PDF crops, shared by OCR providers."""
from __future__ import annotations

import os
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import BadZipFile

import fitz
import requests

from retainpdf_pipeline.ocr.document_schema.visual_text_recovery import RecognizeCrop
from retainpdf_pipeline.ocr.ocr_provider import glm_ocr_api

VISUAL_OCR_KEY_ENV = "RETAIN_VISUAL_OCR_API_KEY"
VISUAL_OCR_PROVIDER_ENV = "RETAIN_VISUAL_OCR_PROVIDER"
_FORMULA_LABELS = {"formula", "inline_formula", "inline_equation", "display_formula"}
_TEXT_LABELS = {"text", "paragraph"} | _FORMULA_LABELS
_MAX_REQUESTS = 8


def _mineru_crop(pdf_bytes: bytes, api_key: str) -> str | None:
    # Imports stay at the transport edge: MinerU job_flow itself uses this
    # factory after the provider dispatcher has finished loading.
    from retainpdf_pipeline.ocr.mineru_provider.submission import run_local_extract_task
    from retainpdf_pipeline.ocr.mineru_provider.artifacts import download_and_unpack_bundle

    with TemporaryDirectory(prefix="retain-visual-ocr-") as tmp:
        root = Path(tmp)
        source = root / "crop.pdf"
        source.write_bytes(pdf_bytes)
        response = run_local_extract_task(
            token=api_key, file_path=source, model_version="vlm", data_id="",
            poll_interval=3, poll_timeout=90, is_ocr=True,
            enable_formula=True, enable_table=False, language="en",
        )
        url = (response.get("data") or {}).get("full_zip_url")
        if not isinstance(url, str) or not url:
            return None
        download_and_unpack_bundle(
            full_zip_url=url,
            zip_path=root / "result.zip", unpack_dir=root / "raw",
        )
        files = list((root / "raw").rglob("*_content_list.json"))
        if len(files) != 1:
            return None
        blocks = json.loads(files[0].read_text(encoding="utf-8"))
        if not isinstance(blocks, list) or not blocks:
            return None
        pieces = []
        for block in blocks:
            if not isinstance(block, dict) or block.get("page_idx", 0) != 0:
                return None
            kind, value = block.get("type"), block.get("text")
            if kind not in {"text", "equation"} or not isinstance(value, str) or not value.strip():
                return None
            value = value.strip()
            pieces.append("$" + value.strip("$").strip() + "$" if kind == "equation" else value)
        return " ".join(pieces)


def configured_crop_recognizer() -> RecognizeCrop | None:
    api_key = os.environ.get(VISUAL_OCR_KEY_ENV, "").strip()
    if not api_key:
        return None
    provider = os.environ.get(VISUAL_OCR_PROVIDER_ENV, "glm_ocr").strip()
    if provider not in {"glm_ocr", "mineru"}:
        raise ValueError(f"Unsupported visual OCR provider: {provider}")

    # Streaming normalizes the same prefix again before publishing the final
    # document. Reuse results (including rejection) within this OCR job.
    remaining = _MAX_REQUESTS

    def request_crop(png: bytes) -> str | None:
        nonlocal remaining
        remaining -= 1
        with fitz.open(stream=png, filetype="png") as image, fitz.open() as pdf:
            rect = image[0].rect
            pdf.new_page(width=rect.width, height=rect.height).insert_image(rect, stream=png)
            data = pdf.tobytes()
        try:
            if provider == "mineru":
                return _mineru_crop(data, api_key)
            payload = glm_ocr_api.parse_pdf(data, api_key=api_key, request_timeout=15, attempts=1)
        except (RuntimeError, OSError, ValueError, BadZipFile, requests.RequestException) as exc:
            # An optional second pass must not keep retrying a bad key,
            # unavailable service, or timeout for every damaged block.
            remaining = 0
            print(f"visual OCR crop unavailable ({type(exc).__name__}); keeping unresolved text", flush=True)
            return None
        pages = payload["layout_details"]
        if len(pages) != 1 or not isinstance(pages[0], list) or not pages[0]:
            return None
        pieces = []
        for block in pages[0]:
            if not isinstance(block, dict):
                return None
            label = block.get("native_label") or block.get("label")
            value = block.get("content")
            if label not in _TEXT_LABELS or not isinstance(value, str) or not value.strip():
                return None
            value = value.strip()
            if label in _FORMULA_LABELS:
                value = "$" + value.strip("$").strip() + "$"
            pieces.append(value)
        return " ".join(pieces)

    # Check the memo before applying the budget, even on later streaming
    # prefixes. Once exhausted, new crops must not evict cached results.
    memo: dict[bytes, str | None] = {}

    def recognize(png: bytes) -> str | None:
        if png not in memo and remaining:
            memo[png] = request_crop(png)
        return memo.get(png)

    return recognize
