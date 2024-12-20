import logger from "../utils/logger.js";
import WSService from "../utils/WSService.js";

// Create a common WebRTC configuration object
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

// Base NetworkManager interface with common functionality
class BaseNetworkManager {
	constructor() {
		this._messageHandlers = new Map();
		this._isConnected = false;
		this._wsService = null;

		// Add WebRTC-specific properties
		this._gameId = null;
		this._currentUser = null;
		this._isHost = false;
		this._peer = null;
		this._dataChannel = null;
		this._webrtcConnected = false;
		this._gameFinished = false;
		this._connectionState = 'new';
		this._reconnectAttempts = 0;
		this._maxReconnectAttempts = 5;
		this._lastStateSync = Date.now();
		this._rtcConfig = RTC_CONFIG;
	}

	async connect() {
		this._isConnected = true;
		return true;
	}

	async waitForGuestConnection() {
		return true;
	}

	async waitForHostConnection() {
		return true;
	}

	sendGameMessage(message) {
		if (!this._dataChannel || this._dataChannel.readyState !== 'open') {
			logger.error('Cannot send game message: data channel not ready');
			return;
		}

		try {
			const stringifiedMessage = JSON.stringify(message);
			this._dataChannel.send(stringifiedMessage);
		} catch (error) {
			logger.error('Error sending game message:', error);
		}
	}

	sendGameState(state) {
		this.sendGameMessage({
			type: 'gameState',
			state: state
		});
	}

	onGameMessage(type, handler) {
		this._messageHandlers.set(type, handler);
	}

	destroy() {
		logger.debug('Destroying network manager');
		this._gameFinished = true;
		this._isConnected = false;
		this._webrtcConnected = false;
		this._connectionState = 'closed';

		// Clear all message handlers first
		this._messageHandlers.clear();

		// Clean up connections
		this._cleanupConnections();
	}

	isConnected() {
		return this._isConnected && this._webrtcConnected;
	}

	async _initializeWebSocket() {
		try {
			if (this._wsService) {
				logger.warn('WebSocket service already initialized');
				return;
			}

			logger.debug('Initializing WebSocket service');
			this._wsService = new WSService();
			const endpoint = `/ws/pong_game/${this._gameId}/`;
			logger.debug(`Connecting to WebSocket endpoint: ${endpoint}`);
			this._wsService.initializeConnection('pongGame', endpoint);

			// Wait for the connection to be established
			await new Promise((resolve, reject) => {
				const wsConnection = this._wsService?.connections['pongGame'];
				if (!wsConnection) {
					reject(new Error('WebSocket connection not found'));
					return;
				}

				if (wsConnection.readyState === WebSocket.OPEN) {
					resolve();
				} else {
					const checkInterval = setInterval(() => {
						if (wsConnection.readyState === WebSocket.OPEN) {
							clearInterval(checkInterval);
							clearTimeout(timeoutId);
							resolve();
						} else if (wsConnection.readyState === WebSocket.CLOSED || wsConnection.readyState === WebSocket.CLOSING) {
							clearInterval(checkInterval);
							clearTimeout(timeoutId);
							reject(new Error('WebSocket connection failed'));
						}
					}, 100);

					const timeoutId = setTimeout(() => {
						clearInterval(checkInterval);
						reject(new Error('WebSocket initialization timeout'));
					}, 5000);

					// Also set up error handler
					this._wsService.on('pongGame', 'onError', (error) => {
						clearInterval(checkInterval);
						clearTimeout(timeoutId);
						reject(error);
					});
				}
			});

			// Set up WebSocket message handlers
			this._wsService.on('pongGame', 'onMessage', (data) => this._handleWebSocketMessage(data));
			this._wsService.on('pongGame', 'onClose', (event) => {
				logger.warn(`WebSocket closed with code: ${event?.code}`);

				// Don't immediately cleanup on 1011, attempt reconnection first
				if (this._webrtcConnected) {
					// If WebRTC is already connected, we can safely ignore WebSocket closure
					logger.info('WebSocket closed but WebRTC connection is active');
					return;
				}

				// Otherwise handle disconnect normally
				this._handleDisconnect();
			});
			this._wsService.on('pongGame', 'onError', (error) => {
				logger.error('WebSocket error:', error);
				this._handleDisconnect();
			});

			logger.info('WebSocket service initialized successfully');
			return true;
		} catch (error) {
			logger.error('Failed to initialize WebSocket:', error);
			if (this._wsService) {
				this._wsService.destroy('pongGame');
				this._wsService = null;
			}
			throw error;
		}
	}

	_setupDataChannel(channel) {
		if (!channel) {
			logger.error('Cannot setup null data channel');
			return;
		}

		logger.debug(`Setting up data channel '${channel.label}'`);

		channel.onopen = () => {
			logger.info(`Data channel '${channel.label}' opened`);
			this._isConnected = true;
			this._webrtcConnected = true;
			this._connectionState = 'connected';
		};

		channel.onclose = () => {
			logger.warn(`Data channel '${channel.label}' closed`);
			this._isConnected = false;
			this._webrtcConnected = false;

			if (this._gameFinished) {
				logger.debug('Game is finished, no reconnection needed');
				return;
			}
			if (!this._isHost && this._connectionState !== 'closed') {
				this._attemptReconnection();
			}
		};

		channel.onerror = (error) => {
			logger.error(`Data channel '${channel.label}' error:`, error);
			this._isConnected = false;
			this._webrtcConnected = false;

			if (this._gameFinished) {
				logger.debug('Game is finished, no reconnection needed');
				return;
			}
			if (!this._isHost && this._connectionState !== 'closed') {
				this._attemptReconnection();
			}
		};

		channel.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data);
				this._lastStateSync = Date.now();
				this._isConnected = true;
				this._webrtcConnected = true;

				const handler = this._messageHandlers.get(message.type);
				if (handler) {
					handler(message);
				} else {
					logger.warn(`No handler found for message type: ${message.type}`);
				}
			} catch (error) {
				logger.error('Error handling data channel message:', error);
			}
		};

		// Configure channel properties
		channel.binaryType = 'arraybuffer';
		// Set a reasonable buffering threshold
		const MAX_BUFFERED_AMOUNT = 16 * 1024; // 16 KB
		channel.bufferedAmountLowThreshold = MAX_BUFFERED_AMOUNT;
		channel.onbufferedamountlow = () => {
			logger.debug(`Data channel '${channel.label}' buffer dropped below threshold`);
		};
	}

	_sendWebSocketMessage(message) {
		if (!this._wsService) {
			logger.error('WebSocket service not initialized');
			return;
		}

		try {
			const stringifiedMessage = JSON.stringify(message);
			logger.debug('Sending WebSocket message:', message);
			this._wsService.send('pongGame', message);
		} catch (error) {
			logger.error('Error sending WebSocket message:', error);
		}
	}

	// Add WebRTC methods from WebRTCNetworkManager
	_setupPeerConnection() {
		if (!this._peer) {
			logger.error('Cannot setup peer connection: peer is null');
			return;
		}

		this._peer.onicecandidate = (event) => {
			if (event.candidate) {
				logger.debug('New ICE candidate:', {
					type: event.candidate.type,
					protocol: event.candidate.protocol,
					address: event.candidate.address,
					port: event.candidate.port
				});
				this._sendWebSocketMessage({
					type: 'webrtc_signal',
					signal: {
						type: 'candidate',
						candidate: event.candidate
					}
				});
			}
		};

		this._peer.onconnectionstatechange = () => {
			this._connectionState = this._peer.connectionState;
			logger.debug('WebRTC Connection State Changed:', {
				state: this._connectionState,
				iceState: this._peer.iceConnectionState,
				signalingState: this._peer.signalingState
			});

			if (this._connectionState === 'connected') {
				this._webrtcConnected = true;
				this._reconnectAttempts = 0;
				logger.info('WebRTC connection established successfully');
			} else if (this._connectionState === 'failed' || this._connectionState === 'disconnected') {
				this._webrtcConnected = false;
				if (!this._gameFinished && this._reconnectAttempts < this._maxReconnectAttempts) {
					logger.warn('Connection issues detected, attempting to reconnect...');
					this._attemptReconnection(true);
				}
			}
		};

		this._peer.oniceconnectionstatechange = () => {
			logger.debug('ICE Connection State Changed:', {
				state: this._peer.iceConnectionState,
				gatheringState: this._peer.iceGatheringState
			});

			if (this._peer.iceConnectionState === 'failed') {
				logger.error('ICE connection failed, attempting to restart ICE');
				this._restartIce();
			}
		};

		this._peer.onicegatheringstatechange = () => {
			logger.debug('ICE Gathering State Changed:', {
				state: this._peer.iceGatheringState
			});
		};

		this._peer.onerror = (error) => {
			logger.error('WebRTC peer connection error:', error);
			if (!this._gameFinished) {
				this._handleDisconnect();
			}
		};

		this._peer.onnegotiationneeded = () => {
			logger.debug('Negotiation needed');
			if (this._isHost) {
				this._createAndSendOffer();
			}
		};
	}

	async _createAndSendOffer() {
		try {
			logger.debug('Creating new offer');
			const offer = await this._peer.createOffer({
				offerToReceiveAudio: false,
				offerToReceiveVideo: false,
				iceRestart: false
			});

			logger.debug('Setting local description');
			await this._peer.setLocalDescription(offer);
			logger.debug('Local description set successfully');

			logger.debug('Sending offer');
			this._sendWebSocketMessage({
				type: 'webrtc_signal',
				signal: {
					type: 'offer',
					sdp: offer
				}
			});
		} catch (error) {
			logger.error('Error creating and sending offer:', error);
			this._handleDisconnect();
		}
	}

	_cleanupConnections() {
		logger.debug('Cleaning up connections');

		// Clean up data channel
		if (this._dataChannel) {
			this._dataChannel.onopen = null;
			this._dataChannel.onclose = null;
			this._dataChannel.onerror = null;
			this._dataChannel.onmessage = null;
			this._dataChannel.close();
			this._dataChannel = null;
		}

		// Clean up peer connection
		if (this._peer) {
			this._peer.onicecandidate = null;
			this._peer.onconnectionstatechange = null;
			this._peer.oniceconnectionstatechange = null;
			this._peer.onicegatheringstatechange = null;
			this._peer.onerror = null;
			this._peer.onnegotiationneeded = null;
			this._peer.close();
			this._peer = null;
		}

		// Clean up WebSocket
		if (this._wsService) {
			try {
				this._wsService.off('pongGame', 'onMessage');
				this._wsService.off('pongGame', 'onClose');
				this._wsService.off('pongGame', 'onError');
				this._wsService.destroy('pongGame');
			} catch (error) {
				logger.warn('Error removing WebSocket event handlers:', error);
			}
			this._wsService = null;
		}

		this._isConnected = false;
		this._webrtcConnected = false;
		this._connectionState = 'closed';
	}

	_attemptReconnection(immediate = false) {
		if (this._gameFinished || this._isReconnecting || this._reconnectAttempts >= this._maxReconnectAttempts) {
			if (this._reconnectAttempts >= this._maxReconnectAttempts) {
				logger.error('Max reconnection attempts reached');
				this._cleanupConnections();
			}
			return;
		}

		this._isReconnecting = true;
		this._reconnectAttempts++;
		logger.warn(`Connection issues detected, attempting to reconnect (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})...`);

		const reconnect = async () => {
			if (this._gameFinished) {
				this._isReconnecting = false;
				return;
			}

			try {
				// Clean up existing connections first
				this._cleanupConnections();

				// Reinitialize WebSocket
				await this._initializeWebSocket();

				// Wait for WebSocket to be ready
				await new Promise((resolve, reject) => {
					const wsConnection = this._wsService?.connections['pongGame'];
					if (!wsConnection) {
						reject(new Error('WebSocket connection not found'));
						return;
					}

					if (wsConnection.readyState === WebSocket.OPEN) {
						resolve();
					} else {
						const checkInterval = setInterval(() => {
							if (wsConnection.readyState === WebSocket.OPEN) {
								clearInterval(checkInterval);
								resolve();
							} else if (wsConnection.readyState === WebSocket.CLOSED || wsConnection.readyState === WebSocket.CLOSING) {
								clearInterval(checkInterval);
								reject(new Error('WebSocket connection failed'));
							}
						}, 100);

						setTimeout(() => {
							clearInterval(checkInterval);
							reject(new Error('WebSocket connection timeout'));
						}, 5000);
					}
				});

				// Reinitialize WebRTC
				await this._initializeWebRTC();
				logger.info('Reconnection successful');
				this._isReconnecting = false;
			} catch (error) {
				logger.error('Reconnection failed:', error);
				this._handleDisconnect();
				this._isReconnecting = false;
			}
		};

		if (immediate) {
			reconnect();
		} else {
			setTimeout(reconnect, Math.min(2000 * this._reconnectAttempts, 10000));
		}
	}

	async _restartIce() {
		try {
			if (!this._peer) {
				logger.error('Cannot restart ICE: peer connection is null');
				return;
			}

			logger.info('Attempting to restart ICE connection');

			if (this._isHost) {
				const offer = await this._peer.createOffer({ iceRestart: true });
				await this._peer.setLocalDescription(offer);
				this._sendWebSocketMessage({
					type: 'webrtc_signal',
					signal: {
						type: 'offer',
						sdp: offer
					}
				});
			}

			// Reset connection state flags
			this._webrtcConnected = false;
			this._connectionState = this._peer.connectionState;
			this._lastStateSync = Date.now();

			logger.info('ICE restart initiated');
		} catch (error) {
			logger.error('Failed to restart ICE:', error);
			this._handleDisconnect();
		}
	}
}

// Local network manager for AI and local games
export class LocalNetworkManager extends BaseNetworkManager {
	constructor(isHost = true) {
		super();
		this._isHost = isHost;
		this._isAIMode = false;
	}

	setAIMode(enabled) {
		this._isAIMode = enabled;
	}

	// Override sendGameMessage to handle local game logic
	sendGameMessage(message) {
		if (this._isAIMode) {
			// In AI mode, only process messages from the host
			if (message.isHost === this._isHost) {
				super.sendGameMessage(message);
			}
		} else {
			// In local mode, process all messages
			super.sendGameMessage(message);
		}
	}

	// No need to wait for connections in local mode
	async waitForGuestConnection() {
		return true;
	}

	async waitForHostConnection() {
		return true;
	}
}

// Host-specific network manager
export class HostNetworkManager extends BaseNetworkManager {
	constructor(gameId, currentUser) {
		super();
		this._gameId = gameId;
		this._currentUser = currentUser;
		this._isHost = true;
		this._wsService = null;
		this._gameFinished = false;
		this._webrtcConnected = false;
		this._lastStateSync = Date.now();
		this._connectionState = 'new';
		this._reconnectAttempts = 0;
		this._maxReconnectAttempts = 5;
		this._peer = null;
		this._dataChannel = null;
	}

	async connect() {
		try {
			logger.info('Host starting connection sequence');
			// Initialize WebSocket first and wait for it to be ready
			await this._initializeWebSocket();

			// Wait for WebSocket to be open before proceeding with WebRTC
			if (this._wsService) {
				await new Promise((resolve, reject) => {
					const wsConnection = this._wsService.connections['pongGame'];
					if (!wsConnection) {
						reject(new Error('WebSocket connection not found'));
						return;
					}

					if (wsConnection.readyState === WebSocket.OPEN) {
						resolve();
					} else {
						const checkInterval = setInterval(() => {
							if (wsConnection.readyState === WebSocket.OPEN) {
								clearInterval(checkInterval);
								resolve();
							} else if (wsConnection.readyState === WebSocket.CLOSED || wsConnection.readyState === WebSocket.CLOSING) {
								clearInterval(checkInterval);
								reject(new Error('WebSocket connection failed'));
							}
						}, 100);

						// Timeout after 5 seconds
						setTimeout(() => {
							clearInterval(checkInterval);
							reject(new Error('WebSocket connection timeout'));
						}, 5000);
					}
				});

				// Set up WebSocket message handlers
				this._wsService.on('pongGame', 'onMessage', (data) => this._handleWebSocketMessage(data));
				this._wsService.on('pongGame', 'onClose', () => this._handleDisconnect());

				logger.info('Host WebSocket connection established');
				return true;
			}
			return false;
		} catch (error) {
			logger.error('Failed to establish host connection:', error);
			return false;
		}
	}

	async waitForGuestConnection(timeout = 20000) {
		return new Promise((resolve, reject) => {
			const startTime = Date.now();

			// Check if already connected
			if (this.isConnected()) {
				logger.info('Already connected to guest');
				resolve(true);
				return;
			}

			// Set up a one-time handler for guest connection
			const checkConnection = () => {
				const isIceConnected = this._peer?.iceConnectionState === 'connected' ||
					this._peer?.iceConnectionState === 'completed';
				const isDataChannelOpen = this._dataChannel?.readyState === 'open';

				if (isIceConnected && isDataChannelOpen) {
					logger.info('Host WebRTC connection established successfully');
					clearInterval(checkInterval);
					clearTimeout(timeoutId);
					resolve(true);
				} else if (Date.now() - startTime >= timeout) {
					const state = {
						iceConnectionState: this._peer?.iceConnectionState,
						dataChannelState: this._dataChannel?.readyState,
						peerConnectionState: this._peer?.connectionState
					};
					logger.error('Connection timeout. States:', state);
					clearInterval(checkInterval);
					reject(new Error(`Guest connection wait timed out after ${timeout} ms. States: ${JSON.stringify(state)}`));
				}
			};

			const checkInterval = setInterval(checkConnection, 100);
			const timeoutId = setTimeout(() => {
				clearInterval(checkInterval);
				const state = {
					iceConnectionState: this._peer?.iceConnectionState,
					dataChannelState: this._dataChannel?.readyState,
					peerConnectionState: this._peer?.connectionState
				};
				logger.error('Connection timeout. States:', state);
				reject(new Error(`Guest connection wait timed out after ${timeout} ms. States: ${JSON.stringify(state)}`));
			}, timeout);

			// Initialize WebRTC if not already initialized
			if (!this._peer) {
				this._initializeWebRTC().catch(error => {
					logger.error('Failed to initialize WebRTC as host:', error);
					clearInterval(checkInterval);
					clearTimeout(timeoutId);
					reject(error);
				});
			}

			// Set up one-time handler for player_ready message
			const onPlayerReady = (data) => {
				logger.info('Received player_ready message from guest');
				// Don't initialize WebRTC again, just log the event
				logger.info('Guest is ready, waiting for WebRTC connection to establish');
			};

			// Add handler for player_ready message
			this.onGameMessage('player_ready', onPlayerReady);
		});
	}

	async _initializeWebRTC() {
		try {
			if (this._peer) {
				logger.warn('WebRTC peer already initialized');
				return;
			}

			// Check if WebSocket is ready
			if (!this._wsService || !this._wsService.connections['pongGame'] ||
				this._wsService.connections['pongGame'].readyState !== WebSocket.OPEN) {
				throw new Error('WebSocket not ready for WebRTC initialization');
			}

			logger.debug('Creating RTCPeerConnection with config:', this._rtcConfig);
			this._peer = new RTCPeerConnection(this._rtcConfig);

			if (!this._peer) {
				throw new Error('Failed to create RTCPeerConnection');
			}

			this._setupPeerConnection();

			logger.debug('Creating data channel as host');
			this._dataChannel = this._peer.createDataChannel('gameData', {
				ordered: true,
				maxRetransmits: 3,
				protocol: 'json'
			});

			if (!this._dataChannel) {
				throw new Error('Failed to create data channel');
			}

			this._setupDataChannel(this._dataChannel);

			logger.debug('Creating offer');
			const offer = await this._peer.createOffer({
				offerToReceiveAudio: false,
				offerToReceiveVideo: false,
				iceRestart: false
			});

			logger.debug('Setting local description');
			await this._peer.setLocalDescription(offer);
			logger.debug('Local description set successfully');

			logger.debug('Sending offer to guest');
			this._sendWebSocketMessage({
				type: 'webrtc_signal',
				signal: {
					type: 'offer',
					sdp: offer
				}
			});

			logger.info('Host WebRTC initialized successfully');
			return true;
		} catch (error) {
			logger.error('Failed to initialize WebRTC as host:', error);
			this._handleDisconnect();
			throw error;
		}
	}

	_handleDisconnect() {
		// If game is finished, just clean up without reconnection
		if (this._gameFinished) {
			logger.debug('Game is finished, cleaning up connections without reconnection');
			this._cleanupConnections();
			return;
		}

		logger.warn('Connection issues detected, cleaning up and attempting reconnection');
		this._isConnected = false;
		this._webrtcConnected = false;

		if (this._reconnectAttempts < this._maxReconnectAttempts) {
			this._attemptReconnection();
		} else {
			logger.error('Max reconnection attempts reached, cleaning up connections');
			this._cleanupConnections();
		}
	}

	syncSettings(settings) {
		if (this._isConnected) {
			this.sendGameMessage({
				type: 'settings_update',
				settings: settings
			});
		}
	}

	getConnectionStatus() {
		return {
			webrtc: {
				connectionState: this._peer?.connectionState,
				iceConnectionState: this._peer?.iceConnectionState,
				webrtcConnected: this._webrtcConnected
			},
			dataChannel: {
				state: this._dataChannel?.readyState,
				bufferedAmount: this._dataChannel?.bufferedAmount
			},
			isConnected: this.isConnected(),
			isHost: this._isHost,
			lastStateSync: this._lastStateSync
		};
	}

	_handleWebSocketMessage(data) {
		try {
			logger.debug('Received WebSocket message:', data);

			switch (data.type) {
				case 'player_ready':
					if (!this._gameFinished) {
						logger.info('Host received player_ready, initiating WebRTC connection');
						// Notify message handlers
						const handler = this._messageHandlers.get('player_ready');
						if (handler) {
							handler(data);
						}
					}
					break;

				case 'webrtc_signal':
					if (this._gameFinished) {
						logger.debug('Game is finished, ignoring WebRTC signal');
						return;
					}

					this._handleWebRTCSignal(data.signal);
					break;

				case 'player_disconnected':
					if (!this._gameFinished) {
						logger.warn('Guest disconnected, handling disconnect');
						this._handleDisconnect();
					}
					break;

				default:
					logger.debug('Unhandled message type:', data.type);
					break;
			}
		} catch (error) {
			logger.error('Error handling WebSocket message:', error);
		}
	}

	_handleWebRTCSignal(signal) {
		if (!this._peer) {
			logger.error('Received WebRTC signal but peer connection is null');
			return;
		}

		try {
			logger.debug(`Handling WebRTC signal of type: ${signal.type}`);

			if (signal.type === 'answer') {
				this._handleAnswer(signal);
			} else if (signal.type === 'candidate') {
				this._handleCandidate(signal);
			}
		} catch (error) {
			logger.error('Error handling WebRTC signal:', error);
		}
	}

	async _handleAnswer(signal) {
		try {
			if (this._peer.signalingState === 'stable') {
				logger.warn('Received answer while in stable state, ignoring');
				return;
			}

			await this._peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
			logger.debug('Remote description set successfully');
		} catch (error) {
			logger.error('Error handling answer:', error);
			this._handleDisconnect();
		}
	}

	async _handleCandidate(signal) {
		try {
			if (!this._peer) {
				logger.error('Cannot handle ICE candidate: peer connection is null');
				return;
			}

			if (!signal.candidate) {
				logger.warn('Received empty ICE candidate');
				return;
			}

			await this._peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
			logger.debug('Successfully added ICE candidate');
		} catch (error) {
			logger.error('Error adding ICE candidate:', error);
			if (error.name === 'InvalidStateError') {
				logger.warn('Peer connection not in the right state to add ICE candidate');
			}
		}
	}
}

// Guest-specific network manager
export class GuestNetworkManager extends BaseNetworkManager {
	constructor(gameId, currentUser) {
		super();
		this._gameId = gameId;
		this._currentUser = currentUser;
		this._isHost = false;
		this._peer = null;
		this._dataChannel = null;
		this._webrtcConnected = false;
	}

	async connect() {
		try {
			logger.info('Guest starting connection sequence');
			// Initialize WebSocket first and wait for it to be ready
			await this._initializeWebSocket();

			// Wait for WebSocket to be open before proceeding
			if (this._wsService) {
				await new Promise((resolve, reject) => {
					const wsConnection = this._wsService.connections['pongGame'];
					if (!wsConnection) {
						reject(new Error('WebSocket connection not found'));
						return;
					}

					if (wsConnection.readyState === WebSocket.OPEN) {
						resolve();
					} else {
						const checkInterval = setInterval(() => {
							if (wsConnection.readyState === WebSocket.OPEN) {
								clearInterval(checkInterval);
								resolve();
							} else if (wsConnection.readyState === WebSocket.CLOSED || wsConnection.readyState === WebSocket.CLOSING) {
								clearInterval(checkInterval);
								reject(new Error('WebSocket connection failed'));
							}
						}, 100);

						// Timeout after 5 seconds
						setTimeout(() => {
							clearInterval(checkInterval);
							reject(new Error('WebSocket connection timeout'));
						}, 5000);
					}
				});

				// Set up WebSocket message handlers
				this._wsService.on('pongGame', 'onMessage', (data) => this._handleWebSocketMessage(data));
				this._wsService.on('pongGame', 'onClose', () => this._handleDisconnect());

				// Send ready signal to host first
				logger.info('Guest sending player_ready signal');
				this._sendWebSocketMessage({
					type: 'player_ready',
					user_id: this._currentUser.id
				});

				// Initialize WebRTC
				await this._initializeWebRTC();
				logger.info('Guest connection sequence completed successfully');
				return true;
			}
			return false;
		} catch (error) {
			logger.error('Failed to establish guest connection:', error);
			return false;
		}
	}

	async waitForHostConnection(timeout = 20000) {
		return new Promise((resolve, reject) => {
			if (this._gameFinished) {
				logger.debug('Game is finished, skipping host connection wait');
				reject(new Error('Game is finished'));
				return;
			}

			const startTime = Date.now();

			const checkConnection = () => {
				if (this._gameFinished) {
					logger.debug('Game finished during connection wait');
					clearInterval(checkInterval);
					clearTimeout(timeoutId);
					reject(new Error('Game finished during connection wait'));
					return;
				}

				const isIceConnected = this._peer?.iceConnectionState === 'connected' ||
					this._peer?.iceConnectionState === 'completed';
				const isDataChannelOpen = this._dataChannel?.readyState === 'open';

				if (isIceConnected && isDataChannelOpen) {
					logger.info('Guest WebRTC connection established successfully');
					clearInterval(checkInterval);
					clearTimeout(timeoutId);
					resolve(true);
				} else if (Date.now() - startTime >= timeout) {
					const state = {
						iceConnectionState: this._peer?.iceConnectionState,
						dataChannelState: this._dataChannel?.readyState,
						peerConnectionState: this._peer?.connectionState
					};
					logger.error('Host connection timeout. States:', state);
					clearInterval(checkInterval);
					reject(new Error(`Host connection wait timed out after ${timeout} ms. States: ${JSON.stringify(state)}`));
				}
			};

			const checkInterval = setInterval(checkConnection, 100);
			const timeoutId = setTimeout(() => {
				clearInterval(checkInterval);
				const state = {
					iceConnectionState: this._peer?.iceConnectionState,
					dataChannelState: this._dataChannel?.readyState,
					peerConnectionState: this._peer?.connectionState
				};
				logger.error('Host connection timeout. States:', state);
				reject(new Error(`Host connection wait timed out after ${timeout} ms. States: ${JSON.stringify(state)}`));
			}, timeout);
		});
	}

	async _initializeWebRTC() {
		try {
			if (this._peer) {
				logger.warn('WebRTC peer already initialized');
				return;
			}

			// Check if WebSocket is ready
			if (!this._wsService || !this._wsService.connections['pongGame'] ||
				this._wsService.connections['pongGame'].readyState !== WebSocket.OPEN) {
				throw new Error('WebSocket not ready for WebRTC initialization');
			}

			logger.debug('Creating RTCPeerConnection with config:', this._rtcConfig);
			this._peer = new RTCPeerConnection(this._rtcConfig);

			if (!this._peer) {
				throw new Error('Failed to create RTCPeerConnection');
			}

			this._setupPeerConnection();

			// Set up ondatachannel handler
			this._peer.ondatachannel = (event) => {
				logger.debug('Received data channel from host:', event.channel.label);
				this._dataChannel = event.channel;
				if (!this._dataChannel) {
					throw new Error('Received null data channel from host');
				}
				logger.debug('Data channel state:', this._dataChannel.readyState);
				this._setupDataChannel(this._dataChannel);
			};

			// Add error handler
			this._peer.onerror = (error) => {
				logger.error('WebRTC peer connection error:', error);
				this._handleDisconnect();
			};

			// Add negotiation needed handler
			this._peer.onnegotiationneeded = () => {
				logger.debug('Negotiation needed');
			};

			logger.info('Guest WebRTC initialized successfully');
			return true;
		} catch (error) {
			logger.error('Failed to initialize WebRTC as guest:', error);
			this._handleDisconnect();
			throw error;
		}
	}

	_handleWebSocketMessage(data) {
		try {
			logger.debug('Received WebSocket message:', data);

			switch (data.type) {
				case 'webrtc_signal':
					if (this._gameFinished) {
						logger.debug('Game is finished, ignoring WebRTC signal');
						return;
					}
					this._handleWebRTCSignal(data.signal);
					break;

				case 'player_disconnected':
					if (!this._gameFinished) {
						logger.warn('Host disconnected, handling disconnect');
						this._handleDisconnect();
					}
					break;

				case 'game_complete':
					logger.info('Received game completion signal from host');
					this._gameFinished = true;
					this._cleanupConnections();
					break;

				default:
					logger.debug('Unhandled message type:', data.type);
					break;
			}
		} catch (error) {
			logger.error('Error handling WebSocket message:', error);
		}
	}

	_handleWebRTCSignal(signal) {
		if (!this._peer) {
			logger.error('Received WebRTC signal but peer connection is null');
			return;
		}

		try {
			logger.debug(`Handling WebRTC signal of type: ${signal.type}`);

			if (signal.type === 'offer') {
				this._handleOffer(signal);
			} else if (signal.type === 'candidate') {
				this._handleCandidate(signal);
			}
		} catch (error) {
			logger.error('Error handling WebRTC signal:', error);
		}
	}

	destroy() {
		this._gameFinished = true;
		this._cleanupConnections();
		this._messageHandlers.clear();
	}

	sendGameMessage(message) {
		if (!this._isConnected || !this._dataChannel) return;

		try {
			logger.debug('Sending message:', message);
			this._dataChannel.send(JSON.stringify(message));
		} catch (error) {
			logger.error('Error sending game message:', error);
		}
	}

	sendGameState(state) {
		this.sendGameMessage({
			type: 'gameState',
			state: state
		});
	}

	onGameMessage(type, handler) {
		this._messageHandlers.set(type, handler);
	}

	async _handleOffer(signal) {
		try {
			if (!this._peer) {
				logger.error('Cannot handle offer: peer connection is null');
				return;
			}

			logger.debug('Setting remote description from offer');
			await this._peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));

			logger.debug('Creating answer');
			const answer = await this._peer.createAnswer();

			logger.debug('Setting local description');
			await this._peer.setLocalDescription(answer);

			logger.debug('Sending answer to host');
			this._sendWebSocketMessage({
				type: 'webrtc_signal',
				signal: {
					type: 'answer',
					sdp: answer
				}
			});
		} catch (error) {
			logger.error('Error handling offer:', error);
			this._handleDisconnect();
		}
	}

	async _handleCandidate(signal) {
		try {
			if (!this._peer) {
				logger.error('Cannot handle ICE candidate: peer connection is null');
				return;
			}

			if (!signal.candidate) {
				logger.warn('Received empty ICE candidate');
				return;
			}

			await this._peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
			logger.debug('Successfully added ICE candidate');
		} catch (error) {
			logger.error('Error adding ICE candidate:', error);
			if (error.name === 'InvalidStateError') {
				logger.warn('Peer connection not in the right state to add ICE candidate');
			}
		}
	}

	_handleDisconnect() {
		if (this._gameFinished) {
			logger.debug('Game is finished, cleaning up connections without reconnection');
			this._cleanupConnections();
			return;
		}

		logger.warn('Connection issues detected, cleaning up and attempting reconnection');
		this._isConnected = false;
		this._webrtcConnected = false;

		if (this._reconnectAttempts < this._maxReconnectAttempts) {
			this._attemptReconnection();
		} else {
			logger.error('Max reconnection attempts reached, cleaning up connections');
			this._cleanupConnections();
		}
	}
}

// Export a factory function to create the appropriate network manager
export function createNetworkManager(gameId, currentUser, isHost, mode = 'network') {
	switch (mode) {
		case 'local':
			return new LocalNetworkManager(isHost);
		case 'network':
			return isHost ?
				new HostNetworkManager(gameId, currentUser) :
				new GuestNetworkManager(gameId, currentUser);
		default:
			throw new Error(`Unknown network mode: ${mode}`);
	}
} 