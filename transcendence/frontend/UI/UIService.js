import logger from '../logger.js';
import { Modal, Dropdown, Toast, Offcanvas } from '../vendor.js';
import Store, { actions } from '../state/store.js';
import { applyThemeToDOM, applyFontSizeToDOM } from './theme.js';
import javaisPasVu from './JavaisPasVu.js';

export const AlertTypes = {
	SUCCESS: 'success',
	ERROR: 'error',
	WARNING: 'warning',
	INFO: 'info'
};

export const UIService = {
	store: null,
	javaisPasVu: javaisPasVu,

	initialize() {
		this.store = Store.getInstance();
		// Get initial UI state from store
		const uiState = this.store.getState('ui');
		logger.debug('Initial UI state:', uiState);

		// Apply theme and font size to DOM immediately
		this.applyTheme(uiState.theme);
		this.applyFontSize(uiState.fontSize);

		this.initializeBootstrap();
		this._initializeUIState();

		// Force update on UI elements after initialization
		document.querySelectorAll('[data-domain="ui"]').forEach(el => {
			this.javaisPasVu.updateElement(el, 'ui');
		});
	},

	applyTheme(theme) {
		if (!theme) {
			logger.warn('No theme provided to applyTheme');
			return;
		}
		logger.debug('UIService applying theme:', theme);
		applyThemeToDOM(theme);
	},

	applyFontSize(fontSize) {
		if (!fontSize) {
			logger.warn('No fontSize provided to applyFontSize');
			return;
		}
		logger.debug('UIService applying font size:', fontSize);
		applyFontSizeToDOM(fontSize);
	},

	_initializeUIState() {
		// Get initial state from store
		const uiState = this.store.getState('ui');
		logger.debug('Initializing UI state with:', uiState);

		// Register UI state and methods with JavaisPasVu
		this.javaisPasVu.registerData('ui', {
			...uiState,
			updateTheme: (newTheme) => {
				logger.debug('Theme update requested:', newTheme);
				this.store.dispatch({
					domain: 'ui',
					type: actions.ui.UPDATE_THEME,
					payload: { theme: newTheme }
				});
			},
			updateFontSize: (size) => {
				logger.debug('Font size update requested:', size);
				this.store.dispatch({
					domain: 'ui',
					type: actions.ui.UPDATE_FONT_SIZE,
					payload: { fontSize: size }
				});
			}
		});

		// Subscribe to store changes
		this.store.subscribe('ui', (state) => {
			if (state) {
				logger.debug('UI state updated:', state);
				// Update JavaisPasVu data
				const currentData = this.javaisPasVu.getDataValue('ui');
				this.javaisPasVu.registerData('ui', {
					...currentData,
					...state
				});
				// Apply changes to DOM
				if (state.theme) this.applyTheme(state.theme);
				if (state.fontSize) this.applyFontSize(state.fontSize);
			}
		});
	},

	initializeBootstrap() {
		try {
			this._initDropdowns();
			this._initToasts();
			this._initOffcanvas();
			logger.debug('Bootstrap components initialized successfully');
		} catch (error) {
			logger.error('Error initializing Bootstrap components:', error);
		}
	},

	_initDropdowns() {
		const dropdownElList = document.querySelectorAll('[data-bs-toggle="dropdown"]');
		[...dropdownElList].map(el => new Dropdown(el));
	},

	_initToasts() {
		const toastElList = document.querySelectorAll('.toast');
		[...toastElList].map(el => new Toast(el));
	},

	_initOffcanvas() {
		const offcanvasElList = document.querySelectorAll('.offcanvas');
		[...offcanvasElList].map(el => new Offcanvas(el));
	},

	createModal(options = {}) {
		const modalId = `modal-${Date.now()}`;
		this.store.dispatch({
			domain: 'ui',
			type: actions.ui.SHOW_MODAL,
			payload: {
				id: modalId,
				title: options.title || '',
				body: options.body || '',
				footer: options.footer || '',
				modalClass: options.modalClass || '',
				onClose: options.onClose
			}
		});

		return {
			hide: () => {
				this.store.dispatch({
					domain: 'ui',
					type: actions.ui.HIDE_MODAL,
					payload: { id: modalId }
				});
			}
		};
	},

	_createToastElement(type, message) {
		let bgColorClass = 'text-bg-success';
		switch (type) {
			case AlertTypes.ERROR:
				bgColorClass = 'text-bg-danger';
				break;
			case AlertTypes.WARNING:
				bgColorClass = 'text-bg-warning';
				break;
			case AlertTypes.INFO:
				bgColorClass = 'text-bg-info';
				break;
		}

		const toastElement = document.createElement('div');
		toastElement.className = `toast align-items-center border-0 ${bgColorClass}`;
		toastElement.setAttribute('role', 'alert');
		toastElement.setAttribute('aria-live', 'assertive');
		toastElement.setAttribute('aria-atomic', 'true');

		toastElement.innerHTML = `
			<div class="d-flex">
				<div class="toast-body">
					${message}
				</div>
				<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
			</div>
		`;

		return toastElement;
	},

	showAlert(type, message) {
		logger.debug("Showing toast alert:", type, message);

		this.store.dispatch({
			domain: 'ui',
			type: actions.ui.SHOW_TOAST,
			payload: {
				id: `toast-${Date.now()}`,
				type,
				message,
				autohide: true,
				delay: 5000
			}
		});
	}
};