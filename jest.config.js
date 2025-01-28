/** @type {import('jest').Config} */
const config = {
	// The test environment that will be used for testing
	testEnvironment: 'jsdom',

	// The root directory that Jest should scan for tests and modules
	roots: ['<rootDir>/transcendence/frontend'],

	// Ignore patterns
	testPathIgnorePatterns: ['/node_modules/'],

	// Display test results with colors in the terminal
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
	}
};

export default config; 
