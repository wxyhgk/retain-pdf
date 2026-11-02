import { useRef, type ReactNode } from 'react';
import { Command as CommandPrimitive } from 'cmdk';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { Command, CommandItem, CommandList } from '@studio/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@studio/ui/dialog';

/** A line of a finder: an icon, a title, a line under it; what was typed marked in both. */
export type FinderRow = { key: string; icon: string; title: string; snippet?: string; drive?: boolean };

/** `text` with each `needle` in it marked. */
function Marked({ text, needle }: { text: string; needle: string }) {
	const parts: ReactNode[] = [];
	const lower = text.toLocaleLowerCase('zh-CN');
	const wanted = needle.toLocaleLowerCase('zh-CN');
	let at = 0;
	for (let found = lower.indexOf(wanted); wanted && found !== -1; found = lower.indexOf(wanted, at)) {
		parts.push(text.slice(at, found), <mark key={found}>{text.slice(found, found + wanted.length)}</mark>);
		at = found + wanted.length;
	}
	parts.push(text.slice(at));
	return <>{parts}</>;
}

/**
 * A finder over the page, as Notion's search: a field, the lines found under it (↑ ↓ to go through them, ↵ or a click to
 * take one; not ↵ while the input method is putting a word together), a hint at the foot. What is found is the caller's (`rows`, for `query`); Esc or a click outside gives up.
 */
export function Finder({
	id,
	title,
	icon,
	inputId,
	placeholder,
	query,
	onQuery,
	rows,
	selected,
	onSelected,
	onChoose,
	empty,
	hint,
	onClose,
}: {
	id: string;
	title: string;
	icon: string;
	inputId: string;
	placeholder: string;
	query: string;
	onQuery(query: string): void;
	rows: FinderRow[];
	selected: string;
	onSelected(key: string): void;
	onChoose(key: string): void;
	empty: string;
	hint: ReactNode;
	onClose(): void;
}) {
	const input = useRef<HTMLInputElement>(null);
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				id={id}
				showCloseButton={false}
				className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[620px]"
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					input.current?.focus();
				}}
			>
				<DialogTitle className="sr-only">{title}</DialogTitle>
				<DialogDescription className="sr-only">{placeholder}</DialogDescription>
				<Command shouldFilter={false} loop value={selected} onValueChange={onSelected} className="rounded-none">
					<label className="flex items-center gap-2.5 border-b px-4">
						<span aria-hidden className="text-lg text-muted-foreground">
							{icon}
						</span>
						{/* Not cmdk's own field, which takes its own id: the arrows and ↵ reach the list all the same. */}
						<input
							ref={input}
							id={inputId}
							type="text"
							autoComplete="off"
							spellCheck={false}
							role="combobox"
							aria-expanded
							aria-controls={`${id}-results`}
							className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
							placeholder={placeholder}
							value={query}
							onChange={(event) => onQuery(event.target.value)}
						/>
					</label>
					<CommandList id={`${id}-results`} className="max-h-[min(56vh,440px)] p-1.5">
						{rows.map((row) => (
							<CommandItem key={row.key} value={row.key} className="quick-find-item items-start gap-2.5 rounded-md px-2.5 py-2" onSelect={() => onChoose(row.key)}>
								<span className={cn('quick-find-icon w-5 flex-none text-center text-muted-foreground', row.drive && 'is-drive')} title={row.drive ? t('资料库') : undefined}>
									{row.icon || '▤'}
								</span>
								<span className="grid min-w-0 gap-0.5 [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-accent-foreground">
									<span className="quick-find-title truncate text-sm">
										<Marked text={row.title} needle={query.trim()} />
									</span>
									{row.snippet && (
										<span className="quick-find-snippet truncate text-xs text-muted-foreground">
											<Marked text={row.snippet} needle={query.trim()} />
										</span>
									)}
								</span>
							</CommandItem>
						))}
						{!rows.length && <CommandPrimitive.Empty className="quick-find-empty px-2.5 py-[18px] text-center text-[13px] text-muted-foreground">{empty}</CommandPrimitive.Empty>}
					</CommandList>
				</Command>
				<p className="border-t px-4 py-2 text-xs text-muted-foreground [&_kbd]:mr-0.5 [&_kbd]:rounded-sm [&_kbd]:border [&_kbd]:px-1 [&_kbd]:font-sans">{hint}</p>
			</DialogContent>
		</Dialog>
	);
}
