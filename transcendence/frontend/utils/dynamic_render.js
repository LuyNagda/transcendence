/**
 * DynamicRender - A lightweight Vue.js-inspired reactive framework
 * 
 * This micro-framework implements a subset of Vue.js functionality for simple reactive data binding.
 * It is not meant to be a full Vue.js replacement but rather a minimal implementation for basic use cases.
 * 
 * Supported Vue.js Features:
 * - v-text: Text content binding (equivalent to Vue's v-text or {{}} interpolation)
 * - v-if: Conditional rendering
 * - v-for: List rendering (simplified, only supports "item in items" syntax)
 * - v-model: Two-way data binding (supports input and select elements)
 * - v-on: Event handling (supports click and change via v-on:click and v-on:change)
 * 
 * Key Differences from Vue.js:
 * - No virtual DOM - uses direct DOM manipulation
 * - No component system - works with plain objects and DOM elements
 * - Limited reactivity - only tracks direct property changes
 * - No computed properties or watchers, lifecycle hooks, directives system, slots or scoped slots, transitions/animations
 * 
 * Usage Example:
 * ```js
 * // Initialize the framework
 * dynamicRender.initialize();
 * 
 * // Add reactive object
 * dynamicRender.addObservedObject('myData', {
 *   message: 'Hello',
 *   items: ['a', 'b', 'c']
 * });
 * ```
 * 
 * HTML Template Example:
 * ```html
 * <div v-text="myData.message"></div>
 * <div v-if="myData.items.length > 0">
 *   <ul>
 *     <li v-for="item in myData.items" v-text="item"></li>
 *   </ul>
 * </div>
 * <input v-model="myData.message">
 * <button v-on:click="myData.handleClick">Click me</button>
 * ```
 */

import logger from "./logger.js";

class DynamicRender {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the framework. Must be called before any other operations.
     * Unlike Vue.js which creates a new app instance, this initializes a singleton.
     */
    initialize() {
        if (this.initialized) {
            logger.warn("DynamicRender is already initialized");
            return;
        }
        this.root = document.body;
        this.observedObjects = new Map();
        this.updateScheduled = false;
        this.initialized = true;
        logger.info("DynamicRender initialized");
    }

    /**
     * Add a reactive object to be observed.
     * Unlike Vue.js data option, objects are added explicitly with a key.
     * @param {string} key - Identifier for the reactive object
     * @param {Object} object - Object to make reactive
     */
    addObservedObject(key, object) {
        if (!this.initialized) {
            logger.warn("DynamicRender is not initialized. Call initialize() first.");
            return;
        }
        this.observedObjects.set(key, this.makeReactive(object, key));
        this.scheduleUpdate();
    }

    /**
     * Makes an object reactive using ES6 Proxy
     * Simpler than Vue.js reactivity system - no deep reactivity
     */
    makeReactive(obj, parentKey) {
        if (typeof obj !== "object" || obj === null) {
            return obj;
        }

        const handler = {
            get: (target, property) => {
                if (typeof target[property] === "object" && target[property] !== null) {
                    return new Proxy(target[property], handler);
                }
                return target[property];
            },
            set: (target, property, value) => {
                if (target[property] !== value) {
                    target[property] = value;
                    this.scheduleUpdate();
                }
                return true;
            },
        };

        return new Proxy(obj, handler);
    }

    /**
     * Schedule a DOM update using microtask queue
     * Simpler than Vue.js nextTick - no callback support
     */
    scheduleUpdate() {
        if (!this.updateScheduled) {
            this.updateScheduled = true;
            queueMicrotask(() => {
                this.update();
                this.updateScheduled = false;
            });
        }
    }

    /**
     * Update all bindings in the DOM
     */
    update() {
        if (!this.initialized) {
            logger.warn("DynamicRender is not initialized. Call initialize() first.");
            return;
        }
        this.bindText();
        this.bindIf();
        this.bindFor();
        this.bindModel();
        this.bindOn();
        this.bindStyle();
    }

    bindText() {
        this.root.querySelectorAll("[v-text]").forEach((el) => {
            const prop = el.getAttribute("v-text");
            el.textContent = this.getPropValue(prop);
            logger.debug(`Binding v-text for ${prop}:`, el.textContent); // Log pour le débogage
        });
    }

    bindIf() {
        this.root.querySelectorAll("[v-if]").forEach((el) => {
            if (!el.closest("[v-for]")) {
                const condition = el.getAttribute("v-if");
                const wasVisible = el.style.display !== 'none';
                const isVisible = this.evaluateExpression(condition);

                // Si l'élément devient visible
                if (!wasVisible && isVisible) {
                    el.style.removeProperty('display');
                    // Réinitialiser les bindings sur l'élément et ses enfants
                    this.bindOnForElement(el);
                    this.bindTextForElement(el);
                    this.bindModelForElement(el);
                } else if (wasVisible && !isVisible) {
                    el.style.setProperty('display', 'none', 'important');
                }
            }
        });
    }

    bindFor() {
        this.root.querySelectorAll("[v-for]").forEach((el) => {
            const forAttr = el.getAttribute("v-for");
            const [item, items] = forAttr.split(" in ").map((s) => s.trim());
            let itemsArray = this.getPropValue(items);

            logger.debug(`Binding v-for for ${items}:`, itemsArray); // Log pour le débogage

            // Vérifier si itemsArray est un Proxy et le dé-proxifier si nécessaire
            if (itemsArray && typeof itemsArray === 'object' && itemsArray.constructor.name === 'Proxy') {
                itemsArray = Array.from(itemsArray);
            }

            if (!Array.isArray(itemsArray)) {
                logger.warn(`v-for data is not an array: ${items}`);
                return;
            }

            // Vérifier si un conteneur v-for existe déjà
            let container = el.previousElementSibling;
            if (!container || !container.hasAttribute('v-for-container')) {
                // Créer un conteneur pour les éléments clonés si nécessaire
                container = document.createElement('div');
                container.setAttribute('v-for-container', '');
                el.parentNode.insertBefore(container, el);
            } else {
                // Vider le conteneur existant
                container.innerHTML = '';
            }

            itemsArray.forEach((itemData, index) => {
                const clone = el.cloneNode(true);
                clone.removeAttribute("v-for");
                clone.style.removeProperty('display');

                this.replaceTemplateStrings(clone, {
                    [item]: itemData,
                    [`${item}Index`]: index,
                });

                this.bindIfForElement(clone, {
                    [item]: itemData,
                    pongRoom: this.observedObjects.get('pongRoom'),
                });

                this.bindTextForElement(clone, {
                    [item]: itemData,
                    pongRoom: this.observedObjects.get('pongRoom'),
                });

                // Ajouter le binding des événements pour le clone
                this.bindOnForElement(clone);

                container.appendChild(clone);
            });

            // Cacher l'élément original avec !important
            el.style.setProperty('display', 'none', 'important');
        });
    }

    bindIfForElement(element, localContext) {
        logger.debug('Binding if for element with context:', {
            element: element.outerHTML,
            localContext: Object.keys(localContext)
        });

        element.querySelectorAll("[v-if]").forEach((el) => {
            const condition = el.getAttribute("v-if");
            const isVisible = this.evaluateExpression(condition, localContext);

            logger.debug('v-if evaluation:', {
                condition,
                isVisible,
                context: Object.keys(localContext)
            });

            el.style.setProperty('display', isVisible ? '' : 'none', 'important');

            // Rebind events if element becomes visible
            if (isVisible) {
                this.bindOnForElement(el);
            }
        });
    }

    bindOnForElement(element) {
        // Bind sur l'élément lui-même
        if (element.hasAttribute("v-on:click")) {
            const method = element.getAttribute("v-on:click");
            logger.debug(`Binding click event with method: ${method}`);
            element.onclick = (event) => {
                logger.debug(`Click event triggered for method: ${method}`);
                this.callMethod(method, event);
            };
        }
        if (element.hasAttribute("v-on:change")) {
            const method = element.getAttribute("v-on:change");
            element.onchange = (event) => this.callMethod(method, event);
        }

        // Bind sur les enfants
        element.querySelectorAll("[v-on\\:click], [v-on\\:change]").forEach((el) => {
            if (el.hasAttribute("v-on:click")) {
                const method = el.getAttribute("v-on:click");
                logger.debug(`Binding click event on child with method: ${method}`);
                el.onclick = (event) => {
                    logger.debug(`Click event triggered on child for method: ${method}`);
                    this.callMethod(method, event);
                };
            }
            if (el.hasAttribute("v-on:change")) {
                const method = el.getAttribute("v-on:change");
                el.onchange = (event) => this.callMethod(method, event);
            }
        });
    }

    bindModelForElement(element) {
        element.querySelectorAll("[v-model]").forEach((el) => {
            const prop = el.getAttribute("v-model");
            const value = this.getPropValue(prop);

            if (el.tagName === 'SELECT') {
                el.value = value;
                el.addEventListener("change", (e) => {
                    this.setPropValue(prop, e.target.value);
                });
            } else {
                el.value = value;
                el.addEventListener("input", (e) => {
                    this.setPropValue(prop, e.target.value);
                });
            }
        });
    }

    bindModel() {
        this.root.querySelectorAll("[v-model]").forEach((el) => {
            const prop = el.getAttribute("v-model");
            const value = this.getPropValue(prop);

            if (el.tagName === 'SELECT') {
                el.value = value;
                el.addEventListener("change", (e) => {
                    this.setPropValue(prop, e.target.value);
                });
            } else {
                el.value = value;
                el.addEventListener("input", (e) => {
                    this.setPropValue(prop, e.target.value);
                });
            }
        });
    }

    bindOn() {
        this.bindOnForElement(this.root);
    }

    getPropValue(prop) {
        const [objKey, ...path] = prop.split(".");
        const obj = this.observedObjects.get(objKey);
        return path.reduce((value, key) => value && value[key], obj);
    }

    setPropValue(prop, value) {
        const [objKey, ...path] = prop.split(".");
        const obj = this.observedObjects.get(objKey);
        if (path.length === 0) {
            // Si c'est une propriété directe de l'objet observé
            obj[objKey] = value;
        } else {
            const target = path.slice(0, -1).reduce((value, key) => value && value[key], obj);
            const key = path[path.length - 1];
            if (target && key) {
                target[key] = value; // Ceci déclenchera le setter
            }
        }
    }

    callMethod(method, event) {
        const [objKey, methodName] = method.split(".");
        const obj = this.observedObjects.get(objKey);

        logger.debug("Attempting to call method", {
            method,
            objKey,
            methodName,
            objectKeys: obj ? Object.keys(obj) : null,
            objectType: obj ? typeof obj : null,
            methodType: obj ? typeof obj[methodName] : null
        });

        if (obj && typeof obj[methodName] === "function") {
            try {
                obj[methodName](event);
            } catch (error) {
                logger.error(`Error executing method ${method}:`, error);
            }
        } else {
            logger.error(`Method ${method} not found or not callable`, {
                objectExists: !!obj,
                methodExists: obj && typeof obj[methodName] === "function",
                availableMethods: obj ? Object.getOwnPropertyNames(obj) : []
            });
        }
    }

    evaluateExpression(expression, localContext = {}) {
        const data = {
            ...Object.fromEntries(this.observedObjects),
            ...localContext,
        };

        // Check if we're in a v-for context by looking for typical v-for variables
        const isInVForContext = expression.includes('player.') || expression.includes('item.') || expression.includes('invitation.');

        try {
            const result = new Function(...Object.keys(data), `
                try {
                    return ${expression};
                } catch (e) {
                    if (e instanceof ReferenceError && ${isInVForContext}) {
                        return false;
                    }
                    throw e;
                }
            `)(...Object.values(data));

            if (result !== false) {
                logger.debug('Expression result:', {
                    expression,
                    result,
                    context: Object.keys(data)
                });
            }
            return result;
        } catch (error) {
            if (!isInVForContext) {
                logger.error(`Error evaluating expression: ${expression}`, {
                    error,
                    context: Object.keys(data),
                    localContext: Object.keys(localContext)
                });
            }
            return false;
        }
    }

    replaceTemplateStrings(el, data) {
        el.innerHTML = el.innerHTML.replace(/\{\{(.+?)\}\}/g, (_, p1) => {
            return this.getPropValue(p1.trim()) || data[p1.trim()] || "";
        });
    }

    bindTextForElement(element, localContext) {
        element.querySelectorAll("[v-text]").forEach((el) => {
            const prop = el.getAttribute("v-text");
            el.textContent = this.evaluateExpression(prop, localContext);
        });
    }

    bindStyle() {
        this.root.querySelectorAll("[v-bind\\:style]").forEach((el) => {
            const styleExpr = el.getAttribute("v-bind:style");
            try {
                const styleObj = this.evaluateExpression(styleExpr);
                if (styleObj && typeof styleObj === 'object') {
                    Object.entries(styleObj).forEach(([prop, value]) => {
                        // Convert camelCase to kebab-case
                        const kebabProp = prop.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
                        el.style[kebabProp] = value;
                    });
                }
            } catch (error) {
                logger.error(`Error binding style ${styleExpr}:`, error);
            }
        });
    }
}
const dynamicRender = new DynamicRender();
export default dynamicRender;
