import logger from './utils/logger.js';
import { initializeErrorHandling, initializeHtmxLogging } from './utils/htmx-debug.js';
import { initializeThemeAndFontSize, applyTheme, applyFontSize } from './utils/theme.js';
import UserService from './UserService.js';
import RoomService from './RoomService.js';
import ChatApp from './chat/ChatApp.js';
import dynamicRender from './utils/dynamic_render.js';
import { PongRoom } from './pong/pong_room.js';
import { initializeAiManager } from './pong/AiManager.js';

function initializeChatApp() {
	try {
		new ChatApp();
		logger.info('ChatApp initialized successfully');
	} catch (error) {
		logger.error('Failed to initialize ChatApp:', error);
	}
}

function initializePongRoom() {
	const pongRoomElement = document.getElementById('pong-room');
	if (pongRoomElement) {
		const roomId = JSON.parse(document.getElementById("room-id").textContent);
		logger.info('main.js initializePongRoom Room ID:', roomId);
		const currentUser = JSON.parse(document.getElementById("current-user-data").textContent);
		const pongRoom = new PongRoom(roomId, currentUser);
		dynamicRender.addObservedObject('pongRoom', pongRoom);
		logger.info('PongRoom initialized successfully');
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

document.addEventListener('DOMContentLoaded', () => {
	logger.initialize();
	initializeErrorHandling();
	initializeHtmxLogging();
	initializeThemeAndFontSize();
	UserService.getInstance();
	RoomService.getInstance();
	dynamicRender.initialize();
	initializeChatApp();
	initializePongRoom();
	initializeThemeButtons();
	initializeAiManager();
	logger.info('Frontend app initialized');
});

// Écouteur pour les événements HTMX
document.body.addEventListener('htmx:afterSwap', (event) => {
	initializeThemeButtons();
	if (event.detail.elt.id === 'pong-room') {
		initializePongRoom();
	}
	dynamicRender.update();
});
