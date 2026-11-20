"""已经翻好的任务：把「没翻成」里其实没东西可翻的块改记成保留原文（2026-11-20）。

翻译时 agent 引擎已经在交给模型前把这类块标好（`agent_flow.skip_nothing_to_translate`）；这里给以前翻好的书补上，
用同一条规则（`retainpdf_translation_agent.checks.nothing_to_translate`），不用重新翻译。只改 `final_status=failed`
的块，译文目录里每页的记录原地改写；阅读页「待处理」、书详情「没翻成」、`/data/translation_items` 都读这些记录。
任务记录里的完成说明（「有 N 个内容块保留原文未翻译」）是任务结束时写的，不跟着改。

    python -m retainpdf_translation_agent_engine.reclassify <任务目录>            # 只列出来
    python -m retainpdf_translation_agent_engine.reclassify <任务目录> --apply    # 改写
"""

from __future__ import annotations

import argparse
from pathlib import Path

from retainpdf_translation.core.payload import load_translations
from retainpdf_translation.core.payload import save_translations
from retainpdf_translation.core.payload.parts.policy_state import mark_policy_skip
from retainpdf_translation_agent.checks import nothing_to_translate


def _source(item: dict) -> str:
    return str(item.get("protected_source_text") or item.get("source_text") or "").strip()


def reclassify_failed_blocks(translated_dir: Path, *, apply: bool) -> list[dict]:
    """返回改了（或要改）的块：item_id、原因、原文开头。`apply` 为假时不写盘。"""
    changes: list[dict] = []
    for path in sorted(Path(translated_dir).glob("page-*.json")):
        items = load_translations(path, strict_contract=False)
        page_changed = False
        for item in items:
            if str(item.get("final_status") or "") != "failed":
                continue
            if len(item.get("translation_unit_member_ids") or []) > 1:
                continue
            reason = nothing_to_translate(_source(item))
            if not reason:
                continue
            changes.append({"item_id": str(item.get("item_id") or ""), "reason": reason, "source": _source(item)[:80]})
            if apply:
                mark_policy_skip(item, reason)
                page_changed = True
        if page_changed:
            save_translations(path, items)
    return changes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("job_dir", type=Path, help="任务目录（里面有 translated/）")
    parser.add_argument("--apply", action="store_true", help="改写记录；不加只列出来")
    args = parser.parse_args(argv)
    translated = args.job_dir / "translated"
    if not translated.is_dir():
        parser.error(f"没有译文目录：{translated}")
    changes = reclassify_failed_blocks(translated, apply=args.apply)
    for change in changes:
        print(f"{change['item_id']}\t{change['reason']}\t{change['source']}")
    print(f"{'改记' if args.apply else '可以改记'} {len(changes)} 块为保留原文")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
