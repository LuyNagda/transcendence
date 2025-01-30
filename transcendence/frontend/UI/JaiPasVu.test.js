import { jest, describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { JaiPasVuTestFactory } from './JaiPasVuTestFactory.js';
import jaiPasVu from './JaiPasVu.js';

describe('JaiPasVu', () => {
	let factory;

	beforeEach(() => {
		factory = new JaiPasVuTestFactory();
		factory.setup();
	});

	afterEach(() => {
		factory.cleanup();
	});

	describe('Core Framework Setup', () => {
		test('should initialize framework correctly', () => {
			expect(factory.jaiPasVu.initialized).toBe(true);
			expect(factory.jaiPasVu.root).toBeDefined();
			expect(factory.jaiPasVu.domains).toBeDefined();
			expect(factory.jaiPasVu.updateQueue).toBeDefined();
		});

		test('should prevent multiple initializations', () => {
			factory.jaiPasVu.initialize(document.body);
			expect(global.consoleMocks.warn).toHaveBeenCalledWith('[WARN] JaiPasVu is already initialized');
		});

		test('should setup core hooks', () => {
			const hooks = factory.jaiPasVu.hooks;
			expect(hooks.beforeMount).toBeDefined();
			expect(hooks.mounted).toBeDefined();
			expect(hooks.beforeUpdate).toBeDefined();
			expect(hooks.updated).toBeDefined();
			expect(hooks.beforeDestroy).toBeDefined();
			expect(hooks.destroyed).toBeDefined();
			expect(hooks.beforeCompile).toBeDefined();
			expect(hooks.afterCompile).toBeDefined();
		});

		test('should emit initialization lifecycle events', () => {
			const beforeMount = jest.fn();
			const mounted = jest.fn();
			const newFactory = new JaiPasVuTestFactory();

			// Reset the singleton instance state
			jaiPasVu.initialized = false;
			jaiPasVu.root = null;

			// Register hooks
			jaiPasVu.on('beforeMount', beforeMount);
			jaiPasVu.on('mounted', mounted);

			// Initialize
			newFactory.container = document.createElement('div');
			document.body.appendChild(newFactory.container);
			jaiPasVu.initialize(newFactory.container);

			expect(beforeMount).toHaveBeenCalled();
			expect(mounted).toHaveBeenCalled();

			newFactory.cleanup();
		});
	});

	describe('Plugin System', () => {
		test('should register and initialize plugins', () => {
			const mockPlugin = {
				name: 'test-plugin',
				install: jest.fn()
			};

			factory.registerMockPlugin('test-plugin', mockPlugin);
			expect(mockPlugin.install).toHaveBeenCalledWith(factory.jaiPasVu, {});
		});

		test('should prevent duplicate plugin registration', () => {
			const mockPlugin = {
				name: 'test-plugin',
				install: jest.fn()
			};

			factory.registerMockPlugin('test-plugin', mockPlugin);
			factory.jaiPasVu.use(mockPlugin);

			expect(global.consoleMocks.warn).toHaveBeenCalledWith('[WARN] Plugin test-plugin is already installed');
		});

		test('should handle plugin installation errors gracefully', () => {
			const mockPlugin = {
				name: 'error-plugin',
				install: () => { throw new Error('Installation failed'); }
			};

			factory.jaiPasVu.use(mockPlugin);
			expect(global.consoleMocks.error).toHaveBeenCalledWith(
				'[ERROR] Failed to install plugin error-plugin:',
				expect.any(Error)
			);
		});

		test('should handle plugin hooks in correct order', () => {
			const sequence = [];
			const beforeCompileCallback = () => sequence.push('beforeCompile');
			const afterCompileCallback = () => sequence.push('afterCompile');

			factory.jaiPasVu.on('beforeCompile', beforeCompileCallback);
			factory.jaiPasVu.on('afterCompile', afterCompileCallback);

			factory.loadTemplate('<div data-domain="test">Test</div>', 'test');
			factory.registerData('test', { show: true });

			// We expect two compilation cycles:
			const expectedSequence = [
				'beforeCompile', 'afterCompile',  // 1. When template is loaded
				'beforeCompile', 'afterCompile'   // 2. When data is registered
			];

			// Only check the first 4 events since recursive compilation may add more
			expect(sequence.slice(0, 4)).toEqual(expectedSequence);
		});

		test('should allow hook unsubscription', () => {
			const callback = jest.fn();
			const unsubscribe = factory.jaiPasVu.on('beforeCompile', callback);

			unsubscribe();
			factory.loadTemplate('<div>Test</div>', 'test');

			expect(callback).not.toHaveBeenCalled();
		});
	});

	describe('Core Data Binding & State Management', () => {
		test('should register data without errors', () => {
			factory.loadTemplate('<div data-domain="test">Test</div>', 'test');
			expect(() => {
				factory.registerData('test', { value: 'test' });
			}).not.toThrow();
		});

		test('should store and retrieve data correctly', () => {
			factory.loadTemplate('<div data-domain="test">Test</div>', 'test');
			const testData = { value: 'test', nested: { prop: 'nested' } };
			factory.registerData('test', testData);
			expect(factory.getData('test')).toEqual(testData);
		});

		test('should handle nested property access safely', () => {
			factory.loadTemplate(`
				<div data-domain="test">
					<div v-if="typeof user !== 'undefined' && user.name === 'test'" id="name-check">User Test</div>
					<div v-if="typeof user !== 'undefined'" id="prop-check">Has User</div>
				</div>
			`, 'test');
			factory.registerData('test', { user: { name: 'test' } });
			expect(factory.isVisible("#name-check")).toBe(true);
			expect(factory.isVisible("#prop-check")).toBe(true);
		});
	});

	// Core Template Directives
	describe('Template Directives', () => {
		describe('v-if Directive', () => {
			test('should evaluate string equality expressions correctly', () => {
				factory.registerData('test', { theme: 'light' });
				factory.loadTemplate(`
					<div v-if="theme === 'light'">Light Theme</div>
					<div v-if="theme !== 'dark'">Not Dark</div>
				`, 'test');
				expect(factory.isVisible("div[v-if=\"theme === 'light'\"]")).toBe(true);
				expect(factory.isVisible("div[v-if=\"theme !== 'dark'\"]")).toBe(true);
			});
		});

		// describe('v-for Directive', () => {
		// 	beforeEach(() => {
		// 		factory.loadTemplate(`
		// 			<div>
		// 				<ul>
		// 					<li v-for="item in items">[[item]]</li>
		// 				</ul>
		// 				<div>
		// 					<div v-for="(item, index) in items" class="indexed-item">
		// 						[[index]]: [[item]]
		// 					</div>
		// 				</div>
		// 			</div>
		// 		`, 'test');
		// 	});

		// 	test('should render list items correctly', () => {
		// 		factory.registerData('test', { items: ['apple', 'banana', 'orange'] });
		// 		const listItems = factory.getTextContent('li');
		// 		expect(listItems).toEqual(['apple', 'banana', 'orange']);
		// 	});

		// 	test('should handle index in v-for', () => {
		// 		factory.registerData('test', { items: ['apple', 'banana', 'orange'] });
		// 		const indexedItems = factory.getTextContent('.indexed-item');
		// 		expect(indexedItems).toEqual(['0: apple', '1: banana', '2: orange']);
		// 	});

		// 	test('should update list items incrementally', () => {
		// 		factory.registerData('test', { items: ['apple'] });
		// 		expect(factory.getTextContent('li')).toEqual(['apple']);

		// 		factory.registerData('test', { items: ['apple', 'banana'] });
		// 		expect(factory.getTextContent('li')).toEqual(['apple', 'banana']);
		// 	});
		// });

		describe('v-model Directive', () => {
			test('should bind checkbox state', () => {
				factory.loadTemplate(`
					<div data-domain="test">
						<input type="checkbox" v-model="checked" id="checkbox-input">
					</div>
				`, 'test');
				factory.registerData('test', { checked: true });
				const checkbox = factory.query('#checkbox-input');
				expect(checkbox.checked).toBe(true);

				// Verify two-way binding
				checkbox.checked = false;
				checkbox.dispatchEvent(new Event('change'));
				expect(factory.getData('test').checked).toBe(false);

				// Verify reactive update
				factory.registerData('test', { checked: true });
				expect(checkbox.checked).toBe(true);
			});

			test('should bind text input value', () => {
				factory.loadTemplate(`
					<div data-domain="test">
						<input type="text" v-model="text" id="text-input">
					</div>
				`, 'test');
				factory.registerData('test', { text: 'initial' });
				const input = factory.query('#text-input');
				expect(input.value).toBe('initial');

				// Verify two-way binding
				input.value = 'changed';
				input.dispatchEvent(new Event('input'));
				expect(factory.getData('test').text).toBe('changed');

				// Verify reactive update
				factory.registerData('test', { text: 'updated' });
				expect(input.value).toBe('updated');
			});
		});
	});

	describe('Computed Properties', () => {
		beforeEach(() => {
			factory.loadTemplate(`
				<div data-domain="test">
					<div id="full-name" v-text="fullName"></div>
					<div id="item-count" v-text="itemCount"></div>
					<div id="nested-computed" v-text="doubleItemCount"></div>
				</div>
			`, 'test');
		});

		test('should compute derived values', () => {
			const computedProps = {
				fullName: function () { return `${this.firstName} ${this.lastName}`; },
				itemCount: function () { return this.items.length; }
			};

			// Register data and computed properties together
			factory.registerData('test', {
				firstName: 'John',
				lastName: 'Doe',
				items: ['a', 'b', 'c'],
				...computedProps
			});

			expect(factory.query('#full-name').textContent).toBe('John Doe');
			expect(factory.query('#item-count').textContent).toBe('3');
		});

		test('should update when dependencies change', () => {
			const computedProps = {
				fullName: function () { return `${this.firstName} ${this.lastName}`; }
			};

			// Register initial data with computed
			factory.registerData('test', {
				firstName: 'John',
				lastName: 'Doe',
				...computedProps
			});

			expect(factory.query('#full-name').textContent).toBe('John Doe');

			// Update data should trigger recomputation
			factory.registerData('test', {
				firstName: 'Jane',
				lastName: 'Doe',
				...computedProps  // Need to include computed again as registerData replaces all data
			});

			expect(factory.query('#full-name').textContent).toBe('Jane Doe');
		});

		test('should handle nested computed properties', () => {
			const computedProps = {
				itemCount: function () { return this.items.length; },
				doubleItemCount: function () { return this.itemCount * 2; }
			};

			// Register data with computed properties
			factory.registerData('test', {
				items: ['a', 'b', 'c'],
				...computedProps
			});

			expect(factory.query('#item-count').textContent).toBe('3');
			expect(factory.query('#nested-computed').textContent).toBe('6');

			// Update data should trigger recomputation of both properties
			factory.registerData('test', {
				items: ['a', 'b', 'c', 'd'],
				...computedProps
			});

			expect(factory.query('#item-count').textContent).toBe('4');
			expect(factory.query('#nested-computed').textContent).toBe('8');
		});

		test('should handle invalid computed properties gracefully', () => {
			const computedProps = {
				invalidComputed: 'not a function'
			};

			factory.registerData('test', {});
			jaiPasVu.registerComputed('test', computedProps);

			expect(global.consoleMocks.error).toHaveBeenCalledWith(
				'[ERROR] Computed property invalidComputed must be a function'
			);
		});

		test('should handle errors in computed getters', () => {
			factory.loadTemplate(`
				<div data-domain="test">
					<div id="error-prone" v-text="errorProne"></div>
				</div>
			`, 'test');

			const computedProps = {
				errorProne: function () {
					// Access undefined property to trigger error
					return this.nonExistentProp.value;
				}
			};

			// Register data with computed property
			factory.registerData('test', {
				...computedProps
			});

			// Should not crash and should display empty string for failed computation
			expect(factory.query('#error-prone').textContent).toBe('');

			// Verify that error was logged
			expect(global.consoleMocks.error).toHaveBeenCalledWith(
				expect.stringContaining('[ERROR] Error in computed property errorProne:'),
				expect.any(TypeError)
			);
		});
	});

	describe('Text Interpolation', () => {
		test('should interpolate simple text values', () => {
			factory.loadTemplate(`
				<div data-domain="test">
					<span>Hello [[name]]!</span>
					<p>Count: [[count]]</p>
				</div>
			`, 'test');
			factory.registerData('test', { name: 'World', count: 42 });

			expect(factory.getTextContent('span')[0]).toBe('Hello World!');
			expect(factory.getTextContent('p')[0]).toBe('Count: 42');
		});

		test('should handle multiple interpolations in single text node', () => {
			factory.loadTemplate(`
				<div data-domain="test">
					<span>[[greeting]] [[name]]! You have [[count]] messages.</span>
				</div>
			`, 'test');
			factory.registerData('test', { greeting: 'Hello', name: 'User', count: 5 });

			expect(factory.getTextContent('span')[0]).toBe('Hello User! You have 5 messages.');
		});

		test('should handle expressions in interpolation', () => {
			factory.loadTemplate(`
				<div data-domain="test">
					<span>Total: [[count * 2]]</span>
					<p>Status: [[isActive ? 'Active' : 'Inactive']]</p>
				</div>
			`, 'test');
			factory.registerData('test', { count: 10, isActive: true });

			expect(factory.getTextContent('span')[0]).toBe('Total: 20');
			expect(factory.getTextContent('p')[0]).toBe('Status: Active');
		});

		test('should handle undefined and null values gracefully', () => {
			factory.loadTemplate(`
				<div data-domain="test">
					<span>Undefined: [[undefinedValue]]</span>
					<p>Null: [[nullValue]]</p>
				</div>
			`, 'test');
			factory.registerData('test', { nullValue: null });

			expect(factory.getTextContent('span')[0]).toBe('Undefined:');
			expect(factory.getTextContent('p')[0]).toBe('Null: null');
		});

		test('should update interpolated values reactively', () => {
			factory.loadTemplate(`
				<div data-domain="test">
					<span>Count: [[count]]</span>
				</div>
			`, 'test');
			factory.registerData('test', { count: 1 });
			expect(factory.getTextContent('span')[0]).toBe('Count: 1');

			factory.registerData('test', { count: 2 });
			expect(factory.getTextContent('span')[0]).toBe('Count: 2');
		});

		test('should handle method calls in interpolation', () => {
			factory.loadTemplate(`
				<div data-domain="test">
					<span>[[getMessage()]]</span>
					<p>[[formatNumber(123)]]</p>
				</div>
			`, 'test');

			const methods = {
				getMessage: () => 'Hello from method!',
				formatNumber: (num) => `Number: ${num}`
			};

			jaiPasVu.registerMethods('test', methods);
			factory.registerData('test', {});

			expect(factory.getTextContent('span')[0]).toBe('Hello from method!');
			expect(factory.getTextContent('p')[0]).toBe('Number: 123');
		});
	});

	describe('Event Handling', () => {
		beforeEach(() => {
			factory.loadTemplate(`
				<div>
					<button v-on:click="increment()" id="click-btn">Click</button>
					<button v-on:click="decrement()" id="shorthand-btn">Click</button>
					<input v-on:input="updateValue($event.target.value)" id="input-event">
					<input v-on:change="updateChecked($event.target.checked)" type="checkbox" id="checkbox-event">
				</div>
			`, 'test');
		});

		test('should handle click events', () => {
			const increment = jest.fn();
			const decrement = jest.fn();

			jaiPasVu.registerMethods('test', { increment, decrement });
			factory.registerData('test', { count: 0 });

			factory.query('#click-btn').click();
			expect(increment).toHaveBeenCalled();

			factory.query('#shorthand-btn').click();
			expect(decrement).toHaveBeenCalled();
		});

		test('should handle input events with parameters', () => {
			const updateValue = jest.fn();
			const updateChecked = jest.fn();

			jaiPasVu.registerMethods('test', { updateValue, updateChecked });
			factory.registerData('test', { value: '', checked: false });

			const input = factory.query('#input-event');
			input.value = 'test';
			const inputEvent = new Event('input');
			Object.defineProperty(inputEvent, 'target', { value: input });
			input.dispatchEvent(inputEvent);
			expect(updateValue).toHaveBeenCalledWith('test');

			const checkbox = factory.query('#checkbox-event');
			checkbox.checked = true;
			const changeEvent = new Event('change');
			Object.defineProperty(changeEvent, 'target', { value: checkbox });
			checkbox.dispatchEvent(changeEvent);
			expect(updateChecked).toHaveBeenCalledWith(true);
		});

		test('should handle errors in event handlers gracefully', () => {
			jaiPasVu.registerMethods('test', {
				increment: () => { throw new Error('Test error'); }
			});
			factory.registerData('test', { count: 0 });
			factory.query('#click-btn').click();
			expect(global.consoleMocks.error).toHaveBeenCalledWith(
				'[ERROR] Error in v-on handler:',
				expect.any(Error)
			);
		});

		test('should handle method invocation with multiple arguments', () => {
			factory.loadTemplate(`
				<div>
					<button v-on:click="multiArg(1, 'test', true)" id="multi-arg-btn">Click</button>
				</div>
			`, 'test');

			const multiArg = jest.fn();
			jaiPasVu.registerMethods('test', { multiArg });
			factory.registerData('test', {});

			factory.query('#multi-arg-btn').click();
			expect(multiArg).toHaveBeenCalledWith(1, 'test', true);
		});

		test('should handle shorthand method invocation without parentheses', () => {
			factory.loadTemplate(`
				<div>
					<button v-on:click="handleClick" id="shorthand-method-btn">Click</button>
				</div>
			`, 'test');

			const handleClick = jest.fn();
			jaiPasVu.registerMethods('test', { handleClick });
			factory.registerData('test', {});

			factory.query('#shorthand-method-btn').click();
			// Should be called with the event object since no args specified
			expect(handleClick).toHaveBeenCalledWith(expect.any(Event));
		});
	});
});