from __future__ import annotations

from pathlib import Path

from .contract import translation_checkpoint_path
from .contract import validate_checkpoint
from .store import CheckpointStore


def discard_copied_resume_candidate(
    output_dir: Path,
    *,
    source_attempt_id: str,
    store: CheckpointStore | None = None,
) -> None:
    """Discard only copy-on-write files after an explicit fingerprint rejection.

    The source attempt remains untouched. A checkpoint that already belongs to
    the current attempt is never eligible for this operation.
    """

    output_dir = Path(output_dir)
    current_attempt_id = output_dir.parent.name or output_dir.name
    owns_store = store is None
    if store is None:
        store = CheckpointStore(translation_checkpoint_path(output_dir))
        store.acquire()
    else:
        store.require_owned_path(translation_checkpoint_path(output_dir))
    try:
        loaded = store.load()
        if loaded is None:
            return
        checkpoint = validate_checkpoint(loaded, path=store.path)
        checkpoint_attempt = str(checkpoint.get("attempt_id", "") or "")
        if (
            not checkpoint_attempt
            or checkpoint_attempt != source_attempt_id
            or checkpoint_attempt == current_attempt_id
        ):
            raise RuntimeError(
                "Refusing to discard translation checkpoint owned by the current attempt"
            )
        for page in checkpoint.get("pages", []):
            if not isinstance(page, dict):
                raise RuntimeError("Invalid copied translation checkpoint page entry")
            relative = str(page.get("path", "") or "")
            path = Path(relative)
            file_name = path.name
            if (
                len(path.parts) != 1
                or not file_name.startswith("page-")
                or not file_name.endswith(".json")
            ):
                raise RuntimeError(
                    f"Unsafe copied translation checkpoint page path: {relative}"
                )
            candidate = output_dir / file_name
            if candidate.is_file() and not candidate.is_symlink():
                candidate.unlink()
        manifest = output_dir / "translation-manifest.json"
        if manifest.is_file() and not manifest.is_symlink():
            manifest.unlink()
        store.path.unlink()
    finally:
        if owns_store:
            store.close()
