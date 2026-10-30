import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowLeftToLine, ArrowRightToLine, ArrowUp, ArrowUpRight, Check, ChevronRight, EyeOff, FileText, GripVertical, ListFilter, Plus, Trash2, WrapText } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { DEFAULT_WIDTH, filterOps, shown, TITLE, TITLE_WIDTH, type Column, type Row } from './database-config';
import { CellField, DatePicker, DateText, MenuLine, MenuRow, OptionPicker, Pill, Pop, TYPE_ICONS, TypeList, typeName } from './database-parts';
import type { Database } from './DatabaseView';

/** What a row or a column being dragged carries (its folder name, its name). */
export const ROW_DRAG = 'text/x-studio-row';
const COLUMN_DRAG = 'text/x-studio-column';
const ADD_WIDTH = 44;

/**
 * The table, as Notion's: a head of the columns (each its kind's icon and name; clicked, its menu; dragged, moved;
 * its right edge dragged, wider or narrower; + after the last, a column of a kind), a row for each page (⋮⋮ at its
 * left to drag it or for its menu; its title, 打开 on hover; its values, each edited where it is), + 新建 under them.
 */
export function DatabaseTable({ database, rows }: { database: Database; rows: Row[] }) {
	const { config } = database;
	const columns = config.columns.filter((column) => !column.hidden);
	const [widths, setWidths] = useState<Record<string, number>>({});
	const widthOf = (column: Column) => widths[column.name] ?? column.width ?? DEFAULT_WIDTH;
	const width = TITLE_WIDTH + columns.reduce((sum, column) => sum + widthOf(column), 0) + ADD_WIDTH;
	const [drop, setDrop] = useState<{ slug: string; after: boolean } | null>(null);
	const [dragged, setDragged] = useState<string | null>(null);

	const over = (row: Row) => (event: DragEvent) => {
		if (!event.dataTransfer.types.includes(ROW_DRAG)) return;
		event.preventDefault();
		const box = event.currentTarget.getBoundingClientRect();
		const after = event.clientY > box.top + box.height / 2;
		if (drop?.slug !== row.slug || drop.after !== after) setDrop({ slug: row.slug, after });
	};
	const dropped = (row: Row) => (event: DragEvent) => {
		const slug = event.dataTransfer.getData(ROW_DRAG);
		const after = drop?.after ?? false;
		setDrop(null);
		if (!slug) return;
		event.preventDefault();
		void database.moveRow(slug, after ? { after: row.slug } : { before: row.slug });
	};

	return (
		<div className="db-scroll">
			{/* Rows of cells as wide as their columns (divs, as Notion's: the editor's table look is not theirs). */}
			<div className="db-table" role="table" style={{ width }}>
				<div className="db-tr db-head" role="row">
					<TitleHead database={database} />
					{columns.map((column) => (
						<ColumnHead
							key={column.name}
							column={column}
							database={database}
							resize={(next) => setWidths((before) => (next === null ? {} : { ...before, [column.name]: next }))}
							width={widthOf(column)}
						/>
					))}
					<div className="db-th db-th-add" role="columnheader" style={{ width: ADD_WIDTH }}>
						<AddColumn database={database} />
					</div>
				</div>
				{rows.map((row) => (
					<div
						key={row.slug}
						role="row"
						className={cn('db-tr database-row', drop?.slug === row.slug && (drop.after ? 'is-drop-after' : 'is-drop-before'), dragged === row.slug && 'is-dragged')}
						data-row={row.slug}
						onDragOver={over(row)}
						onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node) && setDrop((now) => (now?.slug === row.slug ? null : now))}
						onDrop={dropped(row)}
					>
						<div className={cn('db-td db-td-title', config.titleWrap && 'is-wrap')} role="cell" style={{ width: TITLE_WIDTH }}>
							<RowHandle row={row} database={database} dragging={(on) => setDragged(on ? row.slug : null)} />
							<TitleCell row={row} database={database} />
						</div>
						{columns.map((column) => (
							<div key={column.name} className={cn('db-td', column.wrap && 'is-wrap')} role="cell" data-column={column.name} style={{ width: widthOf(column) }}>
								<Cell row={row} column={column} database={database} />
							</div>
						))}
						<div className="db-td db-td-add" style={{ width: ADD_WIDTH }} />
					</div>
				))}
			</div>
			<div className="db-foot" style={{ width }}>
				<button type="button" className="db-add-row" data-database-add-row onClick={() => void database.addRow()}>
					<Plus aria-hidden />
					{t('新建')}
				</button>
				<span className="db-count" data-database-count>
					{t('计数 {count}', { count: rows.length })}
				</span>
			</div>
		</div>
	);
}

/** 标题's head: its menu (filter, order) only; it is every row's, not renamed nor taken away. */
function TitleHead({ database }: { database: Database }) {
	const { config, change } = database;
	const [open, setOpen] = useState(false);
	return (
		<div className="db-th" role="columnheader" style={{ width: TITLE_WIDTH }}>
			<Pop
				open={open}
				onOpenChange={setOpen}
				width={220}
				trigger={
					<button type="button" className="db-th-button" data-column-head={TITLE}>
						<TYPE_ICONS.title aria-hidden />
						<span className="db-th-name">{TITLE}</span>
					</button>
				}
			>
				<div className="db-menu">
					<SortAndFilter database={database} name={TITLE} close={() => setOpen(false)} />
					<MenuRow icon={WrapText} onClick={() => change({ ...config, titleWrap: !config.titleWrap })} note={config.titleWrap ? <Check aria-hidden /> : null} data-database-wrap={TITLE}>
						{t('换行显示')}
					</MenuRow>
					{config.filter.length === 0 && config.sorts.length === 0 ? null : (
						<>
							<MenuLine />
							<MenuRow icon={Trash2} onClick={() => change({ ...config, filter: [], sorts: [] })}>
								{t('去掉所有筛选和排序')}
							</MenuRow>
						</>
					)}
				</div>
			</Pop>
		</div>
	);
}

function SortAndFilter({ database, name, close }: { database: Database; name: string; close(): void }) {
	const { config, change } = database;
	const type = name === TITLE ? 'title' : (config.columns.find((column) => column.name === name)?.type ?? 'text');
	const sortBy = (dir: 'asc' | 'desc') => {
		close();
		change({ ...config, sorts: [{ column: name, dir }] });
	};
	return (
		<>
			<MenuRow
				icon={ListFilter}
				onClick={() => {
					close();
					change({
						...config,
						filter: [
							...config.filter,
							{
								column: name,
								op: filterOps(type)[0],
								value: type === 'select' || type === 'multi' ? [] : type === 'checkbox' ? 'true' : '',
							},
						],
					});
					requestAnimationFrame(() => database.setOpenFilter(config.filter.length));
				}}
			>
				{t('筛选')}
			</MenuRow>
			<MenuRow icon={ArrowUp} onClick={() => sortBy('asc')} data-database-sort-asc>
				{t('升序')}
			</MenuRow>
			<MenuRow icon={ArrowDown} onClick={() => sortBy('desc')} data-database-sort-desc>
				{t('降序')}
			</MenuRow>
		</>
	);
}

/** A column's head: clicked, its menu; dragged, moved among the others; its right edge dragged, its width. */
function ColumnHead({ column, database, resize, width }: { column: Column; database: Database; resize(width: number | null): void; width: number }) {
	const Icon = TYPE_ICONS[column.type];
	const [over, setOver] = useState<'before' | 'after' | null>(null);
	const open = database.menuFor === column.name;
	const startResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
		event.preventDefault();
		event.stopPropagation();
		const handle = event.currentTarget;
		handle.setPointerCapture(event.pointerId);
		const from = event.clientX;
		let next = width;
		const move = (moved: PointerEvent) => {
			next = Math.max(80, Math.min(1200, width + moved.clientX - from));
			resize(next);
		};
		const up = () => {
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
			handle.removeEventListener('pointercancel', up);
			if (next !== width) database.resizeColumn(column, next);
			// The width kept in the settings by now (the block's text drawn anew); the one dragged let go next.
			requestAnimationFrame(() => resize(null));
		};
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', up);
		handle.addEventListener('pointercancel', up);
	};
	return (
		<div
			role="columnheader"
			className={cn('db-th', over && `is-drop-${over}`)}
			style={{ width }}
			draggable={!open}
			onDragStart={(event) => {
				event.dataTransfer.setData(COLUMN_DRAG, column.name);
				event.dataTransfer.effectAllowed = 'move';
			}}
			onDragOver={(event) => {
				if (!event.dataTransfer.types.includes(COLUMN_DRAG)) return;
				event.preventDefault();
				const box = event.currentTarget.getBoundingClientRect();
				setOver(event.clientX > box.left + box.width / 2 ? 'after' : 'before');
			}}
			onDragLeave={() => setOver(null)}
			onDrop={(event) => {
				const name = event.dataTransfer.getData(COLUMN_DRAG);
				const side = over;
				setOver(null);
				if (!name || name === column.name) return;
				event.preventDefault();
				database.moveColumn(name, column.name, side === 'after');
			}}
		>
			<Pop
				open={open}
				onOpenChange={(next) => database.setMenuFor(next ? column.name : null)}
				width={240}
				trigger={
					<button type="button" className="db-th-button" data-column-head={column.name}>
						<Icon aria-hidden />
						<span className="db-th-name">{column.name}</span>
					</button>
				}
			>
				<ColumnMenu column={column} database={database} close={() => database.setMenuFor(null)} />
			</Pop>
			<span className="db-resize" aria-hidden onPointerDown={startResize} data-database-resize={column.name} />
		</div>
	);
}

/** A column's menu, as Notion's: its name typed at the top; its kind; filter, order, hide; a column put left or right of it; taken away. */
function ColumnMenu({ column, database, close }: { column: Column; database: Database; close(): void }) {
	const [mode, setMode] = useState<'main' | 'type' | 'delete'>('main');
	const [name, setName] = useState(column.name);
	const typed = useRef(name);
	typed.current = name;
	const field = useRef<HTMLInputElement>(null);
	// Closed with a name typed and not yet kept: kept.
	useEffect(() => () => void (typed.current.trim() && typed.current.trim() !== column.name && database.renameColumn(column, typed.current)), []);
	useEffect(() => field.current?.select(), []);
	const at = database.config.columns.findIndex((each) => each.name === column.name);
	const Icon = TYPE_ICONS[column.type];
	if (mode === 'type') {
		return (
			<TypeList
				chosen={column.type}
				pick={(type) => {
					database.setColumnType(column, type);
					setMode('main');
				}}
			/>
		);
	}
	if (mode === 'delete') {
		return (
			<div className="db-menu">
				<p className="db-menu-text">{t('删除属性「{name}」？每一行里它的值也会删掉（各页改之前都存了历史版本）。', { name: column.name })}</p>
				<MenuRow icon={Trash2} danger onClick={() => database.removeColumn(column)} data-database-confirm-delete>
					{t('删除')}
				</MenuRow>
				<MenuRow onClick={() => setMode('main')}>{t('取消')}</MenuRow>
			</div>
		);
	}
	return (
		<div className="db-menu">
			<label className="db-column-name">
				<Icon aria-hidden />
				<input
					ref={field}
					autoFocus
					data-database-column-name
					value={name}
					onChange={(event) => setName(event.target.value)}
					onKeyDown={(event) => {
						if (event.nativeEvent.isComposing || event.key !== 'Enter') return;
						event.preventDefault();
						if (database.renameColumn(column, name) || name.trim() === column.name) close();
					}}
				/>
			</label>
			<MenuRow
				icon={Icon}
				onClick={() => setMode('type')}
				note={
					<>
						{typeName(column.type)}
						<ChevronRight aria-hidden />
					</>
				}
				data-database-column-type-menu
			>
				{t('类型')}
			</MenuRow>
			<MenuLine />
			<SortAndFilter database={database} name={column.name} close={close} />
			<MenuRow icon={WrapText} onClick={() => database.wrapColumn(column, !column.wrap)} note={column.wrap ? <Check aria-hidden /> : null} data-database-wrap={column.name}>
				{t('换行显示')}
			</MenuRow>
			<MenuRow
				icon={EyeOff}
				onClick={() => {
					close();
					database.hideColumn(column, true);
				}}
				data-database-hide
			>
				{t('隐藏')}
			</MenuRow>
			<MenuLine />
			<MenuRow icon={ArrowLeftToLine} onClick={() => database.addColumn('text', at)}>
				{t('向左插入')}
			</MenuRow>
			<MenuRow icon={ArrowRightToLine} onClick={() => database.addColumn('text', at + 1)}>
				{t('向右插入')}
			</MenuRow>
			<MenuLine />
			<MenuRow icon={Trash2} danger onClick={() => setMode('delete')} data-database-delete-column>
				{t('删除属性')}
			</MenuRow>
		</div>
	);
}

/** + after the last column: a column of the kind picked, named as it, its menu open to name it. */
function AddColumn({ database }: { database: Database }) {
	const [open, setOpen] = useState(false);
	return (
		<Pop
			open={open}
			onOpenChange={setOpen}
			align="end"
			width={220}
			trigger={
				<button type="button" className="db-icon-button" aria-label={t('加一个属性')} data-database-add-column>
					<Plus aria-hidden />
				</button>
			}
		>
			<TypeList
				pick={(type) => {
					setOpen(false);
					database.addColumn(type);
				}}
			/>
		</Pop>
	);
}

/** ⋮⋮ at a row's left (shown on hover): dragged, the row moved; clicked, its menu (open it, delete it). */
function RowHandle({ row, database, dragging }: { row: Row; database: Database; dragging(on: boolean): void }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="db-row-gutter">
			<Pop
				open={open}
				onOpenChange={setOpen}
				side="left"
				width={200}
				trigger={
					<button
						type="button"
						className="db-row-handle"
						draggable
						aria-label={t('拖动，或点开菜单')}
						data-database-row-handle
						onDragStart={(event) => {
							event.dataTransfer.setData(ROW_DRAG, row.slug);
							event.dataTransfer.effectAllowed = 'move';
							const line = event.currentTarget.closest('.db-tr') as HTMLElement | null;
							if (line) event.dataTransfer.setDragImage(line, 24, 16);
							dragging(true);
						}}
						onDragEnd={() => dragging(false)}
					>
						<GripVertical aria-hidden />
					</button>
				}
			>
				<div className="db-menu">
					<MenuRow
						icon={ArrowUpRight}
						onClick={() => {
							setOpen(false);
							database.host.open(row.slug);
						}}
					>
						{t('打开')}
					</MenuRow>
					<MenuRow
						icon={Trash2}
						danger
						data-database-delete-row
						onClick={() => {
							setOpen(false);
							void database.removeRow(row);
						}}
					>
						{t('删除')}
					</MenuRow>
				</div>
			</Pop>
		</div>
	);
}

/** A row's title: its icon, its title (clicked, typed in place), 打开 on hover. */
function TitleCell({ row, database }: { row: Row; database: Database }) {
	const editing = database.editing?.slug === row.slug && database.editing.column === TITLE;
	if (editing) {
		return (
			<div className="db-cell-edit">
				<CellField
					value={row.title}
					done={(title) => {
						database.setEditing(null);
						if (title !== null && title.trim() !== row.title) void database.setTitle(row, title.trim());
					}}
				/>
			</div>
		);
	}
	return (
		<div className="db-title-cell">
			<span className="db-row-icon" aria-hidden>
				{row.icon || <FileText />}
			</span>
			<button type="button" className="db-title-text database-title" onClick={() => database.setEditing({ slug: row.slug, column: TITLE })}>
				{row.title || <span className="db-faint">{t('无标题')}</span>}
			</button>
			<button type="button" className="db-open" data-database-open onClick={() => database.host.open(row.slug)}>
				<ArrowUpRight aria-hidden />
				{t('打开')}
			</button>
		</div>
	);
}

/** A cell: its value as its kind shows it; clicked, edited so (a box ticked at once). */
function Cell({ row, column, database }: { row: Row; column: Column; database: Database }) {
	const value = row.props[column.name];
	const [open, setOpen] = useState(false);
	const set = (next: unknown) => void database.setValue(row, column, next);
	if (column.type === 'checkbox') {
		return (
			<div className="db-cell">
				<button type="button" role="checkbox" aria-checked={value === true} data-database-checkbox className={cn('db-check', value === true && 'is-checked')} onClick={() => set(value !== true)}>
					{value === true && <Check aria-hidden />}
				</button>
			</div>
		);
	}
	if (column.type === 'date') {
		return (
			<Pop
				open={open}
				onOpenChange={setOpen}
				width={260}
				trigger={
					<button type="button" className={cn('db-cell', open && 'is-active')} data-database-date>
						<DateText value={value} />
					</button>
				}
			>
				<DatePicker
					value={typeof value === 'string' ? value : ''}
					set={(day) => {
						set(day);
						setOpen(false);
					}}
				/>
			</Pop>
		);
	}
	if (column.type === 'select' || column.type === 'multi') {
		const chosen = Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : [];
		return (
			<Pop
				open={open}
				onOpenChange={setOpen}
				width={Math.max(260, (column.width ?? DEFAULT_WIDTH) + 40)}
				className="db-pop-flush"
				// Over the cell, as Notion's: what is chosen where it was.
				offset={-34}
				trigger={
					<button type="button" className={cn('db-cell db-cell-pills', open && 'is-active')} data-database-choices>
						{chosen.map((option) => (
							<Pill key={option}>{option}</Pill>
						))}
					</button>
				}
			>
				<OptionPicker
					column={database.config.columns.find((each) => each.name === column.name) ?? column}
					chosen={chosen}
					set={(next) => {
						set(column.type === 'multi' ? next : (next[0] ?? null));
						// One choice: made, done (several: picked on).
						if (column.type === 'select') setOpen(false);
					}}
					addOption={(option) => database.addOption(column, option)}
					renameOption={(from, to) => database.renameOption(column, from, to)}
					removeOption={(option) => database.removeOption(column, option)}
				/>
			</Pop>
		);
	}
	const editing = database.editing?.slug === row.slug && database.editing.column === column.name;
	if (editing) {
		return (
			<div className="db-cell-edit">
				<CellField
					value={shown(value)}
					numeric={column.type === 'number'}
					done={(next) => {
						database.setEditing(null);
						if (next !== null && next.trim() !== shown(value)) set(next.trim() || null);
					}}
				/>
			</div>
		);
	}
	return (
		<div role="button" tabIndex={-1} className={cn('db-cell', column.type === 'number' && 'is-number')} data-database-cell onClick={() => database.setEditing({ slug: row.slug, column: column.name })}>
			{column.type === 'url' && typeof value === 'string' && value ? (
				<>
					<span className="db-url">{value}</span>
					<a href={value} target="_blank" rel="noreferrer" className="db-url-open" aria-label={t('打开网址')} onClick={(event) => event.stopPropagation()}>
						<ArrowUpRight aria-hidden />
					</a>
				</>
			) : (
				<span className="db-cell-text">{shown(value)}</span>
			)}
		</div>
	);
}
