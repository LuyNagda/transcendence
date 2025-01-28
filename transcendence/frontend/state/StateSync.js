import Store, { actions } from './store.js';
import logger from '../logger.js';
import javaisPasVu from '../UI/JavaisPasVu.js';
import { isDeepEqual } from '../utils.js';
import HTMXService from './HTMXService.js';
import RoomService from '../room/RoomService.js';
import ChatApp from '../chat/ChatApp.js';
import { updateTheme, applyThemeToDOM, applyFontSizeToDOM } from '../UI/theme.js';
import { Dropdown, Toast, Offcanvas } from '../vendor.js';

/**
 * StateSync - Coordinates state changes between different state management systems
 * 
 * Responsibilities:
 * - Syncs store state with JavaisPasVu UI framework
 * - Handles HTMX state updates through HTMXService
 * - Manages state observers and updates
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
		this.htmxService = HTMXService.getInstance();
		this.stateObservers = new Map();
		this.domains = ['user', 'chat', 'room', 'game', 'ui'];
		this.domainMethods = new Map();

		StateSync.#instance = this;
	}

	/**
	 * Initialize StateSync and its dependencies
	 * @param {HTMLElement} root - The root element for JavaisPasVu
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

			// Get theme and font size from localStorage
			const savedTheme = localStorage.getItem('themeLocal') || 'light';
			const savedFontSize = localStorage.getItem('sizeLocal') || 'small';

			applyThemeToDOM(savedTheme);
			applyFontSizeToDOM(savedFontSize);

			// Initialize HTMX service with state update callback
			this.htmxService.initialize(this.handleServerUpdate.bind(this));

			// Set up user state subscription
			this.store.subscribe('user', (userState) => {
				if (userState?.initialized) {
					this.callMethod('room', 'handleRoomInitialization');
					this.callMethod('chat', 'initializeChat');
				} else {
					this.callMethod('chat', 'resetChat');
				}
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

		logger.debug('Initializing UI state with theme:', {
			themeLocal: localStorage.getItem('themeLocal'),
			sizeLocal: localStorage.getItem('sizeLocal')
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
				javaisPasVu.registerData(domain, state);

				// Special handling for user state
				if (domain === 'user') {
					javaisPasVu.updateData('user', state);
					document.querySelectorAll('[data-domain="user"]').forEach(el => {
						javaisPasVu.updateElement(el, 'user');
					});
				}
			}
		});
	}

	registerDefaultMethods() {
		// Register UI domain methods
		this.registerMethods('ui', {
			updateTheme: (theme) => {
				logger.debug('Theme update requested in StateSync:', theme);
				updateTheme(theme);
			},
			updateFontSize: (size) => {
				logger.debug('Font size update requested in StateSync:', size);
				this.store.dispatch({
					domain: 'ui',
					type: actions.ui.UPDATE_FONT_SIZE,
					payload: { fontSize: size }
				});
				localStorage.setItem('sizeLocal', size);
			}
		});

		// Add UI state subscriptions
		this.store.subscribe('ui', (state) => {
			if (state?.theme)
				applyThemeToDOM(state.theme);
			if (state?.fontSize)
				applyFontSizeToDOM(state.fontSize);
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
		if (!javaisPasVu) {
			logger.error('JavaisPasVu not initialized');
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

			// Register with JavaisPasVu
			javaisPasVu.registerData(domain, state);

			// Register domain methods if they exist
			const methods = this.domainMethods.get(domain) || {};
			javaisPasVu.registerMethods(domain, methods);

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

			// Subscribe to JavaisPasVu changes
			javaisPasVu.subscribe(domain, (state) => {
				logger.debug(`JavaisPasVu update for ${domain}:`, {
					state,
					domainElements: document.querySelectorAll(`[data-domain="${domain}"]`)
				});
				this.handleJavaisPasVuUpdate(domain, state);
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
		if (javaisPasVu) {
			javaisPasVu.registerMethods(domain, methods);
		}
	}

	_setupHtmxHandlers() {
		document.body.addEventListener('htmx:afterSettle', (event) => {
			const response = event.detail.elt;
			const path = response.getAttribute('data-state-path');
			const value = response.getAttribute('data-state-value');

			if (path && value) {
				try {
					const parsedValue = JSON.parse(value);
					const [domain] = path.split('.');
					this.handleServerUpdate(domain, parsedValue);
				} catch (error) {
					logger.error('Failed to parse HTMX state update:', error);
				}
			}
		});

		document.body.addEventListener('htmx:beforeRequest', (event) => {
			const trigger = event.detail.elt;
			const requestPath = trigger.getAttribute('data-request-path');

			if (requestPath) {
				const [domain] = requestPath.split('.');
				this.store.dispatch({
					type: 'SET_LOADING',
					payload: {
						domain,
						loading: true
					}
				});
			}
		});

		document.body.addEventListener('htmx:afterRequest', (event) => {
			const trigger = event.detail.elt;
			const requestPath = trigger.getAttribute('data-request-path');

			if (requestPath) {
				const [domain] = requestPath.split('.');
				this.store.dispatch({
					type: 'SET_LOADING',
					payload: {
						domain,
						loading: false
					}
				});
			}
		});
	}

	handleStoreUpdate(domain, state) {
		logger.debug(`Store update for ${domain}:`, { state, type: 'update', domainElements: document.querySelectorAll(`[data-domain="${domain}"]`) });

		// Handle the store update
		this.handleJavaisPasVuUpdate(domain, state);

		// Special handling for user state updates
		if (domain === 'user' && state) {
			javaisPasVu.registerData('user', state);
			document.querySelectorAll('[data-domain="user"]').forEach(el => {
				javaisPasVu.updateElement(el, 'user');
			});
		}

		// Special handling for room state updates
		if (domain === 'room' && state) {
			javaisPasVu.registerData('room', state);
			document.querySelectorAll('[data-domain="room"]').forEach(el => {
				javaisPasVu.updateElement(el, 'room');
			});
		}

		// Notify observers
		this.notifyStateObservers(domain, state);
	}

	handleJavaisPasVuUpdate(domain, state) {
		// Add update lock to prevent circular updates
		if (this._isUpdating) {
			logger.debug(`Skipping circular update for ${domain}`);
			return;
		}

		try {
			this._isUpdating = true;
			const currentState = this.store.getState(domain);

			logger.debug(`Handling JavaisPasVu update for ${domain}:`, {
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

				// Update JavaisPasVu data
				javaisPasVu.registerData(domain, state);

				// Force update all domain elements
				document.querySelectorAll(`[data-domain="${domain}"]`).forEach(el => {
					javaisPasVu.updateElement(el, domain);
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
			// Apply theme changes
			if (state.theme) {
				logger.debug('Applying theme from state:', state.theme);
				applyThemeToDOM(state.theme);

				// Update all UI elements to reflect the new theme
				document.querySelectorAll('[data-domain="ui"]').forEach(el => {
					javaisPasVu.updateElement(el, 'ui');
				});
			}

			// Apply font size changes
			if (state.fontSize) {
				logger.debug('Applying font size from state:', state.fontSize);
				applyFontSizeToDOM(state.fontSize);

				// Update all UI elements to reflect the new font size
				document.querySelectorAll('[data-domain="ui"]').forEach(el => {
					javaisPasVu.updateElement(el, 'ui');
				});
			}

			// Handle HTMX swap updates
			if (state.lastSwap) {
				const { target } = state.lastSwap;
				if (target) {
					// Initialize Bootstrap components if needed
					if (target.querySelector('[data-bs-toggle]')) {
						this.initializeBootstrapComponents(target);
					}

					// Update UI elements in the swapped region
					if (javaisPasVu && javaisPasVu.initialized) {
						target.querySelectorAll('[data-domain="ui"]').forEach(el => {
							javaisPasVu.updateElement(el, 'ui');
						});
					}
				}
			}

			// Force update all UI elements to ensure consistency
			document.querySelectorAll('[data-domain="ui"]').forEach(el => {
				javaisPasVu.updateElement(el, 'ui');
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
	 * Handle state updates from server/HTMX
	 */
	handleServerUpdate(domain, data) {
		logger.debug(`Handling server update for domain ${domain}:`, data);

		// Special handling for room updates
		if (domain === 'room') {
			this._handleRoomServerUpdate(data);
			return;
		}

		// Handle HTMX events
		if (domain === 'htmx') {
			this.handleHTMXEvent(data);
			return;
		}

		// Handle regular state updates
		if (this.validateState(domain, data)) {
			this.store.dispatch({
				type: 'UPDATE_FROM_SERVER',
				payload: {
					domain,
					data
				}
			});
		} else {
			logger.error(`Invalid state update for domain ${domain}:`, data);
		}
	}

	_handleRoomServerUpdate(data) {
		const currentRoom = RoomService.getCurrentRoom();

		if (data.type === 'EVENT') {
			// Handle room events through the room event handler
			this.callMethod('room', 'handleRoomEvent', data.event);
		} else if (data.type === 'STATE_UPDATE') {
			// Handle direct state updates
			if (currentRoom && currentRoom.roomId === data.roomId) {
				this.callMethod('room', 'updateRoomState', data.roomId, data.state);
			}
		} else if (data.type === 'ROOM_CLOSED') {
			// Handle room closure
			if (currentRoom && currentRoom.roomId === data.roomId) {
				RoomService.destroyCurrentRoom();
			}
		}
	}

	/**
	 * Handle HTMX events and coordinate UI updates
	 */
	handleHTMXEvent(event) {
		logger.debug('Handling HTMX event:', event);

		switch (event.type) {
			case 'AFTER_SWAP':
				// Get current UI state
				const uiState = this.store.getState('ui');
				if (!uiState) {
					logger.warn('No UI state available during HTMX swap');
					return;
				}

				// Re-register UI state with JavaisPasVu to ensure bindings are maintained
				if (javaisPasVu && javaisPasVu.initialized) {
					logger.debug('Re-registering UI state after HTMX swap:', uiState);
					javaisPasVu.registerData('ui', uiState);
					javaisPasVu.registerMethods('ui', this.domainMethods.get('ui') || {});
				}

				// Initialize UI components in swapped region
				this.handleSwapUpdate(event.target);
				break;

			default:
				logger.warn('Unknown HTMX event type:', event.type);
		}
	}

	/**
	 * Handle UI updates after HTMX swap
	 */
	handleSwapUpdate(target) {
		if (!target) return;

		try {
			// Initialize Bootstrap components if needed
			if (target.querySelector('[data-bs-toggle]')) {
				this.initializeBootstrapComponents(target);
			}

			// Get current UI state
			const uiState = this.store.getState('ui');
			if (!uiState) return;

			// Ensure theme and font size are applied
			if (uiState.theme) {
				applyThemeToDOM(uiState.theme);
			}
			if (uiState.fontSize) {
				applyFontSizeToDOM(uiState.fontSize);
			}

			// Update UI elements in the swapped region and re-bind events
			if (javaisPasVu && javaisPasVu.initialized) {
				// First update elements in the swapped region
				const swappedElements = target.querySelectorAll('[data-domain="ui"]');
				swappedElements.forEach(el => {
					javaisPasVu.updateElement(el, 'ui');
				});

				// Then update all UI elements to ensure consistency
				const allElements = document.querySelectorAll('[data-domain="ui"]');
				allElements.forEach(el => {
					if (!target.contains(el)) { // Skip elements we just updated
						javaisPasVu.updateElement(el, 'ui');
					}
				});
			}
		} catch (error) {
			logger.error('Error handling swap update:', error);
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
			if (javaisPasVu)
				javaisPasVu.unsubscribe(domain);
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