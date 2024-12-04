import logger from "./logger.js";

class DynamicRender {
    constructor() {
        this.initialized = false;
    }

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

    addObservedObject(key, object) {
        if (!this.initialized) {
            logger.warn("DynamicRender is not initialized. Call initialize() first.");
            return;
        }
        this.observedObjects.set(key, this.makeReactive(object, key));
        this.scheduleUpdate();
    }

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

    scheduleUpdate() {
        if (!this.updateScheduled) {
            this.updateScheduled = true;
            queueMicrotask(() => {
                this.update();
                this.updateScheduled = false;
            });
        }
    }

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
    }

    bindText() {
        this.root.querySelectorAll("[v-text]").forEach((el) => {
            const prop = el.getAttribute("v-text");
            el.textContent = this.getPropValue(prop);
            console.log(`Binding v-text for ${prop}:`, el.textContent); // Log pour le débogage
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

            console.log(`Binding v-for for ${items}:`, itemsArray); // Log pour le débogage

            // Vérifier si itemsArray est un Proxy et le dé-proxifier si nécessaire
            if (itemsArray && typeof itemsArray === 'object' && itemsArray.constructor.name === 'Proxy') {
                itemsArray = Array.from(itemsArray);
            }

            if (!Array.isArray(itemsArray)) {
                console.warn(`v-for data is not an array: ${items}`);
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
        element.querySelectorAll("[v-if]").forEach((el) => {
            const condition = el.getAttribute("v-if");
            const isVisible = this.evaluateExpression(condition, localContext);
            el.style.setProperty('display', isVisible ? '' : 'none', 'important');

            // Rebind les événements si l'élément devient visible
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
        try {
            return new Function(...Object.keys(data), `return ${expression}`)(...Object.values(data));
        } catch (error) {
            console.error(`Error evaluating expression: ${expression}`, error);
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
}
const dynamicRender = new DynamicRender();
export default dynamicRender;
