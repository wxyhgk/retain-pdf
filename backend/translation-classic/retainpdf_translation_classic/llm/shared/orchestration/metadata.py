from __future__ import annotations

from retainpdf_translation.llm.result_payload import is_internal_placeholder_degraded
from retainpdf_translation.llm.result_payload import result_entry
from retainpdf_translation_classic.llm.shared.orchestration.common import formula_placeholder_count
from retainpdf_translation.core.payload.token_protection import restore_protected_tokens
from retainpdf_translation_classic.llm.shared.orchestration.segment_routing import build_formula_segment_plan
from retainpdf_translation_classic.llm.shared.orchestration.segment_routing import effective_formula_segment_count
from retainpdf_translation_classic.llm.shared.orchestration.segment_routing import formula_segment_translation_route
from retainpdf_translation_classic.llm.shared.orchestration.segment_routing import formula_segment_window_count
from retainpdf_translation_classic.llm.shared.orchestration.segment_routing import small_formula_risk_score


def formula_density(source_text: str, placeholder_count: int) -> float:
    if not source_text or placeholder_count <= 0:
        return 0.0
    return round(placeholder_count / max(1, len(source_text)), 4)


def formula_route_diagnostics(
    item: dict,
    *,
    context=None,
) -> dict[str, object]:
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "")
    placeholder_count = formula_placeholder_count(source_text)
    diagnostics: dict[str, object] = {}
    group_split_reason = str(item.get("group_split_reason", "") or "").strip()
    if group_split_reason:
        diagnostics["group_split_reason"] = group_split_reason
    if placeholder_count <= 0:
        return diagnostics
    policy = context.segmentation_policy if context is not None else None
    _, segments = build_formula_segment_plan(source_text)
    diagnostics.update(
        {
            "formula_placeholder_count": placeholder_count,
            "formula_segment_count": len(segments),
            "effective_formula_segment_count": effective_formula_segment_count(segments),
            "formula_window_count": formula_segment_window_count(item, policy=policy),
            "formula_density": formula_density(source_text, placeholder_count),
            "formula_route_decision": formula_segment_translation_route(item, policy=policy),
            "formula_risk_score": small_formula_risk_score(
                source_text,
                segments=segments,
                policy=policy,
            ),
        }
    )
    if item.get("_heavy_formula_split_applied"):
        diagnostics["heavy_block_split_applied"] = True
    return diagnostics


def term_scope_diagnostics(
    item: dict,
    *,
    context=None,
) -> dict[str, object]:
    if context is None or not hasattr(context, "term_scope_summary_for_item"):
        return {}
    summary = context.term_scope_summary_for_item(item)
    if not summary:
        return {}
    if not int(summary.get("glossary_total_count", 0) or 0) and not int(summary.get("abbreviation_total_count", 0) or 0):
        return {}
    return {"term_scope": summary}


def restore_runtime_term_tokens(
    result: dict[str, dict[str, str]],
    *,
    item: dict,
) -> dict[str, dict[str, str]]:
    """把译文里的保护 token 换回原文。

    名字里只说了 term,是因为它起初只处理术语。这是所有翻译路径的统一还原点,
    protected_map 里有哪些类型就还原哪些——漏掉一类,那类 token 就原样留在译文里
    显示成 `<f1-e32/>`,一次事故 262 条里泄漏了 79 条。

    生产里现在只有 term 会进 map（公式边界交给模型,见 placeholder_transform）,
    但这里仍按 formula 一并处理:曾经有过 formula token,将来也可能再有,而
    restore_tokens_by_type({"term"}) 那种写法正是上面那次事故的直接原因。
    """
    protected_map = list(item.get("translation_unit_protected_map") or item.get("protected_map") or [])
    if not protected_map:
        return result
    term_and_formula = [
        entry for entry in protected_map
        if str(entry.get("token_type", "") or "") in {"term", "formula"}
    ]
    if not term_and_formula:
        return result
    restored: dict[str, dict[str, str]] = {}
    for item_id, payload in result.items():
        next_payload = dict(payload)
        next_payload["translated_text"] = restore_protected_tokens(
            str(payload.get("translated_text", "") or ""),
            term_and_formula,
        )
        restored[item_id] = next_payload
    return restored


def should_store_translation_result(payload: dict[str, str]) -> bool:
    if not payload:
        return False
    if is_internal_placeholder_degraded(payload):
        return False
    final_status = str(payload.get("final_status", "") or "").strip().lower()
    if final_status and final_status != "translated":
        return False
    diagnostics = payload.get("translation_diagnostics")
    if isinstance(diagnostics, dict):
        fallback_to = str(diagnostics.get("fallback_to", "") or "").strip().lower()
        if fallback_to == "sentence_level":
            return False
    return True


def attach_result_metadata(
    result: dict[str, dict[str, str]],
    *,
    item: dict,
    context=None,
    route_path: list[str],
    output_mode_path: list[str] | None = None,
    error_taxonomy: str = "",
    fallback_to: str = "",
    degradation_reason: str = "",
) -> dict[str, dict[str, str]]:
    enriched: dict[str, dict[str, str]] = {}
    for item_id, payload in result.items():
        next_payload = dict(payload)
        diagnostics = dict(next_payload.get("translation_diagnostics") or {})
        diagnostics.setdefault("item_id", item.get("item_id", item_id))
        diagnostics.setdefault("page_idx", item.get("page_idx"))
        diagnostics["route_path"] = route_path
        diagnostics["output_mode_path"] = output_mode_path or []
        diagnostics["fallback_to"] = fallback_to
        diagnostics["degradation_reason"] = degradation_reason
        diagnostics["final_status"] = next_payload.get("final_status", "translated")
        diagnostics.update(formula_route_diagnostics(item, context=context))
        diagnostics.update(term_scope_diagnostics(item, context=context))
        if error_taxonomy:
            diagnostics["error_trace"] = [{"type": error_taxonomy}]
        next_payload["translation_diagnostics"] = diagnostics
        enriched[item_id] = next_payload
    return enriched


def keep_origin_result_with_metadata(
    *,
    item: dict,
    degradation_reason: str,
    error_taxonomy: str,
    route_path: list[str],
    error_trace: list[dict[str, object]],
    final_status: str,
    fallback_to: str,
    context=None,
    dead_letter: bool | None = None,
) -> dict[str, dict[str, str]]:
    payload = result_entry("keep_origin", "")
    payload["final_status"] = final_status
    payload["error_taxonomy"] = error_taxonomy
    diagnostics = {
        "item_id": item.get("item_id", ""),
        "page_idx": item.get("page_idx"),
        "route_path": route_path,
        "error_trace": error_trace,
        "fallback_to": fallback_to,
        "degradation_reason": degradation_reason,
        "final_status": final_status,
        **formula_route_diagnostics(item, context=context),
        **term_scope_diagnostics(item, context=context),
    }
    if dead_letter is not None:
        diagnostics["dead_letter"] = bool(dead_letter)
    payload["translation_diagnostics"] = diagnostics
    return {str(item.get("item_id", "") or ""): payload}
