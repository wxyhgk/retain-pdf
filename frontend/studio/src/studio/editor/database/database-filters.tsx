import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ListFilter, Plus, Trash2, X } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { filterOps, TITLE, type ColumnType, type DatabaseConfig, type Filter, type FilterOp } from './database-config';
import { DatePicker, MenuLine, MenuRow, Pop, TYPE_ICONS } from './database-parts';

/** Filters and order, as Notion's: the toolbar's buttons, the chips of those in force under it, and what each chip opens. */

type Props = { config: DatabaseConfig; change(next: DatabaseConfig): void };

const typeOf = (config: DatabaseConfig, column: string): ColumnType | 'title' => (column === TITLE ? 'title' : (config.columns.find((each) => each.name === column)?.type ?? 'text'));

function opName(op: FilterOp, type: ColumnType | 'title'): string {
	if (type === 'number' && op === 'is') return '=';
	if (type === 'number' && op === 'is-not') return '≠';
	return {
		contains: t('含'),
		'not-contains': t('不含'),
		is: t('是'),
		'is-not': t('不是'),
		gt: '>',
		lt: '<',
		ge: '≥',
		le: '≤',
		before: t('早于'),
		after: t('晚于'),
		any: t('是其中之一'),
		none: t('都不是'),
		checked: t('是'),
		empty: t('为空'),
		'not-empty': t('不为空'),
	}[op];
}

/** A new filter on `column`: as its kind's first `op`, nothing asked yet. */
function newFilter(config: DatabaseConfig, column: string): Filter {
	const type = typeOf(config, column);
	return {
		column,
		op: filterOps(type)[0],
		value: type === 'select' || type === 'multi' ? [] : type === 'checkbox' ? 'true' : '',
	};
}

/** The columns (标题 first), to pick one: to filter by it, to sort by it. */
function PropertyPicker({ config, pick, caption }: Props & { pick(column: string): void; caption: string }) {
	const [query, setQuery] = useState('');
	const names = [TITLE, ...config.columns.map((column) => column.name)].filter((name) => !query.trim() || name.toLocaleLowerCase('zh-CN').includes(query.trim().toLocaleLowerCase('zh-CN')));
	return (
		<div className="db-menu">
			<input
				className="db-field"
				autoFocus
				placeholder={caption}
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				onKeyDown={(event) => event.key === 'Enter' && names[0] && pick(names[0])}
				data-database-property-search
			/>
			{names.map((name) => (
				<MenuRow key={name} icon={TYPE_ICONS[typeOf(config, name)]} onClick={() => pick(name)} data-database-property={name}>
					{name}
				</MenuRow>
			))}
		</div>
	);
}

/** 筛选 in the toolbar: a column picked, its filter added and opened. */
export function FilterButton({ config, change, opened }: Props & { opened(index: number): void }) {
	const [open, setOpen] = useState(false);
	return (
		<Pop
			open={open}
			onOpenChange={setOpen}
			align="end"
			width={240}
			trigger={
				<button type="button" className={cn('db-icon-button', config.filter.length > 0 && 'is-on')} aria-label={t('筛选')} data-database-filter>
					<ListFilter aria-hidden />
				</button>
			}
		>
			<PropertyPicker
				config={config}
				change={change}
				caption={t('按哪个属性筛选…')}
				pick={(column) => {
					setOpen(false);
					change({
						...config,
						filter: [...config.filter, newFilter(config, column)],
					});
					// Opened once the chip is there.
					requestAnimationFrame(() => opened(config.filter.length));
				}}
			/>
		</Pop>
	);
}

/** 排序 in the toolbar: the order's editor. */
export function SortButton({ config, change }: Props) {
	return (
		<Pop
			align="end"
			width={config.sorts.length ? 340 : 240}
			trigger={
				<button type="button" className={cn('db-icon-button', config.sorts.length > 0 && 'is-on')} aria-label={t('排序')} data-database-sort>
					<ArrowUpDown aria-hidden />
				</button>
			}
		>
			<SortEditor config={config} change={change} />
		</Pop>
	);
}

/** The order: by which columns, which way (the first deciding, the next between those equal by it…). */
function SortEditor({ config, change }: Props) {
	const [adding, setAdding] = useState(false);
	const names = [TITLE, ...config.columns.map((column) => column.name)];
	if (!config.sorts.length || adding) {
		return (
			<PropertyPicker
				config={config}
				change={change}
				caption={t('按哪个属性排序…')}
				pick={(column) => {
					setAdding(false);
					change({
						...config,
						sorts: [...config.sorts.filter((each) => each.column !== column), { column, dir: 'asc' }],
					});
				}}
			/>
		);
	}
	return (
		<div className="db-menu">
			{config.sorts.map((sort, index) => (
				<div key={sort.column} className="db-sort-row" data-database-sort-row={sort.column}>
					<select
						className="db-select"
						value={sort.column}
						onChange={(event) =>
							change({
								...config,
								sorts: config.sorts
									.map((each, at) => (at === index ? { ...each, column: event.target.value } : each))
									.filter((each, at, all) => all.findIndex((other) => other.column === each.column) === at),
							})
						}
					>
						{names.map((name) => (
							<option key={name}>{name}</option>
						))}
					</select>
					<select
						className="db-select"
						value={sort.dir}
						data-database-sort-dir
						onChange={(event) =>
							change({
								...config,
								sorts: config.sorts.map((each, at) => (at === index ? { ...each, dir: event.target.value as 'asc' | 'desc' } : each)),
							})
						}
					>
						<option value="asc">{t('升序')}</option>
						<option value="desc">{t('降序')}</option>
					</select>
					<button
						type="button"
						className="db-icon-button"
						aria-label={t('去掉这条')}
						onClick={() =>
							change({
								...config,
								sorts: config.sorts.filter((_, at) => at !== index),
							})
						}
					>
						<X aria-hidden />
					</button>
				</div>
			))}
			<MenuLine />
			<MenuRow icon={Plus} onClick={() => setAdding(true)}>
				{t('添加排序')}
			</MenuRow>
			<MenuRow icon={Trash2} onClick={() => change({ ...config, sorts: [] })}>
				{t('删除排序')}
			</MenuRow>
		</div>
	);
}

/** Under the toolbar, when the view is filtered or sorted: a chip for the order, one for each filter, and + 筛选. */
export function FilterChips({
	config,
	change,
	openFilter,
	setOpenFilter,
}: Props & {
	openFilter: number | null;
	setOpenFilter(index: number | null): void;
}) {
	const [adding, setAdding] = useState(false);
	if (!config.filter.length && !config.sorts.length) return null;
	const first = config.sorts[0];
	return (
		<div className="db-chips">
			{first && (
				<Pop
					width={340}
					trigger={
						<button type="button" className="db-chip is-on" data-database-sort-chip>
							{config.sorts.length === 1 ? first.dir === 'asc' ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden /> : <ArrowUpDown aria-hidden />}
							{config.sorts.length === 1 ? first.column : t('{count} 条排序', { count: config.sorts.length })}
							<ChevronDown aria-hidden className="db-chip-caret" />
						</button>
					}
				>
					<SortEditor config={config} change={change} />
				</Pop>
			)}
			{first && config.filter.length > 0 && <span className="db-chips-line" />}
			{config.filter.map((filter, index) => (
				<Pop
					key={`${filter.column}-${index}`}
					open={openFilter === index}
					onOpenChange={(open) => setOpenFilter(open ? index : null)}
					width={filterWidth(typeOf(config, filter.column))}
					trigger={
						<button type="button" className={cn('db-chip', filled(filter) && 'is-on')} data-database-filter-chip={filter.column}>
							{chipText(config, filter)}
							<ChevronDown aria-hidden className="db-chip-caret" />
						</button>
					}
				>
					<FilterEditor config={config} change={change} index={index} close={() => setOpenFilter(null)} />
				</Pop>
			))}
			<Pop
				open={adding}
				onOpenChange={setAdding}
				width={240}
				trigger={
					<button type="button" className="db-chip is-add" data-database-add-filter>
						<Plus aria-hidden />
						{t('筛选')}
					</button>
				}
			>
				<PropertyPicker
					config={config}
					change={change}
					caption={t('按哪个属性筛选…')}
					pick={(column) => {
						setAdding(false);
						change({
							...config,
							filter: [...config.filter, newFilter(config, column)],
						});
						requestAnimationFrame(() => setOpenFilter(config.filter.length));
					}}
				/>
			</Pop>
		</div>
	);
}

const filterWidth = (type: ColumnType | 'title') => (type === 'date' ? 280 : 260);
const filled = (filter: Filter) => filter.op === 'empty' || filter.op === 'not-empty' || filter.op === 'checked' || (Array.isArray(filter.value) ? filter.value.length > 0 : filter.value !== '');

function chipText(config: DatabaseConfig, filter: Filter): string {
	const type = typeOf(config, filter.column);
	if (filter.op === 'checked') return `${filter.column}：${filter.value === 'false' ? t('未勾选') : t('已勾选')}`;
	if (filter.op === 'empty' || filter.op === 'not-empty') return `${filter.column}：${opName(filter.op, type)}`;
	if (!filled(filter)) return filter.column;
	const value = Array.isArray(filter.value) ? filter.value.join('、') : filter.value;
	const plain = filter.op === 'contains' || filter.op === 'any';
	return `${filter.column}：${plain ? '' : `${opName(filter.op, type)} `}${value}`;
}

/** One filter: on which column, how (`op`), of what; or taken away. */
function FilterEditor({ config, change, index, close }: Props & { index: number; close(): void }) {
	const filter = config.filter[index];
	if (!filter) return null;
	const type = typeOf(config, filter.column);
	const set = (next: Partial<Filter>) =>
		change({
			...config,
			filter: config.filter.map((each, at) => (at === index ? { ...each, ...next } : each)),
		});
	const options = config.columns.find((column) => column.name === filter.column)?.options ?? [];
	const asked = filter.op !== 'empty' && filter.op !== 'not-empty';
	return (
		<div className="db-menu db-filter">
			<div className="db-filter-head">
				<span className="db-filter-column">{filter.column}</span>
				{type !== 'checkbox' && (
					<select className="db-select is-plain" value={filter.op} data-database-filter-op onChange={(event) => set({ op: event.target.value as FilterOp })}>
						{filterOps(type).map((op) => (
							<option key={op} value={op}>
								{opName(op, type)}
							</option>
						))}
					</select>
				)}
				<span className="db-grow" />
				<button
					type="button"
					className="db-icon-button"
					aria-label={t('删除这条筛选')}
					data-database-remove-filter
					onClick={() => {
						close();
						change({
							...config,
							filter: config.filter.filter((_, at) => at !== index),
						});
					}}
				>
					<Trash2 aria-hidden />
				</button>
			</div>
			{type === 'checkbox' ? (
				<>
					<MenuRow active={filter.value !== 'false'} onClick={() => set({ value: 'true' })} note={filter.value !== 'false' ? '✓' : undefined}>
						{t('已勾选')}
					</MenuRow>
					<MenuRow active={filter.value === 'false'} onClick={() => set({ value: 'false' })} note={filter.value === 'false' ? '✓' : undefined}>
						{t('未勾选')}
					</MenuRow>
				</>
			) : !asked ? null : type === 'select' || type === 'multi' ? (
				<>
					{options.length === 0 && <div className="db-menu-caption">{t('这一列还没有选项')}</div>}
					{options.map((option) => {
						const list = Array.isArray(filter.value) ? filter.value : [];
						const on = list.includes(option);
						return (
							<button
								key={option}
								type="button"
								className="db-menu-row"
								data-database-filter-option={option}
								onClick={() =>
									set({
										value: on ? list.filter((each) => each !== option) : [...list, option],
									})
								}
							>
								<span className={cn('db-check is-small', on && 'is-checked')} aria-hidden>
									{on ? '✓' : ''}
								</span>
								<span className="db-pill">
									<span className="db-pill-text">{option}</span>
								</span>
							</button>
						);
					})}
				</>
			) : type === 'date' && (filter.op === 'is' || filter.op === 'before' || filter.op === 'after') ? (
				<DatePicker value={typeof filter.value === 'string' ? filter.value : ''} set={(day) => set({ value: day ?? '' })} />
			) : (
				<ValueField value={typeof filter.value === 'string' ? filter.value : ''} numeric={type === 'number'} set={(value) => set({ value })} close={close} />
			)}
		</div>
	);
}

/** What a filter looks for, typed: the rows filtered as it is typed (a moment after), kept in the block when done. */
function ValueField({ value, numeric, set, close }: { value: string; numeric: boolean; set(value: string): void; close(): void }) {
	const [typed, setTyped] = useState(value);
	const latest = useRef({ typed, value, set });
	latest.current = { typed, value, set };
	useEffect(() => {
		if (typed === value) return;
		const later = setTimeout(() => latest.current.set(typed), 400);
		return () => clearTimeout(later);
	}, [typed]);
	// Closed before the moment: kept all the same.
	useEffect(() => () => void (latest.current.typed !== latest.current.value && latest.current.set(latest.current.typed)), []);
	return (
		<input
			className="db-field"
			autoFocus
			data-database-filter-value
			inputMode={numeric ? 'decimal' : undefined}
			placeholder={numeric ? t('一个数') : t('写些字…')}
			value={typed}
			onChange={(event) => setTyped(event.target.value)}
			onKeyDown={(event) => event.key === 'Enter' && close()}
		/>
	);
}
