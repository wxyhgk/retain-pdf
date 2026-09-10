"""Stable import roots for all benchmark test categories."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from support.paths import PIPELINE
from support.offline import network_guard
import os
import tempfile
from contextlib import ExitStack
from unittest.mock import patch

sys.path.insert(0, str(PIPELINE))


def pytest_configure(config):
    # Configuration precedes test-module collection/import, unlike a fixture.
    config.addinivalue_line("filterwarnings", "error::pytest.PytestUnhandledThreadExceptionWarning")
    stack = ExitStack()
    config.add_cleanup(stack.close)
    root = stack.enter_context(tempfile.TemporaryDirectory(prefix="retainpdf-benchmark-tests-"))
    stack.enter_context(patch.dict(os.environ, OUTPUT_ROOT=root))
    stack.enter_context(network_guard())
