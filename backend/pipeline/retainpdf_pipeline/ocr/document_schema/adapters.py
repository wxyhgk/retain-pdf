from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from retainpdf_pipeline.ocr.document_schema.contract_v1 import enrich_document_contract_v1
from retainpdf_pipeline.ocr.document_schema.defaults import apply_document_defaults_with_report
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_MINERU
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_MINERU_CONTENT_LIST_V2
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_PADDLE
from retainpdf_pipeline.ocr.document_schema.validator import build_validation_report

AdapterBuilder = Callable[[dict, str, Path, str], dict]
Detector = Callable[[dict], bool]


def _load_json(path: Path) -> dict:
    # Stream-read; avoid services.pipeline_shared (circular via package __init__).
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _build_mineru_document(payload: dict, document_id: str, source_json_path: Path, provider_version: str) -> dict:
    from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru import build_mineru_document

    return build_mineru_document(
        payload=payload,
        document_id=document_id,
        source_json_path=source_json_path,
        provider_version=provider_version,
    )


def _build_mineru_content_list_v2_document(payload: dict, document_id: str, source_json_path: Path, provider_version: str) -> dict:
    from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru_content_list_v2_adapter import (
        build_mineru_content_list_v2_document,
    )

    return build_mineru_content_list_v2_document(
        payload=payload,
        document_id=document_id,
        source_json_path=source_json_path,
        provider_version=provider_version,
    )


def _build_generic_flat_ocr_document(payload: dict, document_id: str, source_json_path: Path, provider_version: str) -> dict:
    from retainpdf_pipeline.ocr.document_schema.provider_adapters.generic_flat_ocr_adapter import (
        build_generic_flat_ocr_document,
    )

    return build_generic_flat_ocr_document(
        payload=payload,
        document_id=document_id,
        source_json_path=source_json_path,
        provider_version=provider_version,
    )


def _build_paddle_document(payload: dict, document_id: str, source_json_path: Path, provider_version: str) -> dict:
    from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle import (
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
        try:
            matched = bool(detector(payload))
            attempts.append({"provider": provider, "matched": matched})
        except Exception as exc:
            attempts.append(
                {
                    "provider": provider,
                    "matched": False,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )
            continue
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
    # Builder output is freshly constructed and never reused, so defaults may mutate in place.
    upgraded, defaults_report = apply_document_defaults_with_report(document, in_place=True)
    upgraded = enrich_document_contract_v1(upgraded)
    report = {
        "source_json_path": str(source_json_path),
        "document_id": document_id,
        "provider": provider,
        "provider_version": provider_version,
        "defaults": defaults_report,
        "validation": build_validation_report(upgraded),
    }
    provider_signals = dict((upgraded.get("derived") or {}).get("provider_signals") or {})
    if provider_signals:
        report["provider_signals"] = provider_signals
    return upgraded, report


def adapt_path_to_document_v1(
    *,
    source_json_path: Path,
    document_id: str,
    provider: str | None = None,
    provider_version: str = "",
    allow_provider_mismatch: bool = False,
) -> dict:
    document, _report = adapt_path_to_document_v1_with_report(
        source_json_path=source_json_path,
        document_id=document_id,
        provider=provider,
        provider_version=provider_version,
        allow_provider_mismatch=allow_provider_mismatch,
    )
    return document


def adapt_path_to_document_v1_with_report(
    *,
    source_json_path: Path,
    document_id: str,
    provider: str | None = None,
    provider_version: str = "",
    allow_provider_mismatch: bool = False,
    payload: dict | None = None,
) -> tuple[dict, dict]:
    # Callers that already hold the parsed provider payload can pass it in to
    # skip re-reading the (potentially very large) JSON from disk.
    if payload is None:
        payload = _load_json(source_json_path)
    detection_report = detect_ocr_provider_with_report(payload)
    resolved_provider = provider or str(detection_report.get("provider", "") or "")
    if not resolved_provider:
        raise RuntimeError("Unable to detect OCR provider for non-normalized payload.")
    detected_provider = str(detection_report.get("provider", "") or "")
    if (
        provider
        and detected_provider
        and detected_provider != resolved_provider
        and not allow_provider_mismatch
    ):
        raise RuntimeError(
            "Explicit OCR provider does not match detected provider: "
            f"provider={resolved_provider} detected={detected_provider}. "
            "Pass allow_provider_mismatch=True only for a configured raw-provider override."
        )
    document, report = adapt_payload_to_document_v1_with_report(
        payload=payload,
        provider=resolved_provider,
        document_id=document_id,
        source_json_path=source_json_path,
        provider_version=provider_version,
    )
    report["detected_provider"] = detected_provider or resolved_provider
    report["detection"] = detection_report
    report["provider_was_explicit"] = bool(provider)
    report["provider_mismatch_allowed"] = bool(allow_provider_mismatch)
    return document, report


def _looks_like_mineru_layout(payload: dict) -> bool:
    from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru import looks_like_mineru_layout

    return looks_like_mineru_layout(payload)


def _looks_like_mineru_content_list_v2(payload: dict) -> bool:
    from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru_content_list_v2_adapter import (
        looks_like_mineru_content_list_v2,
    )

    return looks_like_mineru_content_list_v2(payload)


def _looks_like_generic_flat_ocr(payload: dict) -> bool:
    from retainpdf_pipeline.ocr.document_schema.provider_adapters.generic_flat_ocr_adapter import (
        looks_like_generic_flat_ocr,
    )

    return looks_like_generic_flat_ocr(payload)


def _looks_like_paddle_layout(payload: dict) -> bool:
    from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle import (
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
