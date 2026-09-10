def classify_item_contexts(*args, **kwargs):
    from retainpdf_pipeline.translate.services.classification.page_classifier import classify_item_contexts as impl

    return impl(*args, **kwargs)


def classify_payload_items(*args, **kwargs):
    from retainpdf_pipeline.translate.services.classification.page_classifier import classify_payload_items as impl

    return impl(*args, **kwargs)


def classify_text_items(*args, **kwargs):
    from retainpdf_pipeline.translate.services.classification.page_classifier import classify_text_items as impl

    return impl(*args, **kwargs)

__all__ = ["classify_item_contexts", "classify_payload_items", "classify_text_items"]
