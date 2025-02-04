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
			expect(global.consoleMocks.warn).toHaveBeenCalledWith('[WARN] [JaiPasVu] JaiPasVu is already initialized');
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

	describe('Nested Data Domains', () => {
		test('should handle nested data domains independently', () => {
			factory.loadTemplate(`
				<div data-domain="parent">
					<div v-text="parentValue"></div>
					<div data-domain="child">
						<div v-text="childValue"></div>
						<div v-text="parentValue"></div>
					</div>
				</div>
			`, 'parent');

			factory.registerData('parent', { parentValue: 'parent data' });
			factory.registerData('child', { childValue: 'child data' });

			const elements = factory.container.querySelectorAll('div[v-text]');
			expect(elements[0].textContent).toBe('parent data');
			expect(elements[1].textContent).toBe('child data');
			expect(elements[2].textContent).toBe('parent data'); // Child can access parent data
		});

		test('should handle updates in nested domains correctly', () => {
			factory.loadTemplate(`
				<div data-domain="parent">
					<div id="parent-value" v-text="value"></div>
					<div data-domain="child">
						<div id="child-value" v-text="value"></div>
					</div>
				</div>
			`, 'parent');

			factory.registerData('parent', { value: 'initial parent' });
			factory.registerData('child', { value: 'initial child' });

			expect(factory.query('#parent-value').textContent).toBe('initial parent');
			expect(factory.query('#child-value').textContent).toBe('initial child');

			// Update parent data
			factory.registerData('parent', { value: 'updated parent' });
			expect(factory.query('#parent-value').textContent).toBe('updated parent');
			expect(factory.query('#child-value').textContent).toBe('initial child');

			// Update child data
			factory.registerData('child', { value: 'updated child' });
			expect(factory.query('#parent-value').textContent).toBe('updated parent');
			expect(factory.query('#child-value').textContent).toBe('updated child');
		});

		test('should handle events in nested domains', () => {
			const parentClick = jest.fn();
			const childClick = jest.fn();

			factory.loadTemplate(`
				<div data-domain="parent">
					<button id="parent-btn" v-on:click="parentClick()">Parent</button>
					<div data-domain="child">
						<button id="child-btn" v-on:click="childClick()">Child</button>
					</div>
				</div>
			`, 'parent');

			factory.registerData('parent', {});
			jaiPasVu.registerMethods('parent', { parentClick });
			factory.registerData('child', {});
			jaiPasVu.registerMethods('child', { childClick });

			factory.query('#parent-btn').click();
			factory.query('#child-btn').click();

			expect(parentClick).toHaveBeenCalledTimes(1);
			expect(childClick).toHaveBeenCalledTimes(1);
		});

		test('should handle computed properties in nested domains', () => {
			factory.loadTemplate(`
				<div data-domain="parent">
					<div id="parent-computed" v-text="doubleParentValue"></div>
					<div data-domain="child">
						<div id="child-computed" v-text="doubleChildValue"></div>
						<div id="child-parent-computed" v-text="doubleParentValue"></div>
					</div>
				</div>
			`, 'parent');

			const parentComputed = {
				doubleParentValue: function () { return this.value * 2; }
			};

			const childComputed = {
				doubleChildValue: function () { return this.value * 2; }
			};

			factory.registerData('parent', { value: 5, ...parentComputed });
			factory.registerData('child', { value: 3, ...childComputed });

			expect(factory.query('#parent-computed').textContent).toBe('10');
			expect(factory.query('#child-computed').textContent).toBe('6');
			expect(factory.query('#child-parent-computed').textContent).toBe('10');
		});

		test('should handle v-if directives in nested domains', () => {
			factory.loadTemplate(`
				<div data-domain="parent">
					<div id="parent-conditional" v-if="parentShow">Parent Content</div>
					<div data-domain="child">
						<div id="child-conditional" v-if="childShow">Child Content</div>
						<div id="child-parent-conditional" v-if="parentShow">Parent Condition</div>
					</div>
				</div>
			`, 'parent');

			factory.registerData('parent', { parentShow: true });
			factory.registerData('child', { childShow: true });

			expect(factory.isVisible('#parent-conditional')).toBe(true);
			expect(factory.isVisible('#child-conditional')).toBe(true);
			expect(factory.isVisible('#child-parent-conditional')).toBe(true);

			factory.registerData('parent', { parentShow: false });
			expect(factory.isVisible('#parent-conditional')).toBe(false);
			expect(factory.isVisible('#child-conditional')).toBe(true);
			expect(factory.isVisible('#child-parent-conditional')).toBe(false);
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

			expect(global.consoleMocks.warn).toHaveBeenCalledWith('[WARN] [JaiPasVu] Plugin test-plugin is already installed');
		});

		test('should handle plugin installation errors gracefully', () => {
			const mockPlugin = {
				name: 'error-plugin',
				install: () => { throw new Error('Installation failed'); }
			};

			factory.jaiPasVu.use(mockPlugin);
			expect(global.consoleMocks.error).toHaveBeenCalledWith(
				'[ERROR] [JaiPasVu] Failed to install plugin error-plugin:',
				expect.any(Error)
			);
		});

		// Add new tests for custom plugin hooks
		describe('Custom Plugin Events', () => {
			test('should handle custom plugin events', () => {
				const customEventCallback = jest.fn();
				const customEvent = { detail: { data: 'test' } };

				factory.jaiPasVu.on('plugin:customEvent', customEventCallback);
				factory.jaiPasVu.emit('plugin:customEvent', customEvent);

				expect(customEventCallback).toHaveBeenCalledWith(customEvent);
			});

			test('should handle multiple custom event listeners', () => {
				const callback1 = jest.fn();
				const callback2 = jest.fn();
				const eventData = { value: 'test' };

				factory.jaiPasVu.on('plugin:event', callback1);
				factory.jaiPasVu.on('plugin:event', callback2);
				factory.jaiPasVu.emit('plugin:event', eventData);

				expect(callback1).toHaveBeenCalledWith(eventData);
				expect(callback2).toHaveBeenCalledWith(eventData);
			});

			test('should properly remove custom event listeners', () => {
				const callback = jest.fn();
				const eventData = { value: 'test' };

				const unsubscribe = factory.jaiPasVu.on('plugin:event', callback);
				factory.jaiPasVu.emit('plugin:event', eventData);
				expect(callback).toHaveBeenCalledTimes(1);

				unsubscribe();
				factory.jaiPasVu.emit('plugin:event', eventData);
				expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
			});

			test('should handle errors in custom event handlers gracefully', () => {
				const errorCallback = () => { throw new Error('Custom event error'); };
				factory.jaiPasVu.on('plugin:errorEvent', errorCallback);

				factory.jaiPasVu.emit('plugin:errorEvent', {});

				expect(global.consoleMocks.error).toHaveBeenCalledWith(
					'[ERROR] [JaiPasVu] Error in plugin:errorEvent event handler:',
					expect.any(Error)
				);
			});

			test('should handle plugin lifecycle and custom events together', () => {
				const lifecycleCallback = jest.fn();
				const customCallback = jest.fn();
				const eventData = { value: 'test' };

				// Register both lifecycle and custom event handlers
				factory.jaiPasVu.on('beforeMount', lifecycleCallback);
				factory.jaiPasVu.on('plugin:custom', customCallback);

				// Trigger both types of events
				factory.jaiPasVu.emit('beforeMount');
				factory.jaiPasVu.emit('plugin:custom', eventData);

				expect(lifecycleCallback).toHaveBeenCalled();
				expect(customCallback).toHaveBeenCalledWith(eventData);
			});

			test('should maintain separate event handler sets for lifecycle and custom events', () => {
				const customCallback = jest.fn();

				// Try to register custom callback for lifecycle event
				factory.jaiPasVu.on('beforeMount', customCallback);
				factory.jaiPasVu.emit('beforeMount');

				// Should be in lifecycle hooks
				expect(factory.jaiPasVu.hooks.beforeMount.has(customCallback)).toBe(true);
				expect(factory.jaiPasVu.customEvents.has('beforeMount')).toBe(false);

				// Try custom event
				const customEventCallback = jest.fn();
				factory.jaiPasVu.on('plugin:custom', customEventCallback);
				factory.jaiPasVu.emit('plugin:custom');

				// Should be in custom events
				expect(factory.jaiPasVu.customEvents.has('plugin:custom')).toBe(true);
				expect(factory.jaiPasVu.hooks['plugin:custom']).toBeUndefined();
			});

			test('should clean up empty custom event sets', () => {
				const callback = jest.fn();
				const eventName = 'plugin:cleanup';

				// Add and then remove the only listener
				const unsubscribe = factory.jaiPasVu.on(eventName, callback);
				expect(factory.jaiPasVu.customEvents.has(eventName)).toBe(true);

				unsubscribe();
				expect(factory.jaiPasVu.customEvents.has(eventName)).toBe(false);
			});
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

			test('should handle v-if, v-else-if, and v-else chain correctly', () => {
				factory.loadTemplate(`
					<div data-domain="test">
						<div id="if-block" v-if="status === 'active'">Active</div>
						<div id="else-if-block1" v-else-if="status === 'pending'">Pending</div>
						<div id="else-if-block2" v-else-if="status === 'archived'">Archived</div>
						<div id="else-block" v-else>Inactive</div>
					</div>
				`, 'test');

				// Test active status
				factory.registerData('test', { status: 'active' });
				expect(factory.isVisible('#if-block')).toBe(true);
				expect(factory.isVisible('#else-if-block1')).toBe(false);
				expect(factory.isVisible('#else-if-block2')).toBe(false);
				expect(factory.isVisible('#else-block')).toBe(false);

				// Test pending status
				factory.registerData('test', { status: 'pending' });
				expect(factory.isVisible('#if-block')).toBe(false);
				expect(factory.isVisible('#else-if-block1')).toBe(true);
				expect(factory.isVisible('#else-if-block2')).toBe(false);
				expect(factory.isVisible('#else-block')).toBe(false);

				// Test archived status
				factory.registerData('test', { status: 'archived' });
				expect(factory.isVisible('#if-block')).toBe(false);
				expect(factory.isVisible('#else-if-block1')).toBe(false);
				expect(factory.isVisible('#else-if-block2')).toBe(true);
				expect(factory.isVisible('#else-block')).toBe(false);

				// Test unknown status (should trigger else)
				factory.registerData('test', { status: 'unknown' });
				expect(factory.isVisible('#if-block')).toBe(false);
				expect(factory.isVisible('#else-if-block1')).toBe(false);
				expect(factory.isVisible('#else-if-block2')).toBe(false);
				expect(factory.isVisible('#else-block')).toBe(true);
			});

			test('should handle nested v-if conditions', () => {
				factory.loadTemplate(`
					<div data-domain="test">
						<div id="outer" v-if="outer">
							Outer
							<div id="inner1" v-if="inner === 1">Inner 1</div>
							<div id="inner2" v-if="inner === 2">Inner 2</div>
						</div>
					</div>
				`, 'test');

				// Test when outer is false
				factory.registerData('test', { outer: false, inner: 1 });
				expect(factory.isVisible('#outer')).toBe(false);
				expect(factory.exists('#inner1')).toBe(true); // Element exists but not visible
				expect(factory.exists('#inner2')).toBe(true);
				expect(factory.isVisible('#inner1')).toBe(false);
				expect(factory.isVisible('#inner2')).toBe(false);

				// Test when outer is true, inner is 1
				factory.registerData('test', { outer: true, inner: 1 });
				expect(factory.isVisible('#outer')).toBe(true);
				expect(factory.isVisible('#inner1')).toBe(true);
				expect(factory.isVisible('#inner2')).toBe(false);

				// Test when outer is true, inner is 2
				factory.registerData('test', { outer: true, inner: 2 });
				expect(factory.isVisible('#outer')).toBe(true);
				expect(factory.isVisible('#inner1')).toBe(false);
				expect(factory.isVisible('#inner2')).toBe(true);
			});

			test('should handle complex boolean expressions in v-if', () => {
				factory.loadTemplate(`
					<div data-domain="test">
						<div id="and-condition" v-if="age >= 18 && hasPermission">Adult with permission</div>
						<div id="or-condition" v-if="isAdmin || isModerator">Has access</div>
						<div id="complex-condition" v-if="(isAdmin && !isLocked) || (isModerator && isApproved)">Complex rule</div>
					</div>
				`, 'test');

				// Test AND condition
				factory.registerData('test', { age: 20, hasPermission: true });
				expect(factory.isVisible('#and-condition')).toBe(true);
				factory.registerData('test', { age: 17, hasPermission: true });
				expect(factory.isVisible('#and-condition')).toBe(false);
				factory.registerData('test', { age: 20, hasPermission: false });
				expect(factory.isVisible('#and-condition')).toBe(false);

				// Test OR condition
				factory.registerData('test', { isAdmin: true, isModerator: false });
				expect(factory.isVisible('#or-condition')).toBe(true);
				factory.registerData('test', { isAdmin: false, isModerator: true });
				expect(factory.isVisible('#or-condition')).toBe(true);
				factory.registerData('test', { isAdmin: false, isModerator: false });
				expect(factory.isVisible('#or-condition')).toBe(false);

				// Test complex condition
				factory.registerData('test', {
					isAdmin: true, isLocked: false,
					isModerator: false, isApproved: true
				});
				expect(factory.isVisible('#complex-condition')).toBe(true);

				factory.registerData('test', {
					isAdmin: true, isLocked: true,
					isModerator: true, isApproved: true
				});
				expect(factory.isVisible('#complex-condition')).toBe(true);

				factory.registerData('test', {
					isAdmin: true, isLocked: true,
					isModerator: true, isApproved: false
				});
				expect(factory.isVisible('#complex-condition')).toBe(false);
			});

			test('should handle v-if with computed properties', () => {
				factory.loadTemplate(`
					<div data-domain="test">
						<div id="computed-if" v-if="isEligible">Eligible</div>
					</div>
				`, 'test');

				const computedProps = {
					isEligible: function () {
						return this.score >= this.threshold && !this.isBlocked;
					}
				};

				// Test eligible case
				factory.registerData('test', {
					score: 75,
					threshold: 70,
					isBlocked: false,
					...computedProps
				});
				expect(factory.isVisible('#computed-if')).toBe(true);

				// Test not eligible due to low score
				factory.registerData('test', {
					score: 65,
					threshold: 70,
					isBlocked: false,
					...computedProps
				});
				expect(factory.isVisible('#computed-if')).toBe(false);

				// Test not eligible due to being blocked
				factory.registerData('test', {
					score: 75,
					threshold: 70,
					isBlocked: true,
					...computedProps
				});
				expect(factory.isVisible('#computed-if')).toBe(false);
			});
		});

		describe('v-for Directive', () => {
			test('should render basic v-for list correctly', () => {
				factory.loadTemplate(`
					<div data-domain="test">
						<div v-for="item in items" class="list-item">[[item]]</div>
					</div>
				`, 'test');

				factory.registerData('test', { items: [] });
				expect(factory.queryAll('.list-item').length).toBe(0);

				factory.registerData('test', { items: ['one'] });
				expect(factory.queryAll('.list-item').length).toBe(1);
				expect(factory.getTextContent('.list-item')).toEqual(['one']);

				factory.registerData('test', { items: ['one', 'two', 'three'] });
				expect(factory.queryAll('.list-item').length).toBe(3);
				expect(factory.getTextContent('.list-item')).toEqual(['one', 'two', 'three']);
			});

			beforeEach(() => {
				factory.loadTemplate(`
					<div>
						<ul>
							<li v-for="item in items">[[item]]</li>
						</ul>
						<div>
							<div v-for="(item, index) in items" class="indexed-item">
								[[index]]: [[item]]
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

		describe('v-bind Directive', () => {
			test('should bind boolean attributes correctly', () => {
				factory.loadTemplate(`
					<div data-domain="test">
						<button v-bind:disabled="isDisabled" id="disabled-btn">Button</button>
						<input v-bind:readonly="isReadonly" id="readonly-input" />
						<input v-bind:required="isRequired" id="required-input" />
					</div>
				`, 'test');
				factory.registerData('test', {
					isDisabled: true,
					isReadonly: false,
					isRequired: true
				});
				const button = factory.query('#disabled-btn');
				const readonlyInput = factory.query('#readonly-input');
				const requiredInput = factory.query('#required-input');
				expect(button.disabled).toBe(true);
				expect(readonlyInput.readOnly).toBe(false); // camelCase property name
				expect(requiredInput.required).toBe(true);
				factory.registerData('test', {
					isDisabled: false,
					isReadonly: true,
					isRequired: false
				});
				expect(button.disabled).toBe(false);
				expect(readonlyInput.readOnly).toBe(true); // camelCase property name
				expect(requiredInput.required).toBe(false);
				expect(button.getAttribute('disabled')).toBe(null);
				expect(readonlyInput.getAttribute('readonly')).toBe('');
				expect(requiredInput.getAttribute('required')).toBe(null);
			});

			test('should handle shorthand v-bind syntax', () => {
				factory.loadTemplate(`
					<div data-domain="test">
						<button :disabled="isDisabled" id="shorthand-btn">Button</button>
					</div>
				`, 'test');
				factory.registerData('test', { isDisabled: true });
				expect(factory.query('#shorthand-btn').disabled).toBe(true);
				factory.registerData('test', { isDisabled: false });
				expect(factory.query('#shorthand-btn').disabled).toBe(false);
			});

			test('should handle expressions in v-bind', () => {
				factory.loadTemplate(`
					<div data-domain="test">
						<button v-bind:disabled="count > 5" id="expr-btn">Button</button>
					</div>
				`, 'test');
				factory.registerData('test', { count: 3 });
				expect(factory.query('#expr-btn').disabled).toBe(false);
				factory.registerData('test', { count: 7 });
				expect(factory.query('#expr-btn').disabled).toBe(true);
			});

			test('should handle multiple bound attributes', () => {
				factory.loadTemplate(`
					<div data-domain="test">
						<button 
							v-bind:disabled="isDisabled"
							v-bind:class="buttonClass"
							v-bind:aria-label="ariaLabel"
							id="multi-bound-btn">
							Button
						</button>
					</div>
				`, 'test');
				factory.registerData('test', {
					isDisabled: true,
					buttonClass: 'primary',
					ariaLabel: 'Test Button'
				});
				const button = factory.query('#multi-bound-btn');
				expect(button.disabled).toBe(true);
				expect(button.getAttribute('class')).toBe('primary');
				expect(button.getAttribute('aria-label')).toBe('Test Button');
				factory.registerData('test', {
					isDisabled: false,
					buttonClass: 'secondary',
					ariaLabel: 'Updated Button'
				});
				expect(button.disabled).toBe(false);
				expect(button.getAttribute('class')).toBe('secondary');
				expect(button.getAttribute('aria-label')).toBe('Updated Button');
			});

			test('should handle style binding with computed values', () => {
				factory.loadTemplate(`
					<div data-domain="test">
						<div class="progress">
							<div id="progress-bar" class="progress-bar" role="progressbar"
								v-text="settings.value + '/10'"
								v-bind:style="getProgressBarStyle(settings.value)">
							</div>
						</div>
					</div>
				`, 'test');

				const getProgressBarStyle = function (value) {
					return {
						width: `${(value / 10) * 100}%`,
						backgroundColor: value > 7 ? '#28a745' : '#007bff'
					};
				};

				// Register methods first
				jaiPasVu.registerMethods('test', { getProgressBarStyle });

				// Then register data to ensure methods are available during data registration
				factory.registerData('test', {
					settings: { value: 8 }
				});

				const progressBar = factory.query('#progress-bar');

				// Check initial state
				expect(progressBar.style.width).toBe('80%');
				expect(progressBar.style.backgroundColor).toBe('rgb(40, 167, 69)'); // #28a745
				expect(progressBar.textContent).toBe('8/10');

				// Update value and check style changes
				factory.registerData('test', {
					settings: { value: 5 }
				});

				expect(progressBar.style.width).toBe('50%');
				expect(progressBar.style.backgroundColor).toBe('rgb(0, 123, 255)'); // #007bff
				expect(progressBar.textContent).toBe('5/10');
			});
		});

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

	describe('Button Functionality', () => {
		beforeEach(() => {
			factory.loadTemplate(`
				<div data-domain="test">
					<button id="startGameBtn" type="button" class="btn btn-primary" aria-label="Start the game"
						v-bind:disabled="startGameInProgress" v-text="buttonText">
						Start
					</button>
				</div>
			`, 'test');
		});

		test('should update button text reactively', () => {
			factory.registerData('test', { buttonText: 'Start Game', startGameInProgress: false });
			const button = factory.query('#startGameBtn');
			expect(button.textContent).toBe('Start Game');
			factory.registerData('test', { buttonText: 'Starting...', startGameInProgress: true });
			expect(button.textContent).toBe('Starting...');
		});

		test('should bind disabled state correctly', () => {
			factory.registerData('test', { buttonText: 'Start', startGameInProgress: false });
			const button = factory.query('#startGameBtn');
			expect(button.disabled).toBe(false);
			factory.registerData('test', { buttonText: 'Start', startGameInProgress: true });
			expect(button.disabled).toBe(true);
		});

		test('should handle multiple reactive updates', () => {
			factory.registerData('test', { buttonText: 'Start', startGameInProgress: false });
			const button = factory.query('#startGameBtn');
			expect(button.textContent).toBe('Start');
			expect(button.disabled).toBe(false);
			factory.registerData('test', { buttonText: 'Starting...', startGameInProgress: true });
			expect(button.textContent).toBe('Starting...');
			expect(button.disabled).toBe(true);
			factory.registerData('test', { buttonText: 'Start', startGameInProgress: false });
			expect(button.textContent).toBe('Start');
			expect(button.disabled).toBe(false);
		});

		test('should preserve other attributes while updating bound ones', () => {
			factory.registerData('test', { buttonText: 'Start', startGameInProgress: false });
			const button = factory.query('#startGameBtn');
			expect(button.getAttribute('type')).toBe('button');
			expect(button.getAttribute('class')).toBe('btn btn-primary');
			expect(button.getAttribute('aria-label')).toBe('Start the game');
			// Update bound attributes
			factory.registerData('test', { buttonText: 'Starting...', startGameInProgress: true });
			expect(button.getAttribute('type')).toBe('button');
			expect(button.getAttribute('class')).toBe('btn btn-primary');
			expect(button.getAttribute('aria-label')).toBe('Start the game');
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
				'[ERROR] [JaiPasVu] Computed property invalidComputed must be a function'
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
				expect.stringContaining('[ERROR] [JaiPasVu] Error in computed property errorProne:'),
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
				'[ERROR] [JaiPasVu] Error in v-on handler:',
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

		test('should handle method invocation with multiple arguments', () => {
			factory.loadTemplate(`
				<div>
					<ul>
						<li v-on:click="multiArg(1, 'test', true)" id="multi-arg-btn">Click</li>
					</ul>
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