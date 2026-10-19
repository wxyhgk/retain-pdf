// What the stand-in RetainMol (fake-retainmol.mjs) sends back as built: methanol.
export const BUILT_XYZ = '6\nmethanol\nC 0.000000 0.000000 0.000000\nO 1.420000 0.000000 0.000000\nH -0.360000 1.030000 0.000000\nH -0.360000 -0.510000 0.890000\nH -0.360000 -0.510000 -0.890000\nH 1.740000 0.900000 0.000000';
export const BUILT_MOL = [
	'methanol',
	'  RetainMol          3D',
	'',
	'  2  1  0  0  0  0  0  0  0  0999 V2000',
	'    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0',
	'    1.4200    0.0000    0.3000 O   0  0  0  0  0  0  0  0  0  0  0  0',
	'  1  2  1  0  0  0  0',
	'M  END',
].join('\n');
