import logger from '../utils/logger.js';
import { ConnectionManager } from '../networking/ConnectionManager.js';

/**
 * Manages WebSocket networking for a game room, handling connection lifecycle,
 * message passing, and room state updates.
 */
export class RoomNetworkManager {
	/**
	 * @param {string} roomId - Unique identifier for the room
	 * @throws {Error} If roomId is not provided
	 */
	constructor(roomId) {
		if (!roomId) {
			logger.error('Room ID is required');
			throw new Error('Room ID is required');
		}

		this._roomId = roomId;
		this._connectionManager = new ConnectionManager();
		this._messageHandlers = new Map();
		this._isConnected = false;
		this._pendingModeChange = null;
	}

	/**
	 * Establishes WebSocket connection to the room
	 * @returns {Promise<boolean>} Success status
	 */
	async connect() {
		try {
			const connection = this._connectionManager.createConnection(
				'websocket',
				'room',
				{
					endpoint: `/ws/pong_room/${this._roomId}/`,
					options: {
						maxReconnectAttempts: 5
					}
				}
			);

			connection.on('message', (data) => this._handleMessage(data));
			connection.on('close', (event) => this._handleClose(event));
			connection.on('error', (error) => this._handleError(error));

			await connection.connect();
			this._isConnected = true;
			logger.info(`Successfully connected to room ${this._roomId}`);
			return true;
		} catch (error) {
			logger.error('Failed to establish room connection:', error);
			return false;
		}
	}

	/**
	 * Sends a message to the room
	 * @param {string} action - Message action type
	 * @param {Object} data - Message payload
	 */
	sendMessage(action, data = {}) {
		if (action === 'update_property' && data.property === 'maxPlayers') {
			const mode = data.value === 1 ? 'AI' :
				data.value === 8 ? 'TOURNAMENT' : 'CLASSIC';
			logger.info(`Converting maxPlayers=${data.value} to mode=${mode}`);

			this._pendingModeChange = { property: 'mode', value: mode };
			return;
		}

		const message = { action, ...data };
		const connection = this._connectionManager.getConnection('room');
		if (connection && connection.state.canSend) {
			connection.send(message);
		}
	}

	/**
	 * Registers a message handler
	 * @param {string} type - Message type to handle
	 * @param {Function} handler - Handler callback
	 */
	on(type, handler) {
		this._messageHandlers.set(type, handler);
	}

	/**
	 * Removes a message handler
	 * @param {string} type - Message type to remove handler for
	 */
	off(type) {
		this._messageHandlers.delete(type);
	}

	/**
	 * Checks if connected to room
	 * @returns {boolean} Connection status
	 */
	isConnected() {
		const connection = this._connectionManager.getConnection('room');
		return connection && connection.state.name === 'connected';
	}

	/**
	 * Cleans up connections and handlers
	 */
	destroy() {
		this._isConnected = false;
		this._messageHandlers.clear();
		this._connectionManager.disconnectAll();
	}

	/**
	 * Handles incoming messages and routes to registered handlers
	 * @private
	 */
	_handleMessage(data) {
		try {
			logger.debug("Received room data:", data);

			if (data.type === 'room_update' && this._pendingModeChange) {
				const { property, value } = this._pendingModeChange;
				this._pendingModeChange = null;
				this.sendMessage('update_property', { property, value });
			}

			const handler = this._messageHandlers.get(data.type);
			if (handler) {
				handler(data);
			} else {
				logger.warn('No handler found for message type:', data.type);
			}
		} catch (error) {
			logger.error('Error handling room message:', error);
		}
	}

	/**
	 * Handles WebSocket connection closure
	 * @private
	 */
	_handleClose(event) {
		const shouldRetry = this._handleConnectionError(event.code);
		if (!shouldRetry) {
			logger.warn('Room WebSocket closed');
			this._isConnected = false;
		}
	}

	/**
	 * Handles WebSocket errors
	 * @private
	 */
	_handleError(error) {
		logger.error('Room WebSocket error:', error);
		this._handleClose({ code: 1006 });
	}

	/**
	 * Maps error codes to messages and determines retry behavior
	 * @private
	 * @returns {boolean} Whether to retry connection
	 */
	_handleConnectionError(code) {
		const errorMessages = {
			4001: "Authentication failed. Please refresh the page and try again.",
			4002: "Error during connection validation. Please check your game status and try again.",
			4003: "You are not authorized to join this game.",
			4004: "Game not found. It may have been deleted.",
			1006: "Connection closed abnormally. Will retry..."
		};

		const message = errorMessages[code] || `Connection failed with code ${code}`;
		logger.error(message);

		return code === 1006;
	}
}