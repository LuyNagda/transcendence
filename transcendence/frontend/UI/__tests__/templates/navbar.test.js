import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { JavaisPasVuTestFactory } from '../../JavaisPasVuTestFactory.js';
import fs from 'fs';
import path from 'path';

describe('Navbar Template', () => {
	let factory;
	const TEMPLATES_DIR = path.resolve(process.cwd(), 'templates');

	beforeEach(() => {
		factory = new JavaisPasVuTestFactory();
		factory.setup();

		// Register all navbar-related templates
		const templates = {
			'navbar': fs.readFileSync(path.join(TEMPLATES_DIR, 'navbar.html'), 'utf8'),
			'navbar-common': fs.readFileSync(path.join(TEMPLATES_DIR, 'navbar-common.html'), 'utf8'),
			'navbar-base': fs.readFileSync(path.join(TEMPLATES_DIR, 'navbar-base.html'), 'utf8'),
			'navbar-login': fs.readFileSync(path.join(TEMPLATES_DIR, 'navbar-login.html'), 'utf8')
		};

		// Register each template
		Object.entries(templates).forEach(([name, content]) => {
			factory.registerTemplate(name, content);
		});
	});

	afterEach(() => {
		factory.cleanup();
	});

	describe('Theme Switching', () => {
		beforeEach(() => {
			factory.loadTemplate('navbar-common', 'ui', true);
		});

		test('should show correct theme options', () => {
			// Set initial theme
			factory.registerData('ui', {
				theme: 'light',
				fontSize: 'medium'
			});

			// Force a complete update of the DOM
			factory.updateAll();

			// Check theme menu structure
			expect(factory.exists('#themeDropdown')).toBe(true);
			expect(factory.exists('.dropdown-menu')).toBe(true);

			// Get all theme options, excluding visually hidden spans
			const dropdownItems = factory.queryAll('#themeDropdown + .dropdown-menu .dropdown-item');
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
				factory.registerData('ui', { theme });

				// Get visible theme options
				const visibleOptions = factory.getTextContent('.dropdown-menu .dropdown-item');

				// Current theme should not be in options
				expect(visibleOptions).not.toContain(
					theme.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
				);
			});
		});
	});

	describe('User Authentication State', () => {
		test('should show login elements when not authenticated', () => {
			factory.loadTemplate('navbar-login', 'auth', true);
			factory.registerData('auth', { isAuthenticated: false });

			const navLinks = factory.getTextContent('.nav-link');
			expect(navLinks).toContain('Login');
			expect(navLinks).toContain('Register');
		});

		test('should show user menu when authenticated', () => {
			factory.loadTemplate('navbar', 'auth', true);
			factory.registerData('auth', {
				isAuthenticated: true,
				username: 'testuser',
				avatar: '{{ user.profile_picture.url }}'
			});

			expect(factory.exists('#userDropdown')).toBe(true);

			// Check user info
			const userMenu = factory.query('#userDropdown');
			expect(userMenu.querySelector('img.rounded-circle').getAttribute('src')).toBe('{{ user.profile_picture.url }}');

			// Check dropdown menu items
			const dropdownItems = factory.queryAll('#userDropdown + .dropdown-menu .dropdown-item');
			const menuItems = Array.from(dropdownItems).map(item => item.textContent.trim());

			expect(menuItems).toContain('Edit');
			expect(menuItems).toContain('Settings');
			expect(menuItems).toContain('Logout');
		});
	});
}); 