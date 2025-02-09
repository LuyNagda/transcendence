import { jest } from '@jest/globals';
import logger from './transcendence/frontend/logger.js';

// Create spies for console methods
global.consoleMocks = {
	info: jest.spyOn(console, 'info').mockImplementation(() => { }),
	warn: jest.spyOn(console, 'warn').mockImplementation(() => { }),
	error: jest.spyOn(console, 'error').mockImplementation(() => { }),
	debug: jest.spyOn(console, 'debug').mockImplementation(() => { })
};

global.DEBUG = true;
logger.initialize({ debug: true });

// Clear all mocks before each test
beforeEach(() => {
	Object.values(global.consoleMocks).forEach(mock => mock.mockClear());
	global.DEBUG = true;
});

// Restore all mocks after all tests
afterAll(() => {
	Object.values(global.consoleMocks).forEach(mock => mock.mockRestore());
}); 
