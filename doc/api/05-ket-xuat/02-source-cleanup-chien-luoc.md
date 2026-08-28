# source_cleanup Strategy

`render.source_cleanup_strategy` controls how the original text in the source PDF is handled before rendering.

## Available Values

- `pikepdf_text_strip`
- `typst_fill`
- `bbox_text_strip`
- `legacy`
- `redact_restore_formulas`

## Current Semantics

- `pikepdf_text_strip`: Default strategy. Performs content-stream text-op removal first, then uses Typst translation block backgrounds for visual coverage.
- `typst_fill`: No physical removal; uses Typst background blocks to cover original text.
- `bbox_text_strip`, `legacy`, `redact_restore_formulas`: Compatibility aliases; current behavior is identical to `pikepdf_text_strip`.

## Frontend Rules

- Use the backend default value by default; ordinary users do not need to understand the strategy details.
- `typst_fill` can be exposed in debugging or advanced settings for PDFs where the removal strategy is unsuitable.
- Do not display compatibility aliases as new UI options.
