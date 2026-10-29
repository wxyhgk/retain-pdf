import { useState, type DragEvent } from 'react';
import { Check, FileText, Plus } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { boardLists, freeColumnName, shown, shownDate, type Column, type Row } from './database-config';
import { Pill } from './database-parts';
import { ROW_DRAG } from './DatabaseTable';
import type { Database } from './DatabaseView';

/**
 * The board, as Notion's: a list for each choice of the column it is by (those with none first), each its choice's
 * chip and how many; the rows as cards (their title, their other values); a card dragged to another list takes its
 * choice, among the cards of a list it goes where it is dropped; + 新建 in a list, a row of its choice; + 新分组, a
 * choice more.
 */
export function DatabaseBoard({ database, rows }: { database: Database; rows: Row[] }) {
	const { config } = database;
	const column = config.columns.find((each) => each.name === config.group);
	const [over, setOver] = useState<{
		list: string;
		card: string | null;
		after: boolean;
	} | null>(null);
	if (!column) return <NoGroup database={database} />;
	// The rows with none: a list only when there are some.
	const lists = boardLists(rows, config).filter((list) => list.value !== null || list.rows.length > 0);
	const label = (value: string | null) => (value === null ? t('没有{column}', { column: column.name }) : column.type === 'checkbox' ? (value === 'true' ? t('已勾选') : t('未勾选')) : value);
	const valueOf = (list: string | null) => (column.type === 'checkbox' ? list === 'true' : list);
	const others = config.columns.filter((each) => each.name !== column.name && !each.hidden);

	const dropped = (list: string | null) => (event: DragEvent) => {
		const slug = event.dataTransfer.getData(ROW_DRAG);
		const at = over;
		setOver(null);
		const row = rows.find((each) => each.slug === slug);
		if (!row) return;
		event.preventDefault();
		const had = column.type === 'checkbox' ? String(row.props[column.name] === true) : shown(row.props[column.name]) || null;
		const place = at?.card && at.card !== slug && !config.sorts.length ? (at.after ? { after: at.card } : { before: at.card }) : null;
		// One after the other: both are written into the row's page.
		void (async () => {
			if (had !== list) await database.setValue(row, column, valueOf(list));
			if (place) await database.moveRow(slug, place);
		})();
	};

	return (
		<div className="db-board">
			{lists.map((list) => {
				const key = list.value ?? '';
				return (
					<section
						key={key}
						data-board-list={key}
						className={cn('db-lane', over?.list === key && 'is-over')}
						onDragOver={(event) => {
							if (!event.dataTransfer.types.includes(ROW_DRAG)) return;
							event.preventDefault();
							const card = (event.target as Element).closest?.('[data-board-card]') as HTMLElement | null;
							const box = card?.getBoundingClientRect();
							const next = {
								list: key,
								card: card?.dataset.boardCard ?? null,
								after: box ? event.clientY > box.top + box.height / 2 : false,
							};
							if (over?.list !== next.list || over.card !== next.card || over.after !== next.after) setOver(next);
						}}
						onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node) && setOver((now) => (now?.list === key ? null : now))}
						onDrop={dropped(list.value)}
					>
						<header className="db-lane-head">
							{list.value === null ? <span className="db-lane-none">{label(null)}</span> : <Pill>{label(list.value)}</Pill>}
							<span className="db-lane-count">{list.rows.length}</span>
							<span className="db-grow" />
							<button type="button" className="db-icon-button" aria-label={t('在这一组新建')} onClick={() => void database.addRow(list.value === null ? {} : { [column.name]: valueOf(list.value) })}>
								<Plus aria-hidden />
							</button>
						</header>
						{list.rows.map((row) => (
							<article
								key={row.slug}
								draggable
								data-board-card={row.slug}
								className={cn('db-card', over?.card === row.slug && (over.after ? 'is-drop-after' : 'is-drop-before'))}
								onDragStart={(event) => {
									event.dataTransfer.setData(ROW_DRAG, row.slug);
									event.dataTransfer.effectAllowed = 'move';
								}}
								onClick={() => database.host.open(row.slug)}
							>
								<div className="db-card-title">
									<span className="db-row-icon" aria-hidden>
										{row.icon || <FileText />}
									</span>
									<span>{row.title || <span className="db-faint">{t('无标题')}</span>}</span>
								</div>
								{others.map((each) => (
									<CardValue key={each.name} column={each} value={row.props[each.name]} />
								))}
							</article>
						))}
						<button type="button" className="db-lane-new" onClick={() => void database.addRow(list.value === null ? {} : { [column.name]: valueOf(list.value) })}>
							<Plus aria-hidden />
							{t('新建')}
						</button>
					</section>
				);
			})}
			{column.type === 'select' && <NewGroup column={column} database={database} />}
		</div>
	);
}

/** A value on a card: a choice its chip, a box its name ticked, a day as shown; nothing, nothing. */
function CardValue({ column, value }: { column: Column; value: unknown }) {
	if (value === undefined || value === null || value === '' || value === false || (Array.isArray(value) && !value.length)) return null;
	if (column.type === 'select' || column.type === 'multi') {
		return (
			<div className="db-card-pills">
				{(Array.isArray(value) ? value : [value]).map((option) => (
					<Pill key={String(option)}>{String(option)}</Pill>
				))}
			</div>
		);
	}
	if (column.type === 'checkbox') {
		return (
			<div className="db-card-line">
				<Check aria-hidden className="db-card-check" />
				{column.name}
			</div>
		);
	}
	return <div className={cn('db-card-line', column.type === 'number' && 'is-number')}>{column.type === 'date' ? shownDate(value) : shown(value)}</div>;
}

/** + 新分组 after the last list: a choice more of the column the board is by. */
function NewGroup({ column, database }: { column: Column; database: Database }) {
	const [typing, setTyping] = useState(false);
	const [name, setName] = useState('');
	if (!typing) {
		return (
			<button type="button" className="db-lane-add" onClick={() => setTyping(true)} data-database-new-group>
				<Plus aria-hidden />
				{t('新分组')}
			</button>
		);
	}
	const commit = () => {
		if (name.trim()) database.addOption(column, name.trim());
		setName('');
		setTyping(false);
	};
	return (
		<div className="db-lane-add">
			<input
				autoFocus
				className="db-field"
				placeholder={t('分组的名字')}
				value={name}
				onChange={(event) => setName(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.nativeEvent.isComposing) return;
					if (event.key === 'Enter') commit();
					else if (event.key === 'Escape') setTyping(false);
				}}
			/>
		</div>
	);
}

/** A board by nothing yet: by a column there is, or a 状态 made for it (未开始, 进行中, 完成). */
function NoGroup({ database }: { database: Database }) {
	const { config, change } = database;
	const groups = config.columns.filter((column) => column.type === 'select' || column.type === 'checkbox');
	return (
		<div className="db-empty">
			<p>{t('看板按一个单选或勾选属性分组，每个选项一列。')}</p>
			<div className="db-empty-actions">
				{groups.map((column) => (
					<button key={column.name} type="button" className="db-chip" onClick={() => change({ ...config, group: column.name })}>
						{t('按「{column}」分组', { column: column.name })}
					</button>
				))}
				{groups.length === 0 && (
					<button
						type="button"
						className="db-chip is-on"
						data-database-make-status
						onClick={() => {
							const name = freeColumnName(config, t('状态'));
							change({
								...config,
								group: name,
								columns: [
									...config.columns,
									{
										name,
										type: 'select',
										options: [t('未开始'), t('进行中'), t('完成')],
									},
								],
							});
						}}
					>
						{t('加一个「状态」属性来分组')}
					</button>
				)}
			</div>
		</div>
	);
}
