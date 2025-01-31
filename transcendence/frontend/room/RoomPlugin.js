import logger from '../logger.js';
import { roomActions } from '../state/roomState.js';
import Store from '../state/store.js';
import Room from './Room.js';

/**
 * RoomPlugin - Handles room lifecycle and HTMX integration
 */
export const roomPlugin = {
	name: 'room',
	app: null,
	store: null,
	htmxPlugin: null,
	currentRoom: null,

	install(app) {
		if (!app) {
			logger.error('Failed to install RoomPlugin: app instance is required');
			return;
		}

		this.app = app;
		this.store = Store.getInstance();

		logger.debug('RoomPlugin dependencies initialized:', {
			hasStore: !!this.store,
		});

		// Register with HTMXPlugin after it's loaded
		app.on('plugin:installed', (plugin) => {
			if (plugin.name === 'htmx') {
				logger.debug('HTMXPlugin detected, setting up integration');
				this.htmxPlugin = plugin;
				this.setupHtmxIntegration(plugin);
			}
		});

		const roomId = this.getRoomIdFromURL();
		if (roomId) {
			logger.info('[RoomPlugin] Found room ID in URL:', roomId);
			this.initializeRoom(roomId);
		}

		logger.info('RoomPlugin installation complete');
	},

	getRoomIdFromURL() {
		try {
			const path = window.location.pathname;
			const roomMatch = path.match(/\/pong\/room\/([^\/]+)/);

			if (roomMatch && roomMatch[1]) {
				const roomId = roomMatch[1];
				logger.debug(`Found room ID in URL: ${roomId}`);
				return roomId;
			}
			logger.debug('No room ID found in URL path');
			return null;
		} catch (error) {
			logger.error('Error extracting room data from URL:', error);
			return null;
		}
	},

	setupHtmxIntegration(htmxPlugin) {
		logger.debug('Setting up HTMX integration for room functionality');

		htmxPlugin.addBeforeNavigateHandler({
			matches: (path) => path.includes('/pong/room/'),
			handle: () => this.handleBeforeRoomNavigate()
		});

		htmxPlugin.addAfterNavigateHandler({
			matches: (path) => !path.includes('/pong/room/'),
			handle: () => this.handleNavigateFromRoom()
		});

		logger.debug('[RoomPlugin] HTMX integration setup complete');
	},

	handleBeforeRoomNavigate() {
		logger.debug('[RoomPlugin] Navigating to room page');
		// Clean up any existing room before navigation
		this.cleanupCurrentRoom();
	},

	handleNavigateFromRoom() {
		logger.info('[RoomPlugin] Navigating away from room, initiating cleanup');
		this.cleanupCurrentRoom();
	},

	async initializeRoom(roomId) {
		try {
			this.cleanupCurrentRoom();

			const userState = this.store.getState('user');
			if (!userState) {
				logger.error('[RoomPlugin] Cannot initialize room: user state not found');
				return;
			}

			this.currentRoom = new Room(roomId);

			try {
				await this.currentRoom.connect();
				await this.currentRoom.getInitialState();
				this.app.emit('room:initialized', this.currentRoom);
				logger.info('[RoomPlugin] Room initialized successfully:', roomId);
			} catch (error) {
				logger.error('[RoomPlugin] Failed to get initial room state:', error);
				this.cleanupCurrentRoom();
				throw error;
			}
		} catch (error) {
			logger.error('[RoomPlugin] Failed to initialize room:', error);
			this.app.emit('room:error', error);
		}
	},

	cleanupCurrentRoom() {
		if (this.currentRoom) {
			logger.info('[RoomPlugin] Cleaning up current room');
			this.app.emit('room:beforeCleanup', this.currentRoom);
			this.currentRoom.destroy();
			this.currentRoom = null;
			this.store.dispatch({
				domain: 'room',
				type: roomActions.CLEAR_ROOM
			});
			this.app.emit('room:cleanup');
		}
	}
}; 