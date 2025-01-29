import Store, { actions } from '../state/store.js';
import logger from '../logger.js';
import { UI_THEME, UI_FONT_SIZE } from '../state/uiState.js';
import javaisPasVu from './JavaisPasVu.js';

// Extracted updateTheme function for external use
function updateTheme(theme) {
	// Ensure we're getting a string value, not an event
	if (theme instanceof Event) {
		logger.debug('Theme update event received:', {
			type: theme.type,
			currentTarget: theme.currentTarget?.tagName,
			target: theme.target?.tagName,
			currentTargetDataset: theme.currentTarget?.dataset,
			targetDataset: theme.target?.dataset
		});

		// Only prevent default if it's a theme switcher event
		if (theme.currentTarget?.dataset?.theme) {
			theme.preventDefault();
			theme = theme.currentTarget.dataset.theme;
			logger.debug('Theme from currentTarget:', theme);
		} else if (theme.target?.dataset?.theme) {
			theme.preventDefault();
			theme = theme.target.dataset.theme;
			logger.debug('Theme from target:', theme);
		} else {
			logger.warn('Event object passed without theme data attribute:', {
				event: theme.type,
				currentTarget: theme.currentTarget,
				target: theme.target
			});
			return;
		}
	}

	if (!Object.values(UI_THEME).includes(theme)) {
		logger.error('Invalid theme value:', theme);
		return;
	}

	logger.debug('Dispatching theme update:', theme);
	Store.getInstance().dispatch({
		domain: 'ui',
		type: actions.ui.UPDATE_THEME,
		payload: { theme }
	});
}

// Extracted updateFontSize function for external use
function updateFontSize(fontSize) {
	// Ensure we're getting a string value, not an event
	if (fontSize instanceof Event) {
		logger.debug('Font size update event received:', {
			type: fontSize.type,
			currentTarget: fontSize.currentTarget?.tagName,
			target: fontSize.target?.tagName,
			currentTargetDataset: fontSize.currentTarget?.dataset,
			targetDataset: fontSize.target?.dataset
		});

		// Only prevent default if it's a font size switcher event
		if (fontSize.currentTarget?.dataset?.size) {
			fontSize.preventDefault();
			fontSize = fontSize.currentTarget.dataset.size;
			logger.debug('Font size from currentTarget:', fontSize);
		} else if (fontSize.target?.dataset?.size) {
			fontSize.preventDefault();
			fontSize = fontSize.target.dataset.size;
			logger.debug('Font size from target:', fontSize);
		} else {
			logger.warn('Event object passed without size data attribute:', {
				event: fontSize.type,
				currentTarget: fontSize.currentTarget,
				target: fontSize.target
			});
			return;
		}
	}

	// Validate font size value
	if (!fontSize || typeof fontSize !== 'string' || !Object.values(UI_FONT_SIZE).includes(fontSize)) {
		logger.error('Invalid font size value:', fontSize);
		return;
	}

	logger.debug('Dispatching font size update:', fontSize);
	// Save to localStorage first
	localStorage.setItem('sizeLocal', fontSize);

	// Then update state
	Store.getInstance().dispatch({
		domain: 'ui',
		type: actions.ui.UPDATE_FONT_SIZE,
		payload: { fontSize }
	});
}

// UI Plugin for JavaisPasVu
const UIPlugin = {
	name: 'ui',
	install(app) {
		// Register UI domain with initial state
		app.on('beforeMount', () => {
			logger.debug('UI Plugin beforeMount:', {
				storedTheme: localStorage.getItem('themeLocal'),
				storedFontSize: localStorage.getItem('sizeLocal')
			});

			const store = Store.getInstance();

			// Get initial values from localStorage or defaults
			const theme = localStorage.getItem('themeLocal') || UI_THEME.LIGHT;
			let fontSize = localStorage.getItem('sizeLocal') || UI_FONT_SIZE.SMALL;

			// Ensure fontSize is valid
			if (!Object.values(UI_FONT_SIZE).includes(fontSize) || fontSize instanceof Event) {
				logger.warn('Invalid stored font size, using default:', {
					stored: fontSize,
					default: UI_FONT_SIZE.SMALL
				});
				fontSize = UI_FONT_SIZE.SMALL;
			}

			logger.debug('Initializing UI state:', { theme, fontSize });

			// Initialize state with validated values
			store.dispatch({
				domain: 'ui',
				type: actions.ui.INITIALIZE,
				payload: {
					theme,
					fontSize,
					modals: {},
					toasts: [],
					offcanvas: {}
				}
			});

			// Register initial state with JavaisPasVu
			app.registerData('ui', {
				theme,
				fontSize,
				modals: {},
				toasts: [],
				offcanvas: {},
				themes: Object.values(UI_THEME),
				fontSizes: Object.values(UI_FONT_SIZE)
			});

			logger.debug('UI state initialized:', app.getState('ui'));
		});

		// Register UI state change handlers
		app.on('updated', () => {
			const uiState = app.getState('ui');
			if (uiState) {
				if (uiState.theme) applyThemeToDOM(uiState.theme);
				if (uiState.fontSize) applyFontSizeToDOM(uiState.fontSize);
			}
		});

		// Register computed properties
		app.registerComputed('ui', {
			isLightTheme: function () { return this.theme === UI_THEME.LIGHT; },
			isDarkTheme: function () { return this.theme === UI_THEME.DARK; },
			isHighContrastTheme: function () { return this.theme === UI_THEME.HIGH_CONTRAST; },
			isSmallFont: function () { return this.fontSize === UI_FONT_SIZE.SMALL; },
			isMediumFont: function () { return this.fontSize === UI_FONT_SIZE.MEDIUM; },
			isLargeFont: function () { return this.fontSize === UI_FONT_SIZE.LARGE; },
			hasActiveModals: function () { return Object.keys(this.modals).length > 0; },
			hasActiveToasts: function () { return this.toasts.length > 0; },
			activeModalCount: function () { return Object.keys(this.modals).length; },
			activeToastCount: function () { return this.toasts.length; }
		});

		// Register UI methods
		app.registerMethods('ui', {
			updateTheme,
			updateFontSize,
			showModal(options) {
				Store.getInstance().dispatch({
					domain: 'ui',
					type: actions.ui.SHOW_MODAL,
					payload: {
						id: `modal-${Date.now()}`,
						...options
					}
				});
			},
			hideModal(modalId) {
				Store.getInstance().dispatch({
					domain: 'ui',
					type: actions.ui.HIDE_MODAL,
					payload: { id: modalId }
				});
			},
			showToast(options) {
				Store.getInstance().dispatch({
					domain: 'ui',
					type: actions.ui.SHOW_TOAST,
					payload: {
						id: `toast-${Date.now()}`,
						...options
					}
				});
			},
			hideToast(toastId) {
				Store.getInstance().dispatch({
					domain: 'ui',
					type: actions.ui.HIDE_TOAST,
					payload: { id: toastId }
				});
			}
		});

		// Subscribe to store changes
		Store.getInstance().subscribe('ui', (state) => {
			if (state) {
				app.registerData('ui', {
					...state,
					themes: Object.values(UI_THEME),
					fontSizes: Object.values(UI_FONT_SIZE)
				});
			}
		});
	}
};

function applyThemeToDOM(theme) {
	try {
		if (!theme || typeof theme !== 'string') {
			logger.error('Invalid theme value:', theme);
			return;
		}

		if (!Object.values(UI_THEME).includes(theme)) {
			logger.error('Invalid theme value:', theme);
			return;
		}

		logger.debug('Applying theme to DOM:', theme);

		// Apply theme to document
		document.documentElement.setAttribute('data-bs-theme', theme);
		document.body.classList.remove('theme-light', 'theme-dark', 'theme-high-contrast');
		document.body.classList.add(`theme-${theme}`);

		// Update theme-specific styles
		const root = document.documentElement;
		switch (theme) {
			case UI_THEME.DARK:
				root.style.setProperty('--bs-body-bg', '#212529');
				root.style.setProperty('--bs-body-color', '#f8f9fa');
				break;
			case UI_THEME.HIGH_CONTRAST:
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
			bodyClasses: document.body.classList.toString()
		});
	} catch (error) {
		logger.error('Error applying theme to DOM:', error);
	}
}

function applyFontSizeToDOM(fontSize) {
	try {
		if (!fontSize || typeof fontSize !== 'string') {
			logger.error('Invalid font size value:', fontSize);
			return;
		}

		if (!Object.values(UI_FONT_SIZE).includes(fontSize)) {
			logger.error('Invalid font size value:', fontSize);
			return;
		}

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

function initializeThemeAndFontSize() {
	const store = Store.getInstance();

	// Get initial values from localStorage or defaults
	const theme = localStorage.getItem('themeLocal') || UI_THEME.LIGHT;
	let fontSize = localStorage.getItem('sizeLocal') || UI_FONT_SIZE.SMALL;

	// Ensure fontSize is valid
	if (!Object.values(UI_FONT_SIZE).includes(fontSize) || fontSize instanceof Event) {
		fontSize = UI_FONT_SIZE.SMALL;
	}

	// Initialize state with validated values
	store.dispatch({
		domain: 'ui',
		type: actions.ui.INITIALIZE,
		payload: {
			theme,
			fontSize,
			modals: {},
			toasts: [],
			offcanvas: {}
		}
	});

	logger.debug('Initializing theme and font size:', {
		theme,
		fontSize
	});
}

// Export plugin for manual installation
export const plugin = UIPlugin;

// Export other functions
export {
	initializeThemeAndFontSize,
	applyThemeToDOM,
	applyFontSizeToDOM,
	updateTheme,
	updateFontSize
};
