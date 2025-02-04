import logger from './logger.js';
import jaiPasVu from './UI/JaiPasVu.js';
import { htmxPlugin } from './UI/HTMXPlugin.js';
import { uiPlugin } from './UI/UIPlugin.js';
import { store } from './state/store.js';
import { connectionManager } from './networking/ConnectionManager.js';
import Room from './room/Room.js';

function _initializeErrorHandling() {
	window.onerror = function (message, source, lineno, colno, error) {
		logger.error(`[Global error]`, { message, source, lineno, colno, error });
		return false;
	};

	window.addEventListener('unhandledrejection', function (event) {
		logger.error(`[Global error] Unhandled promise rejection:`, event.reason);
	});
}

function initializeApp() {
	try {
		const configElement = document.getElementById('app-config');
		if (!configElement) {
			logger.error(`[Main] App config element not found`);
			return;
		}
		const config = JSON.parse(configElement.textContent);
		logger.initialize(config);
		logger.info(`[Main] Starting application initialization`);

		_initializeErrorHandling();

		store.initialize();
		connectionManager.initialize();

		jaiPasVu.use(uiPlugin);
		jaiPasVu.use(htmxPlugin);
		jaiPasVu.initialize();

		Room.initialize();

		logger.info(`[Main] Application initialized successfully`);
	} catch (error) {
		logger.error(`[Main] Error initializing application:`, error);
	}
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);