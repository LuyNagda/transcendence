/** @type {import('jest').Config} */
const config = {
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/transcendence/frontend'],
	testPathIgnorePatterns: ['/node_modules/'],
	verbose: true,

	// Transform files with esbuild
	transform: {
		'^.+\\.js$': [
			'esbuild-jest',
			{
				sourcemap: true,
				format: 'esm',
				target: 'esnext'
			}
		]
	},

	// Module name mapper for imports
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1'
	},

	// Add global logger mock
	setupFilesAfterEnv: ['./jest.setup.js']
};

export default config; 
