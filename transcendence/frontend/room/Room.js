import logger from '../logger.js';
import { RoomNetworkManager } from './RoomNetworkManager.js';
import { RoomStateManager } from './RoomStateManager.js';
import { RoomGameManager } from './RoomGameManager.js';
import { RoomUIManager } from './RoomUIManager.js';
import { AIService } from './AIService.js';
import Store from '../state/store.js';
import { RoomModes } from '../state/roomState.js';
import { UIService } from '../UI/UIService.js';

export class Room {
	static States = {
		LOBBY: 'LOBBY',
		PLAYING: 'PLAYING',
		FINISHED: 'FINISHED'
	};

	static Modes = RoomModes;

	static initializeFromDOM() {
		const roomElement = document.getElementById('pong-room');
		if (!roomElement) return null;

		try {
			const roomId = JSON.parse(document.getElementById("room-id").textContent);
			const currentUser = JSON.parse(document.getElementById("current-user-data").textContent);
			return new Room(roomId, currentUser);
		} catch (error) {
			logger.error('Failed to initialize room from DOM:', error);
			return null;
		}
	}

	constructor(roomId, currentUser) {
		if (!roomId) {
			throw new Error('Room ID is required');
		}

		// Initialize store
		this._store = Store.getInstance();

		// Get current user from store
		const userState = this._store.getState('user');
		this._currentUser = {
			id: userState.id,
			username: userState.username
		};

		// Initialize managers
		this._stateManager = new RoomStateManager(roomId);
		this._networkManager = new RoomNetworkManager(roomId);
		this._gameManager = new RoomGameManager(roomId, this._currentUser, this._networkManager);
		this._uiManager = new RoomUIManager(roomId, this._currentUser);

		// Initialize network manager and bind event handlers
		this._initializeNetworkManager();
		this._initializeUIHandlers();

		// Load AI models if needed
		this._loadAvailableAIModels();
	}

	async _initializeNetworkManager() {
		try {
			await this._networkManager.connect();

			this._networkManager.on('room_update', (data) => {
				this._stateManager.updateState(data.room_state);
				this._updateUI();
			});

			this._networkManager.on('game_started', async (data) => {
				try {
					await this._handleGameStarted(data);
				} catch (error) {
					logger.error("Error handling game start:", error);
					this._gameManager.handleGameFailure();
				}
			});

			this._networkManager.on('settings_update', (data) => {
				this._handleSettingsUpdate(data);
			});

		} catch (error) {
			logger.error('Failed to initialize network manager:', error);
		}
	}

	_initializeUIHandlers() {
		this._uiManager.setStartGameHandler(() => this.startGame());
		this._uiManager.setSettingChangeHandler((setting, value) => this.updateSetting(setting, value));
		this._uiManager.setKickPlayerHandler((playerId) => this.kickPlayer(playerId));
		this._uiManager.setCancelInvitationHandler((invitationId) => this.cancelInvitation(invitationId));
		this._uiManager.setModeChangeHandler((event) => this.changeMode(event));
	}

	async startGame() {
		if (this._gameManager.isGameInProgress()) {
			logger.warn('Game start already in progress');
			return;
		}

		try {
			this._gameManager.setGameInProgress(true);
			this._useWebGL = document.getElementById('webgl-toggle')?.checked || false;
			this._gameManager.setWebGL(this._useWebGL);

			await this._networkManager.startGame();

		} catch (error) {
			logger.error('Error starting game:', error);
			this._gameManager.handleGameFailure();
			UIService.showAlert('error', 'Failed to start game: ' + error.message);
		}
	}

	async _handleGameStarted(data) {
		const isHost = this._currentUser.id === data.player1_id;

		try {
			await this._gameManager.initializeAndStartGame(
				data.game_id,
				isHost,
				this._stateManager.settings
			);

			this._stateManager.updateState({ status: Room.States.PLAYING });
			this._updateUI();

		} catch (error) {
			logger.error("Failed to start game:", error);
			this._gameManager.handleGameFailure();
			throw error;
		}
	}

	async changeMode(event) {
		const newMode = event.target.value;
		if (!newMode || !Object.values(RoomModes).includes(newMode)) {
			return;
		}

		try {
			await this._networkManager.sendMessage('update_property', {
				property: 'mode',
				value: newMode
			});
		} catch (error) {
			logger.error('Failed to change mode:', error);
			UIService.showAlert('error', 'Failed to change game mode');
		}
	}

	async updateSetting(setting, value) {
		try {
			await this._networkManager.sendMessage('update_property', {
				property: 'settings',
				setting: setting,
				value: value
			});
		} catch (error) {
			logger.error(`Failed to update ${setting}:`, error);
			UIService.showAlert('error', `Failed to update ${setting}`);
		}
	}

	_handleSettingsUpdate(data) {
		if (data.setting && data.value !== undefined) {
			this._stateManager.updateSettings({ [data.setting]: data.value });
		} else if (data.settings) {
			this._stateManager.updateSettings(data.settings);
		}
		this._updateUI();
	}

	inviteFriend(friendId) {
		this._networkManager.sendMessage("invite_friend", { friend_id: friendId });
	}

	cancelInvitation(invitationId) {
		this._networkManager.sendMessage("cancel_invitation", { invitation_id: invitationId });
	}

	kickPlayer(playerId) {
		this._networkManager.sendMessage("kick_player", { player_id: playerId });
	}

	async _loadAvailableAIModels() {
		const select = document.getElementById('aiDifficulty');
		if (select) {
			await AIService.updateAIModelSelect(select);
		}
	}

	_updateUI() {
		const state = {
			...this._stateManager._state,
			startGameInProgress: this._gameManager.isGameInProgress(),
			canStartGame: this._stateManager.canStartGame()
		};
		this._uiManager.updateUI(state);
	}

	destroy() {
		this._gameManager.destroy();
		this._networkManager.destroy();
		this._uiManager.destroy();
	}
} 