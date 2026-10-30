import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowLeftToLine, ArrowRightToLine, ArrowUp, ArrowUpRight, Check, ChevronDown, ChevronRight, EyeOff, FileText, GripVertical, ListFilter, Plus, Trash2, WrapText } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { calcKinds, calcName, calculate, DEFAULT_WIDTH, filterOps, shown, TITLE, TITLE_WIDTH, type Column, type Row } from './database-config';
import { CellField, DatePicker, DateText, MenuLine, MenuRow, OptionPicker, Pill, Pop, TYPE_ICONS, TypeList, typeName } from './database-parts';
import type { Database, Spot } from './DatabaseView';
import { cellsOf, copiedText, pastedValue, tableText } from './table-clipboard';

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
	const keys = useTableKeys(database, rows, columns);

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
			{/* Rows of cells as wide as their columns (divs, as Notion's: the editor's table look is not theirs); the keys its
			    own while no cell is typed in (useTableKeys). */}
			<div className="db-table" role="table" style={{ width }} tabIndex={-1} ref={database.table} onKeyDown={keys.down} onCopy={keys.copy} onPaste={keys.paste}>
				<div className="db-tr db-head" role="row">
					<TitleHead database={database} rows={rows} />
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
						className={cn('db-tr database-row', drop?.slug === row.slug && (drop.after ? 'is-drop-after' : 'is-drop-before'), dragged === row.slug && 'is-dragged', database.chosenRows.has(row.slug) && 'is-chosen')}
						data-row={row.slug}
						onDragOver={over(row)}
						onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node) && setDrop((now) => (now?.slug === row.slug ? null : now))}
						onDrop={dropped(row)}
					>
						<div className={cn('db-td db-td-title', config.titleWrap && 'is-wrap', keys.marks(row.slug, TITLE))} role="cell" data-column={TITLE} style={{ width: TITLE_WIDTH }} onMouseDown={keys.press(row.slug, TITLE)}>
							<RowHandle row={row} rows={rows} database={database} dragging={(on) => setDragged(on ? row.slug : null)} />
							<TitleCell row={row} database={database} />
						</div>
						{columns.map((column) => (
							<div key={column.name} className={cn('db-td', column.wrap && 'is-wrap', keys.marks(row.slug, column.name))} role="cell" data-column={column.name} style={{ width: widthOf(column) }} onMouseDown={keys.press(row.slug, column.name)}>
								<Cell row={row} column={column} database={database} />
							</div>
						))}
						<div className="db-td db-td-add" style={{ width: ADD_WIDTH }} />
					</div>
				))}
				<div className="db-tr db-foot" style={{ width }}>
					<button type="button" className="db-add-row" data-database-add-row onClick={() => void database.addRow()}>
						<Plus aria-hidden />
						{t('新建')}
					</button>
				</div>
				{/* What is worked out of each column, under it (as Notion's 计算). */}
				<div className="db-tr db-calc-row" role="row">
					<div className="db-td db-td-title db-calc" style={{ width: TITLE_WIDTH }}>
						<Calc name={TITLE} column={null} rows={rows} database={database} />
					</div>
					{columns.map((column) => (
						<div key={column.name} className="db-td db-calc" style={{ width: widthOf(column) }}>
							<Calc name={column.name} column={column} rows={rows} database={database} />
						</div>
					))}
					<div className="db-td db-td-add" style={{ width: ADD_WIDTH }} />
				</div>
			</div>
		</div>
	);
}

/** 标题's head: its menu (filter, order) only; it is every row's, not renamed nor taken away. At its left, a box for all the rows. */
function TitleHead({ database, rows }: { database: Database; rows: Row[] }) {
	const { config, change } = database;
	const [open, setOpen] = useState(false);
	const all = rows.length > 0 && rows.every((row) => database.chosenRows.has(row.slug));
	return (
		<div className="db-th" role="columnheader" style={{ width: TITLE_WIDTH }}>
			<div className={cn('db-row-gutter', database.chosenRows.size > 0 && 'is-choosing')}>
				<button type="button" role="checkbox" aria-checked={all} aria-label={t('选中所有行')} data-database-choose-all className={cn('db-check is-small db-row-box', all && 'is-checked')} onClick={() => database.chooseAll(rows)}>
					{all && <Check aria-hidden />}
				</button>
			</div>
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

/**
 * At a row's left (shown on hover, as Notion's): its box, to choose it with others (⇧, a run of them); ⋮⋮, dragged, the
 * row moved, clicked, its menu (open it, delete it).
 */
function RowHandle({ row, rows, database, dragging }: { row: Row; rows: Row[]; database: Database; dragging(on: boolean): void }) {
	const [open, setOpen] = useState(false);
	const chosen = database.chosenRows.has(row.slug);
	return (
		<div className={cn('db-row-gutter', database.chosenRows.size > 0 && 'is-choosing')}>
			<button
				type="button"
				role="checkbox"
				aria-checked={chosen}
				aria-label={t('选中这一行')}
				data-database-choose-row={row.slug}
				className={cn('db-check is-small db-row-box', chosen && 'is-checked')}
				onClick={(event) => database.chooseRow(row.slug, rows, event.shiftKey)}
			>
				{chosen && <Check aria-hidden />}
			</button>
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
					initial={database.editing?.initial}
					done={(title, how) => {
						database.setEditing(null);
						if (title !== null && title.trim() !== row.title) void database.setTitle(row, title.trim());
						afterTyping(database, how);
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

/** A cell typed in, done: the keys back to the table; by Tab, the next cell (⇧Tab, the one before) chosen. */
function afterTyping(database: Database, how?: string): void {
	if (how === 'blur') return;
	database.focusTable();
	if (how !== 'tab' && how !== 'back-tab') return;
	requestAnimationFrame(() => database.table.current?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: how === 'back-tab', bubbles: true })));
}

/** A cell: its value as its kind shows it; clicked, edited so (a box ticked at once). */
function Cell({ row, column, database }: { row: Row; column: Column; database: Database }) {
	const value = row.props[column.name];
	const [open, setPickerOpen] = useState(false);
	// Its picker asked for from the keyboard (Enter on it); closed, the keys back to the table.
	const asked = database.picking?.slug === row.slug && database.picking.column === column.name;
	useEffect(() => {
		if (!asked) return;
		setPickerOpen(true);
		database.setPicking(null);
	}, [asked]);
	const setOpen = (next: boolean) => {
		setPickerOpen(next);
		if (!next) database.focusTable();
	};
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
					initial={database.editing?.initial}
					done={(next, how) => {
						database.setEditing(null);
						if (next !== null && next.trim() !== shown(value)) set(next.trim() || null);
						afterTyping(database, how);
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

/**
 * The table's keys, as a spreadsheet's (and Notion's): the cells chosen (a click; ⇧ and a click or the arrows, a block
 * of them), ↑↓←→ and Tab to move, Enter (or a key typed) to type in one, a picker opened for a choice or a day, Space a
 * box ticked, ⌫ the chosen emptied, ⌘C them copied as a spreadsheet's cells, ⌘V a spreadsheet's cells put in from the
 * one chosen (rows more than there are made), Esc let go.
 */
function useTableKeys(database: Database, rows: Row[], columns: Column[]) {
	const { cursor, setCursor } = database;
	const names = [TITLE, ...columns.map((column) => column.name)];
	const columnNamed = (name: string) => columns.find((column) => column.name === name) ?? null;
	const place = (spot: Spot) => ({ r: rows.findIndex((row) => row.slug === spot.slug), c: names.indexOf(spot.column) });
	const spotAt = (r: number, c: number): Spot | null => (rows[r] && names[c] ? { slug: rows[r]!.slug, column: names[c]! } : null);
	/** The block chosen, by rows and columns (both ends in); none when what was chosen is gone. */
	const block = () => {
		if (!cursor) return null;
		const [a, b] = [place(cursor.anchor), place(cursor.head)];
		if (a.r < 0 || b.r < 0 || a.c < 0 || b.c < 0) return null;
		return { r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) };
	};
	const chosen = block();
	const reveal = (spot: Spot) =>
		requestAnimationFrame(() =>
			database.table.current?.querySelector(`[data-row="${CSS.escape(spot.slug)}"] > [data-column="${CSS.escape(spot.column)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
		);
	const go = (head: Spot, extend = false) => {
		setCursor({ anchor: extend && cursor ? cursor.anchor : head, head });
		reveal(head);
	};
	/** Typed in, or its picker opened, or (a box) ticked. */
	const begin = (spot: Spot, initial?: string) => {
		const column = columnNamed(spot.column);
		const row = rows.find((each) => each.slug === spot.slug);
		if (!row) return;
		if (!column || column.type === 'text' || column.type === 'number' || column.type === 'url') database.setEditing({ ...spot, ...(initial !== undefined ? { initial } : {}) });
		else if (column.type === 'checkbox') {
			if (initial === undefined || initial === ' ') void database.setValue(row, column, row.props[column.name] !== true);
		} else if (initial === undefined) database.setPicking(spot);
	};
	/** The chosen cells emptied (the titles left: a page has one). */
	const empty = () => {
		if (!chosen) return;
		for (let r = chosen.r0; r <= chosen.r1; r += 1) {
			const entries = names
				.slice(Math.max(1, chosen.c0), chosen.c1 + 1)
				.map(columnNamed)
				.filter((column): column is Column => Boolean(column) && rows[r]!.props[column!.name] !== undefined)
				.map((column) => ({ column, value: null }));
			if (entries.length) void database.setValues(rows[r]!, entries);
		}
	};
	/** A spreadsheet's cells put in from the top left of what is chosen; one value, into every chosen cell. */
	const put = async (grid: string[][]) => {
		if (!chosen || !grid.length) return;
		const one = grid.length === 1 && grid[0]!.length === 1;
		const height = one ? chosen.r1 - chosen.r0 + 1 : grid.length;
		const widthOf = one ? chosen.c1 - chosen.c0 + 1 : Math.max(...grid.map((line) => line.length));
		const made: Array<{ title: string; props: Record<string, unknown> }> = [];
		for (let i = 0; i < height; i += 1) {
			const line = one ? Array.from({ length: widthOf }, () => grid[0]![0]!) : grid[i]!;
			const row = rows[chosen.r0 + i];
			const entries: Array<{ column: Column; value: unknown }> = [];
			let title: string | null = null;
			line.forEach((text, j) => {
				const name = names[chosen.c0 + j];
				if (!name) return;
				if (name === TITLE) title = text.trim();
				else {
					const column = columnNamed(name)!;
					const value = pastedValue(column, text);
					entries.push({ column, value });
					// A choice not among the column's: one of them now.
					for (const option of Array.isArray(value) ? value : column.type === 'select' && value ? [value] : []) database.addOption(column, String(option));
				}
			});
			if (row) {
				if (entries.length) void database.setValues(row, entries);
				if (title !== null && title !== row.title) void database.setTitle(row, title);
			} else made.push({ title: title ?? '', props: Object.fromEntries(entries.filter(({ value }) => value !== null && value !== false).map(({ column, value }) => [column.name, value])) });
		}
		for (const row of made) await database.host.addRow({ ...row, template: database.config.template }).catch((error: unknown) => database.host.toast(error instanceof Error ? error.message : String(error), true));
		if (made.length) await database.load();
		const end = spotAt(Math.min(rows.length + made.length, chosen.r0 + height) - 1, Math.min(names.length, chosen.c0 + widthOf) - 1);
		if (end) setCursor({ anchor: spotAt(chosen.r0, chosen.c0)!, head: end });
	};
	/**
	 * Whether a key is the table's: pressed in it (not in a picker it opened, which React tells it of too), and not while
	 * a cell is typed in (the editor around it, which is typed in too, not counted).
	 */
	const ours = (target: EventTarget) => {
		const table = database.table.current;
		if (!(target instanceof HTMLElement) || !table?.contains(target)) return false;
		const typing = target.closest('input, textarea, [contenteditable="true"]');
		return !typing || !table.contains(typing);
	};

	return {
		/** The marks of a cell: in the block chosen, where the keys are. */
		marks(slug: string, column: string): string | false {
			if (!chosen || !cursor) return false;
			const { r, c } = place({ slug, column });
			const inside = r >= chosen.r0 && r <= chosen.r1 && c >= chosen.c0 && c <= chosen.c1;
			const head = cursor.head.slug === slug && cursor.head.column === column;
			return cn(inside && (chosen.r0 !== chosen.r1 || chosen.c0 !== chosen.c1) && 'is-in-range', head && 'is-cursor');
		},
		/** A press on a cell: chosen (⇧: the block to it), the keys the table's. */
		press: (slug: string, column: string) => (event: ReactMouseEvent) => {
			// A row's box or ⋮⋮ in its margin: the row's, not the cell's.
			if (!ours(event.target) || (event.target as HTMLElement).closest('.db-row-gutter')) return;
			if (event.shiftKey && cursor) {
				event.preventDefault();
				setCursor({ anchor: cursor.anchor, head: { slug, column } });
				database.focusTable();
				return;
			}
			setCursor({ anchor: { slug, column }, head: { slug, column } });
			database.focusTable();
		},
		down(event: KeyboardEvent) {
			if (!ours(event.target) || event.nativeEvent.isComposing) return;
			const mod = event.metaKey || event.ctrlKey;
			if (mod && event.key.toLowerCase() === 'a') {
				const last = spotAt(rows.length - 1, names.length - 1);
				if (!last) return;
				event.preventDefault();
				setCursor({ anchor: spotAt(0, 0)!, head: last });
				return;
			}
			if (mod || event.altKey) return;
			const head = cursor ? place(cursor.head) : null;
			const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
			if (event.key in moves) {
				event.preventDefault();
				if (!head || head.r < 0) return go(spotAt(0, 0) ?? { slug: '', column: TITLE });
				const [dr, dc] = moves[event.key]!;
				const next = spotAt(Math.max(0, Math.min(rows.length - 1, head.r + dr)), Math.max(0, Math.min(names.length - 1, head.c + dc)));
				if (next) go(next, event.shiftKey);
				return;
			}
			if (!head || head.r < 0) return;
			const spot = cursor!.head;
			if (event.key === 'Tab') {
				event.preventDefault();
				const at = head.r * names.length + head.c + (event.shiftKey ? -1 : 1);
				const next = spotAt(Math.floor(at / names.length), ((at % names.length) + names.length) % names.length);
				if (next && at >= 0) go(next);
			} else if (event.key === 'Enter' || event.key === 'F2') {
				event.preventDefault();
				begin(spot);
			} else if (event.key === ' ' && columnNamed(spot.column)?.type === 'checkbox') {
				event.preventDefault();
				begin(spot, ' ');
			} else if (event.key === 'Backspace' || event.key === 'Delete') {
				event.preventDefault();
				empty();
			} else if (event.key === 'Escape') {
				event.preventDefault();
				setCursor(null);
				database.letRowsGo();
			} else if (event.key.length === 1) {
				// A key typed on a cell of words: typed in, beginning with it.
				const column = columnNamed(spot.column);
				if (column && column.type !== 'text' && column.type !== 'number' && column.type !== 'url') return;
				event.preventDefault();
				begin(spot, event.key);
			}
		},
		copy(event: ClipboardEvent) {
			if (!ours(event.target) || !chosen) return;
			const grid = rows.slice(chosen.r0, chosen.r1 + 1).map((row) => names.slice(chosen.c0, chosen.c1 + 1).map((name) => copiedText(row, name === TITLE ? TITLE : columnNamed(name)!)));
			event.clipboardData.setData('text/plain', tableText(grid));
			event.preventDefault();
		},
		paste(event: ClipboardEvent) {
			if (!ours(event.target) || !chosen) return;
			const text = event.clipboardData.getData('text/plain');
			if (!text) return;
			event.preventDefault();
			void put(cellsOf(text));
		},
	};
}

/**
 * What is worked out of a column under the table (its count, sum, earliest day…, as Notion's 计算): shown with its
 * name; none (on hover, 计算 to choose one); clicked, the workings its kind offers.
 */
function Calc({ name, column, rows, database }: { name: string; column: Column | null; rows: Row[]; database: Database }) {
	const [open, setOpen] = useState(false);
	const kind = database.config.calcs[name] ?? (column ? 'none' : 'count');
	const value = calculate(kind, rows, column);
	return (
		<Pop
			open={open}
			onOpenChange={setOpen}
			width={200}
			trigger={
				<button type="button" className={cn('db-calc-button', kind === 'none' && 'is-none', column?.type === 'number' && 'is-number')} data-database-calc={name} {...(name === TITLE && kind === 'count' ? { 'data-database-count': '' } : {})}>
					{kind === 'none' ? (
						<span className="db-calc-hint">
							{t('计算')}
							<ChevronDown aria-hidden />
						</span>
					) : (
						<>
							<span className="db-calc-name">{calcName(kind)}</span>
							<span className="db-calc-value">{value}</span>
						</>
					)}
				</button>
			}
		>
			<div className="db-menu">
				{calcKinds(column ? column.type : 'title').map((each) => (
					<MenuRow
						key={each}
						onClick={() => {
							setOpen(false);
							database.setCalc(name, each);
						}}
						note={each === kind ? <Check aria-hidden /> : null}
						data-database-calc-kind={each}
					>
						{calcName(each)}
					</MenuRow>
				))}
			</div>
		</Pop>
	);
}
