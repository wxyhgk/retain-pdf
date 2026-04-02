from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from services.document_schema.compat import upgrade_document_payload_with_report
from services.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR
from services.document_schema.providers import PROVIDER_MINERU
from services.document_schema.providers import PROVIDER_MINERU_CONTENT_LIST_V2
from services.document_schema.providers import PROVIDER_PADDLE
from services.document_schema.validator import build_validation_report
from services.document_schema.validator import validate_document_payload

AdapterBuilder = Callable[[dict, str, Path, str], dict]
Detector = Callable[[dict], bool]


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _build_mineru_document(payload: dict, document_id: str, source_json_path: Path, provider_version: str) -> dict:
    from services.mineru.document_v1 import build_normalized_document_from_layout_payload

    return build_normalized_document_from_layout_payload(
        layout_payload=payload,
        document_id=document_id,
        layout_json_path=source_json_path,
        provider_version=provider_version,
    )


def _build_mineru_content_list_v2_document(payload: dict, document_id: str, source_json_path: Path, provider_version: str) -> dict:
    from services.document_schema.provider_adapters.mineru_content_list_v2_adapter import (
        build_mineru_content_list_v2_document,
    )

    return build_mineru_content_list_v2_document(
        payload=payload,
        document_id=document_id,
        source_json_path=source_json_path,
        provider_version=provider_version,
    )


def _build_generic_flat_ocr_document(payload: dict, document_id: str, source_json_path: Path, provider_version: str) -> dict:
    from services.document_schema.provider_adapters.generic_flat_ocr_adapter import (
        build_generic_flat_ocr_document,
    )

    return build_generic_flat_ocr_document(
        payload=payload,
        document_id=document_id,
        source_json_path=source_json_path,
        provider_version=provider_version,
    )


def _build_paddle_document(payload: dict, document_id: str, source_json_path: Path, provider_version: str) -> dict:
    from services.document_schema.provider_adapters.paddle import (
        build_paddle_document,
    )

    return build_paddle_document(
        payload=payload,
        document_id=document_id,
        source_json_path=source_json_path,
        provider_version=provider_version,
    )


_ADAPTER_BUILDERS: dict[str, AdapterBuilder] = {
    PROVIDER_GENERIC_FLAT_OCR: _build_generic_flat_ocr_document,
    PROVIDER_MINERU: _build_mineru_document,
    PROVIDER_MINERU_CONTENT_LIST_V2: _build_mineru_content_list_v2_document,
    PROVIDER_PADDLE: _build_paddle_document,
}

_ADAPTER_DETECTORS: list[tuple[str, Detector]] = []


def register_ocr_adapter(*, provider: str, detector: Detector, builder: AdapterBuilder) -> None:
    _ADAPTER_BUILDERS[provider] = builder
    for index, (name, _) in enumerate(_ADAPTER_DETECTORS):
        if name == provider:
            _ADAPTER_DETECTORS[index] = (provider, detector)
            break
    else:
        _ADAPTER_DETECTORS.append((provider, detector))


def list_registered_ocr_adapters() -> list[str]:
    return list(_ADAPTER_BUILDERS.keys())


def detect_ocr_provider(payload: dict) -> str:
    report = detect_ocr_provider_with_report(payload)
    if not report["matched"]:
        raise RuntimeError("Unable to detect OCR provider for non-normalized payload.")
    return str(report["provider"])


def detect_ocr_provider_with_report(payload: dict) -> dict:
    attempts: list[dict] = []
    for provider, detector in _ADAPTER_DETECTORS:
        matched = bool(detector(payload))
        attempts.append({"provider": provider, "matched": matched})
        if matched:
            return {
                "matched": True,
                "provider": provider,
                "attempts": attempts,
            }
    return {
        "matched": False,
        "provider": "",
        "attempts": attempts,
    }


def adapt_payload_to_document_v1(
    *,
    payload: dict,
    provider: str,
    document_id: str,
    source_json_path: Path,
    provider_version: str = "",
) -> dict:
    document, _report = adapt_payload_to_document_v1_with_report(
        payload=payload,
        provider=provider,
        document_id=document_id,
        source_json_path=source_json_path,
        provider_version=provider_version,
    )
    return document


def adapt_payload_to_document_v1_with_report(
    *,
    payload: dict,
    provider: str,
    document_id: str,
    source_json_path: Path,
    provider_version: str = "",
) -> tuple[dict, dict]:
    builder = _ADAPTER_BUILDERS.get(provider)
    if builder is None:
        raise RuntimeError(f"Unsupported OCR provider adapter: {provider}")
    document = builder(payload, document_id, source_json_path, provider_version)
    upgraded, compat_report = upgrade_document_payload_with_report(document)
    validate_document_payload(upgraded)
    report = {
        "source_json_path": str(source_json_path),
        "document_id": document_id,
        "provider": provider,
        "provider_version": provider_version,
        "compat": compat_report,
        "validation": build_validation_report(upgraded),
    }
    return upgraded, report


def adapt_path_to_document_v1(
    *,
    source_json_path: Path,
    document_id: str,
    provider: str | None = None,
    provider_version: str = "",
) -> dict:
    document, _report = adapt_path_to_document_v1_with_report(
        source_json_path=source_json_path,
        document_id=document_id,
        provider=provider,
        provider_version=provider_version,
    )
    return document


def adapt_path_to_document_v1_with_report(
    *,
    source_json_path: Path,
    document_id: str,
    provider: str | None = None,
    provider_version: str = "",
) -> tuple[dict, dict]:
    payload = _load_json(source_json_path)
    detection_report = detect_ocr_provider_with_report(payload)
    resolved_provider = provider or str(detection_report.get("provider", "") or "")
    if not resolved_provider:
        raise RuntimeError("Unable to detect OCR provider for non-normalized payload.")
    document, report = adapt_payload_to_document_v1_with_report(
        payload=payload,
        provider=resolved_provider,
        document_id=document_id,
        source_json_path=source_json_path,
        provider_version=provider_version,
    )
    report["detected_provider"] = str(detection_report.get("provider", "") or resolved_provider)
    report["detection"] = detection_report
    report["provider_was_explicit"] = bool(provider)
    return document, report


def _looks_like_mineru_layout(payload: dict) -> bool:
    pdf_info = payload.get("pdf_info")
    if not isinstance(pdf_info, list):
        return False
    if not pdf_info:
        return True
    first_page = pdf_info[0]
    return isinstance(first_page, dict) and "para_blocks" in first_page


def _looks_like_mineru_content_list_v2(payload: dict) -> bool:
    from services.document_schema.provider_adapters.mineru_content_list_v2_adapter import (
        looks_like_mineru_content_list_v2,
    )

    return looks_like_mineru_content_list_v2(payload)


def _looks_like_generic_flat_ocr(payload: dict) -> bool:
    from services.document_schema.provider_adapters.generic_flat_ocr_adapter import (
        looks_like_generic_flat_ocr,
    )

    return looks_like_generic_flat_ocr(payload)


def _looks_like_paddle_layout(payload: dict) -> bool:
    from services.document_schema.provider_adapters.paddle import (
        looks_like_paddle_layout,
    )

    return looks_like_paddle_layout(payload)


register_ocr_adapter(
    provider=PROVIDER_GENERIC_FLAT_OCR,
    detector=_looks_like_generic_flat_ocr,
    builder=_build_generic_flat_ocr_document,
)

register_ocr_adapter(
    provider=PROVIDER_MINERU_CONTENT_LIST_V2,
    detector=_looks_like_mineru_content_list_v2,
    builder=_build_mineru_content_list_v2_document,
)

register_ocr_adapter(
    provider=PROVIDER_MINERU,
    detector=_looks_like_mineru_layout,
    builder=_build_mineru_document,
)

register_ocr_adapter(
    provider=PROVIDER_PADDLE,
    detector=_looks_like_paddle_layout,
    builder=_build_paddle_document,
)


__all__ = [
    "adapt_path_to_document_v1",
    "adapt_path_to_document_v1_with_report",
    "adapt_payload_to_document_v1",
    "adapt_payload_to_document_v1_with_report",
    "detect_ocr_provider",
    "detect_ocr_provider_with_report",
    "list_registered_ocr_adapters",
    "register_ocr_adapter",
]
