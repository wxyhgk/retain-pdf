"""Offline prompt reconstruction from completed pages and Rust receipts; no API calls.

Reports lengths only, never source text, model output, credentials or prompts.
This is not an exact replay: runtime glossary/memory guidance was not persisted.
"""
import argparse
from collections import Counter, defaultdict
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from support.paths import PIPELINE
sys.path.insert(0, str(PIPELINE))

from retainpdf_pipeline.translate.core.payload.parts.units import _build_group_translation_unit
from retainpdf_pipeline.translate.llm.shared.prompt_building import (
    build_group_member_messages, build_messages, build_single_item_fallback_messages,
)


def unit_hash(items):
    members = sorted({str(identity) for item in items for identity in
                      [item["item_id"], *item.get("translation_unit_member_ids", [])] if identity})
    canonical = json.dumps(["translation", members], ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def reconstruct(items, unit_id, content, *, mode="fast", target_language_name="简体中文"):
    """Require identity agreement; never guess membership from request order."""
    for item in items.values():
        if item.get("translation_unit_kind", "single") == "single" and unit_hash([item]) == unit_id:
            return "single", build_single_item_fallback_messages(
                deepcopy(item), mode=mode, target_language_name=target_language_name,
            )
    ids = re.findall(r"<<<ITEM\s+item_id=([^>\s]+)\s*>>>", content)
    if ids and len(ids) == len(set(ids)) and all(i in items for i in ids):
        batch = [deepcopy(items[i]) for i in ids]
        if unit_hash(batch) == unit_id:
            return "batch", build_messages(
                batch, response_style="tagged", mode=mode, target_language_name=target_language_name,
            )
    try:
        payload = json.loads(content)
    except ValueError:
        return None
    if not isinstance(payload, dict) or not isinstance(payload.get("member_translations"), list):
        return None
    ids = [m.get("item_id") for m in payload["member_translations"] if isinstance(m, dict)]
    if not ids or len(ids) != len(set(ids)) or not all(i in items for i in ids):
        return None
    first = items[ids[0]]
    ordered_ids = first.get("translation_unit_member_ids", [])
    if set(ordered_ids) != set(ids):
        return None
    group_id = first.get("translation_unit_id", "")
    if not group_id.startswith("__cg__:"):
        return None
    if any(items[i].get("translation_unit_id") != group_id for i in ids):
        return None
    group = _build_group_translation_unit(group_id, [deepcopy(items[i]) for i in ordered_ids])
    if group is not None and unit_hash([group]) == unit_id:
        return "group", build_group_member_messages(
            group, mode=mode, target_language_name=target_language_name,
        )
    return None


def audit(report_path, *, mode="fast", target_language_name="简体中文"):
    report_path = Path(report_path).resolve()
    report = json.loads(report_path.read_text())
    job_id = report["job_id"]
    if not isinstance(job_id, str) or job_id in {"", ".", ".."} or Path(job_id).name != job_id:
        raise ValueError("invalid job ID")
    root = report_path.parent
    pages = sorted((root / "data/jobs" / job_id / "translated").glob("page-*-deepseek.json"))
    if not pages:
        raise ValueError("missing page artifacts")
    items = {}
    for page in pages:
        for item in json.loads(page.read_text()):
            if item["item_id"] in items:
                raise ValueError("duplicate item ID")
            items[item["item_id"]] = item
    db_path = root / "data/db/jobs.db"
    with sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True) as db:
        rows = db.execute(
            "SELECT unit_id,purpose,status,result_json FROM model_operations WHERE job_id=?",
            (job_id,),
        ).fetchall()
    if not rows:
        raise ValueError("missing model receipts")
    stats = defaultdict(Counter)
    excluded = Counter()
    for unit_id, purpose, status, encoded in rows:
        if status != "succeeded" or purpose != "primary":
            excluded[f"{purpose}_{status}"] += 1
            continue
        receipt = json.loads(encoded)
        result = reconstruct(items, unit_id, receipt.get("content", ""),
                             mode=mode, target_language_name=target_language_name)
        if result is None:
            excluded["non_translation_or_unmatched"] += 1
            continue
        route, messages = result
        stats[route]["requests"] += 1
        for message in messages:
            stats[route][message["role"] + "_chars"] += len(message["content"])
        for name in ("input_tokens", "output_tokens"):
            value = receipt.get(name)
            if isinstance(value, int):
                stats[route]["historical_" + name] += value
            else:
                stats[route]["unknown_historical_" + name] += 1
    for values in stats.values():
        total = values["system_chars"] + values["user_chars"]
        values["total_chars"] = total
        values["mean_chars"] = round(total / values["requests"], 1)
    return {
        "schema": "offline_prompt_audit_v1", "receipt_count": len(rows),
        "reconstruction_settings": {"mode": mode, "target_language_name": target_language_name},
        "reconstructed_count": sum(v["requests"] for v in stats.values()),
        "routes": dict(stats), "excluded": dict(excluded),
        "scope": "Current builders, historical page artifacts and hash-verified membership. "
                 "Domain/runtime glossary/memory guidance not reconstructed; persisted item notes retained. "
                 "Repairs not reconstructed. "
                 "Character counts are not tokens; historical tokens are not new prompt usage. "
                 "Not an exact frozen-plan replay or a quality/speed evaluation.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("--mode", choices=("fast", "sci"), default="fast")
    parser.add_argument("--target-language", default="简体中文")
    args = parser.parse_args()
    print(json.dumps(audit(args.report, mode=args.mode, target_language_name=args.target_language),
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
