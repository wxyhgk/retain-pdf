/**
 * A ```database block's settings (as Notion's database: its name, columns and view), kept in the block as JSON:
 *
 *     ```database
 *     {
 *       "title": "计算记录",
 *       "columns": [{ "name": "方法", "type": "select", "options": ["B3LYP", "PBE0"] }, { "name": "能量", "type": "number", "width": 140 }],
 *       "view": "table",
 *       "sorts": [{ "column": "能量", "dir": "asc" }],
 *       "filter": [{ "column": "方法", "op": "any", "value": ["B3LYP"] }],
 *       "group": "状态",
 *       "template": "calculation"
 *     }
 *     ```
 *
 * The rows are the pages under the page holding it (server/articles/databases.mjs), each row's values its own.
 */

import { t } from '@blog/i18n/index.mjs';
import { DATABASE_ID, databaseText, withDatabaseText } from '../../../articles/database-blocks.mjs';

export type ColumnType = 'text' | 'number' | 'select' | 'multi' | 'date' | 'checkbox' | 'url';
export type Column = {
	name: string;
	type: ColumnType;
	/** A choice's (单选, 多选) choices, in their order. */
	options?: string[];
	/** Its width in the table, as dragged (px); none: as a new one. */
	width?: number;
	/** Not in the table nor on the cards (still the rows'). */
	hidden?: boolean;
	/** Its values in the table on as many lines as they take (else one, cut short). */
	wrap?: boolean;
};
export type Sort = { column: string; dir: 'asc' | 'desc' };
/**
 * A row is shown when its value in `column` is as `op` says of `value`: words held (`contains`), a number or a date
 * compared, one of some choices (`any`, `value` a list), a box ticked or not (`checked`, `"true"`), nothing in it.
 */
export type FilterOp = 'contains' | 'not-contains' | 'is' | 'is-not' | 'gt' | 'lt' | 'ge' | 'le' | 'before' | 'after' | 'any' | 'none' | 'checked' | 'empty' | 'not-empty';
export type Filter = { column: string; op: FilterOp; value: string | string[] };
export type DatabaseConfig = {
	/** Which database it is (its rows say it: `database: <id>`); null for one written before ids, given one when shown. */
	id: string | null;
	/** Its name, above it (empty: 无标题). */
	title: string;
	columns: Column[];
	view: 'table' | 'board';
	/** The order, the first deciding, the next between those equal by it…; none: the tree's. */
	sorts: Sort[];
	filter: Filter[];
	/** The column the board's lists are by (a single choice, a box). */
	group: string | null;
	/** The template a new row is made from (templates/), or none. */
	template: string | null;
	/** The titles in the table on as many lines as they take. */
	titleWrap: boolean;
	/** How a row is opened (its 打开, a card clicked): beside the table, as Notion's side peek, or as its whole page. */
	openAs: 'peek' | 'page';
	/** The column the table's rows are grouped by (a single choice, a box), as the board's lists; none: not grouped. */
	tableGroup: string | null;
	/** What is worked out of each column under the table (by its name; 标题's count unless said otherwise). */
	calcs: Record<string, CalcKind>;
};

/** What is worked out of a column's values under the table, as Notion's 计算. */
export type CalcKind =
	| 'none'
	| 'count'
	| 'filled'
	| 'empty'
	| 'unique'
	| 'filled-percent'
	| 'empty-percent'
	| 'sum'
	| 'average'
	| 'median'
	| 'min'
	| 'max'
	| 'range'
	| 'earliest'
	| 'latest'
	| 'span'
	| 'checked'
	| 'unchecked'
	| 'checked-percent';
const CALC_KINDS: CalcKind[] = ['none', 'count', 'filled', 'empty', 'unique', 'filled-percent', 'empty-percent', 'sum', 'average', 'median', 'min', 'max', 'range', 'earliest', 'latest', 'span', 'checked', 'unchecked', 'checked-percent'];
export type Row = { slug: string; title: string; icon: string; props: Record<string, unknown> };

/** The title column: every row's own, not among `columns`. */
export const TITLE = '标题'; // i18n-ignore: a column's name, as it is written into the article

export const COLUMN_TYPES: ColumnType[] = ['text', 'number', 'select', 'multi', 'date', 'checkbox', 'url'];
export const DEFAULT_WIDTH = 180;
export const TITLE_WIDTH = 280;
const OPS: FilterOp[] = ['contains', 'not-contains', 'is', 'is-not', 'gt', 'lt', 'ge', 'le', 'before', 'after', 'any', 'none', 'checked', 'empty', 'not-empty'];

const isType = (type: unknown): type is ColumnType => COLUMN_TYPES.includes(type as ColumnType);
export const hasOptions = (type: ColumnType) => type === 'select' || type === 'multi';

/** What `op`s a column of `type` is filtered by, the first the one a new filter starts with. */
export function filterOps(type: ColumnType | 'title'): FilterOp[] {
	switch (type) {
		case 'number':
			return ['is', 'is-not', 'gt', 'lt', 'ge', 'le', 'empty', 'not-empty'];
		case 'date':
			return ['is', 'before', 'after', 'empty', 'not-empty'];
		case 'select':
		case 'multi':
			return ['any', 'none', 'empty', 'not-empty'];
		case 'checkbox':
			return ['checked'];
		default:
			return ['contains', 'not-contains', 'is', 'is-not', 'empty', 'not-empty'];
	}
}

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
		? (raw.columns as Column[])
				.filter((column) => Boolean(column) && typeof column.name === 'string' && column.name.trim() !== '' && column.name.trim() !== TITLE && isType(column.type))
				.map((column) => ({
					name: column.name.trim(),
					type: column.type,
					...(hasOptions(column.type) ? { options: Array.isArray(column.options) ? [...new Set(column.options.filter((option) => typeof option === 'string' && option.trim()))] : [] } : {}),
					...(typeof column.width === 'number' && column.width >= 60 ? { width: Math.round(Math.min(column.width, 1200)) } : {}),
					...(column.hidden === true ? { hidden: true } : {}),
					...(column.wrap === true ? { wrap: true } : {}),
				}))
		: [];
	const unique = columns.filter((column, index) => columns.findIndex((other) => other.name === column.name) === index);
	const named = new Set([TITLE, ...unique.map((column) => column.name)]);
	// `sort` (one) as it was written before `sorts`.
	const sorts = (Array.isArray(raw.sorts) ? raw.sorts : raw.sort ? [raw.sort] : []) as Sort[];
	const filters = (Array.isArray(raw.filter) ? raw.filter : []) as Array<Partial<Filter>>;
	return {
		id: typeof raw.id === 'string' && DATABASE_ID.test(raw.id) ? raw.id : null,
		title: typeof raw.title === 'string' ? raw.title : '',
		columns: unique,
		view: raw.view === 'board' ? 'board' : 'table',
		sorts: sorts.filter((sort, index) => sort && named.has(sort.column) && (sort.dir === 'asc' || sort.dir === 'desc') && sorts.findIndex((other) => other?.column === sort.column) === index).map((sort) => ({ column: sort.column, dir: sort.dir })),
		filter: filters
			.filter((each) => each && typeof each.column === 'string' && named.has(each.column))
			.map((each) => ({ column: each.column!, op: OPS.includes(each.op as FilterOp) ? (each.op as FilterOp) : 'contains', value: Array.isArray(each.value) ? each.value.map(String) : typeof each.value === 'string' ? each.value : '' })),
		group: typeof raw.group === 'string' && unique.some((column) => column.name === raw.group && (column.type === 'select' || column.type === 'checkbox')) ? raw.group : null,
		template: typeof raw.template === 'string' && raw.template ? raw.template : null,
		titleWrap: raw.titleWrap === true,
		openAs: raw.openAs === 'page' ? 'page' : 'peek',
		tableGroup: typeof raw.tableGroup === 'string' && unique.some((column) => column.name === raw.tableGroup && (column.type === 'select' || column.type === 'checkbox')) ? raw.tableGroup : null,
		calcs: Object.fromEntries(
			Object.entries(raw.calcs && typeof raw.calcs === 'object' && !Array.isArray(raw.calcs) ? (raw.calcs as Record<string, unknown>) : {}).filter(
				([name, kind]) => named.has(name) && CALC_KINDS.includes(kind as CalcKind) && calcKinds(name === TITLE ? 'title' : unique.find((column) => column.name === name)!.type).includes(kind as CalcKind),
			),
		) as Record<string, CalcKind>,
	};
}

/** The settings as the block keeps them: what is as a new one has it left out. */
export function writeConfig(config: DatabaseConfig): string {
	const kept: Record<string, unknown> = {};
	if (config.id) kept.id = config.id;
	if (config.title) kept.title = config.title;
	kept.columns = config.columns;
	kept.view = config.view;
	if (config.sorts.length) kept.sorts = config.sorts;
	if (config.filter.length) kept.filter = config.filter;
	if (config.group) kept.group = config.group;
	if (config.template) kept.template = config.template;
	if (config.titleWrap) kept.titleWrap = true;
	if (config.tableGroup) kept.tableGroup = config.tableGroup;
	if (config.openAs === 'page') kept.openAs = 'page';
	if (Object.keys(config.calcs).length) kept.calcs = config.calcs;
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

const nothing = (value: unknown) => value === null || value === undefined || value === '' || value === false || (Array.isArray(value) && value.length === 0);

/** Whether a row's value passes a filter (one not filled in yet lets all through). */
export function passes(value: unknown, filter: Filter): boolean {
	const { op } = filter;
	if (op === 'empty') return nothing(value);
	if (op === 'not-empty') return !nothing(value);
	if (op === 'checked') return (value === true) === (filter.value !== 'false');
	const wanted = filter.value;
	if (op === 'any' || op === 'none') {
		const list = Array.isArray(wanted) ? wanted : wanted ? [wanted] : [];
		if (!list.length) return true;
		const has = Array.isArray(value) ? value.map(String) : nothing(value) ? [] : [String(value)];
		const hit = list.some((each) => has.includes(each));
		return op === 'any' ? hit : !hit;
	}
	const text = Array.isArray(wanted) ? wanted.join(', ') : wanted;
	if (text === '') return true;
	if (op === 'gt' || op === 'lt' || op === 'ge' || op === 'le' || ((op === 'is' || op === 'is-not') && typeof value === 'number')) {
		if (nothing(value) || !Number.isFinite(Number(text))) return op === 'is-not';
		const a = Number(value);
		const b = Number(text);
		return { gt: a > b, lt: a < b, ge: a >= b, le: a <= b, is: a === b, 'is-not': a !== b }[op as 'gt'];
	}
	const has = shown(value).toLocaleLowerCase('zh-CN');
	const said = text.toLocaleLowerCase('zh-CN');
	switch (op) {
		case 'before':
			return !nothing(value) && has < said;
		case 'after':
			return !nothing(value) && has > said;
		case 'is':
			return has === said;
		case 'is-not':
			return has !== said;
		case 'not-contains':
			return !has.includes(said);
		default:
			return has.includes(said);
	}
}

/** The rows shown: those the filters and the words searched for let through, in the sorts' order (else the tree's). */
export function visibleRows(rows: Row[], config: DatabaseConfig, search = ''): Row[] {
	const sought = search.trim().toLocaleLowerCase('zh-CN');
	const kept = rows.filter(
		(row) =>
			config.filter.every((filter) => passes(valueOf(row, filter.column), filter)) &&
			(!sought || [row.title, ...Object.values(row.props).map(shown)].some((text) => text.toLocaleLowerCase('zh-CN').includes(sought))),
	);
	if (!config.sorts.length) return kept;
	const typeOf = (name: string) => config.columns.find((column) => column.name === name)?.type ?? 'text';
	return [...kept].sort((left, right) => {
		for (const sort of config.sorts) {
			const a = valueOf(left, sort.column);
			const b = valueOf(right, sort.column);
			// Rows with nothing in the column go last, whichever way.
			if (nothing(a) && nothing(b)) continue;
			if (nothing(a)) return 1;
			if (nothing(b)) return -1;
			const sign = sort.dir === 'asc' ? 1 : -1;
			const type = typeOf(sort.column);
			// A choice by the order of the choices (as Notion's), a number as a number.
			const options = config.columns.find((column) => column.name === sort.column)?.options ?? [];
			const order = type === 'number' ? Number(a) - Number(b) : type === 'select' && options.includes(String(a)) && options.includes(String(b)) ? options.indexOf(String(a)) - options.indexOf(String(b)) : shown(a).localeCompare(shown(b), 'zh-CN', { numeric: true });
			if (order) return order * sign;
		}
		return 0;
	});
}

/**
 * The board's lists: one for each choice of the column (a box: ticked, not), those a row has though not among them
 * after (written in its page), and one for the rows with none (not for a box).
 */
export function boardLists(rows: Row[], config: DatabaseConfig): Array<{ value: string | null; rows: Row[] }> {
	const column = config.columns.find((each) => each.name === config.group);
	if (!column) return [{ value: null, rows }];
	if (column.type === 'checkbox') {
		return [
			{ value: 'false', rows: rows.filter((row) => row.props[column.name] !== true) },
			{ value: 'true', rows: rows.filter((row) => row.props[column.name] === true) },
		];
	}
	const had = rows.map((row) => shown(row.props[column.name])).filter(Boolean);
	const values = [...new Set([...(column.options ?? []), ...had])];
	const lists = values.map((value) => ({ value, rows: rows.filter((row) => shown(row.props[column.name]) === value) }));
	const none = rows.filter((row) => !values.includes(shown(row.props[column.name])));
	return [{ value: null, rows: none }, ...lists];
}

/** `2026-10-20` as it is shown: 2026年10月20日. */
export function shownDate(value: unknown): string {
	const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value) : null;
	return match ? t('{year}年{month}月{day}日', { year: match[1], month: Number(match[2]), day: Number(match[3]) }) : shown(value);
}

/** A name not taken yet among the columns: `base`, else `base 2`, `base 3`… */
export function freeColumnName(config: DatabaseConfig, base: string): string {
	const taken = new Set([TITLE, ...config.columns.map((column) => column.name)]);
	if (!taken.has(base)) return base;
	for (let n = 2; ; n += 1) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
}

/** `value` as a column of `type` keeps it: a number a number, a date `2026-10-29`, several choices a list; nothing, null. */
export function coerceValue(type: string, value: unknown): unknown {
	if (value === null || value === undefined || value === '') return null;
	switch (type) {
		case 'number': {
			const number = typeof value === 'number' ? value : Number(String(value).trim().replace(/,/gu, ''));
			return Number.isFinite(number) ? number : null;
		}
		case 'checkbox':
			return value === true || value === 'true' || value === 1;
		case 'multi': {
			const list = Array.isArray(value) ? value : String(value).split(/[,，]/u);
			const kept = [...new Set(list.map((each) => String(each).trim()).filter(Boolean))];
			return kept.length ? kept : null;
		}
		case 'date': {
			const text = String(value).trim();
			return /^\d{4}-\d{2}-\d{2}$/u.test(text) ? text : null;
		}
		default:
			return String(value);
	}
}

/** The text of a page's ```database block whose id is `id` (none: its first from before ids); none there: null. */
export function databaseFence(source: string, id: string | null = null): string | null {
	return databaseText(source, id);
}

/** The page with that ```database block's text written anew (as it was when it has none). */
export function withDatabaseFence(source: string, text: string, id: string | null = null): string {
	return withDatabaseText(source, id, text);
}

/** The workings a column offers under the table, by its kind (none first: 不计算). */
export function calcKinds(type: ColumnType | 'title'): CalcKind[] {
	const common: CalcKind[] = ['none', 'count', 'filled', 'empty', 'unique', 'filled-percent', 'empty-percent'];
	if (type === 'number') return [...common, 'sum', 'average', 'median', 'min', 'max', 'range'];
	if (type === 'date') return [...common, 'earliest', 'latest', 'span'];
	if (type === 'checkbox') return ['none', 'count', 'checked', 'unchecked', 'checked-percent'];
	if (type === 'title') return ['none', 'count', 'unique'];
	return common;
}

/** A working's name, as the menu and the foot of the table say it. */
export function calcName(kind: CalcKind): string {
	return {
		none: t('不计算'),
		count: t('计数'),
		filled: t('已填'),
		empty: t('为空'),
		unique: t('不重复'),
		'filled-percent': t('已填占比'),
		'empty-percent': t('为空占比'),
		sum: t('求和'),
		average: t('平均'),
		median: t('中位数'),
		min: t('最小'),
		max: t('最大'),
		range: t('范围'),
		earliest: t('最早'),
		latest: t('最晚'),
		span: t('跨度'),
		checked: t('已勾选'),
		unchecked: t('未勾选'),
		'checked-percent': t('勾选占比'),
	}[kind];
}

/** A number as the foot shows it: as it is, at most 6 places after the point, no 0.30000000000000004. */
function figure(value: number): string {
	return String(Number(value.toFixed(6)));
}

/** What `kind` works out of the rows' values in `column` (null: their titles), as the foot of the table shows it. */
export function calculate(kind: CalcKind, rows: Row[], column: Column | null): string {
	const values = rows.map((row) => (column ? row.props[column.name] : row.title));
	const filled = values.filter((value) => !nothing(value));
	const percent = (part: number) => (rows.length ? `${figure((part / rows.length) * 100).replace(/(\.\d)\d*$/u, '$1')}%` : '0%');
	switch (kind) {
		case 'none':
			return '';
		case 'count':
			return String(rows.length);
		case 'filled':
			return String(filled.length);
		case 'empty':
			return String(rows.length - filled.length);
		case 'unique':
			return String(new Set(filled.flatMap((value) => (Array.isArray(value) ? value.map(String) : [shown(value)]))).size);
		case 'filled-percent':
			return percent(filled.length);
		case 'empty-percent':
			return percent(rows.length - filled.length);
		case 'checked':
			return String(values.filter((value) => value === true).length);
		case 'unchecked':
			return String(values.filter((value) => value !== true).length);
		case 'checked-percent':
			return percent(values.filter((value) => value === true).length);
	}
	if (kind === 'earliest' || kind === 'latest' || kind === 'span') {
		const days = filled.map(String).filter((day) => /^\d{4}-\d{2}-\d{2}$/u.test(day)).sort();
		if (!days.length) return '';
		if (kind === 'earliest') return shownDate(days[0]);
		if (kind === 'latest') return shownDate(days.at(-1));
		return t('{count} 天', { count: Math.round((Date.parse(days.at(-1)!) - Date.parse(days[0]!)) / 86_400_000) });
	}
	const numbers = filled.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
	if (!numbers.length) return '';
	const sum = numbers.reduce((total, value) => total + value, 0);
	const middle = Math.floor(numbers.length / 2);
	switch (kind) {
		case 'sum':
			return figure(sum);
		case 'average':
			return figure(sum / numbers.length);
		case 'median':
			return figure(numbers.length % 2 ? numbers[middle]! : (numbers[middle - 1]! + numbers[middle]!) / 2);
		case 'min':
			return figure(numbers[0]!);
		case 'max':
			return figure(numbers.at(-1)!);
		default:
			return figure(numbers.at(-1)! - numbers[0]!);
	}
}
