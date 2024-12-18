import logger from './utils/logger.js';
import { initializeErrorHandling, initializeHtmxLogging } from './utils/htmx-debug.js';
import { initializeThemeAndFontSize, applyTheme, applyFontSize } from './utils/theme.js';
import UserService from './UserService.js';
import ChatApp from './chat/ChatApp.js';
import dynamicRender from './utils/dynamic_render.js';
import { RoomManager } from './room/RoomManager.js';
import { RoomController } from './room/RoomController.js';
import { Room } from './room/Room.js';

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

document.addEventListener('DOMContentLoaded', () => {
	logger.initialize();
	initializeErrorHandling();
	initializeHtmxLogging();
	initializeThemeAndFontSize();
	UserService.getInstance();
	RoomManager.getInstance();
	dynamicRender.initialize();
	initializeChatApp();
	initializeRoom();
	initializeThemeButtons();
	logger.info('Frontend app initialized');
});

// HTMX event listeners
document.body.addEventListener('htmx:beforeSwap', handleRoomStateUpdate);
document.body.addEventListener('htmx:afterSwap', () => {
	// initializeRoom();
	dynamicRender.update();
});