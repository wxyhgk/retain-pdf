"""读页只读（2026-11-26，状态管理 Z4 / S02，状态梳理 T-N11）：续跑加载每页时，`$` 不成对、译文是 JSON 壳这类可疑译文
只打一行日志，不改译文、不写回磁盘。

以前 `sanitize_loaded_translation_record` 遇到 `$` 不成对就清空 6 个译文字段和 `final_status` 并落盘：数 `$` 不排除行内代码，
`` `echo $HOME` `` 这样 agent 校验放过的译文也被抹掉，块变回待办，断点报 regressed；JSON 壳里 `decision=keep_origin`
的只清了译文、`final_status` 还是 translated，块成了「已翻但没字」。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from retainpdf_translation.core.payload.parts.translation_units import refresh_payload_translation_units
from retainpdf_translation.core.payload.parts.units import pending_translation_items
from retainpdf_translation.core.payload.translations import ensure_translation_template
from retainpdf_translation.core.payload.translations import migrate_translations
from retainpdf_translation.workflow.checkpoint.contract import advance_checkpoint
from retainpdf_translation.workflow.checkpoint.contract import new_checkpoint
from retainpdf_translation.workflow.checkpoint.contract import project_progress

TEXT_FIELDS = (
    "translation_unit_protected_translated_text",
    "translation_unit_translated_text",
    "protected_translated_text",
    "translated_text",
)


def _record(item_id: str, source: str, translated: str) -> dict:
    record = {
        "item_id": item_id, "page_idx": 0, "block_idx": 0, "block_type": "text", "block_kind": "text",
        "layout_role": "paragraph", "semantic_role": "body", "structure_role": "body", "policy_translate": True,
        "asset_id": "", "reading_order": 0, "raw_block_type": "text", "normalized_sub_type": "body",
        "bbox": [0, 0, 10, 10], "source_text": source, "protected_source_text": source,
        "formula_map": [], "protected_map": [], "math_mode": "direct_typst", "should_translate": True,
        "translation_unit_id": item_id, "translation_unit_kind": "single", "translation_unit_member_ids": [item_id],
        "translation_unit_formula_map": [], "translation_unit_protected_map": [],
        "group_protected_translated_text": "", "group_translated_text": "", "continuation_group": "",
        "final_status": "translated", "translation_diagnostics": {"final_status": "translated"},
        "classification_label": "",
    }
    record.update({field: translated for field in TEXT_FIELDS})
    return record


def _write_page(tmp_path: Path, records: list[dict]) -> Path:
    # 先整理成翻译单元的完整形状：读页时那一步就不会再改别的字段，盘上字节变没变只看可疑译文怎么处理
    refresh_payload_translation_units(records, preserve_external_groups=True)
    path = tmp_path / "page-001-deepseek.json"
    path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def _advance(path: Path, previous: dict | None, payload: list[dict], *, phase: str) -> dict:
    pages, progress = project_progress(output_dir=path.parent, page_payloads={0: payload}, translation_paths={0: path})
    checkpoint = new_checkpoint(identity={}, attempt_id="b" if previous else "a", previous=previous)
    return advance_checkpoint(checkpoint, phase=phase, pages=pages, progress=progress)


@pytest.mark.parametrize(("source", "translated", "suspect"), [
    # 行内代码里的 `$` 是字面的：agent 校验放过，读页也不该当问题
    ("Run `echo $HOME` to see the directory.", "运行 `echo $HOME` 查看目录。", False),
    # 真的不成对：也只记日志，不删译文（以后由调和步骤标 suspect、低优先级重翻）
    ("Each tablet costs only $5, tax included.", "该药每片售价仅 $5，含税。", True),
])
def test_loading_a_page_never_erases_a_finished_translation(tmp_path: Path, capsys, source, translated, suspect) -> None:
    path = _write_page(tmp_path, [_record("p001-b001", source, translated)])
    before = json.loads(path.read_text(encoding="utf-8"))
    first = _advance(path, None, before, phase="translating")
    original = path.read_bytes()

    payload = migrate_translations(path)

    assert path.read_bytes() == original, "读页不写回磁盘"
    assert all(payload[0][field] == translated for field in TEXT_FIELDS)
    assert payload[0]["final_status"] == "translated"
    assert pending_translation_items(payload) == []
    _advance(path, first, payload, phase="preparing")  # 续跑的第一次提交：不报 regressed
    out = capsys.readouterr().out
    if suspect:
        assert "p001-b001(math_delimiter_unbalanced)" in out and "page-001-deepseek.json" in out
    else:
        assert "suspect" not in out


@pytest.mark.parametrize("shell", [
    '{"decision": "keep_origin", "translated_text": ""}',
    '{"translations": [{"item_id": "p001-b001", "decision": "translate", "translated_text": "计算效率、成本与精度。"}]}',
])
def test_a_json_shell_is_logged_and_left_alone(tmp_path: Path, capsys, shell: str) -> None:
    """T-N11：以前 keep_origin 的壳只清译文，final_status 留着 translated，块成了「已翻但没字」，变回待办报 regressed。
    写入时（normalize_result_entry）早就解壳了，盘上的壳只会是很老的版本留下的；读页不改它。"""
    path = _write_page(tmp_path, [_record("p001-b001", "Computational efficiency, cost and accuracy.", shell)])
    first = _advance(path, None, json.loads(path.read_text(encoding="utf-8")), phase="translating")
    original = path.read_bytes()

    payload = migrate_translations(path)

    assert path.read_bytes() == original
    assert payload[0]["translated_text"] == shell and payload[0]["final_status"] == "translated"
    _advance(path, first, payload, phase="preparing")
    assert "p001-b001(json_shell)" in capsys.readouterr().out


def test_template_sync_keeps_suspect_translations_when_it_saves_the_page(tmp_path: Path) -> None:
    """ensure_translation_template 为别的原因（补齐新块、删掉不在了的块）写回页文件时，也不顺手清可疑译文。"""
    from retainpdf_translation.core.ocr.models import TextItem

    record = _record("p001-b001", "Each tablet costs only $5.", "每片仅 $5。")
    stale = _record("p001-b009", "A block OCR no longer reports.", "旧块。")
    path = _write_page(tmp_path, [record, stale])
    item = TextItem(
        item_id="p001-b001", page_idx=0, block_idx=0, block_type="text", bbox=[0, 0, 10, 10],
        text="Each tablet costs only $5.", segments=[], lines=[], metadata={},
    )

    ensure_translation_template([item], path, page_idx=0, math_mode="direct_typst")

    [saved] = json.loads(path.read_text(encoding="utf-8"))
    assert saved["item_id"] == "p001-b001"
    assert saved["translated_text"] == "每片仅 $5。" and saved["final_status"] == "translated"
