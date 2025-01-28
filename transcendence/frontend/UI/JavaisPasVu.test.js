import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { JavaisPasVuTestFactory } from './JavaisPasVuTestFactory.js';
import JavaisPasVu from './JavaisPasVu.js';

describe('JavaisPasVu', () => {
	let factory;
	let container;

	beforeEach(() => {
		factory = new JavaisPasVuTestFactory();
		factory.setup();
		container = document.createElement('div');
		document.body.appendChild(container);
		JavaisPasVu.initialize(container);
	});

	afterEach(() => {
		factory.cleanup();
		if (container && container.parentNode) {
			document.body.removeChild(container);
		}
		JavaisPasVu.destroy();
	});

	test('should register data without errors', () => {
		factory.loadTemplate('<div>Test</div>');
		expect(() => {
			JavaisPasVu.registerData('test', { value: 'test' });
		}).not.toThrow();
	});

	describe('Theme Dropdown', () => {
		const THEME_TEMPLATE = `
            <ul class="dropdown-menu">
                <li v-if="theme !== 'light'">
                    <a class="dropdown-item">Light</a>
                </li>
                <li v-if="theme !== 'dark'">
                    <a class="dropdown-item">Dark</a>
                </li>
                <li v-if="theme !== 'high-contrast'">
                    <a class="dropdown-item">High Contrast</a>
                </li>
            </ul>
        `;

		beforeEach(() => {
			factory.loadTemplate(THEME_TEMPLATE, 'ui');
		});

		test('should maintain DOM structure', () => {
			factory.registerData('ui', { theme: 'light' });

			// Check basic DOM structure
			expect(factory.query('.dropdown-menu')).not.toBeNull();

			// Check items
			const items = factory.getTextContent('.dropdown-item');
			expect(items).toHaveLength(3);
			expect(items).toContain('Light');
			expect(items).toContain('Dark');
			expect(items).toContain('High Contrast');

			// Check v-if attributes
			const vIfExpressions = factory.getAttributes('li', 'v-if');
			expect(vIfExpressions).toContain("theme !== 'light'");
			expect(vIfExpressions).toContain("theme !== 'dark'");
			expect(vIfExpressions).toContain("theme !== 'high-contrast'");
		});

		test('should store theme data correctly', () => {
			// Test initial theme
			factory.registerData('ui', { theme: 'light' });
			expect(factory.getData('ui')).toEqual({ theme: 'light' });

			// Test theme changes
			factory.registerData('ui', { theme: 'dark' });
			expect(factory.getData('ui')).toEqual({ theme: 'dark' });

			factory.registerData('ui', { theme: 'high-contrast' });
			expect(factory.getData('ui')).toEqual({ theme: 'high-contrast' });
		});

		test('should evaluate v-if expressions', () => {
			factory.registerData('ui', { theme: 'light' });

			const vIfExpressions = factory.getAttributes('li', 'v-if');
			vIfExpressions.forEach(expr => {
				expect(expr).toMatch(/theme !== '(light|dark|high-contrast)'/);
				const match = expr.match(/theme !== '(.+)'/);
				expect(match).not.toBeNull();
				expect(['light', 'dark', 'high-contrast']).toContain(match[1]);
			});
		});
	});

	describe('Expression Evaluation', () => {
		beforeEach(() => {
			JavaisPasVu.registerData('test', {
				theme: 'light',
				fontSize: 'medium',
				count: 42,
				items: ['a', 'b', 'c']
			});
		});

		test('should evaluate string equality expressions correctly', () => {
			const element = document.createElement('div');
			element.setAttribute('data-domain', 'test');

			// Test string equality
			element.setAttribute('v-if', "theme === 'light'");
			JavaisPasVu.bindIf(element, { theme: 'light', _domain: 'test' });
			expect(element.style.display).not.toBe('none');

			// Test string inequality
			element.setAttribute('v-if', "theme !== 'dark'");
			JavaisPasVu.bindIf(element, { theme: 'light', _domain: 'test' });
			expect(element.style.display).not.toBe('none');
		});

		test('should handle nested property access safely', () => {
			const element = document.createElement('div');
			element.setAttribute('data-domain', 'test');

			// Test nested property that exists
			JavaisPasVu.registerData('test', { user: { name: 'test' } });
			element.setAttribute('v-if', "user.name === 'test'");
			JavaisPasVu.bindIf(element, { user: { name: 'test' }, _domain: 'test' });
			expect(element.style.display).not.toBe('none');

			// Test nested property that doesn't exist
			const data = { _domain: 'test' };
			element.setAttribute('v-if', "Object.hasOwn(this, 'user')");
			JavaisPasVu.bindIf(element, data);
			expect(element.style.display).toBe('none');
		});

		test('should handle array access expressions', () => {
			const element = document.createElement('div');
			element.setAttribute('data-domain', 'test');

			element.setAttribute('v-if', "items[0] === 'a'");
			JavaisPasVu.bindIf(element, { items: ['a', 'b', 'c'], _domain: 'test' });
			expect(element.style.display).not.toBe('none');
		});
	});

	describe('Conditional Rendering', () => {
		beforeEach(() => {
			container.innerHTML = `
				<div data-domain="test">
					<div id="if1" v-if="value === 'A'">A</div>
					<div id="elseif1" v-else-if="value === 'B'">B</div>
					<div id="else1" v-else>C</div>
				</div>
			`;
			JavaisPasVu.registerData('test', { value: 'A' });
		});

		test('should handle v-if/v-else-if/v-else chains correctly', () => {
			// Test initial state (value === 'A')
			JavaisPasVu.updateElement(container.firstElementChild, 'test');
			expect(document.getElementById('if1').style.display).not.toBe('none');
			expect(document.getElementById('elseif1').style.display).toBe('none');
			expect(document.getElementById('else1').style.display).toBe('none');

			// Test v-else-if condition (value === 'B')
			JavaisPasVu.registerData('test', { value: 'B' });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');
			expect(document.getElementById('if1').style.display).toBe('none');
			expect(document.getElementById('elseif1').style.display).not.toBe('none');
			expect(document.getElementById('else1').style.display).toBe('none');

			// Test v-else condition (value === 'C')
			JavaisPasVu.registerData('test', { value: 'C' });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');
			expect(document.getElementById('if1').style.display).toBe('none');
			expect(document.getElementById('elseif1').style.display).toBe('none');
			expect(document.getElementById('else1').style.display).not.toBe('none');
		});

		test('should handle multiple v-if chains independently', () => {
			container.innerHTML += `
				<div data-domain="test">
					<div id="if2" v-if="count > 40">High</div>
					<div id="elseif2" v-else-if="count > 20">Medium</div>
					<div id="else2" v-else>Low</div>
				</div>
			`;

			JavaisPasVu.registerData('test', { value: 'A', count: 42 });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');
			JavaisPasVu.updateElement(container.lastElementChild, 'test');

			// First chain should show 'A'
			expect(document.getElementById('if1').style.display).not.toBe('none');
			expect(document.getElementById('elseif1').style.display).toBe('none');
			expect(document.getElementById('else1').style.display).toBe('none');

			// Second chain should show 'High'
			expect(document.getElementById('if2').style.display).not.toBe('none');
			expect(document.getElementById('elseif2').style.display).toBe('none');
			expect(document.getElementById('else2').style.display).toBe('none');
		});
	});

	describe('List Rendering (v-for)', () => {
		beforeEach(() => {
			container.innerHTML = `
				<div data-domain="test">
					<ul>
						<li v-for="item in items">{{item}}</li>
					</ul>
					<div>
						<div v-for="(item, index) in items" class="indexed-item">
							{{index}}: {{item}}
						</div>
					</div>
				</div>
			`;
		});

		test('should render list items correctly', () => {
			JavaisPasVu.registerData('test', { items: ['apple', 'banana', 'orange'] });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			const listItems = container.querySelectorAll('li');
			expect(listItems).toHaveLength(3);
			expect(listItems[0].textContent).toBe('apple');
			expect(listItems[1].textContent).toBe('banana');
			expect(listItems[2].textContent).toBe('orange');
		});

		test('should handle index in v-for', () => {
			JavaisPasVu.registerData('test', { items: ['apple', 'banana', 'orange'] });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			const indexedItems = container.querySelectorAll('.indexed-item');
			expect(indexedItems).toHaveLength(3);
			expect(indexedItems[0].textContent.trim()).toBe('0: apple');
			expect(indexedItems[1].textContent.trim()).toBe('1: banana');
			expect(indexedItems[2].textContent.trim()).toBe('2: orange');
		});

		test('should update list items incrementally', () => {
			// Initial setup and logging
			console.log('Initial template:', container.innerHTML);

			// Initial render with one item
			JavaisPasVu.registerData('test', { items: ['apple'] });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			console.log('DOM after initial render:', container.innerHTML);

			// Log current data state
			console.log('Current data:', JavaisPasVu.getData('test'));
			console.log('Updating data to:', { items: ['apple', 'banana'] });

			// Update data and force synchronous update
			JavaisPasVu.registerData('test', { items: ['apple', 'banana'] });

			// Log template state before update
			const ul = container.querySelector('ul');
			const template = ul.querySelector('li');
			console.log('Template before update:', {
				template: template ? template.outerHTML : 'not found',
				vForAttr: template ? template.getAttribute('v-for') : 'not found',
				parentKeys: ul ? Object.keys(ul).filter(k => k.startsWith('__v_for_')) : []
			});

			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			// Log template state after update
			console.log('Template after update:', {
				template: template ? template.outerHTML : 'not found',
				vForAttr: template ? template.getAttribute('v-for') : 'not found',
				parentKeys: ul ? Object.keys(ul).filter(k => k.startsWith('__v_for_')) : []
			});

			// Find v-for section
			const walker = document.createTreeWalker(
				ul,
				NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
				null,
				false
			);

			let startMarker = null;
			let endMarker = null;
			let node = walker.nextNode();

			while (node) {
				if (node.nodeType === Node.COMMENT_NODE) {
					if (node.textContent.includes('v-for: item in items start')) {
						startMarker = node;
					} else if (node.textContent.includes('v-for: item in items end')) {
						endMarker = node;
						break;
					}
				}
				node = walker.nextNode();
			}

			if (startMarker && endMarker) {
				console.log('v-for section found:', {
					start: startMarker.textContent,
					end: endMarker.textContent
				});

				// Log list items between markers
				let current = startMarker.nextSibling;
				const listItems = [];
				while (current && current !== endMarker) {
					if (current.nodeType === Node.ELEMENT_NODE && current.tagName === 'LI') {
						listItems.push({
							textContent: current.textContent,
							vFor: current.getAttribute('v-for'),
							previousSibling: current.previousSibling?.textContent,
							nextSibling: current.nextSibling?.textContent
						});
					}
					current = current.nextSibling;
				}
				console.log('List items after update:', listItems);
			}

			console.log('Final DOM state:', container.innerHTML);

			// Assertions
			const items = Array.from(container.querySelectorAll('li'));
			expect(items.length).toBe(2);
			expect(items[0].textContent).toBe('apple');
			expect(items[1].textContent).toBe('banana');
		});

		test('should maintain template structure during updates', () => {
			// Initial render
			JavaisPasVu.registerData('test', { items: ['apple'] });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			// Check initial structure
			expect(container.querySelector('ul')).not.toBeNull();
			expect(container.querySelector('li')).not.toBeNull();
			expect(container.querySelector('li').hasAttribute('v-for')).toBe(false);

			// Update data
			JavaisPasVu.registerData('test', { items: ['apple', 'banana'] });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			// Check structure after update
			expect(container.querySelector('ul')).not.toBeNull();
			expect(container.querySelectorAll('li')).toHaveLength(2);
			expect(container.querySelector('li').hasAttribute('v-for')).toBe(false);
		});

		test('should handle empty array updates', () => {
			// Start with items
			JavaisPasVu.registerData('test', { items: ['apple', 'banana'] });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');
			expect(container.querySelectorAll('li')).toHaveLength(2);

			// Update to empty array
			JavaisPasVu.registerData('test', { items: [] });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');
			expect(container.querySelectorAll('li')).toHaveLength(0);

			// Update back to having items
			JavaisPasVu.registerData('test', { items: ['cherry'] });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');
			expect(container.querySelectorAll('li')).toHaveLength(1);
			expect(container.querySelector('li').textContent).toBe('cherry');
		});

		test('should update when array changes', () => {
			container.innerHTML = `
				<div data-domain="test">
					<ul>
						<li v-for="item in items">{{item}}</li>
					</ul>
				</div>
			`;

			// Initial render with 2 items
			JavaisPasVu.registerData('test', { items: ['apple', 'banana'] });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			expect(container.querySelectorAll('li')).toHaveLength(2);

			// Update with 3 items
			JavaisPasVu.registerData('test', { items: ['apple', 'banana', 'orange'] });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			const listItems = container.querySelectorAll('li');
			expect(listItems).toHaveLength(3);
			expect(listItems[0].textContent).toBe('apple');
			expect(listItems[1].textContent).toBe('banana');
			expect(listItems[2].textContent).toBe('orange');
		});

		test('should reprocess v-for directives during updates', () => {
			// Initial render
			JavaisPasVu.registerData('test', { items: ['apple'] });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			// Get the original template
			const ul = container.querySelector('ul');
			const originalTemplate = ul.querySelector('li');
			console.log('Original template v-for attribute:', originalTemplate ? originalTemplate.getAttribute('v-for') : 'not found');

			// Update data
			JavaisPasVu.registerData('test', { items: ['apple', 'banana'] });

			// Log state before update
			console.log('DOM before update:', container.innerHTML);

			// Force update
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			// Log state after update
			console.log('DOM after update:', container.innerHTML);

			// Check if v-for was reprocessed
			const listItems = container.querySelectorAll('li');
			console.log('List items after update:', Array.from(listItems).map(li => ({
				textContent: li.textContent,
				vFor: li.getAttribute('v-for'),
				previousSibling: li.previousSibling ? li.previousSibling.textContent : 'none',
				nextSibling: li.nextSibling ? li.nextSibling.textContent : 'none'
			})));

			expect(listItems).toHaveLength(2);
			expect(Array.from(listItems).map(li => li.textContent)).toEqual(['apple', 'banana']);
		});
	});

	describe('Two-way Data Binding (v-model)', () => {
		beforeEach(() => {
			container.innerHTML = `
				<div data-domain="test">
					<input type="text" v-model="text" id="text-input">
					<input type="checkbox" v-model="checked" id="checkbox-input">
					<select v-model="selected" id="select-input">
						<option value="a">A</option>
						<option value="b">B</option>
					</select>
				</div>
			`;
		});

		test('should bind text input value', () => {
			JavaisPasVu.registerData('test', { text: 'initial' });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			const input = document.getElementById('text-input');
			expect(input.value).toBe('initial');

			// Simulate user input
			input.value = 'changed';
			input.dispatchEvent(new Event('input'));

			expect(JavaisPasVu.getData('test').text).toBe('changed');
		});

		test('should bind checkbox state', () => {
			JavaisPasVu.registerData('test', { checked: true });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			const checkbox = document.getElementById('checkbox-input');
			expect(checkbox.checked).toBe(true);

			// Simulate user input
			checkbox.checked = false;
			checkbox.dispatchEvent(new Event('change'));

			expect(JavaisPasVu.getData('test').checked).toBe(false);
		});

		test('should bind select value', () => {
			JavaisPasVu.registerData('test', { selected: 'a' });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			const select = document.getElementById('select-input');
			expect(select.value).toBe('a');

			// Simulate user selection
			select.value = 'b';
			select.dispatchEvent(new Event('change'));

			expect(JavaisPasVu.getData('test').selected).toBe('b');
		});
	});

	describe('Event Handling', () => {
		beforeEach(() => {
			container.innerHTML = `
				<div data-domain="test">
					<button v-on:click="increment()" id="click-btn">Click</button>
					<button v-on:click="decrement()" id="shorthand-btn">Click</button>
					<input v-on:input="updateValue($event.target.value)" id="input-event">
					<input v-on:change="updateChecked($event.target.checked)" type="checkbox" id="checkbox-event">
				</div>
			`;
		});

		test('should properly register methods', () => {
			const increment = jest.fn();
			const decrement = jest.fn();

			// Register methods
			JavaisPasVu.registerMethods('test', { increment, decrement });

			// Verify methods are stored
			const methods = JavaisPasVu.methods.get('test');
			expect(methods).toBeDefined();
			expect(methods.increment).toBe(increment);
			expect(methods.decrement).toBe(decrement);
		});

		test('should preserve methods after data registration', () => {
			const increment = jest.fn();
			const decrement = jest.fn();

			// Register methods first
			JavaisPasVu.registerMethods('test', { increment, decrement });

			// Register data
			JavaisPasVu.registerData('test', { count: 0 });

			// Verify methods are still present
			const state = JavaisPasVu.getData('test');
			expect(state.increment).toBe(increment);
			expect(state.decrement).toBe(decrement);
		});

		test('should bind event listeners correctly', () => {
			const increment = jest.fn();

			// Register method and data
			JavaisPasVu.registerMethods('test', { increment });
			JavaisPasVu.registerData('test', { count: 0 });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			// Verify event listener is attached
			const btn = document.getElementById('click-btn');
			const boundListener = Object.keys(btn).find(key => key.startsWith('__bound_click'));
			expect(boundListener).toBeDefined();
		});

		test('should handle click events', () => {
			const increment = jest.fn();
			const decrement = jest.fn();

			// Register methods first
			JavaisPasVu.registerMethods('test', { increment, decrement });

			// Verify methods are registered correctly
			const registeredMethods = JavaisPasVu.methods.get('test');
			expect(registeredMethods.increment).toBe(increment);
			expect(registeredMethods.decrement).toBe(decrement);

			// Then register data to ensure methods are preserved
			JavaisPasVu.registerData('test', { count: 0 });

			// Verify methods are still present after data registration
			const state = JavaisPasVu.getData('test');
			expect(state.increment).toBe(increment);
			expect(state.decrement).toBe(decrement);

			// Update element and verify event bindings
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			// Check if buttons exist
			const clickBtn = document.getElementById('click-btn');
			const secondBtn = document.getElementById('shorthand-btn');
			expect(clickBtn).not.toBeNull();
			expect(secondBtn).not.toBeNull();

			// Log all attributes for debugging
			console.log('Click button attributes:', Array.from(clickBtn.attributes).map(attr => `${attr.name}=${attr.value}`));
			console.log('Second button attributes:', Array.from(secondBtn.attributes).map(attr => `${attr.name}=${attr.value}`));

			// Verify event listeners are attached
			const clickBoundListener = Object.keys(clickBtn).find(key => key.startsWith('__bound_click'));
			const secondBoundListener = Object.keys(secondBtn).find(key => key.startsWith('__bound_click'));
			expect(clickBoundListener).toBeDefined();
			expect(secondBoundListener).toBeDefined();

			// Verify bound methods are stored
			expect(clickBtn['__method_increment']).toBeDefined();
			expect(secondBtn['__method_decrement']).toBeDefined();

			// Simulate clicks and verify method calls
			clickBtn.click();
			expect(increment).toHaveBeenCalled();
			expect(increment.mock.instances[0]).toBe(state); // Verify 'this' binding

			secondBtn.click();
			expect(decrement).toHaveBeenCalled();
			expect(decrement.mock.instances[0]).toBe(state); // Verify 'this' binding
		});

		test('should handle input events with parameters', () => {
			const updateValue = jest.fn();
			const updateChecked = jest.fn();

			// Register methods first
			JavaisPasVu.registerMethods('test', { updateValue, updateChecked });
			// Then register data to ensure methods are preserved
			JavaisPasVu.registerData('test', { value: '', checked: false });
			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			const input = document.getElementById('input-event');
			input.value = 'test';
			input.dispatchEvent(new Event('input'));
			expect(updateValue).toHaveBeenCalledWith('test');

			const checkbox = document.getElementById('checkbox-event');
			checkbox.checked = true;
			checkbox.dispatchEvent(new Event('change'));
			expect(updateChecked).toHaveBeenCalledWith(true);
		});
	});

	describe('Computed Properties', () => {
		beforeEach(() => {
			container.innerHTML = `
				<div data-domain="test">
					<div id="full-name" v-text="fullName"></div>
					<div id="item-count" v-text="itemCount"></div>
				</div>
			`;
		});

		test('should compute derived values', () => {
			const computedProps = {
				fullName: function () {
					return `${this.firstName} ${this.lastName}`;
				},
				itemCount: function () {
					return this.items.length;
				}
			};

			JavaisPasVu.registerData('test', {
				firstName: 'John',
				lastName: 'Doe',
				items: ['a', 'b', 'c']
			}, computedProps);

			JavaisPasVu.updateElement(container.firstElementChild, 'test');

			expect(document.getElementById('full-name').textContent).toBe('John Doe');
			expect(document.getElementById('item-count').textContent).toBe('3');
		});

		test('should update when dependencies change', () => {
			const computedProps = {
				fullName: function () {
					return `${this.firstName} ${this.lastName}`;
				}
			};

			JavaisPasVu.registerData('test', {
				firstName: 'John',
				lastName: 'Doe'
			}, computedProps);

			JavaisPasVu.updateElement(container.firstElementChild, 'test');
			expect(document.getElementById('full-name').textContent).toBe('John Doe');

			JavaisPasVu.registerData('test', {
				firstName: 'Jane',
				lastName: 'Doe'
			}, computedProps);

			JavaisPasVu.updateElement(container.firstElementChild, 'test');
			expect(document.getElementById('full-name').textContent).toBe('Jane Doe');
		});
	});
}); 
