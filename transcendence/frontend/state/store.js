import logger from '../logger.js';
import { isDeepEqual } from '../utils.js';
import { configActions, configReducers, configValidators, initialConfigState } from './configState.js';
import { userActions, userReducers, userValidators, initialUserState } from './userState.js';
import { chatActions, chatReducers, chatValidators, initialChatState } from './chatState.js';
import { roomActions, roomReducers, roomValidators, initialRoomState } from './roomState.js';
import { gameActions, gameReducers, initialGameState } from './gameState.js';
import { uiActions, uiReducers, uiValidators, initialUIState, UI_FONT_SIZE, UI_THEME } from './uiState.js';

// Event types for state changes
export const StateChangeTypes = {
	UPDATE: 'update',
	RESET: 'reset',
	BATCH_UPDATE: 'batch_update'
};

/**
 * @typedef {Object} StateChangeEvent
 * @property {string} domain - The state domain that changed (e.g., 'room', 'user')
 * @property {string} type - The type of change (update, reset, batch_update)
 * @property {*} payload - The data associated with the change
 */

/**
 * @typedef {Object} Action
 * @property {string} domain - Target state domain (e.g., 'room')
 * @property {string} type - Action type (e.g., 'CREATE_ROOM')
 * @property {*} payload - Action data
 */

/**
 * Central state management store that implements a unidirectional data flow pattern.
 * Works in conjunction with JaiPasVu reactive framework to manage application state.
 * 
 * Key concepts:
 * - Domains: Separate concerns of state (room, user, chat, etc.)
 * - Actions: Messages describing state changes
 * - Reducers: Pure functions that compute new state
 * - Validators: Functions that ensure state integrity
 * - Subscribers: Callbacks notified of state changes
 * 
 * @example
 * // Create/get store instance
 * const store = Store.getInstance();
 * 
 * // Subscribe to room state changes
 * store.subscribe('room', (roomState) => {
 *   logger.log('Room updated:', roomState);
 * });
 * 
 * // Subscribe to specific path
 * store.subscribe('room.settings.mode', (mode) => {
 *   logger.log('Room mode changed:', mode);
 * });
 * 
 * // Dispatch single action
 * store.dispatch({
 *   domain: 'room',
 *   type: 'CREATE_ROOM',
 *   payload: { id: 'room1', createdBy: { id: 1, username: 'player1' } }
 * });
 * 
 * // Dispatch batch actions
 * store.dispatch([
 *   {
 *     domain: 'room',
 *     type: 'UPDATE_ROOM_SETTINGS',
 *     payload: { settings: { maxPlayers: 4 } }
 *   },
 *   {
 *     domain: 'room',
 *     type: 'UPDATE_ROOM_STATE',
 *     payload: { state: 'PLAYING' }
 *   }
 * ]);
 * 
 * @integration JaiPasVu
 * The store integrates with JaiPasVu by:
 * 1. Providing reactive state management through subscriptions
 * 2. Supporting component binding via JaiPasVu's reactive system
 * 3. Enabling automatic UI updates when state changes
 * 
 * @example
 * // JaiPasVu component integration
 * class RoomComponent extends Component {
 *   constructor() {
 *     super();
 *     // Subscribe to room state
 *     Store.getInstance().subscribe('room', (roomState) => {
 *       this.setState({ room: roomState });
 *     });
 *   }
 *   
 *   // Component will automatically re-render when state changes
 *   render() {
 *     const { room } = this.state;
 *     return `<div>Room: ${room.id}</div>`;
 *   }
 * }
 */
class Store {
	/**
	 * Creates a new Store instance or returns existing singleton instance.
	 * Initializes state domains, reducers, validators, and loads persisted state.
	 * 
	 * @private
	 * @throws {Error} If initialization fails
	 */
	constructor() {
		if (Store.instance)
			return Store.instance;
		Store.instance = this;

		// Initialize reducer and validator maps
		this.reducers = {
			config: configReducers,
			ui: uiReducers,
			user: userReducers,
			chat: chatReducers,
			room: roomReducers,
			game: gameReducers
		};

		this.validators = {
			config: configValidators,
			user: userValidators,
			chat: chatValidators,
			room: roomValidators,
			ui: uiValidators
		};

		// Initialize state
		this.state = {
			config: initialConfigState,
			user: initialUserState,
			chat: initialChatState,
			room: initialRoomState,
			game: initialGameState,
			ui: initialUIState
		};

		// Initialize unified subscribers
		this.subscribers = new Map();
	}

	/**
	 * Gets the singleton instance of the Store.
	 * Creates a new instance if one doesn't exist.
	 * 
	 * @returns {Store} The singleton Store instance
	 * @static
	 * 
	 * @example
	 * const store = Store.getInstance();
	 */
	static getInstance() {
		if (!Store.instance)
			Store.instance = new Store();
		return Store.instance;
	}

	/**
	 * Gets current state for a specific domain or entire state object.
	 * 
	 * @param {string} [domain] - Optional domain to get state for (e.g., 'room', 'user')
	 * @returns {Object} Current state for domain or entire state object
	 * 
	 * @example
	 * const roomState = store.getState('room');
	 * logger.log(roomState.players); // Access room players
	 * 
	 * const entireState = store.getState();
	 * logger.log(entireState.room, entireState.user); // Access multiple domains
	 */
	getState(domain) {
		return domain ? this.state[domain] : this.state;
	}

	/**
	 * Gets value at a specific path in the state tree.
	 * 
	 * @param {string} path - Dot-notation path (e.g., 'room.settings.mode')
	 * @returns {*} Value at specified path or undefined if path doesn't exist
	 * 
	 * @example
	 * const roomMode = store.getValueAtPath('room.settings.mode');
	 * const playerCount = store.getValueAtPath('room.players.length');
	 */
	getValueAtPath(path) {
		return path.split('.').reduce((obj, key) => obj && obj[key], this.state);
	}

	/**
	 * Subscribes to state changes at a specific path or domain.
	 * 
	 * @param {string} path - Path or domain to subscribe to (e.g., 'room' or 'room.settings.mode')
	 * @param {Function} callback - Function to call when state changes
	 * @returns {Function} Unsubscribe function
	 * 
	 * @example
	 * // Subscribe to entire room domain
	 * const unsubscribeRoomState = store.subscribe('room', (roomState) => {
	 *   logger.log('Room state changed:', roomState);
	 * });
	 * 
	 * // Subscribe to specific path
	 * store.subscribe('room.settings.mode', (mode) => {
	 *   logger.log('Room mode changed to:', mode);
	 * });
	 * 
	 * // Unsubscribe when needed (function returned by subscribe)
	 * unsubscribeRoomState();
	 */
	subscribe(path, callback) {
		if (!this.subscribers.has(path)) {
			this.subscribers.set(path, new Set());
		}
		this.subscribers.get(path).add(callback);

		// Return unsubscribe function
		return () => {
			const subscribers = this.subscribers.get(path);
			if (subscribers) {
				subscribers.delete(callback);
				if (subscribers.size === 0) {
					this.subscribers.delete(path);
				}
			}
		};
	}

	/**
	 * Dispatches an action or array of actions to update state.
	 * 
	 * @param {Action|Action[]} action - Single action or array of actions
	 * @throws {Error} If action processing fails
	 * 
	 * @example
	 * // Single action
	 * store.dispatch({
	 *   domain: 'room',
	 *   type: 'CREATE_ROOM',
	 *   payload: {
	 *     id: 'room1',
	 *     createdBy: { id: 1, username: 'player1' }
	 *   }
	 * });
	 * 
	 * // Multiple actions
	 * store.dispatch([
	 *   {
	 *     domain: 'room',
	 *     type: 'UPDATE_ROOM_SETTINGS',
	 *     payload: { settings: { maxPlayers: 4 } }
	 *   },
	 *   {
	 *     domain: 'room',
	 *     type: 'UPDATE_PLAYERS',
	 *     payload: { players: [] }  // Example player data array
	 *   }
	 * ]);
	 */
	dispatch(action) {
		try {
			const actions = Array.isArray(action) ? action : [action];
			const updatedDomains = new Set();

			actions.forEach(({ domain, type, payload }) => {
				logger.debug(`[Store] Processing action:`, { domain, type, payload });

				const currentState = this.getState(domain);
				const reducers = this.reducers[domain];

				if (!reducers || !reducers[type]) {
					logger.warn(`[Store] No reducer found for action: ${domain}.${type}`);
					return;
				}

				const newState = reducers[type](currentState, payload);
				logger.debug(`[Store] State after reducer:`, { domain, newState });

				// Skip if state hasn't changed
				if (isDeepEqual(currentState, newState)) {
					logger.debug(`[Store] State unchanged, skipping update`);
					return;
				}

				// Validate state change
				if (!this._validateStateChange(domain, newState)) {
					logger.error(`[Store] Invalid state transition for ${domain}:`, {
						currentState,
						newState,
						action: { type, payload }
					});
					return;
				}

				// Update state
				this.state = {
					...this.state,
					[domain]: newState
				};

				updatedDomains.add(domain);
				logger.debug(`[Store] State updated for ${domain}:`, newState);
			});

			// Notify subscribers and persist state if any domains were updated
			if (updatedDomains.size > 0) {
				updatedDomains.forEach(domain => {
					logger.debug(`[Store] Notifying subscribers for ${domain}`);
					this._notifySubscribers(domain, actions.length > 1 ? StateChangeTypes.BATCH_UPDATE : StateChangeTypes.UPDATE);
				});
				this._persistState();
			}
		} catch (error) {
			logger.error(`[Store] Error updating state:`, error);
		}
	}

	/**
	 * Notifies subscribers of state changes.
	 * 
	 * @private
	 * @param {string} domain - Domain that changed
	 * @param {string} [type=StateChangeTypes.UPDATE] - Type of change
	 */
	_notifySubscribers(domain, type = StateChangeTypes.UPDATE) {
		this.subscribers.forEach((subscribers, path) => {
			// If path is a domain name, treat it as a domain subscription
			if (path === domain) {
				subscribers.forEach(callback => {
					try {
						callback(this.state[domain], type);
					} catch (error) {
						logger.error(`[Store] Error in subscriber callback:`, error);
					}
				});
			}
			// If path contains dots, treat it as a path subscription
			else if (path.startsWith(`${domain}.`)) {
				const value = this.getValueAtPath(path);
				subscribers.forEach(callback => {
					try {
						callback(value, type);
					} catch (error) {
						logger.error(`[Store] Error in path subscriber callback:`, error);
					}
				});
			}
		});
	}

	/**
	 * Updates multiple state domains in a single batch operation.
	 * 
	 * @param {Action[]} updates - Array of actions to process
	 * 
	 * @example
	 * store.batchUpdate([
	 *   {
	 *     domain: 'room',
	 *     type: 'UPDATE_ROOM_SETTINGS',
	 *     payload: { maxPlayers: 4 }
	 *   },
	 *   {
	 *     domain: 'room',
	 *     type: 'UPDATE_ROOM_STATE',
	 *     payload: { state: 'PLAYING' }
	 *   }
	 * ]);
	 */
	batchUpdate(updates) {
		const domains = new Set();

		updates.forEach(({ domain, type, payload }) => {
			const reducers = this.reducers[domain];

			if (!reducers || !reducers[type]) {
				logger.error(`[Store] No reducer found for action: ${domain}.${type}`);
				return;
			}

			try {
				const domainState = this.state[domain];
				const newDomainState = reducers[type](domainState, payload);

				if (!this._validateStateChange(domain, newDomainState)) {
					throw new Error(`[Store] Invalid state transition for ${domain}`);
				}

				this.state = {
					...this.state,
					[domain]: newDomainState
				};

				domains.add(domain);
			} catch (error) {
				logger.error(`[Store] State update failed:`, error);
			}
		});

		// Notify subscribers for all updated domains
		domains.forEach(domain => {
			this._notifySubscribers(domain, StateChangeTypes.BATCH_UPDATE);
		});

		// Persist state
		this._persistState();
	}

	/**
	 * Validates state changes for a domain.
	 * 
	 * @private
	 * @param {string} domain - Domain to validate
	 * @param {Object} newState - New state to validate
	 * @returns {boolean} Whether state is valid
	 */
	_validateStateChange(domain, newState) {
		// Skip validation for game state
		if (domain === 'game') return true;

		const validators = this.validators[domain];
		if (!validators) {
			logger.error(`[Store] No validators found for domain: ${domain}`);
			return false;
		}

		// For partial state updates, merge with existing state
		const fullState = { ...this.state[domain], ...newState };
		logger.debug(`[Store] Validating state for ${domain}:`, fullState);

		// Validate each field with its corresponding validator
		return Object.entries(fullState).every(([key, value]) => {
			const validator = validators[key];
			if (!validator) {
				logger.debug(`[Store] No validator for ${domain}.${key}, skipping`);
				return true;
			}

			const isValid = validator(value);
			if (!isValid) {
				logger.error(`[Store] Validation failed for ${domain}.${key}:`, {
					value,
					valueType: typeof value,
					validator: validator.toString()
				});
			}
			return isValid;
		});
	}

	/**
	 * Persists UI state to localStorage.
	 * 
	 * @private
	 * @param {Object} uiState - UI state to persist
	 */
	_persistUIState(uiState) {
		if (!uiState) return;

		// Validate theme before persisting
		if (uiState.theme && typeof uiState.theme === 'string') {
			localStorage.setItem('themeLocal', uiState.theme);
		}

		// Validate fontSize before persisting
		if (uiState.fontSize && typeof uiState.fontSize === 'string' &&
			Object.values(UI_FONT_SIZE).includes(uiState.fontSize)) {
			localStorage.setItem('sizeLocal', uiState.fontSize);
		}
	}

	/**
	 * Persists entire state to localStorage.
	 * 
	 * @private
	 */
	_persistState() {
		try {
			// Convert Sets to arrays and exclude game state
			const stateToStore = Object.entries(this.state).reduce((acc, [domain, state]) => {
				// Skip game state and handle special cases
				if (domain === 'game') return acc;
				if (domain === 'ui') {
					this._persistUIState(state);
				}

				// Handle Set conversions
				const processedState = this._processStateForStorage(domain, state);
				return { ...acc, [domain]: processedState };
			}, {});

			localStorage.setItem('app_state', JSON.stringify(stateToStore));
		} catch (error) {
			logger.error(`[Store] Failed to persist state:`, error);
		}
	}

	/**
	 * Processes state for storage, converting Sets to arrays.
	 * 
	 * @private
	 * @param {string} domain - Domain being processed
	 * @param {Object} state - State to process
	 * @returns {Object} Processed state
	 */
	_processStateForStorage(domain, state) {
		if (domain === 'user' && state.blockedUsers instanceof Set) {
			return {
				...state,
				blockedUsers: Array.from(state.blockedUsers)
			};
		}
		return state;
	}

	/**
	 * Loads persisted state from localStorage.
	 * 
	 * @private
	 */
	_loadPersistedState() {
		try {
			const persistedState = localStorage.getItem('app_state');
			if (!persistedState) return;

			const parsedState = JSON.parse(persistedState);

			// Process loaded state
			const processedState = Object.entries(parsedState).reduce((acc, [domain, state]) => {
				const processedDomainState = this._processLoadedState(domain, state);
				return { ...acc, [domain]: processedDomainState };
			}, {});

			// Merge with initial state
			this.state = {
				...this.state,
				...processedState,
				game: initialGameState, // Always use fresh game state
				ui: { ...processedState.ui, ...this._loadUIState() } // Merge UI state
			};
		} catch (error) {
			logger.error(`[Store] Failed to load persisted state:`, error);
		}
	}

	/**
	 * Processes loaded state, converting arrays back to Sets.
	 * 
	 * @private
	 * @param {string} domain - Domain being processed
	 * @param {Object} state - State to process
	 * @returns {Object} Processed state
	 */
	_processLoadedState(domain, state) {
		if (domain === 'user' && state.blockedUsers) {
			return {
				...state,
				blockedUsers: new Set(state.blockedUsers)
			};
		}
		return state;
	}

	/**
	 * Loads UI state from localStorage.
	 * 
	 * @private
	 * @returns {Object} UI state
	 */
	_loadUIState() {
		const theme = localStorage.getItem('themeLocal');
		const fontSize = localStorage.getItem('sizeLocal');

		return {
			theme: theme && Object.values(UI_THEME).includes(theme) ? theme : UI_THEME.LIGHT,
			fontSize: fontSize && Object.values(UI_FONT_SIZE).includes(fontSize) ? fontSize : UI_FONT_SIZE.SMALL
		};
	}

	/**
	 * Resets store to initial state.
	 * Clears localStorage and notifies all subscribers.
	 * 
	 * @example
	 * // Reset entire store
	 * store.reset();
	 */
	reset() {
		// Clear all state
		this.state = {
			config: initialConfigState,
			user: initialUserState,
			chat: initialChatState,
			room: initialRoomState,
			game: initialGameState,
			ui: initialUIState
		};

		// Clear localStorage
		localStorage.removeItem('app_state');

		// Notify all subscribers
		Object.keys(this.state).forEach(domain => {
			this._notifySubscribers(domain);
		});

		logger.debug('[Store] reset to initial state');
	}

	initialize() {
		// Operations that: Could fail, depend on DOM/window or need other services
		this._loadPersistedState();

		// Method bindings
		this.dispatch = this.dispatch.bind(this);
		this.subscribe = this.subscribe.bind(this);
		this.getState = this.getState.bind(this);

		logger.debug('[Store] initialized');
	}
}

// Export actions for convenience
export const actions = {
	config: configActions,
	user: userActions,
	chat: chatActions,
	room: roomActions,
	game: gameActions,
	ui: uiActions
};

export const store = new Store();
