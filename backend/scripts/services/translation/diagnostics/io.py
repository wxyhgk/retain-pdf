from __future__ import annotations

from pathlib import Path

from services.pipeline_shared.io import save_json

from .aggregator import TranslationRunDiagnostics
from .models import FinalStatus


ALLOWED_UNTRANSLATED_ROUTE_NAMES = {
    "fast_path_keep_origin",
}
ALLOWED_UNTRANSLATED_REASONS = {
    "code",
    "keep_origin",
    "no_trans",
    "skip_display_formula",
    "skip_model_keep_origin",
}


def _is_allowed_untranslated(item: dict, payload: dict, route_path: list) -> bool:
    route_names = {str(route or "").strip() for route in route_path}
    if route_names & ALLOWED_UNTRANSLATED_ROUTE_NAMES:
        return True
    reasons = {
        str(item.get("skip_reason", "") or "").strip(),
        str(item.get("classification_label", "") or "").strip(),
        str(payload.get("degradation_reason", "") or "").strip(),
        str(payload.get("fallback_to", "") or "").strip(),
    }
    return bool(reasons & ALLOWED_UNTRANSLATED_REASONS)


def write_translation_diagnostics(
    path: Path,
    run: TranslationRunDiagnostics,
    *,
    glossary: dict | None = None,
    translated_pages_map: dict[int, list[dict]] | None = None,
) -> dict:
    summary = run.build_summary()
    item_diagnostics, summary_fields = aggregate_payload_diagnostics(translated_pages_map or {})
    summary.update(summary_fields)
    if item_diagnostics:
        summary["item_diagnostics"] = item_diagnostics
    if glossary:
        summary["glossary"] = glossary
    save_json(path, summary)
    return summary


def aggregate_payload_diagnostics(translated_pages_map: dict[int, list[dict]]) -> tuple[list[dict], dict[str, object]]:
    item_diagnostics: list[dict] = []
    status_summary = {
        FinalStatus.TRANSLATED.value: 0,
        FinalStatus.PARTIALLY_TRANSLATED.value: 0,
        FinalStatus.KEPT_ORIGIN.value: 0,
        FinalStatus.FAILED.value: 0,
    }
    route_summary: dict[str, dict[str, int]] = {}
    error_summary: dict[str, int] = {}
    formula_route_summary: dict[str, int] = {}
    heavy_block_split_summary: dict[str, int] = {}
    slow_items: list[dict] = []
    latencies: list[int] = []
    dead_letter_items: list[dict] = []
    unresolved_items: list[dict] = []
    for page_idx, items in sorted(translated_pages_map.items()):
        for item in items:
            payload = dict(item.get("translation_diagnostics") or {})
            item_final_status = str(item.get("final_status", "") or "").strip()
            final_status = str(payload.get("final_status", "") or item_final_status or "").strip()
            has_translation_artifact = bool(
                str(
                    item.get("translated_text")
                    or item.get("protected_translated_text")
                    or item.get("translation_unit_translated_text")
                    or item.get("translation_unit_protected_translated_text")
                    or ""
                ).strip()
            )
            if not payload and not final_status and not has_translation_artifact:
                continue
            # Payload-level diagnostics can still say "translated" even when policy has already
            # settled the item to kept_origin/failed. Use the item terminal state as the source
            # of truth when no translated artifact exists.
            if (
                item_final_status
                and item_final_status != FinalStatus.TRANSLATED.value
                and not has_translation_artifact
            ):
                final_status = item_final_status
            payload.setdefault("item_id", item.get("item_id", ""))
            payload.setdefault("page_idx", page_idx)
            final_status = final_status or FinalStatus.TRANSLATED.value
            payload["final_status"] = final_status
            status_summary[final_status] = status_summary.get(final_status, 0) + 1
            route_path = payload.get("route_path") or []
            if bool(payload.get("dead_letter")) or "dlq" in route_path:
                dead_letter_items.append(
                    {
                        "item_id": payload.get("item_id", ""),
                        "page_idx": payload.get("page_idx"),
                        "reason": payload.get("degradation_reason", "") or "dead_letter_queue",
                    }
                )
            blocking_untranslated = final_status in {
                FinalStatus.KEPT_ORIGIN.value,
                FinalStatus.FAILED.value,
            } and not _is_allowed_untranslated(item, payload, route_path)
            if blocking_untranslated:
                unresolved_items.append(
                    {
                        "item_id": payload.get("item_id", ""),
                        "page_idx": payload.get("page_idx"),
                        "final_status": final_status,
                        "reason": payload.get("degradation_reason", "") or payload.get("fallback_to", "") or "untranslated",
                    }
                )
            for route in route_path:
                route_key = str(route or "")
                stats = route_summary.setdefault(route_key, {"count": 0, "success": 0})
                stats["count"] += 1
                if final_status in {FinalStatus.TRANSLATED.value, FinalStatus.PARTIALLY_TRANSLATED.value}:
                    stats["success"] += 1
            for entry in payload.get("error_trace") or []:
                taxonomy = str((entry or {}).get("type", "") or "")
                if taxonomy:
                    error_summary[taxonomy] = error_summary.get(taxonomy, 0) + 1
            formula_route_decision = str(payload.get("formula_route_decision", "") or "")
            if formula_route_decision:
                formula_route_summary[formula_route_decision] = formula_route_summary.get(formula_route_decision, 0) + 1
            heavy_split_reason = str(payload.get("degradation_reason", "") or "")
            if "heavy_formula" in heavy_split_reason:
                heavy_block_split_summary[heavy_split_reason] = heavy_block_split_summary.get(heavy_split_reason, 0) + 1
            latency_ms = int(payload.get("latency_ms", 0) or 0)
            if latency_ms > 0:
                latencies.append(latency_ms)
            item_diagnostics.append(payload)
    if latencies:
        mean_latency = sum(latencies) / len(latencies)
        variance = sum((value - mean_latency) ** 2 for value in latencies) / len(latencies)
        dynamic_threshold = int(mean_latency + (2 * variance**0.5))
        threshold = max(30000, dynamic_threshold)
        for payload in item_diagnostics:
            latency_ms = int(payload.get("latency_ms", 0) or 0)
            if latency_ms > threshold:
                slow_items.append(
                    {
                        "item_id": payload.get("item_id", ""),
                        "latency_ms": latency_ms,
                        "reason": payload.get("degradation_reason", "") or payload.get("fallback_to", "") or "slow",
                    }
                )
    route_summary_payload = {
        route: {
            "count": stats["count"],
            "success_rate": round(stats["success"] / max(1, stats["count"]), 4),
        }
        for route, stats in route_summary.items()
        if route
    }
    return item_diagnostics, {
        "translation_protocol_version": "v2",
        "status_summary": status_summary,
        "route_summary": route_summary_payload,
        "error_summary": error_summary,
        "formula_route_summary": formula_route_summary,
        "heavy_block_split_summary": heavy_block_split_summary,
        "slow_items": slow_items[:20],
        "dead_letter_items": dead_letter_items[:100],
        "dead_letter_count": len(dead_letter_items),
        "unresolved_items": unresolved_items[:100],
        "unresolved_translation_count": len(unresolved_items),
    }
