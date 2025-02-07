import { store, actions } from '../state/store.js';
import logger from '../logger.js';
import { UI_THEME, UI_FONT_SIZE } from '../state/uiState.js';
import { Modal, Dropdown, Toast, Offcanvas } from '../vendor.js';

export const AlertTypes = {
	SUCCESS: 'success',
	ERROR: 'error',
	WARNING: 'warning',
	INFO: 'info'
};

export const uiPlugin = {
	name: 'ui',
	app: null,

	install(app) {
		this.app = app;
		logger.info("Installing UI Plugin");

		// Register UI domain with initial state
		app.on('beforeMount', () => {
			logger.debug('UI Plugin beforeMount:', {
				storedTheme: localStorage.getItem('themeLocal'),
				storedFontSize: localStorage.getItem('sizeLocal')
			});

			// Get initial values from localStorage or defaults
			const theme = localStorage.getItem('themeLocal') || UI_THEME.LIGHT;
			let fontSize = localStorage.getItem('sizeLocal') || UI_FONT_SIZE.MEDIUM;

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

			// Register initial state with JaiPasVu
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

			this._initializeBootstrap();
			this._applyThemeToDOM(theme);
			this._applyFontSizeToDOM(fontSize);
		});

		// Register UI state change handlers
		app.on('updated', () => {
			const uiState = app.getState('ui');
			if (uiState) {
				if (uiState.theme) this._applyThemeToDOM(uiState.theme);
				if (uiState.fontSize) this._applyFontSizeToDOM(uiState.fontSize);
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
			updateTheme: (theme) => this._updateTheme(theme),
			updateFontSize: (fontSize) => this._updateFontSize(fontSize),
			applyTheme: (theme) => this._applyThemeToDOM(theme),
			applyFontSize: (fontSize) => this._applyFontSizeToDOM(fontSize),
			showModal(options) {
				const modalId = `modal-${Date.now()}`;
				store.dispatch({
					domain: 'ui',
					type: actions.ui.SHOW_MODAL,
					payload: {
						id: modalId,
						...options
					}
				});
				return {
					hide: () => this.hideModal(modalId)
				};
			},
			hideModal(modalId) {
				store.dispatch({
					domain: 'ui',
					type: actions.ui.HIDE_MODAL,
					payload: { id: modalId }
				});
			},
			showToast(options) {
				store.dispatch({
					domain: 'ui',
					type: actions.ui.SHOW_TOAST,
					payload: {
						id: `toast-${Date.now()}`,
						...options
					}
				});
			},
			hideToast(toastId) {
				store.dispatch({
					domain: 'ui',
					type: actions.ui.HIDE_TOAST,
					payload: { id: toastId }
				});
			},
			showAlert(type, message, options = {}) {
				logger.debug("Showing toast alert:", type, message);
				this.showToast({
					type,
					message,
					autohide: options.autohide ?? true,
					delay: options.delay ?? 5000
				});
			}
		});

		store.subscribe('ui', (state) => {
			if (state) {
				if (state.theme) this._applyThemeToDOM(state.theme);
				if (state.fontSize) this._applyFontSizeToDOM(state.fontSize);
				this.app.registerData('ui', state);
			}
		});

		// Subscribe to specific UI state changes
		store.subscribe('ui.modals', this._handleModalStateChange.bind(this));
		store.subscribe('ui.toasts', this._handleToastStateChange.bind(this));
		store.subscribe('ui.offcanvas', this._handleOffcanvasStateChange.bind(this));
	},

	_updateTheme(theme) {
		// Simplify event handling
		if (theme instanceof Event) {
			const target = theme.currentTarget || theme.target;
			if (target?.dataset?.theme) {
				theme.preventDefault();
				theme = target.dataset.theme;
			} else {
				logger.warn('Event object passed without theme data attribute');
				return;
			}
		}

		if (!Object.values(UI_THEME).includes(theme)) {
			logger.error('Invalid theme value:', theme);
			return;
		}

		store.dispatch({
			domain: 'ui',
			type: actions.ui.UPDATE_THEME,
			payload: { theme }
		});
	},

	_updateFontSize(fontSize) {
		if (fontSize instanceof Event) {
			const target = fontSize.currentTarget || fontSize.target;
			if (target?.dataset?.size) {
				fontSize.preventDefault();
				fontSize = target.dataset.size;
			} else {
				logger.warn('Event object passed without size data attribute');
				return;
			}
		}

		if (!Object.values(UI_FONT_SIZE).includes(fontSize)) {
			logger.error('Invalid font size value:', fontSize);
			return;
		}

		localStorage.setItem('sizeLocal', fontSize);
		store.dispatch({
			domain: 'ui',
			type: actions.ui.UPDATE_FONT_SIZE,
			payload: { fontSize }
		});
	},

	_initializeBootstrap() {
		try {
			['[data-bs-toggle="dropdown"]', '.toast', '.offcanvas'].forEach((selector, index) => {
				const Constructor = [Dropdown, Toast, Offcanvas][index];
				document.querySelectorAll(selector).forEach(el => new Constructor(el));
			});
			logger.debug('Bootstrap components initialized successfully');
		} catch (error) {
			logger.error('Error initializing Bootstrap components:', error);
		}
	},

	_handleModalStateChange(modals) {
		Object.entries(modals || {}).forEach(([id, modalData]) => {
			const modalElement = document.getElementById('modal');
			if (modalElement) {
				const modal = Modal.getInstance(modalElement) || new Modal(modalElement);
				modal.show();
			}
		});
	},

	_handleToastStateChange(toasts) {
		(toasts || []).forEach(toastData => {
			const toastElement = document.getElementById(toastData.id);
			if (toastElement) {
				const toast = Toast.getInstance(toastElement) || new Toast(toastElement);
				toast.show();
			}
		});
	},

	_handleOffcanvasStateChange(offcanvasState) {
		Object.entries(offcanvasState || {}).forEach(([id, isOpen]) => {
			const offcanvasElement = document.getElementById(id);
			if (offcanvasElement) {
				const offcanvas = Offcanvas.getInstance(offcanvasElement) || new Offcanvas(offcanvasElement);
				if (isOpen) {
					offcanvas.show();
				} else {
					offcanvas.hide();
				}
			}
		});
	},

	_applyThemeToDOM(theme) {
		try {
			document.documentElement.setAttribute('data-bs-theme', theme);
			document.body.classList.remove('theme-light', 'theme-dark', 'theme-high-contrast');
			document.body.classList.add(`theme-${theme}`);

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
	},

	_applyFontSizeToDOM(fontSize) {
		try {
			const fontSizeMap = {
				base: {
					[UI_FONT_SIZE.SMALL]: '0.75rem',
					[UI_FONT_SIZE.MEDIUM]: '1rem',
					[UI_FONT_SIZE.LARGE]: '1.25rem'
				},
				h: {
					[UI_FONT_SIZE.SMALL]: '0.9rem',
					[UI_FONT_SIZE.MEDIUM]: '1.1rem',
					[UI_FONT_SIZE.LARGE]: '1.2rem'
				}
			};

			document.body.classList.remove(...Object.values(UI_FONT_SIZE).map(size => `font-${size}`));
			document.body.classList.add(`font-${fontSize}`);
			document.body.style.fontSize = fontSizeMap.base[fontSize];

			document.querySelectorAll('.btn, .form-control').forEach(el =>
				el.style.fontSize = fontSizeMap.base[fontSize]);
			document.querySelectorAll('h2, h3, h4, h5').forEach(el =>
				el.style.fontSize = fontSizeMap.h[fontSize]);

			logger.debug('Font size applied to DOM:', { fontSize });
		} catch (error) {
			logger.error('Error applying font size to DOM:', error);
		}
	}
};
