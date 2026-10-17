/**
 * Office files the Studio shows in the page itself (office-viewer.ts), by
 * extension: Word documents, PowerPoint slides, and workbooks; the older
 * binary `.doc` and `.ppt` it cannot read.
 */

const KINDS = Object.freeze({
	docx: 'document',
	pptx: 'slides',
	xlsx: 'sheet',
	xlsm: 'sheet',
	xls: 'sheet',
	ods: 'sheet',
	doc: 'old',
	ppt: 'old',
});

function extensionOf(path) {
	const name = String(path).slice(String(path).lastIndexOf('/') + 1);
	const dot = name.lastIndexOf('.');
	return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** What kind of office file this is (`document`, `slides`, `sheet`, or `old` for `.doc`/`.ppt`); null for other files. */
export function officeKind(path) {
	return KINDS[extensionOf(path)] ?? null;
}

/** How a file's rows are read as a table: a workbook's first sheet, CSV or TSV as text; null for other files. */
export function tableSource(path) {
	const extension = extensionOf(path);
	if (KINDS[extension] === 'sheet') return { sheet: true, delimiter: ',' };
	if (extension === 'csv') return { sheet: false, delimiter: ',' };
	if (extension === 'tsv') return { sheet: false, delimiter: '\t' };
	return null;
}
