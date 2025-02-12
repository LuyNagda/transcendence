import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { JaiPasVuTestFactory } from '../../JaiPasVuTestFactory.js';
import fs from 'fs';
import path from 'path';

describe('Navbar Template', () => {
	let factory;
	const TEMPLATES_DIR = path.resolve(process.cwd(), 'templates');

	beforeEach(() => {
		factory = new JaiPasVuTestFactory();
		factory.setup();

		// Register all templates needed for navbar testing
		const templates = {
			// Base templates
			'base': fs.readFileSync(path.join(TEMPLATES_DIR, 'base.html'), 'utf8'),
			'navbar-base': fs.readFileSync(path.join(TEMPLATES_DIR, 'navbar-base.html'), 'utf8'),
			'navbar-common': fs.readFileSync(path.join(TEMPLATES_DIR, 'navbar-common.html'), 'utf8'),
			'navbar-login': fs.readFileSync(path.join(TEMPLATES_DIR, 'navbar-login.html'), 'utf8'),
			'ui': fs.readFileSync(path.join(TEMPLATES_DIR, 'ui.html'), 'utf8')
		};

		// Register all templates at once to handle inheritance and includes
		factory.registerTemplates(templates);

		// Register mock theme plugin
		factory.registerMockPlugin('theme', {
			updateTheme: jest.fn(),
			updateFontSize: jest.fn()
		});
	});

	afterEach(() => {
		factory.cleanup();
	});

	describe('Theme Switching', () => {
		beforeEach(() => {
			// Load the full navbar with inheritance
			factory.loadTemplate('navbar-base', 'ui', { isRegistered: true });
			// Initialize UI state with default theme
			factory.registerData('ui', {
				theme: 'light',
				fontSize: 'medium'
			});
			factory.updateAll();
		});

		test('should show correct theme icon based on current theme', () => {
			const themes = ['light', 'dark', 'high-contrast'];
			const iconClasses = {
				'light': '.bi-sun',
				'dark': '.bi-moon',
				'high-contrast': '.bi-circle-half'
			};

			themes.forEach(theme => {
				factory.registerData('ui', { theme, fontSize: 'medium' });
				factory.updateAll();

				// Verify correct icon is shown
				expect(factory.exists(`svg${iconClasses[theme]}:not([style*="display: none"])`)).toBe(true);

				// Verify other icons are not shown
				Object.entries(iconClasses)
					.filter(([t]) => t !== theme)
					.forEach(([_, cls]) => {
						expect(factory.exists(`svg${cls}:not([style*="display: none"])`)).toBe(false);
					});
			});
		});

		test('should show correct theme options in dropdown', () => {
			// Set initial theme
			factory.registerData('ui', {
				theme: 'light',
				fontSize: 'medium'
			});
			factory.updateAll();

			// Get all theme options, excluding visually hidden spans
			const dropdownItems = factory.queryAll('#themeDropdown + .dropdown-menu .dropdown-item:not([style*="display: none"])');
			const themeOptions = Array.from(dropdownItems).map(item => {
				// Get only the direct text content, excluding the visually-hidden span
				const textNodes = Array.from(item.childNodes)
					.filter(node => node.nodeType === Node.TEXT_NODE)
					.map(node => node.textContent.trim());
				return textNodes.join('').trim();
			});

			// When theme is 'light', it should not appear in the options
			expect(themeOptions).not.toContain('Light');
			expect(themeOptions).toContain('Dark');
			expect(themeOptions).toContain('High Contrast');
			expect(themeOptions.length).toBe(2);
		});

		test('should handle theme changes', () => {
			// Test each theme state
			const themes = ['light', 'dark', 'high-contrast'];
			themes.forEach(theme => {
				factory.registerData('ui', { theme, fontSize: 'medium' });
				factory.updateAll();

				// Get visible theme options
				const visibleOptions = factory.getTextContent('.dropdown-menu .dropdown-item');

				// Current theme should not be in options
				expect(visibleOptions).not.toContain(
					theme.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
				);

				// Verify aria-label is correct
				const themeButton = factory.query('#themeDropdown');
				expect(themeButton.getAttribute('aria-label')).toBe('Theme Switcher');
			});
		});
	});

	describe('Font Size Controls', () => {
		beforeEach(() => {
			factory.loadTemplate('navbar-base', 'ui', { isRegistered: true });
			factory.registerData('ui', {
				theme: 'light',
				fontSize: 'medium'
			});
			factory.updateAll();
		});

		test('should show correct font size indicator', () => {
			const sizes = ['small', 'medium', 'large'];
			sizes.forEach(size => {
				factory.registerData('ui', { theme: 'light', fontSize: size });
				factory.updateAll();

				// Check active indicator
				expect(factory.exists(`.font-size-letter.${size}.active:not([style*="display: none"])`)).toBe(true);

				// Other sizes should not be active
				sizes.filter(s => s !== size).forEach(otherSize => {
					expect(factory.exists(`.font-size-letter.${otherSize}.active:not([style*="display: none"])`)).toBe(false);
				});
			});
		});

		test('should show correct font size options in dropdown', () => {
			factory.registerData('ui', { theme: 'light', fontSize: 'medium' });
			factory.updateAll();

			const dropdownItems = factory.queryAll('#fontSizeDropdown + .dropdown-menu .dropdown-item:not([style*="display: none"])');
			const sizeOptions = Array.from(dropdownItems).map(item => {
				return item.childNodes[0].textContent.trim();
			});

			// Medium should not be in options when it's current
			expect(sizeOptions).not.toContain('Medium');
			expect(sizeOptions).toContain('Small');
			expect(sizeOptions).toContain('Large');
			expect(sizeOptions.length).toBe(2);
		});

		test('should have correct accessibility attributes', () => {
			factory.registerData('ui', { theme: 'light', fontSize: 'medium' });
			factory.updateAll();

			const fontSizeButton = factory.query('#fontSizeDropdown');
			expect(fontSizeButton.getAttribute('aria-label')).toBe('Font Size Switcher');
			expect(fontSizeButton.getAttribute('aria-expanded')).toBe('false');

			// Check visually hidden labels
			const hiddenLabels = factory.queryAll('.visually-hidden');
			const labelTexts = Array.from(hiddenLabels).map(label => label.textContent);
			expect(labelTexts).toContain('Switch to small font size');
			expect(labelTexts).toContain('Switch to large font size');
		});
	});

	describe('User Authentication State', () => {
		test('should show login elements when not authenticated', () => {
			// Load the login navbar which extends navbar-base
			factory.loadTemplate('navbar-login', 'auth', { isRegistered: true });
			factory.registerData('auth', { isAuthenticated: false });
			factory.updateAll();

			const navLinks = factory.queryAll('.nav-link');
			const linkTexts = Array.from(navLinks)
				.filter(link => !link.id) // Filter out theme and font size dropdowns
				.map(link => link.textContent.trim());

			expect(linkTexts).toContain('Login');
			expect(linkTexts).toContain('Register');

			// Check accessibility
			navLinks.forEach(link => {
				expect(link.hasAttribute('aria-label')).toBe(true);
			});
		});

		test('should handle both auth and ui states', () => {
			factory.loadTemplate('ui', 'ui', { isRegistered: true });
			factory.registerData('ui', {
				theme: 'dark',
				fontSize: 'medium'
			});
			factory.updateAll();

			// Check auth state
			expect(factory.exists('#userDropdown')).toBe(true);
			expect(factory.exists('img.rounded-circle')).toBe(true);

			// Check ui state
			expect(factory.exists('#themeDropdown')).toBe(true);
			expect(factory.exists('#fontSizeDropdown')).toBe(true);

			// Verify theme icon shows dark theme
			expect(factory.exists('svg.bi-moon:not([style*="display: none"])')).toBe(true);

			// Verify font size shows medium
			expect(factory.exists('.font-size-letter.medium.active:not([style*="display: none"])')).toBe(true);
		});

		test('should handle HTMX navigation', () => {
			factory.loadTemplate('navbar-login', 'auth', { isRegistered: true });
			factory.registerData('auth', { isAuthenticated: false });
			factory.updateAll();

			const navLinks = Array.from(factory.queryAll('.nav-link'))
				.filter(link => !link.id); // Filter out theme and font size dropdowns

			navLinks.forEach(link => {
				expect(link.hasAttribute('hx-get')).toBe(true);
				expect(link.getAttribute('hx-target')).toBe('#content');
				expect(link.getAttribute('hx-swap')).toBe('outerHTML');
				expect(link.getAttribute('hx-push-url')).toBe('true');
			});
		});
	});
}); 