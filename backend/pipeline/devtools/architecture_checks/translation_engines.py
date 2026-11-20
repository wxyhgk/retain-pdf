"""翻译底座和两个引擎的边界（2026-11-20 拆包，方案见
docs/ops/planning/translation-package/20261120-翻译包拆成底座和两个引擎.md）。

- 普通翻译（批量逐块翻、修复兜底、译前准备、精修、编辑部、表格翻译……）：下面 `CLASSIC_MODULES` 列的模块，
  第 2 步搬进了 `retainpdf-translation-classic`（backend/translation-classic，目录结构和翻译包一样）；
- agent 接线（`AGENT_GLUE_MODULES`）：第 3 步搬进 `backend/translation-agent`；
- 其余都是底座 `retainpdf-translation`：两个引擎共用的前后半段（读文档、接续段、页面策略、回填、断点、清单、质检、请求层、用量……）。

规则：
1. 底座、agent 接线都不许 import 普通翻译（包括写在函数里的延迟 import）。底座要用引擎，经引擎登记表
   `workflow/engines.py` 按「模块:函数」字符串延迟加载。
2. 模块放对包：`CLASSIC_MODULES` 里的在普通翻译包，别的在翻译包。清单按逻辑名（相对包根的点分路径）前缀算，
   同一个目录里留在底座的写进 `BASE_EXCEPTIONS`。
"""

from __future__ import annotations

import ast
from pathlib import Path

from devtools.architecture_checks.common import parse_python_file
from devtools.architecture_checks.common import rel
from devtools.architecture_checks.common import TRANSLATION_CLASSIC_IMPORT
from devtools.architecture_checks.common import TRANSLATION_CLASSIC_PACKAGE_ROOT
from devtools.architecture_checks.common import logical_translation_module
from devtools.architecture_checks.common import scan_py_files
from devtools.architecture_checks.translation_rules import TRANSLATION_ROOT

PACKAGE = "retainpdf_translation"

# 普通翻译引擎的模块（相对 retainpdf_translation，前缀匹配：本身和它下面的子模块）
CLASSIC_MODULES = (
    "workflow.book_flow",
    "workflow.streaming_flow",
    "workflow.batch_runner",
    "workflow.batching",
    "workflow.scheduling",
    "workflow.stages",
    "workflow.refine",
    "workflow.editorial",
    "workflow.checkpoint.preparation",
    "workflow.phases.batch_translation",
    "workflow.phases.repair",
    "workflow.preparation_step",
    "llm.shared.orchestration",
    "llm.shared.cache",
    "llm.shared.prompt_protocols",
    "llm.shared.prompt_building",
    "llm.providers.deepseek.translation_client",
    "llm.placeholder_diagnostics",
    "llm.placeholder_transform",
    "llm.result_canonicalizer",
    "llm.result_validator",
    "llm.citation_style",
    "services.preparation",
    "services.agents",
    "services.editorial",
    "services.refine",
    "services.fast_path",
    "services.classification.page_classifier",
    "services.classification.prompting",
    "services.classification.response_parser",
    "services.tables",
    "services.postprocess",
    "services.memory",
)
# 在上面那些目录里、但属于底座的模块（第 2 步搬家时留在底座）
BASE_EXCEPTIONS = (
    "workflow.scheduling.allocation",  # 并发参数：纯函数，执行计划写运行诊断用
    "services.agents.reviewer",  # 规则审查（英文残留、占位符、术语），审校汇总用
    "services.agents.review_artifact",  # 审校汇总，两种引擎跑完都写
    "services.memory.updater",  # 记忆更新器的协议，回填用；任务记忆本身属于普通翻译
)
AGENT_GLUE_MODULES = (
    "workflow.agent_flow",
    "workflow.agent_openai",
)


def _matches(module: str, prefixes: tuple[str, ...]) -> bool:
    return any(module == prefix or module.startswith(prefix + ".") for prefix in prefixes)


def translation_module_kind(module: str) -> str:
    """'classic' / 'agent' / 'base'；`module` 是相对 retainpdf_translation 的点分路径。"""
    if _matches(module, BASE_EXCEPTIONS):
        return "base"
    if _matches(module, AGENT_GLUE_MODULES):
        return "agent"
    if _matches(module, CLASSIC_MODULES):
        return "classic"
    return "base"


def _relative(path: Path) -> Path:
    for root in (TRANSLATION_ROOT, TRANSLATION_CLASSIC_PACKAGE_ROOT):
        if path.is_relative_to(root):
            return path.relative_to(root)
    raise ValueError(f"{path} is not inside the translation packages")


def _module_name(path: Path) -> str:
    parts = list(_relative(path).with_suffix("").parts)
    if parts and parts[-1] == "__init__":
        parts = parts[:-1]
    return ".".join(parts)


def _raw_imports(path: Path) -> list[str]:
    names: list[str] = []
    for node in ast.walk(parse_python_file(path)):
        if isinstance(node, ast.Import):
            names += [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            names += [node.module] + [f"{node.module}.{alias.name}" for alias in node.names]
    return names


def _imported_translation_modules(path: Path) -> set[str]:
    """这个文件 import 到的翻译模块（逻辑名，两个包都算）。`from 包 import 子模块` 两样都算，函数里的延迟 import 也算。"""
    found: set[str] = set()
    prefix = PACKAGE + "."
    for name in map(logical_translation_module, _raw_imports(path)):
        if name.startswith(prefix):
            found.add(name[len(prefix):])
    return found


def check_translation_engine_boundaries(errors: list[str]) -> None:
    roots = [root for root in (TRANSLATION_ROOT, TRANSLATION_CLASSIC_PACKAGE_ROOT) if root.exists()]
    for path in dict.fromkeys(path for root in roots for path in scan_py_files(root)):
        module_name = _module_name(path)
        kind = translation_module_kind(module_name)
        in_classic_package = path.is_relative_to(TRANSLATION_CLASSIC_PACKAGE_ROOT)
        # 两个包都有的目录（services/、workflow/scheduling/……）各有一个 __init__，不算放错
        shared_init = path.name == "__init__.py" and all(
            (mount / _relative(path).parent).is_dir() for mount in (TRANSLATION_ROOT, TRANSLATION_CLASSIC_PACKAGE_ROOT)
        )
        if shared_init:
            pass
        elif in_classic_package and kind != "classic" and module_name not in {"", "public"}:
            errors.append(
                f"{rel(path)}: '{module_name}' is not a classic engine module but lives in retainpdf_translation_classic; "
                "move it back to retainpdf_translation or list it in CLASSIC_MODULES (architecture_checks/translation_engines.py)"
            )
        elif not in_classic_package and kind == "classic":
            errors.append(
                f"{rel(path)}: classic engine module '{module_name}' belongs in retainpdf_translation_classic "
                "(backend/translation-classic); see architecture_checks/translation_engines.py"
            )
        if kind == "classic":
            continue
        if not in_classic_package:
            for name in _raw_imports(path):
                logical = logical_translation_module(name)[len(PACKAGE) + 1:]
                if translation_module_kind(logical) == "classic":
                    continue  # 下面按逻辑名报
                if name == TRANSLATION_CLASSIC_IMPORT or name.startswith(TRANSLATION_CLASSIC_IMPORT + "."):
                    errors.append(
                        f"{rel(path)}: the translation base must not import '{name}'; "
                        "load engine code through workflow/engines.py"
                    )
                    break
        imported = _imported_translation_modules(path)
        for module in sorted(imported):
            # `from 模块 import 名字` 两样都收了：父模块已经算普通翻译时只报父模块，一处 import 报一次
            parents = {module.rsplit(".", n)[0] for n in range(1, module.count(".") + 1)}
            if any(parent in imported and translation_module_kind(parent) == "classic" for parent in parents):
                continue
            if translation_module_kind(module) == "classic":
                who = "agent 接线" if kind == "agent" else "翻译底座"
                errors.append(
                    f"{rel(path)}: {who} must not import the classic engine module '{PACKAGE}.{module}'; "
                    "load engine code through workflow/engines.py (see architecture_checks/translation_engines.py)"
                )


__all__ = [
    "AGENT_GLUE_MODULES",
    "BASE_EXCEPTIONS",
    "CLASSIC_MODULES",
    "check_translation_engine_boundaries",
    "translation_module_kind",
]
