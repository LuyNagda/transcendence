import { Room } from './Room.js';
import logger from '../logger.js';
import Store from '../state/store.js';

/**
 * Service responsible for managing room lifecycle and coordination between components
 */
export class RoomService {
	static _currentRoom = null;
	static _store = Store.getInstance();

	/**
	 * Initialize a new room or destroy existing one
	 * @param {Object} roomData - The room initialization data
	 */
	static initialize(roomData) {
		if (!roomData) {
			RoomService.destroyCurrentRoom();
			RoomService.#updateDOMAttribute('None');
			return;
		}

		logger.info("Initializing room:", roomData);

		// Cascading roomId lookup
		const roomId = roomData.id ||
			roomData.roomId ||
			roomData._networkManager?._roomId ||
			roomData._gameManager?._roomId ||
			roomData._stateManager?._roomId;

		if (!roomId) {
			logger.error("Invalid room data - no room ID found:", roomData);
			return;
		}

		try {
			if (RoomService._currentRoom?.roomId === roomId) {
				// Room exists, let state manager handle the update
				RoomService._currentRoom.updateState(roomData);
			} else {
				// Create new room
				RoomService.destroyCurrentRoom();
				RoomService._currentRoom = new Room(roomId);
			}

			// Update store with current room state
			RoomService._store.dispatch({
				domain: 'room',
				type: 'UPDATE_ROOM',
				payload: {
					...roomData,
					id: roomId
				}
			});

			RoomService.#updateDOMAttribute(roomId);
		} catch (error) {
			logger.error("Failed to initialize room:", error);
			RoomService.destroyCurrentRoom();
		}
	}

	/**
	 * Update or clear the current room
	 * @param {Object|string} roomData - The new room data or 'None' to clear
	 */
	static updateRoom(roomData) {
		if (!roomData || !RoomService._currentRoom) {
			return;
		}

		try {
			RoomService._currentRoom.updateState(roomData);

			// Update store with new room state
			RoomService._store.dispatch({
				domain: 'room',
				type: 'UPDATE_ROOM',
				payload: {
					...roomData,
					id: RoomService._currentRoom.roomId
				}
			});
		} catch (error) {
			logger.error("Failed to update room:", error);
		}
	}

	/**
	 * Get the current active room instance
	 * @returns {Room|null} The current room instance
	 */
	static getCurrentRoom() {
		return RoomService._currentRoom;
	}

	/**
	 * Destroy the current room instance
	 */
	static destroyCurrentRoom() {
		if (RoomService._currentRoom) {
			RoomService._currentRoom.destroy();
			RoomService._currentRoom = null;

			// Reset room state in store
			RoomService._store.dispatch({
				domain: 'room',
				type: 'LEAVE_ROOM',
				payload: {
					userId: RoomService._store.getState('user').id
				}
			});
		}
	}

	/**
	 * @private
	 * Update the DOM data attribute for room
	 * @param {string} value - The value to set
	 */
	static #updateDOMAttribute(value) {
		document.body.setAttribute('data-room', value);
	}

	/**
	 * Initialize the event listener for room updates
	 */
	static initializeRoomListener() {
		logger.debug('Initializing room listener');
		document.body.addEventListener('updateRoom', (event) => {
			logger.debug('Received updateRoom event:', event);
			RoomService.updateRoom(event.detail.room);
		});
	}
}

// Initialize room listener when module is loaded
RoomService.initializeRoomListener();

// Export the static class
export default RoomService; 