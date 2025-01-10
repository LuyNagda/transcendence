import { RoomAPI } from './RoomAPI.js';
import { UIService } from '../UI/UIService.js';
import { RoomService } from './RoomService.js';
import logger from '../logger.js';
import Store from '../state/store.js';
import { RoomModes, getDefaultSettingsForMode } from '../state/roomState.js';

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
			logger.debug('Room data structure:', {
				roomData: data.room_data,
				settings: data.room_data?.settings
			});

			// Fetch and update room HTML
			const roomHtml = await RoomAPI.fetchRoomHtml(data.room_id);
			document.body.innerHTML = roomHtml;

			// Get current user from store
			const userState = this._store.getState('user');
			logger.debug('Current user state:', userState);

			const initialMode = RoomModes.AI;
			const roomPayload = {
				id: data.room_id,
				name: data.room_data?.name || `Room ${data.room_id}`,
				mode: initialMode,
				type: 'game',
				status: 'active',
				members: [userState.id],
				settings: {
					...getDefaultSettingsForMode(initialMode),
					...data.room_data?.settings
				},
				createdAt: Date.now(),
				createdBy: userState.id
			};

			logger.debug('Dispatching room payload:', roomPayload);

			// Initialize room in store with proper structure
			this._store.dispatch({
				domain: 'room',
				type: 'CREATE_ROOM',
				payload: roomPayload
			});

			// Initialize room manager with the same data
			const roomManager = RoomService.getInstance();
			roomManager.initialize(roomPayload);

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