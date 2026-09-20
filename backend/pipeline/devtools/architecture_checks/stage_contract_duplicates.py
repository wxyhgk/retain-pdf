from __future__ import annotations

import ast
import re
from pathlib import Path

from devtools.architecture_checks.common import PACKAGE_ROOT
from devtools.architecture_checks.common import display_path
from devtools.architecture_checks.common import parse_python_file
from devtools.architecture_checks.common import read_text
from devtools.architecture_checks.common import scan_py_files


# 阶段契约副本(stage-contract duplicate)的反漂移门禁。
#
# 背景:ocr / translate / render 三个阶段之间禁止互相 import,阶段边界上共享的
# 读写契约因此是**照抄一份文件**(见 render/README.md「阶段边界」、
# docs/ops/planning/architecture_tasks.csv 的 DEC-001)。复制是有意设计,不要合并。
#
# 但复制没有编译期约束:translate 往 build_translation_record 里加一个字段、
# render 那份忘了加,两边照样能 import、照样能跑,只是 render 永远读不到这个新字段,
# 而且不会有任何报错。本检查就是补上这个约束。
#
# 判据(为什么不是比文件全文):
#   有些副本是**故意只抄一部分**的(ocr/document_schema/protected_formula_tokens.py
#   的 "Duplicated formula-only subset of ...";render/semantics/document_reader.py
#   的 "Only the subset consumed by rendering is carried here")。全文 diff 对这些
#   副本必然误报,一旦误报就只能加豁免,豁免加多了门禁就名存实亡。
#   真正会造成静默故障的不是「少抄了一个函数」(少抄了就 ImportError / AttributeError,
#   会立刻炸),而是「两边都有的那个符号,字面量内容悄悄分叉了」——尤其是 dict 的键集合:
#   多一个键少一个键不报错,只是数据丢了。
#   所以判据是:**副本与源文件中同名的顶层符号,其字面量契约内容必须完全一致**;
#   只在一边存在的符号被跳过(合法的部分复制),两边都有的符号则逐字比对。
#
# 比对的「字面量契约内容」分四类(见 _symbol_contract):
#   dict-keys  函数体内/常量里所有 dict 字面量的字符串键集合(build_translation_record
#              的 53 个键就靠这条盯住)
#   members    tuple/list/set/frozenset 字面量的字符串成员集合(封闭词表,如 CONTENT_KINDS)
#   value      标量常量(如 TRANSLATION_MANIFEST_FILE_NAME 这类文件名契约)
#   regex      re.compile(...) 的 pattern 字符串
#
# 不比对 __all__:部分复制的副本本来就导出更少的符号,把 __all__ 纳入必然误报。
# __all__ 是导出清单,不是数据契约;数据契约靠上面四类盯。


DUPLICATE_SCAN_ROOT = PACKAGE_ROOT
PACKAGE_NAME = "retainpdf_pipeline"

# 标记措辞不统一,实际出现过的形态:
#   "# Duplicated from retainpdf_pipeline.ocr.document_schema.classification"
#   "Duplicated from:\n- retainpdf_pipeline.translate.core.payload.manifest\n- ..."
#   "Duplicated normalization from\nretainpdf_pipeline.translate.core.terms.glossary"
#   "Duplicated formula-only subset of\nretainpdf_pipeline.translate.core.payload.formula_protection"
#   "Duplicated constants/helpers from:\n- retainpdf_pipeline.ocr.document_schema.version"
# 统一按「Duplicated ... from / subset of」识别,再从该行起往后收模块名。
# 注意 render/layout/protected_tokens.py 写的是 "duplicated under :mod:`...`"
# (方向相反:它是 facade,说自己的实现被搬去了别处),不是副本,故不匹配。
DUPLICATE_MARKER_RE = re.compile(r"Duplicated\b[^\n]*\b(?:from|subset of)\b")
MODULE_REF_RE = re.compile(rf"{PACKAGE_NAME}(?:\.[A-Za-z_][A-Za-z0-9_]*)+")

CONTRACT_EXEMPT_NAMES = frozenset({"__all__"})


# ---- 门禁自保 ----------------------------------------------------------------
#
# 标记措辞、文件布局、副本写法都可能变。一旦解析悄悄失效,这个检查会变成
# 「扫不到任何东西 -> 没有 error -> 绿灯」,即空操作。下面两道自保让它必须叫出来:
#
# 1) 关键配对点名:这几对是阶段边界上最要命的 schema 副本,必须能被解析到,
#    且指定符号必须真的参与了比对。解析不到 = 报错。
REQUIRED_COMPARISONS: dict[tuple[str, str], frozenset[str]] = {
    (
        "retainpdf_pipeline/render/workflow/translation_records.py",
        f"{PACKAGE_NAME}.translate.core.payload.template_records",
    ): frozenset(
        {
            "build_translation_record",
            "contract_fields_from_item",
            "ocr_continuation_fields",
            "provider_layout_warning_fields",
        }
    ),
    (
        "retainpdf_pipeline/render/workflow/source_page_records.py",
        f"{PACKAGE_NAME}.translate.core.ocr.json_extractor",
    ): frozenset({"_TRANSLATION_METADATA_BRIDGE_KEYS", "DERIVED_STRUCTURE_ROLE_MAP"}),
    (
        "retainpdf_pipeline/render/source/translation_manifest.py",
        f"{PACKAGE_NAME}.translate.core.payload.template_contract",
    ): frozenset({"REQUIRED_CONTRACT_FIELDS"}),
    (
        "retainpdf_pipeline/render/semantics/vocabulary.py",
        f"{PACKAGE_NAME}.ocr.document_schema.vocabulary",
    ): frozenset({"BLOCK_CLASSES", "CONTENT_KINDS"}),
    (
        "retainpdf_pipeline/translate/core/vocabulary.py",
        f"{PACKAGE_NAME}.ocr.document_schema.vocabulary",
    ): frozenset({"BLOCK_CLASSES", "CONTENT_KINDS"}),
}

# 2) 规模下限:整体解析量掉下来就报错。当前实测 29 个副本文件 / 33 条副本->源边 /
#    132 个同名符号 / 584 条契约字符串;下限留出小幅正常增删空间,但挡住「解析崩了」
#    这种数量级坍缩。删副本导致低于下限时,请在这里同步下调并在 PR 里说明。
MIN_MARKED_COPIES = 24
MIN_RESOLVED_EDGES = 27
MIN_COMPARED_SYMBOLS = 105
MIN_COMPARED_CONTRACT_STRINGS = 460


def _prose_blocks(path: Path) -> list[list[str]]:
    """副本标记只认注释/文档字符串,不认 import 行(import 行里也有模块名)。"""
    text = read_text(path)
    tree = ast.parse(text, filename=str(path))
    blocks: list[list[str]] = []
    for node in tree.body:
        # 不用 ast.get_docstring:有的副本把 `from __future__ import annotations`
        # 写在文档字符串之前,那串字符串就不算 docstring 了,但标记还在里面。
        if (
            isinstance(node, ast.Expr)
            and isinstance(node.value, ast.Constant)
            and isinstance(node.value.value, str)
        ):
            blocks.append(node.value.value.splitlines())
    run: list[str] = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if stripped.startswith("#"):
            run.append(stripped.lstrip("#").strip())
            continue
        if run:
            blocks.append(run)
            run = []
    if run:
        blocks.append(run)
    return blocks


def duplicate_source_modules(path: Path) -> list[str] | None:
    """返回该文件声明的源模块列表;没有副本标记时返回 None(空列表 = 标记在但没写源)。"""
    modules: list[str] = []
    marked = False
    for block in _prose_blocks(path):
        start = None
        for index, line in enumerate(block):
            if DUPLICATE_MARKER_RE.search(line):
                start = index
                break
        if start is None:
            continue
        marked = True
        for line in block[start:]:
            for module in MODULE_REF_RE.findall(line):
                if module not in modules:
                    modules.append(module)
    return modules if marked else None


def resolve_module_path(module: str) -> Path | None:
    parts = module.split(".")
    if not parts or parts[0] != PACKAGE_NAME:
        return None
    candidate = DUPLICATE_SCAN_ROOT.joinpath(*parts[1:]).with_suffix(".py")
    if candidate.is_file():
        return candidate
    package_init = DUPLICATE_SCAN_ROOT.joinpath(*parts[1:], "__init__.py")
    if package_init.is_file():
        return package_init
    return None


def _dict_string_keys(node: ast.AST) -> set[str]:
    keys: set[str] = set()
    for sub in ast.walk(node):
        if not isinstance(sub, ast.Dict):
            continue
        for key in sub.keys:
            if isinstance(key, ast.Constant) and isinstance(key.value, str):
                keys.add(key.value)
    return keys


def _string_members(node: ast.AST) -> set[str] | None:
    if isinstance(node, (ast.Tuple, ast.List, ast.Set)):
        values = [
            element.value
            for element in node.elts
            if isinstance(element, ast.Constant) and isinstance(element.value, str)
        ]
        if values and len(values) == len(node.elts):
            return set(values)
        return None
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id in {"frozenset", "set", "tuple", "list"}
        and len(node.args) == 1
    ):
        return _string_members(node.args[0])
    return None


def _scalar_value(node: ast.AST) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, (str, int, float, bool)):
        return repr(node.value)
    return None


def _regex_pattern(node: ast.AST) -> str | None:
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "compile"
        and node.args
        and isinstance(node.args[0], ast.Constant)
        and isinstance(node.args[0].value, str)
    ):
        return node.args[0].value
    return None


def _symbol_contract(value: ast.AST) -> tuple[str, frozenset[str]] | None:
    keys = _dict_string_keys(value)
    if keys:
        return ("dict-keys", frozenset(keys))
    members = _string_members(value)
    if members:
        return ("members", frozenset(members))
    scalar = _scalar_value(value)
    if scalar is not None:
        return ("value", frozenset({scalar}))
    pattern = _regex_pattern(value)
    if pattern is not None:
        return ("regex", frozenset({pattern}))
    return None


def contract_symbols(path: Path) -> dict[str, tuple[str, frozenset[str]]]:
    """顶层符号 -> (契约种类, 契约字符串集合);没有可比字面量的符号不收录。"""
    tree = parse_python_file(path)
    symbols: dict[str, tuple[str, frozenset[str]]] = {}
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            keys = _dict_string_keys(node)
            if keys:
                symbols[node.name] = ("dict-keys", frozenset(keys))
            continue
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            names = [
                target.id
                for target in targets
                if isinstance(target, ast.Name) and target.id not in CONTRACT_EXEMPT_NAMES
            ]
            if not names or node.value is None:
                continue
            contract = _symbol_contract(node.value)
            if contract is None:
                continue
            for name in names:
                symbols[name] = contract
    return symbols


_KIND_LABEL = {
    "dict-keys": "dict 字面量键",
    "members": "词表成员",
    "value": "常量值",
    "regex": "正则 pattern",
}

_WHY = (
    "阶段解耦要求 render/translate/ocr 之间禁止互相 import,这里的一致性只能靠人手抄; "
    "一边加了字段另一边漏改不会报错,只会让下游永远读不到新字段。"
    "两份都要改,或先确认这处分叉确属有意的部分复制再调整门禁。"
)


def check_stage_contract_duplicates(errors: list[str]) -> None:
    marked_copies = 0
    resolved_edges = 0
    compared_symbols = 0
    compared_strings = 0
    seen_required: set[tuple[str, str]] = set()

    for copy_path in scan_py_files(DUPLICATE_SCAN_ROOT):
        modules = duplicate_source_modules(copy_path)
        if modules is None:
            continue
        copy_rel = Path(display_path(copy_path)).as_posix()
        marked_copies += 1
        if not modules:
            errors.append(
                f"{copy_rel}: 带 \"Duplicated ...\" 副本标记但没写出源模块全名; "
                f"请在标记里写明 {PACKAGE_NAME}.xxx.yyy,否则副本无人盯防"
            )
            continue
        copy_symbols = contract_symbols(copy_path)
        for module in modules:
            source_path = resolve_module_path(module)
            if source_path is None:
                errors.append(
                    f"{copy_rel}: 副本标记指向的源模块 \"{module}\" 不存在; "
                    "源文件被移动/改名时请同步更新标记,否则这份副本会脱离门禁"
                )
                continue
            resolved_edges += 1
            source_symbols = contract_symbols(source_path)
            source_rel = Path(display_path(source_path)).as_posix()
            required = REQUIRED_COMPARISONS.get((copy_rel, module))
            if required is not None:
                seen_required.add((copy_rel, module))
            compared_here: set[str] = set()
            for name in sorted(set(copy_symbols) & set(source_symbols)):
                copy_kind, copy_contract = copy_symbols[name]
                source_kind, source_contract = source_symbols[name]
                if copy_kind != source_kind:
                    errors.append(
                        f"{copy_rel}: 阶段契约副本与源 {source_rel} 的 \"{name}\" 形态不同 "
                        f"(副本是{_KIND_LABEL[copy_kind]}, 源是{_KIND_LABEL[source_kind]}); {_WHY}"
                    )
                    continue
                compared_here.add(name)
                compared_symbols += 1
                compared_strings += len(copy_contract)
                if copy_contract == source_contract:
                    continue
                copy_only = sorted(copy_contract - source_contract)
                source_only = sorted(source_contract - copy_contract)
                errors.append(
                    f"{copy_rel}: 阶段契约副本与源 {source_rel} 的 \"{name}\" "
                    f"{_KIND_LABEL[copy_kind]}已分叉; "
                    f"仅副本有: {copy_only or '(无)'}; 仅源有: {source_only or '(无)'}; {_WHY}"
                )
            if required is not None:
                missing = sorted(required - compared_here)
                if missing:
                    errors.append(
                        f"{copy_rel}: 门禁自保失败 — 与源 {source_rel} 的关键符号 {missing} "
                        "没能参与比对(被改名、被删、或不再是可比的字面量)。"
                        "这些符号是阶段边界上最要命的 schema 副本,"
                        "请恢复它们或在 stage_contract_duplicates.py 的 "
                        "REQUIRED_COMPARISONS 中显式更新"
                    )

    missing_pairs = sorted(set(REQUIRED_COMPARISONS) - seen_required)
    for copy_rel, module in missing_pairs:
        errors.append(
            f"{copy_rel}: 门禁自保失败 — 没能解析出指向 \"{module}\" 的副本标记。"
            "副本标记的措辞或文件位置变了而门禁没跟上,"
            "请修正 stage_contract_duplicates.py 的 DUPLICATE_MARKER_RE / REQUIRED_COMPARISONS"
        )

    if marked_copies < MIN_MARKED_COPIES:
        errors.append(
            f"门禁自保失败 — 只扫到 {marked_copies} 个带副本标记的文件(下限 {MIN_MARKED_COPIES}); "
            "标记措辞或扫描根目录变了而门禁没跟上,门禁正在静默空转"
        )
    if resolved_edges < MIN_RESOLVED_EDGES:
        errors.append(
            f"门禁自保失败 — 只解析出 {resolved_edges} 条「副本->源」配对(下限 {MIN_RESOLVED_EDGES})"
        )
    if compared_symbols < MIN_COMPARED_SYMBOLS:
        errors.append(
            f"门禁自保失败 — 只比对了 {compared_symbols} 个同名符号(下限 {MIN_COMPARED_SYMBOLS})"
        )
    if compared_strings < MIN_COMPARED_CONTRACT_STRINGS:
        errors.append(
            f"门禁自保失败 — 只比对了 {compared_strings} 条契约字符串(下限 "
            f"{MIN_COMPARED_CONTRACT_STRINGS}); 字面量提取逻辑可能已失效"
        )


__all__ = [
    "REQUIRED_COMPARISONS",
    "check_stage_contract_duplicates",
    "contract_symbols",
    "duplicate_source_modules",
    "resolve_module_path",
]
