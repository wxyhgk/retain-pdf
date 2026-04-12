"""Template placeholder for future OCR provider adapters.

Keep provider-specific raw-schema translation logic under
`services/document_schema/provider_adapters/`.

Minimum contract for new providers:

1. absorb raw provider fields inside the adapter layer
2. emit stable `normalized_document_v1`
3. if the provider already knows paragraph continuation groups,
   map them into block-level `continuation_hint`
4. let translation/rendering continue consuming only the normalized contract
"""
