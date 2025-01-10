import { Room } from './Room.js';
import logger from '../logger.js';
import Store from '../state/store.js';

export class RoomService {
	static #instance = null;

	constructor() {
		if (RoomService.#instance) {
			return RoomService.#instance;
		}
		this._currentRoom = null;
		this._store = Store.getInstance();
		this.#initializeRoomListener();
		RoomService.#instance = this;
	}

	static getInstance() {
		return RoomService.#instance ?? new RoomService();
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

		try {
			if (this._currentRoom?.roomId === roomId) {
				// Update existing room through store
				this._store.dispatch({
					domain: 'room',
					type: 'UPDATE_ROOM_SETTINGS',
					payload: {
						roomId,
						settings: roomState.settings || {}
					}
				});
			} else {
				// Create new room
				this.destroyCurrentRoom();
				this._currentRoom = new Room(roomId);

				// Initialize room in store
				const userState = this._store.getState('user');
				this._store.dispatch({
					domain: 'room',
					type: 'CREATE_ROOM',
					payload: {
						id: roomId,
						name: roomState.name || `Room ${roomId}`,
						type: roomState.type || 'public',
						createdBy: userState.id,
						settings: roomState.settings || {}
					}
				});
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
			const roomId = this._currentRoom.roomId;
			this._currentRoom.destroy();
			this._currentRoom = null;

			// Clear room from store
			const userState = this._store.getState('user');
			this._store.dispatch({
				domain: 'room',
				type: 'LEAVE_ROOM',
				payload: {
					roomId,
					userId: userState.id
				}
			});

			logger.info("Current room destroyed");
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