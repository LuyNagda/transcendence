import jaiPasVu from './JaiPasVu.js';
import logger from '../logger.js';
import { jest } from '@jest/globals';

/**
 * Utility function to clean Django template syntax for testing
 * @param {string} template - Django template string
 * @returns {string} Cleaned template for testing
 */
function cleanDjangoTemplate(template) {
	return template
		// Remove Django template tags
		.replace(/{%\s*extends[^%]*%}/g, '')
		.replace(/{%\s*include[^%]*%}/g, '')
		.replace(/{%\s*load[^%]*%}/g, '')
		.replace(/{%\s*block\s+\w+\s*%}/g, '')
		.replace(/{%\s*endblock\s*%}/g, '')
		// Clean up Django variables for testing
		.replace(/{{(\s*\w+\s*)}}/g, (_, match) => `[[${match.trim()}]]`)
		// Clean up whitespace
		.replace(/>\s+</g, '><')
		.replace(/\s+/g, ' ')
		.trim();
}

export class JaiPasVuTestFactory {
	constructor() {
		this.container = null;
		this.jaiPasVu = null;
		this._templates = new Map();
		this._mockPlugins = new Map();
		this._mockHooks = new Map();
		this._spies = new Map();
		this._subsystemSpies = new Map();
	}

	/**
	 * Initialize the test environment
	 */
	setup() {
		// Create container
		this.container = document.createElement('div');
		document.body.appendChild(this.container);

		// Reset singleton state
		this.jaiPasVu = jaiPasVu;
		this.jaiPasVu.initialized = false;
		this.jaiPasVu.root = null;
		this.jaiPasVu.updateQueue = new Set();
		this.jaiPasVu.updateScheduled = false;

		// Reset all subsystems
		this.resetSubsystems();

		// Initialize JaiPasVu
		this.jaiPasVu.initialize(this.container);

		// Setup spies for core methods and subsystems
		this._setupSpies();
		this._setupSubsystemSpies();
	}

	/**
	 * Reset all subsystems to their initial state
	 */
	resetSubsystems() {
		// Create fresh instances of all subsystems
		this.jaiPasVu.reactivity = new this.jaiPasVu.reactivity.constructor();
		this.jaiPasVu.events = new this.jaiPasVu.events.constructor();
		this.jaiPasVu.plugins = new this.jaiPasVu.plugins.constructor(this.jaiPasVu);
		this.jaiPasVu.domains = new this.jaiPasVu.domains.constructor(this.jaiPasVu);
		this.jaiPasVu.directives = new this.jaiPasVu.directives.constructor(this.jaiPasVu);
		this.jaiPasVu.compiler = new this.jaiPasVu.compiler.constructor(this.jaiPasVu);
	}

	/**
	 * Clean up the test environment
	 */
	cleanup() {
		// Remove container
		if (this.container && this.container.parentNode) {
			document.body.removeChild(this.container);
		}

		// Reset singleton state
		if (this.jaiPasVu) {
			this.jaiPasVu.initialized = false;
			this.jaiPasVu.root = null;
			// Remove event listeners
			this._cleanupEventListeners();
			// Reset subsystems
			this.resetSubsystems();
		}

		// Restore spies
		this._restoreSpies();
		this._restoreSubsystemSpies();

		// Clear internal state
		this.container = null;
		this._templates.clear();
		this._mockPlugins.clear();
		this._mockHooks.clear();
		this._spies.clear();
		this._subsystemSpies.clear();
	}

	/**
	 * Setup spies for core methods
	 */
	_setupSpies() {
		const methodsToSpy = [
			'registerData',
			'registerMethods',
			'registerComputed',
			'getState',
			'cleanup'
		];

		methodsToSpy.forEach(method => {
			this._spies.set(method, jest.spyOn(this.jaiPasVu, method));
		});
	}

	/**
	 * Setup spies for subsystem methods
	 */
	_setupSubsystemSpies() {
		// Reactivity System
		this._spySubsystem('reactivity', ['push', 'pop', 'createReactive']);

		// Event System
		this._spySubsystem('events', ['on', 'off', 'emit']);

		// Plugin System
		this._spySubsystem('plugins', ['use']);

		// Domain System
		this._spySubsystem('domains', [
			'registerData',
			'registerMethods',
			'registerComputed',
			'getState',
			'subscribe',
			'unsubscribe',
			'notifyObservers'
		]);

		// Directive System
		this._spySubsystem('directives', [
			'processDirectives',
			'processVIf',
			'processVText',
			'processVFor',
			'processVModel',
			'processVBind',
			'processVOn',
			'processInterpolation'
		]);

		// Template Compiler
		this._spySubsystem('compiler', [
			'compileElement',
			'createContext',
			'evaluateExpression'
		]);
	}

	/**
	 * Spy on methods of a subsystem
	 */
	_spySubsystem(subsystemName, methods) {
		if (!this._subsystemSpies.has(subsystemName)) {
			this._subsystemSpies.set(subsystemName, new Map());
		}
		const subsystemSpies = this._subsystemSpies.get(subsystemName);
		methods.forEach(method => {
			subsystemSpies.set(
				method,
				jest.spyOn(this.jaiPasVu[subsystemName], method)
			);
		});
	}

	/**
	 * Restore all subsystem spies
	 */
	_restoreSubsystemSpies() {
		this._subsystemSpies.forEach(subsystemSpies => {
			subsystemSpies.forEach(spy => spy.mockRestore());
		});
	}

	/**
	 * Get spy for a specific subsystem method
	 */
	getSubsystemSpy(subsystem, method) {
		return this._subsystemSpies.get(subsystem)?.get(method);
	}

	/**
	 * Restore all spies
	 */
	_restoreSpies() {
		this._spies.forEach(spy => spy.mockRestore());
	}

	/**
	 * Clean up event listeners
	 */
	_cleanupEventListeners() {
		const events = [
			'htmx:beforeRequest',
			'htmx:afterRequest',
			'htmx:beforeSwap',
			'htmx:afterSwap',
			'htmx:responseError'
		];

		events.forEach(event => {
			document.body.removeEventListener(event, () => { });
		});
	}

	/**
	 * Register a mock plugin
	 * @param {string} name - Plugin name
	 * @param {Object} mockImplementation - Mock plugin implementation
	 */
	registerMockPlugin(name, mockImplementation) {
		const plugin = {
			name,
			install: jest.fn(),
			...mockImplementation
		};
		this._mockPlugins.set(name, plugin);
		this.jaiPasVu.plugins.use(plugin);
	}

	/**
	 * Register a mock hook
	 * @param {string} hookName - Hook name
	 * @param {Function} callback - Hook callback
	 */
	registerMockHook(hookName, callback) {
		const mockCallback = jest.fn(callback);
		this._mockHooks.set(hookName, mockCallback);
		const unsubscribe = this.jaiPasVu.events.on(hookName, mockCallback);
		// Immediately trigger the hook for testing if needed
		if (hookName === 'beforeCompile' || hookName === 'afterCompile') {
			this.emit(hookName, document.createElement('div'));
		}
		return unsubscribe;
	}

	/**
	 * Register a template for later use
	 * @param {string} name - Template name
	 * @param {string} template - Template content
	 */
	registerTemplate(name, template) {
		this._templates.set(name, cleanDjangoTemplate(template));
	}

	/**
	 * Get a registered template
	 * @param {string} name - Template name
	 * @returns {string|null} Template content or null if not found
	 */
	getTemplate(name) {
		return this._templates.get(name) || null;
	}

	/**
	 * Load a template into the test container
	 * @param {string} template - HTML template string or template name
	 * @param {string} domain - Domain name for the template
	 * @param {Object} options - Additional options
	 */
	loadTemplate(template, domain = 'test', options = {}) {
		const {
			isRegistered = false,
			preserveContainer = false,
			appendMode = false
		} = options;

		const templateContent = isRegistered ? this.getTemplate(template) : template;
		if (!templateContent) {
			throw new Error(`Template ${template} not found`);
		}

		if (!preserveContainer) {
			this.container.innerHTML = '';
		}

		const templateElement = document.createElement('div');
		templateElement.setAttribute('data-domain', domain);
		templateElement.innerHTML = templateContent;

		if (appendMode) {
			this.container.appendChild(templateElement);
		} else {
			this.container.innerHTML = templateElement.outerHTML;
		}

		// If there's existing data for this domain, recompile the template
		const domainData = this.jaiPasVu.domains.getState(domain);
		if (domainData) {
			// Get the actual element from the container since templateElement is detached
			const actualElement = this.container.querySelector(`[data-domain="${domain}"]`);
			if (actualElement) {
				this.jaiPasVu.compiler.compileElement(actualElement, domainData);
			}
		}

		// Return the actual element from the container, not the detached templateElement
		return this.container.querySelector(`[data-domain="${domain}"]`);
	}

	/**
	 * Create and dispatch a custom HTMX event
	 * @param {string} eventName - HTMX event name
	 * @param {Object} detail - Event detail
	 * @returns {CustomEvent} The dispatched event
	 */
	dispatchHtmxEvent(eventName, detail = {}) {
		const event = new CustomEvent(eventName, { detail });
		document.dispatchEvent(event);
		return event;
	}

	/**
	 * Simulate an HTMX swap operation
	 * @param {Object} options - Swap options
	 */
	simulateHtmxSwap({
		target,
		newContent,
		beforeSwap = () => { },
		afterSwap = () => { }
	}) {
		// Before swap
		const beforeEvent = this.dispatchHtmxEvent('htmx:beforeSwap', {
			target,
			newContent
		});
		beforeSwap(beforeEvent);

		// Perform swap
		if (target && newContent) {
			target.innerHTML = newContent;
		}

		// After swap
		const afterEvent = this.dispatchHtmxEvent('htmx:afterSwap', {
			target,
			newContent
		});
		afterSwap(afterEvent);
	}

	/**
	 * Get spy for a specific method
	 * @param {string} method - Method name
	 * @returns {jest.SpyInstance} The spy instance
	 */
	getSpy(method) {
		return this._spies.get(method);
	}

	/**
	 * Get mock plugin
	 * @param {string} name - Plugin name
	 * @returns {Object} The mock plugin
	 */
	getMockPlugin(name) {
		return this._mockPlugins.get(name);
	}

	/**
	 * Get mock hook
	 * @param {string} hookName - Hook name
	 * @returns {jest.Mock} The mock hook
	 */
	getMockHook(hookName) {
		return this._mockHooks.get(hookName);
	}

	/**
	 * Register data for a domain with subsystem support
	 */
	registerData(domain, data) {
		this.jaiPasVu.domains.registerData(domain, data);

		// Find all elements with this domain and force recompile
		const elements = this.container.querySelectorAll(`[data-domain="${domain}"]`);
		if (elements.length > 0) {
			const domainData = this.jaiPasVu.domains.getState(domain);
			elements.forEach(el => {
				this.jaiPasVu.compiler.compileElement(el, domainData);
			});
		}

		// Return the reactive state for chaining and testing
		return this.jaiPasVu.domains.getState(domain);
	}

	/**
	 * Get data for a domain using the domain system
	 */
	getData(domain) {
		return this.jaiPasVu.domains.getState(domain);
	}

	/**
	 * Get debug information about the current state including subsystems
	 */
	getDebugInfo() {
		return {
			html: this.container?.innerHTML || 'No container',
			registeredData: Object.fromEntries(
				Array.from(this.jaiPasVu.domains.domains.entries()).map(([key, value]) => [
					key,
					value.state
				])
			),
			registeredPlugins: Array.from(this.jaiPasVu.plugins.plugins.keys()),
			registeredHooks: Object.fromEntries(
				Object.entries(this.jaiPasVu.events.hooks).map(([key, set]) => [key, set.size])
			),
			activeSpies: Array.from(this._spies.keys()),
			activeSubsystemSpies: Object.fromEntries(
				Array.from(this._subsystemSpies.entries()).map(([system, spies]) => [
					system,
					Array.from(spies.keys())
				])
			)
		};
	}

	/**
	 * Enhanced query method with better error messages
	 * @param {string} selector - CSS selector
	 * @returns {Element} Matching element
	 * @throws {Error} Detailed error when element not found
	 */
	query(selector) {
		const element = this.container.querySelector(selector);
		if (!element && process.env.NODE_ENV === 'test') {
			const debugInfo = this.getDebugInfo();
			throw new Error(
				`Element not found: ${selector}\n\n` +
				`Current container HTML:\n${debugInfo.html}\n\n` +
				`Registered data:\n${JSON.stringify(debugInfo.registeredData, null, 2)}`
			);
		}
		return element;
	}

	/**
	 * Query all matching elements in the container
	 * @param {string} selector - CSS selector
	 * @returns {NodeList} Matching elements
	 */
	queryAll(selector) {
		return this.container.querySelectorAll(selector);
	}

	/**
	 * Get text content of elements matching a selector
	 * @param {string} selector - CSS selector
	 * @returns {string[]} Array of text content
	 */
	getTextContent(selector) {
		return Array.from(this.queryAll(selector))
			.map(el => el.textContent.replace(/\s+/g, ' ').trim());
	}

	/**
	 * Get attributes of elements matching a selector
	 * @param {string} selector - CSS selector
	 * @param {string} attribute - Attribute name
	 * @returns {string[]} Array of attribute values
	 */
	getAttributes(selector, attribute) {
		return Array.from(this.queryAll(selector))
			.map(el => el.getAttribute(attribute))
			.filter(Boolean);
	}

	/**
	 * Enhanced exists method with better error messages
	 * @param {string} selector - CSS selector
	 * @returns {boolean} Whether the element exists
	 */
	exists(selector) {
		const exists = this.container.querySelector(selector) !== null;
		if (!exists && process.env.NODE_ENV === 'test') {
			logger.warn(
				`Element does not exist: ${selector}\n` +
				`Current container HTML:\n${this.container.innerHTML}`
			);
		}
		return exists;
	}

	/**
	 * Check if an element is visible
	 * @param {string} selector - CSS selector
	 * @returns {boolean} Whether the element is visible
	 */
	isVisible(selector) {
		const element = this.query(selector);
		if (!element) return false;

		// Check if element exists and is not display:none
		const style = window.getComputedStyle(element);
		const isDisplayed = style.display !== 'none';

		// Log visibility state for debugging
		logger.debug(`Visibility check for ${selector}:`, {
			element: element.outerHTML,
			style: style.display,
			isDisplayed
		});

		return isDisplayed;
	}

	/**
	 * Get all elements with a specific attribute
	 * @param {string} attribute - Attribute name
	 * @returns {Element[]} Array of elements
	 */
	getElementsWithAttribute(attribute) {
		return Array.from(this.queryAll(`[${attribute}]`));
	}

	/**
	 * Update all dynamic elements
	 */
	updateAll() {
		const elements = this.getElementsWithAttribute('data-dynamic');
		elements.forEach(element => {
			const domain = element.closest('[data-domain]')?.getAttribute('data-domain');
			if (domain) {
				const domainData = this.jaiPasVu.domains.getState(domain);
				if (domainData) {
					this.jaiPasVu.compiler.compileElement(element, domainData);
				}
			}
		});
	}

	/**
	 * Emit an event through the event system
	 */
	emit(hookName, ...args) {
		this.jaiPasVu.events.emit(hookName, ...args);
	}
} 
