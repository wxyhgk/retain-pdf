/**
 * A table as text (CSV, TSV, a sheet as CSV) as a Markdown table: the first
 * row its head, numbers aligned right.
 */

/** The rows and cells of delimited text, quotes as CSV has them (`"a, b"`, `""` for a quote). */
export function parseDelimited(text: string, delimiter = ','): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	const source = text.replace(/^﻿/u, '');
	for (let at = 0; at < source.length; at += 1) {
		const char = source[at]!;
		if (quoted) {
			if (char === '"' && source[at + 1] === '"') {
				cell += '"';
				at += 1;
			} else if (char === '"') quoted = false;
			else cell += char;
			continue;
		}
		if (char === '"' && cell === '') quoted = true;
		else if (char === delimiter) {
			row.push(cell);
			cell = '';
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && source[at + 1] === '\n') at += 1;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = '';
		} else cell += char;
	}
	if (cell !== '' || row.length) {
		row.push(cell);
		rows.push(row);
	}
	// Rows of nothing at the end (a last newline, a sheet's empty rows) are not the table's.
	while (rows.length && rows[rows.length - 1]!.every((value) => value.trim() === '')) rows.pop();
	return rows;
}

const NUMBER = /^[-+−]?(?:\d+(?:[.,]\d+)*|\.\d+)(?:[eE][-+]?\d+)?%?$/u;

/** A cell in a Markdown table: one line, its pipes escaped. */
function cellText(value: string): string {
	return value.trim().replace(/\r?\n/gu, ' ').replace(/\|/gu, '\\|');
}

/** Rows as a Markdown table, the first the head; a column of numbers is aligned right. */
export function markdownTable(rows: string[][]): string {
	if (!rows.length) return '';
	const width = Math.max(...rows.map((row) => row.length));
	const filled = rows.map((row) => Array.from({ length: width }, (_, at) => cellText(row[at] ?? '')));
	const [head, ...body] = filled;
	const numeric = head!.map((_, column) => body.length > 0 && body.every((row) => row[column] === '' || NUMBER.test(row[column]!)));
	const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
	return [line(head!), line(numeric.map((right) => (right ? '---:' : '---'))), ...body.map(line)].join('\n');
}
