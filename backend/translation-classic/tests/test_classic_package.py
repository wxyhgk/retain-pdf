"""普通翻译包自己的冒烟测试。翻译的行为测试在 pipeline/devtools/tests/translation。"""

from __future__ import annotations

import subprocess
import sys


def _run(probe: str) -> str:
    result = subprocess.run([sys.executable, "-c", probe], capture_output=True, text=True, timeout=120)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def test_engine_registry_loads_the_classic_engine() -> None:
    probe = (
        "from retainpdf_translation.workflow import engines\n"
        "spec = engines.engine_spec('legacy')\n"
        "for ref in (spec.translate_book, spec.translate_book_streaming, spec.run_preparation, spec.effective_batch_size):\n"
        "    assert ref.startswith('retainpdf_translation_classic.'), ref\n"
        "    assert callable(engines.load(ref)), ref\n"
        "print('ok')\n"
    )
    assert _run(probe) == "ok"


def test_public_facade_imports_without_the_pipeline() -> None:
    probe = (
        "import sys; sys.modules['retainpdf_pipeline'] = None\n"
        "from retainpdf_translation_classic import public\n"
        "public.run_refine_for_render\n"
        # 表格翻译 2026-11-25 搬进了表格 agent 包（backend/table-agent），门面不再导出
        "assert not hasattr(public, 'translate_table') and 'TableTermMemory' not in public.__all__\n"
        "print('ok')\n"
    )
    assert _run(probe) == "ok"


def test_table_agent_package_stands_alone() -> None:
    # 表格 agent 的核心不靠流水线、也不靠普通翻译引擎
    probe = (
        "import sys; sys.modules['retainpdf_pipeline'] = None; sys.modules['retainpdf_translation_classic'] = None\n"
        "from retainpdf_table_agent import translate_table, TableTermMemory\n"
        "print('ok')\n"
    )
    assert _run(probe) == "ok"


def test_the_base_facade_does_not_pull_in_the_classic_engine() -> None:
    # 底座的门面和执行入口按需加载引擎：光 import 不该把普通翻译带进来
    probe = (
        "import sys\n"
        "from retainpdf_translation import public\n"
        "public.TranslationExecutionRequest; public.execute_translation_request\n"
        "import retainpdf_translation.workflow.execution_runner\n"
        "print(sorted(m for m in sys.modules if m.startswith('retainpdf_translation_classic')))\n"
    )
    assert _run(probe) == "[]"
