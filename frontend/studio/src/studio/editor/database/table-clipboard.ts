import { coerceValue, TITLE, type Column, type Row } from './database-config.ts';

/**
 * A database table's cells copied and pasted as a spreadsheet's are (Excel, Numbers, Google Sheets, Notion): lines of
 * cells between tabs, a cell with a tab, a line break or a quote in quotes (its quotes doubled).
 */

/** The text of cells copied: a line a row, the cells between tabs; quoted when they would break that. */
export function tableText(grid: string[][]): string {
	const cell = (text: string) => (/[\t\n\r"]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text);
	return grid.map((line) => line.map(cell).join('\t')).join('\n');
}

/** Text pasted as cells: a spreadsheet's lines and tabs (quoted cells read whole); one line's last break let go. */
export function cellsOf(text: string): string[][] {
	const grid: string[][] = [];
	let line: string[] = [];
	let cell = '';
	let quoted = false;
	const source = text.replace(/\r\n?/gu, '\n');
	for (let at = 0; at < source.length; at += 1) {
		const char = source[at]!;
		if (quoted) {
			if (char === '"' && source[at + 1] === '"') {
				cell += '"';
				at += 1;
			} else if (char === '"') quoted = false;
			else cell += char;
		} else if (char === '"' && cell === '') quoted = true;
		else if (char === '\t') {
			line.push(cell);
			cell = '';
		} else if (char === '\n') {
			line.push(cell);
			grid.push(line);
			line = [];
			cell = '';
		} else cell += char;
	}
	if (cell !== '' || line.length) {
		line.push(cell);
		grid.push(line);
	}
	return grid;
}

/** A cell's value as it is copied: a number, a day as written, choices joined, a box true or false. */
export function copiedText(row: Row, column: Column | typeof TITLE): string {
	if (column === TITLE) return row.title;
	const value = row.props[column.name];
	if (column.type === 'checkbox') return value === true ? 'true' : 'false';
	if (value === null || value === undefined) return '';
	return Array.isArray(value) ? value.join(', ') : String(value);
}

/** What a box takes as ticked, pasted: what a spreadsheet or Notion copies for one, in English or Chinese. */
const TICKED = /^(?:true|yes|y|1|x|✓|✔|☑|是|对|已勾选)$/iu;

/** Text pasted into a cell of a column, as that column keeps it (null: nothing). */
export function pastedValue(column: Column, text: string): unknown {
	const said = text.trim();
	if (column.type === 'checkbox') return TICKED.test(said);
	if (column.type === 'date') {
		// 2026/10/20, 2026.10.20 as 2026-10-20; 2026-1-5 with its zeros.
		const day = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/u.exec(said);
		return day ? `${day[1]}-${day[2]!.padStart(2, '0')}-${day[3]!.padStart(2, '0')}` : coerceValue('date', said);
	}
	return coerceValue(column.type, said);
}
