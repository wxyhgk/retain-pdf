from __future__ import annotations

from dataclasses import asdict
from dataclasses import dataclass
from dataclasses import field
from enum import Enum


class ErrorTaxonomy(str, Enum):
    PROTOCOL_ERROR = "protocol"
    VALIDATION_ERROR = "validation"
    TRANSPORT_ERROR = "transport"
    RATE_LIMIT_ERROR = "rate_limit"
    MODEL_REFUSAL = "refusal"


class FinalStatus(str, Enum):
    TRANSLATED = "translated"
    PARTIALLY_TRANSLATED = "partially_translated"
    KEPT_ORIGIN = "kept_origin"
    FAILED = "failed"


@dataclass(frozen=True)
class TranslationDiagnostic:
    kind: str
    item_id: str = ""
    page_idx: int | None = None
    stage: str = "translation"
    severity: str = "warning"
    message: str = ""
    retryable: bool = True
    details: dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass
class TranslationDiagnosticsCollector:
    diagnostics: list[TranslationDiagnostic] = field(default_factory=list)

    def add(self, diagnostic: TranslationDiagnostic) -> TranslationDiagnostic:
        self.diagnostics.append(diagnostic)
        return diagnostic

    def emit(
        self,
        *,
        kind: str,
        item_id: str = "",
        page_idx: int | None = None,
        stage: str = "translation",
        severity: str = "warning",
        message: str = "",
        retryable: bool = True,
        details: dict[str, object] | None = None,
    ) -> TranslationDiagnostic:
        return self.add(
            TranslationDiagnostic(
                kind=kind,
                item_id=item_id,
                page_idx=page_idx,
                stage=stage,
                severity=severity,
                message=message,
                retryable=retryable,
                details=details or {},
            )
        )

    def extend(self, diagnostics: list[TranslationDiagnostic]) -> None:
        self.diagnostics.extend(diagnostics)

    def as_dicts(self) -> list[dict[str, object]]:
        return [item.to_dict() for item in self.diagnostics]


def classify_error_taxonomy(error: BaseException | str, *, status_code: int | None = None) -> str:
    if status_code == 429:
        return ErrorTaxonomy.RATE_LIMIT_ERROR.value
    if status_code is not None and status_code >= 500:
        return ErrorTaxonomy.TRANSPORT_ERROR.value
    text = str(error or "")
    name = type(error).__name__ if isinstance(error, BaseException) else ""
    lowered = f"{name} {text}".lower()
    if "429" in lowered or "rate limit" in lowered or "retry-after" in lowered:
        return ErrorTaxonomy.RATE_LIMIT_ERROR.value
    if "timeout" in lowered or "connection" in lowered or "http" in lowered or "transport" in lowered:
        return ErrorTaxonomy.TRANSPORT_ERROR.value
    if "refusal" in lowered or "refused" in lowered or "safety" in lowered:
        return ErrorTaxonomy.MODEL_REFUSAL.value
    if "placeholder" in lowered or "segment" in lowered or "validation" in lowered or "inventory" in lowered:
        return ErrorTaxonomy.VALIDATION_ERROR.value
    return ErrorTaxonomy.PROTOCOL_ERROR.value
