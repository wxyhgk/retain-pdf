/**
 * RDKit's reason for refusing a structure, from its captured error log,
 * said in Chinese when the message is a known one. Atom numbers count from
 * 1, as the molfile lists atoms; RDKit's own count from 0.
 */
export function describeRDKitError(log: string): string {
	const lines = log
		.split(/\r?\n/)
		.map((line) => line.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '').trim())
		.filter(Boolean);
	const line = lines.find((item) => !/^\*+$/.test(item)) ?? '';
	const valence = /Explicit valence for atom # ?(\d+) (\w+), (\d+), is greater than permitted/.exec(line);
	if (valence) {
		const [, index, element, value] = valence;
		return `第 ${Number(index) + 1} 个原子 ${element} 连了 ${value} 价，超过它允许的化合价`;
	}
	if (/Can't kekulize mol/.test(line)) return '芳香环排不出单双键交替的结构（无法凯库勒化）';
	if (/SMILES Parse Error/.test(line)) return 'SMILES 写法有误';
	return line;
}
