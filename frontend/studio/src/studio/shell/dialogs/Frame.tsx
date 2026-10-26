import type { ReactNode } from 'react';

import { cn } from '@studio/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@studio/ui/dialog';

/**
 * A dialog of the Studio, open while it is drawn: its title and what it is for above, × and Esc close it (`onClose`).
 * `focus` is what has the keys when it opens (the first field or button, else).
 */
export function Frame({ id, title, description, className, onClose, focus, children }: { id: string; title: ReactNode; description: ReactNode; className?: string; onClose(): void; focus?: () => HTMLElement | null; children: ReactNode }) {
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				id={id}
				className={cn('max-h-[calc(100vh-2rem)] gap-4 p-[22px] sm:max-w-[480px]', className)}
				onOpenAutoFocus={(event) => {
					const element = focus?.();
					if (!element) return;
					event.preventDefault();
					element.focus();
				}}
			>
				<DialogHeader className="gap-1 pr-8 text-left">
					<DialogTitle className="text-[17px] text-accent-foreground">{title}</DialogTitle>
					<DialogDescription className="text-[11px] leading-normal">{description}</DialogDescription>
				</DialogHeader>
				{children}
			</DialogContent>
		</Dialog>
	);
}

/** A dialog's line saying how what was asked went; red when it went wrong. */
export function Status({ id, text, error = false }: { id: string; text: string; error?: boolean }) {
	return (
		<p id={id} className={cn('min-h-4 text-xs text-muted-foreground', error && 'is-error text-destructive')} role="status" aria-live="polite">
			{text}
		</p>
	);
}

/** The buttons at a dialog's foot, on the right. */
export function Actions({ children }: { children: ReactNode }) {
	return <div className="flex justify-end gap-2">{children}</div>;
}

export const errorText = (error: unknown, fallback: string): string => (error instanceof Error ? error.message : fallback);
