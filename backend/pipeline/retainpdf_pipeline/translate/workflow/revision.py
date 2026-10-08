"""单块译文修订写回:校验 → 原子改写页 payload → 推进 checkpoint → 追加修订记录。

调用方(Rust)负责鉴权、「任务在跑就拒绝」和触发重渲染;这里只负责产物。
校验用的是翻译时同一套 ``review_translation_item``(占位符、公式定界符、
英文残留、协议壳……),不另写一份。

一致性约定:
- 所有页文件、checkpoint、修订日志都是「先写临时文件再 rename」。
- 跨多个文件没有原子 rename,所以先把旧字节留在内存里,任何一步失败都按
  原样写回,再把异常抛给调用方。进程在两次 rename 之间被杀掉的情况,
  由 checkpoint 的 generation 快照兜底:下次续跑 ``restore_committed_pages``
  会把页文件恢复到 checkpoint 记录的那一版;渲染读取时按 page_hash 校验,
  不会读到半写的状态。
- checkpoint 的 generation 单调加一,新建这一 generation 的快照目录;旧的快照
  保留(原因见 ``_revise_locked`` 末尾)。
"""

from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import shutil
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from retainpdf_pipeline.translate.core.item_reader import item_source_text
from retainpdf_pipeline.translate.core.payload.manifest import load_translation_manifest
from retainpdf_pipeline.translate.core.payload.parts.apply import apply_revised_member_text
from retainpdf_pipeline.translate.core.payload.parts.apply import apply_revised_unit_text
from retainpdf_pipeline.translate.core.payload.parts.common import is_group_unit_id
from retainpdf_pipeline.translate.core.payload.parts.common import translation_unit_member_ids
from retainpdf_pipeline.translate.core.payload.parts.diagnostics import record_translation_diagnostics
from retainpdf_pipeline.translate.core.payload.formula_protection import re_protect_restored_formulas
from retainpdf_pipeline.translate.core.placeholder_tokens import placeholders
from retainpdf_pipeline.translate.llm.validation.quality import review_translation_item
from retainpdf_pipeline.translate.workflow.checkpoint.contract import advance_checkpoint
from retainpdf_pipeline.translate.workflow.checkpoint.contract import now_iso
from retainpdf_pipeline.translate.workflow.checkpoint.contract import project_progress
from retainpdf_pipeline.translate.workflow.checkpoint.contract import translation_checkpoint_path
from retainpdf_pipeline.translate.workflow.checkpoint.contract import validate_checkpoint
from retainpdf_pipeline.translate.workflow.checkpoint.store import CHECKPOINT_SNAPSHOTS_DIR_NAME
from retainpdf_pipeline.translate.workflow.checkpoint.store import CheckpointStore

TRANSLATION_REVISIONS_FILE_NAME = "revisions.v1.jsonl"
TRANSLATION_REVISION_SCHEMA = "translation_revision_v1"
TRANSLATION_REVISION_SCHEMA_VERSION = 1
REVISION_SOURCES = ("user", "agent", "refine")
MAX_REVISION_TEXT_CHARS = 20000
MAX_REVISION_REASON_CHARS = 2000

_CJK_RE = re.compile(r"[⺀-鿿　-〿＀-￯]")


class RevisionOutcome(Exception):
    """可预期的拒绝(找不到、冲突、校验失败)。CLI 把它变成结构化输出。"""

    def __init__(self, outcome: str, reason: str, message: str, **extra: Any) -> None:
        super().__init__(message)
        self.outcome = outcome
        self.reason = reason
        self.message = message
        self.extra = extra

    def as_dict(self) -> dict[str, Any]:
        return {
            "outcome": self.outcome,
            "reason": self.reason,
            "message": self.message,
            **self.extra,
        }


@dataclass(frozen=True)
class RevisionRequest:
    item_id: str
    translated_text: str
    source: str
    reason: str = ""
    expected_generation: int | None = None


def translation_revisions_path(translations_dir: Path) -> Path:
    return Path(translations_dir) / TRANSLATION_REVISIONS_FILE_NAME


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _fsync_dir(path: Path) -> None:
    try:
        fd = os.open(path, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _atomic_write_bytes(path: Path, data: bytes) -> None:
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, path)
        _fsync_dir(path.parent)
    except BaseException:
        try:
            tmp_path.unlink()
        except FileNotFoundError:
            pass
        raise


def _page_bytes(items: list[dict]) -> bytes:
    # 与 core/payload/translations.py::save_translations 同一种序列化。
    return json.dumps(items, ensure_ascii=False, indent=2).encode("utf-8")


def _validation_summary(issues: list[dict[str, Any]]) -> dict[str, Any]:
    errors = [issue for issue in issues if issue.get("severity") == "error"]
    return {
        "passed": not errors,
        "error_count": len(errors),
        "warning_count": len(issues) - len(errors),
        "issues": issues,
    }


def _load_glossary_entries(job_root: Path) -> list[dict]:
    spec_path = job_root / "specs" / "translate.spec.json"
    try:
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    entries = ((spec.get("params") or {}) if isinstance(spec, dict) else {}).get("glossary_entries")
    return list(entries) if isinstance(entries, list) else []


def _join_unit_text(texts: list[str]) -> str:
    joined = ""
    for text in (str(value or "").strip() for value in texts):
        if not text:
            continue
        if joined and not (_CJK_RE.match(joined[-1]) and _CJK_RE.match(text[0])):
            joined += " "
        joined += text
    return joined


def _normalize_request(request: RevisionRequest) -> RevisionRequest:
    if request.source not in REVISION_SOURCES:
        raise RevisionOutcome(
            "invalid", "invalid_source", f"source must be one of {', '.join(REVISION_SOURCES)}"
        )
    text = str(request.translated_text or "")
    if len(text) > MAX_REVISION_TEXT_CHARS:
        raise RevisionOutcome(
            "invalid", "text_too_long", f"translated_text exceeds {MAX_REVISION_TEXT_CHARS} characters"
        )
    reason = str(request.reason or "").strip()
    if len(reason) > MAX_REVISION_REASON_CHARS:
        raise RevisionOutcome(
            "invalid", "reason_too_long", f"reason exceeds {MAX_REVISION_REASON_CHARS} characters"
        )
    return RevisionRequest(
        item_id=str(request.item_id or "").strip(),
        translated_text=text.strip(),
        source=request.source,
        reason=reason,
        expected_generation=request.expected_generation,
    )


def _load_committed_checkpoint(checkpoint_path: Path) -> dict[str, Any]:
    if not checkpoint_path.is_file():
        raise RevisionOutcome(
            "conflict",
            "translation_not_committed",
            "Translation checkpoint is missing; only committed translations can be revised",
        )
    checkpoint = validate_checkpoint(
        json.loads(checkpoint_path.read_text(encoding="utf-8")), path=checkpoint_path
    )
    if checkpoint.get("status") != "complete" or checkpoint.get("phase") != "committed":
        raise RevisionOutcome(
            "conflict",
            "translation_not_committed",
            "Translation is not committed yet; finish or resume translation before revising",
        )
    if not isinstance(checkpoint.get("generation"), int) or not isinstance(checkpoint.get("pages"), list):
        raise RevisionOutcome(
            "conflict", "translation_not_committed", "Translation checkpoint has no durable identity"
        )
    return checkpoint


def _verify_publication(translations_dir: Path, checkpoint: dict[str, Any]) -> None:
    for page in checkpoint["pages"]:
        path = translations_dir / Path(str(page.get("path", "") or "")).name
        expected = str(page.get("page_hash", "") or "")
        if not path.is_file() or (expected and _sha256(path.read_bytes()) != expected):
            raise RevisionOutcome(
                "conflict",
                "publication_inconsistent",
                f"Translation page does not match its committed checkpoint: {path.name}",
            )


def _find_item(payloads: dict[int, list[dict]], item_id: str) -> tuple[int, dict]:
    for page_idx in sorted(payloads):
        for item in payloads[page_idx]:
            if str(item.get("item_id", "") or "") == item_id:
                return page_idx, item
    raise RevisionOutcome("not_found", "item_not_found", f"translation item not found: {item_id}")


def _unit_members(payloads: dict[int, list[dict]], item: dict) -> list[tuple[int, dict]]:
    unit_id = str(item.get("translation_unit_id", "") or "")
    member_ids = translation_unit_member_ids(item)
    if not is_group_unit_id(unit_id) or len(member_ids) <= 1:
        return []
    by_id = {
        str(candidate.get("item_id", "") or ""): (page_idx, candidate)
        for page_idx, items in payloads.items()
        for candidate in items
        if str(candidate.get("translation_unit_id", "") or "") == unit_id
    }
    if set(member_ids) - set(by_id):
        raise RevisionOutcome(
            "conflict",
            "group_members_missing",
            f"Translation group {unit_id} has members outside the committed pages",
        )
    return [by_id[member_id] for member_id in member_ids]


def _protected_form(item: dict, text: str, *, source_text: str) -> str:
    # 修订者通常拿到的是展示文本。占位符模式下原文带占位符、修订文本里一个都
    # 没有时,按公式表把公式换回占位符,再交给同一套占位符校验。
    if not placeholders(source_text) or placeholders(text):
        return text
    formula_map = item.get("formula_map") or item.get("translation_unit_formula_map") or []
    return re_protect_restored_formulas(text, formula_map) if formula_map else text


def _review(item: dict, translated_text: str, glossary_entries: list[dict]) -> dict[str, Any]:
    report = review_translation_item(
        item,
        {"decision": "translate", "translated_text": translated_text},
        glossary_entries=glossary_entries,
    )
    return _validation_summary([issue.as_dict() for issue in report.issues])


def _snapshot_dir(translations_dir: Path, generation: int) -> Path:
    return translations_dir / CHECKPOINT_SNAPSHOTS_DIR_NAME / f"generation-{generation}"


def _read_revision_lines(path: Path) -> bytes:
    try:
        return path.read_bytes()
    except FileNotFoundError:
        return b""


def revise_translation_item(job_root: Path, request: RevisionRequest) -> dict[str, Any]:
    """校验并写回一个块的译文。返回结构化结果;可预期的拒绝抛 ``RevisionOutcome``。"""

    request = _normalize_request(request)
    job_root = Path(job_root).resolve()
    translations_dir = job_root / "translated"
    checkpoint_path = translation_checkpoint_path(translations_dir)
    store = CheckpointStore(checkpoint_path)
    try:
        store.acquire()
    except RuntimeError as exc:
        raise RevisionOutcome("conflict", "checkpoint_locked", str(exc)) from exc
    try:
        return _revise_locked(job_root, translations_dir, store, request)
    finally:
        store.close()


def _revise_locked(
    job_root: Path,
    translations_dir: Path,
    store: CheckpointStore,
    request: RevisionRequest,
) -> dict[str, Any]:
    checkpoint_path = store.path
    checkpoint = _load_committed_checkpoint(checkpoint_path)
    generation = int(checkpoint["generation"])
    if request.expected_generation is not None and request.expected_generation != generation:
        raise RevisionOutcome(
            "conflict",
            "generation_mismatch",
            f"Translation changed since generation {request.expected_generation}; current is {generation}",
            current_generation=generation,
        )
    _verify_publication(translations_dir, checkpoint)
    translation_paths = load_translation_manifest(translations_dir)
    original_bytes = {page_idx: path.read_bytes() for page_idx, path in translation_paths.items()}
    payloads = {page_idx: json.loads(raw) for page_idx, raw in original_bytes.items()}
    page_idx, item = _find_item(payloads, request.item_id)
    if not item.get("should_translate", True):
        raise RevisionOutcome(
            "rejected",
            "item_not_translatable",
            "This block is kept as original by translation policy and cannot be revised",
            validation=_validation_summary([]),
        )

    members = _unit_members(payloads, item)
    unit_source = item_source_text(item)
    new_text = _protected_form(item, request.translated_text, source_text=unit_source)
    previous_text = str(item.get("protected_translated_text") or item.get("translated_text") or "")

    # 在副本上算出修订后的状态再校验;校验不过就一个字节都不写。
    revised = copy.deepcopy(payloads)
    revised_item = _find_item(revised, request.item_id)[1]
    apply_revised_member_text(revised_item, new_text, single_unit=not members)
    if members:
        revised_members = [_find_item(revised, str(member.get("item_id")))[1] for _idx, member in members]
        unit_text = _join_unit_text(
            [str(member.get("protected_translated_text") or "") for member in revised_members]
        )
        apply_revised_unit_text(revised_members, unit_text)
        reviewed_text = unit_text
    else:
        reviewed_text = new_text
    glossary_entries = _load_glossary_entries(job_root)
    validation = _review(revised_item, reviewed_text, glossary_entries)
    if not validation["passed"]:
        raise RevisionOutcome(
            "rejected",
            "validation_failed",
            "Revised translation failed validation: "
            + ", ".join(sorted({issue["kind"] for issue in validation["issues"] if issue["severity"] == "error"})),
            validation=validation,
        )

    item_view = {
        "item_id": request.item_id,
        "page_idx": page_idx,
        "translation_unit_id": str(revised_item.get("translation_unit_id", "") or ""),
        "unit_source_text": unit_source,
        "translated_text": str(revised_item.get("translated_text", "") or ""),
        "protected_translated_text": new_text,
        "final_status": str(revised_item.get("final_status", "") or ""),
    }
    if new_text == previous_text and str(item.get("final_status", "") or "") == item_view["final_status"]:
        return {
            "outcome": "unchanged",
            "changed": False,
            "item": item_view,
            "generation": generation,
            "validation": validation,
            "revision": None,
            "page_hashes": {},
        }

    revision_id = f"rev-{uuid.uuid4().hex}"
    record_translation_diagnostics(
        revised_item,
        "manual_revision",
        {"manual_revision_id": revision_id, "manual_revision_source": request.source},
    )
    changed_pages = sorted(
        {page_idx, *(member_page for member_page, _member in members)}
    )
    new_bytes = {idx: _page_bytes(revised[idx]) for idx in changed_pages}
    new_generation = generation + 1
    revisions_path = translation_revisions_path(translations_dir)
    original_checkpoint = checkpoint_path.read_bytes()
    original_revisions = _read_revision_lines(revisions_path)
    new_snapshot_dir = _snapshot_dir(translations_dir, new_generation)
    snapshot_preexisted = new_snapshot_dir.exists()

    record = {
        "schema": TRANSLATION_REVISION_SCHEMA,
        "schema_version": TRANSLATION_REVISION_SCHEMA_VERSION,
        "revision_id": revision_id,
        "item_id": request.item_id,
        "page_idx": page_idx,
        "translation_unit_id": item_view["translation_unit_id"],
        "ts": now_iso(),
        "source": request.source,
        "reason": request.reason,
        "previous_text": previous_text,
        "new_text": new_text,
        "previous_final_status": str(item.get("final_status", "") or ""),
        "validation": {
            key: validation[key] for key in ("passed", "error_count", "warning_count")
        }
        | {"issue_kinds": sorted({issue["kind"] for issue in validation["issues"]})},
        "previous_generation": generation,
        "generation": new_generation,
        "page_hashes": {
            translation_paths[idx].name: _sha256(new_bytes[idx]) for idx in changed_pages
        },
    }

    try:
        for idx in changed_pages:
            _atomic_write_bytes(translation_paths[idx], new_bytes[idx])
        pages, progress = project_progress(
            output_dir=translations_dir,
            page_payloads=copy.deepcopy(revised),
            translation_paths=translation_paths,
        )
        checkpoint = advance_checkpoint(checkpoint, phase="committed", pages=pages, progress=progress)
        checkpoint["status"] = "complete"
        checkpoint["generation"] = new_generation
        checkpoint["committed_pages"] = []
        checkpoint["committed_pages_event"] = {
            **(checkpoint.get("committed_pages_event") or {}),
            "schema": "pipeline_checkpoint_v1",
            "schema_version": 1,
            "stage": "translate",
            "phase": "committed",
            "status": "complete",
            "producer_generation": new_generation,
            "committed_pages": [],
            "progress": progress,
        }
        store.snapshot_pages(checkpoint)
        store.save(checkpoint)
        _atomic_write_bytes(
            revisions_path,
            original_revisions
            + (b"" if not original_revisions or original_revisions.endswith(b"\n") else b"\n")
            + json.dumps(record, ensure_ascii=False).encode("utf-8")
            + b"\n",
        )
    except BaseException:
        _rollback(
            translation_paths=translation_paths,
            changed_pages=changed_pages,
            original_bytes=original_bytes,
            checkpoint_path=checkpoint_path,
            original_checkpoint=original_checkpoint,
            revisions_path=revisions_path,
            original_revisions=original_revisions,
            new_snapshot_dir=None if snapshot_preexisted else new_snapshot_dir,
        )
        raise
    # 旧 generation 的快照这里**不清理**。Rust 的实时译文读模型按数据库里登记的
    # page_hash 去 .translation-checkpoints/ 下找快照(services/jobs/live_translation.rs);
    # 修订不经过 worker stdout,要等 Rust 在本命令返回后把新 page_hash 登记进数据库
    # (live_translation/revisions.rs),登记成功前读模型要的还是旧快照。登记完成后
    # 由 Rust 清掉不再被引用的旧 generation;登记失败时它们留着,读模型照旧可读。
    return {
        "outcome": "committed",
        "changed": True,
        "item": item_view,
        "generation": new_generation,
        "validation": validation,
        "revision": record,
        "page_hashes": record["page_hashes"],
    }


def _rollback(
    *,
    translation_paths: dict[int, Path],
    changed_pages: list[int],
    original_bytes: dict[int, bytes],
    checkpoint_path: Path,
    original_checkpoint: bytes,
    revisions_path: Path,
    original_revisions: bytes,
    new_snapshot_dir: Path | None,
) -> None:
    for idx in changed_pages:
        _atomic_write_bytes(translation_paths[idx], original_bytes[idx])
    _atomic_write_bytes(checkpoint_path, original_checkpoint)
    if original_revisions:
        _atomic_write_bytes(revisions_path, original_revisions)
    elif revisions_path.exists():
        revisions_path.unlink()
    if new_snapshot_dir is not None and new_snapshot_dir.is_dir() and not new_snapshot_dir.is_symlink():
        shutil.rmtree(new_snapshot_dir)


def load_item_revisions(translations_dir: Path, item_id: str) -> list[dict[str, Any]]:
    path = translation_revisions_path(translations_dir)
    records: list[dict[str, Any]] = []
    for line in _read_revision_lines(path).decode("utf-8").splitlines():
        if not line.strip():
            continue
        record = json.loads(line)
        if isinstance(record, dict) and record.get("item_id") == item_id:
            records.append(record)
    return records


__all__ = [
    "REVISION_SOURCES",
    "RevisionOutcome",
    "RevisionRequest",
    "TRANSLATION_REVISIONS_FILE_NAME",
    "load_item_revisions",
    "revise_translation_item",
    "translation_revisions_path",
]
