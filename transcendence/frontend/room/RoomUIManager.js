import jaiPasVu from '../UI/JaiPasVu.js';
import logger from '../logger.js';
import { RoomStates, RoomModes } from '../state/roomState.js';
import Store from '../state/store.js';

/**
 * Manages the UI state and interactions for a room using JaiPasVu's reactivity system
 */
export class RoomUIManager {
	constructor(store, roomId, currentUser) {
		this._store = store || Store.getInstance();
		this._roomId = roomId;
		this._currentUser = currentUser;
		this._eventHandlers = new Map();

		if (!jaiPasVu.initialized)
			jaiPasVu.initialize(document.body);

		this._initializeReactiveState();

		// Bind methods to preserve context
		this.handleSettingChange = this.handleSettingChange.bind(this);
		this.handleModeChange = this.handleModeChange.bind(this);
	}

	_initializeReactiveState() {
		const roomState = this._store.getState('room');
		const userState = this._store.getState('user');
		logger.debug('Initializing reactive state with:', { roomState, userState });

		// Register methods that will be available in the template
		const methods = {
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
			getCurrentUser: () => this._currentUser || this._store.getState('user'),
			toggleInviteModal: () => this._toggleInviteModal(),
			handleSettingChange: this.handleSettingChange,
			handleModeChange: this.handleModeChange
		};

		this._registerReactiveState(roomState, userState, methods);
		// this._initializeStoreSubscription();
	}

	_registerReactiveState(roomState, userState, methods) {
		// Ensure roomState is not null/undefined
		const safeRoomState = roomState || {};

		// Initialize base state with default values
		const baseState = {
			id: safeRoomState.id || '',
			settings: safeRoomState.settings || {},
			players: safeRoomState.players || [],
			state: safeRoomState.state || RoomStates.LOBBY,
			currentUser: this._currentUser || {},
			mode: (safeRoomState.settings && safeRoomState.settings.mode) || 'AI',
			maxPlayers: (safeRoomState.settings && safeRoomState.settings.maxPlayers) || 2,
			pendingInvitations: safeRoomState.pendingInvitations || []
		};

		// Define computed properties
		const computedProps = {
			availableSlots(state) {
				return Math.max(0, state.maxPlayers - (state.players?.length || 0));
			},
			isOwner(state) {
				return state.players?.some(p => p.id === state.currentUser?.id && p.isOwner) || false;
			},
			isLobbyState(state) {
				return state.state === RoomStates.LOBBY;
			},
			buttonText(state) {
				return state.state === RoomStates.LOBBY ? 'Start Game' : 'Game in Progress';
			},
			startGameInProgress(state) {
				return state.state !== RoomStates.LOBBY;
			},
			mappedPlayers(state) {
				return (state.players || []).map(player => ({
					...player,
					isCurrentUser: player.id === state.currentUser?.id,
					isOwner: player.isOwner || false,
					canBeKicked: !player.isOwner && this.isOwner
				}));
			},
			gameContainerClass(state) {
				return {
					'game-container': true,
					'loading': state.isLoading,
					'error': state.error,
					'lobby': state.state === RoomStates.LOBBY,
					'playing': state.state === RoomStates.PLAYING
				};
			}
		};

		// Register with JaiPasVu
		jaiPasVu.registerData('room', {
			...baseState,
			...methods
		}, computedProps);

		// Register hooks for UI updates
		jaiPasVu.on('beforeUpdate', () => {
			logger.debug('Room UI updating...');
		});

		jaiPasVu.on('updated', () => {
			logger.debug('Room UI updated');
		});

		logger.debug('Registered reactive state:', {
			baseState,
			computedProps: Object.keys(computedProps)
		});
	}

	_toggleInviteModal() {
		const state = jaiPasVu.getState('room');
		jaiPasVu.setValueByPath(state, 'showInviteModal', !state.showInviteModal);
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

	// _initializeStoreSubscription() {
	// 	// Subscribe to room state changes
	// 	this._store.subscribe('room', (state, type) => {
	// 		logger.debug('Room state updated:', state);
	// 		// Update JaiPasVu state
	// 		const currentState = jaiPasVu.getState('room');
	// 		Object.entries(state).forEach(([key, value]) => {
	// 			if (currentState[key] !== value) {
	// 				jaiPasVu.setValueByPath(currentState, key, value);
	// 			}
	// 		});
	// 	});

	// 	// Subscribe to user state changes
	// 	this._store.subscribe('user', (state, type) => {
	// 		logger.debug('User state updated:', state);
	// 		this._currentUser = state;
	// 		// Update currentUser in room state
	// 		const roomState = jaiPasVu.getState('room');
	// 		jaiPasVu.setValueByPath(roomState, 'currentUser', state);
	// 	});
	// }

	handleSettingChange(setting, value, parseAsInt = false) {
		try {
			logger.debug('Handling setting change:', { setting, value, parseAsInt });
			const roomState = jaiPasVu.getState('room');

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
		jaiPasVu.cleanup(document.getElementById('pong-room'));
		this._eventHandlers.clear();
		this._store.unsubscribe('room');
	}
}

// Factory function to create RoomUIManager instance
export const createRoomUIManager = (store, roomId, currentUser) => {
	return new RoomUIManager(store, roomId, currentUser);
};
