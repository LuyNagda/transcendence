import logger from '../utils/logger.js';
import { ConnectionManager } from '../networking/ConnectionManager.js';

/**
 * Default WebRTC configuration for peer connections
 * Uses Google's public STUN server and a TURN server for NAT traversal
 */
const RTC_CONFIG = {
	iceServers: [
		{
			urls: 'stun:stun.l.google.com:19302'
		},
		{
			urls: [
				'turn:global.relay.metered.ca:80',
				'turn:global.relay.metered.ca:443'
			],
			username: 'f948504c4c25ad6a49a104c3',
			credential: 'ACHpbN3JhGSSvUAz'
		}
	],
	iceTransportPolicy: 'all',
	iceCandidatePoolSize: 0,
	bundlePolicy: 'balanced',
	rtcpMuxPolicy: 'require',
	iceServersPolicy: 'all'
};

/**
 * Manages networking for a Pong game session using WebRTC for game state
 * and WebSocket for signaling. Handles connection establishment, message passing,
 * and cleanup between host and guest players.
 */
export class PongNetworkManager {
	/**
	 * @param {string} gameId - Unique identifier for the game session
	 * @param {Object} currentUser - Currently logged in user
	 * @param {boolean} isHost - Whether this instance is the host
	 */
	constructor(gameId, currentUser, isHost) {
		this._gameId = gameId;
		this._currentUser = currentUser;
		this._isHost = isHost;
		this._connectionManager = new ConnectionManager();
		this._messageHandlers = new Map();
		this._isConnected = false;
		this._gameFinished = false;
		this._pendingCandidates = [];
		this._hasRemoteDescription = false;
	}

	/**
	 * Establishes WebSocket and WebRTC connections between players
	 * @returns {Promise<boolean>} Success status
	 */
	async connect() {
		try {
			// Create connection group for Pong game
			const connections = {
				signaling: {
					type: 'websocket',
					config: {
						endpoint: `/ws/pong_game/${this._gameId}/`,
						options: {
							maxReconnectAttempts: 5
						}
					}
				},
				game: {
					type: 'webrtc',
					config: {
						rtcConfig: {
							...RTC_CONFIG,
							isHost: this._isHost
						}
					}
				}
			};

			// Create and store connections
			const group = this._connectionManager.createConnectionGroup('pong', connections);

			// Set up WebSocket handlers
			const wsConnection = group.get('signaling');
			wsConnection.on('message', (data) => this._handleWebSocketMessage(data));
			wsConnection.on('close', () => this._handleDisconnect());
			wsConnection.on('error', (error) => this._handleError(error));

			// Set up WebRTC handlers
			const rtcConnection = group.get('game');
			rtcConnection.on('message', (data) => this._handleGameMessage(data));
			rtcConnection.on('iceCandidate', (candidate) => this._handleIceCandidate(candidate));
			rtcConnection.on('close', () => this._handleDisconnect());
			rtcConnection.on('error', (error) => this._handleError(error));

			// Connect to WebSocket first
			await wsConnection.connect();

			// Initialize WebRTC connection
			await rtcConnection.connect();

			if (this._isHost) {
				// Host initiates the connection
				rtcConnection.on('ready', async () => {
					logger.debug('Host: Creating and sending offer');
					const offer = await rtcConnection.createOffer();
					if (offer) {
						this._sendWebSocketMessage({
							type: 'webrtc_signal',
							signal: {
								type: 'offer',
								sdp: offer
							}
						});
					}
				});
			}

			this._isConnected = true;
			return true;
		} catch (error) {
			logger.error('Failed to establish connection:', error);
			return false;
		}
	}

	/**
	 * Waits for guest to connect within timeout period
	 * @param {number} timeout - Maximum wait time in ms
	 * @returns {Promise<boolean>} Connection success
	 */
	async waitForGuestConnection(timeout = 20000) {
		if (!this._isHost) {
			throw new Error('Only host can wait for guest connection');
		}

		return new Promise((resolve, reject) => {
			const group = this._connectionManager.getConnectionGroup('pong');
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
		if (this._isHost) {
			throw new Error('Only guest can wait for host connection');
		}

		return new Promise((resolve, reject) => {
			const group = this._connectionManager.getConnectionGroup('pong');
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
	 * Sends a game message over WebRTC
	 * @param {Object} message - Message to send
	 * @returns {boolean} Send success
	 */
	sendGameMessage(message) {
		const group = this._connectionManager.getConnectionGroup('pong');
		if (!group) return false;

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
		return false;
	}

	/**
	 * Sends game state to peer
	 * @param {Object} state - Current game state
	 * @returns {boolean} Send success
	 */
	sendGameState(state) {
		if (!this.isConnected()) {
			logger.warn('Attempted to send game state while disconnected');
			return false;
		}

		return this.sendGameMessage({
			type: 'gameState',
			state: state
		});
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
	 * Checks if WebRTC connection is established
	 * @returns {boolean} Connection status
	 */
	isConnected() {
		const group = this._connectionManager.getConnectionGroup('pong');
		if (!group) return false;

		const rtcConnection = group.get('game');
		return rtcConnection && rtcConnection.state.name === 'connected';
	}

	/**
	 * Cleans up all connections and resets state
	 */
	destroy() {
		this._gameFinished = true;
		this._isConnected = false;
		this._hasRemoteDescription = false;
		this._pendingCandidates = [];
		this._messageHandlers.clear();
		this._connectionManager.disconnectAll();
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
			const rtcConnection = this._connectionManager.getConnectionGroup('pong').get('game');
			if (!rtcConnection) {
				throw new Error('WebRTC connection not found');
			}

			if (signal.type === 'offer' && !this._isHost) {
				logger.debug('Guest: Received offer, creating answer');
				const answer = await rtcConnection.handleOffer(signal.sdp);
				if (answer) {
					this._sendWebSocketMessage({
						type: 'webrtc_signal',
						signal: {
							type: 'answer',
							sdp: answer
						}
					});
				}
			} else if (signal.type === 'answer' && this._isHost) {
				logger.debug('Host: Received answer');
				await rtcConnection.handleAnswer(signal.sdp);
			} else if (signal.candidate) {
				await rtcConnection.addIceCandidate(signal.candidate);
			}
		} catch (error) {
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
		logger.debug(`${this._isHost ? 'Host' : 'Guest'}: Sending ICE candidate`);
		this._sendWebSocketMessage({
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
		this._isConnected = false;
		this.destroy();
	}

	/**
	 * Handles network errors
	 * @private
	 */
	_handleError(error) {
		logger.error('Network error:', error);
		this._handleDisconnect();
	}

	/**
	 * Sends message over WebSocket connection
	 * @private
	 */
	_sendWebSocketMessage(message) {
		const group = this._connectionManager.getConnectionGroup('pong');
		if (!group) return;

		const wsConnection = group.get('signaling');
		if (wsConnection && wsConnection.state.canSend) {
			wsConnection.send(message);
		}
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
}