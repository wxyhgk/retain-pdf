"""对已有任务目录离线重算确定性 QA 报告（translation_qa.v1.json）。

零 LLM 调用，只读 translated/ 下的页 payload、specs/translate.spec.json 里的用户术语表、
artifacts/translation_review.json，以及（如果有）译前术语表和排版 fit 报告。

用法：
    python devtools/run_translation_qa.py --job-root data/jobs/<job_id> [--output path] [--summary-only]

默认写到 <job_root>/artifacts/translation_qa.v1.json；验证样本时请对任务目录的拷贝运行，
或用 --output 指到别处，不要改动原任务目录。
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from retainpdf_pipeline.translate.services.quality.qa import build_translation_qa_for_job
from retainpdf_pipeline.translate.services.quality.qa import default_translation_qa_path
from retainpdf_pipeline.translate.services.quality.qa import write_translation_qa


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Recompute the deterministic translation QA report for a job.")
    parser.add_argument("--job-root", type=Path, required=True, help="任务目录（含 translated/、artifacts/）")
    parser.add_argument("--translations-dir", type=Path, default=None, help="默认 <job-root>/translated")
    parser.add_argument("--output", type=Path, default=None, help="默认 <job-root>/artifacts/translation_qa.v1.json")
    parser.add_argument("--summary-only", action="store_true", help="只打印汇总，不写文件")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    job_root = args.job_root.resolve()
    payload = build_translation_qa_for_job(job_root, translations_dir=args.translations_dir)
    print(json.dumps({"checks": payload["checks"], "summary": payload["summary"]}, ensure_ascii=False, indent=2))
    if args.summary_only:
        return 0
    output = (args.output or default_translation_qa_path(job_root)).resolve()
    write_translation_qa(output, payload)
    print(f"translation qa written: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
