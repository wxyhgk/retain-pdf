"""已经翻好的任务：把「没翻成」里其实没东西可翻的块改记成保留原文（2026-11-20）。

翻译时 agent 引擎已经在交给模型前把这类块标好（`agent_flow.skip_nothing_to_translate`）；这里给以前翻好的书补上，
用同一条规则（`retainpdf_translation_agent.checks.nothing_to_translate`），不用重新翻译。只改 `final_status=failed`
的块；阅读页「待处理」、书详情「没翻成」、`/data/translation_items` 都读这些记录。
任务记录里的完成说明（「有 N 个内容块保留原文未翻译」）是任务结束时写的，不跟着改。

改写走译文修订的提交入口（`retainpdf_translation.workflow.revision.commit_item_maintenance`）：持断点的锁，页文件、
断点的页哈希和快照、修订日志（`source=maintenance`）一起前进。以前直接改页文件，之后重排版按断点哈希校验读不出，
用户下一次改译文时又被快照悄悄换回去（2026-11-26，S22）。断点还没提交（翻译中途失败、正在跑）时拒绝，先把翻译续完；
没有断点的老任务照旧直接改页文件（没有东西按哈希校验它们）。

    python -m retainpdf_translation_agent_engine.reclassify <任务目录>            # 只列出来
    python -m retainpdf_translation_agent_engine.reclassify <任务目录> --apply    # 改写
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from retainpdf_translation.core.item_reader import item_source_text
from retainpdf_translation.core.payload import load_translations
from retainpdf_translation.core.payload import save_translations
from retainpdf_translation.core.payload.parts.policy_state import mark_policy_skip
from retainpdf_translation.workflow.checkpoint.contract import translation_checkpoint_path
from retainpdf_translation.workflow.revision import RevisionOutcome
from retainpdf_translation.workflow.revision import commit_item_maintenance
from retainpdf_translation_agent.checks import nothing_to_translate


def _source(item: dict) -> str:
    # 接续组成员不进这里（见下），单块的完整取值链就是它自己的原文
    return str(item_source_text(item) or "").strip()


def _reclassify_items(items: list[dict], *, apply: bool) -> list[dict]:
    changes: list[dict] = []
    for item in items:
        if not isinstance(item, dict) or str(item.get("final_status") or "") != "failed":
            continue
        if len(item.get("translation_unit_member_ids") or []) > 1:
            continue
        reason = nothing_to_translate(_source(item))
        if not reason:
            continue
        changes.append({"item_id": str(item.get("item_id") or ""), "reason": reason, "source": _source(item)[:80]})
        if apply:
            mark_policy_skip(item, reason)
    return changes


def reclassify_failed_blocks(translated_dir: Path, *, apply: bool) -> list[dict]:
    """返回改了（或要改）的块：item_id、原因、原文开头。`apply` 为假时不写盘。

    有断点的任务经修订入口提交；断点没提交时抛 `RevisionOutcome`（`translation_not_committed`）。"""
    translated_dir = Path(translated_dir)
    if not apply:
        changes: list[dict] = []
        for path in sorted(translated_dir.glob("page-*.json")):
            changes.extend(_reclassify_items(load_translations(path, strict_contract=False), apply=False))
        return changes
    if translation_checkpoint_path(translated_dir).exists():
        if translated_dir.name != "translated":
            raise ValueError(f"译文目录应当是任务目录下的 translated/：{translated_dir}")
        changes = []

        def mutate(payloads: dict[int, list[dict]]) -> list[dict]:
            for page_idx in sorted(payloads):
                changes.extend(_reclassify_items(payloads[page_idx], apply=True))
            return [{"item_id": change["item_id"], "reason": f"reclassify: {change['reason']}"} for change in changes]

        commit_item_maintenance(translated_dir.parent, mutate)
        return changes
    # 没有断点的老任务：没有东西按页哈希校验，照旧原地改写
    changes = []
    for path in sorted(translated_dir.glob("page-*.json")):
        items = load_translations(path, strict_contract=False)
        page_changes = _reclassify_items(items, apply=True)
        if page_changes:
            save_translations(path, items)
            changes.extend(page_changes)
    return changes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("job_dir", type=Path, help="任务目录（里面有 translated/）")
    parser.add_argument("--apply", action="store_true", help="改写记录；不加只列出来")
    args = parser.parse_args(argv)
    translated = args.job_dir / "translated"
    if not translated.is_dir():
        parser.error(f"没有译文目录：{translated}")
    try:
        changes = reclassify_failed_blocks(translated, apply=args.apply)
    except RevisionOutcome as exc:
        print(f"没有改记：{exc.message}（{exc.reason}）。翻译还没提交时先续跑完翻译，任务在跑时等它结束再来。", file=sys.stderr)
        return 1
    for change in changes:
        print(f"{change['item_id']}\t{change['reason']}\t{change['source']}")
    print(f"{'改记' if args.apply else '可以改记'} {len(changes)} 块为保留原文")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
