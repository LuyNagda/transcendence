import { htmx } from './vendor.js';
import logger from './logger.js';
import { initializeErrorHandling, initializeHtmxLogging } from './htmx-debug.js';
import { initializeThemeAndFontSize, applyTheme, applyFontSize } from './UI/theme.js';
import ChatApp from './chat/ChatApp.js';
import dynamicRender from './UI/dynamic_render.js';
import { RoomManager } from './room/RoomManager.js';
import { RoomController } from './room/RoomController.js';
import { Room } from './room/Room.js';
import { initializeBootstrap } from './UI/bootstrap-init.js';
import Store, { actions } from './state/store.js';

function initializeChatApp() {
	try {
		new ChatApp();
		logger.info('ChatApp initialized successfully');
	} catch (error) {
		logger.error('Failed to initialize ChatApp:', error);
	}
}

function initializeRoom() {
	try {
		// Initialize room creation functionality
		const createRoomBtn = document.getElementById("create-room-btn");
		if (createRoomBtn) {
			new RoomController();
			logger.info('Room creation initialized');
		}

		// Initialize room if present
		const room = Room.initializeFromDOM();
		if (room) {
			RoomManager.getInstance().initialize(room);
			logger.info('Room initialized successfully', { roomId: room.roomId });
		}
	} catch (error) {
		logger.error('Failed to initialize room:', error);
	}
}

function initializeThemeButtons() {
	document.getElementById('light')?.addEventListener('click', () => applyTheme('light'));
	document.getElementById('dark')?.addEventListener('click', () => applyTheme('dark'));
	document.getElementById('highContrast')?.addEventListener('click', () => applyTheme('high-contrast'));
	document.getElementById('toggleFontSizeBtn')?.addEventListener('change', (e) => {
		applyFontSize(e.target.checked ? 'large' : 'small');
	});
}

// HTMX room state update handler
function handleRoomStateUpdate(event) {
	try {
		const roomState = Room.handleHtmxStateUpdate(event.detail.serverResponse);
		if (roomState) {
			RoomManager.getInstance().initialize(roomState);
		}
	} catch (error) {
		logger.error("Error processing room state update:", error);
	}
}

// Global room initialization function (for external use)
window.initializeRoomData = function (roomState) {
	logger.info("initializeRoomData called");
	if (!roomState || !roomState.roomId) {
		logger.error("Invalid room state:", roomState);
		return;
	}
	RoomManager.getInstance().initialize(roomState);
};

function initializeApp() {
	try {
		// Initialize logger with default settings first
		logger.initialize(true, 'DEBUG');  // Set temporary debug mode to see initialization issues

		// Initialize store
		const store = Store.getInstance();

		// Initialize config
		const configElement = document.getElementById('app-config');
		if (!configElement) {
			throw new Error('Configuration element not found');
		}
		const config = JSON.parse(configElement.textContent);
		store.dispatch({
			domain: 'config',
			type: actions.config.INITIALIZE,
			payload: config
		});

		// Set the user ID in the user state
		if (config.userId) {
			store.dispatch({
				domain: 'user',
				type: 'SET_USER',
				payload: {
					id: config.userId
				}
			});
		}

		// Re-initialize logger with config settings
		const configStore = store.getState('config');
		logger.initialize(configStore.debug, configStore.logLevel);
		logger.info('Config loaded:', configStore);
		initializeErrorHandling();

		// Initialize htmx directly
		htmx.on('htmx:beforeSwap', handleRoomStateUpdate);
		htmx.on('htmx:afterSwap', () => {
			dynamicRender.update();
		});

		initializeHtmxLogging();
		initializeThemeAndFontSize();
		initializeBootstrap(); // Initialize all Bootstrap components
		RoomManager.getInstance();
		dynamicRender.initialize();
		initializeChatApp();
		initializeRoom();
		initializeThemeButtons();
		logger.info('Frontend app initialized');
	} catch (error) {
		console.error('Failed to initialize application:', error);
	}
}

document.addEventListener('DOMContentLoaded', initializeApp);