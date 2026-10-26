import type { KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { X } from 'lucide-react';

import { Button } from '@studio/ui/button';
import { useActions, useShell } from './shell-state';

/** The right column's tabs (side-panel.ts says which there are and which is shown; it shows their panes), and ×. */
export function SideTabs() {
	const { tabs, tab: shown } = useShell();
	const act = useActions();

	/** ← and → go through the tabs, round. */
	function step(event: KeyboardEvent, at: number): void {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const next = tabs[(at + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
		if (!next) return;
		flushSync(() => act.chooseTab(next.key));
		document.getElementById(next.id)?.focus();
	}

	return (
		<>
			{tabs.map((entry, at) => (
				<button
					key={entry.key}
					id={entry.id}
					role="tab"
					type="button"
					aria-controls={entry.controls}
					aria-selected={entry.key === shown}
					tabIndex={entry.key === shown ? 0 : -1}
					data-panel={entry.id.startsWith('side-tab-plugin-') ? entry.key : undefined}
					className="relative h-[34px] rounded-t-md px-3 text-xs whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-selected:font-semibold aria-selected:text-accent-foreground aria-selected:after:absolute aria-selected:after:inset-x-2.5 aria-selected:after:-bottom-px aria-selected:after:h-0.5 aria-selected:after:rounded-full aria-selected:after:bg-primary"
					onClick={() => act.chooseTab(entry.key)}
					onKeyDown={(event) => step(event, at)}
				>
					{entry.label}
				</button>
			))}
			<Button id="close-side-panel" type="button" variant="ghost" size="icon-sm" className="ml-auto size-[27px] self-center text-muted-foreground hover:text-foreground" aria-label="收起右侧面板" onClick={act.closePanel}>
				<X aria-hidden className="size-4" />
			</Button>
		</>
	);
}
