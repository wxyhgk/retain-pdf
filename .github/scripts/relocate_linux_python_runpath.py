"""Linux 桌面包自带 Python 的动态库搜索路径（RUNPATH）改成相对自己的位置，并检查改干净了。

Linux 包里的 Python 是从构建机 actions/setup-python 的工具缓存整个拷来的。那份 Python 编译时写死了
`-Wl,--rpath=/opt/hostedtoolcache/Python/<版本>/x64/lib`：`bin/python3` 只是个 18KB 的启动器，
真正的解释器在 `lib/libpython3.11.so.1.0`，按这个绝对路径去找。构建机上这个目录在，检查全过；用户机器上
没有，动态链接器就去系统里找 libpython3.11：找不到直接起不来，找到一份旧的就是 #162
（Ubuntu 26.04，`_ssl` 报 undefined symbol: _PyModule_Add——包里的 lib-dynload 是 3.11.18 的，
系统那份 libpython 更旧）。

2026-11-23 起包里的 Python 换成 python-build-standalone（解释器静态带着 libpython，RUNPATH 本来就是
`$ORIGIN`），这个脚本留作兜底：relocate 去掉新版本万一带进来的绝对路径，check 照旧把关。

  relocate：把指向原安装目录的 RUNPATH 换成 `$ORIGIN/...`（启动器 → `$ORIGIN/../lib`），
            其他写死的绝对路径去掉；要在用包里的 python3 跑任何东西之前做。
  check：   包里每个 ELF 的 RUNPATH/RPATH 只许是 `$ORIGIN` 开头；再清掉 LD_LIBRARY_PATH
            跑一次包里的 python3，看实际载入的 libpython 是不是包里那份、ssl 等模块能不能导入。

读写 RUNPATH 用 patchelf（构建机上 apt 装）。
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


ELF_MAGIC = b"\x7fELF"
ORIGIN_PREFIXES = ("$ORIGIN", "${ORIGIN}")
# 跑包里的 python3 时要导入的标准库扩展：_ssl 就是 #162 报错的那个，其余同样只靠 libpython 的符号。
RUNTIME_IMPORTS = ("ssl", "hashlib", "ctypes", "sqlite3", "lzma", "bz2", "zlib", "decimal", "json")
LOADED_LIBPYTHON_PROBE = """
import sys
for name in sys.argv[1:]:
    __import__(name)
paths = set()
with open("/proc/self/maps", encoding="utf-8") as maps:
    for line in maps:
        parts = line.split(None, 5)
        if len(parts) == 6 and "libpython" in parts[5]:
            paths.add(parts[5].strip())
for path in sorted(paths):
    print(path)
"""


def is_origin_relative(entry: str) -> bool:
    return entry.startswith(ORIGIN_PREFIXES)


def origin_path(target: Path, file_dir: Path) -> str:
    relative = os.path.relpath(target, file_dir)
    return "$ORIGIN" if relative == "." else f"$ORIGIN/{relative}"


def relocated_entries(
    entries: list[str],
    *,
    original_roots: list[Path],
    bundle_root: Path,
    file_path: Path,
) -> list[str]:
    """一个 ELF 新的 RUNPATH 条目：原安装目录下的路径换成相对本文件的 `$ORIGIN/...`，
    已经是 `$ORIGIN` 的保留，其他绝对路径（构建机上的别的目录）去掉。"""
    result: list[str] = []
    for entry in entries:
        if not entry:
            continue
        new_entry: str | None = None
        if is_origin_relative(entry):
            new_entry = entry
        else:
            entry_path = Path(os.path.normpath(entry))
            for root in original_roots:
                if entry_path == root or root in entry_path.parents:
                    target = bundle_root / entry_path.relative_to(root)
                    new_entry = origin_path(target, file_path.parent)
                    break
        if new_entry is not None and new_entry not in result:
            result.append(new_entry)
    return result


def host_specific_entries(entries: list[str]) -> list[str]:
    return [entry for entry in entries if entry and not is_origin_relative(entry)]


def iter_elf_files(root: Path):
    for directory, _dirs, files in os.walk(root):
        for name in sorted(files):
            path = Path(directory) / name
            if path.is_symlink() or not path.is_file():
                continue
            try:
                with path.open("rb") as handle:
                    if handle.read(4) != ELF_MAGIC:
                        continue
            except OSError:
                continue
            yield path


def read_runpath(path: Path) -> list[str]:
    completed = subprocess.run(
        ["patchelf", "--print-rpath", str(path)],
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        # 静态链接、没有 .dynamic 的 ELF：没有 RUNPATH 可言。
        return []
    value = completed.stdout.strip()
    return value.split(":") if value else []


def write_runpath(path: Path, entries: list[str]) -> None:
    mode = path.stat().st_mode
    if not mode & 0o200:
        path.chmod(mode | 0o200)
    try:
        if entries:
            command = ["patchelf", "--set-rpath", ":".join(entries), str(path)]
        else:
            command = ["patchelf", "--remove-rpath", str(path)]
        subprocess.run(command, check=True)
    finally:
        path.chmod(mode)


def relocate(bundle_root: Path, original_root: Path) -> int:
    bundle_root = bundle_root.resolve()
    original_roots = [Path(os.path.normpath(original_root))]
    resolved = original_root.resolve()
    if resolved not in original_roots:
        original_roots.append(resolved)
    changed = 0
    for path in iter_elf_files(bundle_root):
        entries = read_runpath(path)
        if not entries:
            continue
        new_entries = relocated_entries(
            entries,
            original_roots=original_roots,
            bundle_root=bundle_root,
            file_path=path,
        )
        if new_entries == entries:
            continue
        write_runpath(path, new_entries)
        changed += 1
        print(f"runpath {path.relative_to(bundle_root)}: {':'.join(entries)} -> {':'.join(new_entries) or '<removed>'}")
    print(f"relocated_runpaths={changed}")
    return 0


def check(bundle_root: Path, python: Path | None) -> int:
    bundle_root = bundle_root.resolve()
    problems: list[str] = []
    elf_count = 0
    for path in iter_elf_files(bundle_root):
        elf_count += 1
        bad = host_specific_entries(read_runpath(path))
        if bad:
            problems.append(f"{path.relative_to(bundle_root)}: RUNPATH {':'.join(bad)}")
    print(f"checked_elf_files={elf_count}")
    if python is not None:
        env = {key: value for key, value in os.environ.items()
               if key not in {"LD_LIBRARY_PATH", "LD_PRELOAD", "PYTHONHOME", "PYTHONPATH"}}
        completed = subprocess.run(
            [str(python), "-I", "-c", LOADED_LIBPYTHON_PROBE, *RUNTIME_IMPORTS],
            capture_output=True,
            text=True,
            env=env,
        )
        if completed.returncode != 0:
            problems.append(
                f"{python} 清掉 LD_LIBRARY_PATH 后起不来或导入失败（exit {completed.returncode}）：\n"
                f"{completed.stdout}{completed.stderr}".rstrip()
            )
        else:
            loaded = [line for line in completed.stdout.splitlines() if line.strip()]
            print("loaded_libpython=" + (", ".join(loaded) or "<static>"))
            for item in loaded:
                resolved = Path(item).resolve()
                if bundle_root != resolved and bundle_root not in resolved.parents:
                    problems.append(f"{python} 载入的是包外的 libpython：{item}")
    if problems:
        print("自带 Python 还依赖构建机上的路径，装到用户机器上会找错或找不到 libpython（#162）：", file=sys.stderr)
        for problem in problems:
            print(f"  {problem}", file=sys.stderr)
        return 1
    print("bundled_python_runpath_check=ok")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    relocate_parser = sub.add_parser("relocate")
    relocate_parser.add_argument("--bundle-root", type=Path, required=True)
    relocate_parser.add_argument("--original-root", type=Path, required=True,
                                 help="拷贝来源：工具缓存里这份 Python 的安装目录（sys.prefix）")
    check_parser = sub.add_parser("check")
    check_parser.add_argument("--bundle-root", type=Path, required=True)
    check_parser.add_argument("--python", type=Path, help="包里的 python3；给了就清掉 LD_LIBRARY_PATH 实际跑一次")
    args = parser.parse_args()
    if args.command == "relocate":
        return relocate(args.bundle_root, args.original_root)
    return check(args.bundle_root, args.python)


if __name__ == "__main__":
    raise SystemExit(main())
