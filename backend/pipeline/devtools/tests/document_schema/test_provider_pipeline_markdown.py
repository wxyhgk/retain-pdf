import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.ocr.ocr_provider import provider_pipeline


PNG_1X1_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD3sAAAAASUVORK5CYII="


def test_materialize_paddle_markdown_artifacts_publishes_markdown_under_md(tmp_path: Path) -> None:
    job_root = tmp_path / "job-root"
    payload = {
        "layoutParsingResults": [
            {
                "markdown": {
                    "text": '<div style="text-align: center;"><img src="imgs/a.png" alt="Image" width="48%" /></div>',
                    "images": {"imgs/a.png": PNG_1X1_BASE64},
                }
            },
            {
                "markdown": {
                    "text": '<div style="text-align: center;"><img src="imgs/b.png" alt="Image" width="48%" /></div>',
                    "images": {"imgs/b.png": PNG_1X1_BASE64},
                }
            },
        ]
    }

    full_md_path = provider_pipeline.materialize_paddle_markdown_artifacts(
        payload=payload,
        job_root=job_root,
    )

    assert full_md_path == job_root / "md" / "full.md"
    content = full_md_path.read_text(encoding="utf-8")
    assert "![Image](images/page-1/imgs/a.png)" in content
    assert "![Image](images/page-2/imgs/b.png)" in content
    assert "<img" not in content
    assert (job_root / "md" / "images" / "page-1" / "imgs" / "a.png").exists()
    assert (job_root / "md" / "images" / "page-2" / "imgs" / "b.png").exists()


def test_materialize_paddle_markdown_artifacts_rewrites_page_prefixed_image_src(tmp_path: Path) -> None:
    job_root = tmp_path / "job-root"
    payload = {
        "layoutParsingResults": [
            {"markdown": {"text": "page one", "images": {}}},
            {"markdown": {"text": "page two", "images": {}}},
            {"markdown": {"text": "page three", "images": {}}},
            {"markdown": {"text": "page four", "images": {}}},
            {"markdown": {"text": "page five", "images": {}}},
            {"markdown": {"text": "page six", "images": {}}},
            {"markdown": {"text": "page seven", "images": {}}},
            {"markdown": {"text": "page eight", "images": {}}},
            {"markdown": {"text": "page nine", "images": {}}},
            {
                "markdown": {
                    "text": '<div style="text-align: center;"><img src="page-10/imgs/img_in_chart_box_270_148_960_366.jpg" alt="Image" width="56%" /></div>',
                    "images": {"page-10/imgs/img_in_chart_box_270_148_960_366.jpg": PNG_1X1_BASE64},
                }
            },
        ]
    }

    full_md_path = provider_pipeline.materialize_paddle_markdown_artifacts(
        payload=payload,
        job_root=job_root,
    )

    content = full_md_path.read_text(encoding="utf-8")
    assert "![Image](images/page-10/imgs/img_in_chart_box_270_148_960_366.jpg)" in content
    assert "<img" not in content
    assert (job_root / "md" / "images" / "page-10" / "imgs" / "img_in_chart_box_270_148_960_366.jpg").exists()


def test_materialize_paddle_markdown_artifacts_rewrites_page_prefixed_src_with_unprefixed_key(tmp_path: Path) -> None:
    job_root = tmp_path / "job-root"
    payload = {
        "layoutParsingResults": [
            {
                "markdown": {
                    "text": '<div style="text-align: center;"><img src="page-5/imgs/img_in_image_box_657_704_1045_962.jpg" alt="Image" width="33%" /></div>',
                    "images": {"imgs/img_in_image_box_657_704_1045_962.jpg": PNG_1X1_BASE64},
                }
            },
        ]
    }

    full_md_path = provider_pipeline.materialize_paddle_markdown_artifacts(
        payload=payload,
        job_root=job_root,
    )

    content = full_md_path.read_text(encoding="utf-8")
    assert "![Image](images/page-5/imgs/img_in_image_box_657_704_1045_962.jpg)" in content
    assert "<img" not in content
    assert (job_root / "md" / "images" / "page-5" / "imgs" / "img_in_image_box_657_704_1045_962.jpg").exists()


def test_materialize_paddle_markdown_artifacts_rewrites_markdown_image_src(tmp_path: Path) -> None:
    job_root = tmp_path / "job-root"
    payload = {
        "layoutParsingResults": [
            {
                "markdown": {
                    "text": "![Pipeline chart](imgs/chart.png)",
                    "images": {"imgs/chart.png": PNG_1X1_BASE64},
                }
            }
        ]
    }

    full_md_path = provider_pipeline.materialize_paddle_markdown_artifacts(
        payload=payload,
        job_root=job_root,
    )

    content = full_md_path.read_text(encoding="utf-8")
    assert "![Pipeline chart](images/page-1/imgs/chart.png)" in content
    assert (job_root / "md" / "images" / "page-1" / "imgs" / "chart.png").exists()


def test_materialize_paddle_markdown_artifacts_preserves_external_markdown_image(tmp_path: Path) -> None:
    job_root = tmp_path / "job-root"
    payload = {
        "layoutParsingResults": [
            {
                "markdown": {
                    "text": "![External](https://example.test/chart.png)",
                    "images": {},
                }
            }
        ]
    }

    full_md_path = provider_pipeline.materialize_paddle_markdown_artifacts(
        payload=payload,
        job_root=job_root,
    )

    assert full_md_path.read_text(encoding="utf-8") == (
        "![External](https://example.test/chart.png)\n"
    )
