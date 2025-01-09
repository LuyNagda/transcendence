import logger from '../logger.js';
import { Toast } from '../vendor.js';

export const AlertTypes = {
	SUCCESS: 'success',
	ERROR: 'error',
	WARNING: 'warning',
	INFO: 'info'
};

export const UIService = {
	showAlert(type, message) {
		logger.debug("Showing toast alert:", type, message);
		const toastContainer = document.getElementById("toast-container");

		if (!toastContainer) {
			logger.warn("Toast container not found");
			return;
		}

		// Get background color class based on type
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

		// Create toast element
		const toastElement = document.createElement('div');
		toastElement.className = `toast align-items-center border-0 ${bgColorClass}`;
		toastElement.setAttribute('role', 'alert');
		toastElement.setAttribute('aria-live', 'assertive');
		toastElement.setAttribute('aria-atomic', 'true');

		// Create toast content
		toastElement.innerHTML = `
			<div class="d-flex">
				<div class="toast-body">
					${message}
				</div>
				<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
			</div>
		`;

		// Add to container
		toastContainer.appendChild(toastElement);

		// Initialize Bootstrap toast
		const toast = new Toast(toastElement, {
			autohide: true,
			delay: 5000
		});

		// Handle focus/hover to prevent auto-hide
		let timeoutId;
		const startAutoHideTimer = () => {
			timeoutId = setTimeout(() => toast.hide(), 5000);
		};

		toastElement.addEventListener('mouseover', () => {
			clearTimeout(timeoutId);
		});

		toastElement.addEventListener('mouseleave', () => {
			startAutoHideTimer();
		});

		toastElement.addEventListener('focusin', () => {
			clearTimeout(timeoutId);
		});

		toastElement.addEventListener('focusout', () => {
			startAutoHideTimer();
		});

		// Clean up when hidden
		toastElement.addEventListener('hidden.bs.toast', () => {
			toastElement.remove();
		});

		// Show the toast
		toast.show();
		startAutoHideTimer();
	}
};