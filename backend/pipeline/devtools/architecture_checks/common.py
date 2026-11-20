from __future__ import annotations

import ast
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
BACKEND_ROOT = REPO_ROOT / "backend"
SCRIPTS_ROOT = BACKEND_ROOT / "pipeline"
PACKAGE_ROOT = SCRIPTS_ROOT / "retainpdf_pipeline"
# 翻译库是独立包 retainpdf-translation（backend/translation），和流水线并列；
# 流水线里的 retainpdf_pipeline/translate/ 只剩 worker 外壳。
TRANSLATION_PACKAGE_ROOT = BACKEND_ROOT / "translation" / "retainpdf_translation"
# 普通翻译引擎 retainpdf-translation-classic（2026-11-20 从翻译包拆出来，目录结构和翻译包一样）。架构检查把它当成翻译包
# 挂进来的一部分（和 rust_api 的 DOMAIN_MOUNTS 一个意思）：
# - 扫翻译包或它下面的目录时，普通翻译包里同名的目录一起扫（scan_py_files）；
# - import 名按逻辑名算：retainpdf_translation_classic.X 记成 retainpdf_translation.X（imported_modules 等）；
# - 规则里照旧写 retainpdf_translation.X 和相对翻译包的路径（translation_relative 两个包都认）。
# 哪个模块该放哪个包，由 translation_engines.py 卡。
TRANSLATION_CLASSIC_PACKAGE_ROOT = BACKEND_ROOT / "translation-classic" / "retainpdf_translation_classic"
TRANSLATION_IMPORT = "retainpdf_translation"
TRANSLATION_CLASSIC_IMPORT = "retainpdf_translation_classic"


class ArchitectureCheckSyntaxError(Exception):
    def __init__(self, path: Path, error: SyntaxError) -> None:
        self.path = path
        self.error = error
        location = f"{error.lineno}:{error.offset}" if error.lineno else "unknown"
        super().__init__(
            f"{display_path(path)}: syntax error while scanning imports at {location}: {error.msg}"
        )


def logical_translation_module(module: str) -> str:
    """retainpdf_translation_classic.X → retainpdf_translation.X；别的原样返回。"""
    if module == TRANSLATION_CLASSIC_IMPORT or module.startswith(TRANSLATION_CLASSIC_IMPORT + "."):
        return TRANSLATION_IMPORT + module[len(TRANSLATION_CLASSIC_IMPORT):]
    return module


def translation_relative(path: Path) -> Path:
    """相对翻译包的路径；普通翻译包里的文件也按翻译包算。两个包外的路径抛 ValueError（和 relative_to 一样）。"""
    for root in (TRANSLATION_PACKAGE_ROOT, TRANSLATION_CLASSIC_PACKAGE_ROOT):
        if path.is_relative_to(root):
            return path.relative_to(root)
    raise ValueError(f"{path} is not inside the translation packages")


def translation_mounts(root: Path) -> list[Path]:
    """`root` 在翻译包里时，连同普通翻译包里同名的目录（存在的话）；不在翻译包里就只有它自己。"""
    roots = [root]
    if root.is_relative_to(TRANSLATION_PACKAGE_ROOT):
        mirror = TRANSLATION_CLASSIC_PACKAGE_ROOT / root.relative_to(TRANSLATION_PACKAGE_ROOT)
        if mirror.exists():
            roots.append(mirror)
    return roots


def scan_py_files(root: Path) -> list[Path]:
    paths: list[Path] = []
    for mount in translation_mounts(root):
        for path in mount.rglob("*.py"):
            if not path.is_file():
                continue
            rel_parts = path.relative_to(mount).parts
            if "__pycache__" in rel_parts or ".ipynb_checkpoints" in rel_parts:
                continue
            paths.append(path)
    return sorted(paths)


def rel(path: Path) -> Path:
    """流水线里的文件相对 backend/pipeline；流水线外（翻译包等）的相对 backend/。"""
    try:
        return path.relative_to(SCRIPTS_ROOT)
    except ValueError:
        return path.relative_to(BACKEND_ROOT)


def display_path(path: Path) -> Path:
    try:
        return rel(path)
    except ValueError:
        return path


# 各条规则各自读、各自解析同一批文件：一次检查里每个文件被 ast.parse 约 10 遍（2026-10-30 实测 964 个文件
# 解析 9708 次）。按（路径、修改时间、大小）缓存：测试里改写过的临时文件会重新读。缓存的语法树只读，不要改它。
_TEXT_CACHE: dict[tuple, str] = {}
_TREE_CACHE: dict[tuple, ast.AST] = {}
_IMPORTS_CACHE: dict[tuple, tuple[str, ...]] = {}
_FROM_SYMBOLS_CACHE: dict[tuple, tuple[tuple[str, str], ...]] = {}


def _cache_key(path: Path) -> tuple:
    stat = path.stat()
    return (str(path.resolve()), stat.st_mtime_ns, stat.st_size)


def read_text(path: Path) -> str:
    key = _cache_key(path)
    if key not in _TEXT_CACHE:
        _TEXT_CACHE[key] = path.read_text(encoding="utf-8")
    return _TEXT_CACHE[key]


def parse_python_file(path: Path) -> ast.AST:
    key = _cache_key(path)
    if key not in _TREE_CACHE:
        try:
            _TREE_CACHE[key] = ast.parse(read_text(path), filename=str(path))
        except SyntaxError as exc:
            raise ArchitectureCheckSyntaxError(path, exc) from exc
    return _TREE_CACHE[key]


def imported_modules(path: Path) -> list[str]:
    key = _cache_key(path)
    if key not in _IMPORTS_CACHE:
        modules: list[str] = []
        for node in ast.walk(parse_python_file(path)):
            if isinstance(node, ast.Import):
                modules.extend(logical_translation_module(alias.name) for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                modules.append(logical_translation_module(node.module))
        _IMPORTS_CACHE[key] = tuple(modules)
    return list(_IMPORTS_CACHE[key])


def imported_from_symbols(path: Path) -> list[tuple[str, str]]:
    key = _cache_key(path)
    if key not in _FROM_SYMBOLS_CACHE:
        symbols: list[tuple[str, str]] = []
        for node in ast.walk(parse_python_file(path)):
            if not isinstance(node, ast.ImportFrom) or not node.module:
                continue
            for alias in node.names:
                symbols.append((logical_translation_module(node.module), alias.name))
        _FROM_SYMBOLS_CACHE[key] = tuple(symbols)
    return list(_FROM_SYMBOLS_CACHE[key])


def module_allowed(module: str, allowed_prefixes: tuple[str, ...]) -> bool:
    return any(module == prefix or module.startswith(f"{prefix}.") for prefix in allowed_prefixes)


__all__ = [
    "ArchitectureCheckSyntaxError",
    "BACKEND_ROOT",
    "PACKAGE_ROOT",
    "REPO_ROOT",
    "SCRIPTS_ROOT",
    "TRANSLATION_CLASSIC_IMPORT",
    "TRANSLATION_CLASSIC_PACKAGE_ROOT",
    "TRANSLATION_IMPORT",
    "TRANSLATION_PACKAGE_ROOT",
    "logical_translation_module",
    "translation_mounts",
    "translation_relative",
    "imported_from_symbols",
    "imported_modules",
    "module_allowed",
    "parse_python_file",
    "read_text",
    "display_path",
    "rel",
    "scan_py_files",
]
