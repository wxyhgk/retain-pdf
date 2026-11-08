# Table cell translation (#147)

OCR-detected tables with a PDF text layer now expose independently translatable
text cells. The original table asset, rules, fills and numeric cells remain in
place. The implementation does not translate a table as a body paragraph.

## Stage contracts

- Normalize: `ocr/document_schema/table_cells.py` uses PDF grid geometry. For
  borderless tables, `table_geometry.py` matches the OCR HTML cells to actual PDF
  words, retaining row/column spans. It appends ordinary normalized text blocks
  with `metadata.table_cell` (parent table ID, cell/source rectangles, typography
  and table context). It does not change the provider payload or the parent HTML.
- Translate: cell records use the normal translation queue, model, cache and
  checkpoint machinery. They carry a concise-cell style hint and table context,
  remain independent of paragraph continuations, and do not enter neighboring
  paragraph context. Context mode `off` still disables context.
- Render: cells bypass body cleanup, prewarm and reflow. After body rendering,
  `render/output/table_cells.py` fits translated labels inside the source cells.
  It removes only the replaced text, preserving graphics, images and numeric
  cells. Links removed by text redaction are restored on the translated anchor
  (or the translated label rectangle). Dual mode changes only the translated half;
  selected-page exports account for the page offset.
- Raw OCR Markdown emits the parent table once, excluding the additional cell
  records.

## Limits and diagnostics

This supports digital tables with a detectable grid, or with OCR HTML whose cells
can be located in the PDF text layer. Image-only tables and tables without usable
cell geometry remain unchanged; their parent metadata records
`no_pdf_text_layer` or `cell_geometry_unavailable`.

Numeric-only and formula-only cells remain in the source PDF. Simple inline
symbols in translated labels render without literal math delimiters. Complex
cell mathematics, changed numeric values and text that cannot fit at the source
font size or down to 6 pt retain the source cell. These cases appear in
`render_diagnostics.table_cells.kept_source`; `translated` counts fitted cells.
Descriptive method/model names (including meaningful CamelCase components) are
translated consistently; opaque acronyms remain unchanged.

## User option

The translation options panel provides a persisted **翻译表格内容** checkbox,
off by default. `translation.translate_tables` is carried through the API,
public job spec and worker stage spec into the translation execution request.
When off, table cell records are excluded before creating translation templates;
existing cell records in those templates are pruned, leaving original PDF table
text untouched. The option participates in checkpoint identity, so incompatible
translation attempts cannot be resumed when it changes.

Existing OCR artifacts must be normalized again to acquire cell records before
retranslation; rerendering an old translation alone cannot translate a table.

## Verification

`devtools/tests/rendering/test_table_cell_translation.py` exercises real PDF text
replacement, grid/fill/numeric preservation, links, dual/selected-page mapping,
borderless HTML with merged headers, table context, inline symbols and source
retention on failed fitting/invalid numeric output.

Manual validation used a scoring-table reproduction of the issue screenshot and
tables from LIME (page 9) and FourierLoss (page 7), translated through the configured
DeepSeek service. Table captions/headers, numeric phrases and translated research
method names were inspected in rendered PDFs. The issue does not include its
original PDF, so the reproduction is not the reporter's actual file.
