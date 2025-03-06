import jaiPasVu from '../UI/JaiPasVu.js';
import logger from '../logger.js';
import { RoomStates } from '../state/roomState.js';
import { store, actions } from '../state/store.js';

/**
 * Manages the UI state and interactions for a room using JaiPasVu's reactivity system
 */
export class RoomUIManager {
	constructor(roomId) {
		this._roomId = roomId;
		this._eventHandlers = new Map();
		this._settingChangeTimeout = null;

		if (!jaiPasVu.initialized)
			jaiPasVu.initialize(document.body);

		this._initializeReactiveState();

		// Bind methods to preserve context
		this.handleSettingChange = this.handleSettingChange.bind(this);
		this.handleModeChange = this.handleModeChange.bind(this);
		this.handleWebGLToggle = this.handleWebGLToggle.bind(this);
	}


	handleWebGLToggle(event) {
		const useWebGL = event.target.checked;
		logger.info('[RoomUIManager] WebGL toggle changed:', useWebGL);

		store.dispatch({
			domain: 'room',
			type: actions.room.TOGGLE_WEBGL,
			payload: { useWebGL }
		});

		// If game is in progress, update the renderer
		const roomState = store.getState('room');
		if (roomState.state === RoomStates.PLAYING && this._gameManager) {
			this._callHandler('webglToggle', useWebGL);
		}
	}

	_initializeReactiveState() {
		logger.info('[RoomUIManager] Initializing reactive state');

		logger.debug('Room state:', store.getState('room'));

		jaiPasVu.registerMethods('room', {
			kickPlayer: (playerId) => {
				if (!playerId || playerId === '') {
					logger.error('Invalid player ID for kick:', playerId);
					return;
				}
				logger.debug('Kick player called with ID:', playerId);
				this._callHandler('kickPlayer', playerId);
			},
			cancelInvitation: (playerId) => {
				if (!playerId || playerId === '') {
					logger.error('Invalid invitation ID for cancel:', playerId);
					return;
				}
				logger.debug('Cancel invitation called with ID:', playerId);
				this._callHandler('cancelInvitation', playerId);
			},
			startGame: () => {
				logger.debug('Start game called');
				this._callHandler('startGame');
			},
			leaveGame: () => {
				logger.debug('Leave game called');
				this._callHandler('leaveGame');
			},
			getCurrentUser: () => store.getState('user'),
			toggleInviteModal: () => this._toggleInviteModal(),
			handleSettingChange: (event) => {
				const setting = event.target.dataset.setting;
				const value = event.target.value;
				const parseAsInt = event.target.type === 'range' || event.target.type === 'number';
				this.handleSettingChange(setting, value, parseAsInt);
			},
			handleModeChange: (event) => {
				if (!event || !event.target) {
					logger.error('Invalid mode change event:', event);
					return;
				}
				logger.debug('Handling mode change:', event.target.value);
				this._callHandler('modeChange', event);
			},
			getProgressBarStyle: (value, settingType) => {
				const getColorForPaddleSettings = (value) => {
					if (value >= 7) return '#28a745';  // Green
					if (value >= 5) return '#ffc107';  // Yellow
					if (value >= 3) return '#fd7e14';  // Orange
					return '#dc3545';                  // Red
				};

				const getColorForBallSpeed = (value) => {
					if (value >= 8) return '#dc3545';  // Red
					if (value >= 6) return '#fd7e14';  // Orange
					if (value >= 4) return '#ffc107';  // Yellow
					return '#28a745';                  // Green
				};

				const width = `${value * 10}%`;
				let backgroundColor;

				switch (settingType) {
					case 'paddleSize':
					case 'paddleSpeed':
						backgroundColor = getColorForPaddleSettings(value);
						break;
					case 'ballSpeed':
						backgroundColor = getColorForBallSpeed(value);
						break;
					default:
						backgroundColor = '#ffc107';  // Default yellow for value 5
				}

				return {
					width,
					backgroundColor
				};
			}
		});

		store.subscribe('room', this._handleRoomStateUpdate.bind(this));
	}

	_handleRoomStateUpdate(state) {
		logger.debug('Room state update from store:', state);
		// Update the UI through JaiPasVu's reactivity
		jaiPasVu.registerData('room', {
			...state,
			mappedPlayers: function () {
				const players = state.players || [];
				const currentUserId = store.getState('user').id;
				return players.map(player => ({
					...player,
					isCurrentUser: player.id === currentUserId,
					isOwner: player.id === state.owner?.id,
					canBeKicked: player.id !== state.owner?.id && state.owner?.id === currentUserId
				}));
			},
			availableSlots: function () {
				return Math.max(0, state.maxPlayers - (state.players?.length || 0));
			},
			isOwner: function () {
				return state.owner?.id === store.getState('user').id;
			},
			isLobbyState: function () {
				return state.state === RoomStates.LOBBY;
			},
			buttonText: function () {
				return state.state === RoomStates.LOBBY ? 'Start Game' : 'Game in Progress';
			},
			startGameInProgress: function () {
				return state.state !== RoomStates.LOBBY;
			},
			gameContainerClass: function () {
				return {
					'game-container': true,
					'loading': state.isLoading,
					'error': state.error,
					'lobby': state.state === RoomStates.LOBBY,
					'playing': state.state === RoomStates.PLAYING
				};
			},
			hasError: function () {
				return !!state.error;
			},
			errorMessage: function () {
				if (!state.error) return '';
				const code = state.error.code || 'UNKNOWN_ERROR';
				const message = state.error.message || 'An unknown error occurred';
				return `${code}: ${message}`;
			},
			errorType: function () {
				if (!state.error) return 'danger';
				const code = state.error.code;
				// Handle numeric codes (4000-4999) as warnings
				if (typeof code === 'number' && code >= 4000 && code < 5000) return 'warning';
				// Handle specific string codes
				switch (code) {
					case 'CONNECTION_LOST':
					case 'CONNECTION_ERROR':
					case 'PLAYER_COUNT_ERROR':
					case 'PLAYER_KICKED':
						return 'warning';
					case 'VALIDATION_ERROR':
					case 'INITIALIZATION_ERROR':
					case 'GAME_CREATE_ERROR':
					case 'GAME_CONNECTION_ERROR':
						return 'danger';
					case 'ROOM_INFO':
						return 'info'
					default:
						return 'danger';
				}
			},
			formatErrorTime: function () {
				if (!state.error?.timestamp) return '';
				const date = new Date(state.error.timestamp);
				return date.toLocaleTimeString();
			}
		});
	}

	_getComputedProps() {
		return {
			mappedPlayers: function (state) {
				const players = state.players || [];
				const currentUserId = store.getState('user').id;
				return players.map(player => ({
					...player,
					isCurrentUser: player.id === currentUserId,
					isOwner: player.id === state.owner?.id,
					canBeKicked: player.id !== state.owner?.id && state.owner?.id === currentUserId
				}));
			},
			availableSlots: function (state) {
				return Math.max(0, state.maxPlayers - (state.players?.length || 0));
			},
			isOwner: function (state) {
				return state.owner?.id === store.getState('user').id;
			},
			isLobbyState: function (state) {
				return state.state === RoomStates.LOBBY;
			},
			buttonText: function (state) {
				return state.state === RoomStates.LOBBY ? 'Start Game' : 'Game in Progress';
			},
			startGameInProgress: function (state) {
				return state.state !== RoomStates.LOBBY;
			},
			gameContainerClass: function (state) {
				return {
					'game-container': true,
					'loading': state.isLoading,
					'error': state.error,
					'lobby': state.state === RoomStates.LOBBY,
					'playing': state.state === RoomStates.PLAYING
				};
			}
		};
	}

	_toggleInviteModal() {
		const roomState = store.getState('room');
		logger.info('[RoomUIManager] Toggling invite modal', roomState);
		store.dispatch({
			domain: 'room',
			type: actions.room.UPDATE_ROOM,
			payload: { showInviteModal: !roomState.showInviteModal }
		});
	}

	// Event Handler Registration
	setStartGameHandler(handler) {
		this._eventHandlers.set('startGame', handler);
	}

	setSettingChangeHandler(handler) {
		this._eventHandlers.set('settingChange', handler);
	}

	setKickPlayerHandler(handler) {
		this._eventHandlers.set('kickPlayer', handler);
	}

	setCancelInvitationHandler(handler) {
		this._eventHandlers.set('cancelInvitation', handler);
	}

	setModeChangeHandler(handler) {
		this._eventHandlers.set('modeChange', handler);
	}

	setWebGLToggleHandler(handler) {
		this._eventHandlers.set('webglToggle', handler);
	}

	_callHandler(handlerName, ...args) {
		const handler = this._eventHandlers.get(handlerName);
		if (handler) {
			try {
				handler(...args);
			} catch (error) {
				logger.error(`Error in ${handlerName} handler:`, error);
			}
		}
	}

	handleSettingChange(setting, value, parseAsInt = false) {
		try {
			logger.debug('Handling setting change:', { setting, value, parseAsInt });
			const roomState = store.getState('room');

			if (roomState.state === RoomStates.PLAYING) {
				logger.warn('Cannot change settings while game is in progress');
				return;
			}

			if (!setting || value === undefined) {
				logger.warn('Invalid setting change parameters:', { setting, value });
				return;
			}

			// Debounce the setting change
			if (this._settingChangeTimeout)
				clearTimeout(this._settingChangeTimeout);
			this._settingChangeTimeout = setTimeout(() => {
				const parsedValue = parseAsInt ? parseInt(value, 10) : value;
				this._callHandler('settingChange', setting, parsedValue);
				this._settingChangeTimeout = null;
			}, 100); // 100ms debounce
		} catch (error) {
			logger.error('Error in handleSettingChange:', error);
		}
	}

	handleModeChange(event) {
		try {
			if (!event || !event.target || typeof event.target.value === 'undefined') {
				logger.error('Invalid mode change event:', event);
				return;
			}

			// Clear any existing error state when mode changes
			store.dispatch({
				domain: 'room',
				type: actions.room.CLEAR_ERROR,
				payload: null
			});

			const newMode = event.target.value;
			logger.debug('Handling mode change:', newMode);
			this._callHandler('modeChange', event);
		} catch (error) {
			logger.error('Error in handleModeChange:', error);
		}
	}

	destroy() {
		logger.info('[RoomUIManager] Destroying UI manager');

		// Clean up event handlers
		this._eventHandlers.clear();

		if (this._settingChangeTimeout) {
			clearTimeout(this._settingChangeTimeout);
			this._settingChangeTimeout = null;
		}
	}
}

// Factory function to create RoomUIManager instance
export const createRoomUIManager = (roomId) => {
	return new RoomUIManager(roomId);
};
