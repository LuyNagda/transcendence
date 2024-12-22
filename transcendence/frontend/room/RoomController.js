import { RoomAPI } from './RoomAPI.js';
import { UIService } from '../UI/UIService.js';
import { RoomManager } from './RoomManager.js';
import logger from '../logger.js';
import Store from '../state/store.js';

export class RoomController {
	constructor() {
		this.createRoomBtn = document.getElementById("create-room-btn");
		this._store = Store.getInstance();
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

			// Get current user from store
			const userState = this._store.getState('user');

			// Initialize room in store
			this._store.dispatch({
				domain: 'room',
				type: 'CREATE_ROOM',
				payload: {
					id: data.room_id,
					name: data.room_data?.name || `Room ${data.room_id}`,
					type: data.room_data?.type || 'public',
					createdBy: userState.id,
					settings: {
						...data.room_data?.settings,
						paddleSpeed: 5 // Default paddle speed
					}
				}
			});

			// Initialize room manager
			const roomManager = RoomManager.getInstance();
			roomManager.initialize({
				id: data.room_id,
				...data.room_data
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
			this.createRoomBtn.textContent = isLoading ? "Creating..." : "Create Room";
		}
	}
} 