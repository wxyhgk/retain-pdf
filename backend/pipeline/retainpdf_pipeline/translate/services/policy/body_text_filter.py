def find_narrow_body_noise_item_ids(payload: list[dict]) -> set[str]:
    # Narrow-body OCR fragments were previously skipped by layout heuristics
    # (bbox width, column inference, short-text thresholds). Those rules were
    # too brittle and could suppress legitimate body prose, so this policy is
    # intentionally disabled. Reference/metadata skipping should rely on OCR
    # semantics and dedicated policies instead of geometry guesses here.
    return set()


__all__ = ["find_narrow_body_noise_item_ids"]
