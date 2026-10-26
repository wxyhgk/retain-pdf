import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Class names joined, the later of two Tailwind classes for the same thing kept (shadcn/ui's `cn`). */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
