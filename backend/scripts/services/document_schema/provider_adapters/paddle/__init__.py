from __future__ import annotations


def build_paddle_document(*args, **kwargs):
    from services.document_schema.provider_adapters.paddle.adapter import build_paddle_document as _impl

    return _impl(*args, **kwargs)


def looks_like_paddle_layout(*args, **kwargs):
    from services.document_schema.provider_adapters.paddle.adapter import looks_like_paddle_layout as _impl

    return _impl(*args, **kwargs)

__all__ = [
    "build_paddle_document",
    "looks_like_paddle_layout",
]
