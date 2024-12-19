import logger from "../utils/logger.js";

// Base NetworkManager interface with common functionality
class BaseNetworkManager {
	constructor() {
		this._messageHandlers = new Map();
		this._isConnected = false;
		this._wsService = null;
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
		const handler = this._messageHandlers.get(message.type);
		if (handler) {
			handler(message);
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
		this._messageHandlers.clear();
		this._isConnected = false;
	}

	isConnected() {
		return this._isConnected;
	}

	async _initializeWebSocket() {
	}

	_setupDataChannel(channel) {
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
		this._wsService = null;
		this._gameFinished = false;
		this._webrtcConnected = false;
		this._lastStateSync = Date.now();
		this._connectionState = 'new';
		this._reconnectAttempts = 0;
		this._maxReconnectAttempts = 5;
		this._isHost = true;
		this._peer = null;
		this._dataChannel = null;
		this._rtcConfig = {
			iceServers: [
				{ urls: "stun:stun.relay.metered.ca:80" },
				{
					urls: "turn:global.relay.metered.ca:80",
					username: "f948504c4c25ad6a49a104c3",
					credential: "ACHpbN3JhGSSvUAz"
				}
			]
		};
	}

	async connect() {
		try {
			await this._initializeWebSocket();
			await this._initializeWebRTC();
			return true;
		} catch (error) {
			logger.error('Failed to establish host connection:', error);
			return false;
		}
	}

	async waitForGuestConnection(timeout = 10000) {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			if (this.isConnected()) {
				logger.info('Host WebRTC connection established successfully');
				return true;
			}
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		logger.error('Guest connection wait timed out after', timeout, 'ms');
		return false;
	}

	async _initializeWebRTC() {
		this._peer = new RTCPeerConnection({
			...this._rtcConfig,
			iceCandidatePoolSize: 10,
			iceTransportPolicy: 'all'
		});
		this._setupPeerConnection();

		this._dataChannel = this._peer.createDataChannel('gameData', {
			ordered: false,
			maxRetransmits: 0
		});
		this._setupDataChannel(this._dataChannel);

		try {
			const offer = await this._peer.createOffer({
				offerToReceiveAudio: false,
				offerToReceiveVideo: false,
				iceRestart: false
			});

			await this._peer.setLocalDescription(offer);
			logger.debug('Local description set successfully');

			this._sendWebSocketMessage({
				type: 'webrtc_signal',
				signal: {
					type: 'offer',
					sdp: offer
				}
			});
		} catch (error) {
			logger.error('Error during WebRTC offer creation:', error);
			this._handleDisconnect();
			throw error;
		}
	}

	_setupPeerConnection() {
		this._peer.onicecandidate = (event) => {
			if (event.candidate) {
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
			logger.debug(`WebRTC Connection State Changed: ${this._connectionState}`);

			if (this._connectionState === 'connected') {
				this._webrtcConnected = true;
				this._reconnectAttempts = 0;
				logger.info('WebRTC connection established successfully');
			} else if (this._connectionState === 'failed') {
				logger.error('WebRTC connection failed, attempting to restart ICE');
				this._webrtcConnected = false;
				this._restartIce();
			} else if (this._connectionState === 'disconnected') {
				this._webrtcConnected = false;
				if (this._reconnectAttempts < this._maxReconnectAttempts) {
					logger.warn('WebRTC disconnected, attempting to reconnect');
					this._attemptReconnection(true);
				}
			}
		};

		this._peer.oniceconnectionstatechange = () => {
			logger.debug(`ICE Connection State: ${this._peer.iceConnectionState}`);
			if (this._peer.iceConnectionState === 'failed') {
				logger.error('ICE connection failed, attempting to restart ICE');
				this._restartIce();
			}
		};
	}

	async _restartIce() {
		if (!this._peer || this._gameFinished) return;

		try {
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
		} catch (error) {
			logger.error('Error during ICE restart:', error);
			this._handleDisconnect();
		}
	}

	_handleDisconnect() {
		if (this._gameFinished) {
			this._cleanupConnections();
			return;
		}

		this._isConnected = false;
		this._webrtcConnected = false;

		if (!this._isHost && this._connectionState !== 'closed') {
			this._attemptReconnection();
		}
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

	_cleanupConnections() {
		if (this._dataChannel) {
			this._dataChannel.close();
			this._dataChannel = null;
		}

		if (this._peer) {
			this._peer.close();
			this._peer = null;
		}

		if (this._wsService) {
			this._wsService.close();
			this._wsService = null;
		}

		this._isConnected = false;
		this._webrtcConnected = false;
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

	isConnected() {
		const timeSinceLastSync = Date.now() - this._lastStateSync;
		return this._webrtcConnected &&
			this._isConnected &&
			timeSinceLastSync < 2000 &&
			this._dataChannel?.readyState === 'open' &&
			this._connectionState === 'connected';
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
		this._rtcConfig = {
			iceServers: [
				{
					urls: "stun:stun.relay.metered.ca:80",
				},
				{
					urls: "turn:global.relay.metered.ca:80",
					username: "f948504c4c25ad6a49a104c3",
					credential: "ACHpbN3JhGSSvUAz",
				},
				{
					urls: "turn:global.relay.metered.ca:80?transport=tcp",
					username: "f948504c4c25ad6a49a104c3",
					credential: "ACHpbN3JhGSSvUAz",
				},
				{
					urls: "turn:global.relay.metered.ca:443",
					username: "f948504c4c25ad6a49a104c3",
					credential: "ACHpbN3JhGSSvUAz",
				},
				{
					urls: "turns:global.relay.metered.ca:443?transport=tcp",
					username: "f948504c4c25ad6a49a104c3",
					credential: "ACHpbN3JhGSSvUAz",
				}
			]
		};
	}

	async connect() {
		try {
			await this._initializeWebSocket();
			return true;
		} catch (error) {
			logger.error('Failed to establish guest connection:', error);
			return false;
		}
	}

	async waitForHostConnection(timeout = 10000) {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			if (this.isConnected()) {
				logger.info('Guest WebRTC connection established successfully');
				return true;
			}
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		logger.error('Host connection wait timed out after', timeout, 'ms');
		return false;
	}

	async _initializeWebRTC() {
		this._peer = new RTCPeerConnection({
			...this._rtcConfig,
			iceCandidatePoolSize: 10,
			iceTransportPolicy: 'all'
		});
		this._setupPeerConnection();

		this._peer.ondatachannel = (event) => {
			logger.debug('Received data channel from host');
			this._dataChannel = event.channel;
			this._setupDataChannel(this._dataChannel);
		};
	}

	_setupPeerConnection() {
		this._peer.onicecandidate = (event) => {
			if (event.candidate) {
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
			logger.debug(`WebRTC Connection State Changed: ${this._connectionState}`);

			if (this._connectionState === 'connected') {
				this._webrtcConnected = true;
				this._reconnectAttempts = 0;
				logger.info('WebRTC connection established successfully');
			} else if (this._connectionState === 'failed') {
				logger.error('WebRTC connection failed, attempting to restart ICE');
				this._webrtcConnected = false;
				this._restartIce();
			} else if (this._connectionState === 'disconnected') {
				this._webrtcConnected = false;
				if (this._reconnectAttempts < this._maxReconnectAttempts) {
					logger.warn('WebRTC disconnected, attempting to reconnect');
					this._attemptReconnection(true);
				}
			}
		};

		this._peer.oniceconnectionstatechange = () => {
			logger.debug(`ICE Connection State: ${this._peer.iceConnectionState}`);
			if (this._peer.iceConnectionState === 'failed') {
				logger.error('ICE connection failed, attempting to restart ICE');
				this._restartIce();
			}
		};
	}

	_handleWebSocketMessage(data) {
		switch (data.type) {
			case 'player_ready':
				if (!this._peer && !this._gameFinished) {
					logger.info('Guest received player_ready, initializing WebRTC');
					this._initializeWebRTC().catch(error => {
						logger.error('Failed to initialize WebRTC as guest:', error);
						this._handleDisconnect();
					});
				}
				break;

			case 'webrtc_signal':
				if (this._gameFinished) {
					logger.debug('Game is finished, ignoring WebRTC signal');
					return;
				}

				if (!this._peer) {
					logger.info('Guest received signal before peer initialization, initializing WebRTC first');
					this._initializeWebRTC()
						.then(() => {
							logger.debug('Guest WebRTC initialized, now handling signal');
							this._handleWebRTCSignal(data.signal);
						})
						.catch(error => {
							logger.error('Failed to initialize WebRTC as guest:', error);
							this._handleDisconnect();
						});
				} else {
					this._handleWebRTCSignal(data.signal);
				}
				break;

			case 'player_disconnected':
				if (!this._gameFinished) {
					logger.warn('Host disconnected, handling disconnect');
					this._handleDisconnect();
				}
				break;

			default:
				super._handleWebSocketMessage(data);
				break;
		}
	}

	async _handleOffer(signal) {
		try {
			if (this._peer.signalingState !== 'stable') {
				logger.warn('Peer connection not stable, waiting...');
				await new Promise(resolve => setTimeout(resolve, 100));
			}

			await this._peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
			const answer = await this._peer.createAnswer();
			await this._peer.setLocalDescription(answer);

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

	_handleWebRTCSignal(signal) {
		if (!this._peer) {
			logger.error('Received WebRTC signal but peer connection is null');
			return;
		}

		try {
			logger.debug(`Handling WebRTC signal of type: ${signal.type}`);

			if (signal.type === 'offer' && !this._isHost) {
				this._handleOffer(signal);
			} else if (signal.type === 'answer' && this._isHost) {
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
			logger.debug('Successfully set remote description from answer');
		} catch (error) {
			logger.error('Error handling answer:', error);
			this._handleDisconnect();
		}
	}

	async _handleCandidate(signal) {
		try {
			await this._peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
		} catch (error) {
			logger.error('Error adding ICE candidate:', error);
		}
	}

	_setupDataChannel(channel) {
		channel.onopen = () => {
			if (this._gameFinished) {
				logger.debug('Game is finished, closing data channel');
				channel.close();
				return;
			}

			this._isConnected = true;
			this._webrtcConnected = true;
			this._lastStateSync = Date.now();
			this._connectionState = 'connected';
			logger.info('Data channel opened successfully');
		};

		channel.onclose = () => {
			logger.warn('Data channel closed');
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
			logger.error('Data channel error:', error);
			this._isConnected = false;
			this._webrtcConnected = false;

			if (this._gameFinished) {
				logger.debug('Game is finished, skipping reconnection on error');
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
				}
			} catch (error) {
				logger.error('Error handling data channel message:', error);
			}
		};
	}

	_sendWebSocketMessage(message) {
		if (this._wsService && this._wsService.readyState === WebSocket.OPEN) {
			try {
				const stringifiedMessage = JSON.stringify(message);
				logger.debug('Sending WebSocket message:', message);
				this._wsService.send(stringifiedMessage);
			} catch (error) {
				logger.error('Error sending WebSocket message:', error);
			}
		} else {
			logger.warn('Cannot send WebSocket message - connection not open');
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

	isConnected() {
		const timeSinceLastSync = Date.now() - this._lastStateSync;
		return this._webrtcConnected &&
			this._isConnected &&
			timeSinceLastSync < 2000 &&
			this._dataChannel?.readyState === 'open' &&
			this._connectionState === 'connected';
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