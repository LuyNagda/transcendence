import logger from '../logger.js';
import { gameActions, gameReducers, initialGameState } from './gameState.js';
import { userActions, userReducers, userValidators, initialUserState } from './userState.js';
import { chatActions, chatReducers, chatValidators, initialChatState } from './chatState.js';
import { roomActions, roomReducers, roomValidators, initialRoomState } from './roomState.js';
import { configActions, configReducers, configValidators, initialConfigState } from './configState.js';

class Store {
	constructor() {
		if (Store.instance) {
			return Store.instance;
		}
		Store.instance = this;

		// Initialize state
		this.state = {
			game: initialGameState,
			user: initialUserState,
			chat: initialChatState,
			room: initialRoomState,
			config: initialConfigState
		};

		// Initialize action history for undo/redo
		this.history = [];
		this.historyIndex = -1;
		this.maxHistoryLength = 50;

		// Initialize subscribers
		this.subscribers = new Map();

		// Debug mode
		this.DEBUG = false;

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

	// Validate state changes
	validateStateChange(domain, newState) {
		if (domain === 'game') return true;  // No validation for game state

		logger.debug('Starting state validation:', {
			domain,
			currentState: this.state[domain],
			newState,
			DEBUG: this.DEBUG
		});

		const validators = {
			user: userValidators,
			chat: chatValidators,
			room: roomValidators,
			config: configValidators
		}[domain];

		if (!validators) {
			logger.error(`No validators found for domain: ${domain}`);
			return false;
		}

		// For partial state updates, merge with existing state before validation
		const fullState = {
			...this.state[domain],
			...newState
		};

		logger.debug('Full state to validate:', {
			domain,
			fullState,
			validators: Object.keys(validators)
		});

		const validationResults = Object.entries(fullState).map(([key, value]) => {
			const validator = validators[key];
			if (!validator) {
				logger.debug(`No validator for ${domain}.${key}, skipping`);
				return true;
			}

			const isValid = validator(value);
			logger.debug(`Validation result for ${domain}.${key}:`, {
				value,
				valueType: typeof value,
				validator: validator.toString(),
				isValid
			});

			if (!isValid) {
				logger.error(`Validation failed for ${domain}.${key}:`, {
					value,
					valueType: typeof value,
					validator: validator.toString()
				});
			}
			return isValid;
		});

		const allValid = validationResults.every(result => result);
		logger.debug('Validation complete:', {
			domain,
			allValid,
			results: validationResults
		});

		return allValid;
	}

	// Dispatch action
	dispatch(action) {
		const { domain, type, payload } = action;

		// Skip debug logging for game actions
		if (domain !== 'game' && this.DEBUG) {
			logger.info('Action dispatched:', { domain, type, payload });
		}

		// Get appropriate reducer
		const reducers = {
			game: gameReducers,
			user: userReducers,
			chat: chatReducers,
			room: roomReducers,
			config: configReducers
		}[domain];

		if (!reducers || !reducers[type]) {
			logger.error(`No reducer found for action: ${domain}.${type}`);
			return;
		}

		try {
			// Create new state immutably
			const domainState = this.state[domain];
			const newDomainState = reducers[type](domainState, payload);

			// Validate state transition
			if (!this.validateStateChange(domain, newDomainState)) {
				throw new Error(`Invalid state transition for ${domain}`);
			}

			// Save to history for undo/redo only for non-game actions
			if (domain !== 'game') {
				this.saveToHistory();
			}

			// Update state
			this.state = {
				...this.state,
				[domain]: newDomainState
			};

			// Notify subscribers
			this.notifySubscribers(domain);

			// Persist state only for non-game actions
			if (domain !== 'game') {
				this.persistState();
			}

		} catch (error) {
			logger.error('State update failed:', error);
			throw error;
		}
	}

	// Subscribe to state changes
	subscribe(domain, callback) {
		if (!this.subscribers.has(domain)) {
			this.subscribers.set(domain, new Set());
		}
		this.subscribers.get(domain).add(callback);

		// Return unsubscribe function
		return () => {
			this.subscribers.get(domain).delete(callback);
		};
	}

	// Notify subscribers of state changes
	notifySubscribers(domain) {
		const subscribers = this.subscribers.get(domain);
		if (subscribers) {
			subscribers.forEach(callback => {
				try {
					callback(this.state[domain]);
				} catch (error) {
					logger.error('Error in subscriber callback:', error);
				}
			});
		}
	}

	// Save current state to history
	saveToHistory() {
		this.history = this.history.slice(0, this.historyIndex + 1);
		this.history.push(JSON.stringify(this.state));
		this.historyIndex++;

		// Limit history length
		if (this.history.length > this.maxHistoryLength) {
			this.history = this.history.slice(-this.maxHistoryLength);
			this.historyIndex = this.history.length - 1;
		}
	}

	// Undo last action
	undo() {
		if (this.historyIndex > 0) {
			this.historyIndex--;
			this.state = JSON.parse(this.history[this.historyIndex]);
			Object.keys(this.state).forEach(domain => this.notifySubscribers(domain));
			if (this.DEBUG) {
				logger.info('State restored from history. Index:', this.historyIndex);
			}
		}
	}

	// Redo previously undone action
	redo() {
		if (this.historyIndex < this.history.length - 1) {
			this.historyIndex++;
			this.state = JSON.parse(this.history[this.historyIndex]);
			Object.keys(this.state).forEach(domain => this.notifySubscribers(domain));
			if (this.DEBUG) {
				logger.info('State restored from history. Index:', this.historyIndex);
			}
		}
	}

	// Persist state to localStorage
	persistState() {
		try {
			// Convert Sets to arrays before stringifying and exclude game state
			const stateToStore = Object.entries(this.state).reduce((acc, [domain, state]) => {
				if (domain === 'game') return acc;  // Skip game state persistence

				if (domain === 'user' && state.blockedUsers instanceof Set) {
					return {
						...acc,
						[domain]: {
							...state,
							blockedUsers: Array.from(state.blockedUsers)
						}
					};
				}
				return { ...acc, [domain]: state };
			}, {});

			localStorage.setItem('app_state', JSON.stringify(stateToStore));
			if (this.DEBUG) {
				logger.info('State persisted to localStorage');
			}
		} catch (error) {
			logger.error('Failed to persist state:', error);
		}
	}

	// Load persisted state from localStorage
	loadPersistedState() {
		try {
			const persistedState = localStorage.getItem('app_state');
			if (persistedState) {
				const parsedState = JSON.parse(persistedState);

				// Convert arrays back to Sets where needed
				if (parsedState.user && parsedState.user.blockedUsers) {
					parsedState.user.blockedUsers = new Set(parsedState.user.blockedUsers);
				}

				// Merge with initial state, keeping game state fresh
				this.state = {
					...this.state,
					...parsedState,
					game: initialGameState  // Always use fresh game state
				};

				if (this.DEBUG) {
					logger.info('State loaded from localStorage');
				}
			}
		} catch (error) {
			logger.error('Failed to load persisted state:', error);
		}
	}

	// Debug mode
	enableDebug() {
		this.DEBUG = true;
		logger.info('Store debug mode enabled');
	}

	disableDebug() {
		this.DEBUG = false;
		logger.info('Store debug mode disabled');
	}

	// Reset store to initial state
	reset() {
		this.state = {
			game: initialGameState,
			user: initialUserState,
			chat: initialChatState,
			room: initialRoomState,
			config: initialConfigState
		};
		this.history = [];
		this.historyIndex = -1;
		Object.keys(this.state).forEach(domain => this.notifySubscribers(domain));
		this.persistState();
		if (this.DEBUG) {
			logger.info('Store reset to initial state');
		}
	}
}

// Export actions for convenience
export const actions = {
	game: gameActions,
	user: userActions,
	chat: chatActions,
	room: roomActions,
	config: configActions
};

export default Store;
