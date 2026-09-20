from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# 必须排在任何 `retainpdf_pipeline` 的 import 之前。
#
# `foundation/config/paths.py` 在 import 时就把 OUTPUT_DIR 定下来，再由它派生出
# TRANSLATIONS_DIR / TRANSLATION_UNIT_CACHE_DIR / ... 一串模块级常量，`foundation
# /config/__init__.py`、`foundation/shared/config.py`、`typography_memory/store.py`
# 又把这些常量按值再导出一遍。也就是说，等测试跑起来再 monkeypatch
# `paths.OUTPUT_DIR`，那些副本一个都跟不上——产物照旧落进仓库的 `data/`。
#
# 唯一能一次性管住全部副本（连同测试 spawn 出去的子进程）的时机，就是在第一次
# import 之前把 OUTPUT_ROOT 指走。后面的 per-test fixture 再在这层之上做逐用例
# 隔离。
# ---------------------------------------------------------------------------
_SESSION_OUTPUT_ROOT = Path(tempfile.mkdtemp(prefix="retainpdf-tests-output-root-"))
os.environ["OUTPUT_ROOT"] = str(_SESSION_OUTPUT_ROOT)
os.environ.pop("RUST_API_OUTPUT_ROOT", None)

from retainpdf_pipeline.foundation.config import layout  # noqa: E402
from retainpdf_pipeline.foundation.config import paths  # noqa: E402

# 仓库里那个真正的 data/：守卫用它，不受 OUTPUT_ROOT 影响。
REPO_DATA_DIR = paths.ROOT_DIR / "data"

# OUTPUT_DIR 派生出来的兄弟目录。per-test fixture 改了 OUTPUT_DIR 之后，这些在
# paths 模块上的常量不会自己跟着走，得一起 patch。
_OUTPUT_DIR_DERIVED = {
    "TRANSLATIONS_DIR": "translations",
    "TRANSLATION_UNIT_CACHE_DIR": "_translation_unit_cache",
    "DOMAIN_CONTEXT_CACHE_DIR": "_domain_context_cache",
    "RENDER_TYPOGRAPHY_MEMORY_DIR": "_render_typography_memory",
}


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        "markers",
        "needs_typst: 需要机器上真有 typst 可执行文件的集成用例。"
        "只给真跑一遍排版的用例打——单元测试应当 stub 掉二进制定位，"
        "而不是靠这个标记逃避。CI 有一步专门在装 typst 之前跑 "
        "`-m \"not needs_typst\"`。",
    )


def pytest_unconfigure(config: pytest.Config) -> None:
    shutil.rmtree(_SESSION_OUTPUT_ROOT, ignore_errors=True)


@pytest.fixture(autouse=True)
def _isolate_render_state(monkeypatch: pytest.MonkeyPatch):
    # Offline tests must neither learn from nor write to real job history.
    # Memory-specific tests explicitly enable their own temporary store.
    monkeypatch.setenv("RETAIN_RENDER_TYPOGRAPHY_MEMORY", "0")
    # render_only applies tuning in-process. Restore it after each test so a
    # workflow test cannot change the baseline of subsequent layout tests.
    for name, value in vars(layout).items():
        if name.isupper() and isinstance(value, (bool, int, float, str)):
            monkeypatch.setattr(layout, name, value)


@pytest.fixture(autouse=True)
def _isolate_output_root(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    """每个用例一个独立的 OUTPUT_ROOT。

    光「不写仓库」还不够：公式 PNG 缓存是按内容 hash 命中的，只要跨用例共享，
    先跑的用例编译出来的 PNG 就会让后跑的用例跳过编译——本机和 CI 的用例顺序、
    筛选条件一变，结论就不一样。逐用例隔离之后，每个用例都在空缓存上跑。

    这条 fixture 依赖 `formula_cache_dir()` / `typst_overlay_dir()` 已经改成惰性
    求值；还留在模块级常量里的路径，靠上面那段 import 前设 OUTPUT_ROOT 兜底。
    """
    output_root = tmp_path / "output-root"
    monkeypatch.setenv("OUTPUT_ROOT", str(output_root))
    monkeypatch.setattr(paths, "OUTPUT_DIR", output_root)
    for name, child in _OUTPUT_DIR_DERIVED.items():
        monkeypatch.setattr(paths, name, output_root / child)


def _snapshot(root: Path) -> dict[str, tuple[int, int]]:
    """(相对路径 -> (mtime_ns, size))。目录不存在就返回空表。"""
    rows: dict[str, tuple[int, int]] = {}
    for dirpath, _dirnames, filenames in os.walk(root):
        for name in filenames:
            path = Path(dirpath) / name
            try:
                stat = path.lstat()
            except OSError:
                continue
            rows[str(path.relative_to(root))] = (stat.st_mtime_ns, stat.st_size)
    return rows


@pytest.fixture(scope="session", autouse=True)
def _repo_data_dir_must_stay_untouched():
    """跑完测试，仓库的 `data/` 必须和跑之前一模一样。

    这个守卫存在的理由：测试往 `data/` 里写东西，本身不会让任何用例变红，只会
    让下一次运行的结果跟着本地残留状态漂——本机一直绿、CI 一直红，而且两边都
    看不出原因。所以必须有人在会话结束时主动去看一眼。

    注意 `data/` 是 gitignore 的，`git status` 看不见，只能做文件系统快照对比。
    """
    before = _snapshot(REPO_DATA_DIR)
    yield
    after = _snapshot(REPO_DATA_DIR)

    added = sorted(set(after) - set(before))
    removed = sorted(set(before) - set(after))
    changed = sorted(key for key in set(before) & set(after) if before[key] != after[key])
    if not (added or removed or changed):
        return

    lines = [
        f"测试污染了仓库的 data/ 目录（{REPO_DATA_DIR}）。",
        "测试产物必须落在 tmp_path 下，不能落进工作树——否则下一次运行会命中这",
        "一次留下的缓存，本机和干净 checkout 的结论会不一样（见 #110）。",
    ]
    for label, keys in (("新增", added), ("删除", removed), ("修改", changed)):
        for key in keys[:50]:
            lines.append(f"  {label}: data/{key}")
        if len(keys) > 50:
            lines.append(f"  {label}: ...还有 {len(keys) - 50} 个")
    lines.append(
        "通常的原因是某个模块把 paths.OUTPUT_DIR 冻成了 import 时求值的模块级常量，"
        "conftest 的 _isolate_output_root 对它无效。改成惰性求值（参考 "
        "render/output/typst/shared.py:typst_overlay_dir）即可。"
    )
    pytest.fail("\n".join(lines), pytrace=False)
