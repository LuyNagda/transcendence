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
		this._rtcConfig = {
			iceServers: [
				{ urls: 'stun:freestun.net:3478' },
				{ urls: 'turn:freestun.net:3478', username: 'free', credential: 'free' }
			],
			iceCandidatePoolSize: 10,
			iceTransportPolicy: 'all'
		};

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
	}

	async connect() {
		try {
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
		this._peer = new RTCPeerConnection(this._rtcConfig);

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

		this._dataChannel = this._peer.createDataChannel('gameData', {
			ordered: false,
			maxRetransmits: 0
		});

		this._setupDataChannel(this._dataChannel);

		const offer = await this._peer.createOffer();
		await this._peer.setLocalDescription(offer);

		this._sendWebSocketMessage({
			type: 'webrtc_signal',
			signal: {
				type: 'offer',
				sdp: offer
			}
		});
	}

	_setupDataChannel(channel) {
		channel.onopen = () => {
			logger.info('Data channel opened');
			this._isConnected = true;
		};

		channel.onclose = () => {
			logger.warn('Data channel closed');
			this._isConnected = false;
			this._handleDisconnect();
		};

		channel.onmessage = (event) => {
			const message = JSON.parse(event.data);
			this._handleGameMessage(message);
		};
	}

	_handleWebSocketMessage(data) {
		switch (data.type) {
			case 'player_ready':
				if (!this._isHost && !this._peer) {
					this._initializeWebRTC();
				}
				break;

			case 'webrtc_signal':
				this._handleWebRTCSignal(data.signal);
				break;

			case 'player_disconnected':
				this._handleDisconnect();
				break;
		}
	}

	async _handleWebRTCSignal(signal) {
		if (!this._peer) return;

		try {
			if (signal.type === 'offer') {
				await this._peer.setRemoteDescription(new RTCSessionDescription(signal));
				const answer = await this._peer.createAnswer();
				await this._peer.setLocalDescription(answer);
				this._sendWebSocketMessage({
					type: 'webrtc_signal',
					signal: {
						type: 'answer',
						sdp: answer
					}
				});
			} else if (signal.type === 'answer') {
				await this._peer.setRemoteDescription(new RTCSessionDescription(signal));
			} else if (signal.type === 'candidate') {
				await this._peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
			}
		} catch (error) {
			logger.error('Error handling WebRTC signal:', error);
		}
	}

	sendGameMessage(message) {
		if (!this._isConnected || !this._dataChannel) return;

		try {
			this._dataChannel.send(JSON.stringify(message));
		} catch (error) {
			logger.error('Error sending game message:', error);
		}
	}

	onGameMessage(type, handler) {
		this._messageHandlers.set(type, handler);
	}

	_handleGameMessage(message) {
		const handler = this._messageHandlers.get(message.type);
		if (handler) {
			handler(message);
		}
	}

	_handleDisconnect() {
		this._isConnected = false;
		if (this._peer) {
			this._peer.close();
			this._peer = null;
		}
		if (this._dataChannel) {
			this._dataChannel.close();
			this._dataChannel = null;
		}
	}

	_sendWebSocketMessage(message) {
		if (this._wsService && this._wsService.readyState === WebSocket.OPEN) {
			this._wsService.send(JSON.stringify(message));
		}
	}

	isConnected() {
		return this._isConnected;
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
} 