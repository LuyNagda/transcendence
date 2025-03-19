import logger from './logger.js';
import jaiPasVu from './UI/JaiPasVu.js';
import { htmxPlugin } from './UI/HTMXPlugin.js';
import { uiPlugin } from './UI/UIPlugin.js';
import { store } from './state/store.js';
import { connectionManager } from './networking/ConnectionManager.js';
import { initializeAiManager, fetchTrainingStatus } from './pong/AiManager.js';
import Room from './room/Room.js';
import ChatApp from './chat/ChatApp.js';

function loadAiManager() {
	// First init when loading a room from the path
	if (window.location.pathname.includes('/ai/')) {
		initializeAiManager()
		fetchTrainingStatus()
	}

	// Then init when page transition to /pong/room/id and destroy when transitioning away
	jaiPasVu.on('htmx:pushedIntoHistory', (path) => {
		if (path.includes('/ai/')) {
			initializeAiManager()
			fetchTrainingStatus()
		}
	});
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
		loadAiManager();
		Room.initialize();

		logger.info(`[Main] Application initialized successfully`);
	} catch (error) {
		logger.error(`[Main] Error initializing application:`, error);
	}
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);