"""Offline, fixed-dispatch comparison evidence. Never exports captured text."""
import json

from tools.analysis.inspect_capture import load_capture
from retainpdf_pipeline.translate.llm.shared.request_capture import digest


SCHEMA = "translation_benchmark_evidence_v1"
REPORT_HASHES = ("pdf_sha256", "normalized_document_sha256", "translation_config_sha256", "cache_policy_sha256")
SCOPE = ("Fixed post-grouping/dedup/skip dispatch inputs and reported configuration only. "
         "Engine/prompt identity may change; strategy, batch layout, context and model connection must not. "
         "This does not prove equal pre-plan work, provider cache temperature or causality from a single pair.")


def is_digest(value):
    return isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdef" for c in value)


def read_evidence(report_path, report):
    issues = []
    fingerprints = {}
    evidence = report.get("comparison_evidence")
    if not isinstance(evidence, dict) or evidence.get("schema") != SCHEMA:
        issues.append("missing_or_invalid_report_evidence")
        evidence = {}
    for field in REPORT_HASHES:
        if is_digest(evidence.get(field)):
            fingerprints[field] = evidence[field]
        else:
            issues.append("missing_or_invalid_" + field)
    executor = report.get("model_executor")
    connection = executor.get("configuration_fingerprint") if isinstance(executor, dict) else None
    if is_digest(connection):
        fingerprints["connection_sha256"] = connection
    else:
        issues.append("missing_or_invalid_connection_fingerprint")
    strategy = report.get("strategy")
    if isinstance(strategy, str) and strategy in {"baseline", "page_local_v1"}:
        fingerprints["strategy"] = strategy
    else:
        issues.append("missing_or_invalid_strategy")
    try:
        plans, requests = load_capture(report_path.parent / "private-inputs")
        if len(plans) != 1:
            raise ValueError("ambiguous dispatch plan")
        plan = next(iter(plans.values()))
        engine = plan["engine_identity"]
        batches = plan.get("batches")
        if (not isinstance(engine, dict) or not engine or not isinstance(plan.get("context"), dict)
                or not isinstance(batches, list) or not batches
                or any(not isinstance(batch, list) or not batch
                       or any(not isinstance(item, dict) for item in batch) for batch in batches)):
            raise ValueError("incomplete dispatch plan")
        fingerprints["dispatch_input_sha256"] = plan["input_sha256"]
        fingerprints["engine_identity_sha256"] = digest(engine)
        if engine.get("connection_fingerprint") != connection or not is_digest(connection):
            issues.append("plan_connection_mismatch")
        if engine.get("optimization") != strategy:
            issues.append("plan_strategy_mismatch")
        if any(plan.get(field) != report.get(field) for field in ("model", "workers")):
            issues.append("plan_report_configuration_mismatch")
        if any(request.get("connection_fingerprint") != connection for request in requests):
            issues.append("request_connection_mismatch")
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        issues.append("missing_or_invalid_capture")
    # A historical standalone publication may have no checkpoint. If one exists,
    # its source identity must corroborate the generator's source fingerprint.
    job_id = report.get("job_id")
    if not isinstance(job_id, str) or job_id in {"", ".", ".."} or "/" in job_id or "\\" in job_id:
        issues.append("invalid_job_id")
    else:
        marker = report_path.parent / "data/jobs" / job_id / "translated/translation-checkpoint.v1.json"
        if marker.exists():
            try:
                checkpoint = json.loads(marker.read_text())
                if (not is_digest(checkpoint.get("normalized_document_sha256"))
                        or checkpoint["normalized_document_sha256"] != evidence.get("normalized_document_sha256")):
                    issues.append("checkpoint_source_mismatch")
            except (OSError, ValueError, TypeError, AttributeError):
                issues.append("invalid_checkpoint_evidence")
    return {"available": not issues, "issues": issues, "fingerprints": fingerprints}


def compare_evidence(baseline_path, baseline, candidate_path, candidate):
    sides = {"baseline": read_evidence(baseline_path, baseline),
             "candidate": read_evidence(candidate_path, candidate)}
    before, after = (sides[side]["fingerprints"] for side in ("baseline", "candidate"))
    differences = [key for key in sorted(before.keys() & after.keys()) if before[key] != after[key]]
    forbidden = [key for key in differences if key != "engine_identity_sha256"]
    complete = all(side["available"] for side in sides.values())
    return {"comparable": complete and not forbidden,
            "status": "insufficient_evidence" if not complete else "different_inputs" if forbidden else "comparable",
            "differences": differences, "disallowed_differences": forbidden, "evidence": sides, "scope": SCOPE}
