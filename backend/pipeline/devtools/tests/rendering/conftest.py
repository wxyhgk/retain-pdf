from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _disable_global_typography_memory(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("RETAIN_RENDER_TYPOGRAPHY_MEMORY", "0")
