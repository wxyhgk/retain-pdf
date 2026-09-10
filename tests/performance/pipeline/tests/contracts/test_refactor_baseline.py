from support.paths import HERE
"""Byte-level synthetic prompt/identity oracle frozen before refactoring."""
import json
from pathlib import Path

import pytest

from support.refactor_baseline_support import CASE_IDS, snapshot


@pytest.fixture(scope="module")
def frozen_baseline():
    return json.loads((HERE / "fixtures/refactor_baseline.json").read_text(encoding="utf-8"))


def test_baseline_covers_complete_case_matrix(frozen_baseline):
    assert set(frozen_baseline) == set(CASE_IDS)


@pytest.mark.parametrize("case_id", CASE_IDS, ids=CASE_IDS)
def test_frozen_pre_refactor_messages_and_identity(case_id, frozen_baseline):
    assert snapshot(case_id) == frozen_baseline[case_id]
