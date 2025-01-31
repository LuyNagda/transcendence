import logger from '../logger.js';

export const ConnectionState = {
	DISCONNECTED: 'disconnected',
	CONNECTING: 'connecting',
	CONNECTED: 'connected',
	ERROR: 'error'
};

/**
 * Core WebSocket connection handling
 * Responsible for raw WebSocket operations and connection lifecycle
 */
export class WebSocketConnection {
	constructor(endpoint, options = {}) {
		this._endpoint = endpoint;
		this._options = {
			maxReconnectAttempts: 5,
			reconnectInterval: 1000,
			connectionTimeout: 10000,
			...options
		};

		this._ws = null;
		this._state = ConnectionState.DISCONNECTED;
		this._reconnectAttempts = 0;
		this._handlers = new Map();
		this._messageQueue = [];
	}

	/**
	 * Establishes WebSocket connection
	 */
	async connect() {
		if (this._state === ConnectionState.CONNECTED) {
			return true;
		}

		this._state = ConnectionState.CONNECTING;
		const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
		const url = `${protocol}${window.location.host}${this._endpoint}`;

		try {
			this._ws = new WebSocket(url);
			await this._setupConnection();
			return true;
		} catch (error) {
			this._handleError(error);
			return false;
		}
	}

	/**
	 * Sets up WebSocket connection with timeout
	 */
	_setupConnection() {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				if (this._state === ConnectionState.CONNECTING) {
					this._ws.close();
					reject(new Error('Connection timeout'));
				}
			}, this._options.connectionTimeout);

			this._ws.onopen = () => {
				clearTimeout(timeout);
				this._state = ConnectionState.CONNECTED;
				this._reconnectAttempts = 0;
				this._processQueue();
				this.emit('open');
				resolve();
			};

			this._ws.onclose = this._handleClose.bind(this);
			this._ws.onerror = this._handleError.bind(this);
			this._ws.onmessage = this._handleMessage.bind(this);
		});
	}

	/**
	 * Sends data through WebSocket
	 */
	send(data) {
		if (this._state !== ConnectionState.CONNECTED) {
			this._messageQueue.push(data);
			return;
		}

		try {
			const message = typeof data === 'string' ? data : JSON.stringify(data);
			this._ws.send(message);
		} catch (error) {
			this._messageQueue.push(data);
			this._handleError(error);
		}
	}

	/**
	 * Processes queued messages
	 */
	_processQueue() {
		while (this._messageQueue.length > 0 && this._state === ConnectionState.CONNECTED) {
			const message = this._messageQueue.shift();
			this.send(message);
		}
	}

	/**
	 * Closes WebSocket connection
	 */
	disconnect() {
		if (this._ws) {
			this._ws.close(1000, 'Normal closure');
			this._ws = null;
		}
		this._state = ConnectionState.DISCONNECTED;
	}

	/**
	 * Handles WebSocket messages
	 */
	_handleMessage(event) {
		try {
			const data = JSON.parse(event.data);
			this.emit('message', data);
		} catch (error) {
			logger.error('Error parsing WebSocket message:', error);
		}
	}

	/**
	 * Handles connection closure
	 */
	_handleClose(event) {
		const wasConnected = this._state === ConnectionState.CONNECTED;
		this._state = ConnectionState.DISCONNECTED;

		// Don't attempt reconnection on normal closure
		if (event.code === 1000) {
			this.emit('close', event);
			return;
		}

		// Attempt reconnection if previously connected
		if (wasConnected && this._reconnectAttempts < this._options.maxReconnectAttempts) {
			this._reconnectAttempts++;
			const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 30000);
			logger.info(`WebSocket closed abnormally, attempting reconnect in ${delay}ms`);
			setTimeout(() => this.connect(), delay);
		} else {
			this.emit('close', event);
		}
	}

	/**
	 * Handles WebSocket errors
	 */
	_handleError(error) {
		logger.error('WebSocket error:', error);
		this._state = ConnectionState.ERROR;
		this.emit('error', error);
	}

	/**
	 * Event handling methods
	 */
	on(event, handler) {
		if (!this._handlers.has(event)) {
			this._handlers.set(event, new Set());
		}
		this._handlers.get(event).add(handler);
	}

	off(event, handler) {
		const handlers = this._handlers.get(event);
		if (handlers) {
			if (handler) {
				handlers.delete(handler);
			} else {
				handlers.clear();
			}
		}
	}

	emit(event, data) {
		const handlers = this._handlers.get(event);
		if (handlers) {
			handlers.forEach(handler => {
				try {
					handler(data);
				} catch (error) {
					logger.error(`Error in ${event} handler:`, error);
				}
			});
		}
	}

	get state() {
		return this._state;
	}
} 