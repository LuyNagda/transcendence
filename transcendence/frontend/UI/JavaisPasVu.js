/**
 * JavaisPasVu - A lightweight reactive UI framework
 * 
 * A standalone library providing Vue-like features:
 * - Reactive data binding
 * - Template directives
 * - Event handling
 * - Component lifecycle
 * 
 * Supported directives:
 * - v-text: Text content binding
 * - v-if: Conditional rendering
 * - v-else-if: Conditional rendering
 * - v-else: Conditional rendering
 * - v-for: List rendering
 * - v-model: Two-way data binding
 * - v-on: Event handling
 * - v-bind:style: Style binding
 */
import logger from "../logger.js";

class JavaisPasVu {
    constructor() {
        this.initialized = false;
        this.root = null;
        this.data = new Map();
        this.methods = new Map();
        this.observers = new Map();
        this.updateQueue = new Set();
        this.updateScheduled = false;
        this.computed = new Map();
    }

    initialize(root = document.body) {
        if (this.initialized) {
            logger.warn("JavaisPasVu is already initialized");
            return;
        }
        this.root = root;
        this.initialized = true;
        logger.info("JavaisPasVu initialized");
    }

    /**
     * Register reactive data for a specific domain
     */
    registerData(domain, data, computedProps = {}) {
        // Register computed properties
        if (Object.keys(computedProps).length > 0) {
            this.registerComputed(domain, computedProps);
        }

        // Get existing methods and data
        const methods = this.methods.get(domain) || {};
        const existingData = this.data.get(domain) || {};

        // Combine new data with existing methods and data
        const combinedData = {
            ...existingData,  // Keep existing data
            ...data,          // Add new data
            ...methods        // Preserve methods
        };

        // Create reactive data
        const reactiveData = this.makeReactive(combinedData, domain);
        this.data.set(domain, reactiveData);

        // Schedule an update for this domain
        this.scheduleUpdate(domain);
    }

    /**
     * Register methods for a specific domain
     */
    registerMethods(domain, methods) {
        // Store methods separately
        this.methods.set(domain, methods);

        // Update existing data with methods
        const currentData = this.data.get(domain);
        if (currentData) {
            const updatedData = {
                ...currentData,
                ...methods
            };
            this.data.set(domain, this.makeReactive(updatedData, domain));
        }
    }

    /**
     * Register computed properties for a domain
     */
    registerComputed(domain, computedProps) {
        // Validate computed properties
        Object.entries(computedProps).forEach(([key, value]) => {
            if (typeof value !== 'function') {
                logger.error(`Computed property ${key} must be a function`);
                delete computedProps[key];
            }
        });

        this.computed.set(domain, computedProps);

        // Update existing data if it exists
        const currentData = this.data.get(domain);
        if (currentData) {
            const updatedData = this.makeReactive({ ...currentData }, domain);
            this.data.set(domain, updatedData);
        }
    }

    /**
     * Make an object reactive with computed properties
     */
    makeReactive(obj, domain) {
        const self = this;
        const computedProps = this.computed.get(domain) || {};
        const computedCache = new Map();

        // Create a proxy that includes both regular and computed properties
        const proxy = new Proxy(obj, {
            get(target, prop) {
                // First check if it's a computed property
                if (computedProps[prop]) {
                    // Use cached value if available
                    if (!computedCache.has(prop)) {
                        // Bind the computed function to the proxy itself so this refers to all properties
                        const boundFn = computedProps[prop].bind(proxy);
                        try {
                            computedCache.set(prop, boundFn());
                        } catch (error) {
                            logger.error('Error computing property:', error);
                            computedCache.set(prop, null);
                        }
                    }
                    return computedCache.get(prop);
                }
                return target[prop];
            },
            set(target, prop, value) {
                if (target[prop] !== value) {
                    target[prop] = value;
                    // Clear computed cache when any property changes
                    computedCache.clear();
                    self.scheduleUpdate(domain);
                }
                return true;
            }
        });

        return proxy;
    }

    /**
     * Subscribe to data changes for a domain
     */
    subscribe(domain, callback) {
        if (!this.observers.has(domain))
            this.observers.set(domain, new Set());
        this.observers.get(domain).add(callback);
    }

    /**
     * Unsubscribe from data changes
     */
    unsubscribe(domain, callback) {
        if (this.observers.has(domain))
            this.observers.get(domain).delete(callback);
    }

    // Schedule a UI update for a specific domain
    scheduleUpdate(domain) {
        if (!this.updateQueue) {
            this.updateQueue = new Set();
        }
        this.updateQueue.add(domain);

        if (!this.updateScheduled) {
            this.updateScheduled = true;
            requestAnimationFrame(() => this.processUpdates());
        }
    }

    processUpdates() {
        try {
            this.updateQueue.forEach(domain => {
                const elements = document.querySelectorAll(`[data-domain="${domain}"]`);
                elements.forEach(el => this.updateElement(el, domain));
            });
        } catch (error) {
            logger.error('Error processing updates:', error);
        } finally {
            this.updateQueue.clear();
            this.updateScheduled = false;
        }
    }

    notifyObservers(domain) {
        if (this.observers.has(domain)) {
            const state = this.data.get(domain);
            this.observers.get(domain).forEach(observer => {
                try {
                    observer(state);
                } catch (error) {
                    logger.error(`Error notifying observer for domain ${domain}:`, error);
                }
            });

        }

    }

    // Update all elements bound to a specific domain
    updateDomainBindings(domain) {
        const elements = this.root.querySelectorAll(`[data-bind-${domain}]`);
        elements.forEach(el => {
            this.updateElement(el, domain);
        });
    }

    // Update a specific element's bindings
    updateElement(el, domain) {
        const state = this.data.get(domain);
        if (!state) {
            logger.warn(`No state found for domain: ${domain}`);
            return;
        }

        // Create initial context for the domain element
        const initialContext = {
            _domain: domain,
            ...state
        };

        // Find all v-for markers using TreeWalker
        const walker = document.createTreeWalker(
            el,
            NodeFilter.SHOW_COMMENT,
            {
                acceptNode: (node) => {
                    return node.nodeType === Node.COMMENT_NODE &&
                        node.textContent.includes('v-for:') ?
                        NodeFilter.FILTER_ACCEPT :
                        NodeFilter.FILTER_REJECT;
                }
            }
        );

        // Process each v-for section
        let node;
        const processedMarkers = new Set();
        while (node = walker.nextNode()) {
            if (node.textContent.includes('start')) {
                const binding = node.textContent.replace('v-for: ', '').replace(' start', '');
                const forKey = `__v_for_${binding.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const parent = node.parentNode;
                const template = parent[`${forKey}_template`];

                if (template) {
                    // Re-trigger v-for binding with the template
                    this.bindFor(template, binding, initialContext);
                    processedMarkers.add(forKey);
                }
            }
        }

        // Process v-for elements that haven't been processed yet
        const vForElements = el.querySelectorAll('[v-for]');
        vForElements.forEach(element => {
            const vFor = element.getAttribute('v-for');
            if (vFor) {
                const forKey = `__v_for_${vFor.replace(/[^a-zA-Z0-9]/g, '_')}`;
                if (!processedMarkers.has(forKey)) {
                    this.bindFor(element, vFor, initialContext);
                }
            }
        });

        // Process other elements
        const domainElements = new Set();

        // Add the root element if it has the matching domain
        if (el.getAttribute('data-domain') === domain) {
            domainElements.add(el);
        }

        // Add all matching descendant elements
        el.querySelectorAll(`[data-domain="${domain}"]`).forEach(element => {
            if (!element.hasAttribute('v-for')) {
                domainElements.add(element);
            }
        });

        // Process each domain element and its children
        domainElements.forEach(domainEl => {
            // Process directives on the current element
            this.processDirectives(domainEl, initialContext);

            // Process child elements that don't have v-for
            const processChildren = (element, context) => {
                const children = Array.from(element.children);
                children.forEach(child => {
                    if (!child.hasAttribute('v-for') &&
                        (!child.hasAttribute('data-domain') || child.getAttribute('data-domain') === domain)) {
                        const childContext = Object.create(context);
                        this.processDirectives(child, childContext);
                        processChildren(child, childContext);
                    }
                });
            };

            processChildren(domainEl, initialContext);
        });

        // Notify observers after all updates are complete
        this.notifyObservers(domain);
    }

    // Process all directives on a single element
    processDirectives(element, context = null) {
        try {
            // Get domain from element or closest ancestor
            const domain = element.getAttribute('data-domain') || element.closest('[data-domain]')?.getAttribute('data-domain');
            const effectiveDomain = domain || (context && context._domain);
            const state = effectiveDomain ? this.data.get(effectiveDomain) : null;

            // Create evaluation context
            const evalContext = context ? Object.create(context) : {};
            Object.assign(evalContext, {
                _domain: effectiveDomain,
                ...(state || {})
            });

            // Process directives in order: v-if, others
            const attributes = Array.from(element.attributes);

            // Process v-if first
            const vIf = attributes.find(attr => attr.name === 'v-if');
            const vElseIf = attributes.find(attr => attr.name === 'v-else-if');
            const vElse = attributes.find(attr => attr.name === 'v-else');

            if (vIf || vElseIf || vElse) {
                const result = this.bindIf(element, evalContext);
                if (!result) return;
            }

            // Process other directives if element is visible
            if (element.style.display !== 'none') {
                attributes.forEach(attr => {
                    try {
                        switch (attr.name) {
                            case 'v-text':
                                this.bindText(element, attr.value, evalContext);
                                break;
                            case 'v-model':
                                this.bindModel(element, evalContext, effectiveDomain);
                                break;
                            case 'v-bind:style':
                                this.bindStyle(element, attr.value, evalContext);
                                break;
                            default:
                                if (attr.name.startsWith('v-on:') || attr.name.startsWith('@')) {
                                    const event = attr.name.slice(attr.name.indexOf(':') + 1);
                                    this.bindOn(element, effectiveDomain, event, evalContext, attr.value);
                                }
                        }
                    } catch (error) {
                        logger.error(`Error processing directive ${attr.name}:`, error);
                    }
                });
            }
        } catch (error) {
            logger.error('Error in processDirectives:', error);
        }
    }

    // Directive handlers
    bindText(element, expression, context) {
        try {
            const value = this.evaluateExpression(expression, context);
            element.textContent = value;
        } catch (error) {
            logger.error('Error in bindText:', error);
        }
    }

    bindIf(element, context) {
        try {
            const ifBinding = element.getAttribute('v-if');
            const elseIfBinding = element.getAttribute('v-else-if');
            const hasElse = element.hasAttribute('v-else');

            // Find the first v-if element in the chain
            let previousElement = element.previousElementSibling;
            let firstIfElement = null;
            let anyPreviousTrue = false;

            while (previousElement) {
                if (previousElement.hasAttribute('v-if')) {
                    firstIfElement = previousElement;
                    break;
                }
                if (previousElement.hasAttribute('v-else-if') || previousElement.hasAttribute('v-else')) {
                    previousElement = previousElement.previousElementSibling;
                } else {
                    break;
                }
            }

            // Check if any previous condition in the chain was true
            if (firstIfElement && (elseIfBinding || hasElse)) {
                let checkElement = firstIfElement;
                while (checkElement && checkElement !== element) {
                    if (checkElement.style.display !== 'none') {
                        anyPreviousTrue = true;
                        break;
                    }
                    checkElement = checkElement.nextElementSibling;
                }
            }

            let show = false;

            if (ifBinding) {
                show = this.evaluateExpression(ifBinding, context);
            } else if (elseIfBinding && !anyPreviousTrue) {
                if (!firstIfElement) {
                    console.warn('v-else-if used without preceding v-if:', element);
                } else {
                    show = this.evaluateExpression(elseIfBinding, context);
                }
            } else if (hasElse && !anyPreviousTrue) {
                if (!firstIfElement) {
                    console.warn('v-else used without preceding v-if:', element);
                } else {
                    show = true;
                }
            }

            // Apply visibility
            element.style.display = show ? '' : 'none';
            return show;
        } catch (error) {
            console.error('Error in bindIf:', error);
            element.style.display = 'none';
            return false;
        }
    }

    processTextInterpolation(element, context) {
        const textNodes = Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        textNodes.forEach(node => {
            const text = node.textContent;
            const interpolationRegex = /\{\{(.*?)\}\}/g;
            const matches = text.match(interpolationRegex);

            if (matches) {
                let newText = text;
                matches.forEach(match => {
                    const expression = match.slice(2, -2).trim();
                    const value = this.evaluateExpression(expression, context);
                    newText = newText.replace(match, value);
                });
                node.textContent = newText;
            }
        });

        // Process child elements recursively
        Array.from(element.children).forEach(child => {
            this.processTextInterpolation(child, context);
        });
    }

    bindFor(el, binding, context) {
        try {
            // Parse v-for expression (e.g., "item in items" or "(item, index) in items")
            const [iteratorExp, arrayExp] = binding.split(' in ').map(s => s.trim());
            let itemName, indexName;

            if (iteratorExp.startsWith('(')) {
                // Handle (item, index) format
                const [item, index] = iteratorExp.slice(1, -1).split(',').map(s => s.trim());
                itemName = item;
                indexName = index;
            } else {
                // Handle simple item format
                itemName = iteratorExp;
                indexName = 'index';
            }

            // Get the array to iterate over
            const items = this.evaluateExpression(arrayExp, context);
            if (!Array.isArray(items)) {
                logger.warn('v-for items not an array:', { binding, items });
                return;
            }

            const parent = el.parentNode;
            if (!parent) return;

            // Create a unique key for this v-for instance
            const forKey = `__v_for_${binding.replace(/[^a-zA-Z0-9]/g, '_')}`;

            // Get or create template
            let template = parent[`${forKey}_template`];
            if (!template) {
                // Store original element as template
                template = el.cloneNode(true);
                template.setAttribute('v-for', binding); // Keep v-for attribute on template
                parent[`${forKey}_template`] = template;

                // Create markers
                const startMarker = document.createComment(`v-for: ${binding} start`);
                const endMarker = document.createComment(`v-for: ${binding} end`);
                parent[`${forKey}_start`] = startMarker;
                parent[`${forKey}_end`] = endMarker;

                // Initial setup: replace original element with markers
                parent.insertBefore(startMarker, el);
                parent.insertBefore(endMarker, el.nextSibling);
                parent.removeChild(el);
            }

            const startMarker = parent[`${forKey}_start`];
            const endMarker = parent[`${forKey}_end`];

            // Remove all existing elements between markers
            let current = startMarker.nextSibling;
            const elementsToRemove = [];
            while (current && current !== endMarker) {
                elementsToRemove.push(current);
                current = current.nextSibling;
            }
            elementsToRemove.forEach(el => parent.removeChild(el));

            // Create fragment to hold new elements
            const fragment = document.createDocumentFragment();

            // Create new elements
            items.forEach((item, index) => {
                const clone = template.cloneNode(true);
                clone.removeAttribute('v-for');

                // Create item context that inherits from parent context
                const itemContext = Object.create(context);
                itemContext[itemName] = item;
                itemContext[indexName] = index;

                // Process text interpolation first
                this.processTextInterpolation(clone, itemContext);

                // Process all other directives
                this.processDirectives(clone, itemContext);

                // Add to fragment
                fragment.appendChild(clone);
            });

            // Insert all elements at once
            parent.insertBefore(fragment, endMarker);

            // Store current items for future updates
            parent[`${forKey}_items`] = items;

        } catch (error) {
            logger.error('Error in v-for binding:', error);
        }
    }

    processChildren(element, parentContext = null) {
        const children = Array.from(element.children);
        children.forEach(child => {
            // Process directives on child with parent context
            this.processDirectives(child, parentContext);
            // Recursively process grandchildren
            if (child.children.length > 0) {
                this.processChildren(child, parentContext);
            }
        });
    }

    bindModel(el, state, domain) {
        const modelBinding = el.getAttribute('v-model');
        if (!modelBinding) return;

        try {
            // Get initial value from state
            const value = this.getDataValue(domain, modelBinding);

            // Set initial value based on input type
            if (el.type === 'checkbox') {
                el.checked = Boolean(value);
            } else if (el.tagName === 'SELECT') {
                el.value = value || '';
                // Trigger change event to ensure proper initialization
                el.dispatchEvent(new Event('change'));
            } else {
                el.value = value || '';
            }

            // Add event listener for changes
            const eventType = el.type === 'checkbox' ? 'change' : 'input';
            const eventKey = `__bound_${eventType}_${modelBinding}`;

            // Remove existing listener if any
            if (el[eventKey]) {
                el.removeEventListener(eventType, el[eventKey]);
            }

            // Create new listener
            const listener = (event) => {
                let newValue;
                if (el.type === 'checkbox') {
                    newValue = event.target.checked;
                    // Ensure the checked state is updated immediately
                    el.checked = newValue;
                } else if (el.tagName === 'SELECT') {
                    newValue = event.target.value;
                    // Ensure the select value is updated immediately
                    el.value = newValue;
                } else {
                    newValue = event.target.value;
                }

                this.setDataValue(domain, modelBinding, newValue);
                // Schedule an update after the value changes
                this.scheduleUpdate(domain);
                // Notify observers
                this.notifyObservers(domain);
            };

            // Store and add the listener
            el[eventKey] = listener;
            el.addEventListener(eventType, listener);

            // For select elements, also listen for change events
            if (el.tagName === 'SELECT') {
                const changeKey = `__bound_change_${modelBinding}`;
                if (el[changeKey]) {
                    el.removeEventListener('change', el[changeKey]);
                }
                el[changeKey] = listener;
                el.addEventListener('change', listener);
            }
        } catch (error) {
            logger.error('Error in v-model binding:', error);
        }
    }

    bindStyle(el, state) {
        const styleBinding = el.getAttribute('v-bind:style');
        if (styleBinding) {
            const styles = this.evaluateExpression(styleBinding, state);
            Object.entries(styles).forEach(([prop, value]) => {
                el.style[prop] = value;
            });
        }
    }

    bindOn(el, domain, event, context = null, handlerExpr) {
        if (!handlerExpr) {
            handlerExpr = el.getAttribute(`v-on:${event}`) || el.getAttribute(`@${event}`);
        }
        if (!handlerExpr) return;

        // Create a consistent key for the event listener
        const eventKey = `__bound_${event}_${handlerExpr}`;
        const methodKey = `__method_${handlerExpr.split('(')[0]}`;

        // Remove existing listener if any
        if (el[eventKey]) {
            el.removeEventListener(event, el[eventKey]);
        }

        // Create new event listener
        const listener = (e) => {
            try {
                const state = this.data.get(domain);
                const methods = this.methods.get(domain);

                // Extract method name and arguments
                const methodMatch = handlerExpr.match(/^(\w+)(?:\((.*)\))?$/);
                if (!methodMatch) {
                    logger.error('Invalid method format:', handlerExpr);
                    return;
                }

                const [, methodName, argsStr = ''] = methodMatch;
                let args = [];

                // Parse arguments if they exist
                if (argsStr.trim()) {
                    args = argsStr.split(',')
                        .map(arg => arg.trim())
                        .map(arg => {
                            switch (arg) {
                                case '$event':
                                    return e;
                                case '$event.target.value':
                                    return e.target.value;
                                case '$event.target.checked':
                                    return e.target.checked;
                                default:
                                    if (arg.startsWith("'") || arg.startsWith('"')) {
                                        return arg.slice(1, -1);
                                    }
                                    return this.evaluateExpression(arg, context || state);
                            }
                        });
                }

                // Find the method in methods first, then in state
                let method = methods && methods[methodName];
                if (!method && state) {
                    method = state[methodName];
                }

                // Store the method reference for testing purposes
                el[methodKey] = method;

                if (typeof method === 'function') {
                    method.apply(state, args);
                    // Trigger an update after method execution
                    this.updateDomainBindings(domain);
                } else {
                    logger.error(`Method ${methodName} not found in domain ${domain}`);
                }
            } catch (error) {
                logger.error('Error in event handler:', error);
            }
        };

        // Store and add the listener
        el[eventKey] = listener;
        el.addEventListener(event, listener);

        // Pre-bind the method for testing purposes
        const methods = this.methods.get(domain);
        if (methods) {
            const methodName = handlerExpr.split('(')[0];
            const method = methods[methodName];
            if (method) {
                el[methodKey] = method;
            }
        }
    }

    // Helper methods
    getSafeContext(context) {
        if (!context) return {};

        const domain = context._domain;
        if (!domain) return context;

        // Get the domain's computed properties
        const computedProps = this.computed.get(domain) || {};
        const data = this.data.get(domain) || {};

        // Create a safe context that includes computed properties
        const safeContext = Object.create(context);

        // Add computed properties to the context
        Object.keys(computedProps).forEach(key => {
            if (!(key in context)) {
                Object.defineProperty(safeContext, key, {
                    get: () => data[key],
                    enumerable: true,
                    configurable: true
                });
            }
        });

        return safeContext;
    }

    evaluateExpression(expression, context) {
        try {
            const safeContext = this.getSafeContext(context);
            // Create a proxy to safely handle property access
            const safeContextProxy = new Proxy(safeContext, {
                get: (target, prop) => {
                    if (!(prop in target)) {
                        return undefined;
                    }
                    const value = target[prop];
                    // If it's a function, bind it to the target
                    if (typeof value === 'function') {
                        return value.bind(target);
                    }
                    // Otherwise return the value directly
                    return value;
                }
            });

            // Replace array access with safe navigation
            expression = expression.replace(/(\w+)\[(\d+)\]/g, '($1 && $1[$2])');

            // Replace property access with safe navigation
            expression = expression.replace(/\b(\w+)\.(\w+)/g, '($1 && $1.$2)');

            // Handle string comparisons
            expression = expression.replace(/([\w.[\]]+)\s*([!=]==?)\s*['"]([^'"]+)['"]/g, (match, left, op, right) => {
                return `(${left} ${op} '${right}')`;
            });

            // Handle string literals in expressions
            expression = expression.replace(/(['"])((?:\\\1|.)*?)\1/g, (match, quote, content) => {
                return JSON.stringify(content);
            });

            // Evaluate the expression in the safe context
            const fn = new Function('ctx', `with(ctx) { return ${expression}; }`);
            const result = fn(safeContextProxy);

            // For v-if directives, convert result to boolean
            if (expression.includes('===') || expression.includes('!==')) {
                return Boolean(result);
            }

            return result;
        } catch (error) {
            logger.error('Expression evaluation error:', error);
            return false;
        }
    }

    /**
     * Get data value for a domain and optional path
     * @param {string} domain - The domain to get data from
     * @param {string} [path] - Optional dot-notation path within the domain
     * @returns {any} The value at the specified domain and path
     */
    getDataValue(domain, path = null) {
        const state = this.data.get(domain);
        if (!state) return null;
        if (!path) return state;
        return path.split('.').reduce((obj, prop) => obj && obj[prop], state);
    }

    setDataValue(domain, path, value) {
        const state = this.data.get(domain);
        if (!state) return;

        const props = path.split('.');
        let current = state;

        for (let i = 0; i < props.length - 1; i++) {
            if (!current[props[i]])
                current[props[i]] = {};
            current = current[props[i]];
        }

        current[props[props.length - 1]] = value;
        this.scheduleUpdate(domain);
    }

    destroy() {
        this.data.clear();
        this.methods.clear();
        if (this.updateQueue) {
            this.updateQueue.clear();
        }
        this.updateScheduled = false;
    }

    /**
     * Get data for a specific domain
     * @param {string} domain - The domain to get data for
     * @returns {Object} The data for the domain
     */
    getData(domain) {
        return this.data.get(domain);
    }
}

// Export a singleton instance
export default new JavaisPasVu();
