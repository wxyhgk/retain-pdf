/**
 * A ```database block's settings (as Notion's database: its columns and its view), kept in the block as JSON:
 *
 *     ```database
 *     {
 *       "columns": [{ "name": "方法", "type": "select", "options": ["B3LYP", "PBE0"] }, { "name": "能量", "type": "number" }],
 *       "view": "table",
 *       "sort": { "column": "能量", "dir": "asc" },
 *       "filter": [{ "column": "方法", "value": "B3LYP" }],
 *       "group": "状态",
 *       "template": "calculation"
 *     }
 *     ```
 *
 * The rows are the pages under the page holding it (server/articles/databases.mjs), each row's values its own.
 */

export type ColumnType = 'text' | 'number' | 'select' | 'multi' | 'date' | 'checkbox' | 'url';
export type Column = { name: string; type: ColumnType; options?: string[] };
export type Sort = { column: string; dir: 'asc' | 'desc' };
/** A row is shown when its value in `column` holds `value` (a choice is it; a box ticked, `true`). */
export type Filter = { column: string; value: string };
export type DatabaseConfig = {
	columns: Column[];
	view: 'table' | 'board';
	sort: Sort | null;
	filter: Filter[];
	/** The column the board's lists are by (a single choice, a box). */
	group: string | null;
	/** The template a new row is made from (templates/), or none. */
	template: string | null;
};
export type Row = { slug: string; title: string; icon: string; props: Record<string, unknown> };

/** The title column: every row's own, not among `columns`. */
export const TITLE = '标题'; // i18n-ignore: a column's name, as it is written into the article

export const COLUMN_TYPES: ColumnType[] = ['text', 'number', 'select', 'multi', 'date', 'checkbox', 'url'];

const isType = (type: unknown): type is ColumnType => COLUMN_TYPES.includes(type as ColumnType);

/** The block's text read as settings: what is not there, or not right, as a new database has it. */
export function readConfig(text: string): DatabaseConfig {
	let raw: Record<string, unknown> = {};
	try {
		const parsed = JSON.parse(text || '{}');
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed;
	} catch {
		// Written by hand and broken: as a new one, its text kept until it is changed here.
	}
	const columns = Array.isArray(raw.columns)
		? raw.columns
				.filter((column): column is Column => Boolean(column) && typeof column.name === 'string' && column.name.trim() !== '' && column.name !== TITLE && isType(column.type))
				.map((column) => ({ name: column.name.trim(), type: column.type, ...(column.type === 'select' || column.type === 'multi' ? { options: Array.isArray(column.options) ? column.options.filter((option) => typeof option === 'string' && option.trim()) : [] } : {}) }))
		: [];
	const unique = columns.filter((column, index) => columns.findIndex((other) => other.name === column.name) === index);
	const named = new Set([TITLE, ...unique.map((column) => column.name)]);
	const sort = raw.sort as Sort | undefined;
	return {
		columns: unique,
		view: raw.view === 'board' ? 'board' : 'table',
		sort: sort && named.has(sort.column) && (sort.dir === 'asc' || sort.dir === 'desc') ? { column: sort.column, dir: sort.dir } : null,
		filter: Array.isArray(raw.filter) ? (raw.filter as Filter[]).filter((each) => each && named.has(each.column) && typeof each.value === 'string' && each.value !== '') : [],
		group: typeof raw.group === 'string' && unique.some((column) => column.name === raw.group && (column.type === 'select' || column.type === 'checkbox')) ? raw.group : null,
		template: typeof raw.template === 'string' && raw.template ? raw.template : null,
	};
}

/** The settings as the block keeps them: what is as a new one has it left out. */
export function writeConfig(config: DatabaseConfig): string {
	const kept: Record<string, unknown> = { columns: config.columns, view: config.view };
	if (config.sort) kept.sort = config.sort;
	if (config.filter.length) kept.filter = config.filter;
	if (config.group) kept.group = config.group;
	if (config.template) kept.template = config.template;
	return JSON.stringify(kept, null, 2);
}

/** A row's value in a column: its title for 标题. */
export function valueOf(row: Row, column: string): unknown {
	return column === TITLE ? row.title : row.props[column];
}

/** A value as it is shown and found by: a list's items joined, a box `true`. */
export function shown(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (Array.isArray(value)) return value.join(', ');
	return String(value);
}

/** The rows shown: those the filters let through, in the sort's order (else as they came: the tree's). */
export function visibleRows(rows: Row[], config: DatabaseConfig): Row[] {
	const kept = rows.filter((row) =>
		config.filter.every(({ column, value }) => {
			const has = valueOf(row, column);
			if (Array.isArray(has)) return has.includes(value);
			if (typeof has === 'boolean') return String(has) === value;
			return shown(has).toLocaleLowerCase('zh-CN').includes(value.toLocaleLowerCase('zh-CN'));
		}),
	);
	const sort = config.sort;
	if (!sort) return kept;
	const type = config.columns.find((column) => column.name === sort.column)?.type ?? 'text';
	const sign = sort.dir === 'asc' ? 1 : -1;
	return [...kept].sort((left, right) => {
		const a = valueOf(left, sort.column);
		const b = valueOf(right, sort.column);
		// Rows with nothing in the column go last, whichever way.
		if (a === undefined || a === null || a === '') return b === undefined || b === null || b === '' ? 0 : 1;
		if (b === undefined || b === null || b === '') return -1;
		if (type === 'number') return (Number(a) - Number(b)) * sign;
		return shown(a).localeCompare(shown(b), 'zh-CN', { numeric: true }) * sign;
	});
}

/**
 * The board's lists: one for each choice of the column (a box: ticked), those a row has though not among them after
 * (written in its page), and one for the rows with none.
 */
export function boardLists(rows: Row[], config: DatabaseConfig): Array<{ value: string | null; rows: Row[] }> {
	const column = config.columns.find((each) => each.name === config.group);
	if (!column) return [{ value: null, rows }];
	const had = rows.map((row) => shown(row.props[column.name])).filter(Boolean);
	const values = column.type === 'checkbox' ? ['true'] : [...new Set([...(column.options ?? []), ...had])];
	const lists = values.map((value) => ({ value, rows: rows.filter((row) => shown(row.props[column.name]) === value) }));
	const none = rows.filter((row) => !values.includes(shown(row.props[column.name])));
	return [...lists, { value: null, rows: none }];
}
