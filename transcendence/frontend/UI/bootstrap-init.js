import {
	Modal,
	Dropdown,
	Toast,
	Offcanvas
} from '../vendor.js';

import logger from '../logger.js';

// Initialize all toasts
function initToasts() {
	const toastElList = document.querySelectorAll('.toast');
	[...toastElList].map(el => new Toast(el));
}

// Initialize all offcanvas elements
function initOffcanvas() {
	const offcanvasElList = document.querySelectorAll('.offcanvas');
	[...offcanvasElList].map(el => new Offcanvas(el));
}

// Utility function to create and show a toast
export function showToast(message, options = {}) {
	const toastContainer = document.getElementById('toast-container') || createToastContainer();
	const toastElement = document.createElement('div');
	toastElement.className = 'toast';
	toastElement.setAttribute('role', 'alert');
	toastElement.setAttribute('aria-live', 'assertive');
	toastElement.setAttribute('aria-atomic', 'true');

	toastElement.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">${options.title || 'Notification'}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;

	toastContainer.appendChild(toastElement);
	const toast = new Toast(toastElement, options);
	toast.show();
	return toast;
}

// Utility function to create a modal programmatically
export function createModal(options = {}) {
	const modalElement = document.createElement('div');
	modalElement.className = 'modal fade';
	modalElement.setAttribute('tabindex', '-1');

	modalElement.innerHTML = `
        <div class="modal-dialog ${options.modalClass || ''}">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${options.title || ''}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    ${options.body || ''}
                </div>
                ${options.footer ? `
                    <div class="modal-footer">
                        ${options.footer}
                    </div>
                ` : ''}
            </div>
        </div>
    `;

	document.body.appendChild(modalElement);
	const modal = new Modal(modalElement, options);

	// Clean up on hide
	modalElement.addEventListener('hidden.bs.modal', () => {
		document.body.removeChild(modalElement);
	});

	return modal;
}

// Helper function to create toast container if it doesn't exist
function createToastContainer() {
	const container = document.createElement('div');
	container.id = 'toast-container';
	container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
	document.body.appendChild(container);
	return container;
}

// Initialize all Bootstrap components
export function initializeBootstrap() {
	try {
		initToasts();
		initOffcanvas();
		logger.info('Bootstrap components initialized successfully');
	} catch (error) {
		logger.error('Error initializing Bootstrap components:', error);
	}
}

// Export individual component classes for direct usage
export {
	Modal,
	Dropdown,
	Toast,
	Offcanvas
};
