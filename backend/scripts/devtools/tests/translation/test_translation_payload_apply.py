import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.payload.parts.apply import apply_translated_text_map
from services.translation.payload.translations import load_translations


def test_apply_translated_text_map_unwraps_json_string_result() -> None:
    payload = [
        {
            "item_id": "demo",
            "should_translate": True,
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
        }
    ]
    translated = {
        "demo": '{"translated_text":"修复后的文本"}',
    }

    apply_translated_text_map(payload, translated)

    assert payload[0]["translated_text"] == "修复后的文本"
    assert payload[0]["protected_translated_text"] == "修复后的文本"
    assert payload[0]["translation_unit_translated_text"] == "修复后的文本"
    assert payload[0]["translation_unit_protected_translated_text"] == "修复后的文本"


def test_apply_translated_text_map_unwraps_json_string_keep_origin() -> None:
    payload = [
        {
            "item_id": "demo",
            "should_translate": True,
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
        }
    ]
    translated = {
        "demo": '{"decision":"keep_origin","translated_text":"ignored"}',
    }

    apply_translated_text_map(payload, translated)

    assert payload[0]["final_status"] == "kept_origin"
    assert payload[0]["translated_text"] == ""


def test_apply_translated_text_map_unwraps_batch_json_string_result() -> None:
    payload = [
        {
            "item_id": "demo",
            "should_translate": True,
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
        }
    ]
    translated = {
        "demo": '{"translations":[{"item_id":"demo","translated_text":"批量壳里的文本"}]}',
    }

    apply_translated_text_map(payload, translated)

    assert payload[0]["translated_text"] == "批量壳里的文本"
    assert payload[0]["translation_unit_translated_text"] == "批量壳里的文本"


def test_apply_translated_text_map_splits_group_translation_back_to_members() -> None:
    payload = [
        {
            "item_id": "p002-b001",
            "translation_unit_id": "__cg__:cg-002-002",
            "translation_unit_kind": "group",
            "should_translate": True,
            "source_text": "The advancement of complex computer programs...",
            "protected_source_text": "The advancement of complex computer programs...",
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
            "group_protected_map": [],
            "group_formula_map": [],
        },
        {
            "item_id": "p002-b002",
            "translation_unit_id": "__cg__:cg-002-002",
            "translation_unit_kind": "group",
            "should_translate": True,
            "source_text": "and energy levels; (2) revealing the surface reactivities...",
            "protected_source_text": "and energy levels; (2) revealing the surface reactivities...",
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
            "group_protected_map": [],
            "group_formula_map": [],
        },
    ]
    translated = {
        "__cg__:cg-002-002": "随着计算能力更强的复杂计算机程序和材料模拟方法的发展，它们已成为材料研究人员的重要工具。DFT计算在光催化领域发挥着重要作用。",
    }

    apply_translated_text_map(payload, translated)

    assert payload[0]["translation_unit_translated_text"].startswith("随着计算能力更强的复杂计算机程序")
    assert payload[0]["translated_text"]
    assert payload[1]["translated_text"]
    assert payload[0]["translated_text"] != payload[1]["translated_text"]


def test_load_translations_sanitizes_persisted_json_shell(tmp_path) -> None:
    path = tmp_path / "page-030-deepseek.json"
    path.write_text(
        """
        [
          {
            "item_id": "p030-b010",
            "translated_text": "{\\"translations\\":[{\\"item_id\\":\\"p030-b010\\",\\"translated_text\\":\\"(1) 计算效率、成本与精度。\\"}]}",
            "protected_translated_text": "{\\"translated_text\\":\\"(1) 计算效率、成本与精度。\\"}"
          }
        ]
        """,
        encoding="utf-8",
    )

    payload = load_translations(path)

    assert payload[0]["translated_text"] == "(1) 计算效率、成本与精度。"
    assert payload[0]["protected_translated_text"] == "(1) 计算效率、成本与精度。"
    assert "translations" not in path.read_text(encoding="utf-8")
