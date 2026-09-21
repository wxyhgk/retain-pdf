from __future__ import annotations

import ast
import sys
from pathlib import Path

import pytest


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from devtools.architecture_checks import translation_source_readers as gate


def _reads(source: str) -> dict[str, list[int]]:
    return gate.gated_source_text_reads(ast.parse(source))


def test_detects_get_reads_regardless_of_variable_name() -> None:
    # 门禁必须与变量名无关:item / record / member 都要抓到。
    source = (
        'a = item.get("source_text")\n'
        'b = record.get("group_protected_source_text", "")\n'
        'c = member.get("translation_unit_protected_source_text")\n'
    )

    assert _reads(source) == {
        "source_text": [1],
        "group_protected_source_text": [2],
        "translation_unit_protected_source_text": [3],
    }


def test_detects_subscript_reads_but_not_writes() -> None:
    source = (
        'value = item["protected_source_text"]\n'
        'item["protected_source_text"] = value\n'
        'del item["source_text"]\n'
    )

    assert _reads(source) == {"protected_source_text": [1]}


@pytest.mark.parametrize(
    "source",
    [
        # 造 payload 不是读 payload。
        'record = {"source_text": text}',
        'record = dict(source_text=text)',
        'item.update({"protected_source_text": text})',
        # 同名局部变量不是 payload 读取点。
        'source_text = ""',
        # 未受门禁的键。
        'item.get("translated_text")',
        'item.get("raw_source_text")',
        # 不做别名/动态键分析。
        'item.get(key)',
        'item[key]',
    ],
)
def test_ignores_construction_and_ungated_keys(source: str) -> None:
    assert _reads(source) == {}


def test_canonical_reader_is_pinned_as_the_full_chain() -> None:
    # item_source_text 必须一次覆盖全部四个范围,否则「用它就够了」这句话不成立。
    reader = REPO_SCRIPTS_ROOT / gate.CANONICAL_READER
    reads = gate.gated_source_text_reads(ast.parse(reader.read_text(encoding="utf-8")))

    assert set(reads) == set(gate.GATED_SOURCE_TEXT_KEYS)


def test_current_tree_matches_the_frozen_allowlist() -> None:
    # 全量跑真实 translate 目录:白名单必须与现状精确一致。
    # 若此测试失败,要么新增了裸读取点(改代码、改用 item_source_text),
    # 要么完成了一次收敛(把白名单里的数字调小 / 整条删掉)。
    errors: list[str] = []

    gate.check_translation_source_text_readers(errors)

    assert errors == []


def test_allowlist_only_shrinks_never_silently_grows(monkeypatch) -> None:
    # 反证:白名单里某个文件的冻结数被调高(相当于"扩"),门禁必须转红。
    victim = gate.CANONICAL_READER
    inflated = dict(gate.SOURCE_TEXT_READER_ALLOWLIST)
    inflated[victim] = inflated[victim] + 1
    monkeypatch.setattr(gate, "SOURCE_TEXT_READER_ALLOWLIST", inflated)

    errors: list[str] = []
    gate.check_translation_source_text_readers(errors)

    assert any(victim in error and "收敛到" in error for error in errors)


def test_removing_an_allowlist_entry_while_the_code_remains_turns_red(monkeypatch) -> None:
    # 反证:代码还在,但白名单条目被删掉 -> 必须报"新增了裸读取点"。
    victim = "retainpdf_pipeline/translate/services/continuation/rules.py"
    trimmed = {
        path: count
        for path, count in gate.SOURCE_TEXT_READER_ALLOWLIST.items()
        if path != victim
    }
    monkeypatch.setattr(gate, "SOURCE_TEXT_READER_ALLOWLIST", trimmed)

    errors: list[str] = []
    gate.check_translation_source_text_readers(errors)

    assert any(victim in error and "item_source_text" in error for error in errors)


def test_gate_refuses_to_pass_when_it_parses_nothing(monkeypatch) -> None:
    # 门禁自保:读取点识别逻辑失效(这里模拟成"什么都扫不到")时必须报错,
    # 而不是静默变成空操作。
    monkeypatch.setattr(gate, "gated_source_text_reads", lambda tree: {})

    errors: list[str] = []
    gate.check_translation_source_text_readers(errors)

    assert any("门禁自保失败" in error for error in errors)
    assert any("静默空转" in error for error in errors)


def test_gate_refuses_to_pass_when_the_key_set_drifts(monkeypatch) -> None:
    # 门禁自保:键名与代码脱节(四个键再也扫不到)时必须报错。
    monkeypatch.setattr(gate, "GATED_SOURCE_TEXT_KEYS", frozenset({"no_such_source_key"}))

    errors: list[str] = []
    gate.check_translation_source_text_readers(errors)

    assert any("门禁自保失败" in error for error in errors)
