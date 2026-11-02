import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Calendar, ChevronLeft, ChevronRight, CircleChevronDown, Ellipsis, GripVertical, Hash, Link as LinkIcon, SquareCheck, Tags, Trash2, Type, X, type LucideIcon } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@studio/ui/popover';
import { COLUMN_TYPES, shownDate, type Column, type ColumnType } from './database-config';

/** The pieces the database's table and board are made of: a choice's chip, a menu's rows, the pickers (choices, a day), a cell's field. */

export const TYPE_ICONS: Record<ColumnType | 'title', LucideIcon> = {
	title: Type,
	text: Type,
	number: Hash,
	select: CircleChevronDown,
	multi: Tags,
	date: Calendar,
	checkbox: SquareCheck,
	url: LinkIcon,
};

export function typeName(type: ColumnType): string {
	return {
		text: t('文字'),
		number: t('数字'),
		select: t('单选'),
		multi: t('多选'),
		date: t('日期'),
		checkbox: t('勾选'),
		url: t('网址'),
	}[type];
}

/** A menu or popover closed: the keys not taken back to what opened it (a cell, a row's title, may have them by then). */
export const keepFocus = (event: Event) => event.preventDefault();

export const said = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A choice, as Notion's (gray, the Studio's one colour). */
export function Pill({ children, onRemove }: { children: ReactNode; onRemove?(): void }) {
	return (
		<span className="db-pill">
			<span className="db-pill-text">{children}</span>
			{onRemove && (
				<button type="button" className="db-pill-x" aria-label={t('去掉')} onClick={onRemove}>
					<X aria-hidden />
				</button>
			)}
		</span>
	);
}

/** A popover of the database's (its look: database.css `.db-pop`). */
export function Pop({
	trigger,
	children,
	open,
	onOpenChange,
	align = 'start',
	width,
	className,
	side,
	offset = 4,
}: {
	trigger: ReactNode;
	children: ReactNode;
	open?: boolean;
	onOpenChange?(open: boolean): void;
	align?: 'start' | 'center' | 'end';
	width?: number;
	className?: string;
	side?: 'bottom' | 'top' | 'right' | 'left';
	offset?: number;
}) {
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent align={align} side={side} sideOffset={offset} onCloseAutoFocus={keepFocus} className={cn('db-pop', className)} style={width ? { width } : undefined}>
				{children}
			</PopoverContent>
		</Popover>
	);
}

/** A menu's row: an icon, what it does, a note at the end (what is chosen now). */
export function MenuRow({
	icon: Icon,
	children,
	note,
	onClick,
	danger,
	active,
	...rest
}: {
	icon?: LucideIcon;
	children: ReactNode;
	note?: ReactNode;
	onClick?(): void;
	danger?: boolean;
	active?: boolean;
} & Record<`data-${string}`, string | boolean | undefined>) {
	return (
		<button type="button" className={cn('db-menu-row', danger && 'is-danger', active && 'is-active')} onClick={onClick} {...rest}>
			{Icon ? <Icon aria-hidden className="db-menu-icon" /> : <span className="db-menu-icon" />}
			<span className="db-menu-label">{children}</span>
			{note !== undefined && <span className="db-menu-note">{note}</span>}
		</button>
	);
}

export const MenuLine = () => <div className="db-menu-line" />;

/** The kinds a column can be, to pick one (a column added, its kind changed); those typed for, only. */
export function TypeList({ pick, chosen }: { pick(type: ColumnType): void; chosen?: ColumnType }) {
	const [query, setQuery] = useState('');
	const shownTypes = COLUMN_TYPES.filter((type) => !query.trim() || typeName(type).includes(query.trim()) || type.includes(query.trim().toLowerCase()));
	return (
		<div className="db-menu">
			<input
				className="db-field"
				autoFocus
				placeholder={t('找一种属性')}
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				onKeyDown={(event) => event.key === 'Enter' && shownTypes[0] && pick(shownTypes[0])}
				data-database-type-search
			/>
			<div className="db-menu-caption">{t('属性类型')}</div>
			{shownTypes.map((type) => (
				<MenuRow key={type} icon={TYPE_ICONS[type]} onClick={() => pick(type)} active={type === chosen} data-database-column-type={type}>
					{typeName(type)}
				</MenuRow>
			))}
		</div>
	);
}

/** A field over a cell (words, a number, an address), as wide as the cell or wider: ↩ or leaving keeps it, Esc gives it up. */
/**
 * A cell's text being typed: Enter keeps it (⇧Enter a new line), Esc lets it go, Tab keeps it and goes on (`how`).
 * `initial`: what it starts with instead of its value (a key typed on the cell chosen, as in a spreadsheet).
 */
export function CellField({ value, numeric, initial, done }: { value: string; numeric?: boolean; initial?: string; done(value: string | null, how?: 'enter' | 'tab' | 'back-tab' | 'escape' | 'blur'): void }) {
	const field = useRef<HTMLTextAreaElement>(null);
	const finished = useRef(false);
	const finish = (next: string | null, how: 'enter' | 'tab' | 'back-tab' | 'escape' | 'blur') => {
		if (finished.current) return;
		finished.current = true;
		done(next, how);
	};
	const fit = () => {
		const area = field.current;
		if (!area) return;
		area.style.height = '0px';
		area.style.height = `${area.scrollHeight}px`;
	};
	useEffect(() => {
		const area = field.current;
		if (!area) return;
		area.focus();
		area.setSelectionRange(area.value.length, area.value.length);
		fit();
	}, []);
	return (
		<textarea
			ref={field}
			data-database-input
			rows={1}
			inputMode={numeric ? 'decimal' : undefined}
			className={cn('db-cell-field', numeric && 'is-number')}
			defaultValue={initial ?? value}
			onInput={fit}
			onBlur={(event) => finish(event.target.value, 'blur')}
			onKeyDown={(event) => {
				if (event.nativeEvent.isComposing) return;
				if (event.key === 'Enter' && !event.shiftKey) {
					event.preventDefault();
					finish(event.currentTarget.value, 'enter');
				} else if (event.key === 'Tab') {
					event.preventDefault();
					finish(event.currentTarget.value, event.shiftKey ? 'back-tab' : 'tab');
				} else if (event.key === 'Escape') {
					event.preventDefault();
					finish(null, 'escape');
				}
			}}
		/>
	);
}

/**
 * Choosing (单选, 多选), as Notion's: those chosen at the top (× takes one away), a field to type in; below, the
 * choices there are (typed for, only), and「新建」the one typed when it is not among them. Each choice's ⋯: renamed,
 * taken away (from the column, and the rows that have it).
 */
export function OptionPicker({
	column,
	chosen,
	set,
	addOption,
	renameOption,
	removeOption,
}: {
	column: Column;
	chosen: string[];
	set(next: string[]): void;
	addOption(option: string): void;
	/** Where the choices may be changed (the table, not a row's page): their ⋯. */
	renameOption?(from: string, to: string): void;
	removeOption?(option: string): void;
}) {
	const [typed, setTyped] = useState('');
	const [at, setAt] = useState(0);
	const many = column.type === 'multi';
	const options = column.options ?? [];
	const query = typed.trim();
	const matching = options.filter((option) => !query || option.toLocaleLowerCase('zh-CN').includes(query.toLocaleLowerCase('zh-CN')));
	const creating = query && !options.includes(query);
	const choices = [...matching, ...(creating ? [query] : [])];
	useEffect(() => setAt(0), [typed]);
	const pick = (option: string) => {
		if (!options.includes(option)) addOption(option);
		if (many) set(chosen.includes(option) ? chosen.filter((each) => each !== option) : [...chosen, option]);
		else set(chosen[0] === option ? [] : [option]);
		setTyped('');
	};
	return (
		<div className="db-options">
			<div className="db-options-top">
				{chosen.map((option) => (
					<Pill key={option} onRemove={() => set(chosen.filter((each) => each !== option))}>
						{option}
					</Pill>
				))}
				<input
					data-database-new-option
					autoFocus
					className="db-options-input"
					placeholder={chosen.length ? '' : t('选一个，或写一个新的')}
					value={typed}
					onChange={(event) => setTyped(event.target.value)}
					onKeyDown={(event) => {
						if (event.nativeEvent.isComposing) return;
						if (event.key === 'ArrowDown') {
							event.preventDefault();
							setAt((now) => Math.min(now + 1, choices.length - 1));
						} else if (event.key === 'ArrowUp') {
							event.preventDefault();
							setAt((now) => Math.max(now - 1, 0));
						} else if (event.key === 'Enter') {
							event.preventDefault();
							const option = choices[at];
							if (option) pick(option);
						} else if (event.key === 'Backspace' && !typed && chosen.length) {
							set(chosen.slice(0, -1));
						}
					}}
				/>
			</div>
			<div className="db-menu">
				<div className="db-menu-caption">{options.length ? (many ? t('选几个，或新建一个') : t('选一个，或新建一个')) : t('写一个，按 ↩ 新建')}</div>
				{matching.map((option, index) => (
					<div key={option} className={cn('db-option-row', index === at && 'is-at')} onMouseEnter={() => setAt(index)}>
						<button type="button" className="db-option-pick" data-database-option={option} onClick={() => pick(option)}>
							<GripVertical aria-hidden className="db-option-grip" />
							<Pill>{option}</Pill>
						</button>
						{renameOption && removeOption && <OptionMenu option={option} rename={(to) => renameOption(option, to)} remove={() => removeOption(option)} taken={options} />}
					</div>
				))}
				{creating && (
					<button
						type="button"
						className={cn('db-option-row db-option-create', at === matching.length && 'is-at')}
						onMouseEnter={() => setAt(matching.length)}
						onClick={() => pick(query)}
						data-database-create-option
					>
						<span className="db-menu-note">{t('新建')}</span>
						<Pill>{query}</Pill>
					</button>
				)}
			</div>
		</div>
	);
}

function OptionMenu({ option, rename, remove, taken }: { option: string; rename(to: string): void; remove(): void; taken: string[] }) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState(option);
	const commit = () => {
		const to = name.trim();
		if (to && to !== option && !taken.includes(to)) rename(to);
		else setName(option);
	};
	return (
		<Pop
			open={open}
			onOpenChange={(next) => {
				if (!next) commit();
				setOpen(next);
			}}
			side="right"
			width={200}
			trigger={
				<button type="button" className="db-icon-button db-option-more" aria-label={t('这个选项…')}>
					<Ellipsis aria-hidden />
				</button>
			}
		>
			<div className="db-menu">
				<input
					className="db-field"
					value={name}
					autoFocus
					onChange={(event) => setName(event.target.value)}
					onKeyDown={(event) => {
						if (event.nativeEvent.isComposing || event.key !== 'Enter') return;
						commit();
						setOpen(false);
					}}
					data-database-option-name
				/>
				<MenuRow
					icon={Trash2}
					danger
					onClick={() => {
						setOpen(false);
						remove();
					}}
				>
					{t('删除这个选项')}
				</MenuRow>
			</div>
		</Pop>
	);
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const weekdays = () => [t('一'), t('二'), t('三'), t('四'), t('五'), t('六'), t('日')];

/** A day picked: typed (2026-10-20), or on a month's calendar (Monday first); 清除 leaves none. */
export function DatePicker({ value, set }: { value: string; set(next: string | null): void }) {
	const today = dayOf(new Date());
	const initial = /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : today;
	const [month, setMonth] = useState(() => new Date(Number(initial.slice(0, 4)), Number(initial.slice(5, 7)) - 1, 1));
	const [typed, setTyped] = useState(value);
	const days = useMemo(() => {
		const first = new Date(month.getFullYear(), month.getMonth(), 1);
		const start = new Date(first);
		start.setDate(1 - ((first.getDay() + 6) % 7));
		return Array.from({ length: 42 }, (_, index) => {
			const day = new Date(start);
			day.setDate(start.getDate() + index);
			return day;
		});
	}, [month]);
	const move = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
	return (
		<div className="db-date">
			<input
				className="db-field"
				data-database-date-input
				placeholder="2026-10-20"
				value={typed}
				onChange={(event) => setTyped(event.target.value)}
				onKeyDown={(event) => {
					if (event.key !== 'Enter') return;
					const text = typed.trim();
					if (!text) set(null);
					else if (/^\d{4}-\d{2}-\d{2}$/u.test(text)) set(text);
				}}
			/>
			<div className="db-date-head">
				<span className="db-date-month">
					{t('{year}年{month}月', {
						year: month.getFullYear(),
						month: month.getMonth() + 1,
					})}
				</span>
				<button type="button" className="db-icon-button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
					{t('今天')}
				</button>
				<button type="button" className="db-icon-button" aria-label={t('上个月')} onClick={() => move(-1)}>
					<ChevronLeft aria-hidden />
				</button>
				<button type="button" className="db-icon-button" aria-label={t('下个月')} onClick={() => move(1)}>
					<ChevronRight aria-hidden />
				</button>
			</div>
			<div className="db-date-grid">
				{weekdays().map((day) => (
					<span key={day} className="db-date-weekday">
						{day}
					</span>
				))}
				{days.map((day) => {
					const key = dayOf(day);
					return (
						<button
							key={key}
							type="button"
							data-day={key}
							className={cn('db-date-day', day.getMonth() !== month.getMonth() && 'is-other', key === today && 'is-today', key === value && 'is-chosen')}
							onClick={() => set(key)}
						>
							{day.getDate()}
						</button>
					);
				})}
			</div>
			<MenuLine />
			<MenuRow icon={X} onClick={() => set(null)}>
				{t('清除')}
			</MenuRow>
		</div>
	);
}

/** A day as a cell shows it. */
export const DateText = ({ value }: { value: unknown }) => <span className="db-date-text">{shownDate(value)}</span>;
