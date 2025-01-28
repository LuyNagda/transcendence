import javaisPasVu from '../UI/JavaisPasVu.js';
import logger from '../logger.js';
import { RoomStates, RoomModes } from '../state/roomState.js';
import Store from '../state/store.js';

/**
 * Manages the UI state and interactions for a room
 */
export class RoomUIManager {
	constructor(store, roomId, currentUser) {
		this._store = store || Store.getInstance();
		this._roomId = roomId;
		this._currentUser = currentUser;
		this._eventHandlers = new Map();
		this._uiState = {
			isLoading: false,
			error: null,
			activeTab: 'game',
			showInviteModal: false
		};

		if (!javaisPasVu.initialized)
			javaisPasVu.initialize(document.body);

		// Initialize room state and UI
		this._initializeRoomState();

		this.handleSettingChange = this.handleSettingChange.bind(this);
		this.handleModeChange = this.handleModeChange.bind(this);
	}

	_initializeRoomState() {
		// Get initial state
		const roomState = this._store.getState('room');
		const userState = this._store.getState('user');
		logger.debug('Initializing room state with:', roomState);
		logger.debug('Initializing user state with:', userState);

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
			getCurrentUser: () => {
				return this._currentUser || this._store.getState('user');
			}
		};

		// Process and update the room state
		this._processRoomState(roomState, methods);

		// Initialize store subscription for both room and user state
		this._initializeStoreSubscription();
	}

	_processRoomState(roomState, methods = {}) {
		// Get existing methods to preserve them
		const existingMethods = javaisPasVu.methods.get('room') || {};

		// Ensure roomState is not null/undefined
		const safeRoomState = roomState || {};

		// Initialize base state with default values
		const baseState = {
			id: safeRoomState.id || '',
			settings: safeRoomState.settings || {},
			players: safeRoomState.players || [],
			state: safeRoomState.state || RoomStates.LOBBY,
			isLoading: this._uiState.isLoading || false,
			error: this._uiState.error || null,
			activeTab: this._uiState.activeTab || 'game',
			showInviteModal: this._uiState.showInviteModal || false,
			currentUser: this._currentUser || {},
			mode: (safeRoomState.settings && safeRoomState.settings.mode) || 'AI',
			maxPlayers: (safeRoomState.settings && safeRoomState.settings.maxPlayers) || 2,
			pendingInvitations: safeRoomState.invitations || []
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
			}
		};

		// Register data and computed properties with JavaisPasVu
		javaisPasVu.registerData('room', {
			...baseState,
			...methods,
			...existingMethods
		}, computedProps);

		// Debug log the registered state
		logger.debug('Processed room state:', {
			baseState,
			computedProps: Object.keys(computedProps)
		});
	}

	// UI State Management
	_setActiveTab(tab) {
		this._uiState.activeTab = tab;
		javaisPasVu.setDataValue('room', 'activeTab', tab);
	}

	_toggleInviteModal() {
		this._uiState.showInviteModal = !this._uiState.showInviteModal;
		javaisPasVu.setDataValue('room', 'showInviteModal', this._uiState.showInviteModal);
	}

	// Game Container Management
	_initializeGameContainer() {
		const container = document.getElementById('game-container');
		if (!container) {
			logger.warn('Game container not found');
			return;
		}

		const screen = container.querySelector('.game-screen');
		if (!screen) {
			logger.warn('Screen element not found in game container');
			return;
		}

		const roomState = this._store.getState('room');
		if (roomState.state === RoomStates.LOBBY) {
			this._showLobbyMessage(screen);
		}
	}

	_showLobbyMessage(screen) {
		const messageDiv = document.createElement('div');
		messageDiv.className = 'text-center p-4 game-message';
		messageDiv.innerHTML = '<h4>Welcome to the Game Room!</h4><p>Click Start Game when ready.</p>';

		const existingMessage = screen.querySelector('.game-message');
		if (existingMessage) {
			existingMessage.remove();
		}

		screen.appendChild(messageDiv);
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

	// Store Subscription
	_initializeStoreSubscription() {
		// Subscribe to room state changes
		this._store.subscribe('room', (state, type) => {
			logger.debug('Room state updated:', state);
			this._processRoomState(state);
		});

		// Subscribe to user state changes
		this._store.subscribe('user', (state, type) => {
			logger.debug('User state updated:', state);
			this._currentUser = state;
			javaisPasVu.registerData('user', state);

			// Force update all user elements
			document.querySelectorAll('[data-domain="user"]').forEach(el => {
				javaisPasVu.updateElement(el, 'user');
			});

			// Re-process room state since it depends on user data
			const roomState = this._store.getState('room');
			if (roomState) {
				this._processRoomState(roomState);
			}
		});
	}

	handleSettingChange(setting, value, parseAsInt = false) {
		try {
			logger.debug('Class handleSettingChange called:', { setting, value, parseAsInt });
			const roomState = this._store.getState('room');

			if (roomState.state === RoomStates.PLAYING) {
				logger.warn('Cannot change settings while game is in progress');
				return;
			}

			const parsedValue = parseAsInt ? parseInt(value) : value;
			logger.debug('Calling setting change handler with:', { setting, parsedValue });
			this.onSettingChange && this.onSettingChange(setting, parsedValue);
		} catch (error) {
			logger.error('Error in handleSettingChange:', error);
		}
	}

	handleModeChange(event) {
		try {
			logger.debug('Handling mode change:', event.target.value);
			if (this.onModeChange) {
				this.onModeChange(event);
			} else {
				logger.warn('No mode change handler set');
			}
		} catch (error) {
			logger.error('Error in handleModeChange:', error);
		}
	}

	destroy() {
		const roomContainer = document.getElementById('pong-room');
		if (roomContainer) {
			roomContainer.removeEventListener('click', this._handleClick);
			roomContainer.removeEventListener('change', this._handleChange);
			roomContainer.removeEventListener('submit', this._handleSubmit);
		}
		this._eventHandlers.clear();
		this._store.unsubscribe('room');
	}
}

// Factory function to create RoomUIManager instance
export const createRoomUIManager = (store, roomId, currentUser) => {
	return new RoomUIManager(store, roomId, currentUser);
};
