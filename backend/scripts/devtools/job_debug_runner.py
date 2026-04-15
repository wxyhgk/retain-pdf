from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT / "backend" / "scripts") not in sys.path:
    sys.path.append(str(REPO_ROOT / "backend" / "scripts"))

from foundation.shared.stage_specs import RENDER_STAGE_SCHEMA_VERSION
from foundation.shared.stage_specs import TRANSLATE_STAGE_SCHEMA_VERSION


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
            "model": "deepseek-chat",
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
        str((REPO_ROOT / "backend" / "scripts" / "services" / "translation" / "translate_only_pipeline.py").resolve()),
        "--spec",
        str(spec_path),
    ]
    print("running:", " ".join(command))
    return subprocess.run(command, cwd=str(REPO_ROOT), check=False).returncode


def rerender_job(job_root: Path, *, translated_pdf_name: str, render_mode: str) -> int:
    spec_path = _build_render_spec(job_root, translated_pdf_name=translated_pdf_name, render_mode=render_mode)
    command = [
        sys.executable,
        str((REPO_ROOT / "backend" / "scripts" / "services" / "rendering" / "render_only_pipeline.py").resolve()),
        "--spec",
        str(spec_path),
    ]
    print("running:", " ".join(command))
    return subprocess.run(command, cwd=str(REPO_ROOT), check=False).returncode


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Inspect or rerender an existing translation job.")
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
        help="Render mode passed to render_only pipeline.",
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
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    job_root = _job_root_from_arg(args.job)
    if not job_root.exists():
        raise RuntimeError(f"job root not found: {job_root}")
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
