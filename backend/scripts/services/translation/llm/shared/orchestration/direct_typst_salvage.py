from __future__ import annotations

import json
import re

from services.translation.diagnostics import TranslationDiagnosticsCollector
from services.translation.llm.placeholder_guard import TranslationProtocolError
from services.translation.llm.placeholder_guard import canonicalize_batch_result
from services.translation.llm.placeholder_guard import result_entry
from services.translation.llm.placeholder_guard import validate_batch_result
from services.translation.llm.shared.orchestration.common import looks_like_direct_typst_partial_accept_text
from services.translation.llm.shared.orchestration.metadata import attach_result_metadata
from services.translation.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from services.translation.llm.shared.provider_runtime import unwrap_translation_shell


def extract_direct_typst_protocol_text(raw_text: str, *, item_id: str) -> str:
    current = str(raw_text or "").strip()
    if not current:
        return ""
    unwrapped = unwrap_translation_shell(current, item_id=item_id)
    if unwrapped and unwrapped != current:
        current = unwrapped.strip()
    if current.startswith("```"):
        lines = current.splitlines()
        if lines and lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        current = "\n".join(lines).strip()
    if current and not current.startswith("{"):
        return current

    def _from_payload(payload: object) -> str:
        if isinstance(payload, dict):
            for key in (
                "translated_text",
                "translation",
                "text",
                "target",
                "content",
                "answer",
                "result",
                "output",
            ):
                translated = payload.get(key)
                if isinstance(translated, str) and translated.strip():
                    return translated.strip()
            if item_id:
                translated = payload.get(item_id)
                if isinstance(translated, str) and translated.strip():
                    return translated.strip()
            translations = payload.get("translations")
            if isinstance(translations, list):
                matched: str = ""
                for entry in translations:
                    if not isinstance(entry, dict):
                        continue
                    candidate = ""
                    for key in ("translated_text", "translation", "text", "target", "content", "answer", "result", "output"):
                        candidate = str(entry.get(key, "") or "").strip()
                        if candidate:
                            break
                    if not candidate:
                        continue
                    if str(entry.get("item_id", "") or "").strip() == item_id:
                        return candidate
                    if not matched:
                        matched = candidate
                return matched
            items = payload.get("items")
            if isinstance(items, list):
                return _from_payload({"translations": items})
        return ""

    probe = current
    for _ in range(3):
        try:
            payload = json.loads(probe)
        except Exception:
            try:
                payload = json.loads(re.sub(r"^[^{]*", "", probe))
            except Exception:
                break
        candidate = _from_payload(payload)
        if not candidate:
            break
        if candidate == probe:
            return candidate
        probe = candidate
        if not probe.startswith("{"):
            return probe
    return probe if probe != current else ""


def try_salvage_direct_typst_protocol_shell_error(
    item: dict,
    *,
    exc: TranslationProtocolError,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
    route_path: list[str],
    output_mode_path: list[str],
    allow_partial_accept: bool,
    validate_batch_result_fn=validate_batch_result,
) -> dict[str, dict[str, str]] | None:
    raw_text = str(getattr(exc, "translated_text", "") or "").strip()
    if not raw_text:
        return None
    extracted = extract_direct_typst_protocol_text(raw_text, item_id=str(item.get("item_id", "") or ""))
    if not extracted:
        return None
    try:
        result = {str(item.get("item_id", "") or ""): result_entry("translate", extracted)}
        result = canonicalize_batch_result([item], result)
        validate_batch_result_fn([item], result, diagnostics=diagnostics)
        result = restore_runtime_term_tokens(result, item=item)
        return attach_result_metadata(
            result,
            item=item,
            context=context,
            route_path=route_path,
            output_mode_path=output_mode_path,
            degradation_reason="protocol_shell_salvaged",
        )
    except Exception:
        if not allow_partial_accept or not looks_like_direct_typst_partial_accept_text(item, extracted):
            return None
        result = canonicalize_batch_result(
            [item],
            {str(item.get("item_id", "") or ""): result_entry("translate", extracted)},
        )
        result = restore_runtime_term_tokens(result, item=item)
        return attach_result_metadata(
            result,
            item=item,
            context=context,
            route_path=route_path,
            output_mode_path=output_mode_path,
            degradation_reason="protocol_shell_partial_accept",
        )
