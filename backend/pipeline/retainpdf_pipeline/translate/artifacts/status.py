from __future__ import annotations

from retainpdf_pipeline.translate.core.item_reader import item_block_class

from .models import FinalStatus


ALLOWED_UNTRANSLATED_ROUTE_NAMES = {
    "fast_path_keep_origin",
}
ALLOWED_UNTRANSLATED_REASONS = {
    "code",
    "keep_origin",
    "no_trans",
    "short_non_body_label",
    "skip_interline_equation",
    "skip_display_formula",
    "skip_model_keep_origin",
}
KEEP_ORIGIN_POLICY_LABELS = {
    "code",
    "keep_origin",
    "no_trans",
    "skip_model_keep_origin",
}


def translation_artifact_text(item: dict) -> str:
    return str(
        item.get("translated_text")
        or item.get("protected_translated_text")
        or item.get("translation_unit_translated_text")
        or item.get("translation_unit_protected_translated_text")
        or ""
    ).strip()


def has_translation_artifact(item: dict) -> bool:
    return bool(translation_artifact_text(item))


def has_repaired_translation_artifact(item: dict, diagnostics: dict | None = None) -> bool:
    if not has_translation_artifact(item):
        return False
    diagnostics = dict(diagnostics or item.get("translation_diagnostics") or {})
    if diagnostics.get("garbled_reconstructed") is True:
        return True
    if str(item.get("classification_label", "") or "").strip() == "llm_reconstructed_garbled":
        return True
    if diagnostics.get("agent_repaired") is True:
        return True
    return False


def is_allowed_untranslated(item: dict, diagnostics: dict | None = None, route_path: list | None = None) -> bool:
    if _policy_state_allows_keep_origin(item):
        return True
    diagnostics = dict(diagnostics or {})
    if item_block_class(item) == "formula":
        return True
    route_names = {str(route or "").strip() for route in (route_path if route_path is not None else diagnostics.get("route_path") or [])}
    if route_names & ALLOWED_UNTRANSLATED_ROUTE_NAMES:
        return True
    reasons = {
        str(item.get("skip_reason", "") or "").strip(),
        str(item.get("classification_label", "") or "").strip(),
        str(diagnostics.get("degradation_reason", "") or "").strip(),
        str(diagnostics.get("fallback_to", "") or "").strip(),
    }
    return bool(reasons & ALLOWED_UNTRANSLATED_REASONS)


def item_final_status(item: dict, diagnostics: dict | None = None) -> str:
    diagnostics = diagnostics or {}
    return str(diagnostics.get("final_status", "") or item.get("final_status", "") or "").strip()


def is_blocking_untranslated(item: dict, diagnostics: dict | None = None, route_path: list | None = None) -> bool:
    if has_repaired_translation_artifact(item, diagnostics):
        return False
    final_status = item_final_status(item, diagnostics)
    if final_status in {FinalStatus.KEPT_ORIGIN.value, FinalStatus.FAILED.value}:
        return not is_allowed_untranslated(item, diagnostics, route_path)
    if final_status == FinalStatus.TRANSLATED.value and not has_translation_artifact(item):
        return not is_allowed_untranslated(item, diagnostics, route_path)
    return False


def blocking_untranslated_items(translated_pages_map: dict[int, list[dict]]) -> list[dict[str, object]]:
    blocked: list[dict[str, object]] = []
    for page_idx, items in sorted(translated_pages_map.items()):
        for item in items:
            diagnostics = dict(item.get("translation_diagnostics") or {})
            if (
                str(item.get("final_status", "") or "").strip() == FinalStatus.TRANSLATED.value
                and has_translation_artifact(item)
            ):
                diagnostics["final_status"] = FinalStatus.TRANSLATED.value
            if not is_blocking_untranslated(item, diagnostics):
                continue
            blocked.append(
                {
                    "item_id": str(item.get("item_id", "") or ""),
                    "page_idx": int(item.get("page_idx", page_idx) or page_idx),
                    "final_status": item_final_status(item, diagnostics),
                    "reason": str(
                        diagnostics.get("degradation_reason", "")
                        or diagnostics.get("fallback_to", "")
                        or "untranslated"
                    ),
                }
            )
    return blocked


def blocking_review_error_items(review: dict | None) -> list[dict[str, object]]:
    if not isinstance(review, dict):
        return []
    blocked: list[dict[str, object]] = []
    for issue in review.get("issues") or []:
        if not isinstance(issue, dict):
            continue
        if str(issue.get("severity", "") or "") != "error":
            continue
        if _review_issue_allowed_by_policy(issue):
            continue
        blocked.append(
            {
                "item_id": str(issue.get("item_id", "") or ""),
                "page_idx": issue.get("page_idx"),
                "kind": str(issue.get("kind", "") or "review_error"),
                "message": str(issue.get("message", "") or ""),
            }
        )
    return blocked


def _review_issue_allowed_by_policy(issue: dict) -> bool:
    policy_state = issue.get("policy_state") or {}
    if not isinstance(policy_state, dict):
        return False
    has_explicit_keep_origin_state = (
        policy_state.get("should_translate") is False
        or str(policy_state.get("classification_label", "") or "").strip()
        or str(policy_state.get("skip_reason", "") or "").strip()
    )
    if not has_explicit_keep_origin_state:
        return False
    return _policy_state_allows_keep_origin(policy_state)


def _policy_state_allows_keep_origin(item: dict) -> bool:
    if item.get("should_translate") is False:
        return True
    if _policy_bool(item.get("policy_translate")) is False:
        return True
    labels = {
        str(item.get("skip_reason", "") or "").strip(),
        str(item.get("classification_label", "") or "").strip(),
    }
    return bool(labels & KEEP_ORIGIN_POLICY_LABELS)


def _policy_bool(value: object) -> bool | None:
    if isinstance(value, bool):
        return value
    normalized = str(value or "").strip().lower()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    return None


def enforce_no_blocking_review_errors(review: dict | None) -> None:
    blocked = blocking_review_error_items(review)
    if not blocked:
        return
    preview_parts: list[str] = []
    for item in blocked[:8]:
        page_idx = item.get("page_idx")
        try:
            page_label = f"p{int(page_idx) + 1}"
        except Exception:
            page_label = "p?"
        preview_parts.append(f"{page_label}:{item['item_id']}:{item['kind']}")
    preview = ", ".join(preview_parts)
    raise RuntimeError(
        f"translation review gate blocked: review_error_count={len(blocked)} preview={preview}"
    )


def enforce_no_blocking_untranslated(translated_pages_map: dict[int, list[dict]]) -> None:
    blocked = blocking_untranslated_items(translated_pages_map)
    if not blocked:
        return
    preview = ", ".join(
        f"p{int(item['page_idx']) + 1}:{item['item_id']}:{item['reason']}"
        for item in blocked[:8]
    )
    raise RuntimeError(
        f"translation export gate blocked: unresolved_translation_count={len(blocked)} preview={preview}"
    )


__all__ = [
    "ALLOWED_UNTRANSLATED_REASONS",
    "ALLOWED_UNTRANSLATED_ROUTE_NAMES",
    "KEEP_ORIGIN_POLICY_LABELS",
    "blocking_review_error_items",
    "blocking_untranslated_items",
    "enforce_no_blocking_review_errors",
    "enforce_no_blocking_untranslated",
    "has_translation_artifact",
    "has_repaired_translation_artifact",
    "is_allowed_untranslated",
    "is_blocking_untranslated",
    "item_final_status",
    "translation_artifact_text",
]
