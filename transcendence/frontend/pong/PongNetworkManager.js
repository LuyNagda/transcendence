import logger from '../logger.js';
import { store } from '../state/store.js';
import { connectionManager } from '../networking/ConnectionManager.js';

/**
 * Manages networking for a Pong game session using WebRTC for multiplayer games
 * and WebSocket for signaling and local/AI games. Handles connection establishment,
 * message passing, and cleanup between players.
 */
export class PongNetworkManager {
	/**
	 * @param {string} gameId - The game ID
	 * @param {Object} currentUser - The current user object
	 * @param {boolean} isHost - Whether this instance is the host
	 * @param {boolean} isLocalGame - Whether this is a local/AI game
	 */
	constructor(gameId, currentUser, isHost, isLocalGame = false) {
		this._gameId = gameId;
		this._currentUser = currentUser;
		this._isHost = isHost;
		this._isLocalGame = isLocalGame;
		this._messageHandlers = new Map();
		this._gameFinished = false;
		this._connectionGroupName = `pong:${gameId}`;

		// Only set up RTC config for multiplayer games
		if (!isLocalGame) {
			const config = store.getState('config');
			this.rtcConfig = {
				iceServers: [
					{
						urls: config.rtc?.stunUrl || 'stun:127.0.0.1:3478'
					},
					{
						urls: [
							config.rtc?.turnUrl || 'turn:127.0.0.1:3478'
						],
						username: config.rtc?.turnUsername || 'username',
						credential: config.rtc?.turnPassword || 'password'
					}
				],
				iceTransportPolicy: 'all',
				iceCandidatePoolSize: 0,
				bundlePolicy: 'balanced',
				rtcpMuxPolicy: 'require',
				iceServersPolicy: 'all'
			};
		}
	}

	/**
	 * Establishes WebSocket and optionally WebRTC connections between players
	 * @returns {Promise<boolean>} Success status
	 */
	async connect() {
		try {
			// Clean up any existing connections first
			this._cleanup();

			// Create connection group based on game type
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

			// Only add WebRTC connection for multiplayer games
			if (!this._isLocalGame) {
				connections.game = {
					type: 'webrtc',
					config: {
						rtcConfig: {
							...this.rtcConfig,
							isHost: this._isHost
						}
					}
				};
			}

			// Create and store connections
			const group = connectionManager.createConnectionGroup(this._connectionGroupName, connections);

			// Set up WebSocket handlers
			const wsConnection = group.get('signaling');
			wsConnection.on('message', (data) => this._handleWebSocketMessage(data));
			wsConnection.on('close', () => this._handleDisconnect());
			wsConnection.on('error', (error) => this._handleError(error));

			// Connect to WebSocket first
			await connectionManager.getConnectionGroup(this._connectionGroupName).get('signaling').connect();

			// Set up and connect WebRTC for multiplayer games
			if (!this._isLocalGame) {
				const rtcConnection = group.get('game');
				rtcConnection.on('message', (data) => this._handleGameMessage(data));
				rtcConnection.on('iceCandidate', (candidate) => this._handleIceCandidate(candidate));
				rtcConnection.on('close', () => this._handleDisconnect());
				rtcConnection.on('error', (error) => this._handleError(error));
				rtcConnection.on('signal', (signal) => {
					logger.debug(`${this._isHost ? 'Host' : 'Guest'}: Sending WebRTC signal:`, signal);
					wsConnection.send({
						type: 'webrtc_signal',
						signal: signal
					});
				});
				await connectionManager.getConnectionGroup(this._connectionGroupName).get('game').connect();
			}

			return true;
		} catch (error) {
			logger.error('Failed to establish connection:', error);
			this._cleanup();
			return false;
		}
	}

	/**
	 * Cleans up existing connections before creating new ones
	 * @private
	 */
	_cleanup() {
		try {
			const existingGroup = connectionManager.getConnectionGroup(this._connectionGroupName);
			if (existingGroup) {
				logger.debug('Cleaning up existing connections before reconnecting');
				connectionManager.removeConnectionGroup(this._connectionGroupName);
			}
		} catch (error) {
			logger.warn('Error during connection cleanup:', error);
		}
	}

	/**
	 * Waits for guest to connect within timeout period
	 * @param {number} timeout - Maximum wait time in ms
	 * @returns {Promise<boolean>} Connection success
	 */
	async waitForGuestConnection(timeout = 20000) {
		if (!this._isHost)
			throw new Error('Only host can wait for guest connection');

		if (this._isLocalGame) // For local/AI games, resolve immediately
			return Promise.resolve(true);

		return new Promise((resolve, reject) => {
			const group = connectionManager.getConnectionGroup(this._connectionGroupName);
			if (!group) {
				reject(new Error('Connection group not found'));
				return;
			}

			const rtcConnection = group.get('game');
			const startTime = Date.now();

			const checkConnection = () => {
				if (rtcConnection.state.name === 'connected') {
					clearInterval(checkInterval);
					clearTimeout(timeoutId);
					resolve(true);
				} else if (Date.now() - startTime >= timeout) {
					clearInterval(checkInterval);
					reject(new Error('Guest connection timeout'));
				}
			};

			const checkInterval = setInterval(checkConnection, 100);
			const timeoutId = setTimeout(() => {
				clearInterval(checkInterval);
				reject(new Error('Guest connection timeout'));
			}, timeout);
		});
	}

	/**
	 * Waits for host to connect within timeout period
	 * @param {number} timeout - Maximum wait time in ms
	 * @returns {Promise<boolean>} Connection success
	 */
	async waitForHostConnection(timeout = 20000) {
		if (this._isHost)
			throw new Error('Only guest can wait for host connection');

		if (this._isLocalGame)
			return Promise.reject(new Error('Cannot wait for host in local game'));

		return new Promise((resolve, reject) => {
			const group = connectionManager.getConnectionGroup(this._connectionGroupName);
			if (!group) {
				reject(new Error('Connection group not found'));
				return;
			}

			const rtcConnection = group.get('game');
			const startTime = Date.now();

			const checkConnection = () => {
				if (rtcConnection.state.name === 'connected') {
					clearInterval(checkInterval);
					clearTimeout(timeoutId);
					resolve(true);
				} else if (Date.now() - startTime >= timeout) {
					clearInterval(checkInterval);
					reject(new Error('Host connection timeout'));
				}
			};

			const checkInterval = setInterval(checkConnection, 100);
			const timeoutId = setTimeout(() => {
				clearInterval(checkInterval);
				reject(new Error('Host connection timeout'));
			}, timeout);
		});
	}

	/**
	 * Sends a game message
	 * @param {Object} message - Message to send
	 * @returns {boolean} Send success
	 */
	sendGameMessage(message) {
		const group = connectionManager.getConnectionGroup(this._connectionGroupName);
		if (!group) return false;

		if (this._isLocalGame) {
			// For local/AI games, process message locally
			const handler = this._messageHandlers.get(message.type);
			if (handler) {
				// Process message in next tick to simulate network delay
				setTimeout(() => {
					try {
						handler(message);
					} catch (error) {
						logger.error('Error handling local game message:', error);
					}
				}, 0);
			}
			return true;
		} else {
			// For multiplayer games, send via WebRTC
			const rtcConnection = group.get('game');
			if (rtcConnection && rtcConnection.state.canSend) {
				try {
					rtcConnection.send(message);
					return true;
				} catch (error) {
					logger.warn('Failed to send game message:', error);
					return false;
				}
			}
		}
		return false;
	}

	/**
	 * Sends game state based on connection type
	 * @param {Object} state - Current game state
	 * @returns {boolean} Send success
	 */
	sendGameState(state) {
		const group = connectionManager.getConnectionGroup(this._connectionGroupName);
		if (!group) return false;

		try {
			// Send full game state (ball/paddle positions) via WebRTC in multiplayer only
			if (!this._isLocalGame) {
				const rtcConnection = group.get('game');
				if (rtcConnection && rtcConnection.state.canSend) {
					const rtcState = {
						type: 'gameState',
						state: {
							ball: state.ball ? {
								x: state.ball.x,
								y: state.ball.y,
								dx: state.ball.dx,
								dy: state.ball.dy,
								width: state.ball.width,
								height: state.ball.height,
								resetting: state.ball.resetting
							} : null,
							leftPaddle: state.leftPaddle ? {
								x: state.leftPaddle.x,
								y: state.leftPaddle.y,
								width: state.leftPaddle.width,
								height: state.leftPaddle.height,
								dy: state.leftPaddle.dy
							} : null,
							rightPaddle: state.rightPaddle ? {
								x: state.rightPaddle.x,
								y: state.rightPaddle.y,
								width: state.rightPaddle.width,
								height: state.rightPaddle.height,
								dy: state.rightPaddle.dy
							} : null
						}
					};
					logger.debug('Sending WebRTC state update:', rtcState);
					rtcConnection.send(rtcState);
				}
			}

			return true;
		} catch (error) {
			logger.error('Failed to send game state:', error);
			return false;
		}
	}

	/**
	 * Registers handler for specific game message type
	 * @param {string} type - Message type to handle
	 * @param {Function} handler - Handler function
	 */
	onGameMessage(type, handler) {
		this._messageHandlers.set(type, handler);
	}

	/**
	 * Checks if connection is established
	 * @returns {boolean} Connection status
	 */
	checkConnection() {
		const group = connectionManager.getConnectionGroup(this._connectionGroupName);
		if (!group) return false;

		const wsConnection = group.get('signaling');

		if (this._isLocalGame) {
			// For local/AI games, only check WebSocket connection
			return wsConnection && wsConnection.state.name === 'connected';
		} else {
			// For multiplayer games, check both connections
			const rtcConnection = group.get('game');
			return rtcConnection &&
				wsConnection &&
				rtcConnection.state.name === 'connected' &&
				wsConnection.state.name === 'connected';
		}
	}

	/**
	 * Waits for connection(s) to be established
	 * @param {number} timeout - Maximum wait time in ms
	 * @returns {Promise<boolean>} Connection success
	 */
	async waitForConnection(timeout = 20000) {
		// For local/AI games, resolve immediately
		if (this._isLocalGame) {
			return Promise.resolve(true);
		}

		return new Promise((resolve, reject) => {
			const startTime = Date.now();
			const checkInterval = setInterval(() => {
				if (this.checkConnection()) {
					clearInterval(checkInterval);
					clearTimeout(timeoutId);
					resolve(true);
				} else if (Date.now() - startTime >= timeout) {
					clearInterval(checkInterval);
					reject(new Error('Connection timeout'));
				}
			}, 100);

			const timeoutId = setTimeout(() => {
				clearInterval(checkInterval);
				reject(new Error('Connection timeout'));
			}, timeout);
		});
	}

	/**
	 * Gets the WebSocket connection from the connection group
	 * @returns {Object|null} WebSocket connection or null if not found
	 */
	getWebSocketConnection() {
		const group = connectionManager.getConnectionGroup(this._connectionGroupName);
		if (!group) return null;
		return group.get('signaling');
	}

	/**
	 * Cleans up all connections and resets state
	 */
	destroy() {
		this._gameFinished = true;
		this._messageHandlers.clear();
		this._cleanup();
	}

	/**
	 * Handles incoming WebSocket messages
	 * @private
	 */
	_handleWebSocketMessage(data) {
		try {
			switch (data.type) {
				case 'webrtc_signal':
					if (this._gameFinished) return;
					this._handleWebRTCSignal(data.signal);
					break;

				case 'player_disconnected':
					if (!this._gameFinished) {
						this._handleDisconnect();
					}
					break;

				case 'game_state':
					if (!this._gameFinished) {
						this._handleGameState(data);
					}
					break;

				case 'player_ready':
					if (!this._gameFinished) {
						this._handlePlayerReady(data);
					}
					break;

				default:
					logger.debug('Unhandled WebSocket message type:', data.type);
					break;
			}
		} catch (error) {
			logger.error('Error handling WebSocket message:', error);
		}
	}

	/**
	 * Handles WebRTC signaling messages
	 * @private
	 */
	async _handleWebRTCSignal(signal) {
		try {
			const group = connectionManager.getConnectionGroup(this._connectionGroupName);
			if (!group) {
				throw new Error('Connection group not found');
			}

			const rtcConnection = group.get('game');
			if (!rtcConnection) {
				throw new Error('WebRTC connection not found');
			}

			if (signal.type === 'offer') {
				logger.debug('Guest: Received offer from host');
				await rtcConnection._peer.setRemoteDescription(new RTCSessionDescription({
					type: 'offer',
					sdp: signal.sdp
				}));
				const answer = await rtcConnection._peer.createAnswer();
				await rtcConnection._peer.setLocalDescription(answer);
				// Send answer back through WebSocket
				const wsConnection = group.get('signaling');
				wsConnection.send({
					type: 'webrtc_signal',
					signal: {
						type: 'answer',
						sdp: answer.sdp
					}
				});
			} else if (signal.type === 'answer') {
				logger.debug('Host: Received answer from guest');
				await rtcConnection._peer.setRemoteDescription(new RTCSessionDescription({
					type: 'answer',
					sdp: signal.sdp
				}));
			} else if (signal.candidate) {
				logger.debug(`${this._isHost ? 'Host' : 'Guest'}: Received ICE candidate`);
				if (rtcConnection._peer.remoteDescription) {
					await rtcConnection._peer.addIceCandidate(new RTCIceCandidate(signal.candidate))
						.catch(error => logger.error('Error adding ICE candidate:', error));
				} else {
					rtcConnection._pendingCandidates.push(signal.candidate);
				}
			}
		} catch (error) {
			logger.error('Error handling WebRTC signal:', error);
			this._handleError(error);
		}
	}

	/**
	 * Routes game messages to registered handlers
	 * @private
	 */
	_handleGameMessage(data) {
		try {
			const handler = this._messageHandlers.get(data.type);
			if (handler) {
				handler(data);
			}
		} catch (error) {
			logger.error('Error handling game message:', error);
		}
	}

	/**
	 * Handles ICE candidate exchange
	 * @private
	 */
	_handleIceCandidate(candidate) {
		const wsConnection = connectionManager.getConnectionGroup(this._connectionGroupName).get('signaling');
		wsConnection.send({
			type: 'webrtc_signal',
			signal: {
				type: 'candidate',
				candidate: candidate
			}
		});
	}

	/**
	 * Handles connection loss
	 * @private
	 */
	_handleDisconnect() {
		if (this._gameFinished) return;

		logger.warn('Connection lost, cleaning up');
		this.destroy();
	}

	/**
	 * Routes game state updates to registered handlers
	 * @private
	 */
	_handleGameState(data) {
		const handler = this._messageHandlers.get('gameState');
		if (handler) {
			handler(data);
		}
	}

	/**
	 * Routes player ready events to registered handlers
	 * @private
	 */
	_handlePlayerReady(data) {
		const handler = this._messageHandlers.get('playerReady');
		if (handler) {
			handler(data);
		}
	}

	/**
	 * Sends game completion notification through both WebSocket and WebRTC channels
	 * @param {Object} scores - Final game scores
	 * @returns {Promise<boolean>} Success status
	 */
	async sendGameComplete(scores) {
		try {
			const group = connectionManager.getConnectionGroup(this._connectionGroupName);
			if (!group) return false;

			logger.info('Sending game completion notification');
			const message = {
				type: 'game_complete',
				scores: scores
			};

			// Send through WebSocket first (for server)
			const wsConnection = group.get('signaling');
			if (wsConnection && wsConnection.state.canSend) {
				logger.debug('Sending game completion through WebSocket:', message);
				wsConnection.send(message);
			}

			// Then through WebRTC (for peer)
			if (!this._isLocalGame) {
				const rtcConnection = group.get('game');
				if (rtcConnection && rtcConnection.state.canSend) {
					logger.debug('Sending game completion through WebRTC:', message);
					rtcConnection.send(message);
				}
			}

			// Send room state update
			await this.sendRequest('update_room_state', {
				state: 'LOBBY'
			});

			return true;
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
			const wsConnection = this.getWebSocketConnection();
			if (!wsConnection || !wsConnection.state.canSend) {
				throw new Error('WebSocket connection not available');
			}

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
	 * Sends score update through WebSocket
	 * @param {Object} scores - Score object with left/right or player1/player2 scores
	 * @returns {Promise<boolean>} Success status
	 */
	async sendScoreUpdate(scores) {
		try {
			const wsConnection = this.getWebSocketConnection();
			if (!wsConnection || !wsConnection.state.canSend) {
				throw new Error('WebSocket connection not available');
			}

			const scoreUpdate = {
				type: 'update_scores',
				scores: {
					player1: scores.left || scores.player1,
					player2: scores.right || scores.player2
				}
			};
			logger.debug('Sending score update:', scoreUpdate);
			wsConnection.send(scoreUpdate);
			return true;
		} catch (error) {
			logger.error('Failed to send score update:', error);
			return false;
		}
	}
}