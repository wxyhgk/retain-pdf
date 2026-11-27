"""核心只用标准库（入口 __main__.py 例外：它是接线的入口）；系统提示词（含读书工具那段）钉住，改了要看一眼。"""
from __future__ import annotations

import ast
import hashlib
import sys
from importlib import resources
from pathlib import Path

import retainpdf_ask_agent

CORE = Path(retainpdf_ask_agent.__file__).resolve().parent
# 2026-11-25 读书：「会附上位置」改成「通常会附上」、自动取的前后文怎么用；另加有书时的工具那段（材料先看，答案明显在别处才调工具）
# 2026-11-27 改译：建议的整段译文放进 ```译文 代码块（前端回答下的「改这段译文」取它填进编辑框）
PROMPT_SHA256 = {
    "ask_system.txt": "083c199c5ec21f7c6875fcf7fc4ae6a21d5343c356bbeb88f3f41801c5c0bbbc",
    "ask_tools.txt": "e66979f566404debd434b38629b4884d957391e38fd2d7eec422b40300e705b0",
}


def test_core_imports_only_the_standard_library() -> None:
    allowed = set(sys.stdlib_module_names) | {"retainpdf_ask_agent", "__future__"}
    offenders = []
    for path in CORE.rglob("*.py"):
        if path.name == "__main__.py":
            continue
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
                names = [node.module]
            else:
                names = []
            offenders += [f"{path.name}: {name}" for name in names if name.split(".")[0] not in allowed]
    assert offenders == []


def test_system_prompts_are_pinned() -> None:
    for name, digest in PROMPT_SHA256.items():
        raw = resources.files("retainpdf_ask_agent.prompts").joinpath(name).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == digest, name
