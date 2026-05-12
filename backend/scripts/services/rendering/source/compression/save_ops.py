from __future__ import annotations

from pathlib import Path


def replace_if_smaller(
    temp_path: Path,
    output_path: Path,
    *,
    original_size: int,
    changed: int,
    skipped_small: int,
    skipped_not_better: int,
    skipped_alpha: int,
    skipped_missing: int,
    skipped_special: int,
    skipped_broken: int,
) -> bool:
    new_size = temp_path.stat().st_size
    if new_size >= original_size:
        print(
            f"image-only compress: rollback size {original_size}->{new_size} "
            f"(no net savings, changed={changed}, skipped_small={skipped_small}, "
            f"skipped_not_better={skipped_not_better}, skipped_alpha={skipped_alpha}, "
            f"skipped_missing={skipped_missing}, skipped_special={skipped_special}, "
            f"skipped_broken={skipped_broken})",
            flush=True,
        )
        return False
    temp_path.replace(output_path)
    print(
        f"image-only compress: changed={changed} skipped_small={skipped_small} "
        f"skipped_not_better={skipped_not_better} skipped_alpha={skipped_alpha} "
        f"skipped_missing={skipped_missing} skipped_special={skipped_special} "
        f"skipped_broken={skipped_broken} "
        f"size {original_size}->{new_size} "
        f"saved={original_size - new_size}",
        flush=True,
    )
    return True
