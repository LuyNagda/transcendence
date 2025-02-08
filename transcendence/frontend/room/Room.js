import logger from '../logger.js';
import { store, actions } from '../state/store.js';
import jaiPasVu from '../UI/JaiPasVu.js';
import { RoomModes, initialRoomState } from '../state/roomState.js';
import { createRoomStateManager } from './RoomStateManager.js';
import { createRoomUIManager } from './RoomUIManager.js';
import { createRoomGameManager } from './RoomGameManager.js';
import { createRoomConnectionManager } from './RoomConnectionManager.js';

/**
 * Main Room class that coordinates between different managers
 */
export default class Room {
	static _instance = null;
	static initialize() {
		// First init when loading a room from the path
		if (window.location.pathname.includes('/pong/room/')) {
			logger.info('[Room] Static initialize: Initializing room from path:', window.location.pathname);
			const roomId = window.location.pathname.replace('/pong/room/', '').replace('/', '');
			logger.info('[Room] Static initialize: Initializing room:', roomId);

			// Clear any existing room state before initialization
			store.dispatch({
				domain: 'room',
				type: actions.room.CLEAR_ROOM,
				payload: null
			});

			Room._instance = new Room(roomId);
			Room._instance._initializeRoomApp();
		}

		// Then init when page transition to /pong/room/id and destroy when transitioning away
		jaiPasVu.on('htmx:pushedIntoHistory', (path) => {
			logger.info('[Room] Static initialize: htmx:pushedIntoHistory :', path);
			if (path.includes('/pong/room/')) {
				const roomId = path.replace('/pong/room/', '').replace('/', '');

				// Clear any existing room state before initialization
				store.dispatch({
					domain: 'room',
					type: actions.room.CLEAR_ROOM,
					payload: null
				});

				Room._instance = new Room(roomId);
				Room._instance._initializeRoomApp();
			} else {
				if (Room._instance) {
					Room._instance.destroy();
					Room._instance = null;
				}
			}
		});
	}

	constructor(roomId) {
		if (!roomId)
			throw new Error('Room ID is required');
		this._roomId = roomId;
		this._isDestroyed = false;
	}

	async _initializeRoomApp() {
		try {
			const userState = store.getState('user');
			this._currentUser = {
				id: userState.id,
				username: userState.username
			};

			// Initialize store with default state
			store.dispatch({
				domain: 'room',
				type: actions.room.UPDATE_ROOM,
				payload: {
					...initialRoomState,
					id: this._roomId,
					currentUser: this._currentUser
				}
			});

			this._initializeManagers();
			this._setupEventHandlers();

			const connection = await this.connect();
			if (this._isDestroyed) return;

			if (connection) {
				const state = store.getState('room');
				logger.info('[Room] state: ', state);
				this._uiManager._handleRoomStateUpdate(state);

				logger.info('[Room] Room initialized successfully:', {
					roomId: this._roomId,
					user: this._currentUser
				});
			}
		} catch (error) {
			logger.error('[Room] Failed to initialize room:', error);
			if (!this._isDestroyed) {
				this._handleRoomError({
					code: 'INITIALIZATION_ERROR',
					message: 'Failed to initialize room'
				});
			}
		}
	}

	_initializeManagers() {
		this._stateManager = createRoomStateManager(this._roomId);
		const mode = this._stateManager.getMode();
		const connectionConfig = this._createConnectionConfig(mode);
		this._connectionManager = createRoomConnectionManager(this._roomId, connectionConfig);
		this._uiManager = createRoomUIManager(this._roomId);
		this._gameManager = createRoomGameManager(this._roomId);
	}

	/**
	 * Creates connection configuration based on room mode
	 * @private
	 */
	_createConnectionConfig(mode) {
		const config = {
			enableGameConnection: mode !== RoomModes.AI,
			wsConfig: {
				maxReconnectAttempts: 5,
				reconnectInterval: 1000,
				connectionTimeout: 10000
			}
		};

		// Add WebRTC configuration if needed
		if (config.enableGameConnection) {
			config.rtcConfig = {
			};
		}

		return config;
	}

	_setupEventHandlers() {
		// Set up UI event handlers
		this._uiManager.setStartGameHandler(() => this.startGame());
		this._uiManager.setSettingChangeHandler((setting, value) => this.updateSetting(setting, value));
		this._uiManager.setKickPlayerHandler((playerId) => this.kickPlayer(playerId));
		this._uiManager.setCancelInvitationHandler((invitationId) => this.cancelInvitation(invitationId));
		this._uiManager.setModeChangeHandler((event) => this.handleModeChange(event));
		this._uiManager.setInviteFriendHandler((friendId) => this.inviteFriend(friendId));

		// Set up game event handlers
		this._gameManager.on('game_failure', (error) => {
			logger.error('Game failure:', error);
			this._stateManager.transitionToLobby();
		});

		// Set up connection event handlers
		const mainConnection = this._connectionManager.getMainConnection();
		if (!mainConnection) {
			throw new Error('Main connection not available');
		}

		// Handle room errors
		mainConnection.on('room_error', (error) => {
			logger.error('[Room] Room error:', error);
			this._handleRoomError(error);
		});

		mainConnection.on('disconnected', () => {
			logger.warn('[Room] Network connection lost');
			this._stateManager.transitionToLobby();
		});

		mainConnection.on('max_reconnect_attempts', () => {
			logger.error('[Room] Failed to reconnect to server');
			this._stateManager.transitionToLobby();
		});

		// Handle room update events
		mainConnection.on('room_update', (data) => {
			logger.debug('[Room] Received room update:', data);
			if (data.room_state) {
				this._stateManager.updateState(data.room_state);
			}
		});

		// Handle settings update events
		mainConnection.on('settings_update', (data) => {
			logger.debug('[Room] Received settings update:', data);
			if (data.setting && data.value) {
				this._stateManager.updateSettings({
					[data.setting]: data.value
				});
			}
		});

		// Handle mode change events
		mainConnection.on('mode_change', async (data) => {
			logger.debug('[Room] Received mode change:', data);
			if (data.mode) {
				await this._handleModeChangeEvent(data.mode);
			}
		});

		// Handle game started event
		mainConnection.on('message', (data) => {
			if (data.type === 'game_started') {
				this._gameManager._handleGameStarted(data);
			} else if (data.type === 'game_ended') {
				this._gameManager._handleGameEnded(data);
				this._connectionManager.getMainConnection()
			}
		});
	}

	/**
	 * Handles mode change event and reinitializes connections if needed
	 * @private
	 */
	async _handleModeChangeEvent(newMode) {
		const currentMode = this._stateManager.getMode();
		this._stateManager.updateMode(newMode);

		// Check if we need to reinitialize connections
		const needsReconnection = (currentMode === RoomModes.AI) !== (newMode === RoomModes.AI);
		if (needsReconnection) {
			logger.info('[Room] Mode change requires connection reinitialization');

			// Clean up existing connections
			this._connectionManager.destroy();

			// Create new connection configuration
			const connectionConfig = this._createConnectionConfig(newMode);
			this._connectionManager = createRoomConnectionManager(this._roomId, connectionConfig);

			// Reconnect and update game manager
			await this._connectionManager.connect();
			this._gameManager.updateConnection(this._connectionManager.getGameConnection());
		}
	}

	/**
	 * Handles room errors and navigation
	 * @private
	 */
	_handleRoomError(error) {
		logger.error('[Room] Handling room error:', error);

		// Set error in store first
		store.dispatch({
			domain: 'room',
			type: actions.room.SET_ERROR,
			payload: {
				code: error.code || 'UNKNOWN_ERROR',
				message: error.message || 'An unknown error occurred',
				timestamp: Date.now()
			}
		});

		// Clean up managers in specific order
		if (this._gameManager) {
			this._gameManager.destroy();
			this._gameManager = null;
		}
		if (this._uiManager) {
			this._uiManager.destroy();
			this._uiManager = null;
		}
		if (this._stateManager) {
			this._stateManager.destroy();
			this._stateManager = null;
		}
		if (this._connectionManager) {
			this._connectionManager.destroy();
			this._connectionManager = null;
		}

		// Clear room state last
		store.dispatch({
			domain: 'room',
			type: actions.room.CLEAR_ROOM,
			payload: {
				userId: this._currentUser?.id,
				roomId: this._roomId
			}
		});
		logger.info('[Room] Error handling and cleanup completed');
	}

	/**
	 * Connect to the room's connections
	 */
	async connect() {
		try {
			const connection = await this._connectionManager.connect();
			if (connection) {
				await this.setupInitialState();
				logger.info('[Room] Connected to room');
			}
		} catch (error) {
			logger.error('[Room] Failed to connect to room:', error);
			// Don't call _handleRoomError here as it will be called via the room_error event
			throw error;
		}
	}

	/**
	 * Get initial room state through WebSocket
	 */
	async setupInitialState() {
		try {
			const roomState = await this._connectionManager.getCurrentState();
			logger.info('`[Room] Initial room state`:', roomState);
			this._stateManager.updateState(roomState);
			store.dispatch({
				domain: 'room',
				type: 'UPDATE_ROOM',
				payload: roomState
			});
			logger.info('Received initial room state');
		} catch (error) {
			logger.error('[Room] Failed to get initial room state:', error);
			throw error;
		}
	}

	async startGame() {
		try {
			await this._connectionManager.startGame();
		} catch (error) {
			logger.error('[Room] Failed to start game:', error);
			throw error;
		}
	}

	async leaveGame() {
		logger.info('[Room] Leaving game');
		await this._connectionManager.leaveGame();
	}

	async updateSetting(setting, value) {
		try {
			await this._connectionManager.updateSetting(setting, value);
		} catch (error) {
			logger.error('[Room] Failed to update setting:', error);
			throw error;
		}
	}

	async handleModeChange(event) {
		const newMode = event.target.value;
		try {
			await this._connectionManager.updateMode(newMode);
		} catch (error) {
			logger.error('[Room] Failed to change mode:', error);
		}
	}

	// Player management methods
	async kickPlayer(playerId) {
		try {
			await this._connectionManager.kickPlayer(playerId);
		} catch (error) {
			logger.error('[Room] Failed to kick player:', error);
			throw error;
		}
	}

	async inviteFriend(friendId) {
		if (!this._stateManager.availableSlots) {
			logger.warn('[Room] Room is full');
			return;
		}

		try {
			await this._connectionManager.inviteFriend(friendId);
		} catch (error) {
			logger.error('[Room] Failed to invite friend:', error);
		}
	}

	async cancelInvitation(invitationId) {
		if (!this._stateManager.isOwner(this._currentUser.id)) {
			logger.warn('[Room] Only room owner can cancel invitations');
			return;
		}

		try {
			await this._connectionManager.cancelInvitation(invitationId);
			this._stateManager.removeInvitation(invitationId);
		} catch (error) {
			logger.error('[Room] Failed to cancel invitation:', error);
		}
	}

	destroy() {
		try {
			this._isDestroyed = true;

			// Clean up managers in specific order
			if (this._gameManager) {
				this._gameManager.destroy();
				this._gameManager = null;
			}
			if (this._uiManager) {
				this._uiManager.destroy();
				this._uiManager = null;
			}
			if (this._stateManager) {
				this._stateManager.destroy();
				this._stateManager = null;
			}
			if (this._connectionManager) {
				this._connectionManager.destroy();
				this._connectionManager = null;
			}

			store.dispatch({
				domain: 'room',
				type: actions.room.CLEAR_ROOM,
				payload: {
					roomId: this._roomId
				}
			});

			logger.info('[Room] Destroyed');
		} catch (error) {
			logger.error('[Room] Error during cleanup:', error);
		}
	}
}
