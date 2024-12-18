export class UIService {
	static showAlert(type, message) {
		console.log("Showing alert:", type, message);
		const alertContainer = document.getElementById("alert-container");

		if (!alertContainer) {
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
} 