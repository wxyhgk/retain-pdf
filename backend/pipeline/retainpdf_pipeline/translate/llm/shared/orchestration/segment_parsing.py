from __future__ import annotations

import json
import re

from retainpdf_pipeline.translate.llm.shared.orchestration.segment_errors import SegmentTranslationFormatError
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_errors import SegmentTranslationParseError
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_errors import SegmentTranslationSemanticError
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import is_optional_empty_segment


TAGGED_SEGMENT_RE = re.compile(
    r"<<<SEG(?:MENT)?(?:\s+id=|\s+)(?P<segment_id>\d+)\s*>>>\s*"
    r"(?P<content>.*?)"
    r"\s*<<<END>>>",
    re.DOTALL,
)


def parse_segment_translation_payload(
    content: str,
    *,
    expected_segments: list[dict[str, str]],
) -> dict[str, str]:
    expected_ids = {segment["segment_id"] for segment in expected_segments}
    source_by_id = {segment["segment_id"]: segment["source_text"] for segment in expected_segments}
    result: dict[str, str] = {}
    for match in TAGGED_SEGMENT_RE.finditer(content or ""):
        segment_id = (match.group("segment_id") or "").strip()
        translated_text = (match.group("content") or "").strip()
        if segment_id in result:
            raise SegmentTranslationFormatError(f"duplicate segment_id: {segment_id}")
        if segment_id:
            result[segment_id] = translated_text
    if not result:
        try:
            payload = json.loads(content)
        except Exception:
            try:
                payload = json.loads(re.search(r"\{.*\}", content or "", re.DOTALL).group(0))  # type: ignore[union-attr]
            except Exception as exc:
                raise SegmentTranslationParseError(f"segment payload is not valid tagged text or JSON: {exc}") from exc
        segments_payload = payload.get("segments", []) if isinstance(payload, dict) else []
        for item in segments_payload:
            if not isinstance(item, dict):
                continue
            segment_id = str(item.get("segment_id", "") or "").strip()
            translated_text = str(item.get("translated_text", "") or "").strip()
            if segment_id in result:
                raise SegmentTranslationFormatError(f"duplicate segment_id: {segment_id}")
            if segment_id:
                result[segment_id] = translated_text
    actual_ids = set(result)
    if actual_ids != expected_ids:
        missing = sorted(expected_ids - actual_ids)
        extra = sorted(actual_ids - expected_ids)
        raise SegmentTranslationParseError(f"segment_id mismatch: missing={missing} extra={extra}")
    for segment_id, translated_text in result.items():
        if not translated_text and source_by_id.get(segment_id, "").strip():
            if is_optional_empty_segment(source_by_id.get(segment_id, "")):
                result[segment_id] = ""
                continue
            raise SegmentTranslationSemanticError(f"empty translated segment: {segment_id}")
        if re.search(r"<[ft]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]", translated_text):
            raise SegmentTranslationSemanticError(f"unexpected placeholder in segment output: {segment_id}")
    return result
