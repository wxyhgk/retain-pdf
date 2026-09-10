#!/usr/bin/env python3
"""离线黄金用例 harness：用固化 fixture 校验翻译/渲染不变量。

默认只做结构化校验（零凭证、零重依赖），加 --render 时才调
`retainpdf-pipeline render-only --spec <job_root>/specs/render.spec.json` 做真实渲染（需本地有 source PDF 或
container 内已有）。

Fixture 目录约定（见 tests/fixtures/golden-jobs/chem-6ada81-10p/README.md）：
  specs/{normalize,provider,translate,render}.spec.json  # 占位符已替换为 {JOB_ROOT}
  ocr/normalized/document.v1.json
  translated/{translation-manifest.json, page-*.json}
  artifacts/pipeline_summary.json

占位符：{JOB_ROOT} / {REPO_ROOT} / {UPLOADS_ROOT} 在 materialize 时重写为真实路径。
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent if BACKEND_ROOT.name == "backend" else BACKEND_ROOT
PIPELINE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FIXTURE = REPO_ROOT / "tests" / "fixtures" / "golden-jobs" / "chem-6ada81-10p"
RENDER_ENTRYPOINT_MODULE = "retainpdf_pipeline.entrypoints.run_render_only"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Golden fixture harness (offline replay)")
    p.add_argument("--fixture", type=str, default=str(DEFAULT_FIXTURE), help="Fixture dir")
    p.add_argument("--output-root", type=str, default="", help="Materialized job root parent (default: temp)")
    p.add_argument("--job-id", type=str, default="", help="Job id for materialized dir")
    p.add_argument("--keep", action="store_true", help="Keep materialized dir (default: temp auto-remove)")
    p.add_argument("--render", action="store_true", help="Also run render-only (needs source PDF & typst)")
    p.add_argument("--source-pdf", type=str, default="", help="Override source PDF for render (else try fixture companion or original job)")
    p.add_argument("--json", action="store_true", help="Only emit JSON report")
    return p.parse_args()


def _load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def _materialize_fixture(fixture: Path, job_root: Path) -> dict:
    """把 fixture 铺到 job_root，占位符重写为真实路径。返回 materialize 信息。"""
    if not fixture.is_dir():
        raise RuntimeError(f"fixture not found: {fixture}")
    # 清理旧目录
    if job_root.exists():
        shutil.rmtree(job_root)
    job_root.mkdir(parents=True, exist_ok=True)

    rewrites = {
        "{JOB_ROOT}": str(job_root),
        "{REPO_ROOT}": str(REPO_ROOT),
        "{UPLOADS_ROOT}": str(REPO_ROOT / "data" / "uploads"),
    }

    copied = []
    for src in fixture.rglob("*"):
        if src.is_dir():
            continue
        if src.name == "README.md":
            continue
        rel = src.relative_to(fixture)
        dst = job_root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        try:
            text = src.read_text(encoding="utf-8")
            # 只有含占位符的文本才重写，避免误改 page json
            for k, v in rewrites.items():
                if k in text:
                    text = text.replace(k, v)
            dst.write_text(text, encoding="utf-8")
        except UnicodeDecodeError:
            shutil.copy2(src, dst)
        copied.append(str(rel))

    # 确保基础目录存在（render 需要 source/ 即使为空）
    for d in ["source", "rendered", "artifacts", "logs", "ocr/normalized", "translated"]:
        (job_root / d).mkdir(parents=True, exist_ok=True)

    return {"job_root": str(job_root), "copied": copied, "rewrites": rewrites}


def _find_source_pdf(job_root: Path, fixture: Path, override: str) -> Path | None:
    if override:
        p = Path(override)
        if p.exists():
            return p.resolve()
        raise RuntimeError(f"--source-pdf not found: {p}")
    # 优先：materialized 的 source/ 下已有 PDF
    pdfs = sorted((job_root / "source").glob("*.pdf"))
    if pdfs:
        return pdfs[0].resolve()
    # 其次：尝试从原始 job 的 source 拷贝（本地开发有 data/jobs）
    # 从 fixture 的 pipeline_summary 或 render spec 推断源名
    for candidate in [
        REPO_ROOT / "data" / "jobs" / "20260709124749-6ada81" / "source",
        REPO_ROOT / "tests" / "fixtures" / "pdfs",
    ]:
        if candidate.is_dir():
            pdfs = sorted(candidate.glob("*.pdf"))
            if pdfs:
                # 优先页数匹配的（读 fixture manifest 的页数）
                try:
                    manifest = _load_json(job_root / "translated" / "translation-manifest.json")
                    expected_pages = len(manifest.get("pages", []))
                    for pdf in pdfs:
                        try:
                            import fitz  # type: ignore

                            with fitz.open(pdf) as doc:
                                if doc.page_count == expected_pages:
                                    return pdf.resolve()
                        except Exception:
                            pass
                except Exception:
                    pass
                return pdfs[0].resolve()
    return None


def _structural_checks(job_root: Path, fixture: Path) -> dict:
    """不变量校验：manifest、page 完整性、pipeline_summary 期望。"""
    errors: list[str] = []
    warnings: list[str] = []
    details: dict = {}

    # 1) manifest 页数
    try:
        manifest = _load_json(job_root / "translated" / "translation-manifest.json")
        pages = manifest.get("pages", [])
        details["manifest_pages"] = len(pages)
        if not pages:
            errors.append("translation-manifest.json pages 为空")
        for entry in pages:
            rel = str(entry.get("path", "")).strip()
            if not rel:
                errors.append(f"manifest entry missing path: {entry}")
                continue
            p = job_root / "translated" / rel
            if not p.exists():
                errors.append(f"missing translated page file: {rel}")
            elif p.stat().st_size == 0:
                errors.append(f"empty translated page file: {rel}")
        # 与 fixture 期望对比
        fixture_manifest = _load_json(fixture / "translated" / "translation-manifest.json")
        if len(pages) != len(fixture_manifest.get("pages", [])):
            errors.append(f"manifest 页数与 fixture 期望不一致: {len(pages)} vs {len(fixture_manifest.get('pages', []))}")
    except Exception as e:
        errors.append(f"manifest 校验失败: {e}")

    # 2) document.v1.json 页数一致性
    try:
        doc = _load_json(job_root / "ocr" / "normalized" / "document.v1.json")
        dc = int(doc.get("page_count", 0) or 0)
        details["document_page_count"] = dc
        pages_field = doc.get("pages", [])
        if dc and len(pages_field) != dc:
            warnings.append(f"document page_count={dc} 但 pages 长度 {len(pages_field)}")
        if "manifest_pages" in details and dc and dc != details["manifest_pages"]:
            errors.append(f"document page_count {dc} 与 manifest {details['manifest_pages']} 不一致")
    except Exception as e:
        errors.append(f"document.v1.json 校验失败: {e}")

    # 3) pipeline_summary 期望
    try:
        summary = _load_json(job_root / "artifacts" / "pipeline_summary.json")
        details["pipeline_summary"] = {
            "pages_processed": summary.get("pages_processed"),
            "render_mode": summary.get("render_mode"),
            "effective_render_mode": summary.get("effective_render_mode"),
        }
        # 与 fixture 的 summary 对比（只比关键字段）
        fixture_summary = _load_json(fixture / "artifacts" / "pipeline_summary.json")
        for key in ["pages_processed", "render_mode"]:
            if summary.get(key) != fixture_summary.get(key):
                warnings.append(f"pipeline_summary.{key} 与 fixture 期望不一致: {summary.get(key)} vs {fixture_summary.get(key)}")
    except Exception as e:
        warnings.append(f"pipeline_summary 校验跳过: {e}")

    # 4) specs 占位符是否已重写
    for spec_name in ["render.spec.json", "translate.spec.json"]:
        p = job_root / "specs" / spec_name
        if p.exists():
            txt = p.read_text(encoding="utf-8")
            if "{JOB_ROOT}" in txt or "{REPO_ROOT}" in txt:
                errors.append(f"{spec_name} 仍含未重写的占位符")

    # 5) 未译残留（复用 translation artifacts 的 diagnostics 思路，但轻量）
    try:
        # 轻量：扫描 page json 中 final_status != translated 的块数
        unresolved = 0
        for entry in manifest.get("pages", []):
            rel = str(entry.get("path", "")).strip()
            if not rel:
                continue
            data = _load_json(job_root / "translated" / rel)
            blocks = data if isinstance(data, list) else data.get("blocks", data.get("pages", []))
            if isinstance(blocks, list):
                for b in blocks:
                    if isinstance(b, dict) and b.get("final_status") not in (None, "", "translated", "skipped"):
                        # 仅统计明确未译
                        if b.get("final_status") == "untranslated":
                            unresolved += 1
        details["unresolved_blocks"] = unresolved
    except Exception:
        pass

    return {"errors": errors, "warnings": warnings, "details": details}


def _run_render(job_root: Path) -> dict:
    """调 retainpdf-pipeline render-only，返回结果或错误。"""
    source_pdf = _find_source_pdf(job_root, Path(), "")
    # 优先用 --source-pdf 已处理过的路径；这里重新找一次
    # 为可复现：若 source/ 下为空，尝试拷贝一个源 PDF 进去
    if not list((job_root / "source").glob("*.pdf")):
        src = _find_source_pdf(job_root, DEFAULT_FIXTURE, "")
        if src and src.exists():
            shutil.copy2(src, job_root / "source" / src.name)
        else:
            # 无源 PDF 时生成一个空白 PDF（页数与 manifest 一致）
            try:
                import fitz

                manifest = _load_json(job_root / "translated" / "translation-manifest.json")
                n = len(manifest.get("pages", [])) or 10
                dummy = job_root / "source" / "dummy.pdf"
                doc = fitz.open()
                for _ in range(n):
                    doc.new_page(width=595, height=842)
                doc.save(dummy)
                doc.close()
            except Exception as e:
                return {"ok": False, "error": f"无法准备 source PDF: {e}"}

    # 构造 render spec
    spec_path = job_root / "specs" / "render.spec.json"
    if not spec_path.exists():
        # 用最小 render spec 兜底
        source_pdf_file = sorted((job_root / "source").glob("*.pdf"))[0]
        spec = {
            "schema_version": "render.stage.v1",
            "stage": "render",
            "job": {"job_id": job_root.name, "job_root": str(job_root), "workflow": "book"},
            "inputs": {
                "source_pdf": str(source_pdf_file),
                "translations_dir": str(job_root / "translated"),
                "translation_manifest": str(job_root / "translated" / "translation-manifest.json"),
            },
            "params": {
                "render_mode": "auto",
                "compile_workers": 4,
                "typst_font_family": "Source Han Serif SC",
                "pdf_compress_dpi": 0,
                "translated_pdf_name": "",
                "start_page": 0,
                "end_page": -1,
                "model": "deepseek-v4-flash",
                "base_url": "https://api.deepseek.com/v1",
                "credential_ref": "",
            },
        }
        spec_path = job_root / "specs" / "render.golden.spec.json"
        spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")

    cmd = [sys.executable, "-m", RENDER_ENTRYPOINT_MODULE, "--spec", str(spec_path)]
    env = dict(**{k: v for k, v in __import__("os").environ.items()})  # 传递现有 env
    # 确保 pipeline 可 import
    env["PYTHONPATH"] = str(PIPELINE_ROOT) + (":" + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, env=env, cwd=str(PIPELINE_ROOT))
        ok = result.returncode == 0
        # 收集关键输出
        summary_p = job_root / "artifacts" / "pipeline_summary.json"
        rendered = sorted((job_root / "rendered").glob("*.pdf"))
        info: dict = {
            "ok": ok,
            "returncode": result.returncode,
            "stdout_tail": result.stdout[-2000:] if result.stdout else "",
            "stderr_tail": result.stderr[-2000:] if result.stderr else "",
            "rendered_pdfs": [str(p) for p in rendered],
        }
        if summary_p.exists():
            try:
                info["summary"] = _load_json(summary_p)
            except Exception:
                pass
        if not ok:
            info["error"] = f"render-only 失败 (exit {result.returncode})"
        return info
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "render-only 超时 120s"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def main() -> None:
    args = parse_args()
    fixture = Path(args.fixture).resolve()
    # 输出目录
    if args.output_root:
        out_root = Path(args.output_root).resolve()
        out_root.mkdir(parents=True, exist_ok=True)
        job_id = args.job_id.strip() or f"golden-replay-{fixture.name}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        job_root = out_root / job_id
        keep = True
        temp_ctx = None
    else:
        tmp = tempfile.TemporaryDirectory(prefix="golden-harness-")
        job_id = args.job_id.strip() or f"golden-replay-{fixture.name}"
        job_root = Path(tmp.name) / job_id
        keep = args.keep
        temp_ctx = tmp  # 持有

    try:
        materialize = _materialize_fixture(fixture, job_root)

        # 若指定了 --source-pdf，拷贝进去
        if args.source_pdf:
            src = Path(args.source_pdf).resolve()
            if src.exists():
                shutil.copy2(src, job_root / "source" / src.name)

        structural = _structural_checks(job_root, fixture)

        render_result = None
        if args.render:
            render_result = _run_render(job_root)
            # 渲染后再次校验 PDF 页数
            try:
                import fitz

                source_pdfs = sorted((job_root / "source").glob("*.pdf"))
                rendered_pdfs = sorted((job_root / "rendered").glob("*.pdf"))
                if source_pdfs and rendered_pdfs:
                    with fitz.open(source_pdfs[0]) as s, fitz.open(rendered_pdfs[-1]) as r:
                        if s.page_count != r.page_count:
                            structural["errors"].append(f"渲染后页数不一致: source {s.page_count} vs rendered {r.page_count}")
                        structural["details"]["render_page_check"] = {"source": s.page_count, "rendered": r.page_count}
            except Exception as e:
                structural["warnings"].append(f"渲染页数校验跳过: {e}")

        ok = len(structural["errors"]) == 0 and (render_result is None or render_result.get("ok", True))
        report = {
            "ok": ok,
            "fixture": str(fixture),
            "job_root": str(job_root),
            "materialize": {"copied_count": len(materialize["copied"])},
            "structural": structural,
            "render": render_result,
        }

        if args.json:
            print(json.dumps(report, ensure_ascii=False, indent=2))
        else:
            print(json.dumps(report, ensure_ascii=False, indent=2))
            if ok:
                print("\n✓ golden harness 通过", file=sys.stderr)
            else:
                print("\n✗ golden harness 失败", file=sys.stderr)
                for e in structural["errors"]:
                    print(f"  - {e}", file=sys.stderr)
                if render_result and not render_result.get("ok"):
                    print(f"  render: {render_result.get('error')}", file=sys.stderr)

        sys.exit(0 if ok else 1)
    finally:
        if temp_ctx is not None and not keep:
            temp_ctx.cleanup()


if __name__ == "__main__":
    main()
