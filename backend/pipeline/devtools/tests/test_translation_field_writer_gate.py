from __future__ import annotations

import ast
import sys
from pathlib import Path

import pytest


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from devtools.architecture_checks.translation_field_writers import (
    check_translation_payload_field_writers,
    gated_field_writes,
)


def _writes(source: str) -> dict[str, list[int]]:
    return gated_field_writes(ast.parse(source))


def test_detects_subscript_assignment_regardless_of_variable_name() -> None:
    # 门禁必须与变量名无关:item / metadata / record 都要抓到。
    source = (
        "item[\"final_status\"] = \"translated\"\n"
        "metadata[\"translated_text\"] = output\n"
        "record[\"should_translate\"] = False\n"
    )

    writes = _writes(source)

    assert writes == {
        "final_status": [1],
        "translated_text": [2],
        "should_translate": [3],
    }


def test_detects_setdefault_and_tuple_targets() -> None:
    source = (
        "payload.setdefault(\"skip_reason\", \"\")\n"
        "a[\"translated_text\"], b[\"protected_translated_text\"] = x, y\n"
    )

    writes = _writes(source)

    assert writes == {
        "skip_reason": [1],
        "translated_text": [2],
        "protected_translated_text": [2],
    }


def test_ignores_reads_and_ungated_keys() -> None:
    source = (
        "value = item[\"final_status\"]\n"
        "item[\"bbox\"] = [0, 0, 1, 1]\n"
        "flag = item.get(\"should_translate\", True)\n"
    )

    assert _writes(source) == {}


@pytest.mark.parametrize("source,field", [
    ('item.update(final_status="translated")', "final_status"),
    ('item.update({"should_translate": False})', "should_translate"),
    ('item.update(**{"skip_reason": "policy"})', "skip_reason"),
    ('item.update({**{"translated_text": "译文"}})', "translated_text"),
    ('item.pop("skip_reason", None)', "skip_reason"),
    ('del item["translated_text"]', "translated_text"),
    ('item |= {"protected_translated_text": "译文"}', "protected_translated_text"),
    ('item["final_status"]: str = "failed"', "final_status"),
    ('item["translated_text"] += "译文"', "translated_text"),
])
def test_detects_explicit_mapping_mutations(source, field):
    assert _writes(source) == {field: [1]}


@pytest.mark.parametrize("source", [
    'result = {"final_status": "translated"}',
    'result = dict(final_status="translated")',
    'result = item | {"final_status": "translated"}',
    'result = item.get("translated_text")',
    'item.update(bbox=[0, 0, 1, 1])',
    'item.pop("bbox", None)',
    # No invented data-flow proof for an unknown mapping or dynamic key.
    'item.update(other_mapping)',
    'item[key] = value',
])
def test_does_not_confuse_dictionary_creation_or_reads_with_mutation(source):
    assert _writes(source) == {}


def test_current_tree_has_no_violations() -> None:
    # 全量跑真实 translation 目录:allowlist 必须与现状精确一致。
    # 若此测试失败,要么出现了新的越界写入(修代码),
    # 要么完成了一次收敛(从 allowlist 删掉对应 frozen-debt 条目)。
    errors: list[str] = []

    check_translation_payload_field_writers(errors)

    assert errors == []
