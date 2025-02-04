import logger from '../logger.js';

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
class BaseConnection {
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
		this._pendingRequests = new Map();
		this._messageIdCounter = 0;
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

			// Return a promise that resolves when the connection is established
			return new Promise((resolve, reject) => {
				const connectionTimeout = setTimeout(() => {
					if (this._ws && this._ws.readyState !== WebSocket.OPEN) {
						this._ws.close();
						reject(new Error('WebSocket connection timeout'));
					}
				}, 10000); // 10 second connection timeout

				this._ws.onopen = () => {
					clearTimeout(connectionTimeout);
					this.state = ConnectionState.CONNECTED;
					this._reconnectAttempts = 0;
					this.processQueue();
					this.emit('open');
					resolve();
				};

				this._ws.onerror = (error) => {
					clearTimeout(connectionTimeout);
					this._handleError(error);
					reject(error);
				};
			});
		} catch (error) {
			this._handleError(error);
			return Promise.reject(error);
		}
	}

	/**
	 * Sets up WebSocket event handlers
	 * @private
	 */
	_setupHandlers() {
		// onopen is handled in connect() method

		this._ws.onmessage = (event) => {
			this._handleMessage(event);
		};

		this._ws.onclose = (event) => {
			logger.debug(`[WebSocket] Connection closed:`, event);
			this.state = ConnectionState.DISCONNECTED;
			this.emit('close', event);
			this._handleClose(event);
		};

		this._ws.onerror = (error) => {
			logger.error(`[WebSocket] Connection error:`, error);
			this._handleError(error);
		};
	}

	/**
	 * Sends data through WebSocket
	 * @param {*} data - Data to send
	 */
	send(data) {
		if (!this._state.canSend) {
			logger.debug('[WebSocket] Cannot send, queueing message:', data);
			this.queueMessage(data);
			return;
		}

		// Check WebSocket readiness
		if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
			logger.warn('[WebSocket] Not ready, queueing message:', data);
			this.queueMessage(data);
			return;
		}

		try {
			// Ensure data is properly stringified only once
			const message = typeof data === 'string' ? data : JSON.stringify(data);
			logger.debug(`[WebSocket] Sending message:`, data);
			this._ws.send(message);
		} catch (error) {
			logger.error('[WebSocket] Error sending message:', error);
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
		if (event.code === 1000) {
			// Normal closure, just log at debug level
			logger.debug(`WebSocket closed normally (code ${event.code})`);
			this.state = ConnectionState.DISCONNECTED;
		} else if (event.code === 1006 && this._reconnectAttempts < this._maxReconnectAttempts) {
			this._reconnectAttempts++;
			const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 30000);
			logger.info(`WebSocket closed abnormally, attempting reconnect in ${delay}ms`);
			setTimeout(() => this.connect(), delay);
		} else {
			logger.warn(`WebSocket closed with code ${event.code}`);
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

	/**
	 * Sends a request and waits for response
	 * @param {string} type - Request type
	 * @param {Object} data - Request data
	 * @returns {Promise} Promise that resolves with response
	 */
	async sendRequest(type, data = {}) {
		const messageId = data.id ? `${data.id}_${type}_${++this._messageIdCounter}` : `${type}_${++this._messageIdCounter}`;
		const request = {
			action: type,
			message_id: messageId,
			...data
		};

		logger.debug(`[WebSocket] Sending request:`, request);

		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				if (this._pendingRequests.has(messageId)) {
					logger.error(`[WebSocket] Request timed out:`, { messageId, request });
					this._pendingRequests.delete(messageId);
					reject(new Error(`Request timeout after 10000ms`));
				}
			}, 10000);

			this._pendingRequests.set(messageId, { resolve, reject, timeoutId });
			this.send(request);
		});
	}

	/**
	 * Handles incoming WebSocket messages
	 * @private
	 */
	_handleMessage(event) {
		try {
			const data = JSON.parse(event.data);
			logger.debug(`[WebSocket] Received message:`, data);

			// Handle responses to pending requests
			if (data.status === 'success' && data.id) {
				const pendingRequestId = Array.from(this._pendingRequests.keys())
					.find(id => id.startsWith(data.id));

				if (pendingRequestId) {
					logger.debug(`[WebSocket] Found pending request for message:`, data);
					const { resolve, reject, timeoutId } = this._pendingRequests.get(pendingRequestId);
					clearTimeout(timeoutId);
					this._pendingRequests.delete(pendingRequestId);
					resolve(data);
					return;
				}
			}

			// Handle error responses
			if (data.status === 'error' && data.id) {
				const pendingRequestId = Array.from(this._pendingRequests.keys())
					.find(id => id.startsWith(data.id));

				if (pendingRequestId) {
					const { reject, timeoutId } = this._pendingRequests.get(pendingRequestId);
					clearTimeout(timeoutId);
					this._pendingRequests.delete(pendingRequestId);
					reject(new Error(data.message || 'Request failed'));
					return;
				}
			}

			// Emit regular messages
			this.emit('message', data);
		} catch (error) {
			logger.error(`[WebSocket] Error parsing message:`, error, event.data);
		}
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
			if (this._peer.signalingState === 'stable') {
				logger.debug('Host: Ignoring answer - connection already stable');
				return;
			}

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

// /**
//  * Base network manager class providing common functionality for network managers.
//  * Implements connection management, message handling, and state tracking.
//  */
// export class BaseNetworkManager {
// 	constructor() {
// 		this._connectionManager = new ConnectionManager();
// 		this._messageHandlers = new Map();
// 		this._pendingRequests = new Map();
// 		this._messageIdCounter = 0;
// 		this._isConnected = false;
// 	}

// 	/**
// 	 * Gets CSRF token from cookies
// 	 * @returns {string|null} CSRF token if found, null otherwise
// 	 */
// 	getCSRFToken() {
// 		return CookieService.getCookie('csrftoken');
// 	}

// 	/**
// 	 * Registers a message handler
// 	 * @param {string} type - Message type to handle
// 	 * @param {Function} handler - Handler callback
// 	 */
// 	on(type, handler) {
// 		this._messageHandlers.set(type, handler);
// 	}

// 	/**
// 	 * Removes a message handler
// 	 * @param {string} type - Message type to remove handler for
// 	 */
// 	off(type) {
// 		this._messageHandlers.delete(type);
// 	}

// 	/**
// 	 * Checks if connected
// 	 * @returns {boolean} Connection status
// 	 */
// 	isConnected() {
// 		const connection = this._getMainConnection();
// 		return connection && connection.state.name === 'connected';
// 	}

// 	/**
// 	 * Handles incoming messages and routes to registered handlers
// 	 * @protected
// 	 */
// 	_handleMessage(data) {
// 		try {
// 			logger.debug("Received data:", data);

// 			const messageType = data.type || data.action;
// 			const messageId = data.message_id || data.id;

// 			// Handle responses to pending requests
// 			if (messageId && this._pendingRequests.has(messageId)) {
// 				const { resolve, reject, timeout } = this._pendingRequests.get(messageId);
// 				clearTimeout(timeout);
// 				this._pendingRequests.delete(messageId);

// 				if (data.status === 'error') {
// 					reject(new Error(data.message || 'Request failed'));
// 					return;
// 				}
// 				resolve(data);
// 				return; // Don't process as an event if it's a response
// 			}

// 			// Handle regular message handlers
// 			if (messageType) {
// 				const handler = this._messageHandlers.get(messageType);
// 				if (handler) {
// 					handler(data);
// 				} else {
// 					logger.debug(`No handler found for message type: ${messageType}`);
// 				}
// 			}
// 		} catch (error) {
// 			logger.error('Error handling message:', error);
// 		}
// 	}

// 	/**
// 	 * Sends a message and waits for response
// 	 * @param {string} type - Message type
// 	 * @param {Object} data - Message payload
// 	 * @param {Object} options - Additional options (timeout, etc)
// 	 * @returns {Promise} Promise that resolves with the response
// 	 */
// 	async sendRequest(type, data = {}, options = {}) {
// 		const messageId = this._generateMessageId();
// 		const timeout = options.timeout || (
// 			type === 'start_game' || type === 'update_property' ? 15000 : 10000
// 		);

// 		logger.debug(`[NetworkCore] Sending request ${type} with ID ${messageId}, timeout ${timeout}ms`);

// 		return new Promise((resolve, reject) => {
// 			const timeoutHandler = setTimeout(() => {
// 				if (this._pendingRequests.has(messageId)) {
// 					logger.error(`[NetworkCore] Request ${type} (ID: ${messageId}) timed out after ${timeout}ms`);
// 					logger.debug(`[NetworkCore] Current pending requests: ${Array.from(this._pendingRequests.keys()).join(', ')}`);
// 					this._pendingRequests.delete(messageId);
// 					reject(new Error(`Request timeout after ${timeout}ms`));
// 				}
// 			}, timeout);

// 			// Store the promise handlers and metadata
// 			this._pendingRequests.set(messageId, {
// 				resolve,
// 				reject,
// 				timeoutHandler,
// 				timestamp: Date.now(),
// 				type
// 			});

// 			// Send the actual message
// 			try {
// 				const mainConnection = this._getMainConnection();
// 				if (!mainConnection || mainConnection.state.name !== 'connected') {
// 					logger.error(`[NetworkCore] Cannot send ${type} - No active connection (state: ${mainConnection?.state?.name || 'none'})`);
// 					clearTimeout(timeoutHandler);
// 					this._pendingRequests.delete(messageId);
// 					reject(new Error('No active connection'));
// 					return;
// 				}

// 				const message = {
// 					action: type,
// 					message_id: messageId,
// 					...data
// 				};

// 				logger.debug(`[NetworkCore] Sending message for ${type} through connection`);
// 				mainConnection.send(message);
// 			} catch (error) {
// 				logger.error(`[NetworkCore] Error sending ${type}: ${error.message}`);
// 				clearTimeout(timeoutHandler);
// 				this._pendingRequests.delete(messageId);
// 				reject(error);
// 			}
// 		});
// 	}

// 	/**
// 	 * Waits for a specific event to occur
// 	 * @param {string} eventType - Event type to wait for
// 	 * @param {Function} predicate - Optional function to validate the event data
// 	 * @param {number} timeout - Timeout in milliseconds
// 	 * @returns {Promise} Promise that resolves with the event data
// 	 */
// 	waitForEvent(eventType, predicate = null, timeout = 5000) {
// 		return new Promise((resolve, reject) => {
// 			const timeoutId = setTimeout(() => {
// 				this.off(eventType, eventHandler);
// 				reject(new Error(`Event ${eventType} timeout after ${timeout}ms`));
// 			}, timeout);

// 			const eventHandler = (data) => {
// 				if (!predicate || predicate(data)) {
// 					clearTimeout(timeoutId);
// 					this.off(eventType, eventHandler);
// 					resolve(data);
// 				}
// 			};

// 			this.on(eventType, eventHandler);
// 		});
// 	}

// 	_generateMessageId() {
// 		return `${Date.now()}-${this._messageIdCounter++}`;
// 	}

// 	destroy() {
// 		// Clear all pending requests
// 		this._pendingRequests.forEach(({ timeout }) => clearTimeout(timeout));
// 		this._pendingRequests.clear();

// 		// Clear message handlers
// 		this._messageHandlers.clear();

// 		// Destroy connection manager
// 		if (this._connectionManager) {
// 			this._connectionManager.destroy();
// 			this._connectionManager = null;
// 		}

// 		this._isConnected = false;
// 	}

// 	/**
// 	 * Handles connection closure
// 	 * @protected
// 	 */
// 	_handleClose(event) {
// 		const code = event?.code;
// 		const reason = event?.reason || 'No reason provided';

// 		if (code === 1000) {
// 			// Normal closure
// 			logger.debug(`Connection closed normally (code: ${code}, reason: ${reason})`);
// 		} else if (code === 1001) {
// 			// Going away (e.g., page navigation)
// 			logger.debug(`Connection closed due to navigation (code: ${code}, reason: ${reason})`);
// 		} else if (code === undefined) {
// 			// No code provided (likely internal closure)
// 			logger.debug('Connection closed internally');
// 		} else {
// 			// Abnormal closure
// 			logger.warn(`Connection closed abnormally (code: ${code}, reason: ${reason})`);
// 		}
// 		this._isConnected = false;
// 	}

// 	/**
// 	 * Handles connection errors
// 	 * @protected
// 	 */
// 	_handleError(error) {
// 		logger.error('Connection error:', error);
// 		// Pass an error event to _handleClose to ensure proper logging
// 		this._handleClose({ code: error?.code || -1 });
// 	}

// 	/**
// 	 * Gets the main connection for this manager
// 	 * @protected
// 	 * @abstract
// 	 */
// 	_getMainConnection() {
// 		throw new Error('Must implement _getMainConnection()');
// 	}
// }