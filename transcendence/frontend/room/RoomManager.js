import { Room } from './Room.js';
import logger from '../utils/logger.js';

export class RoomManager {
	static #instance = null;

	constructor() {
		if (RoomManager.#instance) {
			return RoomManager.#instance;
		}
		this._currentRoom = null;
		this.#initializeRoomListener();
		RoomManager.#instance = this;
	}

	static getInstance() {
		return RoomManager.#instance ?? new RoomManager();
	}

	/**
	 * Initialize or update a room with new state
	 * @param {Object} roomState - The room state to initialize/update with
	 */
	initialize(roomState) {
		if (!roomState) {
			this.destroyCurrentRoom();
			this.#updateDOMAttribute('None');
			return;
		}

		logger.info("Initializing room with state:", roomState);
		if (!roomState.id && !roomState.roomId) {
			logger.error("Invalid room state:", roomState);
			return;
		}

		const roomId = roomState.id || roomState.roomId;
		const currentUser = roomState.currentUser || this.getCurrentUserFromDOM();

		try {
			if (this._currentRoom?.roomId === roomId) {
				// Update existing room
				this._currentRoom.updateFromState(roomState);
			} else {
				// Create new room
				this.destroyCurrentRoom();
				this._currentRoom = new Room(roomId, currentUser);
				this._currentRoom.updateFromState(roomState);
			}
			this.#updateDOMAttribute(JSON.stringify(roomState));
			logger.info("Room initialized successfully");
		} catch (error) {
			logger.error("Failed to initialize room:", error);
			this.destroyCurrentRoom();
			this.#updateDOMAttribute('None');
		}
	}

	/**
	 * Update the current room state
	 * @param {Object|string} roomData - The new room data or 'None' to clear
	 */
	updateRoom(roomData) {
		if (roomData === 'None' || !roomData || Object.keys(roomData).length === 0) {
			this.destroyCurrentRoom();
			this.#updateDOMAttribute('None');
			logger.debug('Room data removed');
		} else {
			this.initialize(roomData);
			logger.debug('Room data updated:', roomData);
		}
	}

	/**
	 * Get the current active room instance
	 * @returns {Room|null} The current room instance
	 */
	getCurrentRoom() {
		return this._currentRoom;
	}

	/**
	 * Destroy the current room instance
	 */
	destroyCurrentRoom() {
		if (this._currentRoom) {
			this._currentRoom.destroy();
			this._currentRoom = null;
			logger.info("Current room destroyed");
		}
	}

	/**
	 * Get current user data from DOM
	 * @private
	 * @returns {Object|null} The current user data
	 */
	getCurrentUserFromDOM() {
		try {
			const userDataElement = document.getElementById("current-user-data");
			return userDataElement ? JSON.parse(userDataElement.textContent) : null;
		} catch (error) {
			logger.error("Failed to get current user from DOM:", error);
			return null;
		}
	}

	/**
	 * @private
	 * Update the DOM data attribute for room
	 * @param {string} value - The value to set
	 */
	#updateDOMAttribute(value) {
		document.body.setAttribute('data-room', value);
	}

	/**
	 * @private
	 * Initialize the event listener for room updates
	 */
	#initializeRoomListener() {
		logger.debug('Initializing room listener');
		document.body.addEventListener('updateRoom', (event) => {
			logger.debug('Received updateRoom event:', event);
			this.updateRoom(event.detail.room);
		});
	}
} 