import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

const buildOptions = {
	entryPoints: {
		'main': 'transcendence/frontend/main.js',
		'vendor': 'transcendence/frontend/vendor.js',
		'high-contrast': 'transcendence/frontend/css/high-contrast.css',
	},
	bundle: true,
	outdir: 'transcendence/static',
	format: 'esm',
	minify: isProd,
	sourcemap: !isProd,
	resolveExtensions: ['.js'],
	absWorkingDir: path.resolve(__dirname),
	platform: 'browser',
	splitting: true
};

if (isProd) {
	esbuild.build(buildOptions).catch(() => process.exit(1));
} else {
	esbuild.context(buildOptions).then(context => {
		context.watch();
		console.log('Watching for changes...');
	}).catch(() => process.exit(1));
}