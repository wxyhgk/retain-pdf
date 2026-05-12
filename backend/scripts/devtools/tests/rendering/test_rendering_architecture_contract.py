from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from devtools import check_pipeline_architecture


def test_pipeline_architecture_contract_passes() -> None:
    assert check_pipeline_architecture.main() == 0
