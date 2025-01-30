import logger from './logger.js';
import jaiPasVu from './UI/JaiPasVu.js';
import { plugin as htmxPlugin } from './UI/HTMXPlugin.js';
import { plugin as uiPlugin } from './UI/theme.js';
import { initializeThemeAndFontSize } from './UI/theme.js';
import Store from './state/store.js';

function _initializeErrorHandling() {
	window.onerror = function (message, source, lineno, colno, error) {
		logger.error('Global error:', { message, source, lineno, colno, error });
		return false;
	};

	window.addEventListener('unhandledrejection', function (event) {
		logger.error('Unhandled promise rejection:', event.reason);
	});
}

function initializeApp() {
	try {
		const configElement = document.getElementById('app-config');
		if (!configElement) {
			console.error('App config element not found');
			return;
		}
		const config = JSON.parse(configElement.textContent);
		logger.initialize(config);
		logger.info('Starting application initialization');

		_initializeErrorHandling();

		// Initialize store
		Store.getInstance();

		jaiPasVu.initialize();
		jaiPasVu.use(uiPlugin);
		jaiPasVu.use(htmxPlugin);
		initializeThemeAndFontSize();

		logger.info('Application initialized successfully');
	} catch (error) {
		console.error('Error initializing application:', error);
		if (logger.error) {
			logger.error('Error initializing application:', error);
		}
	}
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);