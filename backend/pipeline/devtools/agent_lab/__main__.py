"""翻译 agent 测试系统：造样例 → 逐页交给 agent → 逐块校验 → 生成报告。

    cd backend/pipeline
    ../.venv/bin/python -m devtools.agent_lab --out /tmp/agent_lab            # 读 ~/.config/retainpdf/test.env 里的密钥
    open /tmp/agent_lab/report.html

同样的输入第二次跑走缓存（`<out>/cache/`），不再调接口；改了提示词或样例会自动重新请求。`--no-cache` 强制重跑。
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

from devtools.agent_lab.agent import PROMPT_VERSION
from devtools.agent_lab.agent import Agent
from devtools.agent_lab.pages import build_pages
from devtools.agent_lab.pages import document_title
from devtools.agent_lab.report import build_report
from devtools.ocr_viewer.complex_sample import PRINTED_PAGE
from devtools.ocr_viewer.complex_sample import build as build_sample

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


def run(out_dir: Path, *, agent: Agent, pages_filter: set[str] | None = None) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    pdf_path, truth_path = build_sample().save(out_dir)
    truth = json.loads(truth_path.read_text(encoding="utf-8"))
    requests = build_pages(truth, page_labels=PRINTED_PAGE)
    document = {"title": document_title(truth), "source_lang": "en", "target_lang": "zh-CN"}
    started = time.monotonic()
    blocks: dict[str, dict] = {}
    pages_out = []
    for page in requests:
        if pages_filter and page.page_label not in pages_filter:
            continue
        results, info = agent.translate_page(page, document=document)
        pages_out.append({"page": page.page, "label": page.page_label, "translate_blocks": len(page.to_translate()), **info})
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
            }
            result = results.get(block.id)
            if result:
                entry.update(translation=result.translation, issues=result.issues, attempts=result.attempts, status=result.status, history=result.history)
            else:
                entry.update(status="skipped")
            blocks[block.id] = entry
    statuses = [b["status"] for b in blocks.values() if b["translate"]]
    summary = {
        "model": agent.model,
        "prompt_version": PROMPT_VERSION,
        "pages": len(pages_out),
        "blocks": len(blocks),
        "translated": len(statuses),
        "ok": statuses.count("ok"),
        "warn": statuses.count("warn"),
        "error": statuses.count("error"),
        "retried": sum(1 for b in blocks.values() if b.get("attempts", 1) > 1),
        "requests": agent.usage.requests,
        "cached_requests": agent.usage.cached,
        "input_tokens": agent.usage.input_tokens,
        "output_tokens": agent.usage.output_tokens,
        "model_latency_ms": agent.usage.latency_ms,
        "wall_ms": int((time.monotonic() - started) * 1000),
    }
    results = {"summary": summary, "pages": pages_out, "calls": agent.calls, "blocks": blocks}
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
    args = parser.parse_args(argv)
    names = load_env_file(args.env)
    print(f"env: {args.env} ({', '.join(names) or 'not found'})")
    agent = Agent(model=args.model, cache_dir=args.out / "cache", use_cache=not args.no_cache)
    pages_filter = {p.strip() for p in args.pages.split(",") if p.strip()} or None
    results = run(args.out, agent=agent, pages_filter=pages_filter)
    print(json.dumps(results["summary"], ensure_ascii=False, indent=1))
    print(args.out / "report.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
