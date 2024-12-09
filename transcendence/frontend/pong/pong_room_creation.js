function initializePongRoom() {
	const createRoomBtn = document.getElementById("create-room-btn");
	const alertContainer = document.getElementById("alert-container");

	if (createRoomBtn) {
		createRoomBtn.addEventListener("click", async function () {
			try {
				const response = await fetch("/pong/create-room/", {
					method: "POST",
					headers: {
						"X-CSRFToken": getCookie("csrftoken"),
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				});

				const data = await response.json();

				if (data.status === "success") {
					const roomResponse = await fetch(`/pong/room/${data.room_id}/`);
					const roomHtml = await roomResponse.text();

					document.body.innerHTML = roomHtml;
					history.pushState(null, "", `/pong/room/${data.room_id}/`);

					// Let the HTMX handlers initialize the room
				} else {
					throw new Error(data.message || "Une erreur est survenue lors de la création de la salle.");
				}
			} catch (error) {
				console.error("Error:", error);
				showAlert("error", error.message || "Une erreur est survenue lors de la création de la salle.");
			}
		});
	}

	function showAlert(type, message) {
		console.log("Showing alert:", type, message);
		if (alertContainer) {
			alertContainer.innerHTML = `
						<div class="alert alert-${type === "error" ? "danger" : "success"
				} alert-dismissible fade show" role="alert">
								${message}
								<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
						</div>
					`;
			alertContainer.style.display = "block";
		}
	}

	function getCookie(name) {
		let cookieValue = null;
		if (document.cookie && document.cookie !== "") {
			const cookies = document.cookie.split(";");
			for (let i = 0; i < cookies.length; i++) {
				const cookie = cookies[i].trim();
				if (cookie.substring(0, name.length + 1) === name + "=") {
					cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
					break;
				}
			}
		}
		return cookieValue;
	}
}

// Exécuter initializePongRoom au chargement initial de la page
document.addEventListener("DOMContentLoaded", initializePongRoom);

// Exécuter initializePongRoom chaque fois que HTMX charge du nouveau contenu
document.body.addEventListener("htmx:load", initializePongRoom);
