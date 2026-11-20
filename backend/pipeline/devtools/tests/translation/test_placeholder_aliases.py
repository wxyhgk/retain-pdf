import unittest

from retainpdf_translation.artifacts import TranslationDiagnosticsCollector
from retainpdf_translation_classic.llm.placeholder_transform import item_with_placeholder_aliases
from retainpdf_translation_classic.llm.placeholder_transform import placeholder_alias_maps
from retainpdf_translation_classic.llm.placeholder_transform import restore_placeholder_aliases
from retainpdf_translation.llm.result_payload import result_entry
from retainpdf_translation_classic.llm.result_validator import validate_batch_result
from retainpdf_translation.llm.validation.placeholder_tokens import placeholder_sequence


class PlaceholderAliasTests(unittest.TestCase):
    def test_alias_maps_use_short_ascii_tokens(self):
        item = {
            "item_id": "demo",
            "block_type": "text",
            "protected_source_text": "A [[FORMULA_1]] and [[FORMULA_2]]",
            "translation_unit_protected_source_text": "A [[FORMULA_1]] and [[FORMULA_2]]",
            "metadata": {"structure_role": "body"},
        }
        original_to_alias, alias_to_original = placeholder_alias_maps(item)
        self.assertEqual(
            original_to_alias,
            {
                "[[FORMULA_1]]": "@@P1@@",
                "[[FORMULA_2]]": "@@P2@@",
            },
        )
        self.assertEqual(
            alias_to_original,
            {
                "@@P1@@": "[[FORMULA_1]]",
                "@@P2@@": "[[FORMULA_2]]",
            },
        )

    def test_alias_placeholders_round_trip_and_validate(self):
        item = {
            "item_id": "demo",
            "block_type": "text",
            "protected_source_text": "A [[FORMULA_1]] and [[FORMULA_2]]",
            "translation_unit_protected_source_text": "A [[FORMULA_1]] and [[FORMULA_2]]",
            "metadata": {"structure_role": "body"},
        }
        original_to_alias, alias_to_original = placeholder_alias_maps(item)
        aliased_item = item_with_placeholder_aliases(item, original_to_alias)
        self.assertEqual(
            placeholder_sequence(aliased_item["translation_unit_protected_source_text"]),
            ["@@P1@@", "@@P2@@"],
        )

        aliased_result = {
            "demo": result_entry("translate", "译文 @@P1@@ 和 @@P2@@"),
        }
        validate_batch_result([aliased_item], aliased_result)

        restored = restore_placeholder_aliases(aliased_result, alias_to_original)
        self.assertEqual(
            restored["demo"]["translated_text"],
            "译文 [[FORMULA_1]] 和 [[FORMULA_2]]",
        )

    def test_validate_allows_token_reordering_with_warning_only(self):
        item = {
            "item_id": "demo",
            "block_type": "text",
            "protected_source_text": "A <f1-a7c/> and <t1-b2d/>",
            "translation_unit_protected_source_text": "A <f1-a7c/> and <t1-b2d/>",
            "metadata": {"structure_role": "body"},
        }
        diagnostics = TranslationDiagnosticsCollector()
        validate_batch_result(
            [item],
            {"demo": result_entry("translate", "在 <t1-b2d/> 之后是 <f1-a7c/>")},
            diagnostics=diagnostics,
        )
        assert any(item.kind == "placeholder_order_changed" for item in diagnostics.diagnostics)


if __name__ == "__main__":
    unittest.main()
