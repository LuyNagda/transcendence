import logger from './utils/logger.js';
import { initializeErrorHandling, initializeHtmxLogging } from './utils/htmx-debug.js';
import { initializeThemeAndFontSize, applyTheme, applyFontSize } from './utils/theme.js';
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

	document.getElementById('light')?.addEventListener('click', () => applyTheme('light'));
	document.getElementById('dark')?.addEventListener('click', () => applyTheme('dark'));
	document.getElementById('highContrast')?.addEventListener('click', () => applyTheme('high-contrast'));
	document.getElementById('toggleFontSizeBtn')?.addEventListener('change', (e) => {
		applyFontSize(e.target.checked ? 'large' : 'small');
	});
});
