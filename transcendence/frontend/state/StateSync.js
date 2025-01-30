import Store, { actions } from './store.js';
import logger from '../logger.js';
import jaiPasVu from '../UI/JaiPasVu.js';
import { isDeepEqual } from '../utils.js';
import RoomService from '../room/RoomService.js';
import ChatApp from '../chat/ChatApp.js';
import { Dropdown, Toast, Offcanvas } from '../vendor.js';

/**
 * StateSync - Coordinates state changes between different state management systems
 * 
 * Responsibilities:
 * - Syncs store state with JaiPasVu UI framework
 * - Manages state observers and updates
 * - Coordinates domain-specific state management
 */
class StateSync {
	static #instance = null;

	static initialize(root = document.body) {
		if (!StateSync.#instance)
			StateSync.#instance = new StateSync();
		return StateSync.#instance.#initialize(root);
	}

	constructor() {
		if (StateSync.#instance) {
			return StateSync.#instance;
		}

		this.store = Store.getInstance();
		this.stateObservers = new Map();
		this.domains = ['user', 'chat', 'room', 'game', 'ui'];
		this.domainMethods = new Map();

		// Set up HTMX state update handling
		// this.setupHTMXStateHandling();

		StateSync.#instance = this;
	}

	/**
	 * Set up HTMX state update handling through JaiPasVu
	 */
	// setupHTMXStateHandling() {
	// 	jaiPasVu.on('htmx:afterSettle', (event) => {
	// 		this.handleServerUpdate(event);
	// 	});

	// 	jaiPasVu.on('htmx:beforeSwap', (event) => {
	// 		// Preserve existing state before swap
	// 		const currentState = {
	// 			ui: this.store.getState('ui'),
	// 			room: this.store.getState('room')
	// 		};
	// 		event.detail.currentState = currentState;
	// 	});

	// 	jaiPasVu.on('htmx:error', (event) => {
	// 		logger.error('HTMX error:', event.detail);
	// 		this.store.dispatch({
	// 			domain: 'ui',
	// 			type: 'SET_ERROR',
	// 			payload: {
	// 				message: 'Request failed',
	// 				details: event.detail
	// 			}
	// 		});
	// 	});
	// }

	/**
	 * Handle server state updates from HTMX responses
	 */
	handleServerUpdate(event) {
		const response = event.detail.elt;
		const previousState = event.detail.currentState;

		// Handle state updates from data attributes
		const statePath = response.getAttribute('data-state-path');
		const stateValue = response.getAttribute('data-state-value');

		if (statePath && stateValue) {
			try {
				const [domain] = statePath.split('.');
				const state = JSON.parse(stateValue);

				// Special handling for room updates
				if (domain === 'room') {
					this._handleRoomStateUpdate(state);
				} else {
					this.updateDomainState(domain, state);
				}
			} catch (error) {
				logger.error('Failed to process state update:', error);
			}
		}

		// Handle state updates from response content
		const stateData = response.querySelector('[data-state-update]');
		if (stateData) {
			try {
				const updates = JSON.parse(stateData.textContent);
				Object.entries(updates).forEach(([domain, state]) => {
					if (domain === 'room') {
						this._handleRoomStateUpdate(state);
					} else {
						this.updateDomainState(domain, state);
					}
				});
			} catch (error) {
				logger.error('Failed to process state update:', error);
			}
		}

		// Handle UI updates after state changes
		this._handleSwapUIUpdates(response, previousState);
	}

	/**
	 * Handle room-specific state updates
	 */
	_handleRoomStateUpdate(data) {
		const currentRoom = RoomService.getCurrentRoom();

		if (data.type === 'EVENT') {
			this.callMethod('room', 'handleRoomEvent', data.event);
		} else if (data.type === 'STATE_UPDATE' && currentRoom && currentRoom.roomId === data.roomId) {
			this.callMethod('room', 'updateRoomState', data.roomId, data.state);
		} else if (data.type === 'ROOM_CLOSED' && currentRoom && currentRoom.roomId === data.roomId) {
			RoomService.destroyCurrentRoom();
		} else if (data.type === 'UPDATE_ROOM_SETTINGS' && currentRoom) {
			// Handle settings updates
			if (data.settings) {
				currentRoom._stateManager.updateSettings(data.settings);
			}
		} else {
			// Handle regular room state updates
			this.updateDomainState('room', data);
		}

		// Handle room state persistence
		if (currentRoom) {
			sessionStorage.setItem('lastRoomState', JSON.stringify({
				roomId: currentRoom.roomId,
				state: currentRoom._stateManager.state,
				settings: currentRoom._stateManager.settings
			}));
		}
	}

	/**
	 * Handle UI updates after HTMX swap
	 */
	_handleSwapUIUpdates(target, previousState) {
		if (!target) return;

		try {
			// Initialize Bootstrap components if needed
			if (target.querySelector('[data-bs-toggle]')) {
				this.initializeBootstrapComponents(target);
			}

			// Get current UI state
			const uiState = this.store.getState('ui') || previousState?.ui;
			if (uiState) {
				// Ensure theme and font size are applied
				if (uiState.theme) jaiPasVu.callMethod('ui', 'applyTheme', uiState.theme);
				if (uiState.fontSize) jaiPasVu.callMethod('ui', 'applyFontSize', uiState.fontSize);
			}

			// Update UI elements
			if (jaiPasVu && jaiPasVu.initialized) {
				// Update swapped region first
				target.querySelectorAll('[data-domain]').forEach(el => {
					const domain = el.getAttribute('data-domain');
					jaiPasVu.updateElement(el, domain);
				});

				// Update all UI elements for consistency
				document.querySelectorAll('[data-domain="ui"]').forEach(el => {
					if (!target.contains(el)) {
						jaiPasVu.updateElement(el, 'ui');
					}
				});
			}
		} catch (error) {
			logger.error('Error handling UI updates after swap:', error);
		}
	}

	/**
	 * Update domain state and notify observers
	 */
	updateDomainState(domain, state) {
		if (!this.validateState(domain, state)) {
			logger.error(`Invalid state update for domain ${domain}:`, state);
			return;
		}

		// Update store
		this.store.dispatch({
			domain,
			type: 'UPDATE_FROM_SERVER',
			payload: state
		});

		// Update JaiPasVu
		jaiPasVu.registerData(domain, state);

		// Notify observers
		this.notifyStateObservers(domain, state);
	}

	/**
	 * Initialize StateSync and its dependencies
	 * @param {HTMLElement} root - The root element for JaiPasVu
	 */
	#initialize(root = document.body) {
		try {
			// Initialize store with config if available
			const configElement = document.getElementById('app-config');
			if (configElement) {
				const config = JSON.parse(configElement.textContent);
				this._initializeWithConfig(config);
			} else {
				logger.warn('No app config found, initializing with default state');
				this._initializeDefaultState();
			}

			// Set up state synchronization for each domain
			this.domains.forEach(domain => {
				this._initializeDomain(domain);
			});

			// Get theme and font size from localStorage and update UI state
			const savedTheme = localStorage.getItem('themeLocal') || 'light';
			const savedFontSize = localStorage.getItem('sizeLocal') || 'small';

			// Update UI state through store
			this.store.dispatch({
				domain: 'ui',
				type: actions.ui.UPDATE_THEME,
				payload: { theme: savedTheme }
			});

			this.store.dispatch({
				domain: 'ui',
				type: actions.ui.UPDATE_FONT_SIZE,
				payload: { fontSize: savedFontSize }
			});

			logger.info('StateSync initialized');
		} catch (error) {
			logger.error('Failed to initialize StateSync:', error);
			throw error;
		}
		return this;
	}

	_initializeWithConfig(config) {
		// Initialize store with basic config
		this.store.dispatch({
			domain: 'config',
			type: 'INITIALIZE',
			payload: config
		});

		// Get theme and font size from localStorage
		const savedTheme = localStorage.getItem('themeLocal') || 'light';
		const savedFontSize = localStorage.getItem('sizeLocal') || 'small';

		// Initialize UI state
		this.store.dispatch({
			domain: 'ui',
			type: 'INITIALIZE',
			payload: {
				theme: savedTheme,
				fontSize: savedFontSize,
				modals: {},
				toasts: [],
				offcanvas: {}
			}
		});

		// Initialize user state if available
		const userInfoElement = document.querySelector('[data-user-info]');
		if (userInfoElement) {
			try {
				const userData = JSON.parse(userInfoElement.dataset.userInfo);
				this.store.dispatch({
					domain: 'user',
					type: 'SET_USER',
					payload: userData
				});
			} catch (error) {
				logger.error('Failed to parse user data:', error);
			}
		}

		// Register default domain methods
		this.registerDefaultMethods();
	}

	_initializeDefaultState() {
		// Initialize each domain's state
		this.domains.forEach(domain => {
			const state = this.store.getState(domain);
			if (state) {
				logger.debug(`Initializing domain ${domain} with state:`, state);
				jaiPasVu.registerData(domain, state);

				// Special handling for user state
				if (domain === 'user') {
					jaiPasVu.updateData('user', state);
					document.querySelectorAll('[data-domain="user"]').forEach(el => {
						jaiPasVu.updateElement(el, 'user');
					});
				}
			}
		});
	}

	registerDefaultMethods() {

		// Add UI state subscriptions
		this.store.subscribe('ui', (state) => {
			logger.debug('UI state updated:', state);
		});

		// Register room domain methods with improved state management
		this.registerMethods('room', {
			handleRoomInitialization: () => {
				const roomElement = document.getElementById('pong-room');
				if (!roomElement) {
					logger.debug('No #pong-room element found, skipping Room initialization');
					return;
				}

				// Get room data from DOM
				const roomData = this._getRoomDataFromDOM(roomElement);
				if (!roomData) {
					logger.debug('No room data found in DOM');
					return;
				}

				// Initialize room service with data
				RoomService.initialize(roomData);
			},

			updateRoomState: (roomId, newState) => {
				const currentRoom = RoomService.getCurrentRoom();
				if (currentRoom && currentRoom.roomId === roomId) {
					currentRoom._stateManager.updateState(newState);
				}
			},

			handleRoomEvent: (event) => {
				const { type, roomId, data } = event;
				const currentRoom = RoomService.getCurrentRoom();

				if (!currentRoom || currentRoom.roomId !== roomId) {
					logger.warn('Room event received for inactive room:', { roomId, currentRoomId: currentRoom?.roomId });
					return;
				}

				switch (type) {
					case 'PLAYER_JOIN':
						currentRoom._stateManager.addPlayer(data.player);
						break;
					case 'PLAYER_LEAVE':
						currentRoom._stateManager.removePlayer(data.playerId);
						break;
					case 'INVITATION_SENT':
						currentRoom._stateManager.addInvitation(data.invitation);
						break;
					case 'INVITATION_CANCELLED':
						currentRoom._stateManager.removeInvitation(data.invitationId);
						break;
					case 'MODE_CHANGE':
						currentRoom.handleModeChange({ target: { value: data.mode } });
						break;
					case 'SETTINGS_UPDATE':
						currentRoom.updateSetting(data.setting, data.value);
						break;
					case 'STATE_TRANSITION':
						if (data.state === 'PLAYING') {
							currentRoom._stateManager.transitionToPlaying();
						} else if (data.state === 'LOBBY') {
							currentRoom._stateManager.transitionToLobby();
						}
						break;
					default:
						logger.warn('Unknown room event type:', type);
				}
			}
		});

		// Register chat domain methods
		this.registerMethods('chat', {
			initializeChat: () => {
				const userState = this.store.getState('user');
				if (!userState?.initialized) {
					logger.debug('Skipping ChatApp initialization - user not initialized');
					return;
				}

				const chatCanvas = document.getElementById('chatCanvas');
				if (!chatCanvas) {
					logger.debug('Skipping ChatApp initialization - chat elements not ready');
					return;
				}

				if (!ChatApp.hasInstance()) {
					ChatApp.getInstance();
					logger.info('ChatApp initialized successfully');
				}
			},
			resetChat: () => {
				ChatApp.resetInstance();
			}
		});
	}

	_getRoomDataFromDOM(roomElement) {
		try {
			// Try to get room data from data attribute
			const roomDataAttr = roomElement.getAttribute('data-room-info');
			if (roomDataAttr) {
				return JSON.parse(roomDataAttr);
			}

			// Fallback to looking for room ID and basic info
			const roomId = roomElement.getAttribute('data-room-id');
			if (!roomId) return null;

			return {
				id: roomId,
				isPrivate: roomElement.getAttribute('data-room-private') === 'true',
				mode: roomElement.getAttribute('data-room-mode') || 'AI'
			};
		} catch (error) {
			logger.error('Error parsing room data from DOM:', error);
			return null;
		}
	}

	_initializeDomain(domain) {
		if (!jaiPasVu) {
			logger.error('JaiPasVu not initialized');
			return;
		}

		try {
			// Get initial state from store
			const state = this.store.getState(domain);
			logger.debug(`Initializing domain ${domain}:`, {
				initialState: state,
				methods: this.domainMethods.get(domain),
				domainElements: document.querySelectorAll(`[data-domain="${domain}"]`)
			});

			// Register with JaiPasVu
			jaiPasVu.registerData(domain, state);

			// Register domain methods if they exist
			const methods = this.domainMethods.get(domain) || {};
			jaiPasVu.registerMethods(domain, methods);

			// Special handling for room domain
			if (domain === 'room') {
				this._initializeRoomDomain();
			}

			// Subscribe to store changes
			this.store.subscribe(domain, (state, type) => {
				logger.debug(`Store update for ${domain}:`, {
					state,
					type,
					domainElements: document.querySelectorAll(`[data-domain="${domain}"]`)
				});

				// Special handling for room state updates
				if (domain === 'room' && type) {
					this._handleRoomStateChange(state, type);
				}

				this.handleStoreUpdate(domain, state);
			});

			// Subscribe to JaiPasVu changes
			jaiPasVu.subscribe(domain, (state) => {
				logger.debug(`JaiPasVu update for ${domain}:`, {
					state,
					domainElements: document.querySelectorAll(`[data-domain="${domain}"]`)
				});
				this.handleJaiPasVuUpdate(domain, state);
			});
		} catch (error) {
			logger.error(`Failed to initialize domain ${domain}:`, error);
		}
	}

	_initializeRoomDomain() {
		// Set up room-specific event listeners
		window.addEventListener('room:event', (event) => {
			try {
				const roomEvent = event.detail;
				this.callMethod('room', 'handleRoomEvent', roomEvent);
			} catch (error) {
				logger.error('Error handling room event:', error);
			}
		});

		// Handle room state persistence
		window.addEventListener('beforeunload', () => {
			try {
				const roomService = RoomService.getInstance();
				const currentRoom = roomService.getCurrentRoom();
				if (currentRoom) {
					// Save room state to sessionStorage for potential recovery
					sessionStorage.setItem('lastRoomState', JSON.stringify({
						roomId: currentRoom.roomId,
						state: currentRoom._stateManager.state,
						settings: currentRoom._stateManager.settings
					}));
				}
			} catch (error) {
				logger.error('Error persisting room state:', error);
			}
		});
	}

	_handleRoomStateChange(state, type) {
		try {
			const currentRoom = RoomService.getCurrentRoom();
			if (!currentRoom) return;

			switch (type) {
				case 'UPDATE_ROOM_STATE':
					// Handle room state updates
					if (state.currentRoom) {
						this.callMethod('room', 'updateRoomState',
							currentRoom.roomId,
							state.currentRoom
						);
					}
					break;

				case 'LEAVE_ROOM':
					// Handle room leave
					if (!state.currentRoom) {
						RoomService.destroyCurrentRoom();
					}
					break;

				case 'UPDATE_ROOM_SETTINGS':
					// Handle settings updates
					if (state.currentRoom?.settings) {
						currentRoom._stateManager.updateSettings(
							state.currentRoom.settings
						);
					}
					break;
			}
		} catch (error) {
			logger.error('Error handling room state change:', error);
		}
	}

	/**
	 * Register methods for a specific domain
	 */
	registerMethods(domain, methods) {
		this.domainMethods.set(domain, methods);
		if (jaiPasVu) {
			jaiPasVu.registerMethods(domain, methods);
		}
	}

	handleStoreUpdate(domain, state) {
		logger.debug(`Store update for ${domain}:`, { state, type: 'update', domainElements: document.querySelectorAll(`[data-domain="${domain}"]`) });

		// Handle the store update
		this.handleJaiPasVuUpdate(domain, state);

		// Special handling for user state updates
		if (domain === 'user' && state) {
			jaiPasVu.registerData('user', state);
			document.querySelectorAll('[data-domain="user"]').forEach(el => {
				jaiPasVu.updateElement(el, 'user');
			});
		}

		// Special handling for room state updates
		if (domain === 'room' && state) {
			jaiPasVu.registerData('room', state);
			document.querySelectorAll('[data-domain="room"]').forEach(el => {
				jaiPasVu.updateElement(el, 'room');
			});
		}

		// Notify observers
		this.notifyStateObservers(domain, state);
	}

	handleJaiPasVuUpdate(domain, state) {
		// Add update lock to prevent circular updates
		if (this._isUpdating) {
			logger.debug(`Skipping circular update for ${domain}`);
			return;
		}

		try {
			this._isUpdating = true;
			const currentState = this.store.getState(domain);

			logger.debug(`Handling JaiPasVu update for ${domain}:`, {
				currentState,
				newState: state,
				domainElements: document.querySelectorAll(`[data-domain="${domain}"]`)
			});

			if (!isDeepEqual(currentState, state)) {
				// Update store state
				this.store.dispatch({
					domain,
					type: 'UPDATE',
					payload: state
				});

				// Update JaiPasVu data
				jaiPasVu.registerData(domain, state);

				// Force update all domain elements
				document.querySelectorAll(`[data-domain="${domain}"]`).forEach(el => {
					jaiPasVu.updateElement(el, domain);
				});

				// For UI domain, handle UI updates
				if (domain === 'ui') {
					this.handleUIUpdate(state);
				}
			}
		} finally {
			this._isUpdating = false;
		}
	}

	/**
	 * Handle UI state updates and apply necessary changes
	 */
	handleUIUpdate(state) {
		try {
			// Handle HTMX swap updates
			if (state.lastSwap) {
				const { target } = state.lastSwap;
				if (target) {
					// Initialize Bootstrap components if needed
					if (target.querySelector('[data-bs-toggle]')) {
						this.initializeBootstrapComponents(target);
					}

					// Update UI elements in the swapped region
					if (jaiPasVu && jaiPasVu.initialized) {
						target.querySelectorAll('[data-domain]').forEach(el => {
							const domain = el.getAttribute('data-domain');
							jaiPasVu.updateElement(el, domain);
						});
					}
				}
			}

			// Force update all UI elements to ensure consistency
			document.querySelectorAll('[data-domain="ui"]').forEach(el => {
				jaiPasVu.updateElement(el, 'ui');
			});
		} catch (error) {
			logger.error('Error in handleUIUpdate:', error);
		}
	}

	/**
	 * Initialize Bootstrap components in a specific target element
	 */
	initializeBootstrapComponents(target = document.body) {
		try {
			// Initialize dropdowns
			const dropdowns = target.querySelectorAll('[data-bs-toggle="dropdown"]');
			dropdowns.forEach(el => new Dropdown(el));

			// Initialize toasts
			const toasts = target.querySelectorAll('.toast');
			toasts.forEach(el => new Toast(el));

			// Initialize offcanvas
			const offcanvas = target.querySelectorAll('.offcanvas');
			offcanvas.forEach(el => new Offcanvas(el));

			logger.debug('Bootstrap components initialized for target:', target);
		} catch (error) {
			logger.error('Error initializing Bootstrap components:', error);
		}
	}

	/**
	 * Register an observer for a specific state domain
	 */
	observe(domain, observer) {
		if (!this.stateObservers.has(domain)) {
			this.stateObservers.set(domain, new Set());
		}
		this.stateObservers.get(domain).add(observer);
	}

	/**
	 * Remove an observer for a specific state domain
	 */
	unobserve(domain, observer) {
		if (this.stateObservers.has(domain)) {
			this.stateObservers.get(domain).delete(observer);
		}
	}

	/**
	 * Notify all observers of state changes
	 */
	notifyStateObservers(domain, state) {
		if (this.stateObservers.has(domain)) {
			this.stateObservers.get(domain).forEach(observer => {
				try {
					observer(state);
				} catch (error) {
					logger.error(`Error notifying observer for domain ${domain}:`, error);
				}
			});
		}
	}

	/**
	 * Validate incoming state against schema
	 */
	validateState(domain, state) {
		const validator = this.store.getValidator(domain);
		if (validator) {
			return validator(state);
		}
		return true;
	}

	/**
	 * Add a new domain at runtime
	 */
	addDomain(domain, methods = {}) {
		if (!this.domains.includes(domain)) {
			this.domains.push(domain);
			this.domainMethods.set(domain, methods);
			this._initializeDomain(domain);
		}
	}

	/**
	 * Remove a domain and clean up
	 */
	removeDomain(domain) {
		const index = this.domains.indexOf(domain);
		if (index > -1) {
			this.domains.splice(index, 1);
			this.domainMethods.delete(domain);
			if (jaiPasVu)
				jaiPasVu.unsubscribe(domain);
			this.store.unsubscribe(domain);
			this.stateObservers.delete(domain);
		}
	}

	/**
	 * Call a registered method for a domain
	 */
	callMethod(domain, methodName, ...args) {
		logger.debug(`Calling method ${methodName} for domain ${domain}:`, {
			args,
			availableMethods: this.domainMethods.get(domain)
		});

		const methods = this.domainMethods.get(domain);
		if (!methods) {
			logger.error(`No methods registered for domain: ${domain}`);
			return;
		}

		const method = methods[methodName];
		if (typeof method !== 'function') {
			logger.error(`Method ${methodName} not found in domain ${domain}`);
			return;
		}

		try {
			return method.apply(null, args);
		} catch (error) {
			logger.error(`Error calling method ${methodName} for domain ${domain}:`, error);
		}
	}
}

export default StateSync; 