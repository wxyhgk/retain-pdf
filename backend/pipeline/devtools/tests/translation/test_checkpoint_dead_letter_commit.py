"""死信不该挡住 checkpoint 提交，但也不该把「一条都没译成」一起放行。

artifacts/status.py 早就定了死信不阻断导出（ALLOWED_UNTRANSLATED_REASONS 里有
dead_letter_queue，理由写在那里：一个块救不回来，不值得让同一份文档里其余上百个
已成功的块一起作废）。但 checkpoint 只有 pending_item_count 这一个数，而它走的是
pending_translation_items —— 那是**工作队列**的口径，只问「该翻吗、有译文吗」，
死信两者都满足「还没完成」。

于是同一份文档上两套口径结论相反：blocking_after=0 放行了导出，
pending_item_count 却还是 2，assert_checkpoint_committable 直接抛，validating 崩掉，
重翻也卡在同样那几块。

修法不是改 pending 的口径。工作队列那一侧**不能**跟着豁免 —— 重翻正是靠它把死信
捞回来，checkpoint 续跑也靠它。而且 pending!=0 当初还兼职挡着另一件事：
「0 个块翻译成功的文档不许冒充 complete」（assert_checkpoint_committable 的
docstring 自己写着）。一个数干两件事，动它就会掉一件。

所以拆成两个数：
- pending_item_count  工作队列，死信照样在里面
- blocking_item_count 真正挡住收尾的，死信不在里面，从没尝试过的块在里面
再加 translated_item_count 独立守住「零产出不许发布」。
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest


from retainpdf_translation.workflow.checkpoint.contract import (  # noqa: E402
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
    elif state == "untouched":  # 还没轮到它，final_status 是空的
        item |= {"translated_text": ""}
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
    assert progress["blocking_item_count"] == 0, (
        "死信被算成阻断项 —— validating 会在 assert_checkpoint_committable 崩掉"
    )
    assert_checkpoint_committable({"phase": "validating", "progress": progress})


def test_dead_letters_stay_in_the_work_queue_so_retranslation_can_reach_them(
    tmp_path: Path,
) -> None:
    """放行提交，不等于从待办里抹掉。抹掉了重翻就再也捞不到这两块。"""
    items = [
        _item("b1", state="translated"),
        _item("b2", state="dead_letter"),
        _item("b3", state="dead_letter"),
    ]
    progress = _progress(tmp_path, items)
    assert progress["pending_item_count"] == 2
    assert progress["completed_item_count"] == 1


def test_a_document_with_zero_translations_still_cannot_commit(tmp_path: Path) -> None:
    """死信全军覆没 —— blocking 是 0，但这份文档一点译文都没有，不许冒充 complete。"""
    items = [_item("b2", state="dead_letter"), _item("b3", state="dead_letter")]
    progress = _progress(tmp_path, items)
    assert progress["blocking_item_count"] == 0
    assert progress["translated_item_count"] == 0
    with pytest.raises(RuntimeError, match="zero translated items"):
        assert_checkpoint_committable({"phase": "validating", "progress": progress})


def test_real_failures_still_block_commit(tmp_path: Path) -> None:
    """别为了放行死信把闸门拆了。"""
    items = [_item("b1", state="translated"), _item("b9", state="failed")]
    progress = _progress(tmp_path, items)
    assert progress["blocking_item_count"] == 1
    with pytest.raises(RuntimeError, match="pending items"):
        assert_checkpoint_committable({"phase": "validating", "progress": progress})


def test_a_dead_letter_beside_a_real_failure_still_blocks(tmp_path: Path) -> None:
    items = [
        _item("b1", state="translated"),
        _item("b2", state="dead_letter"),
        _item("b9", state="failed"),
    ]
    progress = _progress(tmp_path, items)
    assert progress["blocking_item_count"] == 1, "只有真失败那一个该算阻断"
    assert progress["pending_item_count"] == 2, "死信仍在待办里"
    with pytest.raises(RuntimeError, match="pending items"):
        assert_checkpoint_committable({"phase": "validating", "progress": progress})


def test_a_block_that_was_never_attempted_blocks_commit(tmp_path: Path) -> None:
    """final_status 为空的块 is_blocking_untranslated 返回 False —— 只看它就会
    把半途的 checkpoint 当成可提交。"""
    items = [_item("b1", state="translated"), _item("b7", state="untouched")]
    progress = _progress(tmp_path, items)
    assert progress["blocking_item_count"] == 1
    with pytest.raises(RuntimeError, match="pending items"):
        assert_checkpoint_committable({"phase": "validating", "progress": progress})


def test_old_checkpoints_without_the_new_counter_use_the_stricter_rule(
    tmp_path: Path,
) -> None:
    """盘上已有的 checkpoint 没有 blocking_item_count，必须退回原来那条判断。"""
    assert_checkpoint_committable(
        {"phase": "validating", "progress": {"pending_item_count": 0}}
    )
    with pytest.raises(RuntimeError, match="pending items"):
        assert_checkpoint_committable(
            {"phase": "validating", "progress": {"pending_item_count": 2}}
        )


def test_completed_page_count_counts_pages_without_pending_items(tmp_path: Path) -> None:
    """翻译进度文案「已完成 p/P 页」取这个数:只有整页没有待办块才算完成。"""
    pages = {
        0: [_item("p1-b1", state="translated"), _item("p1-b2", state="translated")],
        1: [_item("p2-b1", state="translated"), _item("p2-b2", state="untouched")],
        2: [],
    }
    paths = {}
    for index, items in pages.items():
        paths[index] = tmp_path / f"page-{index}.json"
        paths[index].write_text(json.dumps(items), encoding="utf-8")
    _, progress = project_progress(
        output_dir=tmp_path, page_payloads=pages, translation_paths=paths
    )
    assert progress["completed_page_count"] == 2
    assert progress["pending_item_count"] == 1


def test_a_group_left_with_one_dead_lettered_member_does_not_block_commit(tmp_path: Path) -> None:
    """接续组里一块按策略保留原文了、另一块转成死信：待办单元只剩一个成员，单元编号 `__cg__:…` 不是任何一块的编号。

    以前只有一个成员时去看单元自己的状态（单元从来不会被打上最终状态），永远算阻断：导出门禁放行了，提交却报
    pending（2026-11-03，6574 页的书卡在 p917-b021 一行 `---`，同组另一块是命令行、按策略保留原文）。
    """
    from retainpdf_translation.workflow.checkpoint.contract import _is_settled_non_blocking

    dead = _item("p917-b021", state="dead_letter")
    unit = {
        "item_id": "__cg__:cg-917-130",
        "translation_unit_id": "__cg__:cg-917-130",
        "translation_unit_kind": "group",
        "translation_unit_member_ids": ["p917-b021"],
        "should_translate": True,
    }
    assert _is_settled_non_blocking(unit, [dead])
    # 成员还没处理（没有最终状态）时照样算待办
    assert not _is_settled_non_blocking(unit, [_item("p917-b021", state="untouched")])
