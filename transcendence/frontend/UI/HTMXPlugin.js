import logger from '../logger.js';
import Store from '../state/store.js';
import { htmx } from '../vendor.js';

/**
 * HTMXService - Integrates HTMX with JaiPasVu and StateSync
 * 
 * Features:
 * - Request processing and tracking
 * - State management
 * - Event handling
 * - HTMX-specific directives
 * - State synchronization
 */

export const htmxPlugin = {
	name: 'htmx',
	app: null,

	install(app) {
		this.app = app;

		// Configure HTMX defaults
		htmx.config.defaultSwapStyle = "innerHTML";
		htmx.config.defaultSettleDelay = 100;
		htmx.config.historyCacheSize = 10;

		// Register HTMX state
		app.registerData('htmx', {
			isProcessing: false,
			processingClass: 'htmx-processing',
			swapStyle: 'innerHTML',
			requests: new Map()
		});

		// Register HTMX methods
		app.registerMethods('htmx', {
			processRequest(target, options = {}) {
				const state = app.getState('htmx');
				if (!state) return null;

				const requestId = Date.now().toString();

				// Add processing state
				state.isProcessing = true;
				target.classList.add(state.processingClass);

				// Track request
				state.requests.set(requestId, {
					target,
					options,
					timestamp: Date.now()
				});

				// Return request handlers
				return {
					onComplete: () => {
						if (state) {
							// Remove processing state
							state.isProcessing = false;
							target.classList.remove(state.processingClass);

							// Clean up request
							state.requests.delete(requestId);

							// Trigger UI update if needed
							if (options.updateUI) {
								app.emit('updated');
							}
						}
					},
					onError: (error) => {
						logger.error('HTMX request failed:', error);
						if (state) {
							state.isProcessing = false;
							target.classList.remove(state.processingClass);
							state.requests.delete(requestId);
						}
					}
				};
			},

			getActiveRequests() {
				const state = app.getState('htmx');
				return state ? Array.from(state.requests.values()) : [];
			},

			cancelRequest(target) {
				const state = app.getState('htmx');
				if (!state) return;

				// Find and remove request for target
				for (const [id, request] of state.requests) {
					if (request.target === target) {
						state.requests.delete(id);
						target.classList.remove(state.processingClass);
						break;
					}
				}
			},

			setProcessingClass(className) {
				const state = app.getState('htmx');
				if (state) {
					state.processingClass = className;
				}
			},

			setSwapStyle(style) {
				const state = app.getState('htmx');
				if (state) {
					state.swapStyle = style;
				}
			}
		});

		// Register computed properties
		app.registerComputed('htmx', {
			hasActiveRequests: function () {
				return this.requests.size > 0;
			},
			activeRequestCount: function () {
				return this.requests.size;
			}
		});

		// Setup HTMX event handlers
		this.setupEventHandlers(app);

		// Setup HTMX-specific directives
		this.setupDirectives(app);

		// Listen for app initialization
		app.on('beforeMount', () => {
			// Initialize if not a history restore
			if (!document.documentElement.getAttribute('data-htmx-history-restore')) {
				this._initializeHtmx();
			}
		});

		// Handle HTMX after-swap event for partial page loads
		document.addEventListener('htmx:afterSwap', (event) => {
			// Reinitialize UI components after HTMX swaps
			app.emit('htmx:reinitialize');
		});
	},

	_initializeHtmx() {
		// Process any existing HTMX elements
		document.querySelectorAll('[hx-get], [hx-post]').forEach(el => {
			this.app.compileElement(el);
			htmx.process(el);
		});

		logger.debug('HTMX initialized');
	},

	setupEventHandlers(app) {
		const store = Store.getInstance();

		document.body.addEventListener('htmx:beforeRequest', (event) => {
			const target = event.detail.elt;
			const domain = target.getAttribute('data-domain') || 'global';

			app.emit('htmx:beforeRequest', event);
		});

		document.body.addEventListener('htmx:afterRequest', (event) => {
			const target = event.detail.elt;
			const domain = target.getAttribute('data-domain') || 'global';

			app.emit('htmx:afterRequest', event);
		});

		document.body.addEventListener('htmx:beforeSwap', (event) => {
			const target = event.detail.target;
			if (target) {
				// Preserve UI state before swap
				const uiState = store.getState('ui');
				if (uiState) {
					sessionStorage.setItem('ui_state', JSON.stringify(uiState));
				}
				app.cleanup(target);
			}
			app.emit('htmx:beforeSwap', event);
		});

		document.body.addEventListener('htmx:afterSwap', (event) => {
			const target = event.detail.target;
			if (target) {
				// Restore UI state after swap
				const savedUiState = sessionStorage.getItem('ui_state');
				if (savedUiState) {
					const uiState = JSON.parse(savedUiState);
					store.dispatch({
						domain: 'ui',
						type: 'INITIALIZE',
						payload: uiState
					});
					sessionStorage.removeItem('ui_state');
				}

				// First process state updates from server
				this.processStateUpdates(app, event.detail);

				// Then recompile the swapped element and its children
				app.compileElement(target);

				// Ensure any new HTMX elements are properly initialized
				htmx.process(target);

				// Force recompile all UI elements to ensure proper state
				document.querySelectorAll('[data-domain]').forEach(el => {
					app.compileElement(el);
				});
			}
			app.emit('htmx:afterSwap', event);
		});

		// Add mutation observer to handle dynamically added HTMX elements
		const observer = new MutationObserver((mutations) => {
			mutations.forEach(mutation => {
				mutation.addedNodes.forEach(node => {
					if (node.nodeType === 1) { // Element node
						if (node.hasAttribute('hx-get') || node.hasAttribute('hx-post')) {
							app.compileElement(node);
							htmx.process(node);
						}
					}
				});
			});
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		document.body.addEventListener('htmx:responseError', (event) => {
			logger.error('HTMX response error:', event.detail);
			app.emit('htmx:error', event);
		});
	},

	setupDirectives(app) {
		app.on('beforeCompile', (el) => {
			Array.from(el.attributes || []).forEach(attr => {
				if (attr.name.startsWith('v-hx-')) {
					const htmxAttr = attr.name.replace('v-hx-', 'hx-');
					el.setAttribute(htmxAttr, attr.value);
				}
			});

			// // Add loading indicator to HTMX elements
			// if (el.hasAttribute('hx-get') || el.hasAttribute('hx-post')) {
			// 	if (!el.hasAttribute('hx-indicator')) {
			// 		el.setAttribute('hx-indicator', '[data-loading="global"]');
			// 	}
			// }
		});
	},

	processStateUpdates(app, detail) {
		const store = Store.getInstance();

		// Process HX-Trigger header
		const triggerHeader = detail.headers?.['HX-Trigger'];
		if (triggerHeader) {
			try {
				const triggers = JSON.parse(triggerHeader);
				Object.entries(triggers).forEach(([key, value]) => {
					if (key === 'stateUpdate') {
						const { domain, state } = value;
						store.dispatch({
							domain,
							type: 'UPDATE_FROM_SERVER',
							payload: state
						});
						app.registerData(domain, state);
					} else {
						// Handle other custom triggers
						app.emit(`htmx:trigger:${key}`, value);
					}
				});
			} catch (error) {
				logger.error('Error processing HX-Trigger header:', error);
			}
		}

		// Process state updates in response body
		const stateData = detail.target?.querySelector('[data-state-update]');
		if (stateData) {
			try {
				const updates = JSON.parse(stateData.textContent);
				Object.entries(updates).forEach(([domain, state]) => {
					store.dispatch({
						domain,
						type: 'UPDATE_FROM_SERVER',
						payload: state
					});
					app.registerData(domain, state);
				});
			} catch (error) {
				logger.error('Error processing state updates:', error);
			}
		}
	}
};
