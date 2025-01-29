import { jest } from '@jest/globals';
import { JavaisPasVuTestFactory } from './JavaisPasVuTestFactory';
import javaisPasVu from './JavaisPasVu';

describe('JavaisPasVuTestFactory', () => {
	let factory;

	beforeEach(() => {
		factory = new JavaisPasVuTestFactory();
	});

	afterEach(() => {
		if (factory) factory.cleanup();
	});

	describe('Setup and Cleanup', () => {
		test('setup should initialize container and framework', () => {
			factory.setup();

			expect(factory.container).toBeTruthy();
			expect(factory.container.parentNode).toBe(document.body);
			expect(javaisPasVu.initialized).toBe(true);
		});

		test('cleanup should remove container and reset state', () => {
			factory.setup();
			factory.cleanup();

			expect(factory.container).toBeNull();
			expect(document.body.contains(factory.container)).toBe(false);
			expect(javaisPasVu.initialized).toBe(false);
		});
	});

	describe('Template Management', () => {
		beforeEach(() => factory.setup());

		test('registerTemplate should store cleaned template', () => {
			const template = `
                {% extends "base.html" %}
                {% block content %}
                <div>{{ message }}</div>
                {% endblock %}
            `;

			factory.registerTemplate('test', template);
			const cleaned = factory.getTemplate('test');

			expect(cleaned).toBe('<div>[[message]]</div>');
		});

		test('loadTemplate should properly render template with data', () => {
			factory.registerTemplate('test', '<div>[[message]]</div>');
			factory.registerData('test', { message: 'Hello' });

			const element = factory.loadTemplate('test', 'test', { isRegistered: true });

			expect(element.textContent).toBe('Hello');
		});

		test('should handle template loading with various options', () => {
			// Register initial template
			factory.registerTemplate('test1', '<div>Template 1</div>');

			// Test preserveContainer and appendMode options
			factory.loadTemplate('<div>First</div>', 'test1', { appendMode: true });
			factory.loadTemplate('<div>Second</div>', 'test2', { preserveContainer: true, appendMode: true });
			expect(factory.container.children.length).toBe(2);

			// Test another append
			factory.loadTemplate('<div>Third</div>', 'test3', { preserveContainer: true, appendMode: true });
			expect(factory.container.children.length).toBe(3);

			// Verify content
			expect(Array.from(factory.container.children).map(child => child.textContent))
				.toEqual(['First', 'Second', 'Third']);
		});

		test('should throw error for non-existent template', () => {
			expect(() => {
				factory.loadTemplate('nonexistent', 'test', { isRegistered: true });
			}).toThrow('Template nonexistent not found');
		});
	});

	describe('DOM Querying', () => {
		beforeEach(() => {
			factory.setup();
			factory.loadTemplate('<div id="test" class="item">Test</div>');
		});

		test('query should find elements and provide helpful errors', () => {
			expect(factory.query('#test')).toBeTruthy();
			expect(() => factory.query('#nonexistent')).toThrow(/Element not found/);
		});

		test('isVisible should correctly detect element visibility', () => {
			const element = factory.query('#test');
			expect(factory.isVisible('#test')).toBe(true);

			element.style.display = 'none';
			expect(factory.isVisible('#test')).toBe(false);
		});
	});

	describe('Data Management', () => {
		beforeEach(() => factory.setup());

		test('registerData should update reactive state', () => {
			factory.loadTemplate('<div data-domain="test">[[count]]</div>');
			factory.registerData('test', { count: 0 });

			const state = factory.getData('test');
			expect(state.count).toBe(0);

			state.count = 1;
			expect(factory.query('[data-domain="test"]').textContent).toBe('1');
		});
	});

	describe('Event Simulation', () => {
		beforeEach(() => factory.setup());

		test('dispatchHtmxEvent should trigger HTMX events', () => {
			const handler = jest.fn();
			document.addEventListener('htmx:beforeSwap', handler);

			factory.dispatchHtmxEvent('htmx:beforeSwap', { detail: 'test' });

			expect(handler).toHaveBeenCalled();
			expect(handler.mock.calls[0][0].detail).toEqual({ detail: 'test' });
		});

		test('simulateHtmxSwap should handle content swapping', () => {
			factory.loadTemplate('<div id="target">old</div>');
			const target = factory.query('#target');

			factory.simulateHtmxSwap({
				target,
				newContent: 'new',
				afterSwap: jest.fn()
			});

			expect(target.textContent).toBe('new');
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => factory.setup());

		test('getDebugInfo should provide useful debugging information', () => {
			factory.loadTemplate('<div data-domain="test">Test</div>');
			factory.registerData('test', { value: 123 });

			const debug = factory.getDebugInfo();

			expect(debug).toHaveProperty('html');
			expect(debug).toHaveProperty('registeredData');
			expect(debug).toHaveProperty('registeredPlugins');
			expect(debug).toHaveProperty('registeredHooks');
			expect(debug).toHaveProperty('activeSpies');
		});
	});

	describe('Event Listeners', () => {
		beforeEach(() => factory.setup());

		test('should clean up HTMX event listeners', () => {
			const removeEventListenerSpy = jest.spyOn(document.body, 'removeEventListener');

			factory.cleanup();

			// Should clean up all HTMX event listeners
			expect(removeEventListenerSpy).toHaveBeenCalledWith('htmx:beforeRequest', expect.any(Function));
			expect(removeEventListenerSpy).toHaveBeenCalledWith('htmx:afterRequest', expect.any(Function));
			expect(removeEventListenerSpy).toHaveBeenCalledWith('htmx:beforeSwap', expect.any(Function));
			expect(removeEventListenerSpy).toHaveBeenCalledWith('htmx:afterSwap', expect.any(Function));
			expect(removeEventListenerSpy).toHaveBeenCalledWith('htmx:responseError', expect.any(Function));

			removeEventListenerSpy.mockRestore();
		});
	});

	describe('Plugin System', () => {
		beforeEach(() => factory.setup());

		test('should register mock plugin', () => {
			const mockPlugin = {
				name: 'testPlugin',
				install: jest.fn()
			};

			factory.registerMockPlugin('testPlugin', mockPlugin);

			expect(factory._mockPlugins.has('testPlugin')).toBe(true);
			expect(mockPlugin.install).toHaveBeenCalledWith(factory.javaisPasVu, expect.any(Object));
		});

		test('should register mock hook', () => {
			const mockCallback = jest.fn();
			const unsubscribe = factory.registerMockHook('beforeCompile', mockCallback);

			// Manually emit the hook event to test the callback
			factory.javaisPasVu.emit('beforeCompile', document.createElement('div'));

			expect(mockCallback).toHaveBeenCalled();
			expect(typeof unsubscribe).toBe('function');
		});
	});

	describe('Mock Management', () => {
		beforeEach(() => factory.setup());

		test('should get mock plugin', () => {
			const mockPlugin = { name: 'testPlugin', install: jest.fn() };
			factory.registerMockPlugin('testPlugin', mockPlugin);

			const retrievedPlugin = factory.getMockPlugin('testPlugin');
			expect(retrievedPlugin).toEqual(mockPlugin);
		});

		test('should get mock hook', () => {
			const mockCallback = jest.fn();
			factory.registerMockHook('beforeCompile', mockCallback);

			const retrievedHook = factory.getMockHook('beforeCompile');

			// Verify the hook works by calling it
			retrievedHook('test');
			expect(mockCallback).toHaveBeenCalledWith('test');

			// Verify it's a mock function
			expect(typeof retrievedHook).toBe('function');
			expect(retrievedHook.mock).toBeDefined();
		});

		test('should get spy', () => {
			const spy = factory.getSpy('registerData');
			expect(spy).toBeDefined();
			expect(typeof spy.mockImplementation).toBe('function');
		});
	});

	describe('Dynamic Updates', () => {
		beforeEach(() => factory.setup());

		test('should update all dynamic elements', () => {
			// Setup dynamic elements
			factory.loadTemplate(`
				<div data-domain="test">
					<div data-dynamic>[[value]]</div>
					<div data-dynamic>[[count]]</div>
				</div>
			`, 'test');

			factory.registerData('test', { value: 'initial', count: 0 });

			// Get update spy
			const updateElementSpy = factory.getSpy('updateElement');

			// Trigger update all
			factory.updateAll();

			// Should call updateElement for each dynamic element
			expect(updateElementSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe('DOM Utilities', () => {
		beforeEach(() => {
			factory.setup();
			// Setup a complex test structure
			factory.loadTemplate(`
				<div data-domain="test">
					<div class="item" data-value="1">First Item</div>
					<div class="item" data-value="2">  Second  Item  </div>
					<div class="item">Third Item</div>
					<span class="empty"></span>
					<div class="nested">
						<span class="item" data-value="3">Nested Item</span>
					</div>
				</div>
			`, 'test');
		});

		describe('getTextContent', () => {
			test('should get trimmed text content of matching elements', () => {
				const texts = factory.getTextContent('.item');
				expect(texts).toEqual([
					'First Item',
					'Second Item',
					'Third Item',
					'Nested Item'
				]);
			});

			test('should handle empty elements', () => {
				const texts = factory.getTextContent('.empty');
				expect(texts).toEqual(['']);
			});

			test('should return empty array for non-matching selector', () => {
				const texts = factory.getTextContent('.non-existent');
				expect(texts).toEqual([]);
			});
		});

		describe('getAttributes', () => {
			test('should get attribute values from matching elements', () => {
				const values = factory.getAttributes('.item', 'data-value');
				expect(values).toEqual(['1', '2', '3']);
			});

			test('should filter out elements without the attribute', () => {
				const values = factory.getAttributes('.item', 'non-existent');
				expect(values).toEqual([]);
			});

			test('should handle elements without the specified attribute', () => {
				const classes = factory.getAttributes('div', 'class');
				expect(classes).toEqual(['item', 'item', 'item', 'nested']);
			});
		});

		describe('exists', () => {
			test('should return true for existing elements', () => {
				expect(factory.exists('.item')).toBe(true);
				expect(factory.exists('.nested')).toBe(true);
			});

			test('should return false for non-existing elements', () => {
				expect(factory.exists('.non-existent')).toBe(false);
			});

			test('should handle multiple matching elements', () => {
				expect(factory.exists('div')).toBe(true);
			});

			test('should handle nested elements', () => {
				expect(factory.exists('.nested .item')).toBe(true);
			});
		});
	});
}); 