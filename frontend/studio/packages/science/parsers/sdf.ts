/** Detect whether an inline V2000/V3000 mol block carries 3D coordinates. */
export function sdfHas3DCoordinates(source: string): boolean {
	const lines = source.split(/\r?\n/);
	if (lines.slice(0, 3).some((line) => /\b3D\b/i.test(line))) return true;

	const countsIndex = lines.findIndex((line) => /V2000|V3000/.test(line));
	if (countsIndex < 0) return false;

	if (lines[countsIndex].includes('V3000')) {
		return lines.some((line) => {
			const match = line.match(/^M\s+V30\s+\d+\s+\S+\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/);
			return match ? Math.abs(Number(match[3])) > 1e-6 : false;
		});
	}

	const atomCount = Number.parseInt(lines[countsIndex].slice(0, 3).trim(), 10);
	if (!Number.isFinite(atomCount)) return false;
	return lines.slice(countsIndex + 1, countsIndex + 1 + atomCount).some((line) => {
		const z = Number.parseFloat(line.slice(20, 30));
		return Number.isFinite(z) && Math.abs(z) > 1e-6;
	});
}
