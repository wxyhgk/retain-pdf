"""桌面安装包自带的 Python 能不能跑起来——在打好的包里用自带解释器跑（desktop_python_bundle.py check 调它）。

只用标准库，参数：--members <名字,名字,...>（后端工作区成员的包名）。查的是装进去的文件本身：

1. 工作区每个包都装了；它声明的依赖（不算 extra）也都装了。
2. 每个包的每个模块都能 import（缺包、缺数据文件在 import 时就会报）。
3. 翻译引擎登记表里按「模块:函数」字符串加载的入口都能加载
   （retainpdf-translation-classic / -agent 就是因为只按字符串加载、没写进依赖，2026-11-22 的包里漏了）。
4. 源码里所有 import（含函数里面、用到时才 import 的）指向的第三方库都装了；
   确实可选的写进 OPTIONAL_IMPORTS 并写明理由。

全部通过打印 desktop_python_check=ok，退出码 0；否则逐条列出问题，退出码 1。
"""
from __future__ import annotations

import argparse
import ast
import importlib
import importlib.metadata as metadata
import importlib.util
import pkgutil
import re
import sys
import traceback

# 源码里 import 了、但安装包里可以没有的第三方库：只在 try 里用，没有就跳过那项功能。
OPTIONAL_IMPORTS = {
    "fontTools": (
        "foundation/config/fonts.py 读字体家族名时先试 fontTools，没装就退回内置的名字表；"
        "render/output/rpr_fit/reader_layout.py 给阅读页 HTML 页按书切字体子集（retainpdf-pipeline[reader-fonts]），没装就不切"
    ),
    "brotli": (
        "render/output/rpr_fit/reader_layout.py 把字体子集转 woff2 要它（retainpdf-pipeline[reader-fonts]），"
        "没装就不切字体、清单的 fonts 是空的，HTML 页退回本机字体"
    ),
    "rapidocr": (
        "ocr/document_schema/formula_number_ocr.py 扫描件的公式编号截图识别（retainpdf-pipeline[scan-ocr]），"
        "没装就跳过这一步、统计里记 ocr_engine_unavailable"
    ),
}

ENGINE_REGISTRY = "retainpdf_translation.workflow.engines"


def requirement_name(requirement: str) -> str | None:
    """Requires-Dist 一行 → 包名；只在某个 extra 下才要的返回 None。"""
    if re.search(r";\s*.*\bextra\s*==", requirement):
        return None
    match = re.match(r"\s*([A-Za-z0-9][A-Za-z0-9._-]*)", requirement)
    return match.group(1) if match else None


def top_level_modules(dist: metadata.Distribution) -> list[str]:
    text = dist.read_text("top_level.txt")
    if text:
        return sorted({line.strip() for line in text.splitlines() if line.strip()})
    tops = set()
    for file in dist.files or []:
        parts = file.parts
        if parts and parts[0].endswith((".dist-info", ".egg-info")) or not str(file).endswith(".py"):
            continue
        tops.add(parts[0][:-3] if len(parts) == 1 else parts[0])
    return sorted(tops)


def imported_tops(source: str) -> set[str]:
    tops = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            tops.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            tops.add(node.module.split(".")[0])
    return tops


def main(argv: list[str] | None = None) -> int:
    # Windows 构建机的控制台是 cp1252，打印中文会 UnicodeEncodeError（2026-11-22 Desktop Python Bundle 第一次跑就红在这）。
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("--members", required=True, help="逗号分隔的工作区包名")
    args = parser.parse_args(argv)
    members = [name.strip() for name in args.members.split(",") if name.strip()]
    problems: list[str] = []

    dists: dict[str, metadata.Distribution] = {}
    for name in members:
        try:
            dists[name] = metadata.distribution(name)
        except metadata.PackageNotFoundError:
            problems.append(f"没装：{name}")
    for name, dist in dists.items():
        for requirement in dist.requires or []:
            dep = requirement_name(requirement)
            if not dep:
                continue
            try:
                metadata.distribution(dep)
            except metadata.PackageNotFoundError:
                problems.append(f"{name} 声明的依赖没装：{dep}")

    local_tops = {top for dist in dists.values() for top in top_level_modules(dist)}
    module_count = 0
    for top in sorted(local_tops):
        try:
            package = importlib.import_module(top)
        except BaseException as exc:  # noqa: BLE001
            problems.append(f"import {top} 失败：{type(exc).__name__}: {exc}")
            continue
        if not hasattr(package, "__path__"):
            module_count += 1
            continue
        failed_walk: list[str] = []
        for info in pkgutil.walk_packages(package.__path__, prefix=f"{top}.", onerror=failed_walk.append):
            if ".tests" in info.name or info.name.endswith(".__main__"):
                continue
            module_count += 1
            try:
                importlib.import_module(info.name)
            except BaseException as exc:  # noqa: BLE001
                problems.append(f"import {info.name} 失败：{type(exc).__name__}: {exc}")
        problems.extend(f"遍历 {name} 失败" for name in failed_walk)

    engine_refs = 0
    try:
        engines = importlib.import_module(ENGINE_REGISTRY)
        registry = getattr(engines, "ENGINES", None) or {}
        names = list(registry) if isinstance(registry, dict) else []
        if not names:
            problems.append(f"{ENGINE_REGISTRY} 里没找到 ENGINES 登记表")
        for name in names:
            spec = engines.engine_spec(name)
            for field, ref in vars(spec).items():
                if isinstance(ref, str) and ":" in ref:
                    engine_refs += 1
                    try:
                        engines.load(ref)
                    except BaseException as exc:  # noqa: BLE001
                        problems.append(f"翻译引擎 {name}.{field} = {ref} 加载失败：{type(exc).__name__}: {exc}")
    except BaseException as exc:  # noqa: BLE001
        problems.append(f"读翻译引擎登记表失败：{type(exc).__name__}: {exc}\n{traceback.format_exc()}")

    stdlib = set(sys.stdlib_module_names) | {"__future__"}
    third_party: dict[str, str] = {}
    for name, dist in dists.items():
        for file in dist.files or []:
            if not str(file).endswith(".py") or "/tests/" in f"/{file}":
                continue
            try:
                source = file.read_text(encoding="utf-8")
                tops = imported_tops(source)
            except Exception:  # noqa: BLE001
                continue
            for top in tops - stdlib - local_tops:
                third_party.setdefault(top, f"{name}:{file}")
    for top, where in sorted(third_party.items()):
        if top in OPTIONAL_IMPORTS:
            continue
        if importlib.util.find_spec(top) is None:
            problems.append(f"第三方库没装：{top}（{where} 用到）")

    print(
        f"desktop python check: {len(dists)}/{len(members)} 个工作区包，{module_count} 个模块，"
        f"{engine_refs} 个翻译引擎入口，第三方库 {sorted(third_party)}"
    )
    if problems:
        print(f"desktop_python_check=failed（{len(problems)} 处）")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print("desktop_python_check=ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
