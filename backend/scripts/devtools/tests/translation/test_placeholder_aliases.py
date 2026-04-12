import importlib.util
import sys
import types
import unittest
from pathlib import Path


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")


def load_placeholder_guard():
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))
    package_paths = {
        "services": REPO_SCRIPTS_ROOT / "services",
        "services.translation": REPO_SCRIPTS_ROOT / "services" / "translation",
        "services.translation.llm": REPO_SCRIPTS_ROOT / "services" / "translation" / "llm",
        "services.translation.policy": REPO_SCRIPTS_ROOT / "services" / "translation" / "policy",
        "services.document_schema": REPO_SCRIPTS_ROOT / "services" / "document_schema",
    }
    for name, path in package_paths.items():
        module = sys.modules.get(name)
        if module is None:
            module = types.ModuleType(name)
            module.__path__ = [str(path)]
            sys.modules[name] = module
    spec = importlib.util.spec_from_file_location(
        "services.translation.llm.placeholder_guard",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class PlaceholderAliasTests(unittest.TestCase):
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
