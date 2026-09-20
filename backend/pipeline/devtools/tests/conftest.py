from __future__ import annotations

import pytest

from retainpdf_pipeline.foundation.config import layout


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        "markers",
        "needs_typst: 需要机器上真有 typst 可执行文件的集成用例。"
        "只给真跑一遍排版的用例打——单元测试应当 stub 掉二进制定位，"
        "而不是靠这个标记逃避。CI 有一步专门在装 typst 之前跑 "
        "`-m \"not needs_typst\"`。",
    )


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
