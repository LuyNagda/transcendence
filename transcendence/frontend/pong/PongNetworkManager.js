import logger from '../logger.js';
import { ConnectionState } from '../networking/BaseConnection.js'
import { connectionManager } from '../networking/ConnectionManager.js';
import { store } from '../state/store.js';
import { gameActions } from '../state/gameState.js';

export class PongNetworkManager {
	/**
	 * Creates a new NetworkSystem instance
	 * @param {EventEmitter} eventEmitter - The event emitter for communication
	 * @param {string} gameId - The ID of the game
	 * @param {Object} currentUser - The current user
	 * @param {boolean} isHost - Whether this client is the host
	 * @param {boolean} isLocalGame - Whether this is a local/AI game
	 */
	constructor(eventEmitter, gameId, currentUser, isHost, isLocalGame = false, isAiGame = false) {
		this._eventEmitter = eventEmitter;
		this._gameId = gameId;
		this._currentUser = currentUser;
		this._isHost = isHost;
		this._isLocalGame = isLocalGame;
		this._isAiGame = isAiGame;
		this._connectionState = ConnectionState.DISCONNECTED.name;
		this._connections = null;
		this._messageQueue = [];
		this._gameFinished = false;
		this._connectionGroupName = `pong-${this._gameId}`;
	}

	/**
	 * Initialize the network system
	 * @returns {boolean} - Whether initialization was successful
	 */
	initialize() {
		logger.info('Initializing network system');

		// Message type mapping to normalize snake_case (server) to camelCase (local events)
		this._messageTypeMap = {
			'game_state': 'gameState',
			'update_scores': 'scoreUpdate',
			'game_complete': 'gameComplete',
			'player_ready': 'playerReady',
			'player_disconnected': 'playerDisconnected'
		};

		this._messageHandlers = {
			// Physics and game state updates
			'physicsUpdate': (message) => {
				this._eventEmitter.emit('remotePhysicsUpdate', message.state);
			},
			'gameState': (message) => {
				this._eventEmitter.emit('gameState', message);
			},

			// Score and game completion
			'scoreUpdate': (message) => {
				logger.debug('Received score update:', message.scores);
				this._eventEmitter.emit('scoreUpdate', message.scores);

				if (!this._isHost) {
					store.dispatch({
						domain: 'game',
						type: gameActions.SET_SCORES,
						payload: message.scores
					});
				}
			},
			'gameComplete': (message) => {
				this._eventEmitter.emit('gameComplete', message.scores);
			},

			// Player input
			'paddleMove': (message) => {
				const inputData = {
					direction: message.direction || 0,
					intensity: 1.0
				};
				this._eventEmitter.emit('remoteInput', inputData);
			},
			'paddleStop': (message) => {
				const inputData = {
					direction: 0,
					intensity: 0
				};
				this._eventEmitter.emit('remoteInput', inputData);
			},

			// Connection events
			'playerReady': (message) => {
				this._eventEmitter.emit('playerReady', message);
			},
			'playerDisconnected': (message) => {
				this._eventEmitter.emit('playerDisconnected', message);
				this._handleDisconnect();
			},
		};

		// Bind methods
		this._handleMessage = this._handleMessage.bind(this);
		this._handleStateChange = this._handleStateChange.bind(this);
		this._handleWebSocketMessage = this._handleWebSocketMessage.bind(this);
		this._handleGameMessage = this._handleGameMessage.bind(this);
		this._handleDisconnect = this._handleDisconnect.bind(this);

		return true;
	}

	/**
	 * Connect to the network
	 * @returns {Promise<boolean>} - Whether connection was successful
	 */
	async connect() {
		try {
			if (this._connectionState !== ConnectionState.DISCONNECTED.name) {
				logger.warn(`Cannot connect in state: ${this._connectionState}`);
				return false;
			}

			this._setConnectionState(ConnectionState.CONNECTING.name);
			this.destroy();

			const connections = {
				signaling: {
					type: 'websocket',
					config: {
						endpoint: `/ws/pong_game/${this._gameId}/`,
						options: {
							maxReconnectAttempts: 5
						}
					}
				}
			};

			if (!this._isLocalGame) {
				connections.gameplay = {
					type: 'webrtc',
					config: {
						isHost: this._isHost
					}
				};
			}

			this._connections = connectionManager.createConnectionGroup(this._connectionGroupName, connections);

			// Set up WebSocket handlers
			const signalingConnection = this._connections.get('signaling');
			signalingConnection.on('message', this._handleWebSocketMessage);
			signalingConnection.on('stateChange', this._handleStateChange);
			signalingConnection.on('close', this._handleDisconnect);
			signalingConnection.on('error', (error) => this._handleError(error));

			// Connect to signaling server
			await signalingConnection.connect();
			this._setConnectionState(ConnectionState.SIGNALING.name);

			// For local games, we're connected after WebSocket is established
			if (this._isLocalGame)
				this._setConnectionState(ConnectionState.CONNECTED.name);

			// Set up and connect WebRTC for non-local multiplayer games
			if (!this._isLocalGame) {
				const gameplayConnection = this._connections.get('gameplay');
				gameplayConnection.on('message', this._handleGameMessage);
				gameplayConnection.on('stateChange', this._handleStateChange);
				gameplayConnection.on('close', this._handleDisconnect);
				gameplayConnection.on('error', (error) => this._handleError(error));

				// Set up ICE-related event handlers
				gameplayConnection.on('iceTimeout', () => {
					logger.warn('ICE connection timeout detected');
					this._eventEmitter.emit('networkWarning', {
						type: 'iceTimeout',
						message: 'Connection taking longer than expected'
					});
				});

				gameplayConnection.on('iceConnectionStateChange', (state) => {
					logger.debug(`ICE connection state: ${state}`);
					if (state === 'failed') {
						this._eventEmitter.emit('networkWarning', {
							type: 'iceFailed',
							message: 'Connection failed, attempting recovery'
						});
					}
				});

				// Connect WebRTC for gameplay
				await gameplayConnection.connect();
			}

			this._processMessageQueue();
			return true;
		} catch (error) {
			logger.error('Error connecting to network:', error);
			this._setConnectionState(ConnectionState.ERROR.name);
			return false;
		}
	}

	/**
	 * Disconnect from the network
	 */
	disconnect() {
		logger.info('Disconnecting from network');
		this._gameFinished = true;
		this.destroy();
		this._setConnectionState(ConnectionState.DISCONNECTED.name);
	}

	/**
	 * Send a game message
	 * @param {Object} message - The message to send
	 * @param {boolean} reliable - Whether the message needs reliable delivery
	 * @returns {boolean} - Whether the message was sent
	 */
	sendGameMessage(message, reliable = true) {
		// Add timestamp to message
		const messageWithTimestamp = {
			...message,
			timestamp: Date.now()
		};

		if (this._isLocalGame && !reliable) return true;

		// If not connected, queue the message
		if (this._connectionState !== ConnectionState.CONNECTED.name) {
			if (reliable) {
				this._messageQueue.push(messageWithTimestamp);
				logger.debug('Message queued for later sending');
			}
			return false;
		}

		// Try to send via WebRTC for non-reliable messages
		if (!reliable && this._connections) {
			const gameplayConnection = this._connections.get('gameplay');
			if (gameplayConnection && gameplayConnection.state.canSend) {
				gameplayConnection.send(messageWithTimestamp);
				return true;
			}
		}

		// Fall back to WebSocket for reliable messages or if WebRTC is not available
		if (this._connections) {
			const signalingConnection = this._connections.get('signaling');
			if (signalingConnection && signalingConnection.state.canSend) {
				signalingConnection.send(messageWithTimestamp);
				return true;
			}
		}

		// If we can't send now, queue reliable messages
		if (reliable) {
			this._messageQueue.push(messageWithTimestamp);
			logger.debug('Message queued for later sending');
		}

		return false;
	}

	/**
	 * Send physics state update
	 * @param {Object} state - The physics state
	 * @returns {boolean} - Whether the state was sent
	 */
	sendPhysicsUpdate(state) {
		return this.sendGameMessage({
			type: 'physicsUpdate',
			state
		}, false);
	}

	/**
	 * Send paddle input
	 * @param {number} direction - The movement direction (-1 for up, 0 for stop, 1 for down)
	 * @param {number} intensity - The movement intensity (0-1)
	 * @returns {boolean} - Whether the input was sent
	 */
	sendPaddleInput(direction, intensity = 1.0) {
		return this.sendGameMessage({
			type: direction === 0 ? 'paddleStop' : 'paddleMove',
			direction: direction,
			intensity: intensity
		}, false);
	}

	/**
	 * Send game state with full details
	 * @param {Object} state - The game state
	 * @returns {boolean} - Whether the state was sent
	 */
	sendGameState(state) {
		if (!this._connections) return false;

		try {
			// Only send full game state via WebRTC in multiplayer games
			if (!this._isLocalGame) {
				const gameplayConnection = this._connections.get('gameplay');
				if (gameplayConnection && gameplayConnection.state.canSend) {
					gameplayConnection.send({
						type: 'gameState',
						state: {
							ball: {
								x: state.ball.x,
								y: state.ball.y,
								dx: state.ball.dx,
								dy: state.ball.dy,
								width: state.ball.width,
								height: state.ball.height,
							},
							leftPaddle: {
								x: state.leftPaddle.x,
								y: state.leftPaddle.y,
								width: state.leftPaddle.width,
								height: state.leftPaddle.height,
								dy: state.leftPaddle.dy
							},
							rightPaddle: {
								x: state.rightPaddle.x,
								y: state.rightPaddle.y,
								width: state.rightPaddle.width,
								height: state.rightPaddle.height,
								dy: state.rightPaddle.dy
							}
						}
					});
				}
			}
			return true;
		} catch (error) {
			logger.error('Failed to send game state:', error);
			return false;
		}
	}

	/**
	 * Send score update
	 * @param {Object} scores - The scores
	 * @returns {boolean} - Whether the scores were sent
	 */
	sendScoreUpdate(scores) {
		let success = true;

		// Send score update to other player in P2P games
		if (!this._isLocalGame) {
			// Score updates are important and need reliable transport for P2P gameplay
			const gameplayConnection = this._connections?.get('gameplay');
			if (gameplayConnection && gameplayConnection.state.canSend) {
				success = gameplayConnection.send({
					type: 'scoreUpdate',
					scores
				});
			}
		}

		// Send through WebSocket for server-side tracking
		this.sendRequest('update_scores', {
			scores: {
				left: scores.left,
				right: scores.right
			}
		});

		return success;
	}

	/**
	 * Send game complete notification
	 * @param {Object} scores - The final scores
	 * @returns {Promise<boolean>} - Whether the notification was sent
	 */
	async sendGameComplete(scores) {
		try {
			const signalingConnection = this._connections.get('signaling');

			await this.sendRequest('game_complete', { scores: scores });

			if (this._isLocalGame) {
				logger.info('Local game complete notification:', scores);

				// Even for local/AI games, still send the WebSocket message to reset room state
				if (signalingConnection && signalingConnection.state.canSend) {
					logger.debug('Sending game_complete for AI game to reset room state');
					signalingConnection.send({
						type: 'game_complete',
						scores: scores
					});
					return true;
				} else {
					logger.warn('Could not send AI game completion - WebSocket connection unavailable');
					return false;
				}
			} else {
				// P2P game handling
				if (signalingConnection && signalingConnection.state.canSend) {
					logger.debug('Sending game_complete for P2P game');
					signalingConnection.send({
						type: 'game_complete',
						scores: scores
					});
					return true;
				} else {
					logger.warn('Could not send P2P game completion - WebSocket connection unavailable');
					return false;
				}
			}
		} catch (error) {
			logger.error('Failed to send game completion:', error);
			return false;
		}
	}

	/**
	 * Sends a request through WebSocket
	 * @param {string} type - Request type
	 * @param {Object} data - Request data
	 * @returns {Promise<boolean>} Success status
	 */
	async sendRequest(type, data) {
		try {
			const wsConnection = this._connections.get('signaling');
			if (!wsConnection || !wsConnection.state.canSend) {
				if (this._isLocalGame) {
					logger.info(`Local game: would send ${type} request to server:`, data);
					return true;
				}
				throw new Error('WebSocket connection not available');
			}

			logger.debug(`Sending ${type} request to server:`, data);
			wsConnection.send({
				type: type,
				...data
			});
			return true;
		} catch (error) {
			logger.error(`Failed to send ${type} request:`, error);
			return false;
		}
	}

	/**
	 * Register an event handler for network-specific events
	 * @param {string} event - The event name
	 * @param {Function} callback - The callback function
	 * @returns {Function} - Function to remove the handler
	 */
	on(event, callback) {
		// Use the external event emitter directly
		return this._eventEmitter.on(event, callback);
	}

	/**
	 * Remove an event handler
	 * @param {string} event - The event name
	 * @param {Function} callback - The callback function
	 */
	off(event, callback) {
		this._eventEmitter.off(event, callback);
	}

	/**
	 * Handle incoming messages, normalizing message types
	 * @private
	 * @param {Object} message - The message
	 */
	_handleMessage(message) {
		// Normalize message type from snake_case to camelCase if necessary
		const normalizedType = this._messageTypeMap[message.type] || message.type;
		const handler = this._messageHandlers[normalizedType];

		if (handler) {
			try {
				handler(message);
			} catch (error) {
				logger.error(`Error in message handler for ${normalizedType}:`, error);
			}
		} else {
			// Forward unhandled messages directly to the event emitter
			this._eventEmitter.emit('message', message);
			this._eventEmitter.emit(normalizedType, message);
		}
	}

	/**
	 * Handle incoming WebSocket messages
	 * @private
	 * @param {Object} data - The message
	 */
	_handleWebSocketMessage(data) {
		try {
			switch (data.type) {
				case 'webrtc_signal':
					if (!this._isLocalGame)
						connectionManager.handleWebRTCSignal(this._connectionGroupName, data.signal);
					break;

				case 'player_disconnected':
					if (!this._gameFinished)
						this._handleDisconnect();
					break;

				default:
					// Use the unified message handler for all other message types
					this._handleMessage(data);
			}
		} catch (error) {
			logger.error('Error handling WebSocket message:', error);
		}
	}

	/**
	 * Handle WebRTC game messages
	 * @private
	 * @param {Object} data - The message
	 */
	_handleGameMessage(data) {
		try {
			this._handleMessage(data);
		} catch (error) {
			logger.error('Error handling game message:', error);
		}
	}

	/**
	 * Handle connection state changes
	 * @private
	 * @param {Object} state - The new state
	 */
	_handleStateChange(state) {
		logger.info(`Connection state changed: ${state.name}`);

		// For local games, we only need the WebSocket connection
		if (this._isLocalGame) {
			const signalingConnection = this._connections?.get('signaling');
			if (signalingConnection && signalingConnection.state.name === 'connected') {
				this._setConnectionState(ConnectionState.CONNECTED.name);
				this._processMessageQueue();
			} else if (signalingConnection && signalingConnection.state.name === 'error') {
				this._setConnectionState(ConnectionState.ERROR.name);
			}
			return;
		}

		// For multiplayer games, check both connections
		if (this._connections) {
			const signalingConnection = this._connections.get('signaling');
			const gameplayConnection = this._connections.get('gameplay');

			if (signalingConnection.state.name === 'connected') {
				if (gameplayConnection.state.name === 'connected') {
					this._setConnectionState(ConnectionState.CONNECTED.name);
					this._processMessageQueue();
				} else if (this._connectionState !== ConnectionState.SIGNALING.name) {
					this._setConnectionState(ConnectionState.SIGNALING.name);
				}
			} else if (signalingConnection.state.name === 'error' || gameplayConnection.state.name === 'error') {
				this._setConnectionState(ConnectionState.ERROR.name);
			}
		}
	}

	/**
	 * Handle connection errors
	 * @private
	 * @param {Error} error - The error
	 */
	_handleError(error) {
		logger.error('Network error:', error);
		this._setConnectionState(ConnectionState.ERROR.name);
		this._eventEmitter.emit('networkError', { error });
	}

	/**
	 * Handle disconnection
	 * @private
	 */
	_handleDisconnect() {
		if (this._gameFinished) return;

		logger.warn('Connection lost, cleaning up');
		this._eventEmitter.emit('networkDisconnect');
		this._setConnectionState(ConnectionState.DISCONNECTED.name);
	}

	/**
	 * Set the connection state
	 * @private
	 * @param {string} state - The new state
	 */
	_setConnectionState(state) {
		if (this._connectionState === state) return;

		logger.info(`Network connection state changing: ${this._connectionState} -> ${state}`);
		this._connectionState = state;

		// Emit state change event directly to the event emitter
		this._eventEmitter.emit('networkStateChange', { state });
	}

	/**
	 * Process the message queue
	 * @private
	 */
	_processMessageQueue() {
		if (this._messageQueue.length === 0) return;

		logger.info(`Processing ${this._messageQueue.length} queued messages`);

		// Process all queued messages
		while (this._messageQueue.length > 0) {
			const message = this._messageQueue.shift();
			this.sendGameMessage(message, true);
		}
	}

	/**
	 * Wait until the connection state becomes CONNECTED
	 * @param {number} timeout - Maximum wait time in ms
	 * @returns {Promise<boolean>} - Returns true when connected, false when timed out
	 */
	async waitUntilConnected(timeout = 30000) {
		logger.info('Waiting for connection to be established');

		// If already connected, resolve immediately
		if (this._connectionState === ConnectionState.CONNECTED.name) {
			logger.debug('Already connected, resolving immediately');
			return true;
		}

		return new Promise((resolve, reject) => {
			// Set timeout for connection
			const timeoutId = setTimeout(() => {
				this._eventEmitter.off('networkStateChange', stateChangeHandler);
				logger.warn('Timeout waiting for connection');
				resolve(false); // Return false instead of rejecting on timeout
			}, timeout);

			// Handler for state change events
			const stateChangeHandler = (event) => {
				if (event.state === ConnectionState.CONNECTED.name) {
					clearTimeout(timeoutId);
					this._eventEmitter.off('networkStateChange', stateChangeHandler);
					logger.info('Connection established successfully');
					resolve(true);
				} else if (event.state === ConnectionState.ERROR.name) {
					clearTimeout(timeoutId);
					this._eventEmitter.off('networkStateChange', stateChangeHandler);
					reject(new Error('Connection failed with error'));
				}
			};

			// Register state change handler
			this._eventEmitter.on('networkStateChange', stateChangeHandler);

			// Start connection if not already connecting
			if (this._connectionState === ConnectionState.DISCONNECTED.name) {
				logger.debug('Not connected, initiating connection');
				this.connect().catch(error => {
					clearTimeout(timeoutId);
					this._eventEmitter.off('networkStateChange', stateChangeHandler);
					reject(error);
				});
			}
		});
	}

	/**
	 * Check if the connection is established
	 * @returns {boolean} - Whether the connection is established
	 */
	checkConnection() {
		if (!this._connections) return false;

		const signalingConnection = this._connections.get('signaling');
		if (!signalingConnection || signalingConnection.state.name !== 'connected') {
			return false;
		}

		// For local games, we only need the WebSocket connection
		if (this._isLocalGame) {
			return true;
		}

		// For multiplayer games, check both connections
		const gameplayConnection = this._connections.get('gameplay');
		return gameplayConnection && gameplayConnection.state.name === 'connected';
	}

	destroy() {
		try {
			this._gameFinished = true;
			this._messageQueue = [];
			if (this._connections) {
				logger.debug('Cleaning up existing connections');
				connectionManager.disconnectGroup(this._connectionGroupName);
				connectionManager.removeConnectionGroup(this._connectionGroupName);
				this._connections = null;
			}
		} catch (error) {
			logger.warn('Error during PongNetworkManager destroy:', error);
		}
	}
}
