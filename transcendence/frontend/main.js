import { logger } from './logger.js';
import { initializeThemeAndFontSize } from './theme.js';
import ChatApp from './chat/ChatApp.js';

function initializeChatApp() {
	if (window.chatApp) {
		console.warn('ChatApp already initialized');
		return;
	}

	try {
		window.chatApp = new ChatApp();
		console.log('ChatApp initialized successfully');
	} catch (error) {
		console.error('Failed to initialize ChatApp:', error);
	}
}

document.addEventListener('DOMContentLoaded', () => {
	logger.initialize();
	initializeThemeAndFontSize();
	initializeChatApp();
});
