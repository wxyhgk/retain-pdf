"""Windows compatibility: no hard dependency on POSIX-only modules.

Regression for the Windows desktop crash:
``ModuleNotFoundError: No module named 'fcntl'`` raised from
``translation/workflow/checkpoint/store.py`` at import time, plus the same
class of bug from ``import resource`` in ``run_document_operation.py``.

macOS/Linux never catch these because both modules exist there; the tests
below simulate Windows by making the imports fail.
"""

import importlib
import importlib.util
import sys
import types
from contextlib import contextmanager
from pathlib import Path

from cold_import_test_support import run_cold_import_probe


REPO_PIPELINE_ROOT = Path(__file__).resolve().parents[3]
STORE_PATH = (
    REPO_PIPELINE_ROOT
    / "retainpdf_pipeline"
    / "translate"
    / "workflow"
    / "checkpoint"
    / "store.py"
)


@contextmanager
def blocked_imports(*names: str):
    """Simulate Windows: ``import <name>`` raises ImportError."""
    saved = {name: sys.modules.get(name, ...) for name in names}
    for name in names:
        sys.modules[name] = None  # type: ignore[assignment]
    try:
        yield
    finally:
        for name in names:
            if saved[name] is ...:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = saved[name]


def _load_store_fresh(module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, STORE_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def test_store_imports_without_fcntl_or_msvcrt(tmp_path) -> None:
    run_cold_import_probe(__file__, "_probe_store_without_os_locking", str(tmp_path))


def _probe_store_without_os_locking(directory: str) -> None:
    with blocked_imports("fcntl", "msvcrt"):
        store = _load_store_fresh("windows_ckpt_store_noos")
    assert store.fcntl is None
    assert store.msvcrt is None
    checkpoint = Path(directory) / "translation-checkpoint.v1.json"
    keeper = store.CheckpointStore(checkpoint)
    try:
        keeper.acquire()
        keeper.save({"generation": 1})
        assert keeper.load() == {"generation": 1}
    finally:
        keeper.close()


def test_store_uses_msvcrt_locking_when_available(tmp_path) -> None:
    run_cold_import_probe(__file__, "_probe_store_with_msvcrt", str(tmp_path))


def _probe_store_with_msvcrt(directory: str) -> None:
    calls: list[tuple] = []
    fake_msvcrt = types.ModuleType("msvcrt")
    fake_msvcrt.LK_NBLCK = 1
    fake_msvcrt.LK_UNLCK = 0

    def fake_locking(fd: int, mode: int, nbytes: int) -> None:
        calls.append((fd, mode, nbytes))
        if mode == 1 and getattr(fake_locking, "locked", False):
            raise OSError("locked")
        if mode == 1:
            fake_locking.locked = True
        else:
            fake_locking.locked = False

    fake_msvcrt.locking = fake_locking
    saved = sys.modules.get("msvcrt", ...)
    sys.modules["msvcrt"] = fake_msvcrt
    try:
        with blocked_imports("fcntl"):
            store = _load_store_fresh("windows_ckpt_store_msvcrt")
    finally:
        if saved is ...:
            sys.modules.pop("msvcrt", None)
        else:
            sys.modules["msvcrt"] = saved
    checkpoint = Path(directory) / "translation-checkpoint.v1.json"
    keeper = store.CheckpointStore(checkpoint)
    try:
        keeper.acquire()
        assert calls and calls[0][1] == 1  # LK_NBLCK taken
    finally:
        keeper.close()
    assert calls[-1][1] == 0  # LK_UNLCK released


def test_document_operation_imports_without_resource() -> None:
    run_cold_import_probe(__file__, "_probe_document_operation_without_resource")


def _probe_document_operation_without_resource() -> None:
    with blocked_imports("resource"):
        module = importlib.import_module(
            "retainpdf_pipeline.entrypoints.run_document_operation"
        )
    assert module.resource is None
    # rlimits are skipped on Windows; must not raise.
    module._apply_limits(
        {
            "cpu_time_seconds": 10,
            "output_bytes": 1024,
            "file_descriptor_count": 16,
            "memory_bytes": 1024,
            "process_count": 4,
        }
    )
