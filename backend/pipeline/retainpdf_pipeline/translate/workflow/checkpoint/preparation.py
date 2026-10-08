"""译前术语预扫的逐批 checkpoint。

预扫可能有上百批模型调用，中途失败（网络、额度、进程被杀）后重跑不该从头再付一遍。
每批成功就把结果写进 translated/term-prescan.checkpoint.v1.json（原子替换），
续跑时按 batch_id + 请求指纹复用，只补跑缺的批。

文件头的 fingerprint 覆盖「切批规则 + 模型 + 端点 + 提示词版本 + 文档字节」，
对不上就整份作废重来；单批的 request_sha256 覆盖该批送给模型的全部内容。

这个文件和翻译主 checkpoint（translation-checkpoint.v1.json）同目录，由同一把
输出目录锁保护（execute_translation_request 先拿锁再建计划），所以这里不再加锁。
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .contract import now_iso
from .store import CheckpointStore

PRESCAN_CHECKPOINT_FILE_NAME = "term-prescan.checkpoint.v1.json"
PRESCAN_CHECKPOINT_SCHEMA = "term_prescan_checkpoint_v1"
PRESCAN_CHECKPOINT_SCHEMA_VERSION = 1


def prescan_checkpoint_path(translations_dir: Path) -> Path:
    return Path(translations_dir) / PRESCAN_CHECKPOINT_FILE_NAME


class PrescanCheckpoint:
    """实现 services.preparation.term_prescan.PrescanBatchStore 协议。"""

    def __init__(self, path: Path, *, fingerprint: str) -> None:
        self.path = Path(path)
        self.fingerprint = str(fingerprint)
        self._store = CheckpointStore(self.path)
        self._payload = self._load_or_new()

    def _new_payload(self) -> dict[str, Any]:
        timestamp = now_iso()
        return {
            "schema": PRESCAN_CHECKPOINT_SCHEMA,
            "schema_version": PRESCAN_CHECKPOINT_SCHEMA_VERSION,
            "fingerprint": self.fingerprint,
            "created_at": timestamp,
            "updated_at": timestamp,
            "batches": {},
        }

    def _load_or_new(self) -> dict[str, Any]:
        try:
            loaded = self._store.load()
        except RuntimeError:
            # 损坏的预扫 checkpoint 只是一份缓存，丢掉重来即可，不该让翻译失败。
            loaded = None
        if (
            isinstance(loaded, dict)
            and loaded.get("schema") == PRESCAN_CHECKPOINT_SCHEMA
            and loaded.get("schema_version") == PRESCAN_CHECKPOINT_SCHEMA_VERSION
            and loaded.get("fingerprint") == self.fingerprint
            and isinstance(loaded.get("batches"), dict)
        ):
            return loaded
        return self._new_payload()

    @property
    def completed_batch_ids(self) -> list[str]:
        return sorted(self._payload.get("batches", {}))

    def load_batch(self, batch_id: str, *, request_sha256: str) -> list[dict[str, Any]] | None:
        record = self._payload.get("batches", {}).get(str(batch_id))
        if not isinstance(record, dict) or record.get("request_sha256") != request_sha256:
            return None
        terms = record.get("terms")
        if not isinstance(terms, list):
            return None
        return [dict(item) for item in terms if isinstance(item, dict)]

    def save_batch(self, batch_id: str, *, request_sha256: str, terms: list[dict[str, Any]]) -> None:
        self._payload.setdefault("batches", {})[str(batch_id)] = {
            "request_sha256": request_sha256,
            "completed_at": now_iso(),
            "terms": [dict(item) for item in terms],
        }
        self._payload["updated_at"] = now_iso()
        self._store.save(self._payload)


__all__ = [
    "PRESCAN_CHECKPOINT_FILE_NAME",
    "PRESCAN_CHECKPOINT_SCHEMA",
    "PRESCAN_CHECKPOINT_SCHEMA_VERSION",
    "PrescanCheckpoint",
    "prescan_checkpoint_path",
]
