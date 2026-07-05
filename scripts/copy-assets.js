// Copies static assets (icons, etc.) from nodes/ and credentials/ into dist/,
// preserving folder structure. Plain Node.js, no dependencies, no native builds.
const fs = require('fs');
const path = require('path');

const SRC_DIRS = ['nodes', 'credentials'];
const DIST_DIR = 'dist';
const STATIC_EXTENSIONS = ['.svg', '.png', '.json'];

function copyStaticFiles(srcDir) {
	const fullSrcDir = path.join(__dirname, '..', srcDir);
	if (!fs.existsSync(fullSrcDir)) return;

	const entries = fs.readdirSync(fullSrcDir, { withFileTypes: true, recursive: true });

	for (const entry of entries) {
		if (!entry.isFile()) continue;
		const ext = path.extname(entry.name);
		if (!STATIC_EXTENSIONS.includes(ext)) continue;

		const parentDir = entry.parentPath || entry.path;
		const relativeDir = path.relative(fullSrcDir, parentDir);
		const srcFile = path.join(parentDir, entry.name);
		const destDir = path.join(__dirname, '..', DIST_DIR, srcDir, relativeDir);
		const destFile = path.join(destDir, entry.name);

		fs.mkdirSync(destDir, { recursive: true });
		fs.copyFileSync(srcFile, destFile);
		console.log(`Copied ${path.relative(process.cwd(), srcFile)} -> ${path.relative(process.cwd(), destFile)}`);
	}
}

for (const dir of SRC_DIRS) {
	copyStaticFiles(dir);
}
