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
export class Room {
	constructor(roomId) {
		if (!roomId) {
			throw new Error('Room ID is required');
		}

		this._store = Store.getInstance();
		this._roomId = roomId;

		// Get current user from store
		const userState = this._store.getState('user');
		this._currentUser = {
			id: userState.id,
			username: userState.username
		};

		// Initialize managers
		this._initializeManagers();
		this._setupEventHandlers();

		logger.info('Room initialized successfully:', {
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
			logger.warn('Network connection lost');
			this._stateManager.transitionToLobby();
		});

		this._networkManager.on('max_reconnect_attempts', () => {
			logger.error('Failed to reconnect to server');
			this._stateManager.transitionToLobby();
		});
	}

	async startGame() {
		try {
			// Update room state to PLAYING
			this._store.dispatch({
				domain: 'room',
				type: 'UPDATE_ROOM_STATE',
				payload: {
					state: RoomStates.PLAYING
				}
			});

			// Initialize game manager if needed
			if (!this._gameManager) {
				this._gameManager = createRoomGameManager(
					this._store,
					this._roomId,
					this._currentUser,
					this._networkManager
				);
			}

			await this._networkManager?.startGame();
		} catch (error) {
			logger.error('Failed to start game:', error);
			// Reset room state to LOBBY on error
			this._store.dispatch({
				domain: 'room',
				type: 'UPDATE_ROOM_STATE',
				payload: {
					state: RoomStates.LOBBY
				}
			});
		}
	}

	async updateSetting(setting, value) {
		try {
			this._store.dispatch({
				domain: 'room',
				type: 'UPDATE_ROOM_SETTINGS',
				payload: {
					settings: {
						[setting]: value
					}
				}
			});

			await this._networkManager?.updateSetting(setting, value);
		} catch (error) {
			logger.error('Failed to update setting:', error);
		}
	}

	async handleModeChange(event) {
		const newMode = event.target.value;
		try {
			// Update mode in store
			this._store.dispatch({
				domain: 'room',
				type: 'UPDATE_ROOM_MODE',
				payload: {
					mode: newMode
				}
			});

			// Reinitialize network manager for new mode
			await this._reinitializeNetworkManager(newMode);

			await this._networkManager?.updateMode(newMode);
		} catch (error) {
			logger.error('Failed to change mode:', error);
		}
	}

	async _reinitializeNetworkManager(mode) {
		// Clean up old network manager
		if (this._networkManager) {
			this._networkManager.destroy();
		}

		// Create new network manager
		this._networkManager = createRoomNetworkManager(
			this._store,
			this._roomId,
			mode === RoomModes.AI ? null : undefined
		);

		// Update game manager with new network manager
		this._gameManager.updateNetworkManager(this._networkManager);

		// Connect if needed
		if (mode !== RoomModes.AI) {
			await this._networkManager.connect();
		}
	}

	// Player management methods
	async kickPlayer(playerId) {
		try {
			this._store.dispatch({
				domain: 'room',
				type: 'UPDATE_PLAYERS',
				payload: {
					players: this._stateManager.players.filter(id => id !== playerId)
				}
			});

			await this._networkManager?.kickPlayer(playerId);
		} catch (error) {
			logger.error('Failed to kick player:', error);
		}
	}

	async inviteFriend(friendId) {
		if (!this._stateManager.availableSlots) {
			logger.warn('Room is full');
			return;
		}

		try {
			await this._networkManager.inviteFriend(friendId);
		} catch (error) {
			logger.error('Failed to invite friend:', error);
		}
	}

	async cancelInvitation(invitationId) {
		if (!this._stateManager.isOwner(this._currentUser.id)) {
			logger.warn('Only room owner can cancel invitations');
			return;
		}

		try {
			await this._networkManager.cancelInvitation(invitationId);
			this._stateManager.removeInvitation(invitationId);
		} catch (error) {
			logger.error('Failed to cancel invitation:', error);
		}
	}

	destroy() {
		this._networkManager?.destroy();
		this._gameManager?.destroy();
		this._uiManager?.destroy();
		this._stateManager?.destroy();

		this._store.dispatch({
			domain: 'room',
			type: 'LEAVE_ROOM',
			payload: {
				userId: this._currentUser.id
			}
		});
	}
}

// Factory function to create Room instance
export const createRoom = (roomId) => {
	return new Room(roomId);
}; 