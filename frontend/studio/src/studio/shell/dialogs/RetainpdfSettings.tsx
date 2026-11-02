import { useEffect, useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { Button } from '@studio/ui/button';
import { Input } from '@studio/ui/input';
import { checkRetainpdf, retainpdfSettings, saveRetainpdf, type RetainpdfShown } from '../../api/client';
import { Field } from './AiSettings';
import { Actions, errorText, Status } from './Frame';

/**
 * 设置 › RetainPDF: where its pages are, for 翻译 in the left column; empty is the default (its desktop app's). Its API,
 * for the AIs and 书 to read the books (server/retainpdf-library.mjs): nothing to fill in, its address and key are
 * found from its pages (server/retainpdf-settings.mjs); written here, these are used instead. A key is kept by the
 * Studio's server and never shown back.
 */
export function RetainpdfSettings() {
	const [shown, setShown] = useState<RetainpdfShown | null>(null);
	const [url, setUrl] = useState('');
	const [apiUrl, setApiUrl] = useState('');
	const [key, setKey] = useState('');
	const [status, setStatus] = useState({ text: '', error: false });
	const take = (settings: RetainpdfShown) => {
		setShown(settings);
		setUrl(settings.isDefault ? '' : settings.url);
		setApiUrl(settings.apiUrl);
		setKey('');
	};
	useEffect(() => {
		retainpdfSettings().then(take, (error: unknown) => setStatus({ text: errorText(error, t('读不到 RetainPDF 的地址')), error: true }));
	}, []);
	if (!shown) return <Status id="retainpdf-status" {...status} />;
	const save = (api: { apiUrl?: string; apiKey?: string }, said: string) => {
		setStatus({ text: t('正在保存…'), error: false });
		saveRetainpdf(url, api).then(
			(settings) => {
				take(settings);
				setStatus({ text: said, error: false });
			},
			(error: unknown) => setStatus({ text: errorText(error, t('没能保存')), error: true }),
		);
	};
	// What is written saved first: it is that which is tried.
	const check = () => {
		setStatus({ text: t('正在连 RetainPDF…'), error: false });
		saveRetainpdf(url, { apiUrl, ...(key.trim() ? { apiKey: key } : {}) })
			.then((settings) => {
				take(settings);
				return checkRetainpdf();
			})
			.then(
			({ books }) => setStatus({ text: t('连上了：书库里有 {count} 本书，AI 能读到', { count: books }), error: false }),
			(error: unknown) => setStatus({ text: errorText(error, t('连不上 RetainPDF')), error: true }),
		);
	};
	return (
		<form
			className="grid gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				save({ apiUrl, ...(key.trim() ? { apiKey: key } : {}) }, t('已保存，下次打开「书库」时用这个地址'));
			}}
		>
			<Field label={t('地址')}>
				<Input id="retainpdf-url" autoComplete="off" spellCheck={false} value={url} placeholder={shown.default} onChange={(event) => setUrl(event.target.value)} />
			</Field>
			<small className="-mt-2 text-xs leading-normal text-muted-foreground">{t('空着就是 RetainPDF 桌面版和开发环境的默认地址。')}</small>
			<Field label={t('接口地址')}>
				<Input id="retainpdf-api-url" autoComplete="off" spellCheck={false} value={apiUrl} placeholder={shown.found.api ?? shown.url} onChange={(event) => setApiUrl(event.target.value)} />
			</Field>
			<Field label={t('API 密钥')}>
				<Input
					id="retainpdf-api-key"
					type="password"
					autoComplete="off"
					value={key}
					placeholder={shown.keySet ? t('已保存（不改就空着）') : shown.found.key ? t('用 RetainPDF 自己的（不用填）') : t('RetainPDF 的 X-API-Key')}
					onChange={(event) => setKey(event.target.value)}
				/>
			</Field>
			<small id="retainpdf-found" className="-mt-2 text-xs leading-normal text-muted-foreground">
				{shown.found.api || shown.found.key
					? t('不用填：接口地址和密钥是从 RetainPDF 自己的页面找到的（{api}），和「书库」里的阅读页用的一样。填了就用填的。', { api: shown.found.api ?? shown.url })
					: t('不用填：RetainPDF 开着时，接口地址和密钥从它自己的页面找到。现在没找到（它开着吗？上面的地址对吗？）；也可以自己填。')}
			</small>
			<Status id="retainpdf-status" {...status} />
			<Actions>
				{shown.keySet ? (
					<Button type="button" size="sm" variant="ghost" id="retainpdf-forget-key" onClick={() => save({ apiKey: '' }, t('已删掉密钥'))}>
						{t('删掉密钥')}
					</Button>
				) : null}
				<Button type="button" size="sm" variant="outline" id="retainpdf-check" onClick={check}>
					{t('测试连接')}
				</Button>
				<Button type="submit" size="sm">
					{t('保存')}
				</Button>
			</Actions>
		</form>
	);
}
