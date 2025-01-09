import logger from '../logger.js';
import { BaseNetworkManager } from '../networking/NetworkingCore.js';
import Store from '../state/store.js';

/**
 * Custom error types for room-specific errors
 */
class RoomError extends Error {
	constructor(message, code, isRetryable = true) {
		super(message);
		this.name = 'RoomError';
		this.code = code;
		this.isRetryable = isRetryable;
	}
}

export const RoomErrorCodes = {
	// Non-retryable errors
	INVALID_STATE: 'INVALID_STATE',
	UNAUTHORIZED: 'UNAUTHORIZED',
	ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	GAME_IN_PROGRESS: 'GAME_IN_PROGRESS',
	PLAYER_COUNT_ERROR: 'PLAYER_COUNT_ERROR',

	// Potentially retryable errors
	CONNECTION_ERROR: 'CONNECTION_ERROR',
	TIMEOUT: 'TIMEOUT',
	GAME_CREATE_ERROR: 'GAME_CREATE_ERROR',
	INVALID_RESPONSE: 'INVALID_RESPONSE'
};

// Map backend error messages to our error codes
const ERROR_MESSAGE_MAPPING = {
	'not in lobby state': { code: RoomErrorCodes.INVALID_STATE, retryable: false },
	'failed to create game': { code: RoomErrorCodes.GAME_CREATE_ERROR, retryable: false },
	'room not found': { code: RoomErrorCodes.ROOM_NOT_FOUND, retryable: false },
	'not authorized': { code: RoomErrorCodes.UNAUTHORIZED, retryable: false },
	'invalid player count': { code: RoomErrorCodes.PLAYER_COUNT_ERROR, retryable: false },
	'game already in progress': { code: RoomErrorCodes.GAME_IN_PROGRESS, retryable: false },
	'validation error': { code: RoomErrorCodes.VALIDATION_ERROR, retryable: false }
};

/**
 * Maps a backend error message to our error type
 * @private
 */
function mapErrorMessage(message) {
	if (!message) return null;

	const lowerMessage = message.toLowerCase();
	for (const [key, value] of Object.entries(ERROR_MESSAGE_MAPPING)) {
		if (lowerMessage.includes(key)) {
			return value;
		}
	}
	return null;
}

/**
 * Manages WebSocket networking for a game room, handling connection lifecycle,
 * message passing, and room state updates.
 */
export class RoomNetworkManager extends BaseNetworkManager {
	/**
	 * @param {string} roomId - Unique identifier for the room
	 * @throws {Error} If roomId is not provided
	 */
	constructor(roomId) {
		super();
		if (!roomId) {
			logger.error('Room ID is required');
			throw new Error('Room ID is required');
		}

		this._roomId = roomId;
		this._pendingModeChange = null;
		this._store = Store.getInstance();
	}

	/**
	 * Establishes WebSocket connection to the room
	 * @returns {Promise<boolean>} Success status
	 */
	async connect() {
		try {
			// Create new connection manager if needed
			if (!this._connectionManager) {
				this._connectionManager = new ConnectionManager('room');
			}

			const maxRetries = 3;
			let retryCount = 0;
			let connected = false;

			while (!connected && retryCount < maxRetries) {
				try {
					const connection = this._connectionManager.createConnection(
						'websocket',
						'room',
						{
							endpoint: `/ws/pong_room/${this._roomId}/`,
							options: {
								maxReconnectAttempts: 5,
								reconnectInterval: 1000,
								connectionTimeout: 10000
							}
						}
					);

					connection.on('message', (data) => this._handleMessage(data));
					connection.on('close', (event) => this._handleClose(event));
					connection.on('error', (error) => this._handleError(error));

					await connection.connect();
					this._isConnected = true;
					connected = true;
					logger.info(`Successfully connected to room ${this._roomId}`);
				} catch (error) {
					retryCount++;
					if (retryCount >= maxRetries) {
						throw error;
					}
					logger.warn(`Retry ${retryCount}/${maxRetries} to connect to room`);
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}

			return true;
		} catch (error) {
			logger.error('Failed to establish room connection:', error);
			return false;
		}
	}

	/**
	 * Updates user state in the store
	 * @private
	 */
	_updateUserState(userData) {
		if (!userData || !userData.id) return;

		this._store.dispatch({
			domain: 'user',
			type: 'UPDATE_USER',
			payload: {
				id: userData.id,
				username: userData.username,
				status: 'online',  // Users in room are always online
				blocked: false
			}
		});
	}

	/**
	 * Processes room state and updates user data
	 * @private
	 */
	_processRoomState(roomState) {
		if (!roomState) return;

		// Update owner data
		if (roomState.owner) {
			this._updateUserState(roomState.owner);
		}

		// Update players data
		if (Array.isArray(roomState.players)) {
			roomState.players.forEach(player => {
				if (player && typeof player === 'object') {
					this._updateUserState(player);
				}
			});
		}

		// Update pending invitations data
		if (Array.isArray(roomState.pendingInvitations)) {
			roomState.pendingInvitations.forEach(user => {
				if (user && typeof user === 'object') {
					this._updateUserState(user);
				}
			});
		}

		return roomState;
	}

	/**
	 * Handles incoming messages and routes to registered handlers
	 * @private
	 */
	_handleMessage(data) {
		try {
			const messageType = data.type || data.action;

			// Process room state updates for user data
			if (messageType === 'room_update' && data.room_state) {
				this._processRoomState(data.room_state);
			}

			if (messageType === 'room_update' && this._pendingModeChange) {
				const { property, value } = this._pendingModeChange;
				this._pendingModeChange = null;
				this.sendMessage('update_property', { property, value })
					.catch(error => logger.error('Error updating mode:', error));
			}

			// Let base class handle message routing and promises
			super._handleMessage(data);
		} catch (error) {
			logger.error('Error handling room message:', error);
		}
	}

	/**
	 * Sends a message to the room and waits for response
	 * @param {string} action - Message action type
	 * @param {Object} data - Message payload
	 * @param {Object} options - Additional options (timeout, etc)
	 * @returns {Promise} Promise that resolves with the response
	 */
	async sendMessage(action, data = {}, options = {}) {
		if (!this._isConnected) {
			logger.warn('Attempting to reconnect before sending message');
			const connected = await this.connect();
			if (!connected) {
				throw new Error('Failed to establish connection');
			}
		}

		if (action === 'update_property' && data.property === 'maxPlayers') {
			const mode = data.value === 1 ? 'AI' :
				data.value === 8 ? 'TOURNAMENT' : 'CLASSIC';
			logger.info(`Converting maxPlayers=${data.value} to mode=${mode}`);

			this._pendingModeChange = { property: 'mode', value: mode };
			return { status: 'success' };
		}

		// Remove any type/action field from data to avoid confusion
		const { type, action: _, ...cleanData } = data;
		return this.sendRequest(action, cleanData, options);
	}

	/**
	 * Waits for a specific room state condition
	 * @param {Function} predicate - Function that returns true when desired state is reached
	 * @param {number} timeout - Maximum time to wait in milliseconds
	 * @returns {Promise} Promise that resolves when condition is met
	 */
	waitForRoomState(predicate, timeout = 10000) {
		return new Promise((resolve, reject) => {
			let isResolved = false;
			const timeoutId = setTimeout(() => {
				if (!isResolved) {
					isResolved = true;
					this.off('room_update', handler);
					reject(new RoomError(`Timeout waiting for room state after ${timeout}ms`, RoomErrorCodes.TIMEOUT));
				}
			}, timeout);

			const handler = (data) => {
				if (isResolved || !data.room_state) {
					return; // Ignore if already resolved or invalid data
				}

				if (predicate(data.room_state)) {
					isResolved = true;
					clearTimeout(timeoutId);
					this.off('room_update', handler);
					resolve(data.room_state);
				}
			};

			// Clean up existing handlers for this event type
			this.off('room_update');
			this.on('room_update', handler);
		});
	}

	/**
	 * Waits for a specific event to occur
	 * @param {string} eventType - Event type to wait for
	 * @param {Function} predicate - Optional function to validate the event data
	 * @param {number} timeout - Timeout in milliseconds
	 * @returns {Promise} Promise that resolves with the event data
	 */
	waitForEvent(eventType, predicate = null, timeout = 15000) {
		return new Promise((resolve, reject) => {
			let isResolved = false;
			const timeoutId = setTimeout(() => {
				if (!isResolved) {
					isResolved = true;
					this.off(eventType, eventHandler);
					reject(new RoomError(`Event ${eventType} timeout after ${timeout}ms`, RoomErrorCodes.TIMEOUT));
				}
			}, timeout);

			const eventHandler = (data) => {
				if (isResolved) {
					return; // Ignore if already resolved
				}

				if (!predicate || predicate(data)) {
					isResolved = true;
					clearTimeout(timeoutId);
					this.off(eventType, eventHandler);
					resolve(data);
				}
			};

			// Clean up existing handlers for this event type
			this.off(eventType);
			this.on(eventType, eventHandler);
		});
	}

	_getMainConnection() {
		return this._connectionManager.getConnection('room');
	}

	/**
	 * Maps error codes to messages and determines retry behavior
	 * @private
	 * @returns {boolean} Whether to retry connection
	 */
	_handleConnectionError(code) {
		const errorMappings = {
			4001: { message: "Authentication failed. Please refresh the page and try again.", retryable: false },
			4002: { message: "Error during connection validation. Please check your game status and try again.", retryable: false },
			4003: { message: "You are not authorized to join this game.", retryable: false },
			4004: { message: "Game not found. It may have been deleted.", retryable: false },
			1006: { message: "Connection closed abnormally. Will retry...", retryable: true }
		};

		const mapping = errorMappings[code] || {
			message: `Connection failed with code ${code}`,
			retryable: false
		};

		logger.error(mapping.message);
		return mapping.retryable;
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
	 * Resets room state with retry logic
	 * @returns {Promise<void>}
	 */
	async resetRoomState() {
		const maxRetries = 3;
		let retryCount = 0;

		while (retryCount < maxRetries) {
			try {
				// First update backend and wait for response
				const response = await this.sendMessage('update_property', {
					property: 'state',
					value: 'LOBBY'
				}, { timeout: 15000 });

				// Check for error response
				if (response?.status === 'error') {
					const errorMapping = mapErrorMessage(response.message);
					if (errorMapping) {
						throw new RoomError(
							response.message || 'Failed to update room state',
							errorMapping.code,
							errorMapping.retryable
						);
					}
				}

				if (!response || response.status !== 'success') {
					throw new RoomError(
						response?.message || 'Failed to update room state',
						RoomErrorCodes.INVALID_RESPONSE,
						true
					);
				}

				// Wait for room state to be updated to LOBBY
				await this.waitForRoomState(
					roomState => roomState.state === 'LOBBY',
					15000
				);

				return; // Success, exit the retry loop
			} catch (error) {
				// Don't retry if error is explicitly marked as non-retryable
				if (error instanceof RoomError && !error.isRetryable) {
					throw error;
				}

				retryCount++;
				if (retryCount >= maxRetries) {
					if (error instanceof RoomError) {
						throw error;
					}
					throw new RoomError(
						`Failed to reset room state after ${maxRetries} attempts: ${error.message}`,
						RoomErrorCodes.CONNECTION_ERROR,
						true
					);
				}
				logger.warn(`Retry ${retryCount}/${maxRetries} to reset room state`);
				await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
			}
		}
	}

	/**
	 * Starts the game with retry logic
	 * @returns {Promise<void>}
	 */
	async startGame() {
		const maxRetries = 3;
		let retryCount = 0;
		let lastError = null;

		while (retryCount < maxRetries) {
			try {
				// Send start game request
				const response = await this.sendMessage('start_game', {}, { timeout: 15000 });

				// Check for error response
				if (response?.status === 'error') {
					const errorMapping = mapErrorMessage(response.message);
					if (errorMapping) {
						throw new RoomError(
							response.message || 'Failed to start game',
							errorMapping.code,
							errorMapping.retryable
						);
					}
					// Default to game create error if no specific mapping
					throw new RoomError(
						response.message || 'Failed to start game',
						RoomErrorCodes.GAME_CREATE_ERROR,
						true
					);
				}

				if (!response || response.status !== 'success') {
					throw new RoomError(
						'Invalid response from server',
						RoomErrorCodes.INVALID_RESPONSE,
						true
					);
				}

				// Wait for game_started event
				await this.waitForEvent('game_started', null, 15000);
				return; // Success, exit the retry loop
			} catch (error) {
				lastError = error;
				// Don't retry if error is explicitly marked as non-retryable
				if (error instanceof RoomError && !error.isRetryable) {
					throw error;
				}

				retryCount++;
				if (retryCount >= maxRetries) {
					if (error instanceof RoomError) {
						throw error;
					}
					throw new RoomError(
						`Failed to start game after ${maxRetries} attempts: ${lastError.message}`,
						RoomErrorCodes.CONNECTION_ERROR,
						true
					);
				}
				logger.warn(`Retry ${retryCount}/${maxRetries} to start game. Error: ${error.message}`);
				await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
			}
		}
	}

	/**
	 * Retries an async operation with exponential backoff
	 * @private
	 * @param {Function} operation - Async operation to retry
	 * @param {number} maxRetries - Maximum number of retry attempts
	 * @param {number} baseDelay - Base delay in milliseconds
	 * @returns {Promise<*>} Result of the operation
	 */
	async _retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
		let retryCount = 0;

		while (retryCount < maxRetries) {
			try {
				return await operation();
			} catch (error) {
				retryCount++;
				if (retryCount >= maxRetries) {
					throw error;
				}
				const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 5000);
				logger.warn(`Retry ${retryCount}/${maxRetries} after ${delay}ms`);
				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
	}
}