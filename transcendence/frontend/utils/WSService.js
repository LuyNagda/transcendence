import logger from './logger.js';

export default class WSService {
	constructor() {
		this.connections = {};
		this.messageQueues = {};
		this.callbacks = {};
		this.reconnectAttempts = {};
		this.maxReconnectAttempts = 5;
		this.send = this.send.bind(this);
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
		const token = this.getAuthToken();
		const url = `${protocol}${window.location.host}${endpoint}${token ? `?token=${token}` : ''}`;

		this.connect(name, url);
	}

	connect(name, url) {
		if (!this.callbacks[name]) {
			logger.error(`Callbacks not initialized for connection '${name}'`);
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
			}

			this.connections[name] = new WebSocket(url);

			this.connections[name].onopen = () => {
				logger.info(`WebSocket '${name}' connected`);
				this.processQueue(name);
				this.callbacks[name].onOpen.forEach(callback => callback());
			};

			this.connections[name].onmessage = (e) => {
				const data = JSON.parse(e.data);
				this.callbacks[name].onMessage.forEach(callback => callback(data));
			};

			this.connections[name].onclose = (e) => {
				logger.warn(`WebSocket '${name}' closed: ${e.code}`);
				this.callbacks[name].onClose.forEach(callback => callback(e));
			};

			this.connections[name].onerror = (err) => {
				logger.error(`WebSocket '${name}' error:`, err);
				this.callbacks[name].onError.forEach(callback => callback(err));
			};
		} catch (error) {
			logger.error(`Error creating WebSocket '${name}':`, error);
			this.handleReconnection(name, url);
		}
	}

	handleReconnection(name, url) {
		if (this.reconnectAttempts[name] >= this.maxReconnectAttempts) {
			logger.error(`Max reconnect attempts (${this.maxReconnectAttempts}) reached for '${name}'`);
			return;
		}

		this.reconnectAttempts[name]++;
		const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts[name] - 1), 30000);
		logger.info(`Scheduling reconnection for '${name}' in ${delay}ms (attempt ${this.reconnectAttempts[name]}/${this.maxReconnectAttempts})`);

		setTimeout(() => {
			if (this.connections[name]?.readyState === WebSocket.CLOSED) {
				logger.info(`Attempting to reconnect '${name}' (attempt ${this.reconnectAttempts[name]}/${this.maxReconnectAttempts})`);
				this.connect(name, url);
			}
		}, delay);
	}

	send(name, message) {
		const messageWithToken = {
			...message,
			csrfToken: this.getCSRFToken(),
		};

		if (this.connections[name]?.readyState === WebSocket.OPEN) {
			this.connections[name].send(JSON.stringify(messageWithToken));
		} else {
			logger.debug(`Connection '${name}' not ready, queueing message:`, messageWithToken);
			this.messageQueues[name].push(messageWithToken);
		}
	}

	processQueue(name) {
		while (this.messageQueues[name]?.length > 0 && this.connections[name]?.readyState === WebSocket.OPEN) {
			const message = this.messageQueues[name].shift();
			logger.debug(`Processing queued message for '${name}':`, message);
			this.send(name, message);
		}
	}

	on(name, event, callback) {
		if (this.callbacks[name] && this.callbacks[name][event]) {
			this.callbacks[name][event].push(callback);
		} else {
			logger.error(`Invalid event type or connection name: ${event}, ${name}`);
		}
	}

	once(name, event, callback) {
		if (!this.callbacks[name] || !this.callbacks[name][event]) {
			logger.error(`Invalid event type or connection name: ${event}, ${name}`);
			return;
		}

		const wrappedCallback = (...args) => {
			this.off(name, event, wrappedCallback);
			callback(...args);
		};

		this.callbacks[name][event].push(wrappedCallback);
	}

	off(name, event, callback) {
		if (!this.callbacks[name] || !this.callbacks[name][event]) {
			logger.error(`Invalid event type or connection name: ${event}, ${name}`);
			return;
		}

		const index = this.callbacks[name][event].indexOf(callback);
		if (index !== -1) {
			this.callbacks[name][event].splice(index, 1);
		}
	}

	getCSRFToken() {
		const cookieValue = document.cookie
			.split('; ')
			.find(row => row.startsWith('csrftoken='));
		return cookieValue ? cookieValue.split('=')[1] : null;
	}

	getAuthToken() {
		const cookieValue = document.cookie
			.split('; ')
			.find(row => row.startsWith('access_token='));
		return cookieValue ? cookieValue.split('=')[1] : null;
	}

	destroy(name) {
		if (this.connections[name]) {
			this.connections[name].close(1000, 'Normal closure');
			delete this.connections[name];
			delete this.messageQueues[name];
			delete this.callbacks[name];
			delete this.reconnectAttempts[name];
			delete this.connectionUrls[name];
		}
	}

	destroyAll() {
		Object.keys(this.connections).forEach(name => this.destroy(name));
	}
}
