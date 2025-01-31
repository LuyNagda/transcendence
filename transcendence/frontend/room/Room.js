import logger from '../logger.js';
import { store } from '../state/store.js';
import { RoomModes, RoomStates } from '../state/roomState.js';
import { createRoomStateManager } from './RoomStateManager.js';
import { createRoomUIManager } from './RoomUIManager.js';
import { createRoomGameManager } from './RoomGameManager.js';
import { createRoomConnectionManager } from './RoomConnectionManager.js';

/**
 * Main Room class that coordinates between different managers
 */
export default class Room {
	constructor(roomId) {
		if (!roomId)
			throw new Error('Room ID is required');

		this._roomId = roomId;

		const userState = store.getState('user');
		this._currentUser = {
			id: userState.id,
			username: userState.username
		};

		this._initializeManagers();
		this._setupEventHandlers();

		logger.info('[Room] Room initialized successfully:', {
			roomId: this._roomId,
			user: this._currentUser
		});
	}

	_initializeManagers() {
		// Initialize state manager first
		this._stateManager = createRoomStateManager(this._roomId);

		// Initialize connection manager with appropriate configuration based on room mode
		const mode = this._stateManager.getMode();
		const connectionConfig = this._createConnectionConfig(mode);
		this._connectionManager = createRoomConnectionManager(this._roomId, connectionConfig);

		// Initialize UI manager
		this._uiManager = createRoomUIManager(
			this._roomId,
			this._currentUser
		);

		// Initialize game manager with the game connection if available
		const gameConnection = this._connectionManager.getGameConnection();
		this._gameManager = createRoomGameManager(
			this._roomId,
			this._currentUser,
			gameConnection
		);
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
				iceServers: [
					{ urls: 'stun:stun.l.google.com:19302' }
				],
				// Add any additional WebRTC configuration here
				iceTransportPolicy: 'all',
				bundlePolicy: 'balanced'
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
		mainConnection.on('game_started', (data) => {
			this._stateManager.handleGameStarted(data);
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
	 * Connect to the room's connections
	 */
	async connect() {
		try {
			await this._connectionManager.connect();
		} catch (error) {
			logger.error('[Room] Failed to connect to room:', error);
			throw error;
		}
	}

	/**
	 * Get initial room state through WebSocket
	 */
	async getInitialState() {
		try {
			const roomState = await this._connectionManager.getCurrentState();
			this._stateManager.updateState(roomState);
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
		this._connectionManager.destroy();
		this._gameManager.destroy();
		this._uiManager.destroy();
		this._stateManager.destroy();

		store.dispatch({
			domain: 'room',
			type: 'LEAVE_ROOM',
			payload: {
				userId: this._currentUser.id
			}
		});
	}
}
