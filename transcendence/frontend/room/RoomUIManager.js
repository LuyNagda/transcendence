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
		this._observers = [];

		if (!jaiPasVu.initialized)
			jaiPasVu.initialize(document.body);

		this._initializeReactiveState();

		// Bind methods to preserve context
		this.handleSettingChange = this.handleSettingChange.bind(this);
		this.handleModeChange = this.handleModeChange.bind(this);
	}

	_initializeReactiveState() {
		logger.info('[RoomUIManager] Initializing reactive state');

		logger.debug('Room state:', store.getState('room'));

		jaiPasVu.registerMethods('room', {
			kickPlayer: (playerId) => {
				logger.debug('Kick player called:', playerId);
				this._callHandler('kickPlayer', playerId);
			},
			cancelInvitation: (invitationId) => {
				logger.debug('Cancel invitation called:', invitationId);
				this._callHandler('cancelInvitation', invitationId);
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
			handleSettingChange: this.handleSettingChange,
			handleModeChange: this.handleModeChange
		});

		this._observers.push(
			store.subscribe('room', this._handleRoomStateUpdate.bind(this)),
		);
	}

	_handleRoomStateUpdate(state) {
		logger.debug('Room state update from store:', state);
		// Update the UI through JaiPasVu's reactivity
		jaiPasVu.registerData('room', {
			...state,
			mappedPlayers: function () {
				const players = state.players || [];
				const currentUserId = state.currentUser?.id;
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
				return state.owner?.id === state.currentUser?.id;
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
				return state.error?.message || '';
			},
			formatErrorTime: function () {
				if (!state.error?.timestamp) return '';
				const date = new Date(state.error.timestamp);
				return date.toLocaleTimeString();
			}
		});
	}

	_getMethods() {
		return {
			kickPlayer: (playerId) => {
				logger.debug('Kick player called:', playerId);
				this._callHandler('kickPlayer', playerId);
			},
			cancelInvitation: (invitationId) => {
				logger.debug('Cancel invitation called:', invitationId);
				this._callHandler('cancelInvitation', invitationId);
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
			handleSettingChange: this.handleSettingChange,
			handleModeChange: this.handleModeChange
		};
	}

	_getComputedProps() {
		return {
			mappedPlayers: function (state) {
				const players = state.players || [];
				const currentUserId = state.currentUser?.id;
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
				return state.owner?.id === state.currentUser?.id;
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

	setInviteFriendHandler(handler) {
		this._eventHandlers.set('inviteFriend', handler);
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

			const parsedValue = parseAsInt ? parseInt(value) : value;
			this._callHandler('settingChange', setting, parsedValue);
		} catch (error) {
			logger.error('Error in handleSettingChange:', error);
		}
	}

	handleModeChange(event) {
		try {
			logger.debug('Handling mode change:', event.target.value);
			this._callHandler('modeChange', event);
		} catch (error) {
			logger.error('Error in handleModeChange:', error);
		}
	}

	destroy() {
		logger.debug('[RoomUIManager] Destroying, cleanup #pong-room');
		jaiPasVu.cleanup(document.getElementById('pong-room'));
		this._eventHandlers.clear();
		// Call each unsubscribe function
		this._observers.forEach(unsubscribe => unsubscribe());
	}
}

// Factory function to create RoomUIManager instance
export const createRoomUIManager = (roomId) => {
	return new RoomUIManager(roomId);
};
