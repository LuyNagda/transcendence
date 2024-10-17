import logger from './logger.js';

export default class WSService {
	constructor() {
		this.connections = {};
		this.messageQueues = {};
		this.callbacks = {};
		this.reconnectAttempts = {};
		this.maxReconnectAttempts = 5;
		this.userIdCheckInterval = null;
	}

	initializeConnection(name, url) {
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

		this.connect(name, url);
	}

	connect(name, url) {
		this.connections[name] = new WebSocket(url);

		this.connections[name].onopen = () => {
			logger.debug(`WebSocket '${name}' connected`);
			this.reconnectAttempts[name] = 0;
			this.processQueue(name);
			this.callbacks[name].onOpen.forEach(callback => callback());
		};

		this.connections[name].onmessage = (e) => {
			const data = JSON.parse(e.data);
			this.callbacks[name].onMessage.forEach(callback => callback(data));
		};

		this.connections[name].onclose = (e) => {
			logger.warn(`WebSocket '${name}' closed: ${e.code}, Reason: ${e.reason}`);
			this.callbacks[name].onClose.forEach(callback => callback(e));
			this.handleReconnection(name, url);
		};

		this.connections[name].onerror = (err) => {
			logger.error(`WebSocket '${name}' error:`, err);
			this.callbacks[name].onError.forEach(callback => callback(err));
		};
	}

	handleReconnection(name, url) {
		if (this.reconnectAttempts[name] < this.maxReconnectAttempts) {
			const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts[name]), 60000);
			logger.info(`Reconnect attempt ${this.reconnectAttempts[name] + 1} for '${name}' in ${delay}ms`);
			setTimeout(() => {
				this.reconnectAttempts[name]++;
				this.connect(name, url);
			}, delay);
		} else {
			logger.error(`Max reconnect attempts reached for '${name}'.`);
		}
	}

	send(name, message) {
		if (this.connections[name] && this.connections[name].readyState === WebSocket.OPEN) {
			const messageWithToken = {
				...message,
				csrfToken: this.getCSRFToken(),
			};
			this.connections[name].send(JSON.stringify(messageWithToken));
		} else {
			logger.warn(`WebSocket '${name}' not connected. Queueing message.`);
			this.messageQueues[name].push(message);
		}
	}

	processQueue(name) {
		while (this.messageQueues[name].length > 0 && this.connections[name].readyState === WebSocket.OPEN) {
			const message = this.messageQueues[name].shift();
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

	getCSRFToken() {
		const cookieValue = document.cookie
			.split('; ')
			.find(row => row.startsWith('csrftoken='));
		return cookieValue ? cookieValue.split('=')[1] : null;
	}

	destroy(name) {
		if (this.connections[name]) {
			this.connections[name].close();
			delete this.connections[name];
			delete this.messageQueues[name];
			delete this.callbacks[name];
			delete this.reconnectAttempts[name];
		}
	}

	destroyAll() {
		Object.keys(this.connections).forEach(name => this.destroy(name));
	}
}
