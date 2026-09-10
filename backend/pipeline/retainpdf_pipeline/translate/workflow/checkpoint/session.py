from __future__ import annotations

import json
import time
from functools import wraps
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable

from .contract import (
    advance_checkpoint,
    commit_checkpoint,
    committed_pages_for_changes,
    new_checkpoint,
    project_progress,
    translation_checkpoint_path,
    validate_checkpoint,
)
from .contract import (
    changed_item_ids_by_page as diff_changed_item_ids_by_page,
)
from .identity import build_translation_identity
from .store import CheckpointStore

if TYPE_CHECKING:
    from retainpdf_pipeline.translate.workflow.execution import (
        TranslationExecutionRequest,
    )
    from retainpdf_pipeline.translate.workflow.execution_plan import (
        TranslationExecutionPlan,
    )


class ResumeCandidateFingerprintMismatch(RuntimeError):
    def __init__(self, source_attempt_id: str) -> None:
        super().__init__(
            "Copied translation checkpoint fingerprint does not match the new attempt"
        )
        self.source_attempt_id = source_attempt_id


def _timed(stage: str):
    def decorate(function):
        @wraps(function)
        def measured(self, *args, **kwargs):
            return self._measure(stage, function, self, *args, **kwargs)
        return measured
    return decorate


class TranslationCheckpointSession:
    def __init__(
        self,
        *,
        output_dir: Path,
        identity: dict[str, Any],
        attempt_id: str,
    ) -> None:
        self.output_dir = Path(output_dir)
        self.identity = identity
        self.attempt_id = attempt_id
        self.store = CheckpointStore(translation_checkpoint_path(self.output_dir))
        self._owns_store = True
        self.payload: dict[str, Any] | None = None
        self.on_pages_committed: Callable[[list[dict[str, Any]]], None] | None = None
        self._timings = {
            stage: {"count": 0, "failed_count": 0, "elapsed_ns": 0}
            for stage in ("update", "projection", "change_validation", "persist", "snapshot", "save", "observer", "prune", "event")
        }

    def _measure(self, stage, function, *args, **kwargs):
        timing = self._timings[stage]
        started = time.perf_counter_ns()
        try:
            result = function(*args, **kwargs)
        except BaseException:
            timing["failed_count"] += 1
            raise
        else:
            timing["count"] += 1
            return result
        finally:
            timing["elapsed_ns"] += max(0, time.perf_counter_ns() - started)

    def metrics(self) -> dict[str, int | float]:
        """Inclusive timings, including failed attempts; never checkpoint fields."""
        return {
            key: value
            for stage, timing in self._timings.items()
            for key, value in (
                (f"{stage}_count", timing["count"]),
                (f"{stage}_failed_count", timing["failed_count"]),
                (f"{stage}_elapsed_ms", timing["elapsed_ns"] / 1_000_000),
            )
        }

    @classmethod
    def acquire(
        cls,
        request: TranslationExecutionRequest,
        plan: TranslationExecutionPlan,
        *,
        store: CheckpointStore | None = None,
    ) -> "TranslationCheckpointSession":
        output_dir = Path(request.output_dir)
        session = cls(
            output_dir=output_dir,
            identity=build_translation_identity(request, plan),
            attempt_id=output_dir.parent.name or output_dir.name,
        )
        if store is None:
            session.store.acquire()
        else:
            store.require_owned_path(session.store.path)
            session.store = store
            session._owns_store = False
        try:
            session._initialize()
        except BaseException:
            session.close()
            raise
        return session

    def _initialize(self) -> None:
        loaded = self.store.load()
        previous = (
            validate_checkpoint(loaded, path=self.store.path)
            if loaded is not None
            else None
        )
        if previous is not None:
            self.store.restore_committed_pages(previous)
        if previous is not None and previous.get("fingerprint") != self.identity["fingerprint"]:
            previous_attempt = str(previous.get("attempt_id", "") or "")
            if previous_attempt and previous_attempt != self.attempt_id:
                raise ResumeCandidateFingerprintMismatch(previous_attempt)
            raise RuntimeError("Translation checkpoint fingerprint mismatch within the same attempt")
        if previous is not None:
            self._replay_durable_checkpoint(previous)
        self.payload = new_checkpoint(
            identity=self.identity,
            attempt_id=self.attempt_id,
            previous=previous,
        )
        self._persist(committed_pages=[])

    @_timed("update")
    def update(
        self,
        phase: str,
        page_payloads: dict[int, list[dict]],
        translation_paths: dict[int, Path],
        changed_item_ids_by_page: dict[int, set[str]] | None = None,
        *,
        detect_item_changes: bool = False,
    ) -> None:
        if self.payload is None:
            raise RuntimeError("Translation checkpoint session is not initialized")
        previous_pages = [
            dict(page)
            for page in self.payload.get("pages", [])
            if isinstance(page, dict)
        ]
        pages, progress = self._measure("projection", project_progress,
            output_dir=self.output_dir,
            page_payloads=page_payloads,
            translation_paths=translation_paths,
        )
        committed_changes = self._measure(
            "change_validation", self._reconcile_changes,
            previous_pages, pages, changed_item_ids_by_page, detect_item_changes,
        )
        advance_checkpoint(
            self.payload,
            phase=str(phase),
            pages=pages,
            progress=progress,
        )
        self._persist(
            committed_pages=committed_pages_for_changes(pages, committed_changes)
        )

    def _reconcile_changes(self, previous_pages, pages, changed_item_ids_by_page, detect_item_changes):
        derived_changes = diff_changed_item_ids_by_page(previous_pages, pages)
        if changed_item_ids_by_page is not None:
            committed_changes = self._validate_change_hint(
                previous_pages=previous_pages,
                pages=pages,
                derived_changes=derived_changes,
                hinted_changes=changed_item_ids_by_page,
            )
        elif detect_item_changes:
            committed_changes = derived_changes
        else:
            committed_changes = {}
        return committed_changes

    def complete(self, manifest_path: Path) -> None:
        if self.payload is None:
            raise RuntimeError("Translation checkpoint session is not initialized")
        commit_checkpoint(
            self.payload,
            manifest_name=Path(manifest_path).name,
        )
        self._persist(committed_pages=[])

    def _validate_change_hint(
        self,
        *,
        previous_pages: list[dict[str, Any]],
        pages: list[dict[str, Any]],
        derived_changes: dict[int, set[str]],
        hinted_changes: dict[int, set[str]],
    ) -> dict[int, set[str]]:
        normalized = {
            int(page_idx): {str(item_id) for item_id in item_ids if str(item_id)}
            for page_idx, item_ids in hinted_changes.items()
            if item_ids
        }
        current_fingerprints = {
            int(page.get("page_index", -1)): page.get("item_fingerprints", {})
            for page in pages
            if isinstance(page, dict)
        }
        for page_idx, item_ids in normalized.items():
            available = current_fingerprints.get(page_idx)
            if not isinstance(available, dict):
                raise RuntimeError(f"Changed translation page is missing: {page_idx}")
            missing = sorted(item_ids - set(available))
            if missing:
                raise RuntimeError(
                    f"Changed translation items are missing from page {page_idx}: "
                    + ", ".join(missing[:8])
                )

        # Old v1 checkpoints did not have item fingerprints. Trust the precise
        # in-process hint for those pages once, then the newly persisted
        # fingerprints become authoritative for every later flush/restart.
        previous_fingerprints = {
            int(page.get("page_index", -1)): page.get("item_fingerprints")
            for page in previous_pages
            if isinstance(page, dict)
        }
        comparable_pages = {
            page_idx
            for page_idx, fingerprints in previous_fingerprints.items()
            if isinstance(fingerprints, dict)
        }
        reconciled = {
            page_idx: set(item_ids)
            for page_idx, item_ids in normalized.items()
            if page_idx not in comparable_pages
        }
        # Once a durable baseline exists, the page bytes and their item
        # fingerprints are authoritative. This both fills any missed expanded
        # member and drops transient changes that returned to their old value
        # before the batch was flushed.
        for page_idx, item_ids in derived_changes.items():
            if page_idx in comparable_pages and item_ids:
                reconciled[page_idx] = set(item_ids)
        return reconciled

    @_timed("persist")
    def _persist(self, *, committed_pages: list[dict[str, Any]]) -> None:
        if self.payload is None:
            raise RuntimeError("Translation checkpoint session is not initialized")
        self.payload["generation"] = int(self.payload.get("generation", 0) or 0) + 1
        self.payload["committed_pages"] = [dict(page) for page in committed_pages]
        event_payload = self._event_payload(
            payload=self.payload,
            committed_pages=committed_pages,
            producer_generation=int(self.payload["generation"]),
        )
        self.payload["committed_pages_event"] = event_payload
        self._measure("snapshot", self.store.snapshot_pages, self.payload)
        self._measure("save", self.store.save, self.payload)
        if self.on_pages_committed is not None:
            self._measure("observer", self.on_pages_committed, committed_pages)
        self._measure("prune", self.store.prune_snapshots, int(self.payload["generation"]))
        self._measure("event", self._emit_pipeline_checkpoint, event_payload)

    @staticmethod
    def _event_payload(
        *,
        payload: dict[str, Any],
        committed_pages: list[dict[str, Any]],
        producer_generation: int,
    ) -> dict[str, Any]:
        return {
            "schema": "pipeline_checkpoint_v1",
            "schema_version": 1,
            "stage": "translate",
            "phase": str(payload.get("phase", "") or ""),
            "status": str(payload.get("status", "") or ""),
            "producer_generation": int(producer_generation),
            "committed_pages": [dict(page) for page in committed_pages],
            "progress": dict(payload.get("progress", {})),
        }

    def _replay_durable_checkpoint(self, payload: dict[str, Any]) -> None:
        committed_pages = payload.get("committed_pages")
        event_payload = payload.get("committed_pages_event")
        if not isinstance(committed_pages, list) or not committed_pages:
            return
        valid_stored_event = (
            isinstance(event_payload, dict)
            and event_payload.get("schema") == "pipeline_checkpoint_v1"
            and event_payload.get("schema_version") == 1
            and event_payload.get("committed_pages") == committed_pages
            and event_payload.get("producer_generation")
            == int(payload.get("generation", 0) or 0)
        )
        if not valid_stored_event:
            event_payload = self._event_payload(
                payload=payload,
                committed_pages=[page for page in committed_pages if isinstance(page, dict)],
                producer_generation=int(payload.get("generation", 0) or 0),
            )
        self._emit_pipeline_checkpoint(dict(event_payload))

    def _emit_pipeline_checkpoint(self, payload: dict[str, Any]) -> None:
        print(
            json.dumps(
                {"event_type": "pipeline_checkpoint", "payload": payload},
                ensure_ascii=False,
            ),
            flush=True,
        )

    def close(self) -> None:
        if self._owns_store:
            self.store.close()

    def __enter__(self) -> "TranslationCheckpointSession":
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        self.close()
