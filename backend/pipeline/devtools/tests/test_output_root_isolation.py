"""守住「测试产物不落进仓库」这套隔离本身。

conftest 里那个会话级守卫盯的是结果——仓库 data/ 有没有被写脏。这个文件盯的是
机制：per-test 隔离靠的是那几个路径**惰性求值**。把它们改回 import 时求值的模块级
常量，会话守卫**不会**响（因为 conftest 在 import 前就把 OUTPUT_ROOT 指走了，
冻结的值照样落在临时目录），但逐用例隔离会静默失效：所有用例共享同一个公式缓存，
先跑的用例编译出来的 PNG 让后跑的用例跳过编译——正是 #110 里本机绿、CI 红的机制。

这已经实测过：把 formula_cache_dir() 改回冻结常量，整套 2157 个测试一个都不红。
所以需要这几条。
"""
from __future__ import annotations

from pathlib import Path

import pytest

from retainpdf_pipeline.foundation.config import paths
from retainpdf_pipeline.render.layout.inline_content.fallback import png_renderer
from retainpdf_pipeline.render.output.typst import shared as typst_shared


@pytest.mark.parametrize(
    ("resolve", "child"),
    [
        (lambda: png_renderer.formula_cache_dir(), "formula_cache"),
        (lambda: typst_shared.typst_overlay_dir(), "typst_overlay"),
    ],
    ids=["formula_cache", "typst_overlay"],
)
def test_output_paths_follow_output_dir_at_call_time(
    resolve, child: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert resolve() == paths.OUTPUT_DIR / child

    # 这一半是关键：改回模块级常量就会转红。
    moved = tmp_path / "moved-output-root"
    monkeypatch.setattr(paths, "OUTPUT_DIR", moved)
    assert resolve() == moved / child


def test_each_test_gets_its_own_output_root() -> None:
    """OUTPUT_DIR 必须已经被 conftest 指离仓库。

    两个用例拿到不同目录这件事由 _seen_output_roots 跨用例断言。
    """
    repo_data = paths.ROOT_DIR / "data"
    assert paths.OUTPUT_DIR != repo_data
    assert repo_data not in paths.OUTPUT_DIR.parents
    _seen_output_roots.append(paths.OUTPUT_DIR)


_seen_output_roots: list[Path] = []


def test_output_root_is_not_shared_between_tests() -> None:
    _seen_output_roots.append(paths.OUTPUT_DIR)
    assert len(_seen_output_roots) >= 2, "依赖上一条用例先跑"
    assert len(set(_seen_output_roots)) == len(_seen_output_roots), (
        f"多个用例共享了同一个 OUTPUT_ROOT，逐用例隔离已失效：{_seen_output_roots}"
    )
