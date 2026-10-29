import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Ellipsis, Plus, Search, SquareKanban, Table2, X } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import type { DatabaseColumnsChange } from '@studio/api/client';
import { cn } from '@studio/lib/utils';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@studio/ui/dropdown-menu';
import { DatabaseBoard } from './DatabaseBoard';
import { DatabaseTable } from './DatabaseTable';
import { FilterButton, FilterChips, SortButton } from './database-filters';
import { freeColumnName, hasOptions, TITLE, visibleRows, type Column, type ColumnType, type DatabaseConfig, type Row } from './database-config';
import { keepFocus, said, typeName } from './database-parts';

/** What the database's view needs from the Studio around the editor. */
export type DatabaseHost = {
	rows(): Promise<Row[]>;
	setValue(row: string, column: Column, value: unknown): Promise<unknown>;
	setTitle(row: string, title: string): Promise<void>;
	addRow(row: { title?: string; props?: Record<string, unknown>; template: string | null }): Promise<string>;
	/** A row's page to the trash (after asking, as the tree's 删除). */
	removeRow(row: string): Promise<void>;
	/** A row put just before or after another (its page among those under the database). */
	moveRow(row: string, place: { before?: string; after?: string }): Promise<void>;
	changeColumns(change: DatabaseColumnsChange): Promise<void>;
	open(slug: string): void;
	templates(): Promise<Array<{ id: string; name: string }>>;
	toast(message: string, error?: boolean): void;
};

/** The rows, and all that is done to them and to the columns, for the table and the board alike. */
export type Database = ReturnType<typeof useDatabase>;

function useDatabase(config: DatabaseConfig, change: (next: DatabaseConfig) => void, host: DatabaseHost) {
	const [rows, setRows] = useState<Row[] | null>(null);
	const [problem, setProblem] = useState('');
	const [editing, setEditing] = useState<{
		slug: string;
		column: string;
	} | null>(null);
	/** The column whose menu is open (one just added: to be named). */
	const [menuFor, setMenuFor] = useState<string | null>(null);
	/** The filter whose chip is open (one just added: to be filled in). */
	const [openFilter, setOpenFilter] = useState<number | null>(null);
	// The settings as they are now, for what finishes later (a write answered) not to put back older ones.
	const now = useRef(config);
	now.current = config;
	const load = () =>
		host.rows().then(
			(next) => {
				setRows(next);
				setProblem('');
			},
			(error: unknown) => setProblem(said(error)),
		);
	useEffect(() => {
		void load();
		// Back to the window (a row changed in its page, an AI's): read again.
		const again = () => document.visibilityState === 'visible' && void load();
		window.addEventListener('focus', again);
		return () => window.removeEventListener('focus', again);
	}, []);

	const patch = (slug: string, change: (row: Row) => Row) => setRows((before) => before?.map((each) => (each.slug === slug ? change(each) : each)) ?? before);
	const failed = (error: unknown) => {
		host.toast(said(error), true);
		void load();
	};
	const columnsChanged = (asked: DatabaseColumnsChange) => host.changeColumns(asked).then(load, failed);
	const replaceColumn = (name: string, next: Column, extra: Partial<DatabaseConfig> = {}) =>
		change({
			...now.current,
			...extra,
			columns: now.current.columns.map((each) => (each.name === name ? next : each)),
		});
	const current = (column: Column) => now.current.columns.find((each) => each.name === column.name) ?? column;

	return {
		config,
		change,
		host,
		rows,
		problem,
		load,
		editing,
		setEditing,
		menuFor,
		setMenuFor,
		openFilter,
		setOpenFilter,

		/** A value changed: shown at once, written to its page; on failure, the rows as they are. */
		async setValue(row: Row, column: Column, value: unknown): Promise<void> {
			patch(row.slug, (each) => ({
				...each,
				props: { ...each.props, [column.name]: value },
			}));
			try {
				const kept = await host.setValue(row.slug, column, value);
				patch(row.slug, (each) => ({
					...each,
					props: { ...each.props, [column.name]: kept },
				}));
			} catch (error) {
				failed(error);
			}
		},
		async setTitle(row: Row, title: string): Promise<void> {
			patch(row.slug, (each) => ({ ...each, title }));
			await host.setTitle(row.slug, title).catch(failed);
		},
		/** A row made (with these values: the board's list it was made in); its title to be typed. */
		async addRow(props: Record<string, unknown> = {}): Promise<void> {
			try {
				const slug = await host.addRow({
					props,
					template: now.current.template,
				});
				await load();
				setEditing({ slug, column: TITLE });
			} catch (error) {
				host.toast(said(error), true);
			}
		},
		async removeRow(row: Row): Promise<void> {
			await host.removeRow(row.slug).catch(failed);
			await load();
		},
		/** A row dragged before or after another: there among the pages (the tree's order, and the rows'). */
		async moveRow(slug: string, place: { before?: string; after?: string }): Promise<void> {
			const target = place.before ?? place.after;
			if (!target || target === slug) return;
			if (now.current.sorts.length) {
				host.toast(t('排着序时不能拖着换位置：先去掉排序'));
				return;
			}
			setRows((before) => {
				if (!before) return before;
				const moved = before.find((each) => each.slug === slug);
				if (!moved) return before;
				const rest = before.filter((each) => each.slug !== slug);
				const at = rest.findIndex((each) => each.slug === target) + (place.after ? 1 : 0);
				return [...rest.slice(0, at), moved, ...rest.slice(at)];
			});
			await host.moveRow(slug, place).catch(failed);
		},

		/** A column of `type` added (at `at`, else at the end), named as its kind, its menu open to name it. */
		addColumn(type: ColumnType, at = now.current.columns.length): string {
			const name = freeColumnName(now.current, typeName(type));
			const column: Column = {
				name,
				type,
				...(hasOptions(type) ? { options: [] } : {}),
			};
			const columns = [...now.current.columns];
			columns.splice(at, 0, column);
			change({ ...now.current, columns });
			setMenuFor(name);
			return name;
		},
		/** Renamed: in the settings (what is sorted, filtered, grouped by it too) and in every row. */
		renameColumn(column: Column, name: string): boolean {
			const to = name.trim();
			if (!to || to === column.name) return false;
			if (to === TITLE || now.current.columns.some((each) => each.name === to)) {
				host.toast(t('已经有一列叫「{name}」', { name: to }), true);
				return false;
			}
			const config = now.current;
			replaceColumn(
				column.name,
				{ ...current(column), name: to },
				{
					sorts: config.sorts.map((each) => (each.column === column.name ? { ...each, column: to } : each)),
					filter: config.filter.map((each) => (each.column === column.name ? { ...each, column: to } : each)),
					group: config.group === column.name ? to : config.group,
				},
			);
			setMenuFor((open) => (open === column.name ? to : open));
			void columnsChanged({ renames: { [column.name]: to } });
			return true;
		},
		/** Of another kind: its values made that kind in every row; to choices, those the rows have become its choices. */
		setColumnType(column: Column, type: ColumnType): void {
			const before = current(column);
			if (type === before.type) return;
			const had = (rows ?? []).flatMap((row) => {
				const value = row.props[column.name];
				return Array.isArray(value) ? value.map(String) : value === undefined || value === null || value === '' || typeof value === 'boolean' ? [] : [String(value)];
			});
			const next: Column = {
				name: before.name,
				type,
				...(before.width ? { width: before.width } : {}),
				...(before.hidden ? { hidden: true } : {}),
				...(hasOptions(type) ? { options: [...new Set([...(before.options ?? []), ...had])] } : {}),
			};
			const config = now.current;
			const grouped = config.group === column.name && type !== 'select' && type !== 'checkbox';
			replaceColumn(column.name, next, {
				filter: config.filter.filter((each) => each.column !== column.name),
				group: grouped ? null : config.group,
			});
			void columnsChanged({ types: { [column.name]: type } });
		},
		removeColumn(column: Column): void {
			const config = now.current;
			change({
				...config,
				columns: config.columns.filter((each) => each.name !== column.name),
				sorts: config.sorts.filter((each) => each.column !== column.name),
				filter: config.filter.filter((each) => each.column !== column.name),
				group: config.group === column.name ? null : config.group,
			});
			setMenuFor(null);
			void columnsChanged({ removed: [column.name] });
		},
		hideColumn(column: Column, hidden: boolean): void {
			const { hidden: _, ...rest } = current(column);
			replaceColumn(column.name, hidden ? { ...rest, hidden: true } : rest);
		},
		resizeColumn(column: Column, width: number): void {
			replaceColumn(column.name, {
				...current(column),
				width: Math.round(width),
			});
		},
		/** A column moved to just before or after another, its header dragged there. */
		moveColumn(name: string, target: string, after: boolean): void {
			const config = now.current;
			const moved = config.columns.find((each) => each.name === name);
			if (!moved || name === target) return;
			const rest = config.columns.filter((each) => each.name !== name);
			const at = rest.findIndex((each) => each.name === target) + (after ? 1 : 0);
			change({
				...config,
				columns: [...rest.slice(0, at), moved, ...rest.slice(at)],
			});
		},
		/** A choice not among a column's yet: one of them from now on. */
		addOption(column: Column, option: string): void {
			const had = current(column);
			if (!option || had.options?.includes(option)) return;
			replaceColumn(column.name, {
				...had,
				options: [...(had.options ?? []), option],
			});
		},
		renameOption(column: Column, from: string, to: string): void {
			const had = current(column);
			replaceColumn(
				column.name,
				{
					...had,
					options: (had.options ?? []).map((each) => (each === from ? to : each)),
				},
				{
					filter: now.current.filter.map((each) =>
						each.column === column.name && Array.isArray(each.value)
							? {
									...each,
									value: each.value.map((value) => (value === from ? to : value)),
								}
							: each,
					),
				},
			);
			setRows(
				(before) =>
					before?.map((row) => ({
						...row,
						props: {
							...row.props,
							[column.name]: renamedIn(row.props[column.name], from, to),
						},
					})) ?? before,
			);
			void columnsChanged({ values: [{ column: column.name, from, to }] });
		},
		removeOption(column: Column, option: string): void {
			const had = current(column);
			replaceColumn(
				column.name,
				{
					...had,
					options: (had.options ?? []).filter((each) => each !== option),
				},
				{
					filter: now.current.filter.map((each) =>
						each.column === column.name && Array.isArray(each.value)
							? {
									...each,
									value: each.value.filter((value) => value !== option),
								}
							: each,
					),
				},
			);
			setRows(
				(before) =>
					before?.map((row) => ({
						...row,
						props: {
							...row.props,
							[column.name]: renamedIn(row.props[column.name], option, null),
						},
					})) ?? before,
			);
			void columnsChanged({
				values: [{ column: column.name, from: option, to: null }],
			});
		},
	};
}

function renamedIn(value: unknown, from: string, to: string | null): unknown {
	if (Array.isArray(value)) {
		const next = value.map((each) => (each === from ? to : each)).filter((each) => each !== null);
		return next.length ? next : undefined;
	}
	return value === from ? (to ?? undefined) : value;
}

/**
 * A database (database-block.ts), as Notion's: its name; its views (表格, 看板) and, at their right, filters, order,
 * searching, its settings, 新建; the filters and order in force as chips under them; then the rows as the view has
 * them. Its columns and view are the block's (`config`, `change`); the rows' values are the pages' own (`host`).
 */
export function DatabaseView({ config, change, host }: { config: DatabaseConfig; change(next: DatabaseConfig): void; host: DatabaseHost }) {
	const database = useDatabase(config, change, host);
	const [search, setSearch] = useState<string | null>(null);
	const { rows, problem } = database;
	const visible = rows ? visibleRows(rows, config, search ?? '') : [];
	return (
		<div className="db">
			<Title config={config} change={change} />
			<div className="db-bar">
				<div className="db-tabs" role="tablist">
					<Tab view="table" config={config} change={change} />
					<Tab view="board" config={config} change={change} />
				</div>
				<div className="db-tools">
					<FilterButton config={config} change={change} opened={database.setOpenFilter} />
					<SortButton config={config} change={change} />
					{search === null ? (
						<button type="button" className="db-icon-button" aria-label={t('搜索')} data-database-search onClick={() => setSearch('')}>
							<Search aria-hidden />
						</button>
					) : (
						<SearchField value={search} set={setSearch} />
					)}
					<Settings config={config} change={change} host={host} />
					<NewButton config={config} change={change} host={host} add={() => void database.addRow()} />
				</div>
			</div>
			<FilterChips config={config} change={change} openFilter={database.openFilter} setOpenFilter={database.setOpenFilter} />
			{problem ? (
				<p className="db-note is-error">{problem}</p>
			) : !rows ? (
				<p className="db-note">{t('正在读…')}</p>
			) : config.view === 'board' ? (
				<DatabaseBoard database={database} rows={visible} />
			) : (
				<DatabaseTable database={database} rows={visible} />
			)}
		</div>
	);
}

/** Its name, typed in place; none: 无标题. */
function Title({ config, change }: { config: DatabaseConfig; change(next: DatabaseConfig): void }) {
	const [typed, setTyped] = useState(config.title);
	useEffect(() => setTyped(config.title), [config.title]);
	const commit = () => typed.trim() !== config.title && change({ ...config, title: typed.trim() });
	return (
		<input
			className="db-title"
			data-database-title
			value={typed}
			placeholder={t('无标题')}
			onChange={(event) => setTyped(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.nativeEvent.isComposing) return;
				if (event.key === 'Enter') event.currentTarget.blur();
				else if (event.key === 'Escape') {
					setTyped(config.title);
					event.currentTarget.blur();
				}
			}}
		/>
	);
}

function Tab({ view, config, change }: { view: 'table' | 'board'; config: DatabaseConfig; change(next: DatabaseConfig): void }) {
	const Icon = view === 'table' ? Table2 : SquareKanban;
	const groups = config.columns.filter((column) => column.type === 'select' || column.type === 'checkbox');
	return (
		<button
			type="button"
			role="tab"
			data-database-view={view}
			aria-selected={config.view === view}
			className={cn('db-tab', config.view === view && 'is-active')}
			onClick={() =>
				change({
					...config,
					view,
					group: view === 'board' ? (config.group ?? groups[0]?.name ?? null) : config.group,
				})
			}
		>
			<Icon aria-hidden />
			{view === 'table' ? t('表格') : t('看板')}
		</button>
	);
}

function SearchField({ value, set }: { value: string; set(next: string | null): void }) {
	return (
		<label className="db-search">
			<Search aria-hidden />
			<input
				autoFocus
				data-database-search-input
				value={value}
				placeholder={t('搜索…')}
				onChange={(event) => set(event.target.value)}
				onBlur={() => !value && set(null)}
				onKeyDown={(event) => event.key === 'Escape' && set(null)}
			/>
			{value && (
				<button type="button" className="db-search-clear" aria-label={t('清除')} onMouseDown={(event) => event.preventDefault()} onClick={() => set(null)}>
					<X aria-hidden />
				</button>
			)}
		</label>
	);
}

function TemplateItems({ config, change, templates }: { config: DatabaseConfig; change(next: DatabaseConfig): void; templates: Array<{ id: string; name: string }> }) {
	return (
		<>
			<DropdownMenuCheckboxItem checked={config.template === null} onCheckedChange={() => change({ ...config, template: null })}>
				{t('空白页')}
			</DropdownMenuCheckboxItem>
			{templates.map((template) => (
				<DropdownMenuCheckboxItem key={template.id} checked={config.template === template.id} onCheckedChange={() => change({ ...config, template: template.id })}>
					{template.name}
				</DropdownMenuCheckboxItem>
			))}
		</>
	);
}

/** ⋯: which columns are shown, which template a new row is made from, what the board is by. */
function Settings({ config, change, host }: { config: DatabaseConfig; change(next: DatabaseConfig): void; host: DatabaseHost }) {
	const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
	const groups = config.columns.filter((column) => column.type === 'select' || column.type === 'checkbox');
	return (
		<DropdownMenu onOpenChange={(open) => open && void host.templates().then(setTemplates, () => {})}>
			<DropdownMenuTrigger asChild>
				<button type="button" className="db-icon-button" aria-label={t('数据库设置')} data-database-settings>
					<Ellipsis aria-hidden />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="db-dropdown w-60" onCloseAutoFocus={keepFocus}>
				<DropdownMenuLabel>{t('显示的属性')}</DropdownMenuLabel>
				{config.columns.length === 0 && <DropdownMenuItem disabled>{t('还没有属性')}</DropdownMenuItem>}
				{config.columns.map((column) => (
					<DropdownMenuCheckboxItem
						key={column.name}
						checked={!column.hidden}
						data-database-shown={column.name}
						onSelect={(event) => event.preventDefault()}
						onCheckedChange={(shown) => {
							const { hidden: _, ...rest } = column;
							change({
								...config,
								columns: config.columns.map((each) => (each.name === column.name ? (shown ? rest : { ...rest, hidden: true }) : each)),
							});
						}}
					>
						{column.name}
					</DropdownMenuCheckboxItem>
				))}
				<DropdownMenuSeparator />
				{config.view === 'board' && (
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>{config.group ? t('分组：{column}', { column: config.group }) : t('分组…')}</DropdownMenuSubTrigger>
						<DropdownMenuSubContent className="db-dropdown">
							{groups.length === 0 && <DropdownMenuItem disabled>{t('先加一个单选或勾选属性')}</DropdownMenuItem>}
							{groups.map((column) => (
								<DropdownMenuCheckboxItem key={column.name} checked={config.group === column.name} onCheckedChange={() => change({ ...config, group: column.name })}>
									{column.name}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				)}
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>{t('新页面用的模板')}</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="db-dropdown">
						<TemplateItems config={config} change={change} templates={templates} />
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** 新建 (a row, from the template chosen), and beside it ▾: which template. */
function NewButton({ config, change, host, add }: { config: DatabaseConfig; change(next: DatabaseConfig): void; host: DatabaseHost; add(): void }) {
	const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
	return (
		<div className="db-new">
			<button type="button" className="db-new-main" data-database-add onClick={add}>
				{t('新建')}
			</button>
			<DropdownMenu onOpenChange={(open) => open && void host.templates().then(setTemplates, () => {})}>
				<DropdownMenuTrigger asChild>
					<button type="button" className="db-new-more" aria-label={t('新建用哪个模板')}>
						<ChevronDown aria-hidden />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="db-dropdown w-56" onCloseAutoFocus={keepFocus}>
					<DropdownMenuLabel>{t('新页面用的模板')}</DropdownMenuLabel>
					<TemplateItems config={config} change={change} templates={templates} />
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={add}>
						<Plus aria-hidden />
						{t('新建一页')}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
