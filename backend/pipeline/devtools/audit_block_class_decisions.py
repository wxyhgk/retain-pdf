from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "backend" / "pipeline"))

from retainpdf_pipeline.ocr.document_schema.decision_diff import (
    build_block_class_decision_diff,
    load_allowlist_payload,
)

DEFAULT_CORPUS_ROOT = REPO_ROOT / "data" / "jobs"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare legacy sub_type/tag block decisions with canonical block_class decisions."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="document.v1.json files or directories; defaults to data/jobs",
    )
    parser.add_argument(
        "--allowlist", default="", help="Optional JSON allowlist for reviewed changes."
    )
    parser.add_argument(
        "--write-report", default="", help="Optional path for the full JSON report."
    )
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="Return success even when unexpected changes exist.",
    )
    parser.add_argument(
        "--show-changes",
        type=int,
        default=20,
        help="Maximum changed blocks printed to stdout.",
    )
    return parser.parse_args()


def discover_document_paths(paths: list[str]) -> list[Path]:
    requested = [Path(value).expanduser() for value in paths] or [DEFAULT_CORPUS_ROOT]
    discovered: set[Path] = set()
    for candidate in requested:
        resolved = candidate.resolve()
        if resolved.is_file():
            discovered.add(resolved)
            continue
        if resolved.is_dir():
            discovered.update(
                path.resolve() for path in resolved.rglob("document.v1.json")
            )
            continue
        raise FileNotFoundError(f"corpus path does not exist: {candidate}")
    if not discovered:
        raise FileNotFoundError(
            "no document.v1.json files found in requested corpus paths"
        )
    return sorted(discovered)


def _load_json(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise TypeError(f"expected JSON object: {path}")
    return payload


def _report_path(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def _print_summary(report: dict, *, show_changes: int) -> None:
    print(
        "block-class decision diff "
        f"status={report['status']} documents={report['document_count']} "
        f"blocks={report['block_count']} changes={report['change_count']} "
        f"allowed={report['allowed_change_count']} "
        f"unexpected={report['unexpected_change_count']} "
        f"contract_conflicts={report['contract_conflict_count']}"
    )
    transitions = report.get("transition_counts", {}) or {}
    if transitions:
        print(
            "transitions "
            + " ".join(f"{name}:{count}" for name, count in sorted(transitions.items()))
        )
    print(
        "predicate decision diff "
        f"changes={report.get('predicate_change_count', 0)} "
        f"allowed={report.get('allowed_predicate_change_count', 0)} "
        f"unexpected={report.get('unexpected_predicate_change_count', 0)}"
    )
    predicate_transitions = report.get("predicate_transition_counts", {}) or {}
    if predicate_transitions:
        print(
            "predicate_transitions "
            + " ".join(
                f"{name}:{count}"
                for name, count in sorted(predicate_transitions.items())
            )
        )
    for change in (report.get("changes", []) or [])[: max(0, show_changes)]:
        disposition = "allowed" if change["allowed"] else "UNEXPECTED"
        print(
            f"{disposition} {change['old_class']}->{change['new_class']} "
            f"document={change['document_id']} block={change['block_id'] or change['block_path']} "
            f"roles={change['layout_role']}/{change['semantic_role']}/{change['structure_role']} "
            f"reason={change['allow_reason'] or '-'}"
        )
    for change in (report.get("predicate_changes", []) or [])[
        : max(0, show_changes)
    ]:
        disposition = "allowed" if change["allowed"] else "UNEXPECTED"
        print(
            f"PREDICATE_{disposition} {change['predicate']} "
            f"{str(change['old_value']).lower()}->{str(change['new_value']).lower()} "
            f"document={change['document_id']} "
            f"block={change['block_id'] or change['block_path']} "
            f"reason={change['allow_reason'] or '-'}"
        )
    shown_changes = min(len(report.get("changes", []) or []), max(0, show_changes))
    remaining_slots = max(0, show_changes - shown_changes)
    for conflict in (report.get("contract_conflicts", []) or [])[:remaining_slots]:
        print(
            "CONTRACT_CONFLICT "
            f"declared={conflict['declared_block_class']} canonical={conflict['new_class']} "
            f"document={conflict['document_id']} "
            f"block={conflict['block_id'] or conflict['block_path']}"
        )


def main() -> int:
    args = parse_args()
    document_paths = discover_document_paths(args.paths)
    extra_rules = ()
    if args.allowlist:
        extra_rules = load_allowlist_payload(
            _load_json(Path(args.allowlist).expanduser().resolve())
        )
    report = build_block_class_decision_diff(
        ((_report_path(path), _load_json(path)) for path in document_paths),
        extra_allow_rules=extra_rules,
    )
    _print_summary(report, show_changes=args.show_changes)
    if args.write_report:
        report_path = Path(args.write_report).expanduser().resolve()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"report={report_path}")
    if report["status"] != "pass" and not args.report_only:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
