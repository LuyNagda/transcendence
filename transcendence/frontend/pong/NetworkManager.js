import logger from "../utils/logger.js";

export class NetworkManager {
	constructor(gameId, currentUser, isHost) {
		this._gameId = gameId;
		this._currentUser = currentUser;
		this._isHost = isHost;
		this._wsService = null;
		this._peer = null;
		this._dataChannel = null;
		this._isConnected = false;
		this._messageHandlers = new Map();
		this._pendingCandidates = [];
		this._lastStateSync = Date.now();
		this._connectionCheckInterval = null;
		this._maxStateSyncDelay = 2000; // 2 seconds max delay between state syncs

		// Set default STUN/TURN configuration
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
				},
			],
			iceCandidatePoolSize: 10,
			iceTransportPolicy: 'relay',
			bundlePolicy: 'max-bundle',
			rtcpMuxPolicy: 'require',
			sdpSemantics: 'unified-plan'
		};

		this._peerConnectionState = 'new';
		this._dataChannelState = 'closed';
		this._webrtcConnected = false;
		this._processingSignal = false;
		this._pendingSignals = [];
		this._hasRemoteDescription = false;
		this._signalQueue = [];
		this._isSignalingReady = false;
		this._isProcessingSignals = false;

		this._messageHandlers.set('settings_update', (message) => {
			if (!this._isHost) {
				const gameSettings = dynamicRender.observedObjects.get('pongRoom')?.settings;
				if (gameSettings) {
					const setting = message.setting;
					const value = message.value;
					if (setting && value !== undefined) {
						gameSettings[setting] = value;
						dynamicRender.scheduleUpdate();
					} else if (message.settings) {
						Object.assign(gameSettings, message.settings);
						dynamicRender.scheduleUpdate();
					}
				}
			}
		});

		// Add ping/pong handler for basic connectivity check
		this._messageHandlers.set('ping', (message) => {
			this.sendGameMessage({
				type: 'pong',
				timestamp: message.timestamp
			});
		});

		this._messageHandlers.set('pong', (message) => {
			this._lastPongReceived = Date.now();
		});
	}

	async connect() {
		try {
			// Remove the optimal STUN server setup and just use the default configuration
			await this._initializeWebSocket();
			if (this._isHost) {
				await this._initializeWebRTC();
			}
			return true;
		} catch (error) {
			logger.error('Failed to establish connection:', error);
			return false;
		}
	}

	async _initializeWebSocket() {
		return new Promise((resolve, reject) => {
			this._wsService = new WebSocket(`ws://${window.location.host}/ws/pong_game/${this._gameId}/`);

			this._wsService.onopen = () => {
				logger.info('WebSocket connection established');
				this._sendWebSocketMessage({
					type: 'player_ready',
					gameId: this._gameId,
					userId: this._currentUser.id,
					isHost: this._isHost
				});
				resolve();
			};

			this._wsService.onmessage = (event) => {
				const data = JSON.parse(event.data);
				this._handleWebSocketMessage(data);
			};

			this._wsService.onerror = (error) => {
				logger.error('WebSocket error:', error);
				reject(error);
			};

			this._wsService.onclose = (event) => {
				logger.warn('WebSocket connection closed:', event);
				this._handleDisconnect();
			};
		});
	}

	async _initializeWebRTC() {
		if (this._peer) {
			logger.warn('WebRTC peer already exists, cleaning up first');
			this._peer.close();
			this._peer = null;
		}

		logger.info(`Initializing WebRTC as ${this._isHost ? 'host' : 'guest'}`);
		this._peer = new RTCPeerConnection(this._rtcConfig);
		this._hasRemoteDescription = false;
		this._pendingCandidates = [];
		this._isSignalingReady = true;

		// Add transceivers configuration
		this._peer.addTransceiver('video', { direction: 'inactive' });
		this._peer.addTransceiver('audio', { direction: 'inactive' });

		this._peer.onconnectionstatechange = () => {
			this._peerConnectionState = this._peer.connectionState;
			logger.debug(`WebRTC Connection State Changed: ${this._peerConnectionState}`);

			if (this._peer.connectionState === 'connected') {
				logger.info('WebRTC peer connection established successfully');
			} else if (this._peer.connectionState === 'failed') {
				logger.warn('WebRTC peer connection failed - falling back to WebSocket');
				this._fallbackToWebSocket();
			}
		};

		this._peer.oniceconnectionstatechange = () => {
			logger.debug(`ICE Connection State Changed: ${this._peer.iceConnectionState}`);

			if (this._peer.iceConnectionState === 'failed') {
				logger.error('ICE connection failed - attempting restart');
				this._peer.restartIce();
			} else if (this._peer.iceConnectionState === 'disconnected') {
				logger.warn('ICE connection disconnected - waiting for reconnection');
			} else if (this._peer.iceConnectionState === 'connected') {
				logger.info('ICE connection established');
			}
		};

		this._peer.onicegatheringstatechange = () => {
			logger.debug(`ICE Gathering State Changed: ${this._peer.iceGatheringState}`);
			if (this._peer.iceGatheringState === 'complete') {
				logger.info('ICE gathering completed');
			}
		};

		this._peer.onicecandidate = (event) => {
			if (event.candidate) {
				if (this._hasRemoteDescription || !this._isHost) {
					logger.debug('New ICE candidate:', event.candidate.candidate);
					this._queueSignal({
						type: 'webrtc_signal',
						signal: {
							type: 'candidate',
							candidate: event.candidate
						}
					});
				} else {
					logger.debug('Queuing local ICE candidate until remote description is set');
					this._pendingCandidates.push(event.candidate);
				}
			} else {
				logger.debug('ICE candidate gathering completed');
			}
		};

		if (this._isHost) {
			logger.debug('Creating data channel as host');
			this._dataChannel = this._peer.createDataChannel('gameData', {
				ordered: false,
				maxRetransmits: 0
			});
			this._setupDataChannel(this._dataChannel);

			try {
				logger.debug('Creating WebRTC offer as host');
				const offer = await this._peer.createOffer({
					offerToReceiveAudio: false,
					offerToReceiveVideo: false
				});

				logger.debug('Setting local description');
				await this._peer.setLocalDescription(offer);

				logger.debug('Sending offer via WebSocket');
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
		} else {
			logger.debug('Setting up ondatachannel as guest');
			this._peer.ondatachannel = (event) => {
				logger.debug('Received data channel from host');
				this._dataChannel = event.channel;
				this._setupDataChannel(this._dataChannel);
			};
		}
	}

	_setupDataChannel(channel) {
		channel.onopen = () => {
			this._dataChannelState = channel.readyState;
			this._isConnected = true;
			this._webrtcConnected = true;
			this._lastStateSync = Date.now();
			logger.info('Data channel opened successfully');

			// Add reconnection heartbeat with increased frequency for guests
			this._startHeartbeat(!this._isHost);

			logger.debug('Connection Status:', this.getConnectionStatus());
		};

		channel.onclose = () => {
			logger.warn('Data channel closed');
			if (!this._isHost) {
				// For guests, try to reconnect immediately
				this._attemptReconnection(true);
			} else {
				// For host, use normal reconnection
				this._attemptReconnection(false);
			}
		};

		channel.onerror = (error) => {
			logger.error('Data channel error:', error);
			if (!this._isHost) {
				// For guests, try to reconnect immediately
				this._attemptReconnection(true);
			} else {
				// For host, use normal reconnection
				this._attemptReconnection(false);
			}
		};

		channel.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data);
				logger.debug('Received message:', message);

				// Update connection state on any message receipt
				this._isConnected = true;
				this._webrtcConnected = true;
				this._lastStateSync = Date.now();

				this._handleGameMessage(message);
			} catch (error) {
				logger.error('Error handling data channel message:', error);
			}
		};
	}

	_handleGameMessage(message) {
		try {
			// Update last activity timestamp for any game message
			this._lastStateSync = Date.now();
			this._isConnected = true;
			this._webrtcConnected = true;

			const handler = this._messageHandlers.get(message.type);
			if (handler) {
				handler(message);
			}
		} catch (error) {
			logger.error('Error in _handleGameMessage:', error);
		}
	}

	isConnected() {
		// Consider WebSocket connection for guests
		if (!this._isHost) {
			return this._wsService?.readyState === WebSocket.OPEN;
		}

		// For host, check WebRTC connection
		const timeSinceLastSync = Date.now() - this._lastStateSync;
		return timeSinceLastSync < 2000 && this._dataChannel?.readyState === 'open';
	}

	async waitForConnection(timeout = 10000) {
		const startTime = Date.now();
		logger.debug('Starting connection wait with timeout:', timeout);

		// Add check for guest connection through WebSocket
		if (!this._isHost && this._wsService?.readyState === WebSocket.OPEN) {
			logger.info('Guest connection established through WebSocket');
			this._isConnected = true;
			this._webrtcConnected = true;
			return true;
		}

		while (Date.now() - startTime < timeout) {
			// For host, check WebRTC connection
			if (this._isHost) {
				const timeSinceLastSync = Date.now() - this._lastStateSync;
				const isReceivingData = timeSinceLastSync < 2000;

				if (isReceivingData && this._dataChannel?.readyState === 'open') {
					logger.info('Host WebRTC connection established successfully');
					return true;
				}
			}
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		logger.error('Connection wait timed out after', timeout, 'ms');
		return false;
	}

	_handleWebSocketMessage(data) {
		switch (data.type) {
			case 'player_ready':
				if (!this._isHost && !this._peer) {
					logger.info('Guest received player_ready, initializing WebRTC');
					this._initializeWebRTC().catch(error => {
						logger.error('Failed to initialize WebRTC as guest:', error);
					});
				}
				break;

			case 'webrtc_signal':
				if (!this._peer && !this._isHost) {
					logger.info('Guest received signal before peer initialization, initializing WebRTC first');
					this._initializeWebRTC()
						.then(() => {
							logger.debug('Guest WebRTC initialized, now handling signal');
							this._handleWebRTCSignal(data.signal);
						})
						.catch(error => {
							logger.error('Failed to initialize WebRTC as guest:', error);
						});
				} else if (this._peer) {
					this._handleWebRTCSignal(data.signal);
				} else {
					logger.warn('Received signal but peer is not initialized');
				}
				break;

			case 'player_disconnected':
				this._handleDisconnect();
				break;
		}
	}

	_queueSignal(signal) {
		this._signalQueue.push(signal);
		this._processSignalQueue();
	}

	async _processSignalQueue() {
		if (this._isProcessingSignals || !this._isSignalingReady || this._signalQueue.length === 0) {
			return;
		}

		this._isProcessingSignals = true;

		try {
			while (this._signalQueue.length > 0) {
				const signal = this._signalQueue[0];
				await this._sendWebSocketMessage(signal);
				this._signalQueue.shift();
				await new Promise(resolve => setTimeout(resolve, 50)); // Add small delay between signals
			}
		} catch (error) {
			logger.error('Error processing signal queue:', error);
		} finally {
			this._isProcessingSignals = false;
		}
	}

	async _handleWebRTCSignal(signal) {
		if (!this._peer) {
			logger.error('Received WebRTC signal but peer connection is null');
			return;
		}

		try {
			logger.debug(`Handling WebRTC signal of type: ${signal.type}, current signaling state: ${this._peer.signalingState}`);

			if (signal.type === 'offer') {
				// Ensure we're in a state to receive an offer
				if (this._peer.signalingState !== 'stable') {
					logger.debug('Signaling state not stable, rolling back');
					await this._peer.setLocalDescription({ type: "rollback" });
				}

				this._isSignalingReady = false;
				try {
					logger.debug('Setting remote description (offer)');
					await this._peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
					this._hasRemoteDescription = true;

					logger.debug('Creating answer');
					const answer = await this._peer.createAnswer();

					logger.debug('Setting local description (answer)');
					await this._peer.setLocalDescription(answer);

					logger.debug('Sending answer');
					await this._sendWebSocketMessage({
						type: 'webrtc_signal',
						signal: {
							type: 'answer',
							sdp: answer
						}
					});

					this._isSignalingReady = true;
					await this._processPendingCandidates();
				} catch (error) {
					this._isSignalingReady = true;
					throw error;
				}
			} else if (signal.type === 'answer') {
				// Only process answer if we're in have-local-offer state and not stable
				if (this._peer.signalingState === 'have-local-offer') {
					this._isSignalingReady = false;
					try {
						logger.debug('Setting remote description (answer)');
						await this._peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
						this._hasRemoteDescription = true;
						this._isSignalingReady = true;

						// Process any pending candidates
						await this._processPendingCandidates();
					} catch (error) {
						this._isSignalingReady = true;
						throw error;
					}
				} else {
					logger.warn(`Ignoring answer in state ${this._peer.signalingState}`);
				}
			} else if (signal.type === 'candidate' && signal.candidate) {
				if (!this._hasRemoteDescription) {
					logger.debug('Remote description not set, queuing ICE candidate');
					this._pendingCandidates.push(signal.candidate);
					return;
				}

				try {
					if (this._peer.remoteDescription && this._peer.remoteDescription.type) {
						logger.debug('Adding ICE candidate');
						await this._peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
					} else {
						logger.debug('Remote description not ready, queuing ICE candidate');
						this._pendingCandidates.push(signal.candidate);
					}
				} catch (error) {
					if (error.name === 'OperationError' || error.name === 'InvalidStateError') {
						logger.warn('ICE candidate could not be added, queuing for later');
						this._pendingCandidates.push(signal.candidate);
					} else {
						throw error;
					}
				}
			}
		} catch (error) {
			logger.error('Error handling WebRTC signal:', error);
			// Don't disconnect immediately on signal errors, let the connection attempt continue
			if (error.name !== 'InvalidStateError' && error.name !== 'OperationError') {
				this._handleDisconnect();
			}
		}
	}

	async _processPendingCandidates() {
		if (this._pendingCandidates.length > 0 && this._peer.remoteDescription && this._peer.remoteDescription.type) {
			logger.debug(`Processing ${this._pendingCandidates.length} pending ICE candidates`);
			const candidates = [...this._pendingCandidates];
			this._pendingCandidates = [];

			for (const candidate of candidates) {
				try {
					await this._peer.addIceCandidate(new RTCIceCandidate(candidate));
					logger.debug('Successfully added pending ICE candidate');
				} catch (error) {
					logger.warn('Failed to add pending ICE candidate:', error);
					// Re-queue failed candidates
					this._pendingCandidates.push(candidate);
				}
			}
		}
	}

	sendGameMessage(message) {
		if (this._usingWebSocketFallback) {
			// Use existing webrtc_signal channel for game messages
			this._wsService.send(JSON.stringify({
				type: 'webrtc_signal',
				signal: message  // Backend already handles this in relay_webrtc_signal
			}));
			return;
		}

		// Original WebRTC sending logic
		if (!this._isConnected || !this._dataChannel) return;
		try {
			logger.debug('Sending message:', message);
			this._dataChannel.send(JSON.stringify(message));
		} catch (error) {
			logger.error('Error sending game message:', error);
		}
	}

	onGameMessage(type, handler) {
		this._messageHandlers.set(type, handler);
	}

	_handleDisconnect() {
		// Clear heartbeat interval
		if (this._heartbeatInterval) {
			clearInterval(this._heartbeatInterval);
			this._heartbeatInterval = null;
		}

		// Clear reconnection flag
		this._isReconnecting = false;

		// Only fully disconnect if we're the host or if multiple reconnection attempts have failed
		if (this._isHost || this._disconnectCount > 3) {
			this._isConnected = false;
			this._webrtcConnected = false;
			this._processingSignal = false;
			this._pendingSignals = [];
			this._hasRemoteDescription = false;
			this._pendingCandidates = [];
			this._isSignalingReady = false;
			this._signalQueue = [];
			this._isProcessingSignals = false;

			if (this._peer) {
				this._peer.close();
				this._peer = null;
			}
			if (this._dataChannel) {
				this._dataChannel.close();
				this._dataChannel = null;
			}
		} else {
			// For guests, increment disconnect count and try to reconnect
			this._disconnectCount = (this._disconnectCount || 0) + 1;
			this._attemptReconnection(true);
		}
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

	syncSettings(settings) {
		if (this._isConnected) {
			this.sendGameMessage({
				type: 'settings_update',
				settings: settings
			});
		}
	}

	destroy() {
		if (this._heartbeatInterval) {
			clearInterval(this._heartbeatInterval);
			this._heartbeatInterval = null;
		}
		this._handleDisconnect();
		if (this._wsService) {
			this._wsService.onmessage = null;
			this._wsService.onerror = null;
			this._wsService.onclose = null;
			this._wsService.close();
			this._wsService = null;
		}
		this._messageHandlers.clear();
	}

	getConnectionStatus() {
		const status = {
			webrtc: {
				connectionState: this._peerConnectionState,
				iceConnectionState: this._peer?.iceConnectionState,
				iceGatheringState: this._peer?.iceGatheringState,
				webrtcConnected: this._webrtcConnected,
				handshakeComplete: this._handshakeComplete,
				handshakeAttempts: this._handshakeAttempts
			},
			dataChannel: {
				state: this._dataChannelState,
				bufferedAmount: this._dataChannel?.bufferedAmount,
			},
			isConnected: this.isConnected(),
			isHost: this._isHost,
			lastStateSync: this._lastStateSync,
			lastPongReceived: this._lastPongReceived
		};
		return status;
	}

	// Add new methods for connection stability
	_startHeartbeat(isGuest = false) {
		// Clear any existing heartbeat
		if (this._heartbeatInterval) {
			clearInterval(this._heartbeatInterval);
		}

		const heartbeatInterval = isGuest ? 500 : 1000; // More frequent for guests

		this._heartbeatInterval = setInterval(() => {
			if (this._isConnected && this._dataChannel?.readyState === 'open') {
				this.sendGameMessage({
					type: 'heartbeat',
					timestamp: Date.now()
				});
			} else if (isGuest) {
				// If guest loses connection, try to reconnect
				this._attemptReconnection(true);
			}
		}, heartbeatInterval);
	}

	_attemptReconnection(immediate = false) {
		// Prevent multiple simultaneous reconnection attempts
		if (this._isReconnecting) return;
		this._isReconnecting = true;

		logger.warn('Connection issues detected, attempting to reconnect...');

		const reconnect = async () => {
			if (this._dataChannel?.readyState !== 'open') {
				try {
					await this._initializeWebRTC();
					logger.info('Reconnection successful');
				} catch (error) {
					logger.error('Reconnection failed:', error);
					// Only now do we handle the disconnect
					this._handleDisconnect();
				} finally {
					this._isReconnecting = false;
				}
			} else {
				this._isReconnecting = false;
			}
		};

		if (immediate) {
			reconnect();
		} else {
			// Wait before attempting reconnection
			setTimeout(reconnect, 2000);
		}
	}

	// Add new method for WebSocket fallback
	_fallbackToWebSocket() {
		logger.info('Switching to WebSocket fallback mode');
		this._usingWebSocketFallback = true;
	}
} 