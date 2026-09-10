from importlib import import_module
import sys
import unittest
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


def load_placeholder_guard():
    return import_module("retainpdf_pipeline.translate.llm.placeholder_guard")


class PlaceholderAliasTests(unittest.TestCase):
    def test_import_preserves_cached_module_identity(self):
        package = import_module("retainpdf_pipeline.translate.llm")
        module = load_placeholder_guard()
        path_before = list(sys.path)
        self.assertIs(load_placeholder_guard(), module)
        self.assertIs(package.placeholder_guard, module)
        self.assertIs(sys.modules[module.__name__], module)
        self.assertEqual(sys.path, path_before)

    def test_alias_maps_use_short_ascii_tokens(self):
        module = load_placeholder_guard()
        item = {
            "item_id": "demo",
            "block_type": "text",
            "protected_source_text": "A [[FORMULA_1]] and [[FORMULA_2]]",
            "translation_unit_protected_source_text": "A [[FORMULA_1]] and [[FORMULA_2]]",
            "metadata": {"structure_role": "body"},
        }
        original_to_alias, alias_to_original = module.placeholder_alias_maps(item)
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
        module = load_placeholder_guard()
        item = {
            "item_id": "demo",
            "block_type": "text",
            "protected_source_text": "A [[FORMULA_1]] and [[FORMULA_2]]",
            "translation_unit_protected_source_text": "A [[FORMULA_1]] and [[FORMULA_2]]",
            "metadata": {"structure_role": "body"},
        }
        original_to_alias, alias_to_original = module.placeholder_alias_maps(item)
        aliased_item = module.item_with_placeholder_aliases(item, original_to_alias)
        self.assertEqual(
            module.placeholder_sequence(aliased_item["translation_unit_protected_source_text"]),
            ["@@P1@@", "@@P2@@"],
        )

        aliased_result = {
            "demo": module.result_entry("translate", "译文 @@P1@@ 和 @@P2@@"),
        }
        module.validate_batch_result([aliased_item], aliased_result)

        restored = module.restore_placeholder_aliases(aliased_result, alias_to_original)
        self.assertEqual(
            restored["demo"]["translated_text"],
            "译文 [[FORMULA_1]] 和 [[FORMULA_2]]",
        )

    def test_validate_allows_token_reordering_with_warning_only(self):
        module = load_placeholder_guard()
        item = {
            "item_id": "demo",
            "block_type": "text",
            "protected_source_text": "A <f1-a7c/> and <t1-b2d/>",
            "translation_unit_protected_source_text": "A <f1-a7c/> and <t1-b2d/>",
            "metadata": {"structure_role": "body"},
        }
        diagnostics = module.TranslationDiagnosticsCollector()
        module.validate_batch_result(
            [item],
            {"demo": module.result_entry("translate", "在 <t1-b2d/> 之后是 <f1-a7c/>")},
            diagnostics=diagnostics,
        )
        assert any(item.kind == "placeholder_order_changed" for item in diagnostics.diagnostics)


if __name__ == "__main__":
    unittest.main()
