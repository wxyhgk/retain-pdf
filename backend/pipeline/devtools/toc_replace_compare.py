#!/usr/bin/env python3
"""目录原位替换的对比图和检查表（R1，2026-11-28）：同一份译文分别用 reflow / replace 渲染，出三栏图（原文 | reflow | replace）
和 R1–R9 检查表。只在本地、任务的副本上跑，不调模型、不调 OCR、不碰 data/。

    python devtools/toc_replace_compare.py <任务副本目录>... --out <输出目录>

任务副本目录要有 ``source/*.pdf``、``ocr/normalized/document.v1.json``（已经按 R0 拆好条目）、``translated/``（译文和清单）。
每本复制成 ``<out>/<书>-reflow``、``<out>/<书>-replace`` 两份各跑一次 render-only（rpr_fit 引擎；引擎目录用
``RETAIN_RPR_ENGINE_DIR``），图在 ``<out>/png/<书>-p<页>.png``，表在 ``<out>/checks.md``、``checks.json``。
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
MODES = ("reflow", "replace")
COLUMNS = ("书", "页", "条目", "原字号放下", "缩字号(最小)", "放不下", "没换(同原文/没译文/其他)", "多行", "放到页码行", "空出的行",
           "R1 标题剩字/墨迹", "R2 别的字丢/盖到", "R3 压字", "R7 字不符", "R8 标记", "空当(字,原→译)", "扫描页", "退回重排",
           "阅读页版面对上(字)")


def _spec(job_root: Path, toc_mode: str) -> dict:
    source_pdf = next((job_root / "source").glob("*.pdf"))
    return {
        "schema_version": "render.stage.v1",
        "stage": "render",
        "job": {"job_id": f"toc-compare-{job_root.name}", "job_root": str(job_root), "workflow": "render"},
        "inputs": {
            "source_pdf": str(source_pdf),
            "source_json": str(job_root / "ocr/normalized/document.v1.json"),
            "translations_dir": str(job_root / "translated"),
            "translation_manifest": str(job_root / "translated/translation-manifest.json"),
        },
        "params": {
            "start_page": 0, "end_page": -1, "render_mode": "auto", "compile_workers": 4, "typst_font_family": "Source Han Serif SC",
            "pdf_compress_dpi": 0, "translated_pdf_name": "", "body_font_size_factor": 0.95, "body_leading_factor": 1.08,
            "font_unify_mode": "role_min", "source_cleanup_strategy": "pikepdf_text_strip", "model": "", "base_url": "",
            "credential_ref": "", "engine": "rpr_fit", "toc_mode": toc_mode,
        },
    }


def _render(job: Path, out: Path, toc_mode: str) -> Path:
    root = out / f"{job.name}-{toc_mode}"
    if root.exists():
        shutil.rmtree(root)
    for name in ("source", "ocr", "translated"):
        shutil.copytree(job / name, root / name)
    for name in ("specs", "rendered", "artifacts", "logs"):
        (root / name).mkdir(parents=True, exist_ok=True)
    spec_path = root / "specs/render.spec.json"
    spec_path.write_text(json.dumps(_spec(root, toc_mode), ensure_ascii=False, indent=1), encoding="utf-8")
    env = {**os.environ, "RETAINPDF_RENDER_NO_CACHE": "1"}
    env["PYTHONPATH"] = os.pathsep.join([str(PIPELINE_ROOT), *[p for p in env.get("PYTHONPATH", "").split(os.pathsep) if p]])
    result = subprocess.run(
        [sys.executable, "-m", "retainpdf_pipeline.entrypoints.console", "render-only", "--spec", str(spec_path)],
        capture_output=True, text=True, env=env, cwd=str(root),
    )
    (root / "render.log").write_text(result.stdout + "\n" + result.stderr, encoding="utf-8")
    if result.returncode != 0:
        raise RuntimeError(f"{root.name}: render-only failed ({result.returncode}), see {root / 'render.log'}")
    return root


def _summary(root: Path) -> dict:
    path = root / "artifacts/pipeline_summary.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def _triptych(source_pdf: Path, reflow_pdf: Path, replace_pdf: Path, out_dir: Path, name: str, dpi: int = 110) -> list[Path]:
    import fitz

    written = []
    with fitz.open(source_pdf) as source, fitz.open(reflow_pdf) as reflow, fitz.open(replace_pdf) as replace:
        for index in range(len(source)):
            rect = source[index].rect
            sheet = fitz.open()
            page = sheet.new_page(width=rect.width * 3 + 20, height=rect.height)
            for column, doc in enumerate((source, reflow, replace)):
                if index < len(doc):
                    page.show_pdf_page(fitz.Rect(column * (rect.width + 10), 0, column * (rect.width + 10) + rect.width, rect.height), doc, index)
            target = out_dir / f"{name}-p{index}.png"
            page.get_pixmap(dpi=dpi).save(target)
            sheet.close()
            written.append(target)
    return written


def _html_match(root: Path, pdf_path: Path, toc: dict) -> str:
    """阅读页版面里目录那几块的每个字，在译文 PDF 同一页同一个位置（±0.6pt）找得到同一个字的有几个。"""
    import gzip

    import fitz

    layout_dir = root / "rendered/reader-layout"
    manifest_path = layout_dir / "manifest.json"
    if not manifest_path.is_file():
        return "无版面"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    pages_with_toc = {int(index) for index in toc.get("pages") or []}
    total = matched = 0
    with fitz.open(pdf_path) as pdf:
        for entry in manifest.get("pages") or []:
            index = int(entry["index"])
            if index not in pages_with_toc or index >= len(pdf):
                continue
            page = json.loads(gzip.decompress((layout_dir / entry["file"]).read_bytes()).decode("utf-8"))
            chars = [
                (_same(c["c"]), c["origin"][0], c["origin"][1])
                for block in pdf[index].get_text("rawdict").get("blocks", [])
                for line in block.get("lines", [])
                for span in line.get("spans", [])
                for c in span.get("chars", [])
            ]
            for block in page.get("blocks") or []:
                if not any(item.get("font") for line in block.get("lines") or [] for item in line.get("items") or []):
                    continue
                if block.get("weight") != "regular" or block.get("id") not in _toc_ids(toc, index):
                    continue
                for line in block.get("lines") or []:
                    for item in line.get("items") or []:
                        if str(item.get("t") or "").isspace():
                            continue
                        total += 1
                        matched += any(c == _same(item["t"]) and abs(x - item["x"]) < 0.6 and abs(y - line["baseline"]) < 0.6 for c, x, y in chars)
    return f"{matched}/{total}"


def _same(text: str) -> str:
    """PDF 里读回来的字和写进去的字比：同一个字形可能读成康熙部首、不换行连字符这类等价字（字体子集的 ToUnicode）。"""
    import unicodedata

    return unicodedata.normalize("NFKC", text).replace("\u2010", "-").replace("\u2011", "-")


def _toc_ids(toc: dict, index: int) -> set[str]:
    return set((toc.get("placed_ids") or {}).get(str(index)) or [])


def _row(name: str, toc: dict) -> list[str]:
    totals = toc.get("totals") or {}
    statuses = toc.get("entries") or {}
    kept_other = sum(v for k, v in statuses.items() if k.startswith("kept_") and k not in ("kept_does_not_fit", "kept_same_as_source", "kept_no_translation"))
    checks = [page for page in (toc.get("checks") or {}).values() if "skipped" not in page]
    gaps_src = [page["R9_gap_src_em"] for page in checks if page.get("R9_gap_src_em") is not None]
    gaps_new = [page["R9_gap_new_em"] for page in checks if page.get("R9_gap_new_em") is not None]
    gap = f"{sorted(gaps_src)[len(gaps_src) // 2]} → {sorted(gaps_new)[len(gaps_new) // 2]}" if gaps_src and gaps_new else "—"
    return [
        name, str(len(toc.get("pages") or [])), str(sum(statuses.values())), str(totals.get("R4_placed", 0)),
        f"{totals.get('R4_shrunk', 0)} ({totals.get('R4_min_scale')})" if totals.get("R4_shrunk") else "0",
        str(totals.get("R4_kept_does_not_fit", 0)),
        f"{statuses.get('kept_same_as_source', 0)}/{statuses.get('kept_no_translation', 0)}/{kept_other}",
        str(totals.get("R5_multiline", 0)), f"{totals.get('R6_on_page_line', 0)}/{totals.get('R6_page_line_eligible', 0)}",
        str(totals.get("R5_empty_lines", 0)),
        f"{totals.get('R1_title_chars_left', 0)}/{totals.get('R1_residual_ink_lines', 0) + totals.get('R1_ring_ink_strips', 0)}",
        f"{totals.get('R2_other_chars_lost', 0)}/{totals.get('R2_cover_hits', 0)}", str(totals.get("R3_overlap_chars", 0)),
        str(totals.get("R7_text_mismatch", 0)), str(totals.get("R8_markup", 0)), gap,
        str(len(toc.get("scan_pages") or [])), str(len(toc.get("reflow_pages") or {})), toc.get("html_match", "—"),
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("jobs", nargs="+", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    out = args.out.resolve()
    (out / "png").mkdir(parents=True, exist_ok=True)
    rows, payload = [], {}
    for job in args.jobs:
        job = job.resolve()
        roots = {mode: _render(job, out, mode) for mode in MODES}
        pdfs = {mode: next((roots[mode] / "rendered").glob("*-translated.pdf")) for mode in MODES}
        source_pdf = next((job / "source").glob("*.pdf"))
        images = _triptych(source_pdf, pdfs["reflow"], pdfs["replace"], out / "png", job.name)
        diagnostics = _summary(roots["replace"]).get("render_diagnostics") or {}
        toc = diagnostics.get("toc_replace") or {}
        toc["html_match"] = _html_match(roots["replace"], pdfs["replace"], toc)
        payload[job.name] = {"toc_replace": toc, "render_engine": diagnostics.get("render_engine"), "png": [str(p) for p in images]}
        rows.append(_row(job.name, toc))
        print(job.name, rows[-1], flush=True)
    lines = ["| " + " | ".join(COLUMNS) + " |", "|" + "---|" * len(COLUMNS)] + ["| " + " | ".join(row) + " |" for row in rows]
    (out / "checks.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (out / "checks.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
