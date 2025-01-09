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
		// Only initialize chat if user is authenticated
		const store = Store.getInstance();
		const config = store.getState('config');
		if (!config.userId) {
			logger.debug('Skipping ChatApp initialization - user not authenticated');
			return;
		}

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

// Add this function to handle authentication state changes
function handleAuthenticationStateChange(isAuthenticated) {
	logger.info('Authentication state changed:', { isAuthenticated });
	if (isAuthenticated) {
		// Initialize managers and UI
		dynamicRender.initialize();
		RoomManager.getInstance();

		// Initialize chat last (after Bootstrap)
		initializeChatApp();
		initializeRoom();

		// Set up HTMX event handlers
		document.addEventListener('htmx:beforeSwap', handleRoomStateUpdate);
		document.addEventListener('htmx:afterSwap', () => {
			logger.debug('HTMX afterSwap triggered');
			dynamicRender.update();
			initializeBootstrap(); // Reinitialize Bootstrap components
		});

		// Set up offcanvas specific handler
		document.addEventListener('show.bs.offcanvas', () => {
			logger.debug('Offcanvas show event triggered');
		});
	}
}

function initializeApp() {
	try {
		// Initialize logger with default settings first
		logger.initialize(true, 'DEBUG');  // Set temporary debug mode to see initialization issues
		logger.info('Starting application initialization');

		// Initialize store
		const store = Store.getInstance();

		// Initialize config
		const configElement = document.getElementById('app-config');
		if (!configElement) {
			logger.warn('Configuration element not found, waiting for authentication...');
			return;
		}

		const config = JSON.parse(configElement.textContent);
		store.dispatch({
			domain: 'config',
			type: actions.config.INITIALIZE,
			payload: config
		});

		// Set the user ID in the user state if authenticated
		const isAuthenticated = !!config.userId;
		if (isAuthenticated) {
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

		// Initialize core components that are needed for all pages
		initializeErrorHandling();
		initializeHtmxLogging();
		initializeThemeAndFontSize();
		initializeBootstrap(); // Initialize all Bootstrap components first
		initializeThemeButtons();

		// Initialize authenticated components if user is already logged in
		if (isAuthenticated) {
			handleAuthenticationStateChange(true);
		}

		// Set up authentication state change listener
		store.subscribe('user', (userState) => {
			const newIsAuthenticated = !!userState.id;
			if (newIsAuthenticated !== isAuthenticated) {
				handleAuthenticationStateChange(newIsAuthenticated);
			}
		});

		logger.info('Frontend app initialized');
	} catch (error) {
		console.error('Failed to initialize application:', error);
		logger.error('Failed to initialize application:', error);
	}
}

document.addEventListener('DOMContentLoaded', initializeApp);