import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownWideNarrow, ArrowUpRight, Calendar, CheckSquare, ChevronDown, Columns3, Filter as FilterIcon, Hash, Link as LinkIcon, Plus, Table2, Tags, Trash2, Type, X, type LucideIcon } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@studio/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@studio/ui/popover';
import { boardLists, COLUMN_TYPES, shown, TITLE, visibleRows, type Column, type ColumnType, type DatabaseConfig, type Row } from './database-config';

/** What the database's view needs from the Studio around the editor. */
export type DatabaseHost = {
	rows(): Promise<Row[]>;
	setValue(row: string, column: Column, value: unknown): Promise<unknown>;
	setTitle(row: string, title: string): Promise<void>;
	addRow(row: { title?: string; props?: Record<string, unknown>; template: string | null }): Promise<string>;
	changeColumns(change: { renames?: Record<string, string>; removed?: string[] }): Promise<void>;
	open(slug: string): void;
	templates(): Promise<Array<{ id: string; name: string }>>;
	toast(message: string, error?: boolean): void;
};

const TYPE_ICONS: Record<ColumnType, LucideIcon> = { text: Type, number: Hash, select: ChevronDown, multi: Tags, date: Calendar, checkbox: CheckSquare, url: LinkIcon };

export function typeName(type: ColumnType): string {
	return { text: t('文字'), number: t('数字'), select: t('单选'), multi: t('多选'), date: t('日期'), checkbox: t('勾选'), url: t('网址') }[type];
}

const TITLE_WIDTH = 260;
const COLUMN_WIDTH = 170;
const ADD_WIDTH = 44;

const said = (error: unknown) => (error instanceof Error ? error.message : String(error));
const plain = 'h-7 rounded-md px-2 text-[12.5px] text-muted-foreground hover:bg-[var(--studio-fill-2)] hover:text-foreground';
/** A menu or popover closed: the keys not taken back to what opened it (a cell, a row's title, may have them by then). */
const keepFocus = (event: Event) => event.preventDefault();

/**
 * A database (database-block.ts): the pages under the page as rows, each with its values; as a table (a cell clicked
 * is edited as its kind is: words, a number, a choice, choices, a date, a box) or as a board (lists by a choice, a
 * card dragged to another list takes its choice). Its columns and view are the block's (`config`, `change`); the rows'
 * values are the pages' own (`host`).
 */
export function DatabaseView({ config, change, host }: { config: DatabaseConfig; change(next: DatabaseConfig): void; host: DatabaseHost }) {
	const [rows, setRows] = useState<Row[] | null>(null);
	const [problem, setProblem] = useState('');
	const [editing, setEditing] = useState<{ slug: string; column: string } | null>(null);
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

	/** A value changed: shown at once, written to its page; on failure, the rows as they are. */
	async function setValue(row: Row, column: Column, value: unknown): Promise<void> {
		setRows((before) => before?.map((each) => (each.slug === row.slug ? { ...each, props: { ...each.props, [column.name]: value } } : each)) ?? before);
		try {
			const kept = await host.setValue(row.slug, column, value);
			setRows((before) => before?.map((each) => (each.slug === row.slug ? { ...each, props: { ...each.props, [column.name]: kept } } : each)) ?? before);
		} catch (error) {
			host.toast(said(error), true);
			void load();
		}
	}

	async function setTitle(row: Row, title: string): Promise<void> {
		setRows((before) => before?.map((each) => (each.slug === row.slug ? { ...each, title } : each)) ?? before);
		await host.setTitle(row.slug, title).catch((error: unknown) => {
			host.toast(said(error), true);
			void load();
		});
	}

	async function addRow(props: Record<string, unknown> = {}): Promise<void> {
		try {
			const slug = await host.addRow({ props, template: config.template });
			await load();
			setEditing({ slug, column: TITLE });
		} catch (error) {
			host.toast(said(error), true);
		}
	}

	/** A choice not among a column's yet: one of them from now on. */
	function withOption(column: Column, option: string): Column {
		if (!option || column.options?.includes(option)) return column;
		const next = { ...column, options: [...(column.options ?? []), option] };
		change({ ...config, columns: config.columns.map((each) => (each.name === column.name ? next : each)) });
		return next;
	}

	if (problem) return <p className="database-note px-1 py-3 text-[13px] text-destructive">{problem}</p>;
	const visible = rows ? visibleRows(rows, config) : [];
	return (
		<div className="database grid gap-1.5">
			<Toolbar config={config} change={change} host={host} count={rows ? visible.length : null} total={rows?.length ?? 0} onAdd={() => void addRow()} />
			{!rows ? (
				<p className="database-note px-1 py-3 text-[13px] text-muted-foreground">{t('正在读…')}</p>
			) : config.view === 'board' ? (
				<Board config={config} change={change} rows={visible} host={host} setValue={setValue} addRow={(props) => void addRow(props)} />
			) : (
				<Table config={config} change={change} rows={visible} host={host} editing={editing} setEditing={setEditing} setValue={setValue} setTitle={setTitle} withOption={withOption} addRow={() => void addRow()} reload={() => void load()} />
			)}
		</div>
	);
}

/** Above the rows: the view (表格, 看板), its filters, its order, the board's lists, and 新建 (from which template). */
function Toolbar({ config, change, host, count, total, onAdd }: { config: DatabaseConfig; change(next: DatabaseConfig): void; host: DatabaseHost; count: number | null; total: number; onAdd(): void }) {
	const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
	useEffect(() => void host.templates().then(setTemplates, () => {}), []);
	const named = [TITLE, ...config.columns.map((column) => column.name)];
	const groups = config.columns.filter((column) => column.type === 'select' || column.type === 'checkbox');
	const tab = (view: 'table' | 'board', label: string, Icon: LucideIcon) => (
		<button type="button" data-database-view={view} aria-pressed={config.view === view} className={cn(plain, 'flex items-center gap-1.5', config.view === view && 'bg-[var(--studio-fill-2)] font-medium text-foreground')} onClick={() => change({ ...config, view, group: view === 'board' ? (config.group ?? groups[0]?.name ?? null) : config.group })}>
			<Icon aria-hidden className="size-3.5" />
			{label}
		</button>
	);
	return (
		<div className="database-toolbar flex flex-wrap items-center gap-1 border-b border-[var(--studio-hairline)] pb-1.5">
			{tab('table', t('表格'), Table2)}
			{tab('board', t('看板'), Columns3)}
			<span className="flex-1" />
			{count !== null && <span className="database-count px-1 text-[12px] text-muted-foreground tabular-nums">{count === total ? t('{count} 条', { count }) : t('{count} / {total} 条', { count, total })}</span>}
			{config.view === 'board' && (
				<DropdownMenu>
					<DropdownMenuTrigger className={plain}>{config.group ? t('按「{column}」分组', { column: config.group }) : t('分组…')}</DropdownMenuTrigger>
					<DropdownMenuContent onCloseAutoFocus={keepFocus} align="end">
						{groups.length === 0 && <DropdownMenuItem disabled>{t('先加一个单选或勾选列')}</DropdownMenuItem>}
						{groups.map((column) => (
							<DropdownMenuItem key={column.name} onSelect={() => change({ ...config, group: column.name })}>
								{column.name}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			<Popover>
				<PopoverTrigger className={cn(plain, 'flex items-center gap-1', config.filter.length && 'text-foreground')} aria-label={t('筛选')} data-database-filter>
					<FilterIcon aria-hidden className="size-3.5" />
					{config.filter.length ? t('筛选 {count}', { count: config.filter.length }) : t('筛选')}
				</PopoverTrigger>
				<PopoverContent onCloseAutoFocus={keepFocus} align="end" className="grid w-80 gap-2 p-3">
					{config.filter.map((filter, index) => (
						<div key={index} className="flex items-center gap-1.5 text-[12.5px]">
							<select className="h-7 rounded-md border border-border bg-background px-1.5" value={filter.column} onChange={(event) => change({ ...config, filter: config.filter.map((each, at) => (at === index ? { ...each, column: event.target.value } : each)) })}>
								{named.map((name) => (
									<option key={name}>{name}</option>
								))}
							</select>
							<span className="text-muted-foreground">{t('含')}</span>
							<input className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2" defaultValue={filter.value} onBlur={(event) => event.target.value !== filter.value && change({ ...config, filter: config.filter.map((each, at) => (at === index ? { ...each, value: event.target.value } : each)).filter((each) => each.value) })} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} />
							<button type="button" className={plain} aria-label={t('去掉这条')} onClick={() => change({ ...config, filter: config.filter.filter((_, at) => at !== index) })}>
								<X aria-hidden className="size-3.5" />
							</button>
						</div>
					))}
					<AddFilter names={named} add={(column, value) => change({ ...config, filter: [...config.filter, { column, value }] })} />
				</PopoverContent>
			</Popover>
			<DropdownMenu>
				<DropdownMenuTrigger className={cn(plain, 'flex items-center gap-1', config.sort && 'text-foreground')} data-database-sort>
					<ArrowDownWideNarrow aria-hidden className="size-3.5" />
					{config.sort ? `${config.sort.column} ${config.sort.dir === 'asc' ? '↑' : '↓'}` : t('排序')}
				</DropdownMenuTrigger>
				<DropdownMenuContent onCloseAutoFocus={keepFocus} align="end">
					{named.map((name) => (
						<DropdownMenuSub key={name}>
							<DropdownMenuSubTrigger>{name}</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								<DropdownMenuItem onSelect={() => change({ ...config, sort: { column: name, dir: 'asc' } })}>{t('升序')}</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => change({ ...config, sort: { column: name, dir: 'desc' } })}>{t('降序')}</DropdownMenuItem>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					))}
					{config.sort && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem onSelect={() => change({ ...config, sort: null })}>{t('不排序')}</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			<div className="flex">
				{/* Its ground marked important: the editor's own buttons' (Milkdown's) would take it. */}
				<button type="button" data-database-add className="flex h-7 items-center gap-1 rounded-l-md bg-foreground! px-2.5 text-[12.5px] font-medium text-background hover:opacity-90" onClick={onAdd}>
					<Plus aria-hidden className="size-3.5" />
					{t('新建')}
				</button>
				<DropdownMenu>
					<DropdownMenuTrigger className="h-7 rounded-r-md border-l border-background/30 bg-foreground! px-1.5 text-background hover:opacity-90" aria-label={t('新建用哪个模板')}>
						<ChevronDown aria-hidden className="size-3.5" />
					</DropdownMenuTrigger>
					<DropdownMenuContent onCloseAutoFocus={keepFocus} align="end">
						<DropdownMenuItem onSelect={() => change({ ...config, template: null })}>{config.template === null ? '✓ ' : ''}{t('空白页')}</DropdownMenuItem>
						{templates.map((template) => (
							<DropdownMenuItem key={template.id} onSelect={() => change({ ...config, template: template.id })}>
								{config.template === template.id ? '✓ ' : ''}
								{t('用模板「{name}」', { name: template.name })}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

function AddFilter({ names, add }: { names: string[]; add(column: string, value: string): void }) {
	const [column, setColumn] = useState(names[0] ?? TITLE);
	const [value, setValue] = useState('');
	return (
		<form
			className="flex items-center gap-1.5 text-[12.5px]"
			onSubmit={(event) => {
				event.preventDefault();
				if (!value.trim()) return;
				add(column, value.trim());
				setValue('');
			}}
		>
			<select className="h-7 rounded-md border border-border bg-background px-1.5" value={column} onChange={(event) => setColumn(event.target.value)}>
				{names.map((name) => (
					<option key={name}>{name}</option>
				))}
			</select>
			<span className="text-muted-foreground">{t('含')}</span>
			<input data-database-filter-value className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2" placeholder={t('写了就筛')} value={value} onChange={(event) => setValue(event.target.value)} />
			<button type="submit" className={plain}>
				{t('加上')}
			</button>
		</form>
	);
}

type TableProps = {
	config: DatabaseConfig;
	change(next: DatabaseConfig): void;
	rows: Row[];
	host: DatabaseHost;
	editing: { slug: string; column: string } | null;
	setEditing(next: { slug: string; column: string } | null): void;
	setValue(row: Row, column: Column, value: unknown): Promise<void>;
	setTitle(row: Row, title: string): Promise<void>;
	withOption(column: Column, option: string): Column;
	addRow(): void;
	reload(): void;
};

function Table({ config, change, rows, host, editing, setEditing, setValue, setTitle, withOption, addRow, reload }: TableProps) {
	return (
		<div className="database-table-scroll overflow-x-auto">
			{/* Columns of their own widths (as Notion's), the table as wide as they are: a long value cut, not the others squeezed. */}
			<table className="database-table table-fixed border-collapse text-[13.5px]" style={{ width: TITLE_WIDTH + config.columns.length * COLUMN_WIDTH + ADD_WIDTH }}>
				<colgroup>
					<col style={{ width: TITLE_WIDTH }} />
					{config.columns.map((column) => (
						<col key={column.name} style={{ width: COLUMN_WIDTH }} />
					))}
					<col style={{ width: ADD_WIDTH }} />
				</colgroup>
				<thead>
					<tr>
						<th className="database-th">
							<span className="flex items-center gap-1.5">
								<Type aria-hidden className="size-3.5 text-muted-foreground" />
								{TITLE}
							</span>
						</th>
						{config.columns.map((column) => (
							<ColumnHead key={column.name} column={column} config={config} change={change} host={host} reload={reload} />
						))}
						<th className="database-th">
							<AddColumn config={config} change={change} />
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.slug} className="database-row" data-row={row.slug}>
							<td className="database-td group/title">
								<div className="flex items-center gap-1.5">
									{row.icon && <span aria-hidden>{row.icon}</span>}
									{editing?.slug === row.slug && editing.column === TITLE ? (
										<TextEditor
											value={row.title}
											done={(title) => {
												setEditing(null);
												if (title !== null && title !== row.title) void setTitle(row, title);
											}}
										/>
									) : (
										<button type="button" className="database-title min-w-0 flex-1 truncate text-left font-medium" onClick={() => setEditing({ slug: row.slug, column: TITLE })}>
											{row.title || <span className="text-muted-foreground">{t('无标题')}</span>}
										</button>
									)}
									<button type="button" data-database-open className="flex h-6 items-center gap-0.5 rounded-md border border-border px-1.5 text-[11.5px] text-muted-foreground opacity-0 group-hover/title:opacity-100 hover:text-foreground" onClick={() => host.open(row.slug)}>
										<ArrowUpRight aria-hidden className="size-3" />
										{t('打开')}
									</button>
								</div>
							</td>
							{config.columns.map((column) => (
								<td key={column.name} className="database-td" data-column={column.name}>
									<Cell
										row={row}
										column={column}
										editing={editing?.slug === row.slug && editing.column === column.name}
										edit={() => setEditing({ slug: row.slug, column: column.name })}
										done={() => setEditing(null)}
										set={(value) => void setValue(row, column, value)}
										withOption={withOption}
									/>
								</td>
							))}
							<td className="database-td" />
						</tr>
					))}
				</tbody>
			</table>
			<button type="button" data-database-add-row className="flex h-8 w-full items-center gap-1.5 px-2 text-[13px] text-muted-foreground hover:bg-[var(--studio-fill)]" onClick={addRow}>
				<Plus aria-hidden className="size-3.5" />
				{t('新建')}
			</button>
		</div>
	);
}

/** A column's head: its kind's icon, its name; its menu (rename, kind, order, take away). */
function ColumnHead({ column, config, change, host, reload }: { column: Column; config: DatabaseConfig; change(next: DatabaseConfig): void; host: DatabaseHost; reload(): void }) {
	const Icon = TYPE_ICONS[column.type];
	const replace = (next: Column) => change({ ...config, columns: config.columns.map((each) => (each.name === column.name ? next : each)) });
	return (
		<th className="database-th" data-column-head={column.name}>
			<DropdownMenu>
				<DropdownMenuTrigger className="flex h-6! w-full items-center gap-1.5 p-0! text-left">
					<Icon aria-hidden className="size-3.5 text-muted-foreground" />
					<span className="truncate">{column.name}</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent onCloseAutoFocus={keepFocus} align="start">
					<DropdownMenuItem
						onSelect={() => {
							const name = window.prompt(t('列的新名字'), column.name)?.trim();
							if (!name || name === column.name) return;
							if (name === TITLE || config.columns.some((each) => each.name === name)) return host.toast(t('已经有一列叫「{name}」', { name }), true);
							change({
								...config,
								columns: config.columns.map((each) => (each.name === column.name ? { ...each, name } : each)),
								sort: config.sort?.column === column.name ? { ...config.sort, column: name } : config.sort,
								filter: config.filter.map((each) => (each.column === column.name ? { ...each, column: name } : each)),
								group: config.group === column.name ? name : config.group,
							});
							void host.changeColumns({ renames: { [column.name]: name } }).then(reload, (error: unknown) => host.toast(said(error), true));
						}}
					>
						{t('重命名…')}
					</DropdownMenuItem>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>{t('类型：{type}', { type: typeName(column.type) })}</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							{COLUMN_TYPES.map((type) => {
								const TypeIcon = TYPE_ICONS[type];
								return (
									<DropdownMenuItem key={type} onSelect={() => replace({ name: column.name, type, ...(type === 'select' || type === 'multi' ? { options: column.options ?? [] } : {}) })}>
										<TypeIcon aria-hidden />
										{typeName(type)}
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					<DropdownMenuItem onSelect={() => change({ ...config, sort: { column: column.name, dir: 'asc' } })}>{t('升序')}</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => change({ ...config, sort: { column: column.name, dir: 'desc' } })}>{t('降序')}</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => {
							if (!window.confirm(t('删除「{name}」这一列？每一行里这一列的值也会删掉（改之前各页存了历史版本）。', { name: column.name }))) return;
							change({
								...config,
								columns: config.columns.filter((each) => each.name !== column.name),
								sort: config.sort?.column === column.name ? null : config.sort,
								filter: config.filter.filter((each) => each.column !== column.name),
								group: config.group === column.name ? null : config.group,
							});
							void host.changeColumns({ removed: [column.name] }).then(reload, (error: unknown) => host.toast(said(error), true));
						}}
					>
						<Trash2 aria-hidden />
						{t('删除这一列')}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</th>
	);
}

/** + after the last column: a column of a name and kind. */
function AddColumn({ config, change }: { config: DatabaseConfig; change(next: DatabaseConfig): void }) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState('');
	const [type, setType] = useState<ColumnType>('text');
	const taken = name.trim() === TITLE || config.columns.some((column) => column.name === name.trim());
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger className={plain} aria-label={t('加一列')} data-database-add-column>
				<Plus aria-hidden className="size-3.5" />
			</PopoverTrigger>
			<PopoverContent onCloseAutoFocus={keepFocus} align="end" className="grid w-64 gap-2 p-3">
				<form
					className="grid gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						if (!name.trim() || taken) return;
						change({ ...config, columns: [...config.columns, { name: name.trim(), type, ...(type === 'select' || type === 'multi' ? { options: [] } : {}) }] });
						setName('');
						setType('text');
						setOpen(false);
					}}
				>
					<input data-database-column-name autoFocus className="h-8 rounded-md border border-border bg-background px-2 text-[13px]" placeholder={t('列名')} value={name} onChange={(event) => setName(event.target.value)} />
					<div className="grid grid-cols-2 gap-1">
						{COLUMN_TYPES.map((each) => {
							const Icon = TYPE_ICONS[each];
							return (
								<button key={each} type="button" data-database-column-type={each} aria-pressed={type === each} className={cn(plain, 'flex items-center gap-1.5', type === each && 'bg-[var(--studio-fill-2)] text-foreground')} onClick={() => setType(each)}>
									<Icon aria-hidden className="size-3.5" />
									{typeName(each)}
								</button>
							);
						})}
					</div>
					{taken && <span className="text-[11.5px] text-destructive">{t('已经有一列叫这个名字')}</span>}
					<button type="submit" disabled={!name.trim() || taken} className="h-8 rounded-md bg-foreground! text-[13px] font-medium text-background disabled:opacity-40">
						{t('加上')}
					</button>
				</form>
			</PopoverContent>
		</Popover>
	);
}

/** A field taking the keys: ↩ or leaving it keeps what is typed, Esc gives it up. */
function TextEditor({ value, type = 'text', done }: { value: string; type?: 'text' | 'number' | 'url'; done(value: string | null): void }) {
	const field = useRef<HTMLInputElement>(null);
	const finished = useRef(false);
	const finish = (next: string | null) => {
		if (finished.current) return;
		finished.current = true;
		done(next);
	};
	useEffect(() => {
		field.current?.focus();
		field.current?.select();
	}, []);
	return (
		<input
			ref={field}
			data-database-input
			type={type === 'number' ? 'text' : type}
			inputMode={type === 'number' ? 'decimal' : undefined}
			className="h-7 w-full min-w-0 rounded border border-foreground/40 bg-background px-1.5 text-[13.5px] outline-none"
			defaultValue={value}
			onBlur={(event) => finish(event.target.value)}
			onKeyDown={(event) => {
				if (event.nativeEvent.isComposing) return;
				if (event.key === 'Enter') finish(event.currentTarget.value);
				else if (event.key === 'Escape') finish(null);
			}}
		/>
	);
}

/** A cell: its value shown as its kind is; clicked, edited so. */
function Cell({ row, column, editing, edit, done, set, withOption }: { row: Row; column: Column; editing: boolean; edit(): void; done(): void; set(value: unknown): void; withOption(column: Column, option: string): Column }) {
	const value = row.props[column.name];
	if (column.type === 'checkbox') {
		return <input type="checkbox" data-database-checkbox className="size-4 accent-foreground" checked={value === true} onChange={(event) => set(event.target.checked)} />;
	}
	if (column.type === 'date') {
		return <input type="date" className="h-7 w-full bg-transparent text-[13.5px] outline-none" value={typeof value === 'string' ? value : ''} onChange={(event) => set(event.target.value || null)} />;
	}
	if (column.type === 'select' || column.type === 'multi') return <Choices column={column} value={value} set={set} withOption={withOption} />;
	if (editing) {
		return (
			<TextEditor
				value={shown(value)}
				type={column.type === 'number' ? 'number' : column.type === 'url' ? 'url' : 'text'}
				done={(next) => {
					done();
					if (next !== null && next !== shown(value)) set(next.trim() ? next : null);
				}}
			/>
		);
	}
	return (
		<button type="button" data-database-cell className={cn('block min-h-7 w-full truncate text-left', column.type === 'number' && 'text-right tabular-nums')} onClick={edit}>
			{column.type === 'url' && typeof value === 'string' && value ? (
				<a href={value} target="_blank" rel="noreferrer" className="underline decoration-foreground/30 underline-offset-2" onClick={(event) => event.stopPropagation()}>
					{value}
				</a>
			) : (
				shown(value)
			)}
		</button>
	);
}

/** One choice (单选) or several (多选): those there are to pick from, and a new one typed. */
function Choices({ column, value, set, withOption }: { column: Column; value: unknown; set(value: unknown): void; withOption(column: Column, option: string): Column }) {
	const [typed, setTyped] = useState('');
	const [open, setOpen] = useState(false);
	const chosen = Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : [];
	const many = column.type === 'multi';
	const pick = (option: string) => {
		if (many) set(chosen.includes(option) ? chosen.filter((each) => each !== option) : [...chosen, option]);
		else {
			set(chosen[0] === option ? null : option);
			// One choice: made, done (several: picked on).
			setOpen(false);
		}
	};
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger className="flex min-h-7 w-full flex-wrap items-center gap-1 text-left" data-database-choices>
				{chosen.map((option) => (
					<Chip key={option}>{option}</Chip>
				))}
			</PopoverTrigger>
			<PopoverContent onCloseAutoFocus={keepFocus} align="start" className="grid w-56 gap-1 p-2">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						const option = typed.trim();
						if (!option) return;
						withOption(column, option);
						// Typed: that one (not a choice made undone, as a click on one made does).
						if (many) set(chosen.includes(option) ? chosen : [...chosen, option]);
						else {
							set(option);
							setOpen(false);
						}
						setTyped('');
					}}
				>
					<input data-database-new-option className="h-7 w-full rounded-md border border-border bg-background px-2 text-[13px]" placeholder={t('选一个，或写一个新的')} value={typed} onChange={(event) => setTyped(event.target.value)} />
				</form>
				{(column.options ?? [])
					.filter((option) => !typed.trim() || option.includes(typed.trim()))
					.map((option) => (
						<button key={option} type="button" data-database-option={option} className="flex h-7 items-center justify-between rounded-md px-1.5 text-left hover:bg-[var(--studio-fill-2)]" onClick={() => pick(option)}>
							<Chip>{option}</Chip>
							{chosen.includes(option) && <span aria-hidden>✓</span>}
						</button>
					))}
			</PopoverContent>
		</Popover>
	);
}

function Chip({ children }: { children: ReactNode }) {
	return <span className="database-chip inline-flex h-5 items-center rounded bg-[var(--studio-fill-2)] px-1.5 text-[12px] text-foreground">{children}</span>;
}

/** The board: a list for each choice of the column it is by; a card dragged to another list takes that choice. */
function Board({ config, rows, host, setValue, addRow }: { config: DatabaseConfig; change(next: DatabaseConfig): void; rows: Row[]; host: DatabaseHost; setValue(row: Row, column: Column, value: unknown): Promise<void>; addRow(props: Record<string, unknown>): void }) {
	const column = config.columns.find((each) => each.name === config.group);
	const [over, setOver] = useState<string | null>(null);
	if (!column) return <p className="database-note px-1 py-3 text-[13px] text-muted-foreground">{t('看板要按一个单选或勾选列分组：先加一列，再在右上角选它')}</p>;
	const lists = boardLists(rows, config);
	const named = (value: string | null) => (value === null ? t('没有{column}', { column: column.name }) : column.type === 'checkbox' ? t('已勾选') : value);
	const others = config.columns.filter((each) => each.name !== column.name).slice(0, 3);
	return (
		<div className="database-board flex gap-3 overflow-x-auto pb-2">
			{lists.map((list) => {
				const key = list.value ?? '';
				return (
					<section
						key={key}
						data-board-list={key}
						className={cn('flex w-60 flex-none flex-col gap-1.5 rounded-lg p-1.5', over === key && 'bg-[var(--studio-fill)]')}
						onDragOver={(event) => {
							event.preventDefault();
							setOver(key);
						}}
						onDragLeave={() => setOver((now) => (now === key ? null : now))}
						onDrop={(event) => {
							event.preventDefault();
							setOver(null);
							const row = rows.find((each) => each.slug === event.dataTransfer.getData('text/x-studio-row'));
							if (row && shown(row.props[column.name]) !== key) void setValue(row, column, column.type === 'checkbox' ? list.value === 'true' : list.value);
						}}
					>
						<header className="flex items-center gap-1.5 px-1 text-[12.5px]">
							<Chip>{named(list.value)}</Chip>
							<span className="text-muted-foreground tabular-nums">{list.rows.length}</span>
						</header>
						{list.rows.map((row) => (
							<article
								key={row.slug}
								draggable
								data-board-card={row.slug}
								className="grid cursor-pointer gap-1 rounded-md border border-[var(--studio-hairline)] bg-background p-2 shadow-xs hover:bg-[var(--studio-fill)]"
								onDragStart={(event) => {
									event.dataTransfer.setData('text/x-studio-row', row.slug);
									event.dataTransfer.effectAllowed = 'move';
								}}
								onClick={() => host.open(row.slug)}
							>
								<span className="text-[13.5px] font-medium">
									{row.icon ? `${row.icon} ` : ''}
									{row.title || t('无标题')}
								</span>
								{others.map((each) => (shown(row.props[each.name]) ? <span key={each.name} className="truncate text-[12px] text-muted-foreground">{each.name}：{shown(row.props[each.name])}</span> : null))}
							</article>
						))}
						<button type="button" className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[12.5px] text-muted-foreground hover:bg-[var(--studio-fill-2)]" onClick={() => addRow(list.value === null ? {} : { [column.name]: column.type === 'checkbox' ? list.value === 'true' : list.value })}>
							<Plus aria-hidden className="size-3.5" />
							{t('新建')}
						</button>
					</section>
				);
			})}
		</div>
	);
}

