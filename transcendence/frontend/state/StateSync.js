import { store, actions } from './store.js';
import logger from '../logger.js';
import jaiPasVu from '../UI/JaiPasVu.js';
import { isDeepEqual } from '../utils.js';

/**
 * StateSync - Coordinates state changes between different state management systems
 * 
 * Responsibilities:
 * - Syncs store state with JaiPasVu framework
 * - Manages state observers and updates
 * - Provides a generic state synchronization layer
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

		this.stateObservers = new Map();
		this.domains = ['chat', 'user'];
		this.domainMethods = new Map();
		this._isUpdating = false;

		StateSync.#instance = this;
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
		store.dispatch({
			domain,
			type: "UPDATE_FROM_SERVER",
			payload: state
		});

		// Update JaiPasVu
		jaiPasVu.registerData(domain, state);

		// Notify observers
		this.notifyStateObservers(domain, state);
	}

	/**
	 * Initialize StateSync and its dependencies
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

			this.domains.forEach(domain => {
				this._initializeDomain(domain);
			});

			logger.info('StateSync initialized');
		} catch (error) {
			logger.error('Failed to initialize StateSync:', error);
			throw error;
		}
		return this;
	}

	_initializeWithConfig(config) {
		store.dispatch({
			domain: 'config',
			type: actions.config.INITIALIZE,
			payload: config
		});

		// Initialize user state if available
		const userInfoElement = document.querySelector('[data-user-info]');
		if (userInfoElement) {
			try {
				const userData = JSON.parse(userInfoElement.dataset.userInfo);
				store.dispatch({
					domain: 'user',
					type: actions.user.SET_USER,
					payload: userData
				});
			} catch (error) {
				logger.error('Failed to parse user data:', error);
			}
		}
	}

	_initializeDefaultState() {
		// Initialize each domain's state
		this.domains.forEach(domain => {
			const state = store.getState(domain);
			if (state) {
				logger.debug(`Initializing domain ${domain} with state:`, state);
				jaiPasVu.registerData(domain, state);
			}
		});
	}

	_initializeDomain(domain) {
		if (!jaiPasVu) {
			logger.error('JaiPasVu not initialized');
			return;
		}

		try {
			// Get initial state from store
			const state = store.getState(domain);
			logger.debug(`Initializing domain ${domain}:`, {
				initialState: state,
				methods: this.domainMethods.get(domain)
			});

			// Register with JaiPasVu
			jaiPasVu.registerData(domain, state);

			// Register domain methods if they exist
			const methods = this.domainMethods.get(domain) || {};
			jaiPasVu.registerMethods(domain, methods);

			// Subscribe to store changes
			store.subscribe(domain, (state, type) => {
				this.handleStoreUpdate(domain, state);
			});

			// Subscribe to JaiPasVu changes
			jaiPasVu.subscribe(domain, (state) => {
				this.handleJaiPasVuUpdate(domain, state);
			});
		} catch (error) {
			logger.error(`Failed to initialize domain ${domain}:`, error);
		}
	}

	handleStoreUpdate(domain, state) {
		if (this._isUpdating) return;

		try {
			this._isUpdating = true;
			logger.debug(`Store update for ${domain}:`, { state });

			// Update JaiPasVu state
			jaiPasVu.registerData(domain, state);

			// Notify observers
			this.notifyStateObservers(domain, state);
		} finally {
			this._isUpdating = false;
		}
	}

	handleJaiPasVuUpdate(domain, state) {
		if (this._isUpdating) return;

		try {
			this._isUpdating = true;
			const currentState = store.getState(domain);

			if (!isDeepEqual(currentState, state)) {
				// Update store state
				store.dispatch({
					domain,
					type: "UPDATE",
					payload: state
				});

				// Notify observers
				this.notifyStateObservers(domain, state);
			}
		} finally {
			this._isUpdating = false;
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

	/**
	 * Register an observer for a specific state domain
	 */
	observe(domain, observer) {
		if (!this.stateObservers.has(domain)) {
			this.stateObservers.set(domain, new Set());
		}
		this.stateObservers.get(domain).add(observer);
		return () => this.unobserve(domain, observer);
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
		const validator = store.getValidator(domain);
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
			if (jaiPasVu) {
				jaiPasVu.unsubscribe(domain);
			}
			store.unsubscribe(domain);
			this.stateObservers.delete(domain);
		}
	}
}

export default StateSync; 