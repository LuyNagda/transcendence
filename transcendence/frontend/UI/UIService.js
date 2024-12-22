import logger from '../logger.js';

export const UIService = {
	showAlert(type, message) {
		logger.debug("Showing alert:", type, message);
		const alertContainer = document.getElementById("alert-container");

		if (!alertContainer) {
			logger.warn("Alert container not found");
			return;
		}

		const alertHtml = `
			<div class="alert alert-${type === "error" ? "danger" : "success"} alert-dismissible fade show" role="alert">
				${message}
				<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
			</div>
		`;

		alertContainer.innerHTML = alertHtml;
		alertContainer.style.display = "block";
	}
};