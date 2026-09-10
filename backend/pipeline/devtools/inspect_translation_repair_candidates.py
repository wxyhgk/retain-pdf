from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from collections import defaultdict
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.core.item_reader import item_policy_translate
from retainpdf_pipeline.translate.core.payload import load_translation_manifest_file
from retainpdf_pipeline.translate.core.payload import load_translations
from retainpdf_pipeline.translate.services.agents import TranslationAgentCoordinator
from retainpdf_pipeline.translate.services.agents.repair_pipeline import _has_blocking_issue
from retainpdf_pipeline.translate.services.agents.repair_pipeline import _repairable_review_issues


def _job_root_from_arg(value: str) -> Path:
    path = Path(value).expanduser()
    if path.is_absolute():
        return path.resolve()
    data_job = (REPO_SCRIPTS_ROOT.parents[1] / "data" / "jobs" / value).resolve()
    if data_job.exists():
        return data_job
    return path.resolve()


def _translated_dir_from_arg(value: str) -> Path:
    path = Path(value).expanduser()
    if path.is_absolute():
        return path.resolve()
    return path.resolve()


def _load_payload_paths(*, job_root: Path | None, translated_dir: Path | None) -> dict[int, Path]:
    if job_root is not None:
        manifest_path = job_root / "translated" / "translation-manifest.json"
        return load_translation_manifest_file(manifest_path, translations_dir=manifest_path.parent)
    if translated_dir is None:
        raise ValueError("job_root or translated_dir is required")
    manifest_path = translated_dir / "translation-manifest.json"
    if manifest_path.exists():
        return load_translation_manifest_file(manifest_path, translations_dir=translated_dir)
    paths = sorted(translated_dir.glob("page-*-deepseek.json"))
    return {index: path for index, path in enumerate(paths)}


def _translated_result_from_item(item: dict) -> dict[str, str]:
    return {
        "decision": "translate",
        "translated_text": str(
            item.get("protected_translated_text")
            or item.get("translation_unit_protected_translated_text")
            or item.get("translated_text")
            or ""
        ),
    }


def _preview_text(text: str, *, limit: int) -> str:
    compact = " ".join(str(text or "").split()).strip()
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "..."


def inspect_repair_candidates(
    *,
    job_root: Path | None = None,
    translated_dir: Path | None = None,
    include_non_translatable: bool = False,
    example_limit: int = 12,
    preview_chars: int = 220,
) -> dict[str, object]:
    manifest = _load_payload_paths(job_root=job_root, translated_dir=translated_dir)
    coordinator = TranslationAgentCoordinator()
    counts: Counter[str] = Counter()
    issue_counts: Counter[str] = Counter()
    repairable_issue_counts: Counter[str] = Counter()
    blocking_issue_counts: Counter[str] = Counter()
    status_counts: Counter[str] = Counter()
    role_counts: Counter[str] = Counter()
    examples: dict[str, list[dict[str, object]]] = defaultdict(list)

    for page_idx, payload_path in sorted(manifest.items()):
        try:
            payload = load_translations(payload_path, strict_contract=False)
        except Exception as exc:  # noqa: BLE001
            counts["load_errors"] += 1
            _append_example(
                examples,
                "load_errors",
                example_limit,
                {"path": str(payload_path), "error": f"{type(exc).__name__}: {exc}"},
            )
            continue
        if not isinstance(payload, list):
            counts["non_list_payload"] += 1
            continue
        for item in payload:
            if not isinstance(item, dict):
                continue
            counts["items"] += 1
            item_id = str(item.get("item_id", "") or "")
            status = str(item.get("final_status") or "") or "<empty>"
            role = str(item.get("structure_role") or item.get("semantic_role") or item.get("layout_role") or "") or "<empty>"
            status_counts[status] += 1
            role_counts[role] += 1
            should_translate = item_policy_translate(item) is True and item.get("should_translate", True) is True
            if not should_translate and not include_non_translatable:
                counts["not_should_translate"] += 1
                continue
            counts["reviewed_items"] += 1
            translated_result = _translated_result_from_item(item)
            if not translated_result["translated_text"].strip():
                counts["empty_translation"] += 1
                _append_item_example(
                    examples,
                    "empty_translation",
                    item=item,
                    page_idx=page_idx,
                    payload_path=payload_path,
                    preview_chars=preview_chars,
                    example_limit=example_limit,
                    extra={"status": status},
                )
            review = coordinator.review_batch([item], {item_id: translated_result})
            if review.issues:
                counts["items_with_issues"] += 1
                for issue in review.issues:
                    issue_counts[issue.kind] += 1
            if _has_blocking_issue(review.issues):
                counts["blocking_items"] += 1
                for issue in review.issues:
                    blocking_issue_counts[issue.kind] += 1
                _append_item_example(
                    examples,
                    "blocking",
                    item=item,
                    page_idx=page_idx,
                    payload_path=payload_path,
                    preview_chars=preview_chars,
                    example_limit=example_limit,
                    extra={"issues": [issue.kind for issue in review.issues]},
                )
                continue
            repairable = _repairable_review_issues(review)
            if repairable:
                counts["repairable_items"] += 1
                for issue in repairable:
                    repairable_issue_counts[issue.kind] += 1
                _append_item_example(
                    examples,
                    "repairable",
                    item=item,
                    page_idx=page_idx,
                    payload_path=payload_path,
                    preview_chars=preview_chars,
                    example_limit=example_limit,
                    extra={"issues": [issue.kind for issue in repairable]},
                )
    return {
        "job_root": str(job_root) if job_root is not None else "",
        "translated_dir": str(translated_dir) if translated_dir is not None else "",
        "page_payload_count": len(manifest),
        "counts": dict(counts),
        "issue_counts": dict(issue_counts),
        "repairable_issue_counts": dict(repairable_issue_counts),
        "blocking_issue_counts": dict(blocking_issue_counts),
        "status_counts": dict(status_counts.most_common()),
        "role_counts": dict(role_counts.most_common()),
        "examples": dict(examples),
    }


def _append_example(
    examples: dict[str, list[dict[str, object]]],
    key: str,
    limit: int,
    payload: dict[str, object],
) -> None:
    if len(examples[key]) < limit:
        examples[key].append(payload)


def _append_item_example(
    examples: dict[str, list[dict[str, object]]],
    key: str,
    *,
    item: dict,
    page_idx: int,
    payload_path: Path,
    preview_chars: int,
    example_limit: int,
    extra: dict[str, object] | None = None,
) -> None:
    source = str(
        item.get("translation_unit_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )
    translated = _translated_result_from_item(item)["translated_text"]
    payload = {
        "item_id": str(item.get("item_id", "") or ""),
        "page_idx": int(item.get("page_idx", page_idx) or page_idx),
        "payload_path": str(payload_path),
        "source_preview": _preview_text(source, limit=preview_chars),
        "translated_preview": _preview_text(translated, limit=preview_chars),
    }
    if extra:
        payload.update(extra)
    _append_example(examples, key, example_limit, payload)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Inspect existing translation payloads for agent repair candidates without calling any LLM.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--job-root", type=str, help="Job root path or job_id under data/jobs.")
    group.add_argument("--translated-dir", type=str, help="Directory containing translation payload JSON files.")
    parser.add_argument("--include-non-translatable", action="store_true")
    parser.add_argument("--examples", type=int, default=12)
    parser.add_argument("--preview-chars", type=int, default=220)
    parser.add_argument("--output", type=str, default="")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    summary = inspect_repair_candidates(
        job_root=_job_root_from_arg(args.job_root) if args.job_root else None,
        translated_dir=_translated_dir_from_arg(args.translated_dir) if args.translated_dir else None,
        include_non_translatable=args.include_non_translatable,
        example_limit=max(0, args.examples),
        preview_chars=max(40, args.preview_chars),
    )
    text = json.dumps(summary, ensure_ascii=False, indent=2)
    if args.output:
        output_path = Path(args.output).expanduser()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
