import Store, { actions } from '../state/store.js';
import logger from '../logger.js';
import { UI_THEME, UI_FONT_SIZE } from '../state/uiState.js';

function applyThemeToDOM(theme) {
	try {
		logger.debug('Applying theme to DOM:', theme);

		// Apply theme to document
		document.documentElement.setAttribute('data-bs-theme', theme);
		document.body.classList.remove('theme-light', 'theme-dark', 'theme-high-contrast');
		document.body.classList.add(`theme-${theme}`);

		// Update theme-specific styles
		const root = document.documentElement;
		switch (theme) {
			case 'dark':
				root.style.setProperty('--bs-body-bg', '#212529');
				root.style.setProperty('--bs-body-color', '#f8f9fa');
				break;
			case 'high-contrast':
				root.style.setProperty('--bs-body-bg', '#000000');
				root.style.setProperty('--bs-body-color', '#ffffff');
				root.style.setProperty('--bs-primary', '#ffff00');
				break;
			default: // light
				root.style.setProperty('--bs-body-bg', '#ffffff');
				root.style.setProperty('--bs-body-color', '#212529');
				break;
		}

		logger.debug('Theme applied to DOM:', {
			theme,
			documentTheme: document.documentElement.getAttribute('data-bs-theme'),
			bodyClasses: document.body.classList.toString(),
			uiElements: document.querySelectorAll('[data-domain="ui"]')
		});
	} catch (error) {
		logger.error('Error applying theme to DOM:', error);
	}
}

function applyFontSizeToDOM(fontSize) {
	try {
		logger.debug('Applying font size to DOM:', fontSize);

		// Remove all font size classes
		document.body.classList.remove(
			`font-${UI_FONT_SIZE.SMALL}`,
			`font-${UI_FONT_SIZE.MEDIUM}`,
			`font-${UI_FONT_SIZE.LARGE}`
		);
		document.body.classList.add(`font-${fontSize}`);

		// Update body font size
		const fontSizes = {
			[UI_FONT_SIZE.SMALL]: '0.875rem',
			[UI_FONT_SIZE.MEDIUM]: '1rem',
			[UI_FONT_SIZE.LARGE]: '1.25rem'
		};
		document.body.style.fontSize = fontSizes[fontSize];

		// Update navbar brand
		const navbarBrand = document.querySelector('.navbar-brand');
		if (navbarBrand) {
			const brandSizes = {
				[UI_FONT_SIZE.SMALL]: '1.1rem',
				[UI_FONT_SIZE.MEDIUM]: '1.25rem',
				[UI_FONT_SIZE.LARGE]: '1.5rem'
			};
			navbarBrand.style.fontSize = brandSizes[fontSize];
		}

		// Update buttons
		const buttons = document.querySelectorAll('.btn');
		buttons.forEach(btn => {
			btn.style.fontSize = fontSizes[fontSize];
		});

		// Update form controls
		const formControls = document.querySelectorAll('.form-control');
		formControls.forEach(control => {
			control.style.fontSize = fontSizes[fontSize];
			const paddings = {
				[UI_FONT_SIZE.SMALL]: '0.25rem 0.5rem',
				[UI_FONT_SIZE.MEDIUM]: '0.375rem 0.75rem',
				[UI_FONT_SIZE.LARGE]: '0.5rem 1rem'
			};
			control.style.padding = paddings[fontSize];
		});

		// Update headings
		const h4Sizes = {
			[UI_FONT_SIZE.SMALL]: '1.25rem',
			[UI_FONT_SIZE.MEDIUM]: '1.5rem',
			[UI_FONT_SIZE.LARGE]: '1.75rem'
		};
		document.querySelectorAll('h4').forEach(h4 => {
			h4.style.fontSize = h4Sizes[fontSize];
		});

		const h5Sizes = {
			[UI_FONT_SIZE.SMALL]: '1rem',
			[UI_FONT_SIZE.MEDIUM]: '1.25rem',
			[UI_FONT_SIZE.LARGE]: '1.5rem'
		};
		document.querySelectorAll('h5').forEach(h5 => {
			h5.style.fontSize = h5Sizes[fontSize];
		});

		logger.debug('Font size applied to DOM:', {
			fontSize,
			bodyClasses: document.body.classList.toString()
		});
	} catch (error) {
		logger.error('Error applying font size to DOM:', error);
	}
}

function updateTheme(theme) {
	const store = Store.getInstance();
	const validThemes = ['light', 'dark', 'high-contrast'];

	if (!validThemes.includes(theme)) {
		logger.error('Invalid theme value:', theme);
		return;
	}

	try {
		const currentState = store.getState('ui');
		logger.debug('Updating theme:', {
			newTheme: theme,
			currentState,
			currentThemeInDOM: document.documentElement.getAttribute('data-bs-theme')
		});

		// Update local storage first
		localStorage.setItem('themeLocal', theme);

		// Update store state - this will trigger StateSync to handle UI updates
		store.dispatch({
			domain: 'ui',
			type: actions.ui.UPDATE_THEME,
			payload: {
				...currentState,
				theme
			}
		});

		logger.debug('Theme update dispatched:', {
			theme,
			newState: store.getState('ui')
		});
	} catch (error) {
		logger.error('Error updating theme:', error);
	}
}

function updateFontSize(size) {
	const store = Store.getInstance();
	const validSizes = ['small', 'large'];

	if (!validSizes.includes(size)) {
		logger.error('Invalid font size value:', size);
		return;
	}

	try {
		localStorage.setItem('sizeLocal', size);
		applyFontSizeToDOM(size);

		store.dispatch({
			domain: 'ui',
			type: actions.ui.UPDATE_FONT_SIZE,
			payload: { fontSize: size }
		});
	} catch (error) {
		logger.error('Error updating font size:', error);
	}
}

function initializeThemeAndFontSize() {
	const store = Store.getInstance();
	const state = store.getState('ui');

	const theme = state?.theme || localStorage.getItem('themeLocal') || 'light';
	const fontSize = state?.fontSize || localStorage.getItem('sizeLocal') || 'small';

	if (!state) {
		store.dispatch({
			domain: 'ui',
			type: actions.ui.INITIALIZE,
			payload: { theme, fontSize }
		});
	}

	logger.debug('Initializing theme and font size:', {
		theme,
		fontSize,
		state: store.getState('ui')
	});

	applyThemeToDOM(theme);
	applyFontSizeToDOM(fontSize);
}

export {
	initializeThemeAndFontSize,
	updateTheme,
	updateFontSize,
	applyThemeToDOM,
	applyFontSizeToDOM
};
