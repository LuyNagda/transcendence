import { logger } from './utils/logger.js';
import { initializeErrorHandling, initializeHtmxLogging } from './utils/htmx-debug.js';
import { initializeThemeAndFontSize } from './utils/theme.js';
import UserService from './UserService.js';
import ChatApp from './chat/ChatApp.js';

function initializeChatApp() {
	try {
		new ChatApp();
		logger.info('ChatApp initialized successfully');
	} catch (error) {
		logger.error('Failed to initialize ChatApp:', error);
	}
}

document.addEventListener('DOMContentLoaded', () => {
	logger.initialize();
	initializeErrorHandling();
	initializeHtmxLogging();
	initializeThemeAndFontSize();
	UserService.getInstance();
	initializeChatApp();
	logger.info('Frontend app initialized');
});
