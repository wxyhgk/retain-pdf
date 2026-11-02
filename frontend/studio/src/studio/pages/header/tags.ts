/** Tags as typed, split at commas, half- or full-width. */
export function parseTags(text: string): string[] {
	return text.split(/[,，]/u).map((tag) => tag.trim()).filter(Boolean);
}

/** Icons to pick from; any other emoji can be typed or pasted. */
export const ICONS = [
	'🧪', '⚗️', '🔬', '🧬', '⚛️', '💊', '🧫', '🌡️', '🔭', '🧲', '💡', '🔥', '❄️', '💧', '🌊', '⚡',
	'🌀', '🌈', '☀️', '🌙', '⭐', '🪐', '🌍', '🌱', '🍀', '🌸', '☕', '🍵', '📘', '📗', '📙', '📕',
	'📓', '📚', '📖', '📝', '✏️', '📌', '📎', '📐', '📏', '🧮', '📊', '📈', '📉', '🗂️', '🗃️', '📁',
	'🔖', '🏷️', '💻', '🖥️', '⌨️', '🧠', '🤖', '🛠️', '⚙️', '🔧', '🧰', '🔍', '🔑', '🚀', '🎯', '🏁',
	'✅', '❓', '❗', '💬', '🎓', '🏛️', '🧭', '⏱️', '⏳', '📅', '🎨', '🎵',
];
