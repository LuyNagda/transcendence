const esbuild = require('esbuild');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

const buildOptions = {
	entryPoints: ['transcendence/frontend/main.js'],
	bundle: true,
	outdir: 'transcendence/static/js',
	format: 'esm',
	minify: isProd,
	sourcemap: !isProd,
	resolveExtensions: ['.js'],
	absWorkingDir: path.resolve(__dirname),
	platform: 'browser',
};

if (isProd) {
	esbuild.build(buildOptions).catch(() => process.exit(1));
} else {
	esbuild.context(buildOptions).then(context => {
		context.watch();
		console.log('Watching for changes...');
	}).catch(() => process.exit(1));
}