import JavaisPasVu from './JavaisPasVu.js';

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
	}

	/**
	 * Initialize the test environment
	 */
	setup() {
		this.container = document.createElement('div');
		document.body.appendChild(this.container);
		this.javaisPasVu = JavaisPasVu;
		this.javaisPasVu.initialize(this.container);
	}

	/**
	 * Clean up the test environment
	 */
	cleanup() {
		if (this.container && this.container.parentNode) {
			document.body.removeChild(this.container);
		}
		if (this.javaisPasVu) {
			this.javaisPasVu.destroy();
		}
		this.container = null;
		this.javaisPasVu = null;
		this._templates.clear();
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
	 * @param {boolean} isRegistered - Whether the template is a registered name
	 */
	loadTemplate(template, domain = 'test', isRegistered = false) {
		const templateContent = isRegistered ? this.getTemplate(template) : template;
		if (!templateContent) {
			throw new Error(`Template ${template} not found`);
		}

		this.container.innerHTML = `
            <div data-domain="${domain}" data-dynamic>
                ${templateContent}
            </div>
        `;
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
		return this.javaisPasVu.getData(domain);
	}

	/**
	 * Get debug information about the current state
	 * @returns {Object} Debug information
	 */
	getDebugInfo() {
		return {
			html: this.container?.innerHTML || 'No container',
			registeredData: Array.from(this.javaisPasVu?.domains?.entries() || [])
				.reduce((acc, [domain, data]) => ({ ...acc, [domain]: data }), {}),
			registeredTemplates: Array.from(this._templates.entries())
				.reduce((acc, [name, template]) => ({ ...acc, [name]: template }), {})
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
			console.warn(
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
