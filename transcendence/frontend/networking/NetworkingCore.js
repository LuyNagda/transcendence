import logger from '../utils/logger.js';

/**
 * Connection states using a state pattern.
 * Each state defines allowed transitions and capabilities.
 */
export const ConnectionState = {
	DISCONNECTED: {
		name: 'disconnected',
		canConnect: true,
		canDisconnect: false,
		canSend: false
	},
	CONNECTING: {
		name: 'connecting',
		canConnect: false,
		canDisconnect: true,
		canSend: false
	},
	SIGNALING: {
		name: 'signaling',
		canConnect: false,
		canDisconnect: true,
		canSend: false
	},
	CONNECTED: {
		name: 'connected',
		canConnect: false,
		canDisconnect: true,
		canSend: true
	},
	ERROR: {
		name: 'error',
		canConnect: true,
		canDisconnect: true,
		canSend: false
	}
};

/**
 * Base connection class providing common functionality for network connections.
 * Implements event handling, message queueing, and state management.
 */
export class BaseConnection {
	constructor(name) {
		this._name = name;
		this._state = ConnectionState.DISCONNECTED;
		this._handlers = new Map();
		this._messageQueue = [];
	}

	get state() {
		return this._state;
	}

	set state(newState) {
		this._state = newState;
		this.emit('stateChange', newState);
	}

	/**
	 * Registers an event handler
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler function
	 */
	on(event, handler) {
		if (!this._handlers.has(event)) {
			this._handlers.set(event, new Set());
		}
		this._handlers.get(event).add(handler);
	}

	/**
	 * Removes an event handler
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler function to remove
	 */
	off(event, handler) {
		if (this._handlers.has(event)) {
			this._handlers.get(event).delete(handler);
		}
	}

	/**
	 * Emits an event to registered handlers
	 * @param {string} event - Event name
	 * @param {*} data - Event data
	 */
	emit(event, data) {
		if (this._handlers.has(event)) {
			this._handlers.get(event).forEach(handler => handler(data));
		}
	}

	/**
	 * Queues a message for later sending
	 * @param {*} data - Message data
	 */
	queueMessage(data) {
		this._messageQueue.push(data);
	}

	/**
	 * Processes queued messages if connection can send
	 */
	processQueue() {
		while (this._messageQueue.length > 0 && this._state.canSend) {
			const message = this._messageQueue.shift();
			this.send(message);
		}
	}

	// Abstract methods to be implemented by subclasses
	connect() { throw new Error('Must implement connect()'); }
	disconnect() { throw new Error('Must implement disconnect()'); }
	send(data) { throw new Error('Must implement send()'); }
}

/**
 * WebSocket connection implementation.
 * Handles WebSocket lifecycle, reconnection, and message passing.
 */
export class WebSocketConnection extends BaseConnection {
	constructor(name, endpoint, options = {}) {
		super(name);
		this._endpoint = endpoint;
		this._options = options;
		this._ws = null;
		this._reconnectAttempts = 0;
		this._maxReconnectAttempts = options.maxReconnectAttempts || 5;
	}

	/**
	 * Establishes WebSocket connection
	 */
	connect() {
		if (!this._state.canConnect) return;

		this.state = ConnectionState.CONNECTING;
		const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
		const url = `${protocol}${window.location.host}${this._endpoint}`;

		try {
			this._ws = new WebSocket(url);
			this._setupHandlers();
		} catch (error) {
			this._handleError(error);
		}
	}

	/**
	 * Sets up WebSocket event handlers
	 * @private
	 */
	_setupHandlers() {
		this._ws.onopen = () => {
			this.state = ConnectionState.CONNECTED;
			this._reconnectAttempts = 0;
			this.processQueue();
			this.emit('open');
		};

		this._ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				this.emit('message', data);
			} catch (error) {
				logger.error(`Error parsing WebSocket message:`, error);
			}
		};

		this._ws.onclose = (event) => {
			this.state = ConnectionState.DISCONNECTED;
			this.emit('close', event);
			this._handleClose(event);
		};

		this._ws.onerror = (error) => {
			this._handleError(error);
		};
	}

	/**
	 * Sends data through WebSocket
	 * @param {*} data - Data to send
	 */
	send(data) {
		if (!this._state.canSend) {
			this.queueMessage(data);
			return;
		}

		try {
			this._ws.send(JSON.stringify(data));
		} catch (error) {
			this.queueMessage(data);
			this._handleError(error);
		}
	}

	/**
	 * Closes WebSocket connection
	 */
	disconnect() {
		if (!this._state.canDisconnect) return;

		if (this._ws) {
			this._ws.close(1000, 'Normal closure');
			this._ws = null;
		}
		this.state = ConnectionState.DISCONNECTED;
	}

	/**
	 * Handles connection closure with exponential backoff reconnection
	 * @private
	 */
	_handleClose(event) {
		if (event.code === 1006 && this._reconnectAttempts < this._maxReconnectAttempts) {
			this._reconnectAttempts++;
			const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 30000);
			setTimeout(() => this.connect(), delay);
		}
	}

	/**
	 * Handles WebSocket errors
	 * @private
	 */
	_handleError(error) {
		logger.error(`WebSocket error for ${this._name}:`, error);
		this.state = ConnectionState.ERROR;
		this.emit('error', error);
	}
}

/**
 * WebRTC connection implementation.
 * Handles peer connections, data channels, and ICE candidate negotiation.
 */
export class WebRTCConnection extends BaseConnection {
	constructor(name, config = {}) {
		super(name);
		this._config = config;
		this._peer = null;
		this._dataChannel = null;
		this._iceGatheringComplete = false;
		this._hasReceivedAnswer = false;
		this._pendingCandidates = [];
		this._hasRemoteDescription = false;
	}

	/**
	 * Establishes WebRTC peer connection
	 */
	async connect() {
		if (!this._state.canConnect) return;

		this.state = ConnectionState.CONNECTING;
		try {
			this._peer = new RTCPeerConnection(this._config);
			this._setupPeerHandlers();

			if (this._config.isHost) {
				this._dataChannel = this._peer.createDataChannel('gameData', {
					ordered: true,
					maxRetransmits: 3
				});
				this._setupDataChannelHandlers(this._dataChannel);
			}

			if (this._config.isHost) {
				this._peer.onicegatheringstatechange = () => {
					if (this._peer.iceGatheringState === 'complete' && !this._iceGatheringComplete) {
						this._iceGatheringComplete = true;
						this.emit('ready');
					}
				};

				this.state = ConnectionState.SIGNALING;
				this._peer.createOffer().then(offer => {
					this._peer.setLocalDescription(offer);
				}).catch(error => {
					this._handleError(error);
				});
			} else {
				this.state = ConnectionState.SIGNALING;
				this.emit('ready');
			}
		} catch (error) {
			this._handleError(error);
		}
	}

	/**
	 * Sets up WebRTC peer connection handlers
	 * @private
	 */
	_setupPeerHandlers() {
		this._peer.onicecandidate = (event) => {
			if (event.candidate) {
				logger.debug(`${this._config.isHost ? 'Host' : 'Guest'}: Sending ICE candidate`);
				this.emit('iceCandidate', event.candidate);
			}
		};

		this._peer.onconnectionstatechange = () => {
			logger.debug(`Connection state changed to: ${this._peer.connectionState}`);
			if (this._peer.connectionState === 'connected') {
				this.state = ConnectionState.CONNECTED;
				this.processQueue();
			} else if (this._peer.connectionState === 'failed') {
				this._handleError(new Error('WebRTC connection failed'));
			} else if (this._peer.connectionState === 'disconnected') {
				this.state = ConnectionState.DISCONNECTED;
			}
		};

		if (!this._config.isHost) {
			this._peer.ondatachannel = (event) => {
				this._dataChannel = event.channel;
				this._setupDataChannelHandlers(this._dataChannel);
			};
		}
	}

	/**
	 * Sets up WebRTC data channel handlers
	 * @private
	 */
	_setupDataChannelHandlers(channel) {
		channel.onopen = () => {
			if (this._peer && this._peer.connectionState === 'connected') {
				this.state = ConnectionState.CONNECTED;
				this.processQueue();
				this.emit('open');
			}
		};

		channel.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				this.emit('message', data);
			} catch (error) {
				logger.error(`Error parsing WebRTC message:`, error);
			}
		};

		channel.onclose = () => {
			this.state = ConnectionState.DISCONNECTED;
			this.emit('close');
		};

		channel.onerror = (error) => {
			this._handleError(error);
		};
	}

	/**
	 * Creates and sets local offer for WebRTC connection
	 */
	async createOffer() {
		if (!this._peer || !this._config.isHost) return null;

		try {
			const offer = await this._peer.createOffer();
			await this._peer.setLocalDescription(offer);
			return offer;
		} catch (error) {
			this._handleError(error);
			return null;
		}
	}

	/**
	 * Handles incoming WebRTC offer
	 * @param {RTCSessionDescriptionInit} offer - WebRTC offer
	 */
	async handleOffer(offer) {
		if (!this._peer || this._config.isHost) return null;
		if (this._hasRemoteDescription) {
			logger.debug('Guest: Ignoring duplicate offer');
			return null;  // Early return for duplicate offers
		}

		try {
			logger.debug('Guest: Setting remote description from offer');
			this.state = ConnectionState.SIGNALING;
			await this._peer.setRemoteDescription(new RTCSessionDescription(offer));
			this._hasRemoteDescription = true;
			logger.debug('Guest: Remote description set, processing pending candidates');
			await this._processPendingCandidates();

			const answer = await this._peer.createAnswer();
			await this._peer.setLocalDescription(answer);
			return answer;
		} catch (error) {
			this._handleError(error);
			return null;
		}
	}

	/**
	 * Handles incoming WebRTC answer
	 * @param {RTCSessionDescriptionInit} answer - WebRTC answer
	 */
	async handleAnswer(answer) {
		if (!this._peer || !this._config.isHost || this._hasReceivedAnswer) {
			logger.debug('Host: Ignoring duplicate answer');
			return;  // Early return for duplicate answers
		}

		try {
			logger.debug('Host: Setting remote description from answer');
			await this._peer.setRemoteDescription(new RTCSessionDescription(answer));
			this._hasReceivedAnswer = true;
			this._hasRemoteDescription = true;
			logger.debug('Host: Remote description set, processing pending candidates');
			await this._processPendingCandidates();
		} catch (error) {
			this._handleError(error);
		}
	}

	/**
	 * Processes queued ICE candidates
	 * @private
	 */
	async _processPendingCandidates() {
		logger.debug(`Processing ${this._pendingCandidates.length} pending candidates`);
		while (this._pendingCandidates.length > 0) {
			const candidate = this._pendingCandidates.shift();
			try {
				await this._peer.addIceCandidate(new RTCIceCandidate(candidate));
				logger.debug('Successfully added ICE candidate');
			} catch (error) {
				// If we still get an error, this candidate might be invalid
				logger.debug(`Skipping invalid ICE candidate: ${error.message}`);
			}
		}
	}

	/**
	 * Handles incoming ICE candidate
	 * @param {RTCIceCandidateInit} candidate - ICE candidate
	 */
	async addIceCandidate(candidate) {
		if (!this._peer) return;

		try {
			if (this._hasRemoteDescription) {
				logger.debug('Adding ICE candidate immediately');
				await this._peer.addIceCandidate(new RTCIceCandidate(candidate));
			} else {
				this._pendingCandidates.push(candidate);
				logger.debug(`Queued ICE candidate (total pending: ${this._pendingCandidates.length})`);
			}
		} catch (error) {
			// If we fail to add the candidate immediately, queue it
			this._pendingCandidates.push(candidate);
			logger.debug(`Failed to add ICE candidate immediately, queued (total: ${this._pendingCandidates.length})`);
		}
	}

	/**
	 * Sends data through WebRTC data channel
	 * @param {*} data - Data to send
	 */
	send(data) {
		if (!this._state.canSend || !this._dataChannel || this._dataChannel.readyState !== 'open') {
			this.queueMessage(data);
			return;
		}

		try {
			this._dataChannel.send(JSON.stringify(data));
		} catch (error) {
			this.queueMessage(data);
			if (this._dataChannel.readyState === 'open') {
				this._handleError(error);
			} else {
				logger.warn(`WebRTC send failed - channel state: ${this._dataChannel.readyState}`);
				this.state = ConnectionState.DISCONNECTED;
			}
		}
	}

	/**
	 * Closes WebRTC connection
	 */
	disconnect() {
		if (!this._state.canDisconnect) return;

		if (this._dataChannel) {
			this._dataChannel.close();
			this._dataChannel = null;
		}
		if (this._peer) {
			this._peer.close();
			this._peer = null;
		}
		this.state = ConnectionState.DISCONNECTED;
	}

	/**
	 * Handles WebRTC errors
	 * @private
	 */
	_handleError(error) {
		logger.error(`WebRTC error for ${this._name}:`, error);
		this.state = ConnectionState.ERROR;
		this.emit('error', error);
	}
}