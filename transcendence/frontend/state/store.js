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

class Store {
	constructor() {
		if (Store.instance) {
			return Store.instance;
		}
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

		// Load persisted state
		this.loadPersistedState();

		// Bind methods
		this.dispatch = this.dispatch.bind(this);
		this.subscribe = this.subscribe.bind(this);
		this.getState = this.getState.bind(this);
	}

	// Get store instance (Singleton)
	static getInstance() {
		if (!Store.instance) {
			Store.instance = new Store();
		}
		return Store.instance;
	}

	// Get current state
	getState(domain) {
		return domain ? this.state[domain] : this.state;
	}

	// Get value at specific path
	getValueAtPath(path) {
		return path.split('.').reduce((obj, key) => obj && obj[key], this.state);
	}

	// Subscribe to state changes with optional path
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

	// Notify subscribers of state changes
	notifySubscribers(domain, type = StateChangeTypes.UPDATE) {
		this.subscribers.forEach((subscribers, path) => {
			// If path is a domain name, treat it as a domain subscription
			if (path === domain) {
				subscribers.forEach(callback => {
					try {
						callback(this.state[domain], type);
					} catch (error) {
						logger.error('Error in subscriber callback:', error);
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
						logger.error('Error in path subscriber callback:', error);
					}
				});
			}
		});
	}

	// Batch update multiple state changes
	batchUpdate(updates) {
		const domains = new Set();

		updates.forEach(({ domain, type, payload }) => {
			const reducers = this.reducers[domain];

			if (!reducers || !reducers[type]) {
				logger.error(`No reducer found for action: ${domain}.${type}`);
				return;
			}

			try {
				const domainState = this.state[domain];
				const newDomainState = reducers[type](domainState, payload);

				if (!this.validateStateChange(domain, newDomainState)) {
					throw new Error(`Invalid state transition for ${domain}`);
				}

				this.state = {
					...this.state,
					[domain]: newDomainState
				};

				domains.add(domain);
			} catch (error) {
				logger.error('State update failed:', error);
			}
		});

		// Notify subscribers for all updated domains
		domains.forEach(domain => {
			this.notifySubscribers(domain, StateChangeTypes.BATCH_UPDATE);
		});

		// Persist state
		this.persistState();
	}

	// Validate state changes
	validateStateChange(domain, newState) {
		// Skip validation for game state
		if (domain === 'game') return true;

		const validators = this.validators[domain];
		if (!validators) {
			logger.error(`No validators found for domain: ${domain}`);
			return false;
		}

		// For partial state updates, merge with existing state
		const fullState = { ...this.state[domain], ...newState };
		logger.debug(`Validating state for ${domain}:`, fullState);

		// Validate each field with its corresponding validator
		return Object.entries(fullState).every(([key, value]) => {
			const validator = validators[key];
			if (!validator) {
				logger.debug(`No validator for ${domain}.${key}, skipping`);
				return true;
			}

			const isValid = validator(value);
			if (!isValid) {
				logger.error(`Validation failed for ${domain}.${key}:`, {
					value,
					valueType: typeof value,
					validator: validator.toString()
				});
			}
			return isValid;
		});
	}

	// Update state with single action or batch of actions
	dispatch(action) {
		try {
			const actions = Array.isArray(action) ? action : [action];
			const updatedDomains = new Set();

			actions.forEach(({ domain, type, payload }) => {
				logger.debug('Processing action:', { domain, type, payload });

				const currentState = this.getState(domain);
				const reducers = this.reducers[domain];

				if (!reducers || !reducers[type]) {
					logger.warn(`No reducer found for action: ${domain}.${type}`);
					return;
				}

				const newState = reducers[type](currentState, payload);
				logger.debug('State after reducer:', { domain, newState });

				// Skip if state hasn't changed
				if (isDeepEqual(currentState, newState)) {
					logger.debug('State unchanged, skipping update');
					return;
				}

				// Validate state change
				if (!this.validateStateChange(domain, newState)) {
					logger.error(`Invalid state transition for ${domain}:`, {
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
				logger.debug(`State updated for ${domain}:`, newState);
			});

			// Notify subscribers and persist state if any domains were updated
			if (updatedDomains.size > 0) {
				updatedDomains.forEach(domain => {
					logger.debug(`Notifying subscribers for ${domain}`);
					this.notifySubscribers(domain, actions.length > 1 ? StateChangeTypes.BATCH_UPDATE : StateChangeTypes.UPDATE);
				});
				this.persistState();
			}
		} catch (error) {
			logger.error('Error updating state:', error);
		}
	}

	// Persist UI state separately
	persistUIState(uiState) {
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

	// Persist state to localStorage
	persistState() {
		try {
			// Convert Sets to arrays and exclude game state
			const stateToStore = Object.entries(this.state).reduce((acc, [domain, state]) => {
				// Skip game state and handle special cases
				if (domain === 'game') return acc;
				if (domain === 'ui') {
					this.persistUIState(state);
				}

				// Handle Set conversions
				const processedState = this._processStateForStorage(domain, state);
				return { ...acc, [domain]: processedState };
			}, {});

			localStorage.setItem('app_state', JSON.stringify(stateToStore));
		} catch (error) {
			logger.error('Failed to persist state:', error);
		}
	}

	// Process state for storage
	_processStateForStorage(domain, state) {
		if (domain === 'user' && state.blockedUsers instanceof Set) {
			return {
				...state,
				blockedUsers: Array.from(state.blockedUsers)
			};
		}
		return state;
	}

	// Load persisted state from localStorage
	loadPersistedState() {
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
			logger.error('Failed to load persisted state:', error);
		}
	}

	// Process loaded state
	_processLoadedState(domain, state) {
		if (domain === 'user' && state.blockedUsers) {
			return {
				...state,
				blockedUsers: new Set(state.blockedUsers)
			};
		}
		return state;
	}

	// Load UI state from localStorage
	_loadUIState() {
		const theme = localStorage.getItem('themeLocal');
		const fontSize = localStorage.getItem('sizeLocal');

		return {
			theme: theme && Object.values(UI_THEME).includes(theme) ? theme : UI_THEME.LIGHT,
			fontSize: fontSize && Object.values(UI_FONT_SIZE).includes(fontSize) ? fontSize : UI_FONT_SIZE.SMALL
		};
	}

	// Reset store to initial state
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
			this.notifySubscribers(domain);
		});

		logger.debug('Store reset to initial state');
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

export default Store;
