from __future__ import annotations


class SegmentTranslationFormatError(ValueError):
    pass


class SegmentTranslationParseError(SegmentTranslationFormatError):
    pass


class SegmentTranslationSemanticError(SegmentTranslationFormatError):
    pass
