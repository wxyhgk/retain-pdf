from __future__ import annotations

from pathlib import Path

from services.pipeline_shared.io import save_json
from services.rendering.analysis.risk.models import RenderRiskReport


REPORT_FILE_NAME = "render-risk-report.json"


def default_render_risk_report_path(output_pdf_path: Path) -> Path:
    rendered_dir = output_pdf_path.parent
    if rendered_dir.name == "rendered":
        return rendered_dir.parent / "artifacts" / REPORT_FILE_NAME
    return rendered_dir / REPORT_FILE_NAME


def write_render_risk_report(path: Path, report: RenderRiskReport) -> Path:
    save_json(path, report.to_dict())
    return path


__all__ = [
    "REPORT_FILE_NAME",
    "default_render_risk_report_path",
    "write_render_risk_report",
]
