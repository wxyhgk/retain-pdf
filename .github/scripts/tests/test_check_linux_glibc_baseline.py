"""Linux 安装包的 glibc 基线检查：读 ELF 的 verneed / DT_NEEDED，超过基线、依赖包外的库就失败（#162 之后）。"""
from __future__ import annotations

from pathlib import Path
import re
import struct
import sys


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = SCRIPTS_ROOT.parent / "workflows"
sys.path.insert(0, str(SCRIPTS_ROOT))

from check_linux_glibc_baseline import (  # noqa: E402
    ElfError,
    check,
    foreign_libraries,
    main,
    parse_glibc_version,
    read_elf_versions,
)


def make_elf(needs: dict[str, list[str]] | None = None, needed: list[str] | None = None) -> bytes:
    """拼一个最小的 64 位小端 ELF：只有节头表、.dynstr、.dynamic、.gnu.version_r，够检查脚本读。"""
    needs = needs or {}
    needed = needed or []
    strtab = bytearray(b"\0")

    def add_string(text: str) -> int:
        offset = len(strtab)
        strtab.extend(text.encode() + b"\0")
        return offset

    verneed = bytearray()
    libraries = list(needs.items())
    for index, (library, versions) in enumerate(libraries):
        file_offset = add_string(library)
        entry_size = 16 + 16 * len(versions)
        vn_next = entry_size if index + 1 < len(libraries) else 0
        verneed += struct.pack("<HHIII", 1, len(versions), file_offset, 16, vn_next)
        for aux_index, version in enumerate(versions):
            name_offset = add_string(version)
            vna_next = 16 if aux_index + 1 < len(versions) else 0
            verneed += struct.pack("<IHHII", 0, 0, 2 + aux_index, name_offset, vna_next)

    dynamic = bytearray()
    for library in needed:
        dynamic += struct.pack("<qQ", 1, add_string(library))
    dynamic += struct.pack("<qQ", 0, 0)

    header_size = 64
    strtab_offset = header_size
    dynamic_offset = strtab_offset + len(strtab)
    verneed_offset = dynamic_offset + len(dynamic)
    shoff = verneed_offset + len(verneed)
    sections = [
        (0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 3, 0, 0, strtab_offset, len(strtab), 0, 0, 1, 0),  # .dynstr
        (0, 6, 0, 0, dynamic_offset, len(dynamic), 1, 0, 8, 16),  # .dynamic
        (0, 0x6FFFFFFE, 0, 0, verneed_offset, len(verneed), 1, len(libraries), 8, 0),  # .gnu.version_r
    ]
    ident = b"\x7fELF" + bytes([2, 1, 1]) + bytes(9)
    header = ident + struct.pack(
        "<HHIQQQIHHHHHH", 3, 62, 1, 0, 0, shoff, 0, header_size, 0, 0, 64, len(sections), 0
    )
    assert len(header) == header_size
    body = bytes(strtab) + bytes(dynamic) + bytes(verneed)
    table = b"".join(struct.pack("<IIQQQQIIQQ", *section) for section in sections)
    return header + body + table


def test_reads_glibc_versions_and_needed_libraries():
    data = make_elf(
        {"libc.so.6": ["GLIBC_2.2.5", "GLIBC_2.39", "GLIBC_PRIVATE"], "libm.so.6": ["GLIBC_2.29"],
         "libstdc++.so.6": ["GLIBCXX_3.4.32"]},
        needed=["libm.so.6", "libc.so.6"],
    )
    versions = read_elf_versions(data)
    assert versions.needs["libc.so.6"] == ["GLIBC_2.2.5", "GLIBC_2.39", "GLIBC_PRIVATE"]
    assert versions.glibc_versions() == [(2, 2, 5), (2, 29), (2, 39)]
    assert versions.max_glibc() == (2, 39)
    assert versions.needed == ["libm.so.6", "libc.so.6"]


def test_static_binaries_have_no_requirement_and_non_elf_is_rejected():
    assert read_elf_versions(make_elf()).max_glibc() is None
    try:
        read_elf_versions(b"#!/bin/sh\n")
    except ElfError:
        pass
    else:
        raise AssertionError("non-ELF accepted")


def test_version_parsing_compares_numerically():
    assert parse_glibc_version("GLIBC_2.9") < parse_glibc_version("GLIBC_2.28")
    assert parse_glibc_version("GLIBC_2.28") < parse_glibc_version("GLIBC_2.28.1")
    for other in ("GLIBC_PRIVATE", "GLIBCXX_3.4.30", "CXXABI_1.3", "XCRYPT_2.0"):
        assert parse_glibc_version(other) is None


def _tree(tmp_path: Path, files: dict[str, bytes]) -> Path:
    for relative, data in files.items():
        path = tmp_path / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return tmp_path


def test_check_fails_when_any_elf_needs_newer_glibc(tmp_path, capsys):
    """v2026.11.22：rust_api 要 GLIBC_2.39、libpython 要 2.38，基线 2.28 时必须红。"""
    root = _tree(tmp_path, {
        "opt/RetainPDF/retainpdf": make_elf({"libc.so.6": ["GLIBC_2.25"]}),
        "opt/RetainPDF/resources/backend/bin/rust_api": make_elf({"libc.so.6": ["GLIBC_2.39"]}),
        "opt/RetainPDF/resources/backend/bin/README": b"not elf",
    })
    assert check([root], (2, 28)) == 1
    err = capsys.readouterr().err
    assert "GLIBC_2.39" in err and "rust_api" in err
    assert "retainpdf\n" not in err


def test_check_passes_at_or_below_baseline(tmp_path, capsys):
    root = _tree(tmp_path, {
        "electron": make_elf({"libc.so.6": ["GLIBC_2.25"]}),
        "rust_api": make_elf({"libc.so.6": ["GLIBC_2.28"]}),
        "typst": make_elf(),
    })
    assert check([root], (2, 28)) == 0
    out = capsys.readouterr().out
    assert "checked_elf_files=3" in out and "max_glibc=GLIBC_2.28" in out


def test_check_fails_when_nothing_or_garbage_found(tmp_path):
    assert check([tmp_path], (2, 28)) == 1
    (tmp_path / "broken.so").write_bytes(b"\x7fELF" + b"\0" * 8)
    assert check([tmp_path], (2, 28)) == 1


def test_self_contained_python_may_only_need_glibc_or_shipped_libs(tmp_path, capsys):
    """以前的 lib-dynload 要系统的 libssl.so.3 等；轮子带的 .libs 和 glibc 自己的库可以。"""
    python = tmp_path / "resources/backend/python"
    _tree(python, {
        "bin/python3.11": make_elf({"libc.so.6": ["GLIBC_2.17"]}, needed=["libm.so.6", "libc.so.6"]),
        "lib/python3.11/site-packages/PIL/_imaging.so": make_elf(needed=["libjpeg-1a2b.so.62", "libc.so.6"]),
        "lib/python3.11/site-packages/pillow.libs/libjpeg-1a2b.so.62": make_elf(needed=["libc.so.6"]),
    })
    assert check([tmp_path], (2, 28), self_contained=[python]) == 0
    assert "self_contained_check=ok" in capsys.readouterr().out

    _tree(python, {
        "lib/python3.11/lib-dynload/_ssl.so": make_elf(needed=["libssl.so.3", "libcrypto.so.3", "libc.so.6"]),
    })
    assert check([tmp_path], (2, 28), self_contained=[python]) == 1
    err = capsys.readouterr().err
    assert "_ssl.so: libssl.so.3, libcrypto.so.3" in err
    # Electron 在 --self-contained 目录外，依赖 GTK 等系统库不算。
    assert foreign_libraries(["libgtk-3.so.0", "libc.so.6", "libstdc++.so.6"], set()) == ["libgtk-3.so.0"]


def test_cli_requires_baseline(tmp_path):
    _tree(tmp_path, {"a": make_elf({"libc.so.6": ["GLIBC_2.17"]})})
    assert main(["--max", "2.28", str(tmp_path)]) == 0
    assert main(["--max", "GLIBC_2.16", str(tmp_path)]) == 1


def _source(name: str) -> str:
    return (WORKFLOWS / name).read_text(encoding="utf-8")


def _linux_job() -> str:
    match = re.search(r"^  build-linux-release:\n(.*?)(?=^  [\w-]+:|\Z)", _source("build-desktop-packages.yml"), re.M | re.S)
    assert match is not None
    return match.group(1)


def test_linux_build_checks_the_final_deb_against_the_baseline():
    source = _source("build-desktop-packages.yml")
    baseline = re.search(r'^  LINUX_GLIBC_BASELINE: "(\d+\.\d+)"$', source, re.M)
    assert baseline is not None
    job = _linux_job()
    step = job[job.index("- name: Check Linux glibc baseline"):]
    step = step[: step.index("\n      - name:")]
    assert 'dpkg-deb -x "$deb"' in step
    assert 'check_linux_glibc_baseline.py --max "$LINUX_GLIBC_BASELINE"' in step
    assert '--self-contained "$deb_python"' in step
    assert job.index("npm run dist:linux") < job.index("- name: Check Linux glibc baseline") < job.index(
        "- name: Upload Linux package artifact"
    )


def test_rust_is_linked_against_the_baseline_glibc_in_release_and_warmup():
    """cargo zigbuild 的 target 后缀就是 glibc 基线；改基线要两处一起改（预热缓存要对得上）。"""
    baseline = re.search(r'^  LINUX_GLIBC_BASELINE: "(\d+\.\d+)"$', _source("build-desktop-packages.yml"), re.M).group(1)
    for name in ("build-desktop-packages.yml", "desktop-rust-cache-warmup.yml"):
        assert f"cargo zigbuild --release --locked --workspace --bins --target x86_64-unknown-linux-gnu.{baseline} " in _source(name), name
    job = _linux_job()
    # 产物不在 target/release/，打包时用 prepare-app 认的环境变量指过去。
    for variable, binary in (("RUST_API_BINARY", "rust_api"), ("JOBSD_BINARY", "retain-jobsd"),
                             ("RETAINPDF_CLI_BINARY", "retainpdf")):
        assert f'{variable}="$rust_release/{binary}"' in job
    assert 'rust_release="$RETAIN_PDF_SOURCE_ROOT/target/x86_64-unknown-linux-gnu/release"' in job
