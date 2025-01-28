import logger from './logger.js';
import javaisPasVu from './UI/JavaisPasVu.js';
import { UIService } from './UI/UIService.js';
import StateSync from './state/StateSync.js';
import { RoomController, createRoomController } from './room/RoomController.js';
import Store from './state/store.js';
import { initializeThemeAndFontSize } from './UI/theme.js';

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
		logger.initialize(config.debug, config.logLevel);
		logger.info('Starting application initialization');

		_initializeErrorHandling();

		javaisPasVu.initialize(document.body);

		UIService.initialize();

		StateSync.initialize(document.body);

		// Initialize RoomController with dependencies
		const store = Store.getInstance();
		const roomController = createRoomController(store);

		logger.info('Frontend app initialized');
	} catch (error) {
		console.error('Failed to initialize application:', error);
		logger.error('Failed to initialize application:', error);
	}
}

document.addEventListener('DOMContentLoaded', initializeApp);