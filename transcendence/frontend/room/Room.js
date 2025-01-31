import logger from '../logger.js';
import Store from '../state/store.js';
import { RoomModes, RoomStates } from '../state/roomState.js';
import { createRoomStateManager } from './RoomStateManager.js';
import { createRoomUIManager } from './RoomUIManager.js';
import { createRoomGameManager } from './RoomGameManager.js';
import { createRoomNetworkManager } from './RoomNetworkManager.js';

/**
 * Main Room class that coordinates between different managers
 */
export default class Room {
	constructor(roomId) {
		if (!roomId)
			throw new Error('Room ID is required');

		this._store = Store.getInstance();
		this._roomId = roomId;

		const userState = this._store.getState('user');
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
		this._stateManager = createRoomStateManager(this._store, this._roomId);

		// Initialize network manager based on mode
		this._networkManager = createRoomNetworkManager(
			this._store,
			this._roomId,
			this._stateManager.mode === RoomModes.AI ? null : undefined
		);

		// Initialize UI manager
		this._uiManager = createRoomUIManager(
			this._store,
			this._roomId,
			this._currentUser
		);

		// Initialize game manager
		this._gameManager = createRoomGameManager(
			this._store,
			this._roomId,
			this._currentUser,
			this._networkManager
		);
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

		// Set up network event handlers
		this._networkManager.on('disconnected', () => {
			logger.warn('[Room] Network connection lost');
			this._stateManager.transitionToLobby();
		});

		this._networkManager.on('max_reconnect_attempts', () => {
			logger.error('[Room] Failed to reconnect to server');
			this._stateManager.transitionToLobby();
		});

		// Handle room update events
		this._networkManager.on('room_update', (data) => {
			logger.debug('[Room] Received room update:', data);
			if (data.room_state) {
				this._stateManager.updateState(data.room_state);
			}
		});

		// Handle settings update events
		this._networkManager.on('settings_update', (data) => {
			logger.debug('[Room] Received settings update:', data);
			if (data.setting && data.value) {
				this._stateManager.updateSettings({
					[data.setting]: data.value
				});
			}
		});

		// Handle mode change events
		this._networkManager.on('mode_change', (data) => {
			logger.debug('[Room] Received mode change:', data);
			if (data.mode) {
				this._stateManager.updateMode(data.mode);
			}
		});

		// Handle game started event
		this._networkManager.on('game_started', (data) => {
			this._stateManager.handleGameStarted(data);
		});
	}

	/**
	 * Connect to the room's WebSocket
	 */
	async connect() {
		try {
			await this._networkManager.connect();

			// Get initial state after connection
			const roomState = await this._networkManager.getCurrentState();
			this._stateManager.updateState(roomState);
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
			const roomState = await this._networkManager.getCurrentState();
			this._stateManager.updateState(roomState);
			logger.info('Received initial room state');
		} catch (error) {
			logger.error('[Room] Failed to get initial room state:', error);
			throw error;
		}
	}

	async startGame() {
		try {
			await this._networkManager.startGame();
		} catch (error) {
			logger.error('[Room] Failed to start game:', error);
			throw error;
		}
	}

	async leaveGame() {
		logger.info('[Room] Leaving game');
		await this._networkManager.leaveGame();
	}

	async updateSetting(setting, value) {
		try {
			await this._networkManager.updateSetting(setting, value);
		} catch (error) {
			logger.error('[Room] Failed to update setting:', error);
			throw error;
		}
	}

	async handleModeChange(event) {
		const newMode = event.target.value;
		try {
			await this._networkManager.updateMode(newMode);
		} catch (error) {
			logger.error('[Room] Failed to change mode:', error);
		}
	}

	// Player management methods
	async kickPlayer(playerId) {
		try {
			await this._networkManager.kickPlayer(playerId);
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
			await this._networkManager.inviteFriend(friendId);
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
			await this._networkManager.cancelInvitation(invitationId);
			this._stateManager.removeInvitation(invitationId);
		} catch (error) {
			logger.error('[Room] Failed to cancel invitation:', error);
		}
	}

	destroy() {
		this._networkManager.destroy();
		this._gameManager.destroy();
		this._uiManager.destroy();
		this._stateManager.destroy();

		this._store.dispatch({
			domain: 'room',
			type: 'LEAVE_ROOM',
			payload: {
				userId: this._currentUser.id
			}
		});
	}
}
