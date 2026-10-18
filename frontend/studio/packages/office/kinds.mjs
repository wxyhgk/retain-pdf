/**
 * Office files shown in a page (render.ts), by extension: Word
 * documents, PowerPoint slides and workbooks. The older binary `.doc` and
 * `.ppt` are known, to say they cannot be shown.
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

/** What each kind is called on its card. */
export const OFFICE_KIND_NAMES = Object.freeze({ document: 'Word 文档', slides: 'PowerPoint', sheet: '表格', old: 'Office 文件' });

function extensionOf(path) {
	const name = String(path).replace(/[?#].*$/su, '');
	const base = name.slice(name.lastIndexOf('/') + 1);
	const dot = base.lastIndexOf('.');
	return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
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

/** `1.3 MB` for a size in bytes. */
export function fileSize(bytes) {
	if (!Number.isFinite(bytes) || bytes < 0) return '';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
