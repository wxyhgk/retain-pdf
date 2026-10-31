import { useEffect, useMemo, useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
import type { DatabaseConfig } from './database-config';
import { said } from './database-parts';
import { DatabaseView, type DatabaseHost } from './DatabaseView';

/** What a database block asks the Studio around the editor (database-block.ts). */
export type DatabaseSpace = {
	/** The page the editor shows: its folder, and whether it is a database (its own block then the database itself). */
	page(): { slug: string; database: boolean } | null;
	/** What the view asks about the rows of the database `slug` (read, a value written…). */
	host(slug: string): DatabaseHost;
	/** The database `slug`: its settings, title and icon; null when that page is not one (deleted, never was). */
	info(slug: string): Promise<{ config: DatabaseConfig; title: string; icon: string } | null>;
	saveConfig(slug: string, config: DatabaseConfig): Promise<void>;
	/** Its page's title set. */
	rename(slug: string, title: string): Promise<void>;
	/** A new database under the page shown: its folder. */
	create(): Promise<string>;
	/** A block from before databases were pages (its text), in the page shown, made a database: its folder. */
	detach(text: string): Promise<string>;
	open(slug: string): void;
	toast(message: string, error?: boolean): void;
};

/**
 * A database shown in another page than its own (its block names it: `{"source": "<folder>"}`), as Notion's inline and
 * linked databases: its settings read from its page and written back there, its name and icon above it, its page
 * opened from them. Read again when the window is come back to (changed in its own page, by an AI).
 */
export function LinkedDatabase({ slug, space }: { slug: string; space: DatabaseSpace }) {
	const [info, setInfo] = useState<{ config: DatabaseConfig; title: string; icon: string } | null | undefined>(undefined);
	const host = useMemo(() => space.host(slug), [slug]);
	const load = () => space.info(slug).then(setInfo, () => setInfo(null));
	useEffect(() => {
		let current = true;
		const read = () => space.info(slug).then((found) => current && setInfo(found), () => current && setInfo(null));
		void read();
		const again = () => document.visibilityState === 'visible' && void read();
		window.addEventListener('focus', again);
		return () => {
			current = false;
			window.removeEventListener('focus', again);
		};
	}, [slug]);

	if (info === undefined) {
		return (
			<div className="db">
				<p className="db-note">{t('正在读…')}</p>
			</div>
		);
	}
	if (info === null) {
		return (
			<div className="db">
				<p className="db-note is-error" data-database-missing>
					{t('找不到这个数据库（{slug}）：它的页面可能删掉了，可以从废纸篓找回来', { slug })}
				</p>
			</div>
		);
	}
	const change = (next: DatabaseConfig) => {
		setInfo((before) => (before ? { ...before, config: next } : before));
		void space.saveConfig(slug, next).catch((error: unknown) => {
			space.toast(said(error), true);
			void load();
		});
	};
	const heading = {
		title: info.title,
		icon: info.icon,
		rename: (title: string) => {
			setInfo((before) => (before ? { ...before, title } : before));
			void space.rename(slug, title).catch((error: unknown) => space.toast(said(error), true));
		},
		open: () => space.open(slug),
	};
	return <DatabaseView config={info.config} change={change} host={host} heading={heading} />;
}
