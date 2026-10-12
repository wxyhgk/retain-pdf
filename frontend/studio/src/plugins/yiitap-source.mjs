import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packagesRoot = fileURLToPath(new URL('../../vendor/yiitap/packages/', import.meta.url));

function collectPackages(directory, found = []) {
	for (const name of readdirSync(directory)) {
		if (name === 'node_modules' || name === 'react' || name === 'vue-preset') continue;
		const full = join(directory, name);
		if (!statSync(full).isDirectory()) continue;
		const manifestPath = join(full, 'package.json');
		if (!existsSync(manifestPath)) {
			collectPackages(full, found);
			continue;
		}
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		const entry = join(full, 'src/index.ts');
		if (typeof manifest.name === 'string' && manifest.name.startsWith('@yiitap/') && existsSync(entry)) {
			found.push({ name: manifest.name, root: full, entry });
		}
	}
	return found;
}

export default function yiitapSource() {
	const packages = collectPackages(packagesRoot).sort((left, right) => right.name.length - left.name.length);
	return {
		name: 'yiitap-source',
		enforce: 'pre',
		resolveId(id) {
			for (const pkg of packages) {
				if (id === pkg.name) return pkg.entry;
				const prefix = `${pkg.name}/`;
				if (!id.startsWith(prefix)) continue;
				const file = join(pkg.root, id.slice(prefix.length));
				if (existsSync(file)) return file;
			}
			return null;
		},
	};
}
