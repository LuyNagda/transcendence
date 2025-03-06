import logger from '../logger.js';
import { store, actions } from '../state/store.js';
import { RoomStates } from '../state/roomState.js';
import { connectionManager } from '../networking/ConnectionManager.js';
import { ConnectionState } from '../networking/BaseConnection.js';

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
	UNAUTHORIZED: 4001,
	ROOM_NOT_FOUND: 4004,
	ROOM_FULL: 4003,
	AI_MODE_RESTRICTED: 4005,
	GAME_IN_PROGRESS: 4006,
	PRIVATE_ROOM_NO_INVITE: 4007,
	PLAYER_KICKED: 4008,
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	ALREADY_PLAYING: 'ALREADY_PLAYING',
	PLAYER_COUNT_ERROR: 'PLAYER_COUNT_ERROR',

	// Potentially retryable errors
	GAME_CREATE_ERROR: 'GAME_CREATE_ERROR',
	GAME_CONNECTION_ERROR: 'GAME_CONNECTION_ERROR',
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
		this._hasError = false;
		this._isInitialized = false;
		this._setupConnections();
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
						maxReconnectAttempts: 3,
						reconnectInterval: 1000,
						connectionTimeout: 10000
					}
				}
			}
		};

		this._connections = connectionManager.createConnectionGroup(this._groupName, connections);
		this._mainConnection = this._connections.get('main');

		this._setupEventHandlers();
	}

	/**
	 * Sets up event handlers for all connections
	 * @private
	 */
	_setupEventHandlers() {
		if (!this._mainConnection) return;

		this._mainConnection.on('stateChange', (state) => {
			if (state === ConnectionState.CONNECTED) {
				this._hasError = false;
			}
		});

		this._mainConnection.on('close', (event) => {
			this._handleClose(event);
		});

		this._mainConnection.on('error', (error) => {
			if (!this._hasError) {
				this._handleError(error);
			}
		});

		this._mainConnection.on('message', (data) => {
			this._handleMessage(data);
		});
	}

	/**
	 * Handles incoming messages
	 * @private
	 */
	_handleMessage(data) {
		try {
			if (data.type === 'error') {
				logger.warn('[RoomConnectionManager] Received error message:', data);
				// Set error state and disconnect, but don't trigger another error
				if (!this._hasError) {
					this._hasError = true;
					this.disconnect();
					this._mainConnection.emit('room_error', {
						code: data.code,
						message: data.message
					});
				}
				return;
			}

			if (data.type === 'room_update' && data.room_state) {
				if (!this._isInitialized) {
					this._isInitialized = true;
					logger.info('[RoomConnectionManager] Room initialized successfully');
				}
				store.dispatch({
					domain: 'room',
					type: actions.room.UPDATE_ROOM,
					payload: data.room_state
				});
				return;
			}

			if (data.type === 'settings_update') {
				logger.debug('[RoomConnectionManager] Received settings update:', data);

				if (!data.data) {
					logger.error('[RoomConnectionManager] Invalid settings update message format: missing data field');
					return;
				}

				const { room_state } = data.data;

				if (room_state) {
					logger.debug('[RoomConnectionManager] Updating room state with new settings');
					store.dispatch({
						domain: 'room',
						type: actions.room.UPDATE_ROOM,
						payload: room_state
					});
				}
				return;
			}

			if (data.type === 'game_started') {
				store.dispatch({
					domain: 'room',
					type: actions.room.UPDATE_ROOM,
					payload: {
						state: RoomStates.PLAYING,
						...data.data
					}
				});
			}
		} catch (error) {
			logger.error('[RoomConnectionManager] Error handling message:', error);
			this._handleError(new RoomError('Error processing message', 'MESSAGE_ERROR'));
		}
	}

	/**
	 * Handles connection close events
	 * @private
	 */
	_handleClose(event) {
		// Don't handle close if we already have an error
		if (this._hasError) {
			logger.debug('[RoomConnectionManager] Ignoring close event due to existing error');
			return;
		}

		if (!this._isInitialized) {
			let errorMessage;
			let errorCode = event.code;
			switch (event.code) {
				case RoomErrorCodes.UNAUTHORIZED:
					errorMessage = 'Unauthorized access to room';
					break;
				case RoomErrorCodes.ROOM_NOT_FOUND:
					errorMessage = 'Room not found';
					break;
				case RoomErrorCodes.ROOM_FULL:
					errorMessage = 'Room is full';
					break;
				case RoomErrorCodes.AI_MODE_RESTRICTED:
					errorMessage = 'Cannot join AI mode room';
					break;
				case RoomErrorCodes.GAME_IN_PROGRESS:
					errorMessage = 'Cannot join: Game in progress';
					break;
				case RoomErrorCodes.PRIVATE_ROOM_NO_INVITE:
					errorMessage = 'Cannot join private room: No invitation';
					break;
				case RoomErrorCodes.PLAYER_KICKED:
					errorMessage = 'You have been kicked from the room';
					break;
				default:
					if (event.code >= 4000) {
						errorMessage = event.reason || 'Room access denied';
					}
			}

			if (errorMessage) {
				logger.warn(`[RoomConnectionManager] Connection closed: ${errorMessage} (code: ${errorCode})`);
				this._handleError(new RoomError(errorMessage, errorCode), true);
			}
		} else {
			this._handleError(new RoomError('Connection lost', 'CONNECTION_LOST'));
		}
	}

	/**
	 * Handles errors
	 * @private
	 */
	_handleError(error, isExpected = false) {
		const logLevel = isExpected ? 'warn' : 'error';
		logger[logLevel]('[RoomConnectionManager] Room error:', error);

		if (!this._hasError) {
			this._hasError = true;
			this._isInitialized = false;

			// Only emit room_error if we have a connection and haven't already emitted
			if (this._mainConnection) {
				this._mainConnection.emit('room_error', {
					code: error.code,
					message: error.message
				});
			}
		}
	}

	/**
	 * Connects to the room
	 */
	async connect() {
		try {
			// Reset error and initialization flags
			this._hasError = false;
			this._isInitialized = false;

			// Let ConnectionManager handle the connection and reconnection logic
			const connected = await connectionManager.connectGroup(this._groupName);
			if (!connected) {
				throw new RoomError('Failed to connect to room', 'CONNECTION_ERROR');
			}

			// Wait for a short delay to ensure server has processed the connection
			await new Promise(resolve => setTimeout(resolve, 500));

			// Check if we've received any errors during connection
			if (this._hasError)
				throw new RoomError('Connection refused by server', 'CONNECTION_REFUSED');

			// Only get initial state if we haven't encountered any errors
			if (!this._hasError) {
				const roomState = await this.getCurrentState();
				if (roomState) {
					this._isInitialized = true;
					logger.info('[RoomConnectionManager] Room initialized successfully');
					return true;
				}
			}

			throw new RoomError('Failed to get initial room state', 'INITIALIZATION_ERROR');
		} catch (error) {
			// Only handle error if we haven't already
			if (!this._hasError) {
				this._handleError(error instanceof RoomError ? error : new RoomError(error.message, 'CONNECTION_ERROR'));
			}
			throw error;
		}
	}

	/**
	 * Disconnects from the room
	 */
	disconnect() {
		if (this._connections) {
			connectionManager.disconnectGroup(this._groupName);
		}
		this._isInitialized = false;
		this._hasError = true;
	}

	/**
	 * Gets current room state
	 */
	async getCurrentState() {
		// Don't attempt to get state if we have an error or aren't properly connected
		if (this._hasError || !this._mainConnection?.state?.canSend || !this._mainConnection?.state?.name === 'connected')
			return null;

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
			return null;
		}
	}


	/**
	 * Sends a request to the room
	 * @private
	 */
	async _sendRequest(action, data = {}) {
		try {
			const response = await this._mainConnection.sendRequest(action, {
				id: this._roomId,
				...data
			});

			if (response.status === 'success') {
				return response;
			}

			throw new RoomError(
				response.message || `Failed to ${action}`,
				RoomErrorCodes.VALIDATION_ERROR
			);
		} catch (error) {
			logger.error(`[RoomConnectionManager] Failed to ${action}:`, error);
			throw error;
		}
	}

	/**
	 * Room action methods
	 */

	async startGame() {
		return this._sendRequest('start_game');
	}

	async updateSetting(setting, value) {
		return this._sendRequest('update_property', {
			property: 'settings',
			setting: setting,
			value: typeof value === 'string' && !isNaN(value) ? parseInt(value, 10) : value
		});
	}

	async updateMode(mode) {
		return this._sendRequest('change_mode', { mode });
	}

	async leaveGame() {
		return this._sendRequest('leave_game');
	}

	async kickPlayer(playerId) {
		return this._sendRequest('kick_player', { player_id: playerId });
	}

	async cancelInvitation(playerId) {
		return this._sendRequest('cancel_invitation', { player_id: playerId });
	}

	// Getters for connections
	getGameConnection() {
		return this._connections.get('game');
	}

	getMainConnection() {
		return this._mainConnection;
	}

	/**
	 * Cleans up all connections and resources
	 */
	destroy() {
		this.disconnect();
		if (this._connections) {
			connectionManager.removeConnectionGroup(this._groupName);
			this._connections = null;
		}
		this._mainConnection = null;
	}
}

// Factory function
export const createRoomConnectionManager = (roomId, config = {}) => {
	return new RoomConnectionManager(roomId, config);
};