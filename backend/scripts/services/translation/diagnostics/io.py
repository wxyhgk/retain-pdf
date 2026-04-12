from __future__ import annotations

from pathlib import Path

from services.mineru.artifacts import save_json

from .aggregator import TranslationRunDiagnostics
from .models import FinalStatus


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
    for page_idx, items in sorted(translated_pages_map.items()):
        for item in items:
            payload = dict(item.get("translation_diagnostics") or {})
            if not payload:
                continue
            payload.setdefault("item_id", item.get("item_id", ""))
            payload.setdefault("page_idx", page_idx)
            final_status = str(payload.get("final_status", "") or item.get("final_status", "") or FinalStatus.TRANSLATED.value)
            payload["final_status"] = final_status
            status_summary[final_status] = status_summary.get(final_status, 0) + 1
            route_path = payload.get("route_path") or []
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
    }
