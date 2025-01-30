/**
 * JaiPasVu - A lightweight reactive UI framework
 * 
 * A standalone library providing Vue-like features:
 * - Reactive data binding
 * - Template directives
 * - Event handling
 * - Component lifecycle
 * - Plugin system
 * - Domain-based state management
 * - Interpolation with [[ ]] (not to confuse with Django SSR templating {{ }})
 * 
 * Supported directives:
 * - v-text: Text content binding
 * - v-if: Conditional rendering
 * - v-else-if: Conditional rendering
 * - v-else: Conditional rendering
 * - v-model: Two-way data binding
 * - v-on: Event handling
 * - /!\ Not yet fully tested: v-for: List rendering
 * - !\ Not yet implemented: v-bind:style: Style binding
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

class JaiPasVu {
    constructor() {
        if (JaiPasVu.instance) {
            return JaiPasVu.instance;
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

        JaiPasVu.instance = this;
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
        if (this.hooks[hookName])
            this.hooks[hookName].add(callback);
        return () => this.off(hookName, callback);
    }

    off(hookName, callback) {
        if (this.hooks[hookName])
            this.hooks[hookName].delete(callback);
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
            logger.warn("JaiPasVu is already initialized");
            return this;
        }

        this.emit('beforeMount');
        this.root = root;
        this.initialized = true;
        this.emit('mounted');

        return this;
    }

    /**
     * Register reactive data for a specific domain
     */
    registerData(domain, data) {
        if (!this.domains.has(domain)) {
            this.domains.set(domain, {
                state: reactive({}),
                methods: {},
                computed: new Map()
            });
        }

        const domainData = this.domains.get(domain);

        // First, identify computed properties
        const computedProps = {};
        const regularData = {};

        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'function') {
                computedProps[key] = value;
            } else {
                regularData[key] = value;
            }
        });

        // Update regular state first
        Object.assign(domainData.state, regularData);

        // Register computed properties
        if (Object.keys(computedProps).length > 0) {
            this.registerComputed(domain, computedProps);
        }

        logger.debug(`Registered data for domain ${domain}:`, data);

        // Find all elements with this domain and compile them once
        const elements = document.querySelectorAll(`[data-domain="${domain}"]`);
        if (elements.length > 0) {
            logger.debug(`Found ${elements.length} elements for domain ${domain}`);
            // Only compile the root element to avoid duplicate compilation
            const rootElement = elements[0];
            this.compileElement(rootElement, domainData.state);
        } else {
            logger.warn(`No elements found for domain ${domain}`);
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
                    const result = getter.call(domainData.state);
                    return result === undefined ? '' : result;
                } catch (error) {
                    logger.error(`Error in computed property ${key}:`, error);
                    return '';
                } finally {
                    ReactiveEffect.pop();
                }
            };

            // Store computed effect
            domainData.computed.set(key, effect);

            // If property already exists, delete it first
            if (key in domainData.state) {
                delete domainData.state[key];
            }

            // Define getter on state
            Object.defineProperty(domainData.state, key, {
                get: () => {
                    try {
                        return effect();
                    } catch (error) {
                        logger.error(`Error getting computed property ${key}:`, error);
                        return '';
                    }
                },
                enumerable: true,
                configurable: true  // Allow property to be redefined
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

        // Get domain from element
        const domain = el.getAttribute('data-domain');

        const parentDomainEl = domain ? el.closest(`[data-domain]:not([data-domain="${domain}"])`) : null;
        const parentDomain = parentDomainEl?.getAttribute('data-domain');
        const parentData = parentDomain ? this.domains.get(parentDomain)?.state : null;

        const domainData = domain ? this.domains.get(domain) : null;

        // Create context by combining parent and current domain data
        let context;
        if (domain) {
            // For domain elements, create a proxy that inherits from parent context
            context = new Proxy(domainData?.state || {}, {
                get(target, prop) {
                    // First check current domain
                    if (prop in target) {
                        return target[prop];
                    }
                    // Then check parent domain
                    if (parentData && prop in parentData) {
                        return parentData[prop];
                    }
                    // Finally check provided state
                    if (state && prop in state) {
                        return state[prop];
                    }
                    return undefined;
                },
                has(target, prop) {
                    return prop in target ||
                        (parentData && prop in parentData) ||
                        (state && prop in state);
                }
            });
        } else {
            // For non-domain elements, use provided state or parent domain state
            context = state || parentData || {};
        }

        logger.debug(`Compiling element with domain ${domain}:`, {
            element: el.outerHTML,
            context: context,
            parentDomain: parentDomain
        });

        // Process directives in order
        this.processVIf(el, context);
        this.processVText(el, context);
        this.processVFor(el, context);
        this.processVModel(el, context);
        this.processVBind(el, context);
        this.processVOn(el, context);
        this.processInterpolation(el, context);

        this.emit('afterCompile', el, state);

        // Process children recursively after parent is compiled
        Array.from(el.children).forEach(child => {
            const childDomain = child.getAttribute('data-domain');
            if (childDomain) {
                this.compileElement(child);
            } else {
                this.compileElement(child, context);
            }
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

    processVText(el, context) {
        const vText = el.getAttribute('v-text');
        if (!vText) return;

        const effect = () => {
            try {
                ReactiveEffect.push(effect);
                const value = this.evaluateExpression(vText, context);
                el.textContent = value === undefined || value === null ? '' : String(value);
            } finally {
                ReactiveEffect.pop();
            }
        };

        effect();
    }

    processVFor(el, parentContext) {
        const vFor = el.getAttribute('v-for');
        if (!vFor) return;

        // Parse iterator expression, handling both forms:
        // "item in items" and "(item, index) in items"
        const [iteratorExp, arrayExp] = vFor.split(' in ').map(s => s.trim());
        const items = this.evaluateExpression(arrayExp, parentContext);

        if (!Array.isArray(items)) {
            logger.warn('v-for requires array:', arrayExp);
            return;
        }

        // Parse iterator variables
        let itemVar, indexVar;
        if (iteratorExp.includes('(')) {
            // Handle (item, index) form
            const match = iteratorExp.match(/\(\s*(\w+)\s*,\s*(\w+)\s*\)/);
            if (!match) {
                logger.error('Invalid v-for iterator expression:', iteratorExp);
                return;
            }
            [, itemVar, indexVar] = match;
        } else {
            // Handle simple item form
            itemVar = iteratorExp;
        }

        // Create template if not exists
        const template = el.cloneNode(true);
        template.removeAttribute('v-for');

        // Get the parent node and next sibling for proper insertion
        const parent = el.parentNode;
        let anchor = el.nextSibling;

        // First, mark all existing v-for items for removal
        const itemsToRemove = [];
        while (anchor && anchor.__v_for_item) {
            const next = anchor.nextSibling;
            itemsToRemove.push(anchor);
            anchor = next;
        }

        // Remove all old items first
        itemsToRemove.forEach(item => {
            if (item.parentNode === parent) {
                parent.removeChild(item);
            }
        });

        // Create fragment to hold new items
        const fragment = document.createDocumentFragment();

        // Create new items
        items.forEach((item, index) => {
            const clone = template.cloneNode(true);
            clone.__v_for_item = true;

            // Create item context by combining parent context with iterator variables
            const itemContext = Object.create(null);
            Object.setPrototypeOf(itemContext, parentContext);
            itemContext[itemVar] = item;
            if (indexVar) {
                itemContext[indexVar] = index;
            }

            // Process clone with item context
            this.compileElement(clone, itemContext);

            // Add to fragment
            fragment.appendChild(clone);
        });

        // Insert all new items at once
        parent.insertBefore(fragment, el.nextSibling);

        // Hide original template
        el.style.display = 'none';
    }

    processVModel(el, context) {
        const vModel = el.getAttribute('v-model');
        if (!vModel) return;

        try {
            logger.debug(`Processing v-model for ${el.outerHTML}:`, {
                model: vModel,
                context: context
            });

            // Create effect for two-way binding
            const effect = () => {
                try {
                    ReactiveEffect.push(effect);
                    const value = this.evaluateExpression(vModel, context);
                    logger.debug(`v-model effect evaluation:`, {
                        model: vModel,
                        value: value,
                        elementType: el.type
                    });

                    if (el.type === 'checkbox') {
                        el.checked = Boolean(value);
                    } else {
                        el.value = value === undefined || value === null ? '' : String(value);
                    }
                } catch (error) {
                    logger.error('Error in v-model effect:', error);
                } finally {
                    ReactiveEffect.pop();
                }
            };

            // Run effect for initial value
            effect();

            // Setup two-way binding
            const eventType = el.type === 'checkbox' ? 'change' : 'input';
            const handler = (event) => {
                try {
                    const newValue = el.type === 'checkbox' ? event.target.checked : event.target.value;
                    logger.debug(`v-model update from DOM:`, {
                        model: vModel,
                        newValue: newValue,
                        elementType: el.type
                    });
                    this.setValueByPath(context, vModel, newValue);
                } catch (error) {
                    logger.error('Error in v-model handler:', error);
                }
            };

            // Remove old listener if exists
            if (el.__v_model_handler)
                el.removeEventListener(eventType, el.__v_model_handler);

            // Add new listener
            el.__v_model_handler = handler;
            el.addEventListener(eventType, handler);
        } catch (error) {
            logger.error('Error in v-model processing:', error);
        }
    }

    processVBind(el, context) {
        // Map of HTML attribute names to DOM property names
        const PROPERTY_MAP = {
            'readonly': 'readOnly',
            'class': 'className',
            'for': 'htmlFor',
            'maxlength': 'maxLength',
            'minlength': 'minLength',
            'tabindex': 'tabIndex'
        };

        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('v-bind:') || attr.name.startsWith(':')) {
                const prop = attr.name.split(':')[1];
                const expression = attr.value;

                const effect = () => {
                    try {
                        ReactiveEffect.push(effect);
                        const value = this.evaluateExpression(expression, context);
                        const propertyName = PROPERTY_MAP[prop] || prop;
                        if (typeof value === 'boolean' && (propertyName in el || prop in el)) {
                            // Use the mapped property name if it exists on the element, or fall back to the original prop name
                            const targetProp = (propertyName in el) ? propertyName : prop;
                            el[targetProp] = value;
                        } else if (prop === 'style' && typeof value === 'object') {
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

    processVOn(el, context) {
        Array.from(el.attributes).forEach(attr => {
            // Handle both v-on: and @ prefixes
            const isVOn = attr.name.startsWith('v-on:');
            const isAtPrefix = attr.name.startsWith('@');
            if (!isVOn && !isAtPrefix)
                return;

            const event = isVOn ? attr.name.split(':')[1] : attr.name.slice(1);
            const expression = attr.value;

            // Remove old listener if exists
            if (el.__v_on_handlers && el.__v_on_handlers[event]) {
                el.removeEventListener(event, el.__v_on_handlers[event]);
            }

            const handler = (e) => {
                try {
                    // Handle different expression formats:
                    // 1. methodName($event.target.value)
                    // 2. methodName()
                    // 3. shorthand methodName
                    let methodName, args;
                    const methodCall = expression.match(/(\w+)\((.*?)\)/);

                    if (methodCall) {
                        [, methodName, args] = methodCall;
                    } else {
                        methodName = expression;
                        args = '';
                    }

                    // Look for method in current context and parent contexts
                    let method = context[methodName];
                    if (typeof method === 'function') {
                        const eventContext = { ...context, $event: e };

                        // Handle different argument formats
                        const evaluatedArgs = args ?
                            args.split(',').map(arg => this.evaluateExpression(arg.trim(), eventContext)) :
                            [e]; // If no args, pass the event object

                        method.apply(context, evaluatedArgs);
                    }
                } catch (error) {
                    logger.error('Error in v-on handler:', error);
                }
            };

            // Store handler reference
            if (!el.__v_on_handlers) el.__v_on_handlers = {};
            el.__v_on_handlers[event] = handler;

            el.addEventListener(event, handler);
        });
    }

    // Process text interpolation
    processInterpolation(el, context) {
        const textNodes = Array.from(el.childNodes).filter(node =>
            node.nodeType === Node.TEXT_NODE &&
            node.textContent.includes('[[')
        );

        textNodes.forEach(node => {
            const template = node.textContent;
            const effect = () => {
                try {
                    ReactiveEffect.push(effect);
                    const text = template.replace(/\[\[(.*?)\]\]/g, (_, exp) => {
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
            // Create a proxy to safely handle property access
            const proxy = new Proxy(context || {}, {
                get(target, prop) {
                    try {
                        // First check if property exists in current context
                        if (prop in target) {
                            const value = target[prop];
                            // If it's a function and not a method call, evaluate it
                            if (typeof value === 'function' && !expression.includes('(')) {
                                try {
                                    const result = value.call(target);
                                    return result === undefined ? '' : result;
                                } catch (error) {
                                    logger.error('Error evaluating computed property:', error);
                                    return '';
                                }
                            }
                            return value;
                        }
                        // If property doesn't exist, return undefined instead of throwing
                        return undefined;
                    } catch (error) {
                        logger.error('Error accessing property:', error);
                        return '';
                    }
                },
                has(target, prop) {
                    return prop in target;
                }
            });

            // Wrap expression in try-catch for better error handling
            const wrappedExpression = `
                try {
                    const result = ${expression};
                    return result === undefined ? '' : result;
                } catch (e) {
                    return '';
                }
            `;

            const fn = new Function('ctx', `with(ctx) { ${wrappedExpression} }`);
            const result = fn(proxy);

            logger.debug(`Expression evaluation:`, {
                expression: expression,
                context: context,
                result: result
            });

            return result === undefined ? '' : result;
        } catch (error) {
            logger.error('Expression evaluation error:', error);
            return '';
        }
    }

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
export default new JaiPasVu();
