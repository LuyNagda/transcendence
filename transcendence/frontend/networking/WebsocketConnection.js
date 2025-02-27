import logger from '../logger.js';
import { BaseConnection, ConnectionState } from './BaseConnection.js';

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