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

class ReactivitySystem {
    constructor() {
        this.current = null;
        this.stack = [];
    }

    push(effect) {
        this.stack.push(effect);
        this.current = effect;
    }

    pop() {
        this.stack.pop();
        this.current = this.stack[this.stack.length - 1] || null;
    }

    createReactive(obj) {
        const subscribers = new WeakMap();
        const system = this;

        return new Proxy(obj, {
            get(target, key) {
                if (system.current) {
                    if (!subscribers.has(target))
                        subscribers.set(target, new Map());
                    const keySubscribers = subscribers.get(target);
                    if (!keySubscribers.has(key))
                        keySubscribers.set(key, new Set());
                    keySubscribers.get(key).add(system.current);
                }
                return target[key];
            },
            set(target, key, value) {
                const oldValue = target[key];
                target[key] = value;

                if (oldValue !== value && subscribers.has(target)) {
                    const keySubscribers = subscribers.get(target).get(key);
                    if (keySubscribers)
                        keySubscribers.forEach(effect => effect());
                }
                return true;
            }
        });
    }
}

class EventSystem {
    constructor() {
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
    }

    on(hookName, callback) {
        if (this.hooks[hookName]) {
            this.hooks[hookName].add(callback);
            return () => this.off(hookName, callback);
        }
        return () => { };
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
}

class PluginSystem {
    constructor(app) {
        this.app = app;
        this.plugins = new Map();
    }

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
            plugin.install(this.app, options);
            this.plugins.set(pluginName, plugin);
            logger.info(`Plugin ${pluginName} installed successfully`);
        } catch (error) {
            logger.error(`Failed to install plugin ${pluginName}:`, error);
        }

        return this;
    }
}

class DomainSystem {
    constructor(app) {
        this.app = app;
        this.domains = new Map();
        this.observers = new Map();
    }

    registerData(domain, data) {
        if (!this.domains.has(domain)) {
            this.domains.set(domain, {
                state: this.app.reactivity.createReactive({}),
                methods: {},
                computed: new Map()
            });
        }

        const domainData = this.domains.get(domain);
        const computedProps = {};
        const regularData = {};

        // Clear existing state to prevent stale data
        Object.keys(domainData.state).forEach(key => {
            if (!(key in data) && typeof domainData.state[key] !== 'function')
                delete domainData.state[key];
        });

        // Separate computed properties and regular data
        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'function')
                computedProps[key] = value;
            else
                regularData[key] = value;
        });

        Object.assign(domainData.state, regularData);
        if (Object.keys(computedProps).length > 0)
            this.registerComputed(domain, computedProps);

        // Find all elements with this domain and recompile
        const elements = document.querySelectorAll(`[data-domain="${domain}"]`);
        elements.forEach(el => {
            this.app.compiler.compileElement(el);
        });

        return domainData.state;
    }

    registerMethods(domain, methods) {
        if (!this.domains.has(domain)) {
            this.domains.set(domain, {
                state: this.app.reactivity.createReactive({}),
                methods: {},
                computed: new Map()
            });
        }

        const domainData = this.domains.get(domain);
        domainData.methods = Object.entries(methods).reduce((acc, [key, method]) => {
            acc[key] = method.bind(domainData.state);
            return acc;
        }, {});

        Object.assign(domainData.state, domainData.methods);
    }

    registerComputed(domain, computedProps) {
        if (!this.domains.has(domain)) {
            this.domains.set(domain, {
                state: this.app.reactivity.createReactive({}),
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

            const effect = () => {
                try {
                    this.app.reactivity.push(effect);
                    const result = getter.call(domainData.state);
                    return result === undefined ? '' : result;
                } catch (error) {
                    logger.error(`Error in computed property ${key}:`, error);
                    return '';
                } finally {
                    this.app.reactivity.pop();
                }
            };

            domainData.computed.set(key, effect);
            if (key in domainData.state)
                delete domainData.state[key];

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
                configurable: true
            });
        });
    }

    getState(domain) {
        return this.domains.get(domain)?.state;
    }

    subscribe(domain, callback) {
        if (!this.observers.has(domain))
            this.observers.set(domain, new Set());
        this.observers.get(domain).add(callback);
        return () => this.unsubscribe(domain, callback);
    }

    unsubscribe(domain, callback) {
        const observers = this.observers.get(domain);
        if (observers)
            observers.delete(callback);
    }

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
}

class DirectiveSystem {
    constructor(app) {
        this.app = app;
        this.directives = new Map([
            ['v-if', this.processVIf.bind(this)],
            ['v-else-if', this.processVIf.bind(this)],
            ['v-else', this.processVIf.bind(this)],
            ['v-text', this.processVText.bind(this)],
            ['v-for', this.processVFor.bind(this)],
            ['v-model', this.processVModel.bind(this)],
            ['v-bind', this.processVBind.bind(this)],
            ['v-on', this.processVOn.bind(this)]
        ]);
    }

    processDirectives(el, context) {
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
    }

    processVIf(el, context) {
        const vIf = el.getAttribute('v-if');
        const vElseIf = el.getAttribute('v-else-if');
        const vElse = el.hasAttribute('v-else');

        if (!vIf && !vElseIf && !vElse) return;

        const effect = () => {
            try {
                this.app.reactivity.push(effect);
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
                        shouldShow = this.app.compiler.evaluateExpression(vIf, context);
                    } else if (vElseIf) {
                        // Only evaluate if no previous condition was true
                        if (!this.findTruePreviousCondition(el, context)) {
                            shouldShow = this.app.compiler.evaluateExpression(vElseIf, context);
                        }
                    } else if (vElse)
                        shouldShow = !this.findTruePreviousCondition(el, context);
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
                this.app.reactivity.pop();
            }
        };

        effect();
    }

    findTruePreviousCondition(el, context) {
        let previous = el.previousElementSibling;
        while (previous) {
            if (previous.hasAttribute('v-if'))
                return this.app.compiler.evaluateExpression(previous.getAttribute('v-if'), context);
            if (previous.hasAttribute('v-else-if')) {
                const result = this.app.compiler.evaluateExpression(previous.getAttribute('v-else-if'), context);
                if (result) return true;
            }
            previous = previous.previousElementSibling;
        }
        return false;
    }

    hideConditionalSiblings(el) {
        let sibling = el.nextElementSibling;
        while (sibling) {
            if (sibling.hasAttribute('v-else-if') || sibling.hasAttribute('v-else'))
                sibling.style.display = 'none';
            else
                break;
            sibling = sibling.nextElementSibling;
        }
    }

    processVText(el, context) {
        const vText = el.getAttribute('v-text');
        if (!vText) return;

        const effect = () => {
            try {
                this.app.reactivity.push(effect);
                const value = this.app.compiler.evaluateExpression(vText, context);
                el.textContent = value === undefined || value === null ? '' : String(value);
            } finally {
                this.app.reactivity.pop();
            }
        };

        effect();
    }

    processVFor(el, parentContext) {
        const vForAttr = el.getAttribute('v-for');
        if (!vForAttr) return;

        // Parse v-for expression (item in items) or (item, index in items)
        const forMatch = vForAttr.match(/^\s*(?:\(?\s*(\w+)(?:\s*,\s*(\w+))?\s*\)?)\s+in\s+(\w+)\s*$/);
        if (!forMatch) {
            logger.error('Invalid v-for syntax:', vForAttr);
            return;
        }

        const [, itemName, indexName, arrayName] = forMatch;
        const template = el.cloneNode(true);
        template.removeAttribute('v-for');
        const parent = el.parentNode;
        const comment = document.createComment(`v-for: ${vForAttr}`);
        parent.insertBefore(comment, el);
        parent.removeChild(el);

        const effect = () => {
            const array = this.app.compiler.evaluateExpression(arrayName, parentContext);
            if (!Array.isArray(array)) {
                logger.error(`v-for array ${arrayName} is not an array:`, array);
                return;
            }

            // Get existing elements
            let elements = [];
            let node = comment.nextSibling;
            while (node && node.hasAttribute && node.hasAttribute('v-for-item')) {
                elements.push(node);
                node = node.nextSibling;
            }

            // Remove excess elements
            while (elements.length > array.length) {
                const el = elements.pop();
                parent.removeChild(el);
            }

            // Update or add elements
            array.forEach((item, index) => {
                const itemContext = Object.create(parentContext);
                itemContext[itemName] = item;
                if (indexName)
                    itemContext[indexName] = index;

                let element;
                if (index < elements.length) {
                    element = elements[index];
                } else {
                    element = template.cloneNode(true);
                    element.setAttribute('v-for-item', '');
                    parent.insertBefore(element, comment.nextSibling);
                    elements.push(element);
                }

                // Recompile the element with the new context
                this.app.compiler.compileElement(element, itemContext);
            });
        };

        this.app.reactivity.push(effect);
        effect();
        this.app.reactivity.pop();
    }

    processVModel(el, context) {
        const vModel = el.getAttribute('v-model');
        if (!vModel) return;

        const effect = () => {
            const value = this.app.compiler.evaluateExpression(vModel, context);
            if (el.type === 'checkbox')
                el.checked = !!value;
            else if (el.type === 'radio')
                el.checked = String(el.value) === String(value);
            else
                el.value = value === undefined || value === null ? '' : String(value);
        };

        const handler = (event) => {
            let value;
            if (el.type === 'checkbox')
                value = el.checked;
            else if (el.type === 'radio')
                value = el.value;
            else
                value = el.value;

            // Set the value in the context
            const props = vModel.split('.');
            let target = context;
            const lastProp = props.pop();

            // Navigate to the correct object
            for (const prop of props) {
                if (!(prop in target))
                    target[prop] = {};
                target = target[prop];
            }

            if (target && typeof target === 'object')
                target[lastProp] = value;
        };

        // Add event listeners based on input type
        if (el.type === 'checkbox' || el.type === 'radio')
            el.addEventListener('change', handler);
        else
            el.addEventListener('input', handler);

        // Initial value
        this.app.reactivity.push(effect);
        effect();
        this.app.reactivity.pop();

        // Store cleanup function
        el.__v_model_cleanup = () => {
            if (el.type === 'checkbox' || el.type === 'radio')
                el.removeEventListener('change', handler);
            else
                el.removeEventListener('input', handler);
        };
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
                        this.app.reactivity.push(effect);
                        const value = this.app.compiler.evaluateExpression(expression, context);
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
                        this.app.reactivity.pop();
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
            if (!isVOn && !isAtPrefix) return;

            const event = isVOn ? attr.name.split(':')[1] : attr.name.slice(1);
            const expression = attr.value;

            // Remove old listener if exists
            if (el.__v_on_handlers && el.__v_on_handlers[event])
                el.removeEventListener(event, el.__v_on_handlers[event]);

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
                            args.split(',').map(arg => this.app.compiler.evaluateExpression(arg.trim(), eventContext)) :
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

    processInterpolation(el, context) {
        const interpolationRegex = /\[\[(.*?)\]\]/g;
        const processNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                if (interpolationRegex.test(text)) {
                    const originalText = text;
                    const effect = () => {
                        let newText = originalText.replace(interpolationRegex, (match, expression) => {
                            const value = this.app.compiler.evaluateExpression(expression.trim(), context);
                            return value === undefined || value === null ? '' : String(value);
                        });
                        if (node.textContent !== newText) {
                            node.textContent = newText;
                        }
                    };
                    this.app.reactivity.push(effect);
                    effect();
                    this.app.reactivity.pop();
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                Array.from(node.childNodes).forEach(child => processNode(child));
            }
        };
        processNode(el);
    }
}

class TemplateCompiler {
    constructor(app) {
        this.app = app;
    }

    compileElement(el, state = null) {
        if (!el) return;

        this.app.events.emit('beforeCompile', el, state);

        const domain = el.getAttribute('data-domain');
        const parentDomainEl = domain ? el.closest(`[data-domain]:not([data-domain="${domain}"])`) : null;
        const parentDomain = parentDomainEl?.getAttribute('data-domain');
        const parentData = parentDomain ? this.app.domains.getState(parentDomain) : null;
        const domainData = domain ? this.app.domains.getState(domain) : null;

        let context;
        if (domain)
            context = this.createContext(domain, domainData, parentData, state);
        else if (state)
            context = state;
        else if (parentData)
            context = parentData;
        else
            context = {};

        this.app.directives.processDirectives(el, context);
        this.app.events.emit('afterCompile', el, state);

        if (el.style.display !== 'none') {
            Array.from(el.children).forEach(child => {
                const childDomain = child.getAttribute('data-domain');
                if (childDomain) // Pass parent context as state for nested domains
                    this.compileElement(child, context);
                else
                    this.compileElement(child, context);
            });
        }
    }

    createContext(domain, domainData, parentData, state) {
        if (!domainData) {
            domainData = {
                state: {},
                methods: {},
                computed: new Map()
            };
        }

        // Create a proxy that inherits from parent context
        const context = new Proxy({
            $domain: domain,
            $state: state || domainData.state || {},
            $methods: domainData.methods || {},
            $computed: domainData.computed || new Map(),
            $parent: parentData
        }, {
            get(target, prop) {
                // Special properties
                if (prop in target)
                    return target[prop];
                // First check in current domain's state
                if (target.$state && prop in target.$state)
                    return target.$state[prop];
                // Then check current domain's computed properties
                if (target.$computed && target.$computed.has(prop))
                    return target.$computed.get(prop)();
                // Then check current domain's methods
                if (target.$methods && prop in target.$methods)
                    return target.$methods[prop];

                // Finally check parent context if it exists
                if (target.$parent) {
                    if (prop in target.$parent) // Check parent's state
                        return target.$parent[prop];
                    // Check parent's computed properties
                    if (target.$parent.$computed && target.$parent.$computed.has(prop))
                        return target.$parent.$computed.get(prop)();
                }

                return undefined;
            },
            set(target, prop, value) {
                // First try to set in current domain's state
                if (target.$state && (prop in target.$state || !target.$parent)) {
                    target.$state[prop] = value;
                    return true;
                }

                // If not found in current domain and we have a parent, try to set in parent
                if (target.$parent && prop in target.$parent) {
                    target.$parent[prop] = value;
                    return true;
                }

                // If not found anywhere, set in current domain's state
                target.$state[prop] = value;
                return true;
            },
            has(target, prop) {
                return (target.$state && prop in target.$state) ||
                    (target.$computed && target.$computed.has(prop)) ||
                    (target.$methods && prop in target.$methods) ||
                    (target.$parent && (
                        prop in target.$parent ||
                        (target.$parent.$computed && target.$parent.$computed.has(prop))
                    ));
            }
        });

        return context;
    }

    evaluateExpression(expression, context) {
        try {
            const proxy = new Proxy(context || {}, {
                get(target, prop) {
                    try {
                        if (prop in target) {
                            const value = target[prop];
                            // Handle method calls
                            if (typeof value === 'function') {
                                if (expression.includes('(')) {
                                    return value.bind(target);
                                } else {
                                    try {
                                        const result = value.call(target);
                                        return result;
                                    } catch (error) {
                                        logger.error('Error evaluating method:', error);
                                        return undefined;
                                    }
                                }
                            }
                            return value;
                        }
                        return undefined;
                    } catch (error) {
                        logger.error('Error accessing property:', error);
                        return undefined;
                    }
                },
                has(target, prop) {
                    return prop in target;
                }
            });

            const fn = new Function('ctx', `with(ctx) { return ${expression}; }`);
            return fn(proxy);
        } catch (error) {
            logger.error('Expression evaluation error:', error);
            return undefined;
        }
    }
}

class JaiPasVu {
    constructor() {
        if (JaiPasVu.instance)
            return JaiPasVu.instance;

        this.initialized = false;
        this.root = null;
        this.updateQueue = new Set();
        this.updateScheduled = false;

        this.reactivity = new ReactivitySystem();
        this.events = new EventSystem();
        this.plugins = new PluginSystem(this);
        this.domains = new DomainSystem(this);
        this.directives = new DirectiveSystem(this);
        this.compiler = new TemplateCompiler(this);

        JaiPasVu.instance = this;
    }

    initialize(root = document.body) {
        if (this.initialized) {
            logger.warn("JaiPasVu is already initialized");
            return this;
        }

        this.events.emit('beforeMount');
        this.root = root;
        this.initialized = true;
        this.events.emit('mounted');

        return this;
    }

    // Public API methods
    use(plugin, options = {}) {
        return this.plugins.use(plugin, options);
    }

    on(hookName, callback) {
        return this.events.on(hookName, callback);
    }

    off(hookName, callback) {
        this.events.off(hookName, callback);
    }

    registerData(domain, data) {
        this.domains.registerData(domain, data);
    }

    registerMethods(domain, methods) {
        this.domains.registerMethods(domain, methods);
    }

    registerComputed(domain, computedProps) {
        this.domains.registerComputed(domain, computedProps);
    }

    getState(domain) {
        return this.domains.getState(domain);
    }

    cleanup(el) {
        this.events.emit('beforeDestroy', el);

        // Clean up event listeners
        const events = [
            'htmx:beforeRequest',
            'htmx:afterRequest',
            'htmx:beforeSwap',
            'htmx:afterSwap',
            'htmx:responseError'
        ];
        events.forEach(event => {
            el.removeEventListener(event, () => { });
        });

        // Clean up domain observers and state
        if (el.hasAttribute('data-domain')) {
            const domain = el.getAttribute('data-domain');
            if (this.domains.observers.has(domain)) {
                this.domains.observers.get(domain).clear();
            }
        }

        // Recursively cleanup child elements
        Array.from(el.children).forEach(child => {
            this.cleanup(child);
        });

        // Clean up v-model listeners
        const vModelElements = el.querySelectorAll('[v-model]');
        vModelElements.forEach(element => {
            element.removeEventListener('input', () => { });
            element.removeEventListener('change', () => { });
        });

        // Clean up v-on listeners
        const vOnElements = el.querySelectorAll('[v-on\\:click], [v-on\\:input], [v-on\\:change], [v-on\\:submit]');
        vOnElements.forEach(element => {
            const attrs = element.attributes;
            for (let i = 0; i < attrs.length; i++) {
                const attr = attrs[i];
                if (attr.name.startsWith('v-on:')) {
                    const eventType = attr.name.split(':')[1];
                    element.removeEventListener(eventType, () => { });
                }
            }
        });

        this.events.emit('destroyed', el);

        if (el.parentNode && el !== this.root)
            el.parentNode.removeChild(el);
    }
}

export default new JaiPasVu();
