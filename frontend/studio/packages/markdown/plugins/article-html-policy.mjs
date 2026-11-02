/** Tags that must not run or pull outside resources into an article. */
export const droppedHtmlTags = new Set([
	'script',
	'object',
	'embed',
	'base',
	'meta',
	'link',
	'frame',
	'frameset',
]);

const urlProperties = new Set(['href', 'src', 'action', 'poster', 'data']);

export function isUnsafeUrl(value) {
	const text = String(value ?? '').trim();
	return /^javascript:/i.test(text) || /^vbscript:/i.test(text);
}

export function propertyText(value) {
	if (Array.isArray(value)) return value.map((item) => String(item)).join(' ');
	if (value == null) return '';
	return String(value);
}

/** Drop executable tags, event handlers, and javascript: URLs from a hast element. */
export function sanitizeHastElement(element) {
	if (!element || element.type !== 'element') return element;
	const properties = element.properties ?? {};
	for (const key of Object.keys(properties)) {
		if (/^on/i.test(key) || key === 'srcDoc') {
			delete properties[key];
			continue;
		}
		if (urlProperties.has(key) && isUnsafeUrl(propertyText(properties[key]))) delete properties[key];
	}
	element.properties = properties;
	if (!Array.isArray(element.children)) return element;
	element.children = element.children.filter((child) => {
		if (child?.type === 'element' && droppedHtmlTags.has(child.tagName)) return false;
		if (child?.type === 'element') sanitizeHastElement(child);
		return true;
	});
	return element;
}
