"""查 Linux 桌面包里每个 ELF 要的 glibc 版本，超过基线就失败。

一个 ELF 要的 glibc 版本写在 `.gnu.version_r`（verneed）里：链接时用到的每个 glibc 符号带一个版本，
比如 `GLIBC_2.38`；系统的 glibc 比它旧，动态链接器直接拒绝启动（`version 'GLIBC_2.38' not found`）。
构建机是哪一代系统，编出来的东西就要哪一代的 glibc：v2026.11.22 的包在 ubuntu-latest（26.04 一代）上打，
libpython 要 2.38、termios 要 2.42、rust_api 要 2.39，Ubuntu 22.04、Debian 12 装上就起不来（#162 之后查出来的）。

这里不调 readelf，直接按 ELF 格式读 verneed（只用标准库），本机和构建机都能跑，也方便单测。
静态链接的（比如 musl 版 typst）没有 verneed，不要求任何 glibc 版本。

`--self-contained DIR`（可给多次）另查一件事：DIR 下的 ELF 依赖的库（DT_NEEDED）只许是 glibc 自己的几个库、
libgcc_s / libstdc++，或者 DIR 里自带的文件。自带 Python 以前的 lib-dynload 要系统的 libssl.so.3、libffi.so.8、
libsqlite3.so.0……构建机上都有、ldd 查不出来，用户机器上缺一个就 import 失败；这条让它在构建时就红。

用法：
  check_linux_glibc_baseline.py --max 2.28 [--self-contained <目录>] <目录或文件>...
"""
from __future__ import annotations

import argparse
import os
import struct
import sys
from dataclasses import dataclass, field
from pathlib import Path


ELF_MAGIC = b"\x7fELF"
SHT_DYNAMIC = 6
SHT_GNU_VERNEED = 0x6FFFFFFE
DT_NULL = 0
DT_NEEDED = 1
VERSION_PREFIX = "GLIBC_"
# 自带的东西可以直接依赖、每个 glibc 系统都有的库：glibc 本身拆出来的几个，GCC 运行时，加上 zlib。
# manylinux 规范允许轮子依赖这些、不打进轮子：Pillow 10.4、pikepdf 的轮子就要系统的 libz.so.1。
# Debian/Ubuntu 上 zlib1g、libgcc-s1、libstdc++6 是 dpkg/apt 自己的依赖，装了系统就一定有。
SYSTEM_LIBRARIES = frozenset({
    "libc.so.6", "libm.so.6", "libpthread.so.0", "libdl.so.2", "librt.so.1", "libutil.so.1",
    "libresolv.so.2", "libnsl.so.1", "ld-linux-x86-64.so.2", "libgcc_s.so.1", "libstdc++.so.6",
    "libz.so.1",
})


class ElfError(ValueError):
    pass


@dataclass
class ElfVersions:
    # 依赖的库名（verneed 的 vn_file，如 libc.so.6）→ 这个库上要的版本名（GLIBC_2.17 ……）
    needs: dict[str, list[str]] = field(default_factory=dict)
    # DT_NEEDED：动态链接时要载入的库
    needed: list[str] = field(default_factory=list)

    def glibc_versions(self) -> list[tuple[int, ...]]:
        found = set()
        for names in self.needs.values():
            for name in names:
                parsed = parse_glibc_version(name)
                if parsed is not None:
                    found.add(parsed)
        return sorted(found)

    def max_glibc(self) -> tuple[int, ...] | None:
        versions = self.glibc_versions()
        return versions[-1] if versions else None


def parse_glibc_version(name: str) -> tuple[int, ...] | None:
    """`GLIBC_2.28` → (2, 28)；`GLIBC_PRIVATE`、`GLIBCXX_3.4` 之类不算。"""
    if not name.startswith(VERSION_PREFIX):
        return None
    rest = name[len(VERSION_PREFIX):]
    parts = rest.split(".")
    if not parts or not all(part.isdigit() for part in parts):
        return None
    return tuple(int(part) for part in parts)


def format_version(version: tuple[int, ...]) -> str:
    return ".".join(str(part) for part in version)


def parse_baseline(text: str) -> tuple[int, ...]:
    parsed = parse_glibc_version(text if text.startswith(VERSION_PREFIX) else VERSION_PREFIX + text)
    if parsed is None:
        raise argparse.ArgumentTypeError(f"不是 glibc 版本号：{text}")
    return parsed


def _c_string(data: bytes, offset: int) -> str:
    end = data.find(b"\0", offset)
    if offset < 0 or offset >= len(data) or end < 0:
        raise ElfError(f"字符串偏移越界：{offset}")
    return data[offset:end].decode("utf-8", "replace")


def read_elf_versions(data: bytes) -> ElfVersions:
    """从整个 ELF 文件内容里读出 verneed。不是 ELF 抛 ElfError。"""
    if data[:4] != ELF_MAGIC:
        raise ElfError("不是 ELF 文件")
    if len(data) < 0x40:
        raise ElfError("ELF 头不完整")
    elf_class, elf_data = data[4], data[5]
    if elf_data == 1:
        endian = "<"
    elif elf_data == 2:
        endian = ">"
    else:
        raise ElfError(f"未知字节序：{elf_data}")
    if elf_class == 2:
        shoff = struct.unpack_from(endian + "Q", data, 0x28)[0]
        shentsize, shnum = struct.unpack_from(endian + "HH", data, 0x3A)
        section_format = endian + "IIQQQQIIQQ"
    elif elf_class == 1:
        shoff = struct.unpack_from(endian + "I", data, 0x20)[0]
        shentsize, shnum = struct.unpack_from(endian + "HH", data, 0x2E)
        section_format = endian + "IIIIIIIIII"
    else:
        raise ElfError(f"未知 ELF 类别：{elf_class}")
    if shoff == 0 or shnum == 0:
        # 没有节头表（比如 sstrip 过的）就读不到 verneed；当成读不出来，交给调用方报错，不要当成“没要求”。
        raise ElfError("没有节头表，读不出 verneed")
    if shentsize < struct.calcsize(section_format) or shoff + shentsize * shnum > len(data):
        raise ElfError("节头表越界")

    sections = []
    for index in range(shnum):
        fields = struct.unpack_from(section_format, data, shoff + index * shentsize)
        # name, type, flags, addr, offset, size, link, info, addralign, entsize
        sections.append(fields)

    dynamic_format = endian + ("qQ" if elf_class == 2 else "iI")
    dynamic_size = struct.calcsize(dynamic_format)
    result = ElfVersions()
    for _name, sh_type, _flags, _addr, offset, size, link, info, _align, _entsize in sections:
        if sh_type not in (SHT_GNU_VERNEED, SHT_DYNAMIC):
            continue
        if link >= len(sections):
            raise ElfError("字符串表编号越界")
        str_offset, str_size = sections[link][4], sections[link][5]
        strtab = data[str_offset:str_offset + str_size]
        if offset + size > len(data):
            raise ElfError("节内容越界")
        if sh_type == SHT_DYNAMIC:
            for cursor in range(offset, offset + size - dynamic_size + 1, dynamic_size):
                tag, value = struct.unpack_from(dynamic_format, data, cursor)
                if tag == DT_NULL:
                    break
                if tag == DT_NEEDED:
                    result.needed.append(_c_string(strtab, value))
            continue
        cursor = offset
        for _ in range(info):
            if cursor + 16 > offset + size:
                raise ElfError("verneed 越界")
            _vn_version, vn_cnt, vn_file, vn_aux, vn_next = struct.unpack_from(endian + "HHIII", data, cursor)
            library = _c_string(strtab, vn_file)
            names = result.needs.setdefault(library, [])
            aux = cursor + vn_aux
            for _ in range(vn_cnt):
                if aux + 16 > offset + size:
                    raise ElfError("vernaux 越界")
                _hash, _flags, _other, vna_name, vna_next = struct.unpack_from(endian + "IHHII", data, aux)
                names.append(_c_string(strtab, vna_name))
                if vna_next == 0:
                    break
                aux += vna_next
            if vn_next == 0:
                break
            cursor += vn_next
    return result


def iter_elf_files(paths: list[Path]):
    for root in paths:
        if root.is_file() and not root.is_symlink():
            candidates = [root]
        else:
            candidates = []
            for directory, _dirs, files in os.walk(root):
                for name in sorted(files):
                    candidates.append(Path(directory) / name)
        for path in candidates:
            if path.is_symlink() or not path.is_file():
                continue
            try:
                with path.open("rb") as handle:
                    if handle.read(4) != ELF_MAGIC:
                        continue
            except OSError:
                continue
            yield path


def foreign_libraries(needed: list[str], shipped: set[str]) -> list[str]:
    """DT_NEEDED 里既不是系统必有的库、也不是自带文件的那些。"""
    return [name for name in needed if name not in SYSTEM_LIBRARIES and Path(name).name not in shipped]


def _within(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def check(
    paths: list[Path],
    baseline: tuple[int, ...],
    *,
    top: int = 10,
    self_contained: list[Path] | None = None,
) -> int:
    rows: list[tuple[tuple[int, ...], Path]] = []
    unreadable: list[str] = []
    elf_count = 0
    contained_roots = [root.resolve() for root in (self_contained or [])]
    for root in contained_roots:
        if not root.is_dir():
            print(f"--self-contained 不是目录：{root}", file=sys.stderr)
            return 1
    shipped = {
        root: {name for _dir, _sub, files in os.walk(root) for name in files}
        for root in contained_roots
    }
    foreign: list[str] = []
    seen: set[Path] = set()
    for path in iter_elf_files(paths + contained_roots):
        # --self-contained 的目录通常也在要查的目录里，同一个文件只查一次。
        if path.resolve() in seen:
            continue
        seen.add(path.resolve())
        elf_count += 1
        try:
            versions = read_elf_versions(path.read_bytes())
        except (ElfError, struct.error) as error:
            unreadable.append(f"{path}: {error}")
            continue
        resolved = path.resolve()
        for root in contained_roots:
            if _within(resolved, root):
                missing = foreign_libraries(versions.needed, shipped[root])
                if missing:
                    foreign.append(f"{path}: {', '.join(missing)}")
                break
        highest = versions.max_glibc()
        if highest is not None:
            rows.append((highest, path))
    rows.sort(key=lambda row: (row[0], str(row[1])), reverse=True)
    too_new = [(version, path) for version, path in rows if version > baseline]

    print(f"checked_elf_files={elf_count} baseline=GLIBC_{format_version(baseline)}")
    for version, path in rows[:top]:
        print(f"  GLIBC_{format_version(version)}  {path}")
    if rows:
        print(f"max_glibc=GLIBC_{format_version(rows[0][0])}")
    else:
        print("max_glibc=<none>")

    if elf_count == 0:
        print("一个 ELF 都没找到，路径给错了？", file=sys.stderr)
        return 1
    if unreadable:
        print("读不出 glibc 版本要求的 ELF：", file=sys.stderr)
        for line in unreadable:
            print(f"  {line}", file=sys.stderr)
        return 1
    failed = False
    if foreign:
        print(
            "这些自带的文件要用系统里的库（不是 glibc、也不在包里），用户机器上缺了就载入失败：",
            file=sys.stderr,
        )
        for line in foreign:
            print(f"  {line}", file=sys.stderr)
        failed = True
    if too_new:
        print(
            f"这些文件要的 glibc 比基线 GLIBC_{format_version(baseline)} 新，"
            "旧一点的发行版装上就起不来（version 'GLIBC_x.y' not found）：",
            file=sys.stderr,
        )
        for version, path in too_new:
            print(f"  GLIBC_{format_version(version)}  {path}", file=sys.stderr)
        failed = True
    if failed:
        return 1
    if contained_roots:
        print("self_contained_check=ok")
    print("glibc_baseline_check=ok")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--max", dest="baseline", type=parse_baseline, required=True,
                        help="允许的最高 glibc 版本，例如 2.28")
    parser.add_argument("--top", type=int, default=10, help="列出要求最高的前几个文件")
    parser.add_argument("--self-contained", action="append", type=Path, default=[],
                        help="这个目录下的 ELF 只许依赖 glibc、GCC 运行时和目录里自带的库（可给多次）")
    parser.add_argument("paths", nargs="*", type=Path)
    args = parser.parse_args(argv)
    if not args.paths and not args.self_contained:
        parser.error("至少给一个要查的目录或文件")
    return check(args.paths, args.baseline, top=args.top, self_contained=args.self_contained)


if __name__ == "__main__":
    raise SystemExit(main())
