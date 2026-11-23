"""#162：Linux 包自带 Python 的 RUNPATH 写死成构建机工具缓存的绝对路径，用户机器上找错 libpython。"""
from __future__ import annotations

from pathlib import Path
import re
import sys


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = SCRIPTS_ROOT.parent / "workflows"
sys.path.insert(0, str(SCRIPTS_ROOT))

from relocate_linux_python_runpath import host_specific_entries, relocated_entries


TOOLCACHE = Path("/opt/hostedtoolcache/Python/3.11.18/x64")
BUNDLE = Path("/work/frontend/desktop/src/runtime/linux/python")
TOOLCACHE_LIB = str(TOOLCACHE / "lib")


def _relocate(entries: list[str], relative_file: str) -> list[str]:
    return relocated_entries(
        entries,
        original_roots=[TOOLCACHE],
        bundle_root=BUNDLE,
        file_path=BUNDLE / relative_file,
    )


def test_launcher_finds_libpython_next_to_itself():
    """v2026.11.22 的 bin/python3：NEEDED libpython3.11.so.1.0，RUNPATH /opt/hostedtoolcache/Python/3.11.18/x64/lib。"""
    assert _relocate([TOOLCACHE_LIB], "bin/python3") == ["$ORIGIN/../lib"]
    assert _relocate([TOOLCACHE_LIB], "python") == ["$ORIGIN/lib"]


def test_libpython_and_lib_dynload_point_into_the_bundle():
    assert _relocate([TOOLCACHE_LIB], "lib/libpython3.11.so.1.0") == ["$ORIGIN"]
    assert _relocate(
        [TOOLCACHE_LIB], "lib/python3.11/lib-dynload/_ssl.cpython-311-x86_64-linux-gnu.so"
    ) == ["$ORIGIN/../.."]


def test_wheel_runpaths_are_kept_and_other_host_paths_dropped():
    assert _relocate(["$ORIGIN/../pillow.libs"], "lib/python3.11/site-packages/PIL/_imaging.so") == [
        "$ORIGIN/../pillow.libs"
    ]
    assert _relocate(["/usr/local/lib", TOOLCACHE_LIB, TOOLCACHE_LIB + "/"], "bin/python3") == ["$ORIGIN/../lib"]
    assert _relocate(["/usr/local/lib"], "bin/python3") == []


def test_only_origin_relative_runpaths_pass_the_check():
    assert host_specific_entries(["$ORIGIN", "${ORIGIN}/../lib", ""]) == []
    assert host_specific_entries(["$ORIGIN", TOOLCACHE_LIB]) == [TOOLCACHE_LIB]


def _linux_job() -> str:
    source = (WORKFLOWS / "build-desktop-packages.yml").read_text(encoding="utf-8")
    match = re.search(r"^  build-linux-release:\n(.*?)(?=^  [\w-]+:|\Z)", source, re.M | re.S)
    assert match is not None
    return match.group(1)


def test_linux_build_relocates_before_using_bundled_python_and_checks_final_dir():
    job = _linux_job()
    assert re.search(r"apt-get install -y [^\n]*\bpatchelf\b", job)
    relocate = job.index("relocate_linux_python_runpath.py relocate")
    assert relocate < job.index('"$bundle_root/bin/python3" -m pip')
    assert job.index("rsync -aL") < relocate
    native = job[job.index("- name: Check Linux bundled native dependencies"):]
    check = native.index("relocate_linux_python_runpath.py check")
    assert '--bundle-root "$backend_root/python"' in native
    # 最终 ldd 照用户机器的样子查：不带 setup-python 放进去的工具缓存 LD_LIBRARY_PATH。
    unset = native.index("unset LD_LIBRARY_PATH")
    assert check < unset < native.index("check_ldd \"$backend_root/bin/rust_api\"")
    assert '${LD_LIBRARY_PATH:-}' not in native
