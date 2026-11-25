"""核心只用标准库；提示词从翻译包搬来时一字没改（版本号、缓存键因此不变，已有的表格缓存照样命中）；
定结构（G4）的提示词也钉着，改了要连同 STRUCTURE_PROMPT_VERSION 一起改（缓存键里有它）。"""
from __future__ import annotations

import ast
import hashlib
import sys
from importlib import resources
from pathlib import Path

import retainpdf_table_agent
from retainpdf_table_agent import PROMPT_VERSION
from retainpdf_table_agent import STRUCTURE_PROMPT_VERSION
from retainpdf_table_agent.prompts import load_prompt

CORE = Path(retainpdf_table_agent.__file__).resolve().parent
# 2026-11-25 搬家前翻译包里 table_translate_system.txt 的 sha256。改提示词要连同 PROMPT_VERSION 一起改（缓存键里有它）。
PROMPT_SHA256 = "ec2cfb2499ff1989f997d8f1863f7df5f4aa17f3833917ddcf55d692d7ac92b4"
# 2026-11-25 定结构提示词（table_structure.v1）
STRUCTURE_PROMPT_SHA256 = "3ff086e591b8b572f9856138b49534b8c314bfc6ab5d7aa2be3ef404dc41454b"


def test_core_imports_only_the_standard_library() -> None:
    allowed = set(sys.stdlib_module_names) | {"retainpdf_table_agent", "__future__"}
    offenders = []
    for path in CORE.rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
                names = [node.module]
            else:
                names = []
            offenders += [f"{path.name}: {name}" for name in names if name.split(".")[0] not in allowed]
    assert offenders == []


def test_prompt_moved_without_changes() -> None:
    raw = resources.files("retainpdf_table_agent.prompts").joinpath("table_translate_system.txt").read_bytes()
    assert hashlib.sha256(raw).hexdigest() == PROMPT_SHA256
    assert PROMPT_VERSION == "table_translate.v1"
    assert load_prompt("table_translate_system.txt") == raw.decode("utf-8").strip()


def test_structure_prompt_is_pinned_with_its_version() -> None:
    raw = resources.files("retainpdf_table_agent.prompts").joinpath("table_structure_system.txt").read_bytes()
    assert hashlib.sha256(raw).hexdigest() == STRUCTURE_PROMPT_SHA256
    assert STRUCTURE_PROMPT_VERSION == "table_structure.v1"
