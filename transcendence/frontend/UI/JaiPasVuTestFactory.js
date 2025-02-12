import jaiPasVu from './JaiPasVu.js';
import logger from '../logger.js';
import { jest } from '@jest/globals';

/**
 * Utility function to clean Django template syntax for testing
 * @param {string} template - Django template string
 * @param {Map<string, string>} [includedTemplates] - Map of included template names to their content
 * @returns {string} Cleaned template for testing
 */
function cleanDjangoTemplate(template, includedTemplates = new Map()) {
	// First handle template inheritance if we have includedTemplates
	if (includedTemplates.size > 0) {
		// Handle extends
		const extendsMatch = template.match(/{%\s*extends\s+["']([^"']+)["']\s*%}/);
		if (extendsMatch) {
			const parentName = extendsMatch[1].split('/').pop().replace('.html', '');
			const parentTemplate = includedTemplates.get(parentName);

			if (parentTemplate) {
				// Extract blocks from child template
				const blocks = {};
				template.replace(/{%\s*block\s+(\w+)\s*%}([\s\S]*?){%\s*endblock\s*%}/g, (match, blockName, content) => {
					blocks[blockName] = content.trim();
					return '';
				});

				// Replace blocks in parent template
				template = parentTemplate.replace(/{%\s*block\s+(\w+)\s*%}[\s\S]*?{%\s*endblock\s*%}/g, (match, blockName) => {
					return blocks[blockName] || match;
				});
			} else {
				logger.warn(`Parent template not found: ${extendsMatch[1]} (${parentName})`);
			}
		}

		// Handle includes
		template = template.replace(/{%\s*include\s+["']([^"']+)["']\s*%}/g, (match, includePath) => {
			// Handle different path formats
			let templateName;
			if (includePath.includes('/')) {
				// For paths like 'pong/components/room_state.html'
				templateName = includePath.split('/').pop().replace('.html', '');
			} else {
				// For simple includes like 'ui.html'
				templateName = includePath.replace('.html', '');
			}

			const content = includedTemplates.get(templateName);
			if (!content) {
				logger.warn(`Template include not found: ${includePath} (${templateName})`);
				return match;
			}
			return content;
		});
	}

	return template
		// Remove remaining Django template tags
		.replace(/{%\s*extends[^%]*%}/g, '')
		.replace(/{%\s*include[^%]*%}/g, '')
		.replace(/{%\s*load[^%]*%}/g, '')
		.replace(/{%\s*block\s+\w+\s*%}/g, '')
		.replace(/{%\s*endblock\s*%}/g, '')
		.replace(/{%\s*csrf_token\s*%}/g, '')
		.replace(/{%\s*url\s+['"]([^'"]+)['"]\s*%}/g, '#') // Replace url tags with #
		// Clean up Django variables for testing
		.replace(/{{(\s*\w+[\w\.]*\s*)}}/g, (_, match) => `[[${match.trim()}]]`)
		// Clean up whitespace
		.replace(/>\s+</g, '><')
		.replace(/\s+/g, ' ')
		.trim();
}

// Function to prettify HTML to see a tree structure
// from <div><p><span>Hello</span></p></div>
// to
// <div>
//   <p>
//     <span>Hello</span>
//   </p>
// </div>
function prettifyHtml(html) {
	let indentLevel = 0;
	let result = '';
	const tagStack = [];
	let i = 0;

	while (i < html.length) {
		if (html[i] === '<') {
			// Handle closing tags
			if (html[i + 1] === '/') {
				indentLevel--;
				result += '\n' + '  '.repeat(indentLevel) + html.slice(i, html.indexOf('>', i) + 1);
				i = html.indexOf('>', i) + 1;
				tagStack.pop();
				continue;
			}

			// Handle opening tags
			result += '\n' + '  '.repeat(indentLevel) + html.slice(i, html.indexOf('>', i) + 1);
			i = html.indexOf('>', i) + 1;

			// Check if it's a self-closing tag
			if (!html[i - 2].endsWith('/')) {
				indentLevel++;
				tagStack.push(true);
			}
		} else {
			// Handle text content
			const textEnd = html.indexOf('<', i);
			if (textEnd === -1) break;
			const text = html.slice(i, textEnd).trim();
			if (text) {
				result += '\n' + '  '.repeat(indentLevel) + text;
			}
			i = textEnd;
		}
	}

	return result.trim();
}

export class JaiPasVuTestFactory {
	constructor() {
		this.container = null;
		this.jaiPasVu = null;
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

		// Reset singleton state
		this.jaiPasVu = jaiPasVu;
		this.jaiPasVu.initialized = false;
		this.jaiPasVu.root = null;
		this.jaiPasVu.domains = new Map();
		this.jaiPasVu.updateQueue = new Set();
		this.jaiPasVu.updateScheduled = false;
		this.jaiPasVu.observers = new Map();
		this.jaiPasVu.plugins = new Map();
		Object.values(this.jaiPasVu.hooks).forEach(set => set.clear());

		// Initialize JaiPasVu
		this.jaiPasVu.initialize(this.container);

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

		// Reset singleton state
		if (this.jaiPasVu) {
			this.jaiPasVu.initialized = false;
			this.jaiPasVu.root = null;
			// Remove event listeners
			this._cleanupEventListeners();
			// Clear state
			this.jaiPasVu.domains.clear();
			this.jaiPasVu.observers.clear();
			this.jaiPasVu.plugins.clear();
			// Reset hooks
			Object.values(this.jaiPasVu.hooks).forEach(set => set.clear());
		}

		// Restore spies
		this._restoreSpies();

		// Clear internal state
		this.container = null;
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
			this._spies.set(method, jest.spyOn(this.jaiPasVu, method));
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
		this.jaiPasVu.use(plugin);
	}

	/**
	 * Register a mock hook
	 * @param {string} hookName - Hook name
	 * @param {Function} callback - Hook callback
	 */
	registerMockHook(hookName, callback) {
		const mockCallback = jest.fn(callback);
		this._mockHooks.set(hookName, mockCallback);
		const unsubscribe = this.jaiPasVu.on(hookName, mockCallback);
		return unsubscribe;
	}

	/**
	 * Register a template for later use
	 * @param {string} name - Template name
	 * @param {string} template - Template content
	 * @param {Map<string, string>} [includedTemplates] - Map of included template names to their content
	 */
	registerTemplate(name, template, includedTemplates = new Map()) {
		const cleanedTemplate = cleanDjangoTemplate(template, includedTemplates);
		const prettifiedTemplate = prettifyHtml(cleanedTemplate);
		this._templates.set(name, cleanedTemplate);
	}

	/**
	 * Register multiple templates at once and handle their includes
	 * @param {Object.<string, string>} templates - Object mapping template names to their content
	 */
	registerTemplates(templates) {
		// First register all templates to make them available for includes
		const templateMap = new Map(Object.entries(templates));

		// Then process each template with access to all other templates for includes
		Object.entries(templates).forEach(([name, content]) => {
			this.registerTemplate(name, content, templateMap);
		});
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
		if (!templateContent.includes('data-domain'))
			templateElement.setAttribute('data-domain', domain);
		templateElement.innerHTML = templateContent;

		if (appendMode) {
			this.container.appendChild(templateElement);
		} else {
			this.container.innerHTML = templateElement.outerHTML;
		}

		// If there's existing data for this domain, recompile the template
		const domainData = this.jaiPasVu.domains.get(domain);
		if (domainData) {
			// Get the actual element from the container since templateElement is detached
			const actualElement = this.container.querySelector(`[data-domain="${domain}"]`);
			if (actualElement)
				this.jaiPasVu.compileElement(actualElement, domainData.state);
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
	 * Register data for a domain
	 * @param {string} domain - Domain name
	 * @param {Object} data - Data to register
	 */
	registerData(domain, data) {
		this.jaiPasVu.registerData(domain, data);

		// Find all elements with this domain and force recompile
		const elements = this.container.querySelectorAll(`[data-domain="${domain}"]`);
		if (elements.length > 0) {
			const domainData = this.jaiPasVu.domains.get(domain);
			elements.forEach(el => {
				this.jaiPasVu.compileElement(el, domainData.state);
			});
		}
	}

	/**
	 * Get data for a domain
	 * @param {string} domain - Domain name
	 * @returns {Object} Domain data
	 */
	getData(domain) {
		const domainData = this.jaiPasVu.domains.get(domain);
		return domainData ? domainData.state : null;
	}

	/**
	 * Get debug information about the current state
	 * @returns {Object} Debug information
	 */
	getDebugInfo() {
		return {
			html: this.container?.innerHTML || 'No container',
			registeredData: Object.fromEntries(this.jaiPasVu?.domains || []),
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
	 * Force a complete update of all dynamic elements
	 */
	updateAll() {
		const elements = this.getElementsWithAttribute('data-dynamic');
		elements.forEach(element => {
			const domain = element.closest('[data-domain]')?.getAttribute('data-domain');
			if (domain) {
				this.jaiPasVu.updateElement(element, domain);
			}
		});
	}
} 
