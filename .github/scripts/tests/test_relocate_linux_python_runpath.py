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
    assert job.index('mv "$extract_root/python" "$bundle_root"') < relocate
    native = job[job.index("- name: Check Linux bundled native dependencies"):]
    check = native.index("relocate_linux_python_runpath.py check")
    assert '--bundle-root "$backend_root/python"' in native
    # 最终 ldd 照用户机器的样子查：不带 setup-python 放进去的工具缓存 LD_LIBRARY_PATH。
    unset = native.index("unset LD_LIBRARY_PATH")
    assert check < unset < native.index("check_ldd \"$backend_root/bin/rust_api\"")
    assert '${LD_LIBRARY_PATH:-}' not in native


def test_linux_bundles_checksummed_python_build_standalone_not_the_toolcache():
    """2026-11-23：工具缓存那份 Python 是构建机那代 glibc 编的、ssl 等要系统库；换成 python-build-standalone。"""
    source = (WORKFLOWS / "build-desktop-packages.yml").read_text(encoding="utf-8")
    url = re.search(r'^  LINUX_PYTHON_STANDALONE_URL: "(.+)"$', source, re.M)
    digest = re.search(r'^  LINUX_PYTHON_STANDALONE_SHA256: "([0-9a-f]{64})"$', source, re.M)
    assert url is not None and digest is not None
    assert url.group(1).startswith("https://github.com/astral-sh/python-build-standalone/releases/download/")
    # Python 小版本和其他平台一致（setup-python 3.11）；固定的是 x86_64 glibc 的 install_only 包。
    assert re.search(r"/cpython-3\.11\.\d+%2B\d{8}-x86_64-unknown-linux-gnu-install_only(_stripped)?\.tar\.gz$", url.group(1))
    job = _linux_job()
    step = job[job.index("- name: Assemble bundled Python runtime"):]
    step = step[: step.index("\n      - name:")]
    assert "rsync" not in step and "sys.executable" not in step
    assert step.index('curl -fsSL --retry 3 "$LINUX_PYTHON_STANDALONE_URL"') < step.index(
        'echo "$LINUX_PYTHON_STANDALONE_SHA256  $download" | sha256sum -c -'
    ) < step.index('tar -xzf "$download"')
    # Tcl/Tk 的 RUNPATH 是打包机的 /tools/deps/lib，_crypt 要系统 libcrypt：都在跑包里的 python3 之前删掉。
    for removed in ('"$bundle_root"/lib/libtcl*', '"$bundle_root"/lib/python3.*/lib-dynload/_crypt.*',
                    '"$bundle_root"/lib/libpython*.so*'):
        assert step.index(removed) < step.index('"$bundle_root/bin/python3" -m pip')
    assert "pip install --only-binary=:all: --target" in step
