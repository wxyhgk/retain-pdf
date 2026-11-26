"""领域识别的总时限不靠 `signal.SIGALRM`（2026-11-26）。

Windows 没有 SIGALRM，桌面版 Windows 上领域识别每次都抛 AttributeError、被跳过
（`sci domain inference skipped: AttributeError: module 'signal' has no attribute 'SIGALRM'`）。
这里把 signal 模块上的 SIGALRM / setitimer 拿掉，模拟这种平台。
"""
from __future__ import annotations

import json
import signal
import threading
import time
from pathlib import Path

import pytest

from retainpdf_translation.llm import domain_context

ANSWER = json.dumps({"domain": "计算化学", "summary": "教材章节", "translation_guidance": "术语前后一致"}, ensure_ascii=False)


@pytest.fixture
def no_sigalrm(monkeypatch, tmp_path: Path) -> None:
    import retainpdf_base.paths as paths

    for name in ("SIGALRM", "ITIMER_REAL", "setitimer"):
        monkeypatch.delattr(signal, name, raising=False)
    monkeypatch.setattr(paths, "DOMAIN_CONTEXT_CACHE_DIR", tmp_path / "_domain_context_cache")
    monkeypatch.setattr(domain_context, "emit_stage_transition", lambda **_kwargs: None)
    monkeypatch.setattr(domain_context, "emit_stage_progress", lambda **_kwargs: None)


def _infer(tmp_path: Path) -> dict[str, str]:
    output_dir = tmp_path / "translated"
    output_dir.mkdir(exist_ok=True)
    return domain_context.infer_domain_context_from_preview_text(
        preview_text="Geometry optimization finds stationary points.",
        api_key="sk-test",
        model="demo",
        base_url="https://example.com/v1",
        output_dir=output_dir,
    )


def test_domain_inference_works_without_sigalrm(no_sigalrm, monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(domain_context, "request_chat_content", lambda _messages, **_kwargs: ANSWER)
    assert _infer(tmp_path)["domain"] == "计算化学"


def test_the_total_timeout_still_applies_without_sigalrm(no_sigalrm, monkeypatch, tmp_path: Path) -> None:
    release = threading.Event()

    def _slow(_messages, **_kwargs):
        release.wait(10)
        return ANSWER

    monkeypatch.setattr(domain_context, "request_chat_content", _slow)
    monkeypatch.setenv(domain_context.DOMAIN_CONTEXT_TOTAL_TIMEOUT_ENV, "1")
    started = time.perf_counter()
    try:
        result = _infer(tmp_path)
    finally:
        release.set()
    assert time.perf_counter() - started < 5
    assert result["domain"] == "" and result["preview_text"]


def test_the_total_timeout_also_applies_off_the_main_thread(no_sigalrm) -> None:
    """以前不在主线程就不限时（信号只能在主线程装）。"""
    release = threading.Event()
    raised: list[BaseException] = []

    def _worker() -> None:
        try:
            domain_context._call_with_domain_deadline(lambda: release.wait(10), 0.2)
        except BaseException as exc:  # noqa: BLE001
            raised.append(exc)

    thread = threading.Thread(target=_worker)
    thread.start()
    thread.join(5)
    release.set()
    assert raised and isinstance(raised[0], domain_context.DomainContextTimeoutError)


def test_errors_and_results_come_back_to_the_caller(no_sigalrm) -> None:
    assert domain_context._call_with_domain_deadline(lambda: "ok", 1) == "ok"

    def _boom() -> str:
        raise ValueError("upstream rejected")

    with pytest.raises(ValueError, match="upstream rejected"):
        domain_context._call_with_domain_deadline(_boom, 1)
