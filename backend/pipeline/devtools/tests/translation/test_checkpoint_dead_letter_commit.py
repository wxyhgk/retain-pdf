"""死信不该挡住 checkpoint 提交。

artifacts/status.py 早就定了死信不阻断导出（ALLOWED_UNTRANSLATED_REASONS 里有
dead_letter_queue，理由写在那里：一个块救不回来，不值得让同一份文档里其余上百个
已成功的块一起作废）。但 checkpoint 的 pending 计数走的是
pending_translation_items —— 那是**工作队列**的口径，只问「该翻吗、有译文吗」，
死信两者都满足「还没完成」。

于是同一份文档上两套口径结论相反：blocking_after=0 放行了导出，
pending_item_count 却还是 2，assert_checkpoint_committable 直接抛，validating 崩掉，
而且重翻会卡在同样那几块。

工作队列那一侧**不能**跟着豁免 —— 重翻正是要靠它把死信捞回来。所以豁免只加在
提交门禁这一层，并且复用 is_blocking_untranslated 这个唯一真相源。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from retainpdf_pipeline.translate.workflow.checkpoint.contract import (  # noqa: E402
    assert_checkpoint_committable,
    project_progress,
)


def _item(item_id: str, *, state: str):
    item = {
        "item_id": item_id,
        "page_idx": 0,
        "should_translate": True,
        "source_text": "src",
        "protected_source_text": "src",
    }
    if state == "translated":
        item |= {
            "translated_text": "译文",
            "final_status": "translated",
            "translation_diagnostics": {"final_status": "translated"},
        }
    elif state == "dead_letter":
        item |= {
            "translated_text": "",
            "final_status": "failed",
            "translation_diagnostics": {
                "final_status": "failed",
                "route_path": ["batched_plain", "single_item", "dlq"],
                "degradation_reason": "dead_letter_queue",
                "dead_letter": True,
            },
        }
    else:  # 普通失败，仍然阻断
        item |= {
            "translated_text": "",
            "final_status": "failed",
            "translation_diagnostics": {"final_status": "failed"},
        }
    return item


def _progress(tmp_path: Path, items: list[dict]):
    page = tmp_path / "page-1.json"
    page.write_text(json.dumps(items), encoding="utf-8")
    _, progress = project_progress(
        output_dir=tmp_path, page_payloads={0: items}, translation_paths={0: page}
    )
    return progress


def test_dead_letters_do_not_block_commit(tmp_path: Path) -> None:
    items = [
        _item("b1", state="translated"),
        _item("b2", state="dead_letter"),
        _item("b3", state="dead_letter"),
    ]
    progress = _progress(tmp_path, items)
    assert progress["pending_item_count"] == 0, (
        "死信被算成待办 —— validating 会在 assert_checkpoint_committable 崩掉"
    )
    assert_checkpoint_committable({"phase": "validating", "progress": progress})


def test_real_failures_still_block_commit(tmp_path: Path) -> None:
    """别为了放行死信把闸门拆了。"""
    items = [_item("b1", state="translated"), _item("b9", state="failed")]
    progress = _progress(tmp_path, items)
    assert progress["pending_item_count"] == 1
    with pytest.raises(RuntimeError, match="pending items"):
        assert_checkpoint_committable({"phase": "validating", "progress": progress})


def test_a_dead_letter_beside_a_real_failure_still_blocks(tmp_path: Path) -> None:
    items = [
        _item("b1", state="translated"),
        _item("b2", state="dead_letter"),
        _item("b9", state="failed"),
    ]
    progress = _progress(tmp_path, items)
    assert progress["pending_item_count"] == 1, "只有真失败那一个该算待办"
    with pytest.raises(RuntimeError, match="pending items"):
        assert_checkpoint_committable({"phase": "validating", "progress": progress})
