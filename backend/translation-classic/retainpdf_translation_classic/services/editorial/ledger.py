"""编辑部台账：``<job>/artifacts/editorial/ledger.jsonl``，只追加。

每条记录一件事：谁（from）交给谁（to）、关于哪些块（refs）、是什么（kind）。kind 见
``KIND_*``。一次编辑部运行有自己的 run_id；运行中断、渲染续跑时，按「同一份译文（翻译身份
相同）且没有 run.end」找回上一次的运行，复用它已经开出的问题单，不再花钱重新审校。
"""
from __future__ import annotations

import json
import os
import secrets
import threading
from dataclasses import dataclass
from datetime import datetime
from datetime import timezone
from pathlib import Path
from typing import Any

LEDGER_RELATIVE_PATH = "artifacts/editorial/ledger.jsonl"

ROLE_CHIEF = "chief"
ROLE_TERMS = "terminologist"
ROLE_REVIEWER = "reviewer"
ROLE_QA = "qa"
ROLE_REVISER = "reviser"
ROLE_RULES = "rules"
ROLE_HUMAN = "human"

KIND_RUN_START = "run.start"
KIND_RUN_END = "run.end"
KIND_ISSUE_OPEN = "issue.open"
KIND_ISSUE_RESOLVE = "issue.resolve"
KIND_ISSUE_ESCALATE = "issue.escalate"
KIND_DECISION = "decision"
KIND_DISPUTE = "dispute"
KIND_REVIEW_DONE = "review.done"
KIND_TERM_REQUEST = "term.change_request"
KIND_TERM_DECISION = "term.decision"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def ledger_path(job_root: Path) -> Path:
    return Path(job_root) / LEDGER_RELATIVE_PATH


def new_run_id() -> str:
    return f"ed-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{secrets.token_hex(3)}"


def read_ledger(path: Path) -> list[dict[str, Any]]:
    """读出全部记录；坏行（写到一半被打断）跳过。"""
    records: list[dict[str, Any]] = []
    try:
        lines = Path(path).read_text(encoding="utf-8").splitlines()
    except OSError:
        return records
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            record = json.loads(line)
        except ValueError:
            continue
        if isinstance(record, dict):
            records.append(record)
    return records


@dataclass(frozen=True)
class ResumableRun:
    run_id: str
    records: list[dict[str, Any]]

    def review_done(self) -> bool:
        return any(record.get("kind") == KIND_REVIEW_DONE for record in self.records)

    def of_kind(self, kind: str) -> list[dict[str, Any]]:
        return [record for record in self.records if record.get("kind") == kind]


def find_resumable_run(records: list[dict[str, Any]], identity: dict[str, Any]) -> ResumableRun | None:
    """最近一次没结束、且针对同一份译文的运行。翻译身份（attempt_id + fingerprint）不同就不算。"""
    ended = {record.get("run_id") for record in records if record.get("kind") == KIND_RUN_END}
    for record in reversed(records):
        if record.get("kind") != KIND_RUN_START:
            continue
        run_id = record.get("run_id")
        if run_id in ended:
            return None
        recorded = record.get("translation") or {}
        if not identity.get("fingerprint") or any(
            recorded.get(key) != identity.get(key) for key in ("attempt_id", "fingerprint")
        ):
            return None
        return ResumableRun(run_id=str(run_id), records=[row for row in records if row.get("run_id") == run_id])
    return None


class EditorialLedger:
    def __init__(self, path: Path, run_id: str, *, next_seq: int = 1) -> None:
        self.path = Path(path)
        self.run_id = run_id
        self._seq = next_seq
        self._lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    @classmethod
    def resume(cls, path: Path, run: ResumableRun) -> "EditorialLedger":
        return cls(path, run.run_id, next_seq=len(run.records) + 1)

    def append(
        self,
        kind: str,
        *,
        actor: str,
        to: str = "",
        refs: list[str] | tuple[str, ...] = (),
        **data: Any,
    ) -> dict[str, Any]:
        with self._lock:
            record = {
                "id": f"{self.run_id}-{self._seq:05d}",
                "run_id": self.run_id,
                "at": now_iso(),
                "kind": kind,
                "from": actor,
                "to": to,
                "refs": [str(ref) for ref in refs],
                **data,
            }
            self._seq += 1
            line = json.dumps(record, ensure_ascii=False, sort_keys=True)
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")
                handle.flush()
                os.fsync(handle.fileno())
            return record


__all__ = [
    "EditorialLedger",
    "KIND_DECISION",
    "KIND_DISPUTE",
    "KIND_ISSUE_ESCALATE",
    "KIND_ISSUE_OPEN",
    "KIND_ISSUE_RESOLVE",
    "KIND_REVIEW_DONE",
    "KIND_RUN_END",
    "KIND_RUN_START",
    "KIND_TERM_DECISION",
    "KIND_TERM_REQUEST",
    "LEDGER_RELATIVE_PATH",
    "ROLE_CHIEF",
    "ROLE_HUMAN",
    "ROLE_QA",
    "ROLE_REVIEWER",
    "ROLE_REVISER",
    "ROLE_RULES",
    "ROLE_TERMS",
    "ResumableRun",
    "find_resumable_run",
    "ledger_path",
    "new_run_id",
    "read_ledger",
]
