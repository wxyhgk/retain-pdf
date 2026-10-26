import { useEffect, useRef } from 'react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from '@studio/ui/dropdown-menu';
import { contextMenu, type MenuAsk } from '../common/context-menu';
import { useStore } from './store';

/** Closed, if it is still this one (another may have opened meanwhile). */
const closer = (round: number) => () => {
	if (contextMenu.get().ask?.round === round) contextMenu.set({ ask: null });
};

function Menu({ ask }: { ask: MenuAsk }) {
	const close = closer(ask.round);
	const content = useRef<HTMLDivElement>(null);
	const escaped = useRef(false);

	// The keys on its first item, as the menu opens (Radix's on the menu itself).
	useEffect(() => {
		const frame = requestAnimationFrame(() => content.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
		return () => cancelAnimationFrame(frame);
	}, []);

	// A scroll elsewhere, or the window left: it goes.
	useEffect(() => {
		const onScroll = (event: Event) => {
			if (!(event.target instanceof Node && content.current?.contains(event.target))) close();
		};
		window.addEventListener('scroll', onScroll, true);
		window.addEventListener('blur', close);
		return () => {
			window.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('blur', close);
		};
	}, []);

	return (
		// Not modal: a click elsewhere closes it and does what it does there (another row's menu, at once).
		<DropdownMenu open modal={false} onOpenChange={(open) => !open && close()}>
			<DropdownMenuTrigger asChild>
				<span aria-hidden className="pointer-events-none fixed size-0" style={{ left: ask.at.x, top: ask.at.y }} />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				ref={content}
				align="start"
				sideOffset={0}
				collisionPadding={8}
				className="context-menu max-w-[280px] min-w-[190px] text-[13px]"
				// What opened it may put the keys somewhere as it does (a file's row, chosen): not a reason to close.
				onFocusOutside={(event) => event.preventDefault()}
				onEscapeKeyDown={() => {
					escaped.current = true;
				}}
				onCloseAutoFocus={(event) => {
					// Taken (the item may put the keys somewhere) or clicked away: they stay; Escape: back where they were.
					event.preventDefault();
					if (escaped.current) ask.returnFocus?.focus();
				}}
			>
				{ask.items.map((item, at) =>
					item === 'separator' ? (
						<DropdownMenuSeparator key={at} />
					) : (
						<DropdownMenuItem
							key={at}
							variant={item.danger ? 'destructive' : 'default'}
							// Taken by a click only: the right button let go over it, as the menu opens under the pointer, is not one
							// (Radix takes an item a press began elsewhere and let go over).
							onPointerUp={(event) => event.preventDefault()}
							onSelect={() => {
								close();
								item.action();
							}}
						>
							{item.label}
							{item.hint && <DropdownMenuShortcut className="pl-4 tracking-normal">{item.hint}</DropdownMenuShortcut>}
						</DropdownMenuItem>
					),
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** The menu open (common/context-menu.ts opens it), one at a time. */
export function ContextMenu() {
	const { ask } = useStore(contextMenu);
	return ask ? <Menu key={ask.round} ask={ask} /> : null;
}
