import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { JavaisPasVuTestFactory } from './JavaisPasVuTestFactory.js';
import javaisPasVu from './JavaisPasVu.js';

describe('JavaisPasVu', () => {
	let factory;

	beforeEach(() => {
		factory = new JavaisPasVuTestFactory();
		factory.setup();
	});

	afterEach(() => {
		factory.cleanup();
	});

	// Core Framework Setup
	describe('Core Framework Setup', () => {
		test('should initialize framework correctly', () => {
			expect(factory.javaisPasVu.initialized).toBe(true);
			expect(factory.javaisPasVu.root).toBeDefined();
			expect(factory.javaisPasVu.domains).toBeDefined();
			expect(factory.javaisPasVu.updateQueue).toBeDefined();
		});

		test('should prevent multiple initializations', () => {
			const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
			factory.javaisPasVu.initialize(document.body);
			expect(spy).toHaveBeenCalledWith('[WARN] JavaisPasVu is already initialized');
			spy.mockRestore();
		});

		test('should setup core hooks', () => {
			const hooks = factory.javaisPasVu.hooks;
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
			const newFactory = new JavaisPasVuTestFactory();

			// Reset the singleton instance state
			javaisPasVu.initialized = false;
			javaisPasVu.root = null;

			// Register hooks
			javaisPasVu.on('beforeMount', beforeMount);
			javaisPasVu.on('mounted', mounted);

			// Initialize
			newFactory.container = document.createElement('div');
			document.body.appendChild(newFactory.container);
			javaisPasVu.initialize(newFactory.container);

			expect(beforeMount).toHaveBeenCalled();
			expect(mounted).toHaveBeenCalled();

			// Cleanup
			newFactory.cleanup();
		});
	});

	// Plugin System
	describe('Plugin System', () => {
		test('should register and initialize plugins', () => {
			const mockPlugin = {
				name: 'test-plugin',
				install: jest.fn()
			};

			factory.registerMockPlugin('test-plugin', mockPlugin);
			expect(mockPlugin.install).toHaveBeenCalledWith(factory.javaisPasVu, {});
		});

		test('should prevent duplicate plugin registration', () => {
			const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
			const mockPlugin = {
				name: 'test-plugin',
				install: jest.fn()
			};

			factory.registerMockPlugin('test-plugin', mockPlugin);
			factory.javaisPasVu.use(mockPlugin);

			expect(spy).toHaveBeenCalledWith('[WARN] Plugin test-plugin is already installed');
			spy.mockRestore();
		});

		test('should handle plugin installation errors gracefully', () => {
			const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
			const mockPlugin = {
				name: 'error-plugin',
				install: () => { throw new Error('Installation failed'); }
			};

			factory.javaisPasVu.use(mockPlugin);
			expect(spy).toHaveBeenCalledWith(
				'[ERROR] Failed to install plugin error-plugin:',
				expect.any(Error)
			);
			spy.mockRestore();
		});

		test('should handle plugin hooks in correct order', () => {
			const sequence = [];
			const beforeCompileCallback = () => sequence.push('beforeCompile');
			const afterCompileCallback = () => sequence.push('afterCompile');

			factory.javaisPasVu.on('beforeCompile', beforeCompileCallback);
			factory.javaisPasVu.on('afterCompile', afterCompileCallback);

			// First load template
			factory.loadTemplate('<div v-if="show">Test</div>', 'test');
			// Then register data to trigger compilation
			factory.registerData('test', { show: true });

			// Expect two compilation cycles:
			// 1. When template is loaded
			// 2. When data is registered
			expect(sequence).toEqual([
				'beforeCompile', 'afterCompile',  // Template load compilation
				'beforeCompile', 'afterCompile'   // Data registration compilation
			]);
		});

		test('should allow hook unsubscription', () => {
			const callback = jest.fn();
			const unsubscribe = factory.javaisPasVu.on('beforeCompile', callback);

			unsubscribe();
			factory.loadTemplate('<div>Test</div>', 'test');

			expect(callback).not.toHaveBeenCalled();
		});
	});

	// Core Data Binding & State Management
	describe('Core Data Binding', () => {
		test('should register data without errors', () => {
			factory.loadTemplate('<div>Test</div>');
			expect(() => {
				factory.registerData('test', { value: 'test' });
			}).not.toThrow();
		});

		test('should store and retrieve data correctly', () => {
			const testData = { value: 'test', nested: { prop: 'nested' } };
			factory.registerData('test', testData);
			expect(factory.getData('test')).toEqual(testData);
		});

		test('should handle nested property access safely', () => {
			factory.registerData('test', { user: { name: 'test' } });
			factory.loadTemplate(`
				<div v-if="user.name === 'test'">User Test</div>
				<div v-if="Object.hasOwn(this, 'user')">Has User</div>
			`, 'test');

			expect(factory.isVisible("div[v-if=\"user.name === 'test'\"]")).toBe(true);
			expect(factory.isVisible("div[v-if=\"Object.hasOwn(this, 'user')\"]")).toBe(true);
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

		describe('v-for Directive', () => {
			beforeEach(() => {
				factory.loadTemplate(`
					<div>
						<ul>
							<li v-for="item in items">{{item}}</li>
						</ul>
						<div>
							<div v-for="(item, index) in items" class="indexed-item">
								{{index}}: {{item}}
							</div>
						</div>
					</div>
				`, 'test');
			});

			test('should render list items correctly', () => {
				factory.registerData('test', { items: ['apple', 'banana', 'orange'] });
				const listItems = factory.getTextContent('li');
				expect(listItems).toEqual(['apple', 'banana', 'orange']);
			});

			test('should handle index in v-for', () => {
				factory.registerData('test', { items: ['apple', 'banana', 'orange'] });
				const indexedItems = factory.getTextContent('.indexed-item');
				expect(indexedItems).toEqual(['0: apple', '1: banana', '2: orange']);
			});

			test('should update list items incrementally', () => {
				factory.registerData('test', { items: ['apple'] });
				expect(factory.getTextContent('li')).toEqual(['apple']);

				factory.registerData('test', { items: ['apple', 'banana'] });
				expect(factory.getTextContent('li')).toEqual(['apple', 'banana']);
			});
		});

		describe('v-model Directive', () => {
			beforeEach(() => {
				factory.loadTemplate(`
					<div>
						<input type="text" v-model="text" id="text-input">
						<input type="checkbox" v-model="checked" id="checkbox-input">
						<select v-model="selected" id="select-input">
							<option value="a">A</option>
							<option value="b">B</option>
						</select>
					</div>
				`, 'test');
			});

			test('should bind text input value', () => {
				factory.registerData('test', { text: 'initial' });
				const input = factory.query('#text-input');
				expect(input.value).toBe('initial');

				input.value = 'changed';
				input.dispatchEvent(new Event('input'));
				expect(factory.getData('test').text).toBe('changed');
			});

			test('should bind checkbox state', () => {
				factory.registerData('test', { checked: true });
				const checkbox = factory.query('#checkbox-input');
				expect(checkbox.checked).toBe(true);

				checkbox.checked = false;
				checkbox.dispatchEvent(new Event('change'));
				expect(factory.getData('test').checked).toBe(false);
			});
		});
	});

	// // Computed Properties
	// describe('Computed Properties', () => {
	// 	beforeEach(() => {
	// 		factory.loadTemplate(`
	// 			<div id="full-name" v-text="fullName"></div>
	// 			<div id="item-count" v-text="itemCount"></div>
	// 		`, 'test');
	// 	});

	// 	test('should compute derived values', () => {
	// 		const computedProps = {
	// 			fullName: function () { return `${this.firstName} ${this.lastName}`; },
	// 			itemCount: function () { return this.items.length; }
	// 		};

	// 		factory.registerData('test', {
	// 			firstName: 'John',
	// 			lastName: 'Doe',
	// 			items: ['a', 'b', 'c']
	// 		}, computedProps);

	// 		expect(factory.query('#full-name').textContent).toBe('John Doe');
	// 		expect(factory.query('#item-count').textContent).toBe('3');
	// 	});

	// 	test('should update when dependencies change', () => {
	// 		const computedProps = {
	// 			fullName: function () { return `${this.firstName} ${this.lastName}`; }
	// 		};

	// 		factory.registerData('test', {
	// 			firstName: 'John',
	// 			lastName: 'Doe'
	// 		}, computedProps);

	// 		expect(factory.query('#full-name').textContent).toBe('John Doe');

	// 		factory.registerData('test', {
	// 			firstName: 'Jane',
	// 			lastName: 'Doe'
	// 		}, computedProps);

	// 		expect(factory.query('#full-name').textContent).toBe('Jane Doe');
	// 	});
	// });

	// // Event Handling
	// describe('Event Handling', () => {
	// 	beforeEach(() => {
	// 		factory.loadTemplate(`
	// 			<div>
	// 				<button v-on:click="increment()" id="click-btn">Click</button>
	// 				<button v-on:click="decrement()" id="shorthand-btn">Click</button>
	// 				<input v-on:input="updateValue($event.target.value)" id="input-event">
	// 				<input v-on:change="updateChecked($event.target.checked)" type="checkbox" id="checkbox-event">
	// 			</div>
	// 		`, 'test');
	// 	});

	// 	test('should handle click events', () => {
	// 		const increment = jest.fn();
	// 		const decrement = jest.fn();

	// 		factory.javaisPasVu.registerMethods('test', { increment, decrement });
	// 		factory.registerData('test', { count: 0 });

	// 		factory.query('#click-btn').click();
	// 		expect(increment).toHaveBeenCalled();

	// 		factory.query('#shorthand-btn').click();
	// 		expect(decrement).toHaveBeenCalled();
	// 	});

	// 	test('should handle input events with parameters', () => {
	// 		const updateValue = jest.fn();
	// 		const updateChecked = jest.fn();

	// 		factory.javaisPasVu.registerMethods('test', { updateValue, updateChecked });
	// 		factory.registerData('test', { value: '', checked: false });

	// 		const input = factory.query('#input-event');
	// 		input.value = 'test';
	// 		input.dispatchEvent(new Event('input'));
	// 		expect(updateValue).toHaveBeenCalledWith('test');

	// 		const checkbox = factory.query('#checkbox-event');
	// 		checkbox.checked = true;
	// 		checkbox.dispatchEvent(new Event('change'));
	// 		expect(updateChecked).toHaveBeenCalledWith(true);
	// 	});
	// });

	// // Domain State Management
	// describe('Domain State Management', () => {
	// 	beforeEach(() => {
	// 		factory.loadTemplate(`
	// 			<div>
	// 				<div id="room-state"></div>
	// 				<div id="room-settings"></div>
	// 			</div>
	// 		`, 'room');
	// 	});

	// 	test('should handle room state updates', () => {
	// 		const roomState = { id: '123', name: 'Test Room' };
	// 		const roomSettings = { maxPlayers: 4, isPrivate: true };

	// 		factory.registerData('room', {
	// 			currentRoom: {
	// 				roomId: '123',
	// 				state: roomState,
	// 				settings: roomSettings
	// 			}
	// 		});

	// 		const state = factory.getData('room');
	// 		expect(state.currentRoom).toBeDefined();
	// 		expect(state.currentRoom.roomId).toBe('123');
	// 		expect(state.currentRoom.state).toEqual(roomState);
	// 		expect(state.currentRoom.settings).toEqual(roomSettings);
	// 	});
	// });

	// // HTMX Integration
	// describe('HTMX Integration', () => {
	// 	beforeEach(() => {
	// 		factory.loadTemplate(`
	// 			<div id="htmx-content" hx-get="/api/data">
	// 				<span v-text="message"></span>
	// 			</div>
	// 		`, 'test');
	// 	});

	// 	test('should handle HTMX events', () => {
	// 		const htmxEventHandler = factory.registerMockHook('htmx:afterSettle', () => { });

	// 		factory.dispatchHtmxEvent('htmx:afterSettle', {
	// 			elt: factory.query('#htmx-content')
	// 		});

	// 		expect(htmxEventHandler).toHaveBeenCalled();
	// 	});

	// 	test('should preserve state during HTMX swaps', () => {
	// 		factory.registerData('test', { message: 'Initial' });
	// 		expect(factory.query('span').textContent).toBe('Initial');

	// 		factory.simulateHtmxSwap({
	// 			target: factory.query('#htmx-content'),
	// 			newContent: '<span v-text="message">Updated</span>'
	// 		});

	// 		expect(factory.query('span').textContent).toBe('Initial');
	// 	});

	// 	test('should handle state updates from HTMX responses', () => {
	// 		factory.registerData('test', { message: 'Initial' });

	// 		const response = document.createElement('div');
	// 		response.setAttribute('data-state-path', 'test.message');
	// 		response.setAttribute('data-state-value', JSON.stringify('Updated via HTMX'));

	// 		factory.dispatchHtmxEvent('htmx:afterSettle', {
	// 			elt: response,
	// 			target: factory.query('#htmx-content')
	// 		});

	// 		expect(factory.getData('test').message).toBe('Updated via HTMX');
	// 	});

	// 	test('should handle HTMX error responses', () => {
	// 		const errorHandler = factory.registerMockHook('htmx:error', () => { });

	// 		factory.dispatchHtmxEvent('htmx:responseError', {
	// 			error: 'Test error',
	// 			xhr: { status: 500 }
	// 		});

	// 		expect(errorHandler).toHaveBeenCalled();
	// 	});

	// 	test('should cleanup elements before HTMX swaps', () => {
	// 		const cleanupSpy = factory.getSpy('cleanup');

	// 		factory.dispatchHtmxEvent('htmx:beforeSwap', {
	// 			target: factory.query('#htmx-content')
	// 		});

	// 		expect(cleanupSpy).toHaveBeenCalled();
	// 	});
	// });
}); 
