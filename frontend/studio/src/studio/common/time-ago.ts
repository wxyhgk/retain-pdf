import { locale, t } from '@blog/i18n/index.mjs';

/** How long ago, in words: 刚刚, 3 分钟前, 昨天… */
export function timeAgo(time: number, now = Date.now()): string {
	const seconds = Math.round((time - now) / 1000);
	if (seconds > -45) return t('刚刚');
	const relative = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
	const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [['minute', 60], ['hour', 3600], ['day', 86400]];
	for (let at = steps.length - 1; at >= 0; at -= 1) {
		const [unit, size] = steps[at];
		if (Math.abs(seconds) >= size || unit === 'minute') return relative.format(Math.round(seconds / size), unit);
	}
	return t('刚刚');
}
