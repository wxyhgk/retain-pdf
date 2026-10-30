"""翻译 agent 测试系统：造样例 → 按页交给翻译 agent 包（retainpdf-translation-agent）的调度 → 生成报告。

    cd backend/pipeline
    ../.venv/bin/python -m devtools.agent_lab --out /tmp/agent_lab                 # 3 页论文；读 ~/.config/retainpdf/test.env 里的密钥
    ../.venv/bin/python -m devtools.agent_lab --sample long --out /tmp/long_on     # 约 20 页的小书，带术语记忆，出指标
    ../.venv/bin/python -m devtools.agent_lab --sample long --no-memory --out /tmp/long_off   # 不带记忆，对比用
    open /tmp/agent_lab/report.html

同样的输入第二次跑走缓存（`<out>/cache/`），不再调接口；改了提示词或样例会自动重新请求。`--no-cache` 强制重跑。
调度的状态（进度、术语表各版本、台账）在 `<out>/state/`，每次从头跑会先清掉。
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import time
from pathlib import Path

from retainpdf_translation_agent import PROMPT_VERSION
from retainpdf_translation_agent import DocumentRun
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent import glossary_from_csv

from devtools.agent_lab import long_sample
from devtools.agent_lab import sample_conference
from devtools.agent_lab import sample_essay
from devtools.agent_lab import sample_manual
from devtools.agent_lab import sample_textbook
from devtools.agent_lab import metrics as long_metrics
from devtools.agent_lab.pages import build_pages
from devtools.agent_lab.real_doc import baseline_translations
from devtools.agent_lab.real_doc import truth_from_document
from devtools.agent_lab.pages import document_title
from devtools.agent_lab.report import build_report
from devtools.ocr_viewer.complex_sample import PRINTED_PAGE
from devtools.ocr_viewer.complex_sample import build as build_complex

def _with_labels(doc):
    return doc, doc.page_labels


# 样例登记表：名字 → 造文档的函数，返回 (SampleDocument, 页号 → 印的页码)。加新样例在这里登记一行。
SAMPLES = {
    "complex": lambda: (build_complex(), PRINTED_PAGE),
    "long": lambda: _with_labels(long_sample.build()),
    # Sonnet 造的 5 页以上样例（2026-10-30）
    "conference": lambda: _with_labels(sample_conference.build()),
    "textbook": lambda: _with_labels(sample_textbook.build()),
    "manual": lambda: _with_labels(sample_manual.build()),
    "essay": lambda: _with_labels(sample_essay.build()),
}

DEFAULT_ENV = Path.home() / ".config" / "retainpdf" / "test.env"


def load_env_file(path: Path) -> list[str]:
    """把 KEY=VALUE 读进环境变量（已有的不覆盖），只返回变量名，不打印值。"""
    if not path.is_file():
        return []
    names = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        os.environ.setdefault(name, value.strip())
        names.append(name)
    return names


def run(
    out_dir: Path,
    *,
    agent: TranslationAgent,
    pages_filter: set[str] | None = None,
    sample: str = "complex",
    memory: bool = True,
    read_first: bool = True,
    review: bool = False,
    document_path: Path | None = None,
    pdf: Path | None = None,
    baseline_dir: Path | None = None,
    glossary_csv: Path | None = None,
) -> dict:
    """`document_path` + `pdf`：跑真实文档（OCR 规范化后的 document.v1.json 和原 PDF），不用样例；
    `baseline_dir`：正式流程的 translated/ 目录，译文并排放进结果当基线。"""
    out_dir.mkdir(parents=True, exist_ok=True)
    if document_path is not None:
        truth, labels = truth_from_document(json.loads(Path(document_path).read_text(encoding="utf-8")))
        (out_dir / "truth.json").write_text(json.dumps(truth, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        pdf_path = Path(pdf)
        sample = "document"
    else:
        doc, labels = SAMPLES[sample]()
        pdf_path, truth_path = doc.save(out_dir)
        truth = json.loads(truth_path.read_text(encoding="utf-8"))
    baseline = baseline_translations(baseline_dir) if baseline_dir else {}
    requests = [p for p in build_pages(truth, page_labels=labels) if not pages_filter or p.page_label in pages_filter]
    document = {"title": document_title(truth), "source_lang": "en", "target_lang": "zh-CN"}
    started = time.monotonic()
    state_dir = out_dir / "state"
    shutil.rmtree(state_dir, ignore_errors=True)
    glossary = glossary_from_csv(Path(glossary_csv).read_text(encoding="utf-8")) if glossary_csv else None
    outcome = DocumentRun(agent, state_dir, glossary=glossary, memory=memory, read_first=read_first, review=review).run([page.to_input(document) for page in requests])
    blocks: dict[str, dict] = {}
    pages_out = []
    for key, page in enumerate(requests):
        page_file = state_dir / "pages" / f"{key:04d}.json"
        if not page_file.exists():
            break
        info = json.loads(page_file.read_text(encoding="utf-8"))["info"]
        pages_out.append({"page": page.page, "label": page.page_label, "chapter": page.chapter, "translate_blocks": len(page.to_translate()), **info})
        for block in page.blocks:
            entry = {
                "id": block.id,
                "class": block.cls,
                "page": block.page,
                "where": block.where,
                "source": block.source,
                "translate": block.translate,
                "translate_reason": block.translate_reason,
                "group": block.group,
                "baseline": baseline.get(block.id),
                "chapter": page.chapter,
            }
            result = outcome.results.get(block.id)
            if result:
                entry.update(
                    translation=result.translation,
                    issues=result.issues,
                    attempts=result.attempts,
                    status=result.status,
                    history=result.history,
                    meta=result.meta,
                )
            else:
                entry.update(status="skipped")
            blocks[block.id] = entry
    statuses = [b["status"] for b in blocks.values() if b["translate"]]
    glossary = outcome.glossary
    summary = {
        "sample": sample,
        "memory": memory,
        "read_first": read_first and memory,
        "review": review,
        "run_status": outcome.status,
        "stop_reason": outcome.stop_reason,
        "model": agent.model,
        "prompt_version": PROMPT_VERSION,
        "pages": len(pages_out),
        "blocks": len(blocks),
        "translated": len(statuses),
        "ok": statuses.count("ok"),
        "warn": statuses.count("warn"),
        "error": statuses.count("error"),
        "fallback": statuses.count("fallback_source"),
        "retried": sum(1 for b in blocks.values() if b.get("attempts", 1) > 1),
        "glossary_version": glossary.version,
        "glossary_terms": sum(1 for t in glossary.terms.values() if t.category != "abbr"),
        "glossary_approved": sum(1 for t in glossary.terms.values() if t.category != "abbr" and t.binding),
        "tickets": len(glossary.tickets),
        "requests": agent.usage.requests,
        "cached_requests": agent.usage.cached,
        "input_tokens": agent.usage.input_tokens,
        "output_tokens": agent.usage.output_tokens,
        "model_latency_ms": agent.usage.latency_ms,
        "wall_ms": int((time.monotonic() - started) * 1000),
    }
    results = {"summary": summary, "pages": pages_out, "calls": agent.calls, "blocks": blocks, "glossary": glossary.to_dict()}
    reading_file = state_dir / "reading.json"
    if reading_file.exists():
        reading = json.loads(reading_file.read_text(encoding="utf-8"))
        results["reading"] = reading
        summary["reading"] = {k: reading.get(k) for k in ("genre", "name_policy")} | {"terms": len(reading.get("terms") or []), "headings": len(reading.get("headings") or {})}
    if sample == "long":
        results["metrics"] = long_metrics.compute(list(blocks.values()))
        summary["metrics"] = {m["key"]: m["value"] for m in long_metrics.headline(results["metrics"])}
    (out_dir / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    build_report(pdf_path, truth, results, out_dir / "report.html")
    return results


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--env", type=Path, default=DEFAULT_ENV, help="KEY=VALUE file with ANTHROPIC_API_KEY (values are never printed)")
    parser.add_argument("--model", default=None)
    parser.add_argument("--pages", default="", help="comma-separated printed page labels, e.g. i,1")
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--sample", choices=sorted(SAMPLES), default="complex", help="complex: 3-page paper; long: 21-page book with metrics; conference/textbook/manual/essay: 7-8 pages")
    parser.add_argument("--no-memory", action="store_true", help="translate page by page without glossary or context pack")
    parser.add_argument("--no-read", action="store_true", help="skip the read-through before translating (genre, style, glossary, headings)")
    parser.add_argument("--review", action="store_true", help="review every page after translating and apply the accepted tickets")
    parser.add_argument("--document", type=Path, default=None, help="a real normalized document (ocr/normalized/document.v1.json) instead of a sample")
    parser.add_argument("--pdf", type=Path, default=None, help="the source PDF of --document (for the report)")
    parser.add_argument("--baseline", type=Path, default=None, help="translated/ directory of a production job, shown next to the agent's translations")
    parser.add_argument("--glossary", type=Path, default=None, help="a user glossary CSV (same format as the web import), e.g. devtools/agent_lab/glossaries/quantum_chemistry.csv")
    args = parser.parse_args(argv)
    names = load_env_file(args.env)
    print(f"env: {args.env} ({', '.join(names) or 'not found'})")
    agent = TranslationAgent(model=args.model, cache_dir=args.out / "cache", use_cache=not args.no_cache)
    pages_filter = {p.strip() for p in args.pages.split(",") if p.strip()} or None
    results = run(
        args.out, agent=agent, pages_filter=pages_filter, sample=args.sample, memory=not args.no_memory, read_first=not args.no_read, review=args.review,
        document_path=args.document, pdf=args.pdf, baseline_dir=args.baseline, glossary_csv=args.glossary,
    )
    print(json.dumps(results["summary"], ensure_ascii=False, indent=1))
    print(args.out / "report.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
