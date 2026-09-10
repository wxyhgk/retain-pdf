from __future__ import annotations


class PartialBatchTranslationError(ValueError):
    """Validated members may be retained; only retry_items need model repair."""

    def __init__(self, result: dict, retry_items: list[dict]) -> None:
        super().__init__("batch translation contains missing or invalid members")
        self.result = result
        self.retry_items = retry_items
        self.item_id = retry_items[0]["item_id"]


class SuspiciousKeepOriginError(ValueError):
    def __init__(self, item_id: str, result: dict[str, dict[str, str]]) -> None:
        super().__init__(f"{item_id}: suspicious keep_origin for long English body text")
        self.item_id = item_id
        self.result = result


class UnexpectedPlaceholderError(ValueError):
    def __init__(
        self,
        item_id: str,
        unexpected: list[str],
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(f"{item_id}: unexpected placeholders in translation: {unexpected}")
        self.item_id = item_id
        self.unexpected = unexpected
        self.source_text = source_text
        self.translated_text = translated_text


class PlaceholderInventoryError(ValueError):
    def __init__(
        self,
        item_id: str,
        source_sequence: list[str],
        translated_sequence: list[str],
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(
            f"{item_id}: placeholder inventory mismatch: source={source_sequence} translated={translated_sequence}"
        )
        self.item_id = item_id
        self.source_sequence = source_sequence
        self.translated_sequence = translated_sequence
        self.source_text = source_text
        self.translated_text = translated_text


class EmptyTranslationError(ValueError):
    def __init__(self, item_id: str) -> None:
        super().__init__(f"{item_id}: empty translation output")
        self.item_id = item_id


class EnglishResidueError(ValueError):
    def __init__(
        self,
        item_id: str,
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(f"{item_id}: translated output still looks predominantly English")
        self.item_id = item_id
        self.source_text = source_text
        self.translated_text = translated_text


class TranslationProtocolError(ValueError):
    def __init__(
        self,
        item_id: str,
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(f"{item_id}: translated output still contains protocol/json shell")
        self.item_id = item_id
        self.source_text = source_text
        self.translated_text = translated_text


class MathDelimiterError(ValueError):
    def __init__(
        self,
        item_id: str,
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(f"{item_id}: translated output has unbalanced inline math delimiters")
        self.item_id = item_id
        self.source_text = source_text
        self.translated_text = translated_text


class TruncatedTranslationError(ValueError):
    def __init__(
        self,
        item_id: str,
        *,
        source_text: str = "",
        translated_text: str = "",
        ratio: float = 0.0,
    ) -> None:
        super().__init__(
            f"{item_id}: translated output is abnormally short vs source (ratio={ratio:.3f})"
        )
        self.item_id = item_id
        self.source_text = source_text
        self.translated_text = translated_text
        self.ratio = ratio


__all__ = [
    "EmptyTranslationError",
    "EnglishResidueError",
    "MathDelimiterError",
    "PlaceholderInventoryError",
    "SuspiciousKeepOriginError",
    "TranslationProtocolError",
    "TruncatedTranslationError",
    "UnexpectedPlaceholderError",
]
