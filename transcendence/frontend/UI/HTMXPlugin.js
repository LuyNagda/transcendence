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

		document.addEventListener('popstate', async () => {
			jaiPasVu.scheduleUpdate('chat');
			jaiPasVu.scheduleUpdate('ui');
		});

		document.body.addEventListener('htmx:beforeRequest', (event) => {
			// const target = event.detail.elt;

			app.emit('htmx:beforeRequest', event);
		});

		document.body.addEventListener('htmx:afterRequest', (event) => {
			// const target = event.detail.elt;

			app.emit('htmx:afterRequest', event);
		});

		document.body.addEventListener('htmx:beforeSwap', (event) => {
			// const target = event.detail.target;

			app.emit('htmx:beforeSwap', event);
		});

		if (window.location.pathname.includes('/index')) {
			const response = fetch('/check-user', {
				method: 'GET',
			})
				.then(response => response.json())
				.then(data => {
					store.dispatch({
						domain: 'user',
						type: 'UPDATE_FROM_SERVER',
						payload: data
					});
				})
		}

		document.body.addEventListener('htmx:afterSwap', (event) => {
			logger.info('[HTMXPlugin] afterSwap event:', event);
			const target = event.detail.target;
			if (target) {
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
			app.scheduleUpdate('chat');
			app.emit('htmx:afterSwap', event);
		});

		document.body.addEventListener('htmx:afterSettle', (event) => {
			app.emit('htmx:afterSettle', event);
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
