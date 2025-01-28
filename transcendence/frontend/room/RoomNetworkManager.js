import logger from '../logger.js';
import { BaseNetworkManager } from '../networking/NetworkingCore.js';
import Store from '../state/store.js';
import { roomActions, RoomStates } from '../state/roomState.js';
import { userActions } from '../state/userState.js';

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
	ALREADY_PLAYING: 'ALREADY_PLAYING',
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
	'game already in progress': { code: RoomErrorCodes.ALREADY_PLAYING, retryable: false },
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
	constructor(store, roomId, webSocketUrl) {
		super();
		if (!roomId) {
			logger.error('Room ID is required');
			throw new Error('Room ID is required');
		}

		this._roomId = roomId;
		this._pendingModeChange = null;
		this._store = store || Store.getInstance();
		this._resetStateInProgress = false;
		this._webSocketUrl = webSocketUrl;
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
					const endpoint = this._webSocketUrl || `/ws/pong_room/${this._roomId}/`;
					const connection = this._connectionManager.createConnection(
						'websocket',
						'room',
						{
							endpoint,
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
			type: userActions.UPDATE,
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

			// Handle property updates
			if (messageType === 'property_update') {
				if (data.property === 'mode') {
					this._store.dispatch({
						domain: 'room',
						type: roomActions.UPDATE_ROOM_MODE,
						payload: {
							mode: data.value,
							settings: getDefaultSettingsForMode(data.value)
						}
					});
				} else if (data.property === 'settings') {
					if (data.setting) {
						// Individual setting update
						this._store.dispatch({
							domain: 'room',
							type: roomActions.UPDATE_SETTINGS,
							payload: {
								[data.setting]: data.value
							}
						});
					} else if (data.value) {
						// Bulk settings update
						this._store.dispatch({
							domain: 'room',
							type: roomActions.UPDATE_SETTINGS,
							payload: data.value
						});
					}
				}
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
		logger.debug(`[RoomNetwork] Preparing to send message: ${action}`);

		if (!this._roomId) {
			logger.error('[RoomNetwork] No room ID available');
			throw new RoomError('No room ID available', RoomErrorCodes.VALIDATION_ERROR, false);
		}

		// Flatten the message structure to match backend expectations
		const messageData = {
			room_id: this._roomId,
			action,
			...data
		};

		try {
			logger.debug(`[RoomNetwork] Sending ${action} with data:`, messageData);
			const response = await super.sendRequest(action, messageData, options);
			logger.debug(`[RoomNetwork] Response received for ${action}:`, response);
			return response;
		} catch (error) {
			logger.error(`[RoomNetwork] Error sending ${action}:`, error);
			throw error;
		}
	}

	get roomId() {
		return this._roomId;
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
			1006: { message: "Connection closed abnormally. Will retry...", retryable: true },
			1000: { message: "Connection closed normally.", retryable: false, isNormal: true }
		};

		const mapping = errorMappings[code] || {
			message: `Connection failed with code ${code}`,
			retryable: false
		};

		if (!mapping.isNormal)
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
			if (event.code !== 1000) {
				logger.warn('Room WebSocket closed');
			} else {
				logger.debug('Room WebSocket closed normally');
			}
			this._isConnected = false;
		}
	}

	/**
	 * Gets current room state through WebSocket
	 * @returns {Promise<Object>} Current room state
	 */
	async getCurrentState() {
		try {
			const response = await this.sendMessage('get_state', {}, { timeout: 5000 });
			if (response?.status === 'error') {
				throw new RoomError(
					response.message || 'Failed to get room state',
					RoomErrorCodes.CONNECTION_ERROR,
					true
				);
			}
			return response.room_state;
		} catch (error) {
			throw new RoomError(
				`Failed to get room state: ${error.message}`,
				RoomErrorCodes.CONNECTION_ERROR,
				true
			);
		}
	}

	/**
	 * Resets room state with retry logic using WebSocket
	 * @returns {Promise<void>}
	 */
	async resetRoomState() {
		if (this._resetStateInProgress) {
			logger.debug('Room state reset already in progress, waiting for completion');
			return;
		}

		this._resetStateInProgress = true;
		const maxRetries = 3;
		let retryCount = 0;

		try {
			// Check current state first
			const currentState = await this.getCurrentState();
			if (currentState.state === RoomStates.LOBBY) {
				logger.info('Room already in LOBBY state, skipping reset');
				return;
			}

			while (retryCount < maxRetries) {
				try {
					const response = await this.sendMessage('update_property', {
						property: 'state',
						value: RoomStates.LOBBY
					}, { timeout: 3000 });

					if (response?.status === 'error') {
						throw new RoomError(
							response.message || 'Failed to reset room state',
							RoomErrorCodes.CONNECTION_ERROR,
							true
						);
					}

					await this.waitForRoomState(
						state => state.state === RoomStates.LOBBY,
						3000
					);

					logger.info('Room state reset successful');
					return;

				} catch (error) {
					// Don't retry if error is explicitly marked as non-retryable
					if (error instanceof RoomError && !error.isRetryable) {
						throw error;
					}

					retryCount++;
					if (retryCount >= maxRetries) {
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
		} finally {
			this._resetStateInProgress = false;
		}
	}

	/**
	 * Starts the game
	 * @returns {Promise<void>}
	 */
	async startGame() {
		logger.debug('[RoomNetwork] Attempting to start game');
		try {
			if (!this._roomId) {
				throw new RoomError('No room ID available', RoomErrorCodes.VALIDATION_ERROR, false);
			}

			const response = await this.sendMessage('start_game', {}, { timeout: 15000 });

			logger.debug(`[RoomNetwork] Start game response received: ${JSON.stringify(response)}`);

			if (response?.status === 'error') {
				const errorMapping = mapErrorMessage(response.message);
				// If the error indicates the game is already in progress, consider it a success
				if (response.message?.includes('not in LOBBY state')) {
					logger.info('[RoomNetwork] Game already in progress, considering start successful');
					return;
				}
				if (errorMapping) {
					logger.error(`[RoomNetwork] Mapped error starting game: ${response.message}, code: ${errorMapping.code}`);
					throw new RoomError(
						response.message || 'Failed to start game',
						errorMapping.code,
						errorMapping.retryable
					);
				}
				logger.error(`[RoomNetwork] Unmapped error starting game: ${response.message}`);
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

			try {
				logger.info('Waiting for game_started event');
				await this.waitForEvent('game_started', null, 5000);
			} catch (error) {
				// If we timeout waiting for game_started but had a success response,
				// check if the game is already in progress
				const roomState = await this.waitForRoomState(
					state => state.state === 'PLAYING',
					5000
				).catch(() => null);
				if (roomState) // Game is already in progress, consider it a success
					return;
				throw error;
			}
		} catch (error) {
			logger.error('Error starting game:', error);
			throw error;
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

// Factory function to create RoomNetworkManager instance
export const createRoomNetworkManager = (store, roomId, webSocketUrl) => {
	return new RoomNetworkManager(store, roomId, webSocketUrl);
};