import logger from '../logger.js';
import { Modal, Dropdown, Toast, Offcanvas } from '../vendor.js';
import Store, { actions } from '../state/store.js';
import { UI_THEME, UI_FONT_SIZE, uiValidators } from '../state/uiState.js';
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

		// Initialize Bootstrap components
		this.initializeBootstrap();

		// Subscribe to store changes for UI updates
		this._subscribeToUIStateChanges();

		logger.debug('UIService initialized');
	},

	_subscribeToUIStateChanges() {
		// Subscribe to specific UI state changes
		this.store.subscribe('ui.modals', this._handleModalStateChange.bind(this));
		this.store.subscribe('ui.toasts', this._handleToastStateChange.bind(this));
		this.store.subscribe('ui.offcanvas', this._handleOffcanvasStateChange.bind(this));
	},

	_handleModalStateChange(modals) {
		Object.entries(modals || {}).forEach(([id, modalData]) => {
			const modalElement = document.getElementById(id);
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

	// UI State Getters
	getTheme() {
		return this.javaisPasVu.getState('ui')?.theme || UI_THEME.LIGHT;
	},

	getFontSize() {
		return this.javaisPasVu.getState('ui')?.fontSize || UI_FONT_SIZE.SMALL;
	},

	// UI State Actions
	updateTheme(theme) {
		this.javaisPasVu.callMethod('ui', 'updateTheme', theme);
	},

	updateFontSize(fontSize) {
		this.javaisPasVu.callMethod('ui', 'updateFontSize', fontSize);
	},

	createModal(options = {}) {
		const modalId = `modal-${Date.now()}`;
		this.javaisPasVu.callMethod('ui', 'showModal', {
			id: modalId,
			title: options.title || '',
			body: options.body || '',
			footer: options.footer || '',
			modalClass: options.modalClass || '',
			onClose: options.onClose
		});
		return {
			hide: () => this.javaisPasVu.callMethod('ui', 'hideModal', modalId)
		};
	},

	showAlert(type, message, options = {}) {
		logger.debug("Showing toast alert:", type, message);
		this.javaisPasVu.callMethod('ui', 'showToast', {
			type,
			message,
			autohide: options.autohide ?? true,
			delay: options.delay ?? 5000
		});
	}
};