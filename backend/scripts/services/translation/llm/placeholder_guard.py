from __future__ import annotations

from collections import Counter
import re

from services.document_schema.semantics import is_body_structure_role
from services.translation.diagnostics import TranslationDiagnosticsCollector
from services.translation.llm.deepseek_client import unwrap_translation_shell
from services.translation.payload.formula_protection import protected_map_from_formula_map
from services.translation.payload.formula_protection import protect_glossary_terms
from services.translation.payload.formula_protection import PROTECTED_TOKEN_RE
from services.translation.policy.metadata_filter import looks_like_url_fragment
from services.translation.policy.reference_section import looks_like_reference_entry_text
from services.translation.policy.soft_hints import looks_like_code_literal_text_value


FORMAL_PLACEHOLDER_RE = re.compile(r"<f\d+-[0-9a-z]{3}/>|<t\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]")
ALIAS_PLACEHOLDER_RE = re.compile(r"@@P\d+@@")
PLACEHOLDER_RE = re.compile(rf"{PROTECTED_TOKEN_RE.pattern}|@@P\d+@@")
FORMULA_TOKEN_RE = re.compile(r"<f\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]|@@P\d+@@")
EN_WORD_RE = re.compile(r"[A-Za-z]+(?:[-'][A-Za-z]+)?")
KEEP_ORIGIN_LABEL = "keep_origin"
INTERNAL_PLACEHOLDER_DEGRADED_REASON = "placeholder_unstable"
SHORT_FRAGMENT_RE = re.compile(r"^[A-Za-z][A-Za-z0-9._/-]{0,7}$")


class SuspiciousKeepOriginError(ValueError):
    def __init__(self, item_id: str, result: dict[str, dict[str, str]]) -> None:
        super().__init__(f"{item_id}: suspicious keep_origin for long English body text")
        self.item_id = item_id
        self.result = result


class UnexpectedPlaceholderError(ValueError):
    def __init__(
        self,
        item_id: str,
        unexpected: list[str],
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(f"{item_id}: unexpected placeholders in translation: {unexpected}")
        self.item_id = item_id
        self.unexpected = unexpected
        self.source_text = source_text
        self.translated_text = translated_text


class PlaceholderInventoryError(ValueError):
    def __init__(
        self,
        item_id: str,
        source_sequence: list[str],
        translated_sequence: list[str],
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(
            f"{item_id}: placeholder inventory mismatch: source={source_sequence} translated={translated_sequence}"
        )
        self.item_id = item_id
        self.source_sequence = source_sequence
        self.translated_sequence = translated_sequence
        self.source_text = source_text
        self.translated_text = translated_text


class EmptyTranslationError(ValueError):
    def __init__(self, item_id: str) -> None:
        super().__init__(f"{item_id}: empty translation output")
        self.item_id = item_id


class EnglishResidueError(ValueError):
    def __init__(
        self,
        item_id: str,
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(f"{item_id}: translated output still looks predominantly English")
        self.item_id = item_id
        self.source_text = source_text
        self.translated_text = translated_text


class TranslationProtocolError(ValueError):
    def __init__(
        self,
        item_id: str,
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(f"{item_id}: translated output still contains protocol/json shell")
        self.item_id = item_id
        self.source_text = source_text
        self.translated_text = translated_text


def normalize_decision(value: str) -> str:
    normalized = (value or "translate").strip().lower().replace("-", "_")
    if normalized in {"keep", "skip", "no_translate", "keeporigin"}:
        return KEEP_ORIGIN_LABEL
    if normalized == KEEP_ORIGIN_LABEL:
        return KEEP_ORIGIN_LABEL
    return "translate"


def result_entry(decision: str, translated_text: str) -> dict[str, str]:
    normalized_decision = normalize_decision(decision)
    payload = {
        "decision": normalized_decision,
        "translated_text": "" if normalized_decision == KEEP_ORIGIN_LABEL else (translated_text or "").strip(),
    }
    payload["final_status"] = "kept_origin" if normalized_decision == KEEP_ORIGIN_LABEL else "translated"
    return payload


def internal_keep_origin_result(reason: str) -> dict[str, str]:
    result = result_entry(KEEP_ORIGIN_LABEL, "")
    result["_internal_reason"] = reason
    return result


def is_internal_placeholder_degraded(payload: dict[str, str]) -> bool:
    return str(payload.get("_internal_reason", "") or "") == INTERNAL_PLACEHOLDER_DEGRADED_REASON


def normalize_inline_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def text_preview(text: str, *, limit: int = 220) -> str:
    normalized = normalize_inline_whitespace(text)
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: max(0, limit - 1)].rstrip()}…"


def unit_source_text(item: dict) -> str:
    return (
        item.get("translation_unit_protected_source_text")
        or item.get("group_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )


def strip_placeholders(text: str) -> str:
    return PLACEHOLDER_RE.sub(" ", text or "")


def placeholders(text: str) -> set[str]:
    return set(PLACEHOLDER_RE.findall(text or ""))


def placeholder_sequence(text: str) -> list[str]:
    return PLACEHOLDER_RE.findall(text or "")


def repair_safe_duplicate_placeholders(source_text: str, translated_text: str) -> str | None:
    source_sequence = placeholder_sequence(source_text)
    if not source_sequence:
        return None
    matches = list(PLACEHOLDER_RE.finditer(translated_text or ""))
    if not matches:
        return None
    translated_sequence = [match.group(0) for match in matches]
    if translated_sequence == source_sequence or len(translated_sequence) <= len(source_sequence):
        return None
    source_inventory = Counter(source_sequence)
    translated_inventory = Counter(translated_sequence)
    for placeholder, count in translated_inventory.items():
        if count < source_inventory.get(placeholder, 0):
            return None
    if any(placeholder not in source_inventory for placeholder in translated_inventory):
        return None

    kept_match_indexes: list[int] = []
    cursor = 0
    for placeholder in source_sequence:
        while cursor < len(translated_sequence) and translated_sequence[cursor] != placeholder:
            cursor += 1
        if cursor >= len(translated_sequence):
            return None
        kept_match_indexes.append(cursor)
        cursor += 1

    if len(kept_match_indexes) == len(matches):
        return None

    keep_set = set(kept_match_indexes)
    rebuilt_parts: list[str] = []
    prev_end = 0
    for index, match in enumerate(matches):
        rebuilt_parts.append(translated_text[prev_end:match.start()])
        if index in keep_set:
            rebuilt_parts.append(match.group(0))
        prev_end = match.end()
    rebuilt_parts.append(translated_text[prev_end:])

    repaired_text = "".join(rebuilt_parts)
    repaired_text = re.sub(r"[ \t]{2,}", " ", repaired_text)
    repaired_text = re.sub(r"\s+([,.;:!?])", r"\1", repaired_text)
    if placeholder_sequence(repaired_text) != source_sequence:
        return None
    return repaired_text.strip()


def has_formula_placeholders(item: dict) -> bool:
    return bool(FORMULA_TOKEN_RE.findall(unit_source_text(item)))


def placeholder_alias_maps(item: dict) -> tuple[dict[str, str], dict[str, str]]:
    source_sequence = placeholder_sequence(unit_source_text(item))
    source_set = set(source_sequence)
    original_to_alias: dict[str, str] = {}
    alias_to_original: dict[str, str] = {}
    next_alias_id = 1
    for placeholder in dict.fromkeys(source_sequence):
        alias = f"@@P{next_alias_id}@@"
        while alias in source_set or alias in alias_to_original:
            next_alias_id += 1
            alias = f"@@P{next_alias_id}@@"
        original_to_alias[placeholder] = alias
        alias_to_original[alias] = placeholder
        next_alias_id += 1
    return original_to_alias, alias_to_original


def item_with_runtime_hard_glossary(item: dict, glossary_entries: list[dict] | list[object] | None) -> dict:
    normalized_map = list(item.get("translation_unit_protected_map") or item.get("protected_map") or [])
    if not normalized_map and item.get("translation_unit_formula_map"):
        normalized_map = protected_map_from_formula_map(item.get("translation_unit_formula_map") or [])
    elif not normalized_map and item.get("formula_map"):
        normalized_map = protected_map_from_formula_map(item.get("formula_map") or [])
    protected_text, protected_map = protect_glossary_terms(
        unit_source_text(item),
        glossary_entries=glossary_entries,
        existing_map=normalized_map,
    )
    if protected_text == unit_source_text(item) and protected_map == normalized_map:
        return dict(item)
    updated = dict(item)
    updated["translation_unit_protected_source_text"] = protected_text
    updated["protected_source_text"] = protected_text
    updated["translation_unit_protected_map"] = protected_map
    updated["protected_map"] = protected_map
    return updated


def replace_placeholders(text: str, mapping: dict[str, str]) -> str:
    replaced = text or ""
    for source, target in mapping.items():
        replaced = replaced.replace(source, target)
    return replaced


def item_with_placeholder_aliases(item: dict, mapping: dict[str, str]) -> dict:
    aliased = dict(item)
    for key in (
        "source_text",
        "protected_source_text",
        "mixed_original_protected_source_text",
        "translation_unit_protected_source_text",
        "group_protected_source_text",
    ):
        if key in aliased and aliased.get(key):
            aliased[key] = replace_placeholders(str(aliased.get(key) or ""), mapping)
    return aliased


def restore_placeholder_aliases(
    result: dict[str, dict[str, str]],
    mapping: dict[str, str],
) -> dict[str, dict[str, str]]:
    restored: dict[str, dict[str, str]] = {}
    for item_id, payload in result.items():
        translated_text = replace_placeholders(str(payload.get("translated_text", "") or ""), mapping)
        restored_payload = result_entry(str(payload.get("decision", "translate") or "translate"), translated_text)
        if payload.get("final_status"):
            restored_payload["final_status"] = str(payload.get("final_status", "") or restored_payload["final_status"])
        restored[item_id] = restored_payload
    return restored


def placeholder_stability_guidance(item: dict, source_sequence: list[str]) -> str:
    if not source_sequence:
        return ""
    return (
        "Placeholder safety rules for this item:\n"
        f"- Allowed placeholders exactly: {', '.join(source_sequence)}\n"
        f"- Placeholder sequence in source_text: {' -> '.join(source_sequence)}\n"
        "- Keep placeholders as atomic tokens.\n"
        "- Do not invent, renumber, duplicate, omit, split, or reorder placeholders.\n"
        "- If a placeholder stands for a whole formula or expression, keep that placeholder as one unit."
    )


def looks_like_english_prose(text: str) -> bool:
    cleaned = strip_placeholders(text).strip()
    if not cleaned:
        return False
    if looks_like_code_literal_text_value(cleaned):
        return False
    if "@" in cleaned or "http://" in cleaned or "https://" in cleaned or looks_like_url_fragment(cleaned):
        return False
    if looks_like_reference_entry_text(cleaned):
        return False
    words = EN_WORD_RE.findall(cleaned)
    if len(words) < 8:
        return False
    alpha_chars = sum(ch.isalpha() for ch in cleaned)
    if alpha_chars < 30:
        return False
    return True


def _english_word_count(text: str) -> int:
    return len(EN_WORD_RE.findall(strip_placeholders(text)))


def _zh_char_count(text: str) -> int:
    return sum(1 for ch in strip_placeholders(text) if "\u4e00" <= ch <= "\u9fff")


def looks_like_untranslated_english_output(item: dict, translated_text: str) -> bool:
    source_text = unit_source_text(item).strip()
    translated = str(translated_text or "").strip()
    if not translated:
        return False
    if not should_force_translate_body_text(item):
        return False
    if not looks_like_english_prose(source_text):
        return False
    english_words = _english_word_count(translated)
    zh_chars = _zh_char_count(translated)
    if english_words < 12:
        return False
    if zh_chars == 0:
        return True
    return english_words >= max(12, zh_chars // 2)


def looks_like_short_fragment(text: str) -> bool:
    stripped = text.strip()
    if not stripped or " " in stripped:
        return False
    return bool(SHORT_FRAGMENT_RE.fullmatch(stripped))


def looks_like_garbled_fragment(text: str) -> bool:
    cleaned = strip_placeholders(text).strip()
    if not cleaned:
        return True
    if "\ufffd" in cleaned:
        return True
    visible = [ch for ch in cleaned if not ch.isspace()]
    if not visible:
        return True
    weird = sum(1 for ch in visible if not (ch.isalnum() or ch in ".,;:!?()[]{}'\"-_/+*&%$#=@"))
    return weird / max(1, len(visible)) > 0.35


def should_force_translate_body_text(item: dict) -> bool:
    source_text = unit_source_text(item).strip()
    if not source_text:
        return False
    if looks_like_code_literal_text_value(source_text):
        return False
    if looks_like_reference_entry_text(source_text):
        return False
    if looks_like_garbled_fragment(source_text):
        return False
    if looks_like_short_fragment(source_text):
        return False
    if str(item.get("block_type", "") or "") != "text":
        return False
    if not is_body_structure_role(item.get("metadata", {}) or {}):
        return False
    words = EN_WORD_RE.findall(strip_placeholders(source_text))
    if item.get("continuation_group"):
        return len(words) >= 6 and looks_like_english_prose(source_text)
    if item.get("block_type") == "text" and bool(item.get("formula_map") or item.get("translation_unit_formula_map")):
        return len(words) >= 5 and looks_like_english_prose(source_text)
    return looks_like_english_prose(source_text) and len(words) >= 8


def should_reject_keep_origin(item: dict, decision: str, payload: dict[str, str] | None = None) -> bool:
    if decision != KEEP_ORIGIN_LABEL:
        return False
    if payload and is_internal_placeholder_degraded(payload):
        return False
    block_type = item.get("block_type")
    if block_type not in {"", None, "text"}:
        return False
    return should_force_translate_body_text(item)


def canonicalize_batch_result(batch: list[dict], result: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    batch_items = {str(item.get("item_id", "") or ""): item for item in batch}
    canonical: dict[str, dict[str, str]] = {}
    for item_id, payload in result.items():
        item = batch_items.get(item_id)
        decision = normalize_decision(str(payload.get("decision", "translate") or "translate"))
        translated_text = unwrap_translation_shell(str(payload.get("translated_text", "") or "").strip(), item_id=item_id)
        if item is not None:
            source_text = unit_source_text(item).strip()
            if decision != KEEP_ORIGIN_LABEL and translated_text:
                repaired_text = repair_safe_duplicate_placeholders(source_text, translated_text)
                if repaired_text is not None:
                    translated_text = repaired_text
            if (
                decision != KEEP_ORIGIN_LABEL
                and translated_text
                and translated_text == source_text
                and not should_force_translate_body_text(item)
            ):
                decision = KEEP_ORIGIN_LABEL
                translated_text = ""
        canonical[item_id] = result_entry(decision, translated_text)
        if isinstance(payload, dict) and payload.get("final_status"):
            canonical[item_id]["final_status"] = str(payload.get("final_status", "") or canonical[item_id]["final_status"])
    return canonical


def looks_like_protocol_shell_output(translated_text: str) -> bool:
    text = str(translated_text or "").strip()
    if not text or not text.startswith("{"):
        return False
    return (
        '"translated_text"' in text
        or '"translations"' in text
        or "“translated_text”" in text
        or "“translations”" in text
    )


def validate_batch_result(
    batch: list[dict],
    result: dict[str, dict[str, str]],
    *,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> None:
    expected_ids = {item["item_id"] for item in batch}
    actual_ids = set(result)
    if actual_ids != expected_ids:
        missing = sorted(expected_ids - actual_ids)
        extra = sorted(actual_ids - expected_ids)
        raise ValueError(f"translation item_id mismatch: missing={missing} extra={extra}")

    for item in batch:
        item_id = item["item_id"]
        source_text = unit_source_text(item)
        translated_result = result.get(item_id, {})
        translated_text = translated_result.get("translated_text", "")
        decision = normalize_decision(translated_result.get("decision", "translate"))
        if should_reject_keep_origin(item, decision, translated_result):
            if diagnostics is not None:
                diagnostics.emit(
                    kind="keep_origin_degraded",
                    item_id=item_id,
                    page_idx=item.get("page_idx"),
                    severity="warning",
                    message="Suspicious keep_origin for long English body text",
                    retryable=True,
                )
            raise SuspiciousKeepOriginError(item_id, result)
        if decision == KEEP_ORIGIN_LABEL:
            continue
        if not translated_text.strip():
            if diagnostics is not None:
                diagnostics.emit(
                    kind="empty_translation",
                    item_id=item_id,
                    page_idx=item.get("page_idx"),
                    severity="error",
                    message="Empty translation output",
                    retryable=True,
                )
            raise EmptyTranslationError(item_id)
        if looks_like_protocol_shell_output(translated_text):
            if diagnostics is not None:
                diagnostics.emit(
                    kind="protocol_shell_output",
                    item_id=item_id,
                    page_idx=item.get("page_idx"),
                    severity="error",
                    message="Translated output still contains JSON/protocol shell",
                    retryable=True,
                )
            raise TranslationProtocolError(
                item_id,
                source_text=source_text,
                translated_text=translated_text,
            )
        if looks_like_untranslated_english_output(item, translated_text):
            if diagnostics is not None:
                diagnostics.emit(
                    kind="english_residue",
                    item_id=item_id,
                    page_idx=item.get("page_idx"),
                    severity="error",
                    message="Translated output still looks predominantly English",
                    retryable=True,
                )
            raise EnglishResidueError(
                item_id,
                source_text=source_text,
                translated_text=translated_text,
            )
        source_placeholders = placeholders(source_text)
        translated_placeholders = placeholders(translated_text)
        if not translated_placeholders.issubset(source_placeholders):
            unexpected = sorted(translated_placeholders - source_placeholders)
            if diagnostics is not None:
                diagnostics.emit(
                    kind="unexpected_placeholder",
                    item_id=item_id,
                    page_idx=item.get("page_idx"),
                    severity="error",
                    message=f"Unexpected placeholders: {unexpected}",
                    retryable=True,
                    details={"unexpected": unexpected},
                )
            raise UnexpectedPlaceholderError(
                item_id,
                unexpected,
                source_text=source_text,
                translated_text=translated_text,
            )
        source_sequence = placeholder_sequence(source_text)
        translated_sequence = placeholder_sequence(translated_text)
        if Counter(translated_sequence) != Counter(source_sequence):
            if diagnostics is not None:
                diagnostics.emit(
                    kind="placeholder_inventory_mismatch",
                    item_id=item_id,
                    page_idx=item.get("page_idx"),
                    severity="error",
                    message="Placeholder inventory mismatch",
                    retryable=True,
                    details={
                        "source_sequence": source_sequence,
                        "translated_sequence": translated_sequence,
                    },
                )
            raise PlaceholderInventoryError(
                item_id,
                source_sequence,
                translated_sequence,
                source_text=source_text,
                translated_text=translated_text,
            )
        if translated_sequence != source_sequence and diagnostics is not None:
            diagnostics.emit(
                kind="placeholder_order_changed",
                item_id=item_id,
                page_idx=item.get("page_idx"),
                severity="warning",
                message="Protected token order changed but inventory is preserved",
                retryable=False,
                details={
                    "source_sequence": source_sequence,
                    "translated_sequence": translated_sequence,
                },
            )
        if translated_text.strip() == source_text.strip():
            if looks_like_url_fragment(source_text):
                continue
            if looks_like_reference_entry_text(source_text):
                continue
            if looks_like_code_literal_text_value(source_text):
                continue
            if looks_like_english_prose(source_text):
                continue


def log_placeholder_failure(
    request_label: str,
    item: dict,
    exc: Exception,
    *,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> None:
    source_text = getattr(exc, "source_text", "") or unit_source_text(item)
    translated_text = getattr(exc, "translated_text", "") or ""
    source_seq = getattr(exc, "source_sequence", None)
    translated_seq = getattr(exc, "translated_sequence", None)
    unexpected = getattr(exc, "unexpected", None)
    if diagnostics is not None:
        kind = "placeholder_unstable"
        if isinstance(exc, UnexpectedPlaceholderError):
            kind = "unexpected_placeholder"
        elif isinstance(exc, PlaceholderInventoryError):
            kind = "placeholder_inventory_mismatch"
        diagnostics.emit(
            kind=kind,
            item_id=str(item.get("item_id", "") or ""),
            page_idx=item.get("page_idx"),
            severity="error",
            message=str(exc),
            retryable=True,
            details={
                "source_sequence": source_seq or [],
                "translated_sequence": translated_seq or [],
                "unexpected": unexpected or [],
            },
        )
    print(
        f"{request_label}: placeholder diagnostic item={item.get('item_id','')} block_type={item.get('block_type','')}",
        flush=True,
    )
    print(f"{request_label}: source preview: {text_preview(source_text)}", flush=True)
    if translated_text:
        print(f"{request_label}: translated preview: {text_preview(translated_text)}", flush=True)
    if unexpected:
        print(f"{request_label}: unexpected placeholders: {unexpected}", flush=True)
    if source_seq is not None or translated_seq is not None:
        print(
            f"{request_label}: placeholder seq source={source_seq or []} translated={translated_seq or []}",
            flush=True,
        )
