import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.runtimes.fx_coordination import (
    FxTurnCoordinator,
    conversation_namespace,
    coordinator_for,
)


def test_fx_coordinator_allows_bounded_parallel_conversations(tmp_path):
    coordinator = FxTurnCoordinator(tmp_path / "fx", max_concurrent_turns=2)
    barrier = threading.Barrier(2)

    def run(conversation_id: str) -> None:
        with coordinator.turn(conversation_id):
            barrier.wait(timeout=1)

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(run, "conv-a"), executor.submit(run, "conv-b")]
        for future in futures:
            future.result(timeout=2)


def test_fx_coordinator_serializes_the_same_conversation(tmp_path):
    coordinator = FxTurnCoordinator(tmp_path / "fx", max_concurrent_turns=2)
    guard = threading.Lock()
    active = 0
    peak = 0

    def run() -> None:
        nonlocal active, peak
        with coordinator.turn("conv-a"):
            with guard:
                active += 1
                peak = max(peak, active)
            time.sleep(0.05)
            with guard:
                active -= 1

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(run), executor.submit(run)]
        for future in futures:
            future.result(timeout=2)

    assert peak == 1


def test_fx_coordinator_is_shared_by_runtime_instances(tmp_path):
    state_root = tmp_path / "fx"
    first = coordinator_for(state_root, max_concurrent_turns=1)
    second = coordinator_for(state_root, max_concurrent_turns=8)

    assert first is second


def test_fx_session_namespace_is_stable_and_does_not_expose_conversation_id():
    namespace = conversation_namespace("private-conversation-id")

    assert namespace == conversation_namespace("private-conversation-id")
    assert len(namespace) == 32
    assert "private" not in namespace
