import logger from './logger.js';
import jaiPasVu from './UI/JaiPasVu.js';
import { htmxPlugin } from './UI/HTMXPlugin.js';
import { uiPlugin } from './UI/UIPlugin.js';
import { store } from './state/store.js';
import { connectionManager } from './networking/ConnectionManager.js';
import { initializeAiManager } from './pong/AiManager.js';
import Room from './room/Room.js';
import ChatApp from './chat/ChatApp.js';

function waitForElement(selector, callback) {
	const element = document.querySelector(selector);
	if (element) {
		callback();  // If the element already exists, run the callback immediately
		return;
	}

	const observer = new MutationObserver((mutations, obs) => {
		logger.info(`[Waiting] waitForElement :`, selector);

		if (document.querySelector(selector)) {
			logger.info(`[Waiting end] Element is ready :`, selector);
			callback();
			obs.disconnect();  // Stop observing once the element is found
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });
}

async function initializeApp() {
	try {
		const configElement = document.getElementById('app-config');
		if (!configElement) {
			logger.error(`[Main] App config element not found`);
			return;
		}
		const config = JSON.parse(configElement.textContent);
		logger.initialize(config);
		logger.info(`[Main] Starting application initialization`);

		store.initialize();
		store.dispatch({
			domain: 'config',
			type: 'INITIALIZE',
			payload: config
		});

		connectionManager.initialize();

		jaiPasVu.use(uiPlugin);
		jaiPasVu.use(htmxPlugin);
		jaiPasVu.initialize();

		await ChatApp.initialize();

		// Use the function to wait for #saved-ai-dropdown
		waitForElement("#saved-ai-dropdown", initializeAiManager);

		Room.initialize();

		logger.info(`[Main] Application initialized successfully`);
	} catch (error) {
		logger.error(`[Main] Error initializing application:`, error);
	}
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);