import logger from '../logger.js';
import { store, actions } from '../state/store.js';
import { htmx } from '../vendor.js';

/**
 * HTMXPlugin - Integrates HTMX with JaiPasVu
 * 
 * Features:
 * - Request processing and tracking
 * - State management
 * - Event handling
 * - HTMX-specific directives
 * - State synchronization
 * 
 * Server-side Usage:
 * 1. State Updates via Headers:
 *    Send state updates through HX-Trigger response header:
 *    ```python
 *    response = HttpResponse()
 *    response['HX-Trigger'] = json.dumps({
 *        'stateUpdate': {
 *            'domain': 'domain',
 *            'state': state_dict
 *        }
 *    })
 *    ```
 * 
 * 2. State Updates via Response Body:
 *    Include state updates in your template:
 *    ```html
 *    <script type="application/json" data-state-update>
 *        {
 *            "domain": {
 *                "key": "value"
 *            }
 *        }
 *    </script>
 *    ```
 * 
 * 3. Custom Triggers:
 *    Send custom events through HX-Trigger:
 *    ```python
 *    response['HX-Trigger'] = json.dumps({
 *        'custom_event': {'data': 'value'}
 *    })
 *    ```
 */

export const htmxPlugin = {
	name: 'htmx',
	app: null,

	/**
	 * Installs the HTMX plugin into the application
	 * @param {Object} app - The application instance
	 */
	install(app) {
		this.app = app;

		// Configure HTMX defaults
		htmx.config.defaultSwapStyle = "innerHTML";
		htmx.config.defaultSettleDelay = 100;
		htmx.config.historyCacheSize = 50;

		this._setupEventHandlers(app);

		app.on('beforeMount', () => {
			// Initialize if not a history restore
			if (!document.documentElement.getAttribute('data-htmx-history-restore')) {
				this._initializeHtmx();
			}
		});

		app.navigate = (path, options = {}) => {
            const link = document.createElement('a');
            link.href = path;
            link.setAttribute('hx-get', path);
            link.setAttribute('hx-target', '#content');
            link.setAttribute('hx-push-url', 'true');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
	},

	/**
	 * Initializes HTMX by processing existing HTMX elements
	 * @private
	 */
	_initializeHtmx() {
		document.querySelectorAll('[hx-get], [hx-post]').forEach(el => {
			this.app.compileElement(el);
			htmx.process(el);
		});
		logger.debug('HTMX initialized');
	},

	/**
	 * Sets up HTMX event handlers for the application
	 * @private
	 */
	_setupEventHandlers(app) {
		document.addEventListener("htmx:pushedIntoHistory", function (event) {
			logger.info('[HTMXPlugin] pushedIntoHistory event:', event);
			app.emit('htmx:pushedIntoHistory', event.detail.path);
		});

		document.body.addEventListener('htmx:beforeRequest', (event) => {
			// const target = event.detail.elt;
			// const domain = target.getAttribute('data-domain') || 'global';

			app.emit('htmx:beforeRequest', event);
		});

		document.body.addEventListener('htmx:afterRequest', (event) => {
			// const target = event.detail.elt;
			// const domain = target.getAttribute('data-domain') || 'global';

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
			logger.info('[HTMXPlugin] afterSwap event:', event);
			const target = event.detail.target;
			if (target) {
				// Restore UI state after swap
				const savedUiState = sessionStorage.getItem('ui_state');
				if (savedUiState) {
					const uiState = JSON.parse(savedUiState);
					store.dispatch({
						domain: 'ui',
						type: actions.ui.INITIALIZE,
						payload: uiState
					});
					sessionStorage.removeItem('ui_state');
				}

				// First process state updates from server
				this._processStateUpdates(app, event.detail);

				// Then recompile the swapped element and its children
				app.compileElement(target);

				// Ensure any new HTMX elements are properly initialized
				htmx.process(target);

				// Recompile all reactive elements
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

	/**
	 * Processes state updates received from server responses
	 * @private
	 */
	_processStateUpdates(app, detail) {
		// Process HX-Trigger header from response
		const triggerHeader = detail.headers?.['HX-Trigger'] ||
			detail.xhr?.getResponseHeader('HX-Trigger');

		if (triggerHeader) {
			try {
				logger.info('[HTMXPlugin] triggerHeader:', triggerHeader);
				const triggers = JSON.parse(triggerHeader);
				Object.entries(triggers).forEach(([key, value]) => {
					if (key === 'stateUpdate') {
						const { domain, state } = value;
						logger.info('[HTMXPlugin] stateUpdate from server:', domain, state);
						store.dispatch({
							domain,
							type: 'UPDATE_FROM_SERVER',
							payload: state
						});
					} else {
						// Handle other custom triggers
						app.emit(`htmx:trigger:${key}`, value);
					}
				});
			} catch (error) {
				logger.error('Error processing HX-Trigger header:', error);
			}
		}
	}
};
