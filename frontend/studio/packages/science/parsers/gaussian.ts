const ELEMENT_SYMBOLS = [
	'', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si',
	'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni',
	'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo',
	'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba',
	'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb',
	'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po',
	'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf',
	'Es', 'Fm', 'Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds', 'Rg', 'Cn',
	'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og',
];

export class UnsupportedGaussianCoordinatesError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UnsupportedGaussianCoordinatesError';
	}
}

/** Convert the first Cartesian geometry in a Gaussian input file to XYZ. */
export function gaussianToXyz(source: string): string {
	const lines = source.split(/\r?\n/);
	const chargeMultiplicityIndex = lines.findIndex((line) => /^\s*[+-]?\d+\s+\d+\s*$/.test(line));
	if (chargeMultiplicityIndex < 0) {
		throw new UnsupportedGaussianCoordinatesError('GJF 中没有找到电荷与多重度行');
	}

	const atoms: string[] = [];
	for (const line of lines.slice(chargeMultiplicityIndex + 1)) {
		if (!line.trim()) break;
		const parts = line.trim().replaceAll(',', ' ').split(/\s+/);
		const coordinateValues = parts.slice(1)
			.map((value) => value.replace(/[dD]/g, 'E'))
			.filter((value) => Number.isFinite(Number(value)));
		if (coordinateValues.length < 3) {
			throw new UnsupportedGaussianCoordinatesError('GJF 暂时只支持笛卡尔坐标，不支持 Z-matrix');
		}

		const atomicNumber = Number.parseInt(parts[0], 10);
		const symbolMatch = parts[0].match(/^[A-Za-z]{1,2}/);
		const matchedSymbol = symbolMatch?.[0];
		const symbol = /^\d+$/.test(parts[0])
			? ELEMENT_SYMBOLS[atomicNumber]
			: matchedSymbol
				? `${matchedSymbol[0].toUpperCase()}${matchedSymbol.slice(1).toLowerCase()}`
				: undefined;
		if (!symbol) throw new UnsupportedGaussianCoordinatesError(`无法识别 GJF 原子：${parts[0]}`);

		const [x, y, z] = coordinateValues.slice(-3);
		atoms.push(`${symbol} ${x} ${y} ${z}`);
	}

	if (!atoms.length) throw new UnsupportedGaussianCoordinatesError('GJF 中没有找到笛卡尔坐标');
	return `${atoms.length}\nGaussian input\n${atoms.join('\n')}`;
}
