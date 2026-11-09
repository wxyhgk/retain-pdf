# Table cell translation (#147)

RetainPDF can translate text in OCR-detected PDF tables and put each translation
back in its original cell. Enable **翻译表格内容** in the translation options.
The setting is saved locally and defaults to off. Its API and worker spec key is
`translation.translate_tables`.

- **Extract:** When enabled, the translation stage reads the source PDF for each
  ready OCR page. It detects grids once per page and uses OCR HTML to locate
  cells in borderless tables. For a three-rule table, a one-column grid does not
  establish cell boundaries; without reliable HTML and text positions, the
  table is kept as-is. HTML spans have size limits, and an unreadable or missing
  PDF page skips cell extraction without stopping body translation.
- **Translate:** Cells are separate translation records, outside the normalized
  OCR document and paragraph continuation. Each gets only its caption and
  applicable row/column labels as context. Both completed and streaming OCR
  use the same extraction. With the option off, no cells are extracted or
  passed to domain preview or terminology prescan, and old cell records are
  dropped from translation templates. The setting affects checkpoint reuse.
- **Render:** Cells bypass body cleanup and reflow. Text is fitted to the
  original cell, and replacement removes only the source glyphs that can be
  isolated from neighboring glyphs. Table rules, fills, numeric cells and
  links remain; dual mode changes the translated half only.

This requires a PDF text layer and reliable cell geometry. Image-only tables
and cells that cannot be safely located or replaced keep their source text.
Numeric-only and formula-only cells are skipped. Complex math, changed numeric
values, overlapping glyphs that cannot be isolated, and text that cannot fit
are recorded in `render_diagnostics.table_cells.kept_source`. The
`translated` count reports cells actually replaced.

Existing normalized OCR can be reused for a new translation. Rerendering an
old translation alone does not add table translations.

The PDF regression tests cover grids, merged headers, three-rule tables with
overlapping neighboring glyph boxes, links, dual mode and selected-page
exports. The streaming test covers a table arriving after translation has
started, with the option both on and off.

Before the review changes, manual validation used the configured DeepSeek
service to translate a scoring table reproduced from the issue screenshot,
LIME page 9 and FourierLoss page 7. The issue does not include its original PDF.
