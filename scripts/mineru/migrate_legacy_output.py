import argparse
import shutil
from pathlib import Path

import sys

sys.path.append(str(Path(__file__).resolve().parents[2]))

from common.job_dirs import create_job_dirs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate legacy output/mineru/<case> layout into the structured output/<job-id>/{originPDF,jsonPDF,transPDF} layout.",
    )
    parser.add_argument(
        "--legacy-root",
        type=str,
        default="output/mineru/test9",
        help="Legacy MinerU case directory to migrate.",
    )
    parser.add_argument(
        "--job-id",
        type=str,
        default="20260321-legacy-mineru-test9",
        help="Target structured job directory name.",
    )
    parser.add_argument(
        "--output-root",
        type=str,
        default="output",
        help="Structured output root.",
    )
    return parser.parse_args()


def safe_move(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))


def main() -> None:
    args = parse_args()
    legacy_root = Path(args.legacy_root)
    if not legacy_root.exists():
        raise RuntimeError(f"legacy root not found: {legacy_root}")

    job_dirs = create_job_dirs(Path(args.output_root), args.job_id)
    legacy_bundle = legacy_root / "test9-mineru.zip"
    legacy_unpacked = legacy_root / "unpacked"
    legacy_intermediate = legacy_root / "intermediate"
    legacy_debug_pages = legacy_root / "debug_pages"
    legacy_debug_pages_aligned = legacy_root / "debug_pages_aligned"

    if legacy_bundle.exists():
        safe_move(legacy_bundle, job_dirs.json_pdf_dir / "mineru_bundle_legacy.zip")
    if legacy_unpacked.exists():
        safe_move(legacy_unpacked, job_dirs.json_pdf_dir / "unpacked")
        unpacked_origin = next((job_dirs.json_pdf_dir / "unpacked").glob("*_origin.pdf"), None)
        if unpacked_origin is not None:
            shutil.copy2(unpacked_origin, job_dirs.origin_pdf_dir / unpacked_origin.name)
    if legacy_intermediate.exists():
        safe_move(legacy_intermediate, job_dirs.trans_pdf_dir / "legacy_intermediate")
    if legacy_debug_pages.exists():
        safe_move(legacy_debug_pages, job_dirs.trans_pdf_dir / "legacy_debug_pages")
    if legacy_debug_pages_aligned.exists():
        safe_move(legacy_debug_pages_aligned, job_dirs.trans_pdf_dir / "legacy_debug_pages_aligned")

    notes = [
        "This job directory was created by migrating the old output/mineru/<case> experiment layout.",
        f"legacy root: {legacy_root}",
        "jsonPDF/unpacked contains the original MinerU unpacked bundle.",
        "transPDF/legacy_intermediate contains experimental content_list_v2 artifacts and rendered PDFs.",
    ]
    (job_dirs.root / "MIGRATED_FROM_LEGACY.txt").write_text("\n".join(notes) + "\n", encoding="utf-8")

    print(f"migrated legacy root: {legacy_root}")
    print(f"job root: {job_dirs.root}")
    print(f"originPDF: {job_dirs.origin_pdf_dir}")
    print(f"jsonPDF: {job_dirs.json_pdf_dir}")
    print(f"transPDF: {job_dirs.trans_pdf_dir}")


if __name__ == "__main__":
    main()
