from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
PIPELINE_ROOT = Path(__file__).resolve().parents[1]
if str(PIPELINE_ROOT) not in sys.path:
    sys.path.append(str(PIPELINE_ROOT))

from retainpdf_pipeline.foundation.shared.stage_specs import RENDER_STAGE_SCHEMA_VERSION
from retainpdf_pipeline.foundation.shared.stage_specs import TRANSLATE_STAGE_SCHEMA_VERSION
from retainpdf_pipeline.translate.workflow.batching.batching import _is_low_risk_batchable_item
from retainpdf_pipeline.translate.services.context.execution_context import context_with_memory_guidance
from retainpdf_pipeline.translate.services.fast_path.keep_origin import _is_fast_path_keep_origin_item
from retainpdf_pipeline.translate.services.fast_path.keep_origin import _plan_item_view
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
from retainpdf_pipeline.translate.services.memory import JobMemoryStore


def _job_root_from_arg(value: str) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = (REPO_ROOT / "data" / "jobs" / value).resolve()
    return path.resolve()


def _load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _manifest_path(job_root: Path) -> Path:
    return job_root / "translated" / "translation-manifest.json"


def _summary_path(job_root: Path) -> Path:
    return job_root / "artifacts" / "mineru_pipeline_summary.json"


def _source_pdf_path(job_root: Path) -> Path:
    summary_path = _summary_path(job_root)
    if summary_path.exists():
        payload = _load_json(summary_path)
        source_pdf = str(payload.get("source_pdf", "") or "").strip()
        if source_pdf:
            return Path(source_pdf).resolve()
    source_dir = job_root / "source"
    pdfs = sorted(source_dir.glob("*.pdf"))
    if len(pdfs) == 1:
        return pdfs[0].resolve()
    raise RuntimeError(f"cannot determine source_pdf for job: {job_root}")


def _source_json_path(job_root: Path) -> Path:
    candidate = (job_root / "ocr" / "normalized" / "document.v1.json").resolve()
    if candidate.exists():
        return candidate
    raise RuntimeError(f"cannot determine normalized source_json for job: {job_root}")


def _collect_page_records(job_root: Path) -> list[dict]:
    manifest = _load_json(_manifest_path(job_root))
    records: list[dict] = []
    for page in manifest.get("pages", []):
        rel = str(page.get("path", "") or "").strip()
        if not rel:
            continue
        page_path = (job_root / "translated" / rel).resolve()
        if not page_path.exists():
            continue
        for item in _load_json(page_path):
            if isinstance(item, dict):
                records.append(item)
    return records


def _memory_store(job_root: Path) -> JobMemoryStore | None:
    memory_path = job_root / "translated" / "job-memory.json"
    return JobMemoryStore(memory_path) if memory_path.exists() else None


def _compact_text(value: object, limit: int = 500) -> str:
    compact = " ".join(str(value or "").split())
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit - 3]}..."


def _item_matches_filters(
    item: dict,
    *,
    item_id: str,
    page: int | None,
    contains: str,
) -> bool:
    if item_id and str(item.get("item_id", "") or "") != item_id:
        return False
    if page is not None and int(item.get("page_idx", -1)) != page - 1:
        return False
    if contains:
        haystack = "\n".join(
            str(item.get(key, "") or "")
            for key in (
                "source_text",
                "protected_source_text",
                "translation_unit_protected_source_text",
                "translated_text",
                "protected_translated_text",
            )
        )
        if contains.lower() not in haystack.lower():
            return False
    return True


def _route_prediction(item: dict) -> dict[str, object]:
    should_skip, reason = _is_fast_path_keep_origin_item(item)
    context = build_translation_control_context()
    batchable = _is_low_risk_batchable_item(
        item,
        translation_context=context,
        plan_item_view_fn=_plan_item_view,
    )
    if should_skip:
        route = "fast_path_keep_origin"
    elif batchable:
        route = "batched_plain_candidate"
    elif item.get("_heavy_formula_split_applied"):
        route = "single_slow"
    else:
        route = "single_fast"
    return {
        "route": route,
        "fast_path_keep_origin": should_skip,
        "fast_path_reason": reason,
        "low_risk_batchable": batchable,
    }


def _inspect_item(job_root: Path, item: dict) -> dict[str, object]:
    memory_store = _memory_store(job_root)
    memory_guidance = memory_store.summary_for_batch([item]) if memory_store is not None else ""
    context = context_with_memory_guidance(
        None,
        memory_store=memory_store,
        batch=[item],
        mode="debug",
        request_label=f"debug:{item.get('item_id', '')}",
    )
    diagnostics = item.get("translation_diagnostics")
    if not isinstance(diagnostics, dict):
        diagnostics = {}
    return {
        "item_id": item.get("item_id", ""),
        "page": int(item.get("page_idx", -1)) + 1,
        "block_idx": item.get("block_idx"),
        "bbox": item.get("bbox", []),
        "block_type": item.get("block_type", ""),
        "raw_block_type": item.get("raw_block_type", ""),
        "block_kind": item.get("block_kind", ""),
        "layout_role": item.get("layout_role", ""),
        "semantic_role": item.get("semantic_role", ""),
        "structure_role": item.get("structure_role", ""),
        "layout_zone": item.get("layout_zone", ""),
        "math_mode": item.get("math_mode", ""),
        "continuation_group": item.get("continuation_group", ""),
        "translation_unit_kind": item.get("translation_unit_kind", ""),
        "classification_label": item.get("classification_label", ""),
        "should_translate": item.get("should_translate"),
        "skip_reason": item.get("skip_reason", ""),
        "final_status": item.get("final_status", ""),
        "decision": item.get("decision", ""),
        "source_preview": _compact_text(
            item.get("translation_unit_protected_source_text")
            or item.get("protected_source_text")
            or item.get("source_text")
            or ""
        ),
        "translated_preview": _compact_text(
            item.get("protected_translated_text")
            or item.get("translated_text")
            or ""
        ),
        "route_prediction": _route_prediction(item),
        "diagnostics_route_path": diagnostics.get("route_path", []),
        "diagnostics_degradation_reason": diagnostics.get("degradation_reason", ""),
        "diagnostics_final_status": diagnostics.get("final_status", ""),
        "memory_guidance": memory_guidance,
        "merged_guidance": context.merged_guidance,
    }


def inspect_items(
    job_root: Path,
    *,
    item_id: str = "",
    page: int | None = None,
    contains: str = "",
    limit: int = 20,
) -> int:
    records = _collect_page_records(job_root)
    matches = [
        item
        for item in records
        if _item_matches_filters(item, item_id=item_id, page=page, contains=contains)
    ]
    print(f"job_root: {job_root}")
    print(f"matched_items: {len(matches)}")
    for item in matches[: max(1, limit)]:
        print(json.dumps(_inspect_item(job_root, item), ensure_ascii=False, indent=2))
    if len(matches) > limit:
        print(f"... truncated {len(matches) - limit} more items")
    return 0


def inspect_job(job_root: Path) -> int:
    manifest_path = _manifest_path(job_root)
    if not manifest_path.exists():
        raise RuntimeError(f"translation manifest not found: {manifest_path}")
    manifest = _load_json(manifest_path)
    records = _collect_page_records(job_root)
    kept_origin = [item for item in records if str(item.get("final_status", "") or "") == "kept_origin"]
    direct_typst = [
        item
        for item in records
        if str(item.get("math_mode", "") or "") == "direct_typst"
    ]
    direct_typst_kept = [
        item
        for item in kept_origin
        if str(item.get("math_mode", "") or "") == "direct_typst"
    ]
    continuation_kept = [
        item
        for item in kept_origin
        if str(item.get("continuation_group", "") or "").strip()
    ]

    print(f"job_root: {job_root}")
    print(f"math_mode: {manifest.get('math_mode', '')}")
    print(f"status_summary: {json.dumps(manifest.get('status_summary', {}), ensure_ascii=False)}")
    print(f"route_summary: {json.dumps(manifest.get('route_summary', {}), ensure_ascii=False)}")
    print(f"items_total: {len(records)}")
    print(f"direct_typst_items: {len(direct_typst)}")
    print(f"kept_origin_items: {len(kept_origin)}")
    print(f"direct_typst_kept_origin_items: {len(direct_typst_kept)}")
    print(f"continuation_kept_origin_items: {len(continuation_kept)}")

    if kept_origin:
        print("")
        print("kept_origin preview:")
        for item in kept_origin[:20]:
            source = " ".join(str(item.get("source_text", "") or "").split())
            print(
                json.dumps(
                    {
                        "item_id": item.get("item_id", ""),
                        "page_idx": item.get("page_idx"),
                        "math_mode": item.get("math_mode", ""),
                        "continuation_group": item.get("continuation_group", ""),
                        "skip_reason": item.get("skip_reason", ""),
                        "final_status": item.get("final_status", ""),
                        "source_preview": source[:180],
                    },
                    ensure_ascii=False,
                )
            )
    return 0


def _build_translate_spec(
    job_root: Path,
    *,
    mode: str,
    math_mode: str,
    workers: int,
    batch_size: int,
    skip_title_translation: bool,
) -> Path:
    source_pdf = _source_pdf_path(job_root)
    source_json = _source_json_path(job_root)
    spec_dir = (job_root / "artifacts" / "devtools").resolve()
    spec_dir.mkdir(parents=True, exist_ok=True)
    spec_path = spec_dir / "translate.stage.devtools.json"
    payload = {
        "schema_version": TRANSLATE_STAGE_SCHEMA_VERSION,
        "stage": "translate",
        "job": {
            "job_id": job_root.name,
            "job_root": str(job_root),
            "workflow": "translate_only",
        },
        "inputs": {
            "source_json": str(source_json),
            "source_pdf": str(source_pdf),
            "layout_json": str(source_json),
        },
        "params": {
            "start_page": 0,
            "end_page": -1,
            "batch_size": batch_size,
            "workers": workers,
            "mode": mode,
            "math_mode": math_mode,
            "skip_title_translation": skip_title_translation,
            "classify_batch_size": 12,
            "rule_profile_name": "general_sci",
            "custom_rules_text": "",
            "glossary_id": "",
            "glossary_name": "",
            "glossary_resource_entry_count": 0,
            "glossary_inline_entry_count": 0,
            "glossary_overridden_entry_count": 0,
            "glossary_entries": [],
            "model": "deepseek-v4-flash",
            "base_url": "https://api.deepseek.com/v1",
            "credential_ref": "env:DEEPSEEK_API_KEY",
        },
    }
    spec_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return spec_path


def _build_render_spec(job_root: Path, *, translated_pdf_name: str, render_mode: str) -> Path:
    source_pdf = _source_pdf_path(job_root)
    translations_dir = (job_root / "translated").resolve()
    translation_manifest = _manifest_path(job_root)
    spec_dir = (job_root / "artifacts" / "devtools").resolve()
    spec_dir.mkdir(parents=True, exist_ok=True)
    spec_path = spec_dir / "render.stage.devtools.json"
    payload = {
        "schema_version": RENDER_STAGE_SCHEMA_VERSION,
        "stage": "render",
        "job": {
            "job_id": job_root.name,
            "job_root": str(job_root),
            "workflow": "render_only",
        },
        "inputs": {
            "source_pdf": str(source_pdf),
            "translations_dir": str(translations_dir),
            "translation_manifest": str(translation_manifest),
        },
        "params": {
            "start_page": 0,
            "end_page": -1,
            "render_mode": render_mode,
            "compile_workers": 0,
            "typst_font_family": "",
            "pdf_compress_dpi": 0,
            "translated_pdf_name": translated_pdf_name,
            "body_font_size_factor": 1.0,
            "body_leading_factor": 1.0,
            "inner_bbox_shrink_x": 0.0,
            "inner_bbox_shrink_y": 0.0,
            "inner_bbox_dense_shrink_x": 0.0,
            "inner_bbox_dense_shrink_y": 0.0,
            "model": "",
            "base_url": "",
            "credential_ref": "",
        },
    }
    spec_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return spec_path


def retranslate_job(
    job_root: Path,
    *,
    mode: str,
    math_mode: str,
    workers: int,
    batch_size: int,
    skip_title_translation: bool,
) -> int:
    spec_path = _build_translate_spec(
        job_root,
        mode=mode,
        math_mode=math_mode,
        workers=workers,
        batch_size=batch_size,
        skip_title_translation=skip_title_translation,
    )
    command = [
        sys.executable,
        "-m",
        "retainpdf_pipeline.entrypoints.run_translate_only",
        "--spec",
        str(spec_path),
    ]
    print("running:", " ".join(command))
    return subprocess.run(command, cwd=str(PIPELINE_ROOT), check=False).returncode


def rerender_job(job_root: Path, *, translated_pdf_name: str, render_mode: str) -> int:
    spec_path = _build_render_spec(job_root, translated_pdf_name=translated_pdf_name, render_mode=render_mode)
    command = [
        sys.executable,
        "-m",
        "retainpdf_pipeline.entrypoints.run_render_only",
        "--spec",
        str(spec_path),
    ]
    print("running:", " ".join(command))
    return subprocess.run(command, cwd=str(PIPELINE_ROOT), check=False).returncode


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Inspect or rerun a strict-contract translation job that is backed by translation-manifest.json."
    )
    parser.add_argument("job", help="Job id or absolute job root path.")
    parser.add_argument(
        "--action",
        choices=("inspect", "retranslate", "rerender", "full"),
        default="inspect",
        help="Inspect, retranslate, rerender, or run retranslate+rerender.",
    )
    parser.add_argument(
        "--translated-pdf-name",
        default="debug-rerender-translated.pdf",
        help="Output PDF name for rerender mode.",
    )
    parser.add_argument(
        "--render-mode",
        default="auto",
        help="Render mode passed to render_only pipeline. Render-only now resolves inputs through translation-manifest.json only.",
    )
    parser.add_argument("--mode", default="sci", help="Translation mode for retranslate/full.")
    parser.add_argument("--math-mode", default="direct_typst", help="Math mode for retranslate/full.")
    parser.add_argument("--workers", type=int, default=100, help="Workers for retranslate/full.")
    parser.add_argument("--batch-size", type=int, default=8, help="Batch size for retranslate/full.")
    parser.add_argument(
        "--skip-title-translation",
        action="store_true",
        help="Pass skip_title_translation during retranslate/full.",
    )
    parser.add_argument("--item-id", default="", help="Inspect a specific translated item id.")
    parser.add_argument("--page", type=int, default=0, help="Inspect items on a 1-based page number.")
    parser.add_argument("--contains", default="", help="Inspect items whose source/translated text contains this substring.")
    parser.add_argument("--limit", type=int, default=20, help="Maximum matching items to print.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    job_root = _job_root_from_arg(args.job)
    if not job_root.exists():
        raise RuntimeError(f"job root not found: {job_root}")
    if args.item_id or args.page or args.contains:
        return inspect_items(
            job_root,
            item_id=args.item_id,
            page=args.page if args.page > 0 else None,
            contains=args.contains,
            limit=max(1, args.limit),
        )
    if args.action == "inspect":
        return inspect_job(job_root)
    if args.action == "retranslate":
        return retranslate_job(
            job_root,
            mode=args.mode,
            math_mode=args.math_mode,
            workers=args.workers,
            batch_size=args.batch_size,
            skip_title_translation=args.skip_title_translation,
        )
    if args.action == "rerender":
        return rerender_job(
            job_root,
            translated_pdf_name=args.translated_pdf_name,
            render_mode=args.render_mode,
        )
    translate_rc = retranslate_job(
        job_root,
        mode=args.mode,
        math_mode=args.math_mode,
        workers=args.workers,
        batch_size=args.batch_size,
        skip_title_translation=args.skip_title_translation,
    )
    if translate_rc != 0:
        return translate_rc
    return rerender_job(
        job_root,
        translated_pdf_name=args.translated_pdf_name,
        render_mode=args.render_mode,
    )


if __name__ == "__main__":
    raise SystemExit(main())
