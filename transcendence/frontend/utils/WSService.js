import logger from './logger.js';

export default class WSService {
	constructor() {
		this.connections = {};
		this.messageQueues = {};
		this.callbacks = {};
		this.reconnectAttempts = {};
		this.maxReconnectAttempts = 5;
		this.connectionUrls = {};
	}

	initializeConnection(name, endpoint) {
		if (this.connections[name]) {
			logger.warn(`WebSocket connection '${name}' already exists.`);
			return;
		}

		this.connections[name] = null;
		this.messageQueues[name] = [];
		this.callbacks[name] = {
			onMessage: [],
			onOpen: [],
			onClose: [],
			onError: []
		};
		this.reconnectAttempts[name] = 0;
		this.connectionUrls[name] = endpoint;

		const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
		const url = `${protocol}${window.location.host}${endpoint}`;

		logger.debug(`Initializing WebSocket connection to ${url}`);
		this.connect(name, url);
	}

	connect(name, url) {
		if (!this.callbacks[name] || !this.connectionUrls[name]) {
			logger.debug(`Skipping connection for '${name}' - connection was destroyed`);
			return;
		}

		try {
			if (this.connections[name]) {
				if (this.connections[name].readyState !== WebSocket.CLOSED) {
					logger.warn(`Attempting to connect while previous connection is not closed for '${name}'`);
					return;
				}
				// Clean up the old connection
				this.connections[name].onclose = null;
				this.connections[name].onerror = null;
				this.connections[name].onmessage = null;
				this.connections[name].onopen = null;
			}

			logger.debug(`Creating new WebSocket connection for '${name}'`);
			this.connections[name] = new WebSocket(url);

			this.connections[name].onopen = () => {
				logger.info(`WebSocket '${name}' connected`);
				this.reconnectAttempts[name] = 0;
				this.processQueue(name);
				this.callbacks[name].onOpen.forEach(callback => callback());
			};

			this.connections[name].onmessage = (e) => {
				try {
					const data = JSON.parse(e.data);
					this.callbacks[name].onMessage.forEach(callback => callback(data));
				} catch (error) {
					logger.error(`Error parsing WebSocket message for '${name}':`, error);
				}
			};

			this.connections[name].onclose = (e) => {
				if (this.connections[name] && this.connectionUrls[name]) {
					logger.warn(`WebSocket '${name}' closed: ${e.code}`);
					this.callbacks[name]?.onClose.forEach(callback => callback(e));
					if (e.code === 1006 || e.code === 1001) {
						this.handleReconnection(name, url);
					}
				}
			};

			this.connections[name].onerror = (err) => {
				logger.error(`WebSocket '${name}' error:`, err);
				this.callbacks[name].onError.forEach(callback => callback(err));
			};
		} catch (error) {
			logger.error(`Error creating WebSocket '${name}':`, error);
			if (this.connections[name] && this.connectionUrls[name]) {
				this.handleReconnection(name, url);
			}
		}
	}

	handleReconnection(name, url) {
		if (!this.connections[name] || !this.connectionUrls[name]) {
			logger.debug(`Skipping reconnection for '${name}' - connection was destroyed`);
			return;
		}

		if (this.reconnectAttempts[name] >= this.maxReconnectAttempts) {
			logger.error(`Max reconnect attempts (${this.maxReconnectAttempts}) reached for '${name}'`);
			this.destroy(name);
			return;
		}

		this.reconnectAttempts[name]++;
		const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts[name] - 1), 30000);
		logger.info(`Scheduling reconnection for '${name}' in ${delay}ms (attempt ${this.reconnectAttempts[name]}/${this.maxReconnectAttempts})`);

		setTimeout(() => {
			if (this.connections[name] && this.connectionUrls[name] &&
				this.connections[name].readyState === WebSocket.CLOSED) {
				logger.info(`Attempting to reconnect '${name}' (attempt ${this.reconnectAttempts[name]}/${this.maxReconnectAttempts})`);
				this.connect(name, url);
			}
		}, delay);
	}

	on(name, event, callback) {
		if (!this.callbacks[name]) {
			this.callbacks[name] = {
				onMessage: [],
				onOpen: [],
				onClose: [],
				onError: []
			};
		}

		switch (event) {
			case 'onMessage':
				this.callbacks[name].onMessage.push(callback);
				break;
			case 'onOpen':
				this.callbacks[name].onOpen.push(callback);
				break;
			case 'onClose':
				this.callbacks[name].onClose.push(callback);
				break;
			case 'onError':
				this.callbacks[name].onError.push(callback);
				break;
			default:
				logger.warn(`Unknown WebSocket event: ${event}`);
		}
	}

	off(name, event) {
		if (!this.callbacks[name]) {
			return;
		}

		switch (event) {
			case 'onMessage':
				this.callbacks[name].onMessage = [];
				break;
			case 'onOpen':
				this.callbacks[name].onOpen = [];
				break;
			case 'onClose':
				this.callbacks[name].onClose = [];
				break;
			case 'onError':
				this.callbacks[name].onError = [];
				break;
			default:
				logger.warn(`Unknown WebSocket event: ${event}`);
		}
	}

	send(name, data) {
		if (!this.connections[name]) {
			logger.error(`WebSocket connection '${name}' not found`);
			return;
		}

		if (this.connections[name].readyState !== WebSocket.OPEN) {
			logger.debug(`Connection '${name}' not ready, queueing message:`, data);
			this.messageQueues[name].push(data);
			return;
		}

		try {
			this.connections[name].send(JSON.stringify(data));
		} catch (error) {
			logger.error('Error sending WebSocket message:', error);
			this.messageQueues[name].push(data);
		}
	}

	processQueue(name) {
		while (this.messageQueues[name]?.length > 0 && this.connections[name]?.readyState === WebSocket.OPEN) {
			const message = this.messageQueues[name].shift();
			logger.debug(`Processing queued message for '${name}':`, message);
			this.send(name, message);
		}
	}

	destroy(name) {
		if (!this.connections[name]) {
			return;
		}

		logger.debug(`Destroying WebSocket connection '${name}'`);

		// Reset reconnect attempts to prevent further reconnection attempts
		this.reconnectAttempts[name] = this.maxReconnectAttempts;

		// Clean up callbacks first
		if (this.callbacks[name]) {
			this.callbacks[name] = {
				onMessage: [],
				onOpen: [],
				onClose: [],
				onError: []
			};
		}

		// Then close the connection
		if (this.connections[name]) {
			// Remove event handlers before closing to prevent any last-minute events
			this.connections[name].onclose = null;
			this.connections[name].onerror = null;
			this.connections[name].onmessage = null;
			this.connections[name].onopen = null;

			if (this.connections[name].readyState === WebSocket.OPEN ||
				this.connections[name].readyState === WebSocket.CONNECTING) {
				try {
					this.connections[name].close(1000, 'Normal closure');
				} catch (error) {
					logger.warn(`Error closing WebSocket connection '${name}':`, error);
				}
			}
		}

		// Clear message queue
		if (this.messageQueues[name]) {
			this.messageQueues[name] = [];
		}

		// Clean up all references
		delete this.connections[name];
		delete this.messageQueues[name];
		delete this.callbacks[name];
		delete this.reconnectAttempts[name];
		delete this.connectionUrls[name];

		logger.debug(`WebSocket connection '${name}' destroyed`);
	}
}
