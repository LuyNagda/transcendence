import logger from '../logger.js';
import Store from './store.js';

/**
 * HTMXService - Handles all HTMX interactions and events
 * Provides a clean interface for StateSync to handle server updates
 * Also handles converting HTMX events to store actions
 */
class HTMXService {
	constructor() {
		if (HTMXService.instance) {
			return HTMXService.instance;
		}
		HTMXService.instance = this;

		this.store = Store.getInstance();
		this.stateUpdateCallback = null;
		this.isProcessingSwap = false;
		this.setupEventListeners();
	}

	static getInstance() {
		if (!HTMXService.instance) {
			HTMXService.instance = new HTMXService();
		}
		return HTMXService.instance;
	}

	/**
	 * Initialize HTMX service with a callback for state updates
	 */
	initialize(stateUpdateCallback) {
		this.stateUpdateCallback = stateUpdateCallback;
		logger.debug('HTMX Service initialized');
	}

	/**
	 * Set up all HTMX event listeners
	 */
	setupEventListeners() {
		// State update handlers
		document.addEventListener('htmx:beforeSwap', this.handleStateUpdate.bind(this));
		document.addEventListener('htmx:afterSwap', this.handleAfterSwap.bind(this));

		// Loading state handlers
		document.body.addEventListener('htmx:beforeRequest', this.handleBeforeRequest.bind(this));
		document.body.addEventListener('htmx:afterRequest', this.handleAfterRequest.bind(this));
		document.body.addEventListener('htmx:afterSettle', this.handleAfterSettle.bind(this));

		// Error handling
		document.body.addEventListener('htmx:responseError', (event) => {
			logger.error('HTMX response error:', event.detail);
		});

		// Debug logging
		if (process.env.NODE_ENV !== 'production') {
			document.body.addEventListener('htmx:configRequest', (event) => {
				logger.debug('HTMX request configured:', event.detail);
			});
		}
	}

	/**
	 * Handle state updates from HTMX responses
	 */
	handleStateUpdate(event) {
		try {
			// Check for state updates in HX-Trigger
			const triggerHeader = event.detail.headers?.['HX-Trigger'];
			if (triggerHeader) {
				try {
					const triggers = JSON.parse(triggerHeader);
					if (triggers.stateUpdate && this.stateUpdateCallback) {
						const { domain, state } = triggers.stateUpdate;
						this.stateUpdateCallback(domain, state);
						return;
					}
				} catch (error) {
					logger.error("Error parsing HX-Trigger header:", error);
				}
			}

			// Fallback to parsing HTML response for backward compatibility
			const responseText = event.detail.serverResponse;
			if (!responseText) return;

			const parser = new DOMParser();
			const doc = parser.parseFromString(responseText, 'text/html');
			const stateData = doc.querySelector('#room-state-data');

			if (stateData && this.stateUpdateCallback) {
				try {
					const state = JSON.parse(stateData.textContent);
					this.stateUpdateCallback('room', state);
				} catch (error) {
					logger.error("Error parsing state data:", error);
				}
			}
		} catch (error) {
			logger.error("Error processing state update:", error);
		}
	}

	/**
	 * Handle loading state before request
	 */
	handleBeforeRequest(event) {
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
	}

	/**
	 * Handle loading state after request
	 */
	handleAfterRequest(event) {
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
	}

	/**
	 * Handle after settle events
	 */
	handleAfterSettle(event) {
		const response = event.detail.elt;
		const path = response.getAttribute('data-state-path');
		const value = response.getAttribute('data-state-value');

		if (path && value) {
			try {
				const parsedValue = JSON.parse(value);
				if (this.stateUpdateCallback) {
					const [domain] = path.split('.');
					this.stateUpdateCallback(domain, parsedValue);
				}
			} catch (error) {
				logger.error('Failed to parse HTMX state update:', error);
			}
		}
	}

	/**
	 * Handle post-swap events
	 */
	handleAfterSwap(event) {
		if (this.isProcessingSwap) return;
		this.isProcessingSwap = true;

		try {
			logger.debug('HTMX afterSwap triggered');

			if (this.stateUpdateCallback) {
				this.stateUpdateCallback('htmx', {
					type: 'AFTER_SWAP',
					target: event.detail.target,
					timestamp: Date.now()
				});
			}
		} finally {
			setTimeout(() => {
				this.isProcessingSwap = false;
			}, 100);
		}
	}
}

export default HTMXService; 
