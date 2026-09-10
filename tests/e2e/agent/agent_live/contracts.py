from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class LiveE2EError(RuntimeError):
    """A bounded user-facing acceptance failure."""


@dataclass(frozen=True)
class Options:
    scenario: str
    fixture: Path
    data_root: Path | None
    keep_data: bool
    prompt_gateway_key: bool
    sync: bool
    build: bool
    startup_timeout: float
    turn_timeout: float


@dataclass(frozen=True)
class StackHandle:
    process: subprocess.Popen[bytes]
    log_file: Any
    log_path: Path
    ports: tuple[int, int, int, int]
    api_key: str

    @property
    def api_url(self) -> str:
        return f"http://127.0.0.1:{self.ports[0]}"
