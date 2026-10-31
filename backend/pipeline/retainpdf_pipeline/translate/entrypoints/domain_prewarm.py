"""OCR 期间先做识别领域（辅助进程，不是任务阶段）：``python -m retainpdf_pipeline.translate.entrypoints.domain_prewarm --spec …``。

识别领域只读源 PDF 前两页的文本层（``llm/domain_context.extract_pdf_preview_text``），不依赖 OCR；结果按（模型, 预览文本）
存进各任务共用的缓存。Rust 在提交 OCR 后拉起这个进程，翻译阶段到时命中"shared cache hit"，不再等这一个请求
（2026-10-30 Jensen 第 12 章：翻译前串行等了 6.6 秒）。

它只是缓存预热：不改任务状态、不写事件流；扫描件没有文本层、关了领域识别、出错，都只是什么也不做，翻译阶段照常自己问。
spec 只有源 PDF 和模型参数（翻译阶段的 spec 要等 OCR 结果出来才写得了）。
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from retainpdf_base.credentials import resolve_credential_ref
from retainpdf_translation.llm.domain_context import infer_domain_context
from retainpdf_translation.llm.shared.model_wire import register_stage_connections

SCHEMA_VERSION = "domain_prewarm.stage.v1"


def run(spec: dict) -> str:
    """按 spec 做一次识别领域，返回一句结果（打进日志）。"""
    if spec.get("schema_version") != SCHEMA_VERSION:
        return f"skipped: unknown schema {spec.get('schema_version')!r}"
    params = spec.get("params") or {}
    source_pdf = Path(str((spec.get("inputs") or {}).get("source_pdf") or ""))
    mode = str(params.get("mode") or "")
    if not source_pdf.is_file():
        return f"skipped: source pdf not found: {source_pdf}"
    # 和翻译阶段同一条规则（services/policy/config.should_infer_domain_context：只在 sci 下识别领域）；入口层不许引 services.policy
    if mode != "sci":
        return f"skipped: domain inference off for mode {mode!r}"
    api_key = resolve_credential_ref(str(params.get("credential_ref") or ""))
    if not api_key:
        return "skipped: no api key"
    model = str(params.get("model") or "")
    base_url = str(params.get("base_url") or "")
    register_stage_connections(
        model=model,
        base_url=base_url,
        api_protocol=params.get("api_protocol") or "",
        thinking=params.get("thinking") or "",
    )
    context = infer_domain_context(
        source_pdf_path=source_pdf,
        api_key=api_key,
        model=model,
        base_url=base_url,
        output_dir=None,
    )
    domain = str(context.get("domain") or "").strip()
    return f"done: domain={domain or 'unknown'}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Infer the document domain while OCR is running (cache prewarm).")
    parser.add_argument("--spec", required=True, help="Path to domain-prewarm.spec.json")
    args = parser.parse_args(argv)
    try:
        spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
        print(f"domain-prewarm: {run(spec)}", flush=True)
    except Exception as exc:  # 只是预热：失败不影响任务，翻译阶段照常自己问
        print(f"domain-prewarm: failed: {type(exc).__name__}: {exc}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
