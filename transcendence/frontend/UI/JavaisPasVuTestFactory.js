import javaisPasVu from './JavaisPasVu.js';
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
		.replace(/{{(\s*\w+\s*)}}/g, '$1')
		.trim();
}

export class JavaisPasVuTestFactory {
	constructor() {
		this.container = null;
		this.javaisPasVu = null;
		this._templates = new Map();
		this._mockPlugins = new Map();
		this._mockHooks = new Map();
		this._spies = new Map();
	}

	/**
	 * Initialize the test environment
	 */
	setup() {
		// Create container
		this.container = document.createElement('div');
		document.body.appendChild(this.container);

		// Initialize JavaisPasVu
		this.javaisPasVu = javaisPasVu;
		this.javaisPasVu.initialize(this.container);

		// Setup spies for core methods
		this._setupSpies();
	}

	/**
	 * Clean up the test environment
	 */
	cleanup() {
		// Remove container
		if (this.container && this.container.parentNode) {
			document.body.removeChild(this.container);
		}

		// Cleanup JavaisPasVu instance
		if (this.javaisPasVu) {
			// Remove event listeners
			this._cleanupEventListeners();
			// Clear state
			this.javaisPasVu.domains.clear();
			this.javaisPasVu.observers.clear();
			this.javaisPasVu.plugins.clear();
			// Reset hooks
			Object.values(this.javaisPasVu.hooks).forEach(set => set.clear());
		}

		// Restore spies
		this._restoreSpies();

		// Clear internal state
		this.container = null;
		this.javaisPasVu = null;
		this._templates.clear();
		this._mockPlugins.clear();
		this._mockHooks.clear();
		this._spies.clear();
	}

	/**
	 * Setup spies for core methods
	 */
	_setupSpies() {
		const methodsToSpy = [
			'registerData',
			'registerMethods',
			'updateElement',
			'compileElement',
			'cleanup'
		];

		methodsToSpy.forEach(method => {
			this._spies.set(method, jest.spyOn(this.javaisPasVu, method));
		});
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
		this.javaisPasVu.use(plugin);
	}

	/**
	 * Register a mock hook
	 * @param {string} hookName - Hook name
	 * @param {Function} callback - Hook callback
	 */
	registerMockHook(hookName, callback) {
		const mockCallback = jest.fn(callback);
		this._mockHooks.set(hookName, mockCallback);
		this.javaisPasVu.on(hookName, mockCallback);
		return mockCallback;
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

		const templateElement = document.createElement('div');
		templateElement.setAttribute('data-domain', domain);
		templateElement.setAttribute('data-dynamic', '');
		templateElement.innerHTML = templateContent;

		if (!preserveContainer) {
			this.container.innerHTML = '';
		}

		if (appendMode) {
			this.container.appendChild(templateElement);
		} else {
			this.container.innerHTML = templateElement.outerHTML;
		}

		return templateElement;
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
	 * Register data for a domain
	 * @param {string} domain - Domain name
	 * @param {Object} data - Data to register
	 */
	registerData(domain, data) {
		this.javaisPasVu.registerData(domain, data);
	}

	/**
	 * Get data for a domain
	 * @param {string} domain - Domain name
	 * @returns {Object} Domain data
	 */
	getData(domain) {
		const domainData = this.javaisPasVu.domains.get(domain);
		return domainData ? domainData.state : null;
	}

	/**
	 * Get debug information about the current state
	 * @returns {Object} Debug information
	 */
	getDebugInfo() {
		return {
			html: this.container?.innerHTML || 'No container',
			registeredData: Object.fromEntries(this.javaisPasVu?.domains || []),
			registeredPlugins: Array.from(this._mockPlugins.keys()),
			registeredHooks: Array.from(this._mockHooks.keys()),
			activeSpies: Array.from(this._spies.keys())
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

		const style = window.getComputedStyle(element);
		return style.display !== 'none' &&
			style.visibility !== 'hidden' &&
			style.opacity !== '0';
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
	 * Force a complete update of all dynamic elements
	 */
	updateAll() {
		const elements = this.getElementsWithAttribute('data-dynamic');
		elements.forEach(element => {
			const domain = element.closest('[data-domain]')?.getAttribute('data-domain');
			if (domain) {
				this.javaisPasVu.updateElement(element, domain);
			}
		});
	}
} 
