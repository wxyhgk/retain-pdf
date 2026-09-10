"""Cooperative deadline and cancellation for one AI request."""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable

LOGGER = logging.getLogger(__name__)


class AIRequestError(RuntimeError):
    """Base error with a stable public SSE code."""

    code = "AI_RESPONSE_FAILED"
    retryable = True


class AIRequestTimeout(AIRequestError):
    code = "AI_RESPONSE_TIMEOUT"

    def __init__(self) -> None:
        super().__init__("AI 响应超时，请重试")


class AIRequestCancelled(AIRequestError):
    code = "AI_RESPONSE_CANCELLED"
    retryable = False

    def __init__(self) -> None:
        super().__init__("AI 响应已取消")


class EmptyAIResponse(AIRequestError):
    code = "AI_EMPTY_RESPONSE"

    def __init__(self) -> None:
        super().__init__("模型未返回有效回答，请重试")


class AIStreamIncomplete(AIRequestError):
    code = "AI_RESPONSE_INCOMPLETE"

    def __init__(self) -> None:
        super().__init__("模型响应不完整，请重试")


class AIProviderError(AIRequestError):
    """A deliberately safe provider failure; never carries a response body."""


class RequestControl:
    """Thread-safe cooperative cancellation shared by orchestration and I/O."""

    def __init__(self, deadline_seconds: float) -> None:
        self._started_at = time.monotonic()
        self._deadline_at = self._started_at + max(0.05, deadline_seconds)
        self._cancelled = threading.Event()
        self._lock = threading.Lock()
        self._callbacks: list[Callable[[], None]] = []
        self._reason = ""

    @property
    def elapsed_ms(self) -> int:
        return max(0, int((time.monotonic() - self._started_at) * 1000))

    @property
    def remaining_seconds(self) -> float:
        return max(0.0, self._deadline_at - time.monotonic())

    @property
    def cancelled(self) -> bool:
        return self._cancelled.is_set()

    def cancel(self, reason: str = "client_disconnected") -> None:
        callbacks: list[Callable[[], None]] = []
        with self._lock:
            if self._cancelled.is_set():
                return
            self._reason = reason
            self._cancelled.set()
            callbacks = list(self._callbacks)
            self._callbacks.clear()
        for callback in callbacks:
            try:
                callback()
            except Exception:
                # Cancellation cleanup is best effort and must never mask the
                # stable terminal event emitted by the orchestrator.
                LOGGER.debug("AI request cancellation cleanup failed", exc_info=True)

    def finish(self) -> None:
        """Release request-owned transports after a successful terminal."""
        callbacks: list[Callable[[], None]] = []
        with self._lock:
            callbacks = list(self._callbacks)
            self._callbacks.clear()
        for callback in callbacks:
            try:
                callback()
            except Exception:
                LOGGER.debug("AI request completion cleanup failed", exc_info=True)

    def add_cancel_callback(self, callback: Callable[[], None]) -> None:
        with self._lock:
            if not self._cancelled.is_set():
                self._callbacks.append(callback)
                return
        callback()

    def remove_cancel_callback(self, callback: Callable[[], None]) -> None:
        with self._lock:
            if callback in self._callbacks:
                self._callbacks.remove(callback)

    def raise_if_stopped(self) -> None:
        if self._cancelled.is_set():
            if self._reason == "deadline_exceeded":
                raise AIRequestTimeout()
            raise AIRequestCancelled()
        if self.remaining_seconds <= 0:
            self.cancel("deadline_exceeded")
            raise AIRequestTimeout()


def public_error_event(exc: BaseException) -> dict[str, object]:
    """Project internal failures into a bounded, diagnosable SSE terminal."""
    if isinstance(exc, AIRequestError):
        return {
            "type": "cancelled" if isinstance(exc, AIRequestCancelled) else "error",
            "code": exc.code,
            "message": str(exc),
            "retryable": exc.retryable,
        }
    return {
        "type": "error",
        "code": "AI_RESPONSE_FAILED",
        "message": "AI 服务请求失败，请重试或检查模型配置",
        "retryable": True,
    }
