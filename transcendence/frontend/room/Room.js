import logger from '../logger.js';
import { store, actions } from '../state/store.js';
import jaiPasVu from '../UI/JaiPasVu.js';
import { RoomModes, RoomStates } from '../state/roomState.js';
import { createRoomUIManager } from './RoomUIManager.js';
import { createRoomGameManager } from './RoomGameManager.js';
import { createRoomConnectionManager } from './RoomConnectionManager.js';
import { GameRules } from '../pong/core/GameRules.js';
import { AIService } from './AIService.js';
import { Modal } from 'bootstrap';

window.bootstrap = window.bootstrap || {};
window.bootstrap.Modal = Modal;
/**
 * Main Room class that coordinates between different managers
 */
export default class Room {
	static _instance = null;
	static initialize() {
		// First init when loading a room from the path
		if (window.location.pathname.includes('/pong/room/')) {
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

				// Destroy existing instance if it exists
				if (Room._instance) {
					Room._instance.destroy();
					Room._instance = null;
				}

				// Create new instance and initialize
				Room._instance = new Room(roomId);
				Room._instance._initializeRoomApp();
			} else {
				if (Room._instance) {
					Room._instance.destroy();
					Room._instance = null;
				}
			}
		});

		// Add handler for history pop state
		window.addEventListener('popstate', (event) => {
			const path = window.location.pathname;
			logger.info('[Room] popstate event detected:', path);
			if (path.includes('/pong/room/')) {
				const roomId = path.replace('/pong/room/', '').replace('/', '');

				// Clear any existing room state before initialization
				store.dispatch({
					domain: 'room',
					type: actions.room.CLEAR_ROOM,
					payload: null
				});

				// Destroy existing instance if it exists
				if (Room._instance) {
					Room._instance.destroy();
					Room._instance = null;
				}

				// Create new instance and initialize
				Room._instance = new Room(roomId);
				Room._instance._initializeRoomApp();
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

			const payload = {
				id: this._roomId,
				currentUser: this._currentUser
			}

			const availableAIs = await AIService.loadAvailableModels();
			if (availableAIs.length > 0)
				payload.availableAIs = availableAIs;

			logger.info('[Room] Available AIs:', availableAIs);

			// Initialize store with default state
			store.dispatch({
				domain: 'room',
				type: actions.room.UPDATE_ROOM,
				payload
			});

			this._initializeManagers();
			this._setupEventHandlers();

			const mainConnection = this._connectionManager.getMainConnection();
			if (!mainConnection)
				throw new Error('Main connection not available');

			mainConnection.on('message', (data) => {
				if (this._isDestroyed) return;

				switch (data.type) {
					case 'room_update':
						if (data.room_state)
							this._handleRoomStateUpdate(data.room_state);
						break;
					case 'settings_update':
						if (data.setting && data.value !== undefined)
							this._handleSettingsUpdate(data);
						break;
					case 'mode_change':
						if (data.mode)
							this._handleModeChangeEvent(data.mode);
						break;
					case 'game_started':
						this._handleGameStarted(data);
						break;
					case 'game_ended':
						this._handleGameEnded(data);
						break;
					case 'room_info':
						this._handleRoomMessage(data);
						break;
					case 'error':
						// Ignore error messages as they're handled by the connection manager
						break;
					default:
						logger.debug('[Room] Received message:', data);
				}
			});

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
			if (!this._isDestroyed) {
				logger.error('[Room] Failed to initialize room:', error);
				this._handleRoomError({
					code: 'INITIALIZATION_ERROR',
					message: 'Failed to initialize room'
				});
			}
		}
	}

	_initializeManagers() {
		const mode = this._getRoomMode();
		const connectionConfig = this._createConnectionConfig(mode);
		this._connectionManager = createRoomConnectionManager(this._roomId, connectionConfig);
		this._uiManager = createRoomUIManager(this._roomId);
		this._gameManager = createRoomGameManager(this._roomId, this._connectionManager);
	}

	_getRoomMode() {
		const roomState = store.getState('room');
		return roomState?.mode || RoomModes.LOCAL;
	}

	_getAvailableSlots() {
		const roomState = store.getState('room');
		if (!roomState) return 0;
		return roomState.maxPlayers - (roomState.players?.length || 0);
	}

	_isOwner(userId) {
		const roomState = store.getState('room');
		return roomState?.owner?.id === userId;
	}

	/**
	 * Creates connection configuration based on room mode
	 * @private
	 */
	_createConnectionConfig(mode) {
		const config = {
			enableGameConnection: mode !== RoomModes.AI && mode !== RoomModes.LOCAL,
			wsConfig: {
				maxReconnectAttempts: 5,
				reconnectInterval: 1000,
				connectionTimeout: 10000
			}
		};

		return config;
	}

	_setupEventHandlers() {
		// Set up UI event handlers
		this._uiManager.setStartGameHandler(() => this.startGame());
		this._uiManager.setSettingChangeHandler((setting, value) => this.updateSetting(setting, value));
		this._uiManager.setKickPlayerHandler((playerId) => this.kickPlayer(playerId));
		this._uiManager.setCancelInvitationHandler((invitationId) => this.cancelInvitation(invitationId));
		this._uiManager.setModeChangeHandler((event) => this.handleModeChange(event));

		// Set up game event handlers
		this._gameManager.on('game_failure', (error) => {
			logger.error('Game failure:', error);
			this._handleGameFailure(error);
		});

		this._gameManager.on('game_ended', () => {
			this._updateRoomState({ state: RoomStates.LOBBY });
		});

		// Set up connection event handlers
		const mainConnection = this._connectionManager.getMainConnection();
		if (!mainConnection) {
			throw new Error('Main connection not available');
		}

		// Handle room errors
		mainConnection.on('room_error', (error) => {
			const isExpectedError = (
				// Numeric error codes in 4000-4999 range are expected
				(typeof error.code === 'number' && error.code >= 4000 && error.code < 5000) ||
				// Specific string error codes that are expected
				['CONNECTION_LOST', 'CONNECTION_ERROR'].includes(error.code)
			);

			if (isExpectedError)
				logger.warn('[Room] Room error:', error);
			else
				logger.error('[Room] Room error:', error);
			this._handleRoomError(error);
		});

		mainConnection.on('disconnected', () => {
			logger.warn('[Room] Network connection lost');
			this._handleConnectionLost();
		});

		mainConnection.on('max_reconnect_attempts', () => {
			logger.error('[Room] Failed to reconnect to server');
			this._handleConnectionLost();
		});
	}

	// Event handlers
	_handleGameStarted(data) {
		logger.info('[Room] Game started:', data);
		this._updateRoomState({ state: RoomStates.PLAYING, canStartGame: false });
		this._gameManager.handleGameStarted(data);
	}

	_handleGameEnded(data) {
		logger.info('[Room] Game ended:', data);
		this._updateRoomState({ state: RoomStates.LOBBY });
		// this._gameManager.handleGameEnded(data);
	}

	_handleGameFailure(error) {
		logger.error('[Room] Game failure:', error);
		this._updateRoomState({ state: RoomStates.LOBBY });
		this._gameManager.cleanup();
	}

	_handleConnectionLost() {
		this._updateRoomState({ state: RoomStates.LOBBY });
		if (this._gameManager.isGameInProgress()) {
			this._gameManager.cleanup();
		}
	}

	_handleRoomStateUpdate(roomState) {
		this._updateRoomState(roomState);

		// Update game manager if needed
		if (roomState.state === RoomStates.PLAYING && !this._gameManager.isGameInProgress()) {
			this._gameManager.prepareGame(roomState);
		} else if (roomState.state === RoomStates.LOBBY && this._gameManager.isGameInProgress()) {
			this._gameManager.cleanup();
		}
	}

	_handleSettingsUpdate(data) {
		logger.info('[Room] Handling settings update:', data);
		try {
			store.dispatch({
				domain: 'room',
				type: actions.room.UPDATE_ROOM_SETTINGS,
				payload: {
					settings: {
						[data.setting]: data.value
					}
				}
			});

			this._uiManager._handleRoomStateUpdate(store.getState('room'));
		} catch (error) {
			logger.error('[Room] Error handling settings update:', error);
		}
	}

	/**
	 * Handles mode change event and reinitializes connections if needed
	 * @private
	 */
	async _handleModeChangeEvent(newMode) {
		const currentMode = this._getRoomMode();

		// Update store with new mode
		store.dispatch({
			domain: 'room',
			type: actions.room.UPDATE_ROOM,
			payload: { mode: newMode }
		});

		// Check if we need to reinitialize connections
		const isCurrentModeLocal = currentMode === RoomModes.AI || currentMode === RoomModes.LOCAL;
		const isNewModeLocal = newMode === RoomModes.AI || newMode === RoomModes.LOCAL;
		const needsReconnection = isCurrentModeLocal !== isNewModeLocal;
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
	 * Updates room state in store
	 * @private
	 */
	_updateRoomState(newState) {
		if (!newState) return;
		const oldState = store.getState('room');

		store.dispatch({
			domain: 'room',
			type: actions.room.UPDATE_ROOM,
			payload: {
				...newState,
				id: this._roomId
			}
		});

		// Ensure game canvas is ready when transitioning to PLAYING state
		if (oldState.state !== newState.state && newState.state === RoomStates.PLAYING)
			this._ensureGameCanvasReady();
	}

	_ensureGameCanvasReady() {
		const canvas = document.querySelector('#game-container .screen #game');
		if (!canvas) {
			logger.error('Game canvas not found during transition to PLAYING state');
			return;
		}

		if (canvas.width !== GameRules.CANVAS_WIDTH || canvas.height !== GameRules.CANVAS_HEIGHT) {
			canvas.width = GameRules.CANVAS_WIDTH;
			canvas.height = GameRules.CANVAS_HEIGHT;
		}
	}

	/**
	 * Handles room errors and navigation
	 * @private
	 */
	_handleRoomError(error) {
		// Only handle error if we haven't already been destroyed
		if (!this._isDestroyed) {
			this._isDestroyed = true;  // Mark as destroyed first to prevent further error handling

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
	}

	/**
	 * Connect to the room's connections
	 */
	async connect() {
		try {
			const connection = await this._connectionManager.connect();
			if (connection && !this._isDestroyed) {
				// Don't try to get initial state if we have an error
				const roomState = store.getState('room');
				if (!roomState.error) {
					await this.setupInitialState();
					logger.info('[Room] Connected to room');
					return connection;
				}
			}
			return null;
		} catch (error) {
			// Only log the error if we haven't been destroyed
			if (!this._isDestroyed) {
				logger.error('[Room] Failed to connect to room:', error);
				this._handleRoomError(error);
			}
			throw error;
		}
	}

	/**
	 * Get initial room state through WebSocket
	 */
	async setupInitialState() {
		try {
			// Check if we have an error before attempting to get state
			const roomState = store.getState('room');
			if (roomState.error) {
				logger.warn('[Room] Not getting initial state due to existing error');
				return;
			}

			const newState = await this._connectionManager.getCurrentState();
			if (newState) {
				logger.info('[Room] Initial room state:', newState);
				this._updateRoomState(newState);
			}
		} catch (error) {
			logger.error('[Room] Failed to get initial room state:', error);
			throw error;
		}
	}

	async startGame() {
		try {
			const roomState = store.getState('room');
			if (roomState.state !== RoomStates.LOBBY) {
				throw new Error('Cannot start game: Room not in LOBBY state');
			}

			// Clear any existing error state
			store.dispatch({
				domain: 'room',
				type: actions.room.CLEAR_ERROR,
				payload: null
			});

			// Let the server handle validation and game creation
			await this._connectionManager.startGame();
		} catch (error) {
			logger.error('[Room] Failed to start game:', error);

			// Determine appropriate error message based on room state
			const roomState = store.getState('room');
			let errorMessage = 'Failed to start game';
			let errorCode = 'GAME_CREATE_ERROR';

			if ((roomState.mode !== RoomModes.AI || roomState.mode !== RoomModes.LOCAL)
				&& roomState.players.length < 2) {
				errorMessage = 'Cannot start game: Not enough players';
				errorCode = 'PLAYER_COUNT_ERROR';
			} else if (error.message.includes('validation')) {
				errorMessage = 'Cannot start game: Invalid game settings';
				errorCode = 'VALIDATION_ERROR';
			}

			// Set error state with appropriate message
			store.dispatch({
				domain: 'room',
				type: actions.room.SET_ERROR,
				payload: {
					code: errorCode,
					message: errorMessage,
					timestamp: Date.now()
				}
			});

			this._handleGameFailure(error);
			throw error;
		}
	}

	async leaveGame() {
		logger.info('[Room] Leaving game');
		try {
			await this._connectionManager.leaveGame();
			if (this._gameManager.isGameInProgress()) {
				this._gameManager.cleanup();
			}
		} catch (error) {
			logger.error('[Room] Failed to leave game:', error);
			this._handleGameFailure(error);
		}
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
		try {
			if (!event || !event.target || !event.target.value) {
				logger.error('[Room] Invalid mode change event:', event);
				return;
			}

			const newMode = event.target.value;
			if (!Object.values(RoomModes).includes(newMode)) {
				logger.error('[Room] Invalid mode value:', newMode);
				return;
			}

			// Clear any existing error state
			store.dispatch({
				domain: 'room',
				type: actions.room.CLEAR_ERROR,
				payload: null
			});

			logger.info('[Room] Changing mode to:', newMode);
			await this._connectionManager.updateMode(newMode);

			// Clear error state again after mode change is complete
			store.dispatch({
				domain: 'room',
				type: actions.room.CLEAR_ERROR,
				payload: null
			});
		} catch (error) {
			logger.error('[Room] Failed to change mode:', error);
			store.dispatch({
				domain: 'room',
				type: actions.room.SET_ERROR,
				payload: {
					code: 'MODE_CHANGE_ERROR',
					message: 'Failed to change game mode',
					timestamp: Date.now()
				}
			});
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

	async cancelInvitation(invitationId) {
		if (!this._isOwner(this._currentUser.id)) {
			logger.warn('[Room] Only room owner can cancel invitations');
			return;
		}

		try {
			await this._connectionManager.cancelInvitation(invitationId);
			// Update store to remove invitation
			const roomState = store.getState('room');
			if (roomState?.pendingInvitations) {
				this._updateRoomState({
					pendingInvitations: roomState.pendingInvitations.filter(inv => inv.id !== invitationId)
				});
			}
		} catch (error) {
			logger.error('[Room] Failed to cancel invitation:', error);
		}
	}

	_handleRoomMessage(data) {
		store.dispatch({
			domain: 'room',
			type: actions.room.SET_ERROR,
			payload: {
				code: 'ROOM_INFO',
				message: data.message,
				variant: data.message_type
			}
		});
		if (data.message.includes("win the tournament"))
		{
			let modalMessage = document.getElementById("modalMessage");
			let modalTitle = document.getElementById("messageModalLabel");

			if (document.querySelector('.modal-backdrop')) {
				document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
			}

			modalTitle.textContent = "Tournament";
			modalMessage.innerHTML = data.message;
			let messageModal = new bootstrap.Modal(document.getElementById("messageModal"));
			messageModal.show();
		}
	}

	destroy() {
		try {
			this._isDestroyed = true;

			logger.info('[Room] Destroyed 1 ');

			// Clean up managers in specific order
			if (this._gameManager) {
				logger.info('[Room] Destroyed 2');
				this._gameManager.destroy();
				this._gameManager = null;
			}
			if (this._uiManager) {
				logger.info('[Room] Destroyed 3 ');
				this._uiManager.destroy();
				this._uiManager = null;
			}
			if (this._connectionManager) {
				logger.info('[Room] Destroyed 4');
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
