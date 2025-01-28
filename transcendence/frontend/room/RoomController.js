import { RoomAPI } from './RoomAPI.js';
import { UIService } from '../UI/UIService.js';
import logger from '../logger.js';
import Store from '../state/store.js';
import { RoomModes, RoomStates, roomActions } from '../state/roomState.js';

/**
 * Controller responsible for handling room-related actions and coordinating between services
 */
export class RoomController {
	constructor(store, roomAPI, uiService) {
		this._store = store || Store.getInstance();
		this._roomAPI = roomAPI || RoomAPI;
		this._uiService = uiService || UIService;
		this._initializeEventHandlers();
		logger.info('Room controller initialized successfully');
	}

	_initializeEventHandlers() {
		document.addEventListener('click', async (event) => {
			if (event.target?.dataset?.action === 'create-room') {
				event.preventDefault();
				await this.handleCreateRoom();
			}
		});
	}

	async handleCreateRoom() {
		const button = document.getElementById('create-room-btn');
		try {
			if (button) {
				button.disabled = true;
				button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating...';
			}

			const data = await this._roomAPI.createRoom();
			logger.info('Room created successfully:', {
				roomData: data.room_data,
				settings: data.room_data?.settings
			});

			const userState = this._store.getState('user');
			logger.debug('Current user state:', userState);

			if (!userState || !userState.id || !userState.username) {
				throw new Error('Invalid user state');
			}

			const roomPayload = {
				id: data.room_id,
				createdBy: {
					id: userState.id,
					username: userState.username
				}
			};

			logger.debug('Dispatching room payload:', roomPayload);

			this._store.dispatch({
				domain: 'room',
				type: roomActions.CREATE_ROOM,
				payload: roomPayload
			});

			await this._updateRoomUI(data.room_id, userState.id, RoomModes.AI);

		} catch (error) {
			logger.error("Failed to create room:", error);
			this._handleCreateRoomError(error);
		} finally {
			if (button) {
				button.disabled = false;
				button.innerHTML = 'Start a Game';
			}
		}
	}

	async _updateRoomUI(roomId, userId, mode) {
		window.history.pushState({}, '', `/pong/room/${roomId}/`);
		const roomHtml = await this._roomAPI.fetchRoomHtml(roomId);

		const pongContainer = document.getElementById('pong-container');
		if (!pongContainer)
			throw new Error('Pong container element not found');

		pongContainer.innerHTML = roomHtml;

		const pongRoom = document.getElementById('pong-room');
		if (!pongRoom)
			throw new Error('Room element not found after initialization');

		// Dispatch room state update
		this._store.dispatch({
			domain: 'room',
			type: roomActions.UPDATE_ROOM_STATE,
			payload: {
				roomId,
				state: RoomStates.LOBBY
			}
		});
	}

	_handleCreateRoomError(error) {
		let errorMessage = "Failed to create room. ";

		if (error.message.includes("HTTP error")) {
			errorMessage += "Server error occurred. Please try again later.";
		} else if (error.message.includes("CSRF")) {
			errorMessage += "Authentication error. Please refresh the page.";
		} else {
			errorMessage += error.message || "Please try again.";
		}

		this._uiService.showAlert("error", errorMessage);
	}
}

// Factory function to create RoomController instance
export const createRoomController = (store, roomAPI, uiService) => {
	return new RoomController(store, roomAPI, uiService);
}; 