"""Stable unit identity and fail-closed control for Rust-backed translation.

IDs come from document items/tasks, never from human-readable request labels.
The failure latch prevents legacy fallback code from creating fresh paid work.
"""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from functools import wraps
import hashlib
import json
import os
import threading

from .rust_executor import ExecutorError, RustModelExecutorClient
from retainpdf_pipeline.translate.llm.validation.errors import PartialBatchTranslationError


from retainpdf_pipeline.translate.core.execution_policy import execution_enabled


def item_ids(items) -> tuple[str, ...]:
    items = [items] if isinstance(items, dict) else items
    ids = []
    for item in items:
        identity = str(item.get("item_id") or "").strip()
        if not identity:
            raise ExecutorError("translation unit is missing a stable item ID")
        ids.append(identity)
        ids.extend(str(value) for value in item.get("translation_unit_member_ids", []) if value)
    return tuple(sorted(set(ids)))


@dataclass
class Unit:
    identity: str
    members: tuple[str, ...]
    requests: int = 0


_unit: ContextVar[Unit | None] = ContextVar("rust_translation_unit", default=None)


class ExecutorRuntime:
    def __init__(self, client):
        self.client = client
        self._lock = threading.Lock()
        self.failure: ExecutorError | None = None
        self.failed_members: set[str] = set()
        self.unscoped_failure = False

    def fail(self, error: ExecutorError):
        scope = _unit.get()
        with self._lock:
            first_failure = self.failure is None
            if self.failure is None:
                self.failure = error
            if scope and scope.members:
                self.failed_members.update(scope.members)
            elif first_failure:
                self.unscoped_failure = True
        return error

    def check(self):
        with self._lock:
            failure = self.failure
        if failure:
            raise failure

    def check_members(self, items):
        members = item_ids(items)
        with self._lock:
            failed = self.unscoped_failure or bool(self.failed_members.intersection(members))
            failure = self.failure
        if failed and failure:
            raise failure

    def request(self, messages, *, temperature=0.2, response_format=None):
        self.check()
        scope = _unit.get()
        if scope is None:
            raise self.fail(ExecutorError("model call has no explicit stable unit scope"))
        if scope.requests >= 2:
            raise self.fail(ExecutorError("translation unit exhausted its primary/repair budget"))
        purpose = "primary" if scope.requests == 0 else "repair"
        scope.requests += 1
        try:
            from .request_capture import capture_request
            try:
                capture_request(operation_id=f"{scope.identity}.{purpose}", unit_id=scope.identity,
                                purpose=purpose, messages=messages, temperature=temperature,
                                response_format=response_format)
            except (OSError, ValueError, TypeError, KeyError):
                raise ExecutorError("private request capture failed before submission") from None
            return self.client.request(operation_id=f"{scope.identity}.{purpose}", unit_id=scope.identity, purpose=purpose, messages=messages, temperature=temperature, response_format=response_format).content
        except ExecutorError as error:
            raise self.fail(error)


_runtime: ExecutorRuntime | None = None
_runtime_lock = threading.Lock()


def runtime() -> ExecutorRuntime:
    global _runtime
    with _runtime_lock:
        if _runtime is None:
            try:
                client = RustModelExecutorClient(os.environ["RETAIN_MODEL_EXECUTOR_URL"], os.environ["RETAIN_MODEL_JOB_ID"], os.environ["RETAIN_MODEL_CAPABILITY"], deadline=float(os.environ.get("RETAIN_MODEL_WAIT_SECONDS", "240")))
            except (KeyError, ValueError):
                raise ExecutorError("Rust model worker configuration is incomplete; direct fallback is disabled") from None
            _runtime = ExecutorRuntime(client)
        return _runtime


@contextmanager
def unit_scope(kind: str, identities, *, members=()):
    if not execution_enabled():
        yield
        return
    runtime().check()
    if _unit.get() is not None:
        yield
        return
    canonical = json.dumps([kind, identities], ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    scope = Unit(hashlib.sha256(canonical.encode()).hexdigest(), tuple(members))
    token = _unit.set(scope)
    try:
        yield
    except ExecutorError as error:
        raise runtime().fail(error)
    finally:
        _unit.reset(token)


def translation_unit(function):
    """One explicit document unit; at most one content-validation repair.

    A wrapped inner function shares the outer unit budget. Exhausted protocol
    errors become executor failures so legacy sentence/raw fallbacks cannot
    silently spend another set of requests under new IDs.
    """
    @wraps(function)
    def wrapped(*args, **kwargs):
        if not execution_enabled():
            return function(*args, **kwargs)
        items = args[0] if args else kwargs.get("item", kwargs.get("batch"))
        members = item_ids(items)
        with unit_scope("translation", members, members=members):
            accepted = {}
            for _ in range(2):
                before = _unit.get().requests
                try:
                    result = function(*args, **kwargs)
                    return {**accepted, **result} if accepted else result
                except PartialBatchTranslationError as error:
                    accepted.update(error.result)
                    if _unit.get().requests == before or _unit.get().requests >= 2:
                        break
                    # Keep the original unit identity and its primary/repair
                    # budget, but send only unresolved members to the model.
                    if args:
                        args = (error.retry_items, *args[1:])
                    else:
                        kwargs = {**kwargs, "batch": error.retry_items}
                except (ValueError, KeyError):
                    if _unit.get().requests == before or _unit.get().requests >= 2:
                        break
            raise runtime().fail(ExecutorError("translation content validation failed within the bounded repair budget"))
    return wrapped


def raise_if_executor_failed():
    if execution_enabled():
        runtime().check()


def scoped_request(kind, identities, request_function, *args, **kwargs):
    """Explicit non-item call sites; no request-label-derived identity."""
    with unit_scope(kind, identities):
        return request_function(*args, **kwargs)


def raise_if_batch_failed(batch):
    if execution_enabled():
        runtime().check_members(batch)
