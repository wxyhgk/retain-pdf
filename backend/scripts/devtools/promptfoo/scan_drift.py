from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


PROMPTFOO_DIR = Path(__file__).resolve().parent
if str(PROMPTFOO_DIR) not in sys.path:
    sys.path.insert(0, str(PROMPTFOO_DIR))

from common import build_case_drift_summary
from common import build_saved_case_snapshot
from common import load_saved_translation_items
from common import preview_text
from common import resolve_job_root
from devtools.replay_translation_item import replay_translation_item


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Replay selected translation items in a job and summarize policy drift."
    )
    parser.add_argument(
        "--job-root",
        required=True,
        help="Absolute job root path or job id under data/jobs.",
    )
    parser.add_argument(
        "--saved-final-status",
        default="kept_origin",
        help="Only scan saved items with this final_status. Use empty string to disable.",
    )
    parser.add_argument(
        "--saved-skip-reason",
        default="",
        help="Only scan saved items with this skip_reason.",
    )
    parser.add_argument(
        "--page",
        type=int,
        default=None,
        help="Only scan one page number (1-based).",
    )
    parser.add_argument(
        "--q",
        default="",
        help="Case-insensitive substring matched against item id, source text, skip reason, or classification label.",
    )
    parser.add_argument("--limit", type=int, default=20, help="Candidate limit after saved-side filtering.")
    parser.add_argument("--offset", type=int, default=0, help="Candidate offset after saved-side filtering.")
    parser.add_argument(
        "--all",
        dest="only_drifted",
        action="store_false",
        default=True,
        help="Show all replayed candidates, not just drifted ones.",
    )
    parser.add_argument(
        "--write-json",
        default="",
        help="Optional path to write the JSON report.",
    )
    return parser.parse_args()


def _matches_query(snapshot: dict[str, object], query: str) -> bool:
    needle = str(query or "").strip().lower()
    if not needle:
        return True
    haystacks = [
        str(snapshot.get("item_id") or ""),
        str(snapshot.get("source_text") or ""),
        str(snapshot.get("translated_text") or ""),
        str(snapshot.get("skip_reason") or ""),
        str(snapshot.get("classification_label") or ""),
    ]
    return any(needle in value.lower() for value in haystacks)


def main() -> int:
    args = parse_args()
    job_root = resolve_job_root(args.job_root)
    items = load_saved_translation_items(str(job_root))
    candidates: list[dict[str, object]] = []
    for payload in items:
        snapshot = build_saved_case_snapshot(payload)
        if args.saved_final_status.strip():
            if str(snapshot.get("final_status") or "") != args.saved_final_status.strip():
                continue
        if args.saved_skip_reason.strip():
            if str(snapshot.get("skip_reason") or "") != args.saved_skip_reason.strip():
                continue
        if args.page is not None and int(snapshot.get("page_number") or 0) != args.page:
            continue
        if not _matches_query(snapshot, args.q):
            continue
        candidates.append(payload)

    candidates.sort(
        key=lambda payload: (
            int(payload.get("page_idx") or -1),
            int((payload.get("item") or {}).get("block_idx") or -1),
        )
    )
    sliced = candidates[args.offset : args.offset + max(0, args.limit)]
    results = []
    for payload in sliced:
        replay_payload = replay_translation_item(job_root, str((payload.get("item") or {}).get("item_id") or ""))
        drift = build_case_drift_summary(payload, replay_payload)
        if args.only_drifted and not drift["drifted"]:
            continue
        saved_snapshot = build_saved_case_snapshot(payload)
        results.append(
            {
                "item_id": saved_snapshot["item_id"],
                "page_number": saved_snapshot["page_number"],
                "block_idx": saved_snapshot["block_idx"],
                "source_preview": preview_text(str(saved_snapshot.get("source_text") or "")),
                "saved": {
                    "final_status": saved_snapshot["final_status"],
                    "should_translate": saved_snapshot["should_translate"],
                    "skip_reason": saved_snapshot["skip_reason"],
                    "classification_label": saved_snapshot["classification_label"],
                },
                "replay": {
                    "policy_before": replay_payload.get("policy_before") or {},
                    "policy_after": replay_payload.get("policy_after") or {},
                    "replay_result": replay_payload.get("replay_result") or {},
                    "replay_error": replay_payload.get("replay_error") or {},
                },
                "drift": drift,
            }
        )

    report = {
        "job_root": str(job_root),
        "job_id": job_root.name,
        "filters": {
            "saved_final_status": args.saved_final_status,
            "saved_skip_reason": args.saved_skip_reason,
            "page": args.page,
            "q": args.q,
            "offset": args.offset,
            "limit": args.limit,
            "only_drifted": args.only_drifted,
        },
        "candidate_count": len(candidates),
        "replayed_count": len(sliced),
        "reported_count": len(results),
        "items": results,
    }
    if str(args.write_json or "").strip():
        output_path = Path(args.write_json).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
