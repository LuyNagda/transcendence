import logger from '../logger.js';
import { store, actions } from '../state/store.js';
import { RoomStates } from '../state/roomState.js';
import { connectionManager } from '../networking/ConnectionManager.js';

/**
 * Custom error types for room-specific errors
 */
class RoomError extends Error {
	constructor(message, code) {
		super(message);
		this.name = 'RoomError';
		this.code = code;
	}
}

export const RoomErrorCodes = {
	// Non-retryable errors
	INVALID_STATE: 'INVALID_STATE',
	UNAUTHORIZED: 'UNAUTHORIZED',
	ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	ALREADY_PLAYING: 'ALREADY_PLAYING',
	PLAYER_COUNT_ERROR: 'PLAYER_COUNT_ERROR',

	// Potentially retryable errors
	GAME_CREATE_ERROR: 'GAME_CREATE_ERROR',
	INVALID_RESPONSE: 'INVALID_RESPONSE'
};

/**
 * Manages room-specific connections and communication
 */
export class RoomConnectionManager {
	constructor(roomId, config = {}) {
		if (!roomId) {
			throw new Error('Room ID is required');
		}

		this._roomId = roomId;
		this._config = config;
		this._groupName = `room:${roomId}`;
		this._setupConnections();
		this._setupMessageHandlers();
	}

	/**
	 * Sets up the required connections for the room
	 * @private
	 */
	_setupConnections() {
		// Create a connection group for the room with main WebSocket and optional game WebRTC
		const connections = {
			main: {
				type: 'websocket',
				config: {
					endpoint: `/ws/pong_room/${this._roomId}/`,
					options: {
						maxReconnectAttempts: 5,
						reconnectInterval: 1000,
						connectionTimeout: 10000
					}
				}
			}
		};

		// Add game connection if specified in config
		if (this._config.enableGameConnection) {
			connections.game = {
				type: 'webrtc',
				config: this._config.rtcConfig || {}
			};
		}

		this._connections = connectionManager.createConnectionGroup(this._groupName, connections);
		this._mainConnection = this._connections.get('main');
	}

	/**
	 * Sets up message handlers for the room
	 * @private
	 */
	_setupMessageHandlers() {
		logger.debug('[RoomConnectionManager] Setting up message handlers');

		// Handle room state updates
		this._mainConnection.on('room_update', (data) => {
			logger.debug('[RoomConnectionManager] Received room update:', data);
			if (data.room_state) {
				store.dispatch({
					domain: 'room',
					type: actions.room.UPDATE_ROOM,
					payload: data.room_state
				});
			}
		});

		// Handle game started event
		this._mainConnection.on('game_started', () => {
			logger.debug('[RoomConnectionManager] Received game started event');
			store.dispatch({
				domain: 'room',
				type: actions.room.UPDATE_ROOM_STATE,
				payload: { state: RoomStates.PLAYING }
			});
		});
	}

	/**
	 * Connects to the room
	 */
	async connect() {
		return connectionManager.connectGroup(this._groupName);
	}

	/**
	 * Disconnects from the room
	 */
	disconnect() {
		connectionManager.disconnectGroup(this._groupName);
	}

	/**
	 * Gets current room state
	 */
	async getCurrentState() {
		try {
			logger.debug('[RoomConnectionManager] Getting current state for room:', this._roomId);
			const response = await this._mainConnection.sendRequest('get_state', {
				id: this._roomId
			});

			logger.debug('[RoomConnectionManager] Received state response:', response);

			if (response.status === 'success' && response.room_state) {
				store.dispatch({
					domain: 'room',
					type: actions.room.UPDATE_ROOM,
					payload: response.room_state
				});
				return response.room_state;
			}
			throw new RoomError('Invalid response format', RoomErrorCodes.INVALID_RESPONSE);
		} catch (error) {
			logger.error('[RoomConnectionManager] Failed to get room state:', error);
			throw error;
		}
	}

	/**
	 * Starts the game
	 */
	async startGame() {
		try {
			const response = await this._mainConnection.sendRequest('start_game', {
				id: this._roomId
			});

			if (response.status === 'success') {
				return response;
			}

			throw new RoomError(
				response.message || 'Failed to start game',
				RoomErrorCodes.GAME_CREATE_ERROR
			);
		} catch (error) {
			logger.error('Failed to start game:', error);
			throw error;
		}
	}

	/**
	 * Updates a room setting
	 */
	async updateSetting(setting, value) {
		try {
			const response = await this._mainConnection.sendRequest('update_setting', {
				id: this._roomId,
				setting,
				value
			});

			if (response.status !== 'success') {
				throw new RoomError(
					response.message || 'Failed to update setting',
					RoomErrorCodes.VALIDATION_ERROR
				);
			}
			return response;
		} catch (error) {
			logger.error('Failed to update setting:', error);
			throw error;
		}
	}

	/**
	 * Updates room mode
	 */
	async updateMode(mode) {
		try {
			const response = await this._mainConnection.sendRequest('update_mode', {
				id: this._roomId,
				mode
			});

			if (response.status !== 'success') {
				throw new RoomError(
					response.message || 'Failed to update mode',
					RoomErrorCodes.VALIDATION_ERROR
				);
			}
			return response;
		} catch (error) {
			logger.error('Failed to update mode:', error);
			throw error;
		}
	}

	/**
	 * Leaves the game
	 */
	async leaveGame() {
		try {
			const response = await this._mainConnection.sendRequest('leave_game', {
				id: this._roomId
			});

			if (response.status !== 'success') {
				throw new RoomError(
					response.message || 'Failed to leave game',
					RoomErrorCodes.VALIDATION_ERROR
				);
			}
			return response;
		} catch (error) {
			logger.error('Failed to leave game:', error);
			throw error;
		}
	}

	/**
	 * Gets the game connection if available
	 */
	getGameConnection() {
		return this._connections.get('game');
	}

	/**
	 * Gets the main connection
	 */
	getMainConnection() {
		return this._mainConnection;
	}

	/**
	 * Cleans up all connections and resources
	 */
	destroy() {
		connectionManager.removeConnectionGroup(this._groupName);
	}
}

// Factory function
export const createRoomConnectionManager = (roomId, config = {}) => {
	return new RoomConnectionManager(roomId, config);
};