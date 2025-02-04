/**
 * JaiPasVu - A lightweight reactive UI framework
 * 
 * A standalone library providing Vue-like features with a simplified API.
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
 * @class
 * @singleton
 * 
 * @example
 * // Initialize the framework
 * const jaiPasVu = new JaiPasVu();
 * jaiPasVu.initialize(document.body);
 * 
 * // Register domain data
 * jaiPasVu.registerData('room', {
 *   mode: 'CLASSIC',
 *   players: [],
 *   maxPlayers: 2,
 *   isOwner: false,
 *   error: null,
 *   // Computed property example
 *   mappedPlayers() {
 *     return this.players.map(player => ({
 *       ...player,
 *       isOwner: player.id === this.ownerId,
 *       isCurrentUser: player.id === this.currentUserId
 *     }));
 *   }
 * });
 * 
 * // Register methods
 * jaiPasVu.registerMethods('room', {
 *   startGame() {
 *     this.startGameInProgress = true;
 *     // Game start logic
 *   },
 *   kickPlayer(playerId) {
 *     // Player kick logic
 *   },
 *   leaveGame() {
 *     // Leave game logic
 *   }
 * });
 * 
 * @features
 * - Template interpolation using [[ ]] syntax (not to confuse with Django SSR templating {{ }})
 * - Reactive data binding with automatic UI updates
 * - Template directives (v-if, v-model, v-on, etc.)
 * - Event handling with method binding
 * - Component lifecycle hooks
 * - Plugin system for extensibility
 * - Domain-based state management
 * - Computed properties
 * - Two-way data binding
 */
import logger from "../logger.js";

/**
 * ReactiveEffect - Internal tracking system for reactive dependencies
 * @private
 */
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

/**
 * Creates a reactive proxy around an object to track property access and changes
 * @private
 * @param {Object} obj - The object to make reactive
 * @returns {Proxy} A reactive proxy of the object
 */
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

/**
 * Main framework class implementing reactive UI functionality
 * @public
 */
class JaiPasVu {
    /**
     * Creates or returns the singleton instance of JaiPasVu
     * @returns {JaiPasVu} The singleton instance
     */
    constructor() {
        if (JaiPasVu.instance)
            return JaiPasVu.instance;

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

        // Add support for custom events
        this.customEvents = new Map();

        JaiPasVu.instance = this;
    }

    /**
     * Installs a plugin into the framework
     * @param {Object} plugin - The plugin object to install
     * @param {string} plugin.name - Plugin name
     * @param {Function} plugin.install - Plugin installation function
     * @param {Object} [options={}] - Plugin configuration options
     * @returns {JaiPasVu} The framework instance for chaining
     * 
     * @example
     * const myPlugin = {
     *   name: 'myPlugin',
     *   install(jaiPasVu, options) {
     *     // Add custom functionality
     *     jaiPasVu.customMethod = () => {};
     *   }
     * };
     * jaiPasVu.use(myPlugin, { debug: true });
     */
    use(plugin, options = {}) {
        if (!plugin || typeof plugin !== 'object') {
            logger.error('[JaiPasVu] Invalid plugin:', plugin);
            return this;
        }

        const pluginName = plugin.name || 'anonymous';

        if (this.plugins.has(pluginName)) {
            logger.warn(`[JaiPasVu] Plugin ${pluginName} is already installed`);
            return this;
        }

        try {
            plugin.install(this, options);
            this.plugins.set(pluginName, plugin);
            logger.info(`[JaiPasVu] Plugin ${pluginName} installed successfully`);
        } catch (error) {
            logger.error(`[JaiPasVu] Failed to install plugin ${pluginName}:`, error);
        }

        return this;
    }

    /**
     * Registers a lifecycle hook or custom event callback
     * @param {string} hookName - Name of the hook or custom event
     * @param {Function} callback - Function to call when hook/event triggers
     * @returns {Function} Cleanup function to remove the hook/event listener
     */
    on(hookName, callback) {
        // Check if it's a lifecycle hook
        if (this.hooks[hookName]) {
            this.hooks[hookName].add(callback);
        } else {
            if (!this.customEvents.has(hookName))
                this.customEvents.set(hookName, new Set());
            this.customEvents.get(hookName).add(callback);
        }
        return () => this.off(hookName, callback);
    }

    off(hookName, callback) {
        if (this.hooks[hookName]) {
            this.hooks[hookName].delete(callback);
        } else if (this.customEvents.has(hookName)) {
            this.customEvents.get(hookName).delete(callback);
            if (this.customEvents.get(hookName).size === 0)
                this.customEvents.delete(hookName);
        }
    }

    emit(hookName, ...args) {
        // Check if it's a lifecycle hook
        if (this.hooks[hookName]) {
            this.hooks[hookName].forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    logger.error(`[JaiPasVu] Error in ${hookName} hook:`, error);
                }
            });
        }

        // Check for custom event listeners
        if (this.customEvents.has(hookName)) {
            this.customEvents.get(hookName).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    logger.error(`[JaiPasVu] Error in ${hookName} event handler:`, error);
                }
            });
        }
    }

    /**
     * Initializes the framework with a root element
     * @param {HTMLElement} [root=document.body] - Root element for the framework
     * @returns {JaiPasVu} The framework instance for chaining
     * 
     * @example
     * jaiPasVu.initialize(document.querySelector('#app'));
     */
    initialize(root = document.body) {
        if (this.initialized) {
            logger.warn("[JaiPasVu] JaiPasVu is already initialized");
            return this;
        }

        this.emit('beforeMount');
        this.root = root;
        this.initialized = true;
        this.emit('mounted');

        return this;
    }

    /**
     * Registers reactive data for a specific domain
     * @param {string} domain - Domain identifier
     * @param {Object} data - Data object containing state and computed properties
     * 
     * @example
     * // Register room state data
     * jaiPasVu.registerData('room', {
     *   mode: 'CLASSIC',
     *   players: [],
     *   maxPlayers: 2,
     *   isOwner: false,
     *   error: null,
     *   // Computed property example
     *   mappedPlayers() {
     *     return this.players.map(player => ({
     *       ...player,
     *       isOwner: player.id === this.ownerId,
     *       isCurrentUser: player.id === this.currentUserId
     *     }));
     *   }
     * });
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

        logger.debug(`[JaiPasVu] Registered data for domain ${domain}:`, data);

        // Find all elements with this domain and compile them once
        const elements = document.querySelectorAll(`[data-domain="${domain}"]`);
        if (elements.length > 0) {
            logger.debug(`[JaiPasVu] Found ${elements.length} elements for domain ${domain}`);
            // Only compile the root element to avoid duplicate compilation
            const rootElement = elements[0];
            this.compileElement(rootElement, domainData.state);
        } else {
            logger.warn(`[JaiPasVu] No elements found for domain ${domain}`);
        }
    }

    /**
     * Registers methods for a specific domain
     * @param {string} domain - Domain identifier
     * @param {Object.<string, Function>} methods - Object containing method definitions
     * 
     * @example
     * jaiPasVu.registerMethods('room', {
     *   startGame() {
     *     this.startGameInProgress = true;
     *     // Game start logic
     *   },
     *   kickPlayer(playerId) {
     *     // Player kick logic
     *   },
     *   leaveGame() {
     *     // Leave game logic
     *   }
     * });
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
                logger.error(`[JaiPasVu] Computed property ${key} must be a function`);
                return;
            }

            // Create effect for computed property
            const effect = () => {
                try {
                    ReactiveEffect.push(effect);
                    const result = getter.call(domainData.state);
                    return result === undefined ? '' : result;
                } catch (error) {
                    logger.error(`[JaiPasVu] Error in computed property ${key}:`, error);
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
                        logger.error(`[JaiPasVu] Error getting computed property ${key}:`, error);
                        return '';
                    }
                },
                enumerable: true,
                configurable: true  // Allow property to be redefined
            });
        });
    }

    /**
     * Subscribes to state changes in a specific domain
     * @param {string} domain - Domain identifier
     * @param {Function} callback - Callback function receiving updated state
     * @returns {Function} Unsubscribe function
     * 
     * @deprecated Use store.subscribe instead
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
                    logger.error(`[JaiPasVu] Error in observer for domain ${domain}:`, error);
                }
            });
        }
    }

    // Update a specific element
    updateElement(el, domain) {
        const domainData = this.domains.get(domain);
        if (!domainData) {
            logger.warn(`[JaiPasVu] No data found for domain: ${domain}`);
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

        // Process directives in order
        this.processVIf(el, context);

        const isVisible = el.style.display !== 'none';

        // Check if any parent is hidden
        let parent = el.parentElement;
        let parentHidden = false;
        while (parent) {
            if (parent.style.display === 'none') {
                parentHidden = true;
                break;
            }
            parent = parent.parentElement;
        }

        // If parent is hidden or this element is hidden, hide this element
        if (parentHidden || !isVisible)
            el.style.display = 'none';

        // Only process other directives if this element is visible
        if (el.style.display !== 'none') {
            this.processVText(el, context);
            this.processVFor(el, context);
            this.processVModel(el, context);
            this.processVBind(el, context);
            this.processVOn(el, context);
            this.processInterpolation(el, context);
        }

        this.emit('afterCompile', el, state);

        // Only process children if this element is visible
        if (el.style.display !== 'none') {
            // Process children recursively after parent is compiled
            Array.from(el.children).forEach(child => {
                const childDomain = child.getAttribute('data-domain');
                if (childDomain)
                    this.compileElement(child);
                else
                    this.compileElement(child, context);
            });
        }
    }

    processVIf(el, context) {
        const vIf = el.getAttribute('v-if');
        const vElseIf = el.getAttribute('v-else-if');
        const vElse = el.hasAttribute('v-else');

        if (!vIf && !vElseIf && !vElse) return;

        // Create effect for this element
        const effect = () => {
            try {
                ReactiveEffect.push(effect);
                let shouldShow = false;

                // Check if any parent is hidden
                let parent = el.parentElement;
                let parentHidden = false;
                while (parent) {
                    if (parent.style.display === 'none') {
                        parentHidden = true;
                        break;
                    }
                    parent = parent.parentElement;
                }

                // If parent is hidden, hide this element
                if (parentHidden) {
                    shouldShow = false;
                } else {
                    if (vIf) {
                        shouldShow = this.evaluateExpression(vIf, context);
                    } else if (vElseIf) {
                        // Only evaluate if no previous condition was true
                        if (!this.findTruePreviousCondition(el, context)) {
                            shouldShow = this.evaluateExpression(vElseIf, context);
                        }
                    } else if (vElse) {
                        // Show if no previous condition was true
                        shouldShow = !this.findTruePreviousCondition(el, context);
                    }
                }

                // Store the current visibility state
                const wasVisible = el.style.display !== 'none';
                el.style.display = shouldShow ? '' : 'none';
                const isVisible = el.style.display !== 'none';

                // If visibility changed, update all child elements
                if (wasVisible !== isVisible) {
                    Array.from(el.children).forEach(child => {
                        // Re-evaluate child v-if conditions
                        const childVIf = child.getAttribute('v-if');
                        const childVElseIf = child.getAttribute('v-else-if');
                        const childVElse = child.hasAttribute('v-else');
                        if (childVIf || childVElseIf || childVElse)
                            this.processVIf(child, context);
                        else // For non-conditional children, just inherit parent visibility
                            child.style.display = isVisible ? '' : 'none';
                    });
                }

                // If this element is hidden, hide all its v-else-if and v-else siblings
                if (!shouldShow && vIf)
                    this.hideConditionalSiblings(el);
            } finally {
                ReactiveEffect.pop();
            }
        };

        effect();
    }

    findTruePreviousCondition(el, context) {
        let previous = el.previousElementSibling;
        while (previous) {
            if (previous.hasAttribute('v-if')) {
                return this.evaluateExpression(previous.getAttribute('v-if'), context);
            }
            if (previous.hasAttribute('v-else-if')) {
                const result = this.evaluateExpression(previous.getAttribute('v-else-if'), context);
                if (result) return true;
            }
            previous = previous.previousElementSibling;
        }
        return false;
    }

    hideConditionalSiblings(el) {
        let sibling = el.nextElementSibling;
        while (sibling) {
            if (sibling.hasAttribute('v-else-if') || sibling.hasAttribute('v-else')) {
                sibling.style.display = 'none';
            } else {
                break;
            }
            sibling = sibling.nextElementSibling;
        }
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
        // Check if any parent is hidden
        let parentEl = el.parentElement;
        let parentHidden = false;
        while (parentEl) {
            if (parentEl.style.display === 'none' || parentEl.hasAttribute('v-if')) {
                const vIf = parentEl.getAttribute('v-if');
                if (parentEl.style.display === 'none' || (vIf && !this.evaluateExpression(vIf, parentContext))) {
                    parentHidden = true;
                    break;
                }
            }
            parentEl = parentEl.parentElement;
        }

        // If parent is hidden, hide this element and skip processing
        if (parentHidden) {
            el.style.display = 'none';
            return;
        }

        const vFor = el.getAttribute('v-for');
        if (!vFor) return;

        // Parse v-for expression (e.g., "item in items" or "(item, index) in items")
        const forMatch = vFor.match(/^\s*(?:\(?\s*(\w+)(?:\s*,\s*(\w+))?\s*\)?)\s+in\s+(\S+)\s*$/);
        if (!forMatch) {
            logger.error('[JaiPasVu] Invalid v-for syntax:', vFor);
            return;
        }

        const [, itemName, indexName, arrayPath] = forMatch;

        // Create template from element
        const template = el.cloneNode(true);
        template.removeAttribute('v-for');
        const parent = el.parentNode;
        const anchor = document.createComment(`v-for: ${vFor}`);
        parent.replaceChild(anchor, el);

        const effect = () => {
            try {
                ReactiveEffect.push(effect);
                const array = this.evaluateExpression(arrayPath, parentContext);

                // Remove old elements
                let node = anchor.nextSibling;
                while (node && node._vForMarker === vFor) {
                    const next = node.nextSibling;
                    parent.removeChild(node);
                    node = next;
                }

                // Create new elements
                if (Array.isArray(array)) {
                    array.forEach((item, index) => {
                        const clone = template.cloneNode(true);
                        clone._vForMarker = vFor;

                        // Create local scope for v-for item
                        const itemContext = new Proxy({}, {
                            get: (target, prop) => {
                                if (prop === itemName) return item;
                                if (indexName && prop === indexName) return index;
                                return Reflect.get(parentContext, prop);
                            },
                            has: (target, prop) => {
                                if (prop === itemName) return true;
                                if (indexName && prop === indexName) return true;
                                return Reflect.has(parentContext, prop);
                            }
                        });

                        // Process other directives on cloned element
                        this.compileElement(clone, itemContext);
                        parent.insertBefore(clone, node);
                    });
                }
            } finally {
                ReactiveEffect.pop();
            }
        };

        effect();
    }

    processVModel(el, context) {
        const vModel = el.getAttribute('v-model');
        if (!vModel) return;

        try {
            logger.debug(`[JaiPasVu] Processing v-model for ${el.outerHTML}:`, {
                model: vModel,
                context: context
            });

            // Create effect for two-way binding
            const effect = () => {
                try {
                    ReactiveEffect.push(effect);
                    const value = this.evaluateExpression(vModel, context);
                    logger.debug(`[JaiPasVu] v-model effect evaluation:`, {
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
                    logger.error('[JaiPasVu] Error in v-model effect:', error);
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
                    logger.debug(`[JaiPasVu] v-model update from DOM:`, {
                        model: vModel,
                        newValue: newValue,
                        elementType: el.type
                    });
                    this.setValueByPath(context, vModel, newValue);
                } catch (error) {
                    logger.error('[JaiPasVu] Error in v-model handler:', error);
                }
            };

            // Remove old listener if exists
            if (el.__v_model_handler)
                el.removeEventListener(eventType, el.__v_model_handler);

            // Add new listener
            el.__v_model_handler = handler;
            el.addEventListener(eventType, handler);
        } catch (error) {
            logger.error('[JaiPasVu] Error in v-model processing:', error);
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
                    logger.error('[JaiPasVu] Error in v-on handler:', error);
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
                                    logger.error('[JaiPasVu] Error evaluating computed property:', error);
                                    return '';
                                }
                            }
                            return value;
                        }
                        // If property doesn't exist, return undefined instead of throwing
                        return undefined;
                    } catch (error) {
                        logger.error('[JaiPasVu] Error accessing property:', error);
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

            logger.debug(`[JaiPasVu] Expression evaluation:`, {
                expression: expression,
                context: context,
                result: result
            });

            return result === undefined ? '' : result;
        } catch (error) {
            logger.error('[JaiPasVu] Expression evaluation error:', error);
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

    /**
     * Gets the current state of a domain
     * @param {string} domain - Domain identifier
     * @returns {Object|undefined} Domain state or undefined if domain doesn't exist
     * 
     * @example
     * const userState = jaiPasVu.getState('userDomain');
     * console.log(userState.name); // Access state properties
     */
    getState(domain) {
        return this.domains.get(domain)?.state;
    }
}

export default new JaiPasVu();
