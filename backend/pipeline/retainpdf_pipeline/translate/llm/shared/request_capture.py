"""Opt-in private, immutable benchmark inputs. Never captures transport credentials."""
from dataclasses import asdict, is_dataclass
import hashlib
import json
import os
from pathlib import Path
import tempfile
import threading

ENV = "RETAIN_TRANSLATION_CAPTURE_DIR"
_plans = {}
_lock = threading.Lock()
ITEM_FIELDS = frozenset("""item_id page_idx block_idx reading_order block_type block_kind
block_class layout_role semantic_role structure_role policy_translate source_text
protected_source_text formula_map protected_map math_mode continuation_group
translation_unit_id translation_unit_kind translation_unit_member_ids translation_unit_members
translation_unit_protected_source_text translation_unit_formula_map translation_unit_protected_map
translation_style_hint translation_context_mode translation_context_before translation_context_after
continuation_prev_text continuation_next_text text_flow source_line_texts toc_entries
_batched_plain_candidate _scoped_terms_guidance""".split())
CONTEXT_FIELDS = ("mode", "source_lang", "target_lang", "target_language_name", "domain_guidance",
                  "rule_guidance", "extra_guidance", "context_mode", "glossary_mode", "memory_mode",
                  "glossary_entries", "abbreviation_entries", "retrieval_entries", "placeholder_policy",
                  "segmentation_policy", "fallback_policy", "timeout_policy", "batch_policy")


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def plan_input_digest(payload):
    # Prompt versions may change in an A/B run; all dispatch inputs/settings must not.
    return digest({k: v for k, v in payload.items() if k not in {"engine_identity", "scope", "input_sha256"}})


def directory():
    raw = os.environ.get(ENV, "")
    if not raw:
        return None
    if not hasattr(os, "getuid"):
        raise ValueError("private capture currently requires POSIX owner permissions")
    path = Path(raw)
    if not path.is_absolute() or path in (Path("/"), Path.home(), Path.cwd()):
        raise ValueError("capture requires a dedicated absolute directory")
    # Do not follow user-supplied symlinks or silently change an existing folder's permissions.
    if any(p.is_symlink() for p in (path, *path.parents)):
        raise ValueError("capture directory must not contain symlinks")
    path.mkdir(mode=0o700, exist_ok=True)
    st = path.stat()
    if st.st_mode & 0o077 or st.st_uid != os.getuid():
        raise ValueError("capture directory must be private and owned by this user")
    return path


def persist(root, name, payload):
    envelope = {"sha256": digest(payload), "payload": payload}
    data = encoded(envelope)
    target = root / name
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=root, prefix=".capture-", delete=False) as stream:
            temporary = Path(stream.name)
            os.fchmod(stream.fileno(), 0o600)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(temporary, target)  # Atomic publication, never overwrite an older input.
        except FileExistsError:
            if target.is_symlink() or target.read_bytes() != data:
                raise ValueError("capture identity already exists with different content") from None
        directory_fd = os.open(root, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return envelope["sha256"]


def capture_plan(batches, *, workers, mode, model, domain_guidance, context):
    root = directory()
    if root is None:
        return
    settings = {}
    from retainpdf_pipeline.translate.core.engine_identity import translation_engine_identity
    for key in CONTEXT_FIELDS:
        value = getattr(context, key, None)
        if is_dataclass(value):
            value = asdict(value)
        elif isinstance(value, list):
            value = [asdict(v) if is_dataclass(v) else v for v in value]
        settings[key] = value
    payload = {"schema": "translation_dispatch_plan_v1", "workers": workers, "mode": mode,
               "engine_identity": translation_engine_identity(mode=mode),
               "model": model, "domain_guidance": domain_guidance, "context": settings,
               "batches": [[{k: v for k, v in item.items() if k in ITEM_FIELDS} for item in batch]
                           for batch in batches],
               "scope": "Post-grouping/dedup/skip dispatch plan, in queue priority order. "
                        "Actual runtime guidance is captured in request messages; completion order is not frozen."}
    payload["input_sha256"] = plan_input_digest(payload)
    identity = persist(root, "plan-" + digest(payload) + ".json", payload)
    with _lock:
        _plans[str(root)] = identity


def capture_request(*, operation_id, unit_id, purpose, messages, temperature, response_format):
    root = directory()
    if root is None:
        return
    with _lock:
        plan = _plans.get(str(root))
    payload = {"schema": "translation_request_input_v1", "plan_sha256": plan,
               "connection_fingerprint": os.environ.get("RETAIN_MODEL_CONNECTION_FINGERPRINT", ""),
               "operation_id": operation_id, "unit_id": unit_id, "purpose": purpose,
               "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
               "temperature": temperature, "response_format": response_format,
               "scope": "Exact Python executor input before submission, not an upstream receipt. "
                        "Rust applies the frozen model connection and provider policy separately."}
    persist(root, "request-" + digest(operation_id) + ".json", payload)
