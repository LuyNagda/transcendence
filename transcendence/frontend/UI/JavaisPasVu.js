/**
 * JavaisPasVu - A lightweight reactive UI framework
 * 
 * A standalone library providing Vue-like features:
 * - Reactive data binding
 * - Template directives
 * - Event handling
 * - Component lifecycle
 * - Plugin system
 * - Domain-based state management
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

const ReactiveEffect = {
    current: null,
    stack: [],

    push(effect) {
        this.stack.push(effect);
        this.current = effect;
    },

    pop() {
        this.stack.pop();
        this.current = this.stack[this.stack.length - 1] || null;
    }
};

function reactive(obj) {
    const subscribers = new WeakMap();

    return new Proxy(obj, {
        get(target, key) {
            // Track dependency
            if (ReactiveEffect.current) {
                if (!subscribers.has(target)) {
                    subscribers.set(target, new Map());
                }
                const keySubscribers = subscribers.get(target);
                if (!keySubscribers.has(key)) {
                    keySubscribers.set(key, new Set());
                }
                keySubscribers.get(key).add(ReactiveEffect.current);
            }
            return target[key];
        },
        set(target, key, value) {
            const oldValue = target[key];
            target[key] = value;

            // Trigger updates if value changed
            if (oldValue !== value && subscribers.has(target)) {
                const keySubscribers = subscribers.get(target).get(key);
                if (keySubscribers) {
                    keySubscribers.forEach(effect => effect());
                }
            }
            return true;
        }
    });
}

class JavaisPasVu {
    constructor() {
        if (JavaisPasVu.instance) {
            return JavaisPasVu.instance;
        }

        this.initialized = false;
        this.root = null;
        this.domains = new Map();
        this.updateQueue = new Set();
        this.updateScheduled = false;
        this.observers = new Map();
        this.plugins = new Map();
        this.hooks = {
            beforeMount: new Set(),
            mounted: new Set(),
            beforeUpdate: new Set(),
            updated: new Set(),
            beforeDestroy: new Set(),
            destroyed: new Set(),
            beforeCompile: new Set(),
            afterCompile: new Set()
        };

        JavaisPasVu.instance = this;
    }

    // Plugin system
    use(plugin, options = {}) {
        if (!plugin || typeof plugin !== 'object') {
            logger.error('Invalid plugin:', plugin);
            return this;
        }

        const pluginName = plugin.name || 'anonymous';

        if (this.plugins.has(pluginName)) {
            logger.warn(`Plugin ${pluginName} is already installed`);
            return this;
        }

        try {
            plugin.install(this, options);
            this.plugins.set(pluginName, plugin);
            logger.info(`Plugin ${pluginName} installed successfully`);
        } catch (error) {
            logger.error(`Failed to install plugin ${pluginName}:`, error);
        }

        return this;
    }

    // Hook system
    on(hookName, callback) {
        if (this.hooks[hookName]) {
            this.hooks[hookName].add(callback);
        }
        return () => this.off(hookName, callback);
    }

    off(hookName, callback) {
        if (this.hooks[hookName]) {
            this.hooks[hookName].delete(callback);
        }
    }

    emit(hookName, ...args) {
        if (this.hooks[hookName]) {
            this.hooks[hookName].forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    logger.error(`Error in ${hookName} hook:`, error);
                }
            });
        }
    }

    initialize(root = document.body) {
        if (this.initialized) {
            logger.warn("JavaisPasVu is already initialized");
            return this;
        }

        this.emit('beforeMount');
        this.root = root;
        this.initialized = true;
        this.emit('mounted');

        logger.info("JavaisPasVu initialized");
        return this;
    }

    /**
     * Register reactive data for a specific domain
     */
    registerData(domain, data, computedProps = {}) {
        if (!this.domains.has(domain)) {
            this.domains.set(domain, {
                state: reactive({}),
                methods: {},
                computed: new Map()
            });
        }

        const domainData = this.domains.get(domain);

        // Update state
        Object.assign(domainData.state, data);

        // Register computed properties
        if (Object.keys(computedProps).length > 0) {
            this.registerComputed(domain, computedProps);
        }

        // Find all elements with this domain and compile them once
        const elements = document.querySelectorAll(`[data-domain="${domain}"]`);
        if (elements.length > 0) {
            // Only compile the root element to avoid duplicate compilation
            const rootElement = elements[0];
            this.compileElement(rootElement, domainData.state);
        }
    }

    /**
     * Register methods for a specific domain
     */
    registerMethods(domain, methods) {
        if (!this.domains.has(domain)) {
            this.domains.set(domain, {
                state: reactive({}),
                methods: {},
                computed: new Map()
            });
        }

        const domainData = this.domains.get(domain);

        // Bind methods to state
        domainData.methods = Object.entries(methods).reduce((acc, [key, method]) => {
            acc[key] = method.bind(domainData.state);
            return acc;
        }, {});

        // Update state with methods
        Object.assign(domainData.state, domainData.methods);
    }

    /**
     * Register computed properties for a domain
     */
    registerComputed(domain, computedProps) {
        if (!this.domains.has(domain)) {
            this.domains.set(domain, {
                state: reactive({}),
                methods: {},
                computed: new Map()
            });
        }

        const domainData = this.domains.get(domain);

        Object.entries(computedProps).forEach(([key, getter]) => {
            if (typeof getter !== 'function') {
                logger.error(`Computed property ${key} must be a function`);
                return;
            }

            // Create effect for computed property
            const effect = () => {
                try {
                    ReactiveEffect.push(effect);
                    return getter.call(domainData.state);
                } finally {
                    ReactiveEffect.pop();
                }
            };

            // Store computed effect
            domainData.computed.set(key, effect);

            // Define getter on state
            Object.defineProperty(domainData.state, key, {
                get: () => effect(),
                enumerable: true
            });
        });
    }

    /**
     * Subscribe to data changes for a domain
     */
    subscribe(domain, callback) {
        if (!this.observers.has(domain)) {
            this.observers.set(domain, new Set());
        }
        this.observers.get(domain).add(callback);

        // Return unsubscribe function
        return () => this.unsubscribe(domain, callback);
    }

    // Unsubscribe from domain changes
    unsubscribe(domain, callback) {
        const observers = this.observers.get(domain);
        if (observers) {
            observers.delete(callback);
        }
    }

    // Schedule UI updates
    scheduleUpdate(domain) {
        this.updateQueue.add(domain);

        if (!this.updateScheduled) {
            this.updateScheduled = true;
            requestAnimationFrame(() => this.processUpdates());
        }
    }

    // Process scheduled updates
    processUpdates() {
        try {
            this.emit('beforeUpdate');
            this.updateQueue.forEach(domain => {
                const elements = document.querySelectorAll(`[data-domain="${domain}"]`);
                elements.forEach(el => this.updateElement(el, domain));
                this.notifyObservers(domain);
            });
            this.emit('updated');
        } finally {
            this.updateQueue.clear();
            this.updateScheduled = false;
        }
    }

    /**
     * Notify observers of data changes for a domain
     */
    notifyObservers(domain) {
        const observers = this.observers.get(domain);
        if (observers) {
            const state = this.domains.get(domain)?.state;
            observers.forEach(observer => {
                try {
                    observer(state);
                } catch (error) {
                    logger.error(`Error in observer for domain ${domain}:`, error);
                }
            });
        }
    }

    // Update a specific element
    updateElement(el, domain) {
        const domainData = this.domains.get(domain);
        if (!domainData) {
            logger.warn(`No data found for domain: ${domain}`);
            return;
        }

        // Force compilation since state has changed
        this.compileElement(el, domainData.state);
    }

    // Compile and process element
    compileElement(el, state = null) {
        if (!el) return;

        this.emit('beforeCompile', el, state);

        const domain = el.getAttribute('data-domain');
        const domainData = domain ? this.domains.get(domain) : null;
        const context = state || (domainData?.state || {});

        // Process directives in order
        this.processVIf(el, context);
        this.processVFor(el, context);
        this.processVModel(el, context);
        this.processVBind(el, context);
        this.processVOn(el, context);
        this.processInterpolation(el, context);

        this.emit('afterCompile', el, state);

        // Process children recursively after parent is compiled
        Array.from(el.children).forEach(child => {
            this.compileElement(child, context);
        });
    }

    // Process v-if directive
    processVIf(el, context) {
        const vIf = el.getAttribute('v-if');
        if (!vIf) return;

        const effect = () => {
            try {
                ReactiveEffect.push(effect);
                const result = this.evaluateExpression(vIf, context);
                el.style.display = result ? '' : 'none';
            } finally {
                ReactiveEffect.pop();
            }
        };

        effect();
    }

    // Process v-for directive
    processVFor(el, parentContext) {
        const vFor = el.getAttribute('v-for');
        if (!vFor) return;

        const [iteratorExp, arrayExp] = vFor.split(' in ').map(s => s.trim());
        const items = this.evaluateExpression(arrayExp, parentContext);

        if (!Array.isArray(items)) {
            logger.warn('v-for requires array:', arrayExp);
            return;
        }

        // Create template if not exists
        const template = el.cloneNode(true);
        template.removeAttribute('v-for');

        // Clear existing items
        while (el.nextSibling && el.nextSibling.__v_for_item) {
            el.parentNode.removeChild(el.nextSibling);
        }

        // Create new items
        items.forEach((item, index) => {
            const clone = template.cloneNode(true);
            clone.__v_for_item = true;

            // Create item context
            const itemContext = {
                ...parentContext,
                [iteratorExp]: item,
                index
            };

            // Process clone with item context
            this.compileElement(clone, itemContext);

            // Insert after current element
            el.parentNode.insertBefore(clone, el.nextSibling);
        });

        // Hide original template
        el.style.display = 'none';
    }

    // Process v-model directive
    processVModel(el, context) {
        const vModel = el.getAttribute('v-model');
        if (!vModel) return;

        // Set initial value
        const value = this.evaluateExpression(vModel, context);
        if (el.type === 'checkbox') {
            el.checked = Boolean(value);
        } else {
            el.value = value || '';
        }

        // Setup two-way binding
        const eventType = el.type === 'checkbox' ? 'change' : 'input';
        const handler = (event) => {
            const newValue = el.type === 'checkbox' ? event.target.checked : event.target.value;
            this.setValueByPath(context, vModel, newValue);
        };

        // Remove old listener if exists
        if (el.__v_model_handler) {
            el.removeEventListener(eventType, el.__v_model_handler);
        }

        // Add new listener
        el.__v_model_handler = handler;
        el.addEventListener(eventType, handler);
    }

    // Process v-bind directive
    processVBind(el, context) {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('v-bind:') || attr.name.startsWith(':')) {
                const prop = attr.name.split(':')[1];
                const expression = attr.value;

                const effect = () => {
                    try {
                        ReactiveEffect.push(effect);
                        const value = this.evaluateExpression(expression, context);
                        if (prop === 'style' && typeof value === 'object') {
                            Object.assign(el.style, value);
                        } else {
                            el.setAttribute(prop, value);
                        }
                    } finally {
                        ReactiveEffect.pop();
                    }
                };

                effect();
            }
        });
    }

    // Process v-on directive
    processVOn(el, context) {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('v-on:') || attr.name.startsWith('@')) {
                const event = attr.name.split(':')[1] || attr.name.slice(1);
                const expression = attr.value;

                // Remove old listener if exists
                if (el.__v_on_handlers && el.__v_on_handlers[event]) {
                    el.removeEventListener(event, el.__v_on_handlers[event]);
                }

                // Create handler
                const handler = (e) => {
                    const methodName = expression.split('(')[0];
                    const method = context[methodName];
                    if (typeof method === 'function') {
                        method.call(context, e);
                    }
                };

                // Store handler reference
                if (!el.__v_on_handlers) el.__v_on_handlers = {};
                el.__v_on_handlers[event] = handler;

                // Add listener
                el.addEventListener(event, handler);
            }
        });
    }

    // Process text interpolation
    processInterpolation(el, context) {
        const textNodes = Array.from(el.childNodes).filter(node =>
            node.nodeType === Node.TEXT_NODE &&
            node.textContent.includes('{{')
        );

        textNodes.forEach(node => {
            const template = node.textContent;
            const effect = () => {
                try {
                    ReactiveEffect.push(effect);
                    const text = template.replace(/\{\{(.*?)\}\}/g, (_, exp) => {
                        return this.evaluateExpression(exp.trim(), context);
                    });
                    node.textContent = text;
                } finally {
                    ReactiveEffect.pop();
                }
            };

            effect();
        });
    }

    // Evaluate expression in context
    evaluateExpression(expression, context) {
        try {
            const fn = new Function('ctx', `with(ctx) { return ${expression}; }`);
            return fn(context);
        } catch (error) {
            logger.error('Expression evaluation error:', error);
            return null;
        }
    }

    // Set value by path
    setValueByPath(obj, path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        const target = parts.reduce((obj, key) => obj[key], obj);
        target[last] = value;
    }

    // Cleanup when elements are removed
    cleanup(el) {
        this.emit('beforeDestroy', el);

        // Remove v-model handlers
        if (el.__v_model_handler) {
            el.removeEventListener('input', el.__v_model_handler);
            el.removeEventListener('change', el.__v_model_handler);
            delete el.__v_model_handler;
        }

        // Remove v-on handlers
        if (el.__v_on_handlers) {
            Object.entries(el.__v_on_handlers).forEach(([event, handler]) => {
                el.removeEventListener(event, handler);
            });
            delete el.__v_on_handlers;
        }

        // Cleanup children
        Array.from(el.children).forEach(child => this.cleanup(child));

        this.emit('destroyed', el);
    }

    // Get domain state
    getState(domain) {
        return this.domains.get(domain)?.state;
    }
}

// Export a singleton instance
export default new JavaisPasVu();
