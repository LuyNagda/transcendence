import dynamicRender from '../UI/dynamic_render.js';
import logger from '../logger.js';
import { RoomModes, RoomStatus } from '../state/roomState.js';
import Store from '../state/store.js';

export class RoomUIManager {
	constructor(roomId, currentUser) {
		this._store = Store.getInstance();
		this._roomId = roomId;
		this._currentUser = currentUser;
		this._state = {};
		this._initializeEventHandlers();
		this._initializeStoreSubscription();
		this._initializeGameContainer();
	}

	updateUI(state) {
		const previousStatus = this._state.status;
		this._state = state;

		// Update game container if status changed
		if (previousStatus !== state.status) {
			this.updateGameContainer(state.status);
		}

		dynamicRender.addObservedObject('pongRoom', this._getPublicState());
		dynamicRender.scheduleUpdate();
	}

	_initializeEventHandlers() {
		document.addEventListener('click', (event) => {
			if (event.target?.id === 'startGameBtn') {
				this.onStartGameClick && this.onStartGameClick();
			}
		});

		// Add global handler for select elements
		window.handleSettingChange = (element, setting, parseAsInt) => {
			const value = parseAsInt ? parseInt(element.value) : element.value;
			this.onSettingChange && this.onSettingChange(setting, value);
		};
	}

	_initializeStoreSubscription() {
		// Subscribe to user state changes
		this._unsubscribeUser = this._store.subscribe('user', (userState) => {
			this._currentUser = {
				id: userState.id,
				username: userState.username
			};
			// Update UI with new user data
			this.updateUI(this._state);
		});
	}

	_getPublicState() {
		const isOwner = this._state.owner?.id === this._currentUser.id;

		return {
			mode: this._state.mode,
			state: this._state.status,
			owner: this._state.owner,
			players: this._state.players,
			pendingInvitations: this._state.pendingInvitations,
			maxPlayers: this._state.maxPlayers,
			currentUser: this._currentUser,
			availableSlots: this._getAvailableSlots(),
			canStartGame: this._state.canStartGame,
			isOwner: isOwner,
			settings: {
				...this._state.settings,
				mode: this._state.mode,
				maxScore: parseInt(this._state.settings?.maxScore) || 11
			},
			gameStarted: this._state.status === RoomStatus.GAME_IN_PROGRESS,
			startGameInProgress: this._state.startGameInProgress,
			isLobbyState: this._state.status === RoomStatus.ACTIVE,
			isFinishedState: this._state.status === RoomStatus.FINISHED,
			buttonText: this._getButtonText(),
			handleSettingChange: (setting, value, parseAsInt) => {
				if (this._state.status !== RoomStatus.GAME_IN_PROGRESS) {
					const parsedValue = parseAsInt ? parseInt(value) : value;
					this.onSettingChange && this.onSettingChange(setting, parsedValue);
				}
			},
			kickPlayer: (playerId) => this.onKickPlayer && this.onKickPlayer(playerId),
			cancelInvitation: (invitationId) => this.onCancelInvitation && this.onCancelInvitation(invitationId),
			changeMode: (event) => this.onModeChange && this.onModeChange(event),
			getProgressBarStyle: this._getProgressBarStyle.bind(this)
		};
	}

	_getAvailableSlots() {
		const playerCount = this._state.players?.length || 0;
		const invitationCount = this._state.pendingInvitations?.length || 0;
		return (this._state.maxPlayers || 0) - playerCount - invitationCount;
	}

	_getButtonText() {
		if (this._state.startGameInProgress) return 'Starting...';
		if (this._state.status === RoomStatus.FINISHED) return 'Start a new game';
		return 'Start Game';
	}

	_getProgressBarStyle(value) {
		const numericValue = parseInt(value) || 1;
		let percentage;

		if (value === this._state.settings?.paddleSize) {
			percentage = numericValue * 10;  // Convert 1-10 to 10-100%
		} else {
			const clampedValue = Math.max(1, Math.min(10, numericValue));
			percentage = clampedValue * 10;
		}

		return {
			width: `${percentage}%`,
			transition: 'width 0.3s ease'
		};
	}

	destroy() {
		window.handleSettingChange = undefined;
		if (this._unsubscribeUser) {
			this._unsubscribeUser();
		}
	}

	// Event handler setters
	setStartGameHandler(handler) {
		this.onStartGameClick = handler;
	}

	setSettingChangeHandler(handler) {
		this.onSettingChange = handler;
	}

	setKickPlayerHandler(handler) {
		this.onKickPlayer = handler;
	}

	setCancelInvitationHandler(handler) {
		this.onCancelInvitation = handler;
	}

	setModeChangeHandler(handler) {
		this.onModeChange = handler;
	}

	_initializeGameContainer() {
		const gameContainer = document.querySelector('#game-container');
		if (!gameContainer) {
			logger.warn('Game container not found during initialization');
			return;
		}

		// Find the screen element where we'll show messages
		const screen = gameContainer.querySelector('.screen');
		if (screen) {
			this._showLobbyMessage(screen);
		} else {
			logger.warn('Screen element not found in game container');
		}
	}

	_showLobbyMessage(screen) {
		const messageDiv = document.createElement('div');
		messageDiv.className = 'text-center p-4 game-message';
		messageDiv.innerHTML = '<h4>Welcome to the Game Room!</h4><p>Click Start Game when ready.</p>';

		// Remove any existing messages
		const existingMessage = screen.querySelector('.game-message');
		if (existingMessage) {
			existingMessage.remove();
		}

		screen.appendChild(messageDiv);
	}

	_showGameFinishedMessage(screen) {
		const messageDiv = document.createElement('div');
		messageDiv.className = 'text-center p-4 game-message';
		messageDiv.innerHTML = '<h4>Game Finished!</h4><p>Start another game when ready.</p>';

		// Remove any existing messages
		const existingMessage = screen.querySelector('.game-message');
		if (existingMessage) {
			existingMessage.remove();
		}

		screen.appendChild(messageDiv);
	}

	updateGameContainer(status) {
		const gameContainer = document.querySelector('#game-container');
		if (!gameContainer) return;

		const screen = gameContainer.querySelector('.screen');
		if (!screen) {
			logger.warn('Screen element not found in game container');
			return;
		}

		// Clear any existing messages
		const existingMessage = screen.querySelector('.game-message');
		if (existingMessage) {
			existingMessage.remove();
		}

		switch (status) {
			case RoomStatus.ACTIVE:
				this._showLobbyMessage(screen);
				break;
			case RoomStatus.FINISHED:
				this._showGameFinishedMessage(screen);
				break;
			case RoomStatus.GAME_IN_PROGRESS:
				// Screen is ready for game canvas
				break;
		}
	}
} 