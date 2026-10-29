import { Fragment, useEffect, useState } from 'react';
import { Check } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { coerceValue, shown, type Column, type DatabaseConfig } from '../../editor/database/database-config';
import { OptionPicker, Pill, Pop, TYPE_ICONS } from '../../editor/database/database-parts';
import '../../editor/database/database.css';

/**
 * A database row's own page, as Notion's: under its title, the database's columns (those not hidden), each its value
 * here, changed where it is; written into the page's `props:` as its other properties are (saved with it).
 */
export function RowProperties({ config, props, disabled, edit, addOption }: { config: DatabaseConfig; props: Record<string, unknown>; disabled: boolean; edit(next: Record<string, unknown>): void; addOption(column: Column, option: string): void }) {
	const set = (column: Column, value: unknown) => {
		const kept = coerceValue(column.type, value);
		const next = { ...props };
		if (kept === null || kept === false) delete next[column.name];
		else next[column.name] = kept;
		edit(next);
	};
	return (
		<div className="db db-row-props" data-database-properties>
			{config.columns
				.filter((column) => !column.hidden)
				.map((column) => {
					const Icon = TYPE_ICONS[column.type];
					return (
						<Fragment key={column.name}>
							<span className="property-name" data-row-property={column.name}>
								<Icon aria-hidden />
								{column.name}
							</span>
							<RowValue column={column} value={props[column.name]} disabled={disabled} set={(value) => set(column, value)} addOption={(option) => addOption(column, option)} />
						</Fragment>
					);
				})}
		</div>
	);
}

function RowValue({ column, value, disabled, set, addOption }: { column: Column; value: unknown; disabled: boolean; set(value: unknown): void; addOption(option: string): void }) {
	const [open, setOpen] = useState(false);
	if (column.type === 'checkbox') {
		return (
			<div className="property-value" data-row-value={column.name}>
				<button type="button" role="checkbox" aria-checked={value === true} aria-label={column.name} disabled={disabled} className={cn('db-check', value === true && 'is-checked')} onClick={() => set(value !== true)}>
					{value === true && <Check aria-hidden />}
				</button>
			</div>
		);
	}
	if (column.type === 'date') {
		return <input type="date" className="property-value" data-row-value={column.name} aria-label={column.name} disabled={disabled} value={typeof value === 'string' ? value : ''} onChange={(event) => set(event.target.value)} />;
	}
	if (column.type === 'select' || column.type === 'multi') {
		const chosen = Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : [];
		return (
			<Pop
				open={open}
				onOpenChange={setOpen}
				width={300}
				offset={-30}
				trigger={
					<button type="button" className="property-value db-row-pills" data-row-value={column.name} disabled={disabled}>
						{chosen.length ? chosen.map((option) => <Pill key={option}>{option}</Pill>) : <span className="db-faint">{t('空')}</span>}
					</button>
				}
			>
				<OptionPicker
					column={column}
					chosen={chosen}
					set={(next) => {
						set(column.type === 'multi' ? next : (next[0] ?? null));
						if (column.type === 'select') setOpen(false);
					}}
					addOption={addOption}
				/>
			</Pop>
		);
	}
	return <TextValue column={column} value={shown(value)} disabled={disabled} set={set} />;
}

/** Words, a number, an address: typed, kept on ↩ or leaving. */
function TextValue({ column, value, disabled, set }: { column: Column; value: string; disabled: boolean; set(value: unknown): void }) {
	const [typed, setTyped] = useState(value);
	useEffect(() => setTyped(value), [value]);
	return (
		<input
			className={cn('property-value', column.type === 'number' && 'is-number')}
			data-row-value={column.name}
			aria-label={column.name}
			inputMode={column.type === 'number' ? 'decimal' : undefined}
			placeholder={t('空')}
			disabled={disabled}
			value={typed}
			onChange={(event) => setTyped(event.target.value)}
			onBlur={() => typed !== value && set(typed.trim())}
			onKeyDown={(event) => {
				if (event.nativeEvent.isComposing) return;
				if (event.key === 'Enter') event.currentTarget.blur();
				else if (event.key === 'Escape') {
					setTyped(value);
					event.currentTarget.blur();
				}
			}}
		/>
	);
}
