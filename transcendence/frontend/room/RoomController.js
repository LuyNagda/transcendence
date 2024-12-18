import { RoomAPI } from './RoomAPI.js';
import { UIService } from '../utils/UIService.js';
import { RoomManager } from './RoomManager.js';
import logger from '../utils/logger.js';

export class RoomController {
	constructor() {
		this.createRoomBtn = document.getElementById("create-room-btn");
		this.bindEvents();
	}

	bindEvents() {
		if (this.createRoomBtn) {
			this.createRoomBtn.addEventListener("click", () => this.handleCreateRoom());
		}
	}

	async handleCreateRoom() {
		try {
			// Disable button and show loading state
			this.setLoading(true);

			// Create room
			const data = await RoomAPI.createRoom();
			logger.info('Room created successfully:', data);

			// Fetch and update room HTML
			const roomHtml = await RoomAPI.fetchRoomHtml(data.room_id);
			document.body.innerHTML = roomHtml;

			// Initialize room manager with default game settings
			const roomManager = RoomManager.getInstance();
			roomManager.initialize({
				id: data.room_id,
				...data.room_data,
				gameSettings: { // Frontend-only game settings
					paddleSpeed: 5, // Default paddle speed
				}
			});

			// Update URL
			history.pushState(null, "", `/pong/room/${data.room_id}/`);

		} catch (error) {
			logger.error("Failed to create room:", error);
			let errorMessage = "Failed to create room. ";

			if (error.message.includes("HTTP error")) {
				errorMessage += "Server error occurred. Please try again later.";
			} else if (error.message.includes("CSRF")) {
				errorMessage += "Authentication error. Please refresh the page.";
			} else {
				errorMessage += error.message || "Please try again.";
			}

			UIService.showAlert("error", errorMessage);
		} finally {
			this.setLoading(false);
		}
	}

	setLoading(isLoading) {
		if (this.createRoomBtn) {
			this.createRoomBtn.disabled = isLoading;
			this.createRoomBtn.innerHTML = isLoading ?
				'<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating...' :
				'Start a Game';
		}
	}
} 