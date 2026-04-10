import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


def _ensure_package_stubs():
    package_paths = {
        "foundation": REPO_SCRIPTS_ROOT / "foundation",
        "foundation.config": REPO_SCRIPTS_ROOT / "foundation" / "config",
        "foundation.shared": REPO_SCRIPTS_ROOT / "foundation" / "shared",
        "services": REPO_SCRIPTS_ROOT / "services",
        "services.translation": REPO_SCRIPTS_ROOT / "services" / "translation",
        "services.translation.policy": REPO_SCRIPTS_ROOT / "services" / "translation" / "policy",
        "services.translation.llm": REPO_SCRIPTS_ROOT / "services" / "translation" / "llm",
        "services.document_schema": REPO_SCRIPTS_ROOT / "services" / "document_schema",
    }
    for name, path in package_paths.items():
        module = sys.modules.get(name)
        if module is None:
            module = types.ModuleType(name)
            module.__path__ = [str(path)]
            sys.modules[name] = module


def _load_module(name: str, path: Path):
    _ensure_package_stubs()
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class MixedLiteralSplitterTests(unittest.TestCase):
    def test_local_command_prefix_short_circuit(self):
        module = _load_module(
            "services.translation.policy.mixed_literal_splitter",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "mixed_literal_splitter.py",
        )
        item = {
            "item_id": "x1",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "source_text": "python train.py --epochs 10 --lr 1e-4 This method improves convergence and reduces variance in experiments.",
            "line_texts": [],
            "lines": [],
        }
        decision = module._local_decision(item)
        self.assertEqual(decision[0], "translate_tail")

    def test_cached_decision_round_trip(self):
        module = _load_module(
            "services.translation.policy.mixed_literal_splitter",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "mixed_literal_splitter.py",
        )
        with tempfile.TemporaryDirectory() as tmp:
            module.paths.TRANSLATION_UNIT_CACHE_DIR = Path(tmp)
            item = {
                "item_id": "x2",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
                "source_text": "gcc -O2 main.c output.bin This section explains the optimization outcome in detail.",
                "line_texts": [],
                "lines": [],
            }
            module._store_cached_decision(
                item,
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                rule_guidance="",
                action="translate_tail",
                prefix="gcc -O2 main.c output.bin",
            )
            loaded = module._load_cached_decision(
                item,
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                rule_guidance="",
            )
            self.assertEqual(loaded[0], "translate_tail")


if __name__ == "__main__":
    unittest.main()
